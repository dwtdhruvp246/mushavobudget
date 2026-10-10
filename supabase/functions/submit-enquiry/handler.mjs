// Public contact gate. Dependency injection is for local tests, never a request option.
export const CONTACT_ACTION = "public_contact";
export const MAX_BODY_BYTES = 32768;
export const PROJECT_ORIGINS = Object.freeze({
  "https://dczlddwbtgvfdujgcitb.supabase.co": "https://mushavo-budget-staging.pages.dev",
  "https://kttkospkblwvguuwnhjj.supabase.co": "https://mushavobudget.com",
});
const COUNTRY_CODES = new Set((
  "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BV BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF TF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT HM VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW"
).split(" "));
const TYPES = new Set(["support", "sales", "subscription_renewal", "setup_help", "country_availability", "partnership"]);
const FIELDS = ["full_name", "email", "country_code", "country_name", "enquiry_type", "message", "turnstile_token", "website"];
const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

class Rejection extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

export function readConfiguration(get) {
  const supabaseUrl = get("SUPABASE_URL");
  // New runtime keys are preferred. Legacy service_role remains a compatibility
  // fallback for projects whose Edge runtime has not injected the new dictionary.
  let keys = {};
  try {
    const parsed = JSON.parse(get("SUPABASE_SECRET_KEYS") || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) keys = parsed;
  } catch { /* fail closed below */ }
  const backendKey = keys.default || get("SUPABASE_SERVICE_ROLE_KEY");
  const turnstileSecret = get("MUSHAVO_CONTACT_TURNSTILE_SECRET");
  const quotaSecret = get("MUSHAVO_CONTACT_QUOTA_SECRET");
  if (!Object.hasOwn(PROJECT_ORIGINS, supabaseUrl) || typeof backendKey !== "string" ||
      !(/^(sb_secret_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_.-]+)$/.test(backendKey)) ||
      typeof turnstileSecret !== "string" || !/^[A-Za-z0-9_-]{20,200}$/.test(turnstileSecret) ||
      /^[123]x0{10}/.test(turnstileSecret) || !/^[a-fA-F0-9]{64}$/.test(quotaSecret || "")) {
    return null;
  }
  return { supabaseUrl, origin: PROJECT_ORIGINS[supabaseUrl], backendKey, turnstileSecret, quotaSecret };
}

async function boundedJson(stream, limit, timeoutMs = 8000) {
  if (!stream) throw new Rejection(400, "INVALID_SUBMISSION");
  const reader = stream.getReader();
  const chunks = [];
  let length = 0, finished = false, timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Rejection(408, "REQUEST_TIMEOUT")), timeoutMs);
  });
  try {
    while (true) {
      const next = await Promise.race([reader.read(), timeout]);
      if (next.done) { finished = true; break; }
      length += next.value.byteLength;
      if (length > limit) throw new Rejection(413, "SUBMISSION_TOO_LARGE");
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Rejection(400, "INVALID_SUBMISSION"); }
  } finally {
    clearTimeout(timer);
    if (!finished) reader.cancel().catch(() => {});
  }
}

function validateSubmission(input) {
  if (!input || typeof input !== "object" || Array.isArray(input) ||
      Object.keys(input).some(key => !FIELDS.includes(key)) ||
      FIELDS.slice(0, 7).some(key => typeof input[key] !== "string") ||
      (input.website !== undefined && (typeof input.website !== "string" || input.website.trim() !== ""))) {
    throw new Rejection(400, "INVALID_SUBMISSION");
  }
  const payload = Object.fromEntries(FIELDS.slice(0, 6).map(key => [key, input[key].trim()]));
  payload.email = payload.email.toLowerCase();
  payload.country_code = payload.country_code.toUpperCase();
  const length = value => [...value].length;
  if (length(payload.full_name) < 2 || length(payload.full_name) > 120 ||
      payload.email.length < 5 || payload.email.length > 254 ||
      !/^[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(payload.email) ||
      !COUNTRY_CODES.has(payload.country_code) || !TYPES.has(payload.enquiry_type) ||
      length(payload.country_name) < 2 || length(payload.country_name) > 100 ||
      length(payload.message) < 10 || length(payload.message) > 5000 ||
      Object.values(payload).some(value => /\u0000/.test(value))) {
    throw new Rejection(400, "INVALID_SUBMISSION");
  }
  // Country names cannot be used to spoof queue classification.
  payload.country_name = new Intl.DisplayNames(["en"], { type: "region" }).of(payload.country_code);
  if (!payload.country_name || length(payload.country_name) > 100) throw new Rejection(400, "INVALID_SUBMISSION");
  if (!input.turnstile_token.trim() || input.turnstile_token.length > 2048) {
    throw new Rejection(400, "VERIFICATION_REQUIRED");
  }
  return { payload, token: input.turnstile_token };
}

async function hmacEmail(email, secret, cryptoImpl) {
  const bytes = new Uint8Array(secret.match(/.{2}/g).map(part => parseInt(part, 16)));
  const key = await cryptoImpl.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await cryptoImpl.subtle.sign("HMAC", key, new TextEncoder().encode("public_contact:email:" + email));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}

export function createHandler({ configuration, fetchImpl = fetch, now = Date.now, cryptoImpl = crypto }) {
  const origin = configuration?.origin;
  function reply(status, body, allowOrigin = false, extra = {}) {
    return new Response(body === null ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", Vary: "Origin",
        ...(allowOrigin ? { "Access-Control-Allow-Origin": origin } : {}), ...extra },
    });
  }
  async function postJson(url, headers, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetchImpl(url, { method: "POST", headers, body: JSON.stringify(body),
        redirect: "error", signal: controller.signal });
      if (!response.ok) throw new Error("upstream_failure");
      return await boundedJson(response.body, 8192);
    } finally { clearTimeout(timer); }
  }
  return async request => {
    const allowedOrigin = Boolean(origin && request.headers.get("origin") === origin);
    if (!configuration) return reply(503, { code: "SERVICE_UNAVAILABLE" });
    if (!allowedOrigin) return reply(403, { code: "ORIGIN_DENIED" });
    if (request.method === "OPTIONS") {
      const requestedHeaders = (request.headers.get("access-control-request-headers") || "")
        .split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
      if (request.headers.get("access-control-request-method") !== "POST" ||
          requestedHeaders.some(value => !["content-type", "apikey"].includes(value))) {
        return reply(403, { code: "ORIGIN_DENIED" }, true);
      }
      return reply(204, null, true, { "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, apikey", "Access-Control-Max-Age": "600" });
    }
    if (request.method !== "POST") return reply(405, { code: "METHOD_NOT_ALLOWED" }, true, { Allow: "POST, OPTIONS" });
    try {
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") || "")) {
        throw new Rejection(415, "JSON_REQUIRED");
      }
      const declared = request.headers.get("content-length");
      if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) {
        throw new Rejection(413, "SUBMISSION_TOO_LARGE");
      }
      const { payload, token } = validateSubmission(await boundedJson(request.body, MAX_BODY_BYTES));
      let challenge;
      try {
        challenge = await postJson(SITEVERIFY, { "Content-Type": "application/json" },
          { secret: configuration.turnstileSecret, response: token });
      } catch { throw new Rejection(503, "SERVICE_UNAVAILABLE"); }
      const timestamp = Date.parse(challenge?.challenge_ts);
      if (challenge?.success !== true || challenge.hostname !== new URL(origin).hostname ||
          challenge.action !== CONTACT_ACTION || !Number.isFinite(timestamp) ||
          timestamp < now() - 300000 || timestamp > now() + 30000) {
        if (challenge?.["error-codes"]?.some(code => ["internal-error", "invalid-input-secret", "missing-input-secret"].includes(code))) {
          throw new Rejection(503, "SERVICE_UNAVAILABLE");
        }
        throw new Rejection(400, "VERIFICATION_REQUIRED");
      }
      const headers = { "Content-Type": "application/json", apikey: configuration.backendKey };
      // Secret keys are not JWTs. Only the legacy fallback uses Bearer auth.
      if (!configuration.backendKey.startsWith("sb_secret_")) headers.Authorization = "Bearer " + configuration.backendKey;
      const receipt = await postJson(configuration.supabaseUrl + "/rest/v1/rpc/submit_verified_public_enquiry", headers,
        { p_submission: payload, p_email_hash: await hmacEmail(payload.email, configuration.quotaSecret, cryptoImpl) });
      if (receipt?.accepted === false && Number.isInteger(receipt.retry_after_seconds) &&
          receipt.retry_after_seconds > 0 && receipt.retry_after_seconds <= 3600) {
        return reply(429, { code: "SUBMISSION_LIMIT", retry_after_seconds: receipt.retry_after_seconds }, true,
          { "Retry-After": String(receipt.retry_after_seconds) });
      }
      if (receipt?.accepted !== true) throw new Error("invalid_receipt");
      return reply(200, { accepted: true }, true);
    } catch (error) {
      // Never echo provider messages, enquiries, tokens, keys, hashes or stack traces.
      return reply(error instanceof Rejection ? error.status : 503,
        { code: error instanceof Rejection ? error.code : "SERVICE_UNAVAILABLE" }, true);
    }
  };
}
