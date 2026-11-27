// supabase/functions/_shared/email-verification-http.mjs
var GateError = class extends Error {
  constructor(code, status = 503) {
    super(code);
    this.code = code;
    this.status = status;
  }
};
var requireGate = (condition, code = "UNAVAILABLE", status = 503) => {
  if (!condition) throw new GateError(code, status);
};
async function readBoundedJSON(source, maxBytes) {
  const size = source.headers.get("content-length");
  requireGate(!size || /^\d+$/.test(size) && Number(size) <= maxBytes);
  requireGate(/^application\/json(?:\s*;|$)/i.test(source.headers.get("content-type") || ""));
  requireGate(source.body);
  const reader = source.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    for (; ; ) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new GateError("UNAVAILABLE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const all = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
  } catch {
    throw new GateError("UNAVAILABLE");
  }
}
async function upstreamJSON(fetcher, url, init, maxBytes = 65536) {
  const controller = new AbortController();
  let timer;
  const work = async () => {
    const response = await fetcher(url, { ...init, redirect: "manual", signal: controller.signal });
    requireGate(
      !response.redirected && response.status >= 200 && response.status < 300,
      response.status === 401 || response.status === 403 ? "SIGN_IN_REQUIRED" : "UNAVAILABLE",
      response.status === 401 || response.status === 403 ? 401 : 503
    );
    return await readBoundedJSON(response, maxBytes);
  };
  try {
    return await Promise.race([work(), new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new GateError("UNAVAILABLE"));
      }, 8e3);
    })]);
  } catch (error) {
    if (error instanceof GateError) throw error;
    throw new GateError("UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

// supabase/functions/_shared/email-verification-crypto.mjs
var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var enc = new TextEncoder();
var need = (ok) => {
  if (!ok) throw new Error("EMAIL_CRYPTO_INPUT_REJECTED");
};
var hex = (bytes) => Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
async function codeMac({ userId, sessionId, challengeId, keyVersion, code, pepper }) {
  need(uuid.test(userId || "") && uuid.test(sessionId || "") && uuid.test(challengeId || "") && /^[A-Za-z0-9_-]{1,32}$/.test(keyVersion || "") && /^\d{6}$/.test(code || "") && pepper instanceof Uint8Array && pepper.length >= 32 && pepper.length <= 64);
  const key = await crypto.subtle.importKey("raw", pepper, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const message = ["mushavo-email-v1", userId.toLowerCase(), sessionId.toLowerCase(), challengeId.toLowerCase(), keyVersion, code].join("\0");
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}
function newCode() {
  const values = new Uint32Array(1), limit = Math.floor(4294967296 / 1e6) * 1e6;
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return String(values[0] % 1e6).padStart(6, "0");
}
async function newChallengeMaterial({ userId, sessionId, keyVersion, pepper }) {
  const challengeId = crypto.randomUUID(), code = newCode();
  return { challengeId, code, keyVersion, codeMac: await codeMac({ userId, sessionId, challengeId, keyVersion, code, pepper }) };
}
async function deviceDigest(credential2) {
  need(typeof credential2 === "string" && /^[A-Za-z0-9_-]{43}$/.test(credential2));
  return hex(await crypto.subtle.digest("SHA-256", enc.encode("mushavo-device-v1\0" + credential2)));
}
async function newDeviceMaterial() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const credential2 = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  return { credential: credential2, digest: await deviceDigest(credential2) };
}
function enrollmentMessage({ userId, sessionId, keyVersion, credential: credential2, issuedAt, pepper }) {
  need(uuid.test(userId || "") && uuid.test(sessionId || "") && /^[A-Za-z0-9_-]{1,32}$/.test(keyVersion || "") && /^[A-Za-z0-9_-]{43}$/.test(credential2 || "") && Number.isSafeInteger(issuedAt) && issuedAt > 0 && pepper instanceof Uint8Array && pepper.length >= 32 && pepper.length <= 64);
  return enc.encode(["mushavo-signup-device-v1", userId.toLowerCase(), sessionId.toLowerCase(), credential2, keyVersion, String(issuedAt)].join("\0"));
}
async function enrollmentMac(args) {
  const message = enrollmentMessage(args);
  const key = await crypto.subtle.importKey("raw", args.pepper, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, message));
}
async function validEnrollmentMac(args, mac) {
  if (typeof mac !== "string" || !/^[0-9a-f]{64}$/.test(mac)) return false;
  const message = enrollmentMessage(args);
  const key = await crypto.subtle.importKey("raw", args.pepper, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const signature = Uint8Array.from(mac.match(/../g), (value) => parseInt(value, 16));
  return crypto.subtle.verify("HMAC", key, signature, message);
}

// supabase/functions/_shared/email-verification-zoho.mjs
var mailbox = /^[A-Za-z0-9.!#$%&'*+\-/=?^_`{|}~]+@[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?\.[A-Za-z]{2,63}$/;
var isSingleMailbox = (value) => typeof value === "string" && value.length <= 254 && mailbox.test(value);
function createZohoCodeMailer({ fetcher, config }) {
  requireGate(typeof fetcher === "function" && config?.mailOrigin === "https://mail.zoho.com" && config.accountsOrigin === "https://accounts.zoho.com" && /^[0-9]{1,32}$/.test(config.accountId || "") && isSingleMailbox(config.from));
  for (const key of ["clientId", "clientSecret", "refreshToken"]) {
    requireGate(typeof config[key] === "string" && config[key].length >= 8 && config[key].length <= 4096 && !/[\r\n\0]/.test(config[key]));
  }
  requireGate(Array.isArray(config.allowedRecipients) && config.allowedRecipients.length >= 1 && config.allowedRecipients.length <= 10 && config.allowedRecipients.every(isSingleMailbox));
  const allowed = new Set(config.allowedRecipients.map((x) => x.toLowerCase()));
  return async ({ to, code }) => {
    requireGate(isSingleMailbox(to) && allowed.has(to.toLowerCase()) && /^\d{6}$/.test(code || ""), "RECIPIENT_NOT_PREPARED", 403);
    const token = await upstreamJSON(fetcher, config.accountsOrigin + "/oauth/v2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken
      }).toString()
    }, 16384);
    requireGate(typeof token.access_token === "string" && /^[A-Za-z0-9._-]{8,4096}$/.test(token.access_token) && Number.isInteger(token.expires_in) && token.expires_in > 0 && token.expires_in <= 86400);
    const sent = await upstreamJSON(fetcher, config.mailOrigin + "/api/accounts/" + config.accountId + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Zoho-oauthtoken " + token.access_token },
      body: JSON.stringify({
        fromAddress: config.from,
        toAddress: to,
        subject: "Your Mushavo Budget sign-in code",
        mailFormat: "plaintext",
        encoding: "UTF-8",
        askReceipt: "no",
        content: "Your Mushavo Budget sign-in code is " + code + ".\n\nIt expires in 10 minutes. Never share this code. If you did not request it, you can ignore this message."
      })
    });
    requireGate(sent?.status?.code === 200);
    return { accepted: true };
  };
}

// supabase/functions/_shared/email-verification-gateway.mjs
var STAGING_PROJECT = "dczlddwbtgvfdujgcitb";
var STAGING_ORIGIN = "https://mushavo-budget-staging.pages.dev";
var backend = "https://" + STAGING_PROJECT + ".supabase.co";
var prefix = "/api/email-verification/";
var uuid2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
var credential = /^[A-Za-z0-9_-]{43}$/;
var BROWSER_CREDENTIAL_MAX_AGE = 3456e4;
var reply = (status, data, cookie) => {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
  };
  const responseHeaders = new Headers(headers);
  for (const value of cookie ? Array.isArray(cookie) ? cookie : [cookie] : []) responseHeaders.append("set-cookie", value);
  return new Response(JSON.stringify(data), { status, headers: responseHeaders });
};
var exactKeys = (value, keys) => value && !Array.isArray(value) && typeof value === "object" && Object.keys(value).sort().join(",") === keys.slice().sort().join(",");
var cookieName = (user) => "__Host-mushavo_device_" + user.replaceAll("-", "");
var pendingName = (user) => "__Host-mushavo_enroll_" + user.replaceAll("-", "");
function cookieValues(request, name) {
  return (request.headers.get("cookie") || "").split(";").map((x) => x.trim()).filter((x) => x.startsWith(name + "=")).map((x) => x.slice(name.length + 1));
}
function getCredential(request, user) {
  const values = cookieValues(request, cookieName(user));
  requireGate(values.length <= 1, "INVALID_REQUEST", 400);
  requireGate(!values.length || credential.test(values[0]), "INVALID_REQUEST", 400);
  return values[0] || null;
}
var clearCookie = (user) => cookieName(user) + "=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0";
function approvalCookie(user, token, now) {
  const until = now() + BROWSER_CREDENTIAL_MAX_AGE * 1e3;
  const seconds = BROWSER_CREDENTIAL_MAX_AGE;
  requireGate(credential.test(token) && Number.isFinite(until));
  return cookieName(user) + "=" + token + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=" + seconds + "; Expires=" + new Date(until).toUTCString();
}
var clearPending = (user) => pendingName(user) + "=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0";
function freshSignupProof(claims, user, now) {
  const seconds = Math.floor(now() / 1e3), confirmed = Date.parse(user.email_confirmed_at) / 1e3;
  if (!Array.isArray(claims.amr) || claims.amr.length > 16 || !Number.isSafeInteger(claims.iat) || claims.iat > seconds + 30 || claims.iat < seconds - 300) return null;
  const emailOnly = !user.phone && !user.phone_confirmed_at;
  const proofs = claims.amr.filter((value) => value && (value.method === "email/signup" || value.method === "otp" && emailOnly) && Number.isSafeInteger(value.timestamp) && value.timestamp >= seconds - 300 && value.timestamp <= seconds + 30 && value.timestamp <= claims.iat + 30 && Math.abs(confirmed - value.timestamp) <= 120);
  if (!proofs.length) return null;
  return new Date(Math.max(...proofs.map((value) => value.timestamp)) * 1e3).toISOString();
}
function claimsFrom(token) {
  requireGate(typeof token === "string" && token.length <= 16384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token), "SIGN_IN_REQUIRED", 401);
  try {
    const raw = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    return JSON.parse(atob(raw + "=".repeat((4 - raw.length % 4) % 4)));
  } catch {
    throw new GateError("SIGN_IN_REQUIRED", 401);
  }
}
function createBackendAdapter({ fetcher, publishableKey, serviceKey, now = Date.now }) {
  requireGate(typeof fetcher === "function" && /^[A-Za-z0-9_.-]{8,4096}$/.test(publishableKey || "") && /^[A-Za-z0-9_.-]{8,8192}$/.test(serviceKey || "") && serviceKey !== publishableKey);
  return {
    async authenticate(request) {
      const auth = request.headers.get("authorization") || "";
      requireGate(auth.startsWith("Bearer "), "SIGN_IN_REQUIRED", 401);
      const token = auth.slice(7), claims = claimsFrom(token);
      requireGate(uuid2.test(claims.sub || "") && uuid2.test(claims.session_id || "") && claims.role === "authenticated" && claims.aud === "authenticated" && claims.iss === backend + "/auth/v1" && Number.isInteger(claims.exp) && claims.exp > Math.floor(now() / 1e3), "SIGN_IN_REQUIRED", 401);
      const user = await upstreamJSON(fetcher, backend + "/auth/v1/user", {
        method: "GET",
        headers: { apikey: publishableKey, authorization: auth }
      });
      requireGate(user.id === claims.sub && user.is_anonymous !== true && isSingleMailbox(user.email) && typeof user.email_confirmed_at === "string" && Number.isFinite(Date.parse(user.email_confirmed_at)), "SIGN_IN_REQUIRED", 401);
      return { userId: user.id, sessionId: claims.session_id, email: user.email, signupProofAt: freshSignupProof(claims, user, now) };
    },
    async rpc(name, args) {
      requireGate([
        "begin_challenge",
        "set_delivery",
        "challenge_context",
        "verify_challenge",
        "restore_device",
        "revoke_device",
        "revoke_all",
        "session_status",
        "register_link_device"
      ].includes(name));
      const headers = { apikey: serviceKey, "content-type": "application/json" };
      if (!serviceKey.startsWith("sb_secret_")) headers.authorization = "Bearer " + serviceKey;
      return await upstreamJSON(fetcher, backend + "/rest/v1/rpc/email_gate_" + name, {
        method: "POST",
        headers,
        body: JSON.stringify(args)
      });
    }
  };
}
function createEmailGateway({ adapter, mailer, keyring, currentKeyVersion, limit, now = Date.now }) {
  requireGate(adapter && typeof adapter.authenticate === "function" && typeof adapter.rpc === "function" && typeof mailer === "function" && typeof limit === "function" && /^[A-Za-z0-9_-]{1,32}$/.test(currentKeyVersion || "") && keyring instanceof Map && keyring.get(currentKeyVersion) instanceof Uint8Array && keyring.get(currentKeyVersion).length >= 32);
  return async (request) => {
    try {
      const url = new URL(request.url), route = url.pathname.slice(prefix.length);
      requireGate(
        url.origin === STAGING_ORIGIN && url.pathname.startsWith(prefix) && ["begin", "verify", "restore", "status", "forget", "revoke-all", "confirm-device"].includes(route) && !url.search,
        "NOT_FOUND",
        404
      );
      requireGate(request.method === "POST", "METHOD_NOT_ALLOWED", 405);
      requireGate(
        request.headers.get("origin") === STAGING_ORIGIN && request.headers.get("x-mushavo-csrf") === "email-v1" && (!request.headers.has("sec-fetch-site") || request.headers.get("sec-fetch-site") === "same-origin"),
        "ORIGIN_REJECTED",
        403
      );
      const ip = request.headers.get("cf-connecting-ip");
      requireGate(typeof ip === "string" && /^[0-9a-fA-F:.]{2,64}$/.test(ip));
      requireGate((await limit({ ip, route }))?.success === true, "RATE_LIMITED", 429);
      let body;
      try {
        body = await readBoundedJSON(request, 4096);
      } catch {
        throw new GateError("INVALID_REQUEST", 400);
      }
      requireGate(exactKeys(body, route === "begin" ? ["remember"] : route === "verify" ? ["challengeId", "code"] : []), "INVALID_REQUEST", 400);
      if (route === "begin") requireGate(typeof body.remember === "boolean", "INVALID_REQUEST", 400);
      if (route === "verify") requireGate(typeof body.challengeId === "string" && uuid2.test(body.challengeId) && typeof body.code === "string" && /^\d{6}$/.test(body.code), "INVALID_REQUEST", 400);
      const actor = await adapter.authenticate(request);
      const args = { p_user: actor.userId, p_session: actor.sessionId };
      const call = (name, more = {}) => adapter.rpc(name, { ...args, ...more });
      const status = async () => {
        const value = await call("session_status");
        requireGate(typeof value === "boolean");
        return value;
      };
      if (route === "status") return reply(200, { verified: await status() });
      const remembered = getCredential(request, actor.userId);
      if (route === "confirm-device") {
        requireGate(typeof actor.signupProofAt === "string" && Number.isFinite(Date.parse(actor.signupProofAt)), "SIGNUP_LINK_REQUIRED", 403);
        const values = cookieValues(request, pendingName(actor.userId));
        requireGate(values.length <= 1, "INVALID_REQUEST", 400);
        let pending = null;
        if (values.length) {
          requireGate(values[0].length <= 160, "INVALID_REQUEST", 400);
          const parts = values[0].split("."), issuedAt = Number(parts[2]), seconds = Math.floor(now() / 1e3);
          requireGate(parts.length === 4 && credential.test(parts[0]) && keyring.has(parts[1]) && /^[0-9]{1,12}$/.test(parts[2]) && Number.isSafeInteger(issuedAt) && issuedAt >= seconds - 300 && issuedAt <= seconds + 30, "SIGNUP_LINK_REQUIRED", 403);
          requireGate(await validEnrollmentMac({
            userId: actor.userId,
            sessionId: actor.sessionId,
            credential: parts[0],
            keyVersion: parts[1],
            issuedAt,
            pepper: keyring.get(parts[1])
          }, parts[3]), "SIGNUP_LINK_REQUIRED", 403);
          pending = parts[0];
        }
        if (!pending && remembered) {
          const result2 = await call("register_link_device", { p_device_digest: await deviceDigest(remembered), p_proof_at: actor.signupProofAt, p_allow_new: false });
          if (result2?.result === "TRUSTED" && result2.persistent === true) return reply(200, { result: "TRUSTED", persistent: true }, [approvalCookie(actor.userId, remembered, now), clearPending(actor.userId)]);
          requireGate(result2?.result === "PENDING_REQUIRED", "SIGNUP_LINK_REQUIRED", 403);
        }
        if (!pending) {
          const device2 = await newDeviceMaterial(), issuedAt = Math.floor(now() / 1e3);
          const mac2 = await enrollmentMac({
            userId: actor.userId,
            sessionId: actor.sessionId,
            credential: device2.credential,
            keyVersion: currentKeyVersion,
            issuedAt,
            pepper: keyring.get(currentKeyVersion)
          });
          const value = [device2.credential, currentKeyVersion, issuedAt, mac2].join(".");
          return reply(200, { result: "DEVICE_COOKIE_PREPARED" }, pendingName(actor.userId) + "=" + value + "; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=300");
        }
        const result = await call("register_link_device", { p_device_digest: await deviceDigest(pending), p_proof_at: actor.signupProofAt, p_allow_new: true });
        requireGate(result?.result === "TRUSTED" && result.persistent === true, "SIGNUP_LINK_REQUIRED", 403);
        return reply(200, { result: "TRUSTED", persistent: true }, [approvalCookie(actor.userId, pending, now), clearPending(actor.userId)]);
      }
      if (route === "restore") {
        if (await status()) return reply(200, { result: "VERIFIED" });
        if (!remembered) return reply(200, { result: "CODE_REQUIRED" });
        const result = await call("restore_device", { p_device_digest: await deviceDigest(remembered) });
        requireGate(["APPROVED", "CODE_REQUIRED"].includes(result?.result));
        if (result.result === "APPROVED") requireGate(result.device_persistent === true && result.device_expires_at === null);
        return reply(200, { result: result.result }, result.result === "CODE_REQUIRED" ? clearCookie(actor.userId) : approvalCookie(actor.userId, remembered, now));
      }
      if (route === "forget") {
        requireGate(await status(), "VERIFICATION_REQUIRED", 403);
        if (remembered) {
          const result = await call("revoke_device", { p_device_digest: await deviceDigest(remembered) });
          requireGate(["REVOKED", "NOT_FOUND"].includes(result?.result));
        }
        return reply(200, { result: "FORGOTTEN" }, clearCookie(actor.userId));
      }
      if (route === "revoke-all") {
        const result = await call("revoke_all");
        requireGate(result?.result === "REVOKED", "VERIFICATION_REQUIRED", 403);
        return reply(200, { result: "REVOKED" }, clearCookie(actor.userId));
      }
      if (route === "begin") {
        if (await status()) return reply(200, { result: "VERIFIED" });
        const material = await newChallengeMaterial({
          userId: actor.userId,
          sessionId: actor.sessionId,
          keyVersion: currentKeyVersion,
          pepper: keyring.get(currentKeyVersion)
        });
        const begun = await call("begin_challenge", {
          p_challenge: material.challengeId,
          p_code_mac: material.codeMac,
          p_key_version: currentKeyVersion,
          p_remember: body.remember
        });
        if (["COOLDOWN", "RATE_LIMIT"].includes(begun?.result)) return reply(429, { result: begun.result });
        requireGate(begun?.result === "PENDING_DELIVERY" && begun.challenge_id === material.challengeId && Number.isFinite(Date.parse(begun.expires_at)));
        let accepted = false;
        try {
          accepted = (await mailer({ to: actor.email, code: material.code }))?.accepted === true;
        } catch {
          accepted = false;
        }
        const delivery = await call("set_delivery", { p_challenge: material.challengeId, p_delivered: accepted });
        requireGate(accepted && delivery?.result === "READY", "MAIL_UNAVAILABLE", 503);
        return reply(200, { result: "CODE_REQUESTED", challengeId: material.challengeId, expiresAt: begun.expires_at });
      }
      const context = await call("challenge_context", { p_challenge: body.challengeId });
      requireGate(context && typeof context.remember_device === "boolean" && typeof context.key_version === "string" && keyring.has(context.key_version), "CODE_UNAVAILABLE", 400);
      const mac = await codeMac({
        userId: actor.userId,
        sessionId: actor.sessionId,
        challengeId: body.challengeId,
        keyVersion: context.key_version,
        code: body.code,
        pepper: keyring.get(context.key_version)
      });
      const device = context.remember_device ? await newDeviceMaterial() : null;
      const verified = await call("verify_challenge", { p_challenge: body.challengeId, p_code_mac: mac, p_device_digest: device?.digest || null });
      if (["UNAVAILABLE", "LOCKED", "CODE_REJECTED", "INVALID"].includes(verified?.result)) return reply(400, { result: "CODE_REJECTED" });
      requireGate(verified?.result === "VERIFIED");
      if (device) requireGate(verified.device_persistent === true && verified.device_expires_at === null);
      const cookie = device ? approvalCookie(actor.userId, device.credential, now) : clearCookie(actor.userId);
      return reply(200, { result: "VERIFIED" }, cookie);
    } catch (error) {
      return reply(
        error instanceof GateError ? error.status : 503,
        { result: error instanceof GateError ? error.code : "UNAVAILABLE" }
      );
    }
  };
}
function gatewayFromEnvironment(env, fetcher = globalThis.fetch) {
  requireGate(env.EMAIL_GATE_MODE === "STAGING_CONTROLLED_ONLY" && env.EMAIL_GATE_PROJECT === STAGING_PROJECT && env.EMAIL_GATE_ORIGIN === STAGING_ORIGIN && typeof env.EMAIL_GATE_RATE_LIMITER?.limit === "function");
  let rawKeys, recipients;
  try {
    rawKeys = JSON.parse(env.EMAIL_GATE_PEPPERS_JSON);
    recipients = JSON.parse(env.ZOHO_TEST_RECIPIENTS_JSON);
  } catch {
    throw new GateError("UNAVAILABLE");
  }
  requireGate(rawKeys && !Array.isArray(rawKeys) && Object.keys(rawKeys).length >= 1 && Object.keys(rawKeys).length <= 4);
  const keyring = new Map(Object.entries(rawKeys).map(([name, hex2]) => {
    requireGate(/^[A-Za-z0-9_-]{1,32}$/.test(name) && typeof hex2 === "string" && /^[a-f0-9]{64}$/.test(hex2));
    return [name, Uint8Array.from(hex2.match(/../g), (x) => parseInt(x, 16))];
  }));
  return createEmailGateway({
    adapter: createBackendAdapter({ fetcher, publishableKey: env.SUPABASE_PUBLISHABLE_KEY, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY }),
    mailer: createZohoCodeMailer({ fetcher, config: {
      mailOrigin: env.ZOHO_MAIL_ORIGIN,
      accountsOrigin: env.ZOHO_ACCOUNTS_ORIGIN,
      accountId: env.ZOHO_ACCOUNT_ID,
      from: env.ZOHO_FROM_ADDRESS,
      clientId: env.ZOHO_CLIENT_ID,
      clientSecret: env.ZOHO_CLIENT_SECRET,
      refreshToken: env.ZOHO_REFRESH_TOKEN,
      allowedRecipients: recipients
    } }),
    keyring,
    currentKeyVersion: env.EMAIL_GATE_KEY_VERSION,
    limit: ({ ip }) => env.EMAIL_GATE_RATE_LIMITER.limit({ key: "mushavo-email:" + ip })
  });
}
var email_verification_gateway_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(prefix)) {
      try {
        return await gatewayFromEnvironment(env)(request);
      } catch {
        return reply(503, { result: "UNAVAILABLE" });
      }
    }
    if (!["GET", "HEAD"].includes(request.method)) return reply(405, { result: "METHOD_NOT_ALLOWED" });
    if (typeof env.ASSETS?.fetch !== "function") return reply(503, { result: "UNAVAILABLE" });
    const clean = new Request(request);
    clean.headers.delete("authorization");
    clean.headers.delete("cookie");
    return env.ASSETS.fetch(clean);
  }
};

// supabase/functions/_shared/email-verification-rate-client.mjs
function canonicalIP(value) {
  requireGate(typeof value === "string" && value.length <= 64);
  const ipv4 = (s) => {
    requireGate(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s));
    const octets = s.split(".").map(Number);
    requireGate(octets.every((n) => n <= 255));
    return octets;
  };
  if (!value.includes(":")) return "v4:" + ipv4(value).join(".");
  let raw = value.toLowerCase();
  requireGate(/^[0-9a-f:.]+$/.test(raw));
  if (raw.includes(".")) {
    const colon = raw.lastIndexOf(":"), v = ipv4(raw.slice(colon + 1));
    raw = raw.slice(0, colon + 1) + (v[0] << 8 | v[1]).toString(16) + ":" + (v[2] << 8 | v[3]).toString(16);
  }
  const sides = raw.split("::");
  requireGate(sides.length <= 2);
  const parts = (s) => s ? s.split(":") : [];
  const left = parts(sides[0]), right = sides.length === 2 ? parts(sides[1]) : [];
  requireGate([...left, ...right].every((x) => /^[0-9a-f]{1,4}$/.test(x)));
  requireGate(sides.length === 1 ? left.length === 8 : left.length + right.length < 8);
  const words = [...left, ...Array(sides.length === 1 ? 0 : 8 - left.length - right.length).fill("0"), ...right].map((x) => parseInt(x, 16));
  requireGate(words.length === 8);
  if (words.slice(0, 5).every((x) => x === 0) && words[5] === 65535) return "v4:" + [words[6] >> 8, words[6] & 255, words[7] >> 8, words[7] & 255].join(".");
  return "v6:" + words.map((n) => n.toString(16).padStart(4, "0")).join(":");
}
async function rateObjectName(ip, pepperHex) {
  requireGate(typeof pepperHex === "string" && /^[a-f0-9]{64}$/.test(pepperHex));
  const key = await crypto.subtle.importKey("raw", Uint8Array.from(pepperHex.match(/../g), (x) => parseInt(x, 16)), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("mushavo-email-ip-v1\0" + canonicalIP(ip)));
  return "email-ip-v1:" + Array.from(new Uint8Array(signature), (n) => n.toString(16).padStart(2, "0")).join("");
}
function durableRatePort(namespace, pepperHex) {
  requireGate(typeof namespace?.idFromName === "function" && typeof namespace?.get === "function" && typeof pepperHex === "string" && /^[a-f0-9]{64}$/.test(pepperHex));
  return { async limit({ key }) {
    requireGate(typeof key === "string" && key.startsWith("mushavo-email:"));
    const name = await rateObjectName(key.slice("mushavo-email:".length), pepperHex);
    const stub = namespace.get(namespace.idFromName(name));
    requireGate(typeof stub?.fetch === "function");
    const result = await upstreamJSON((url, init) => stub.fetch(url, init), "https://email-rate.internal/check", {
      method: "POST",
      headers: { "content-type": "application/json", "x-mushavo-internal": "email-rate-v1" },
      body: "{}"
    }, 1024);
    requireGate(typeof result?.success === "boolean");
    return { success: result.success };
  } };
}

// supabase/functions/_shared/email-verification-pages.mjs
var email_verification_pages_default = {
  async fetch(request, env) {
    if (!new URL(request.url).pathname.startsWith("/api/email-verification/")) return email_verification_gateway_default.fetch(request, env);
    try {
      const port = durableRatePort(env.EMAIL_GATE_LIMITER_NS, env.EMAIL_GATE_RATE_PEPPER);
      return email_verification_gateway_default.fetch(request, { ...env, EMAIL_GATE_RATE_LIMITER: port });
    } catch {
      return new Response('{"result":"UNAVAILABLE"}', { status: 503, headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "no-referrer",
        "content-security-policy": "default-src 'none'; frame-ancestors 'none'"
      } });
    }
  }
};
export {
  email_verification_pages_default as default
};
