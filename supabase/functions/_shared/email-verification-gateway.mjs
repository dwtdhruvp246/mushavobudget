import {GateError, requireGate, readBoundedJSON, upstreamJSON} from './email-verification-http.mjs';
import {codeMac, newChallengeMaterial, newDeviceMaterial, deviceDigest} from './email-verification-crypto.mjs';
import {createZohoCodeMailer, isSingleMailbox} from './email-verification-zoho.mjs';
export const STAGING_PROJECT = 'dczlddwbtgvfdujgcitb';
export const STAGING_ORIGIN = 'https://mushavo-budget-staging.pages.dev';
const backend = 'https://' + STAGING_PROJECT + '.supabase.co';
const prefix = '/api/email-verification/';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const credential = /^[A-Za-z0-9_-]{43}$/;
const reply = (status, data, cookie) => {
  const headers = {'content-type':'application/json; charset=utf-8', 'cache-control':'no-store',
    'pragma':'no-cache', 'x-content-type-options':'nosniff', 'referrer-policy':'no-referrer',
    'content-security-policy':"default-src 'none'; frame-ancestors 'none'"};
  if (cookie) headers['set-cookie'] = cookie;
  return new Response(JSON.stringify(data), {status, headers});
};
const exactKeys = (value, keys) => value && !Array.isArray(value) && typeof value === 'object'
  && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
const cookieName = user => '__Host-mushavo_device_' + user.replaceAll('-', '');
function getCredential(request, user) {
  const values = (request.headers.get('cookie') || '').split(';').map(x=>x.trim())
    .filter(x=>x.startsWith(cookieName(user) + '=')).map(x=>x.slice(cookieName(user).length + 1));
  requireGate(values.length <= 1, 'INVALID_REQUEST', 400);
  requireGate(!values.length || credential.test(values[0]), 'INVALID_REQUEST', 400);
  return values[0] || null;
}
const clearCookie = user => cookieName(user) + '=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0';
function approvalCookie(user, token, expiry, now) {
  const until = Date.parse(expiry); const seconds = Math.floor((until-now())/1000);
  requireGate(credential.test(token) && Number.isFinite(until) && seconds > 0 && seconds <= 604800);
  return cookieName(user) + '=' + token + '; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='
    + seconds + '; Expires=' + new Date(until).toUTCString();
}
function claimsFrom(token) {
  requireGate(typeof token === 'string' && token.length <= 16384 && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token), 'SIGN_IN_REQUIRED', 401);
  try {
    const raw = token.split('.')[1].replaceAll('-', '+').replaceAll('_', '/');
    return JSON.parse(atob(raw + '='.repeat((4-raw.length%4)%4)));
  } catch { throw new GateError('SIGN_IN_REQUIRED', 401); }
}
export function createBackendAdapter({fetcher, publishableKey, serviceKey, now=Date.now}) {
  requireGate(typeof fetcher === 'function' && /^[A-Za-z0-9_.-]{8,4096}$/.test(publishableKey || '')
    && /^[A-Za-z0-9_.-]{8,8192}$/.test(serviceKey || '') && serviceKey !== publishableKey);
  return {
    async authenticate(request) {
      const auth = request.headers.get('authorization') || '';
      requireGate(auth.startsWith('Bearer '), 'SIGN_IN_REQUIRED', 401);
      const token = auth.slice(7), claims = claimsFrom(token);
      // Decoded claims alone never authorize. The exact same bearer is validated remotely below.
      requireGate(uuid.test(claims.sub || '') && uuid.test(claims.session_id || '')
        && claims.role === 'authenticated' && claims.aud === 'authenticated'
        && claims.iss === backend + '/auth/v1' && Number.isInteger(claims.exp)
        && claims.exp > Math.floor(now()/1000), 'SIGN_IN_REQUIRED', 401);
      const user = await upstreamJSON(fetcher, backend + '/auth/v1/user', {
        method:'GET', headers:{apikey:publishableKey, authorization:auth}
      });
      requireGate(user.id === claims.sub && user.is_anonymous !== true && isSingleMailbox(user.email)
        && typeof user.email_confirmed_at === 'string' && Number.isFinite(Date.parse(user.email_confirmed_at)), 'SIGN_IN_REQUIRED', 401);
      return {userId:user.id, sessionId:claims.session_id, email:user.email};
    },
    async rpc(name, args) {
      requireGate(['begin_challenge','set_delivery','challenge_context','verify_challenge',
        'restore_device','revoke_device','revoke_all','session_status'].includes(name));
      // Modern secret keys authenticate through apikey; they are not bearer JWTs.
      // Retain the legacy JWT transport for an existing service_role credential.
      const headers = {apikey:serviceKey, 'content-type':'application/json'};
      if (!serviceKey.startsWith('sb_secret_')) headers.authorization = 'Bearer ' + serviceKey;
      return await upstreamJSON(fetcher, backend + '/rest/v1/rpc/email_gate_' + name, {
        method:'POST', headers, body:JSON.stringify(args)
      });
    }
  };
}
export function createEmailGateway({adapter, mailer, keyring, currentKeyVersion, limit, now=Date.now}) {
  requireGate(adapter && typeof adapter.authenticate === 'function' && typeof adapter.rpc === 'function'
    && typeof mailer === 'function' && typeof limit === 'function'
    && /^[A-Za-z0-9_-]{1,32}$/.test(currentKeyVersion || '') && keyring instanceof Map
    && keyring.get(currentKeyVersion) instanceof Uint8Array && keyring.get(currentKeyVersion).length >= 32);
  return async request => {
    try {
      const url = new URL(request.url), route = url.pathname.slice(prefix.length);
      requireGate(url.origin === STAGING_ORIGIN && url.pathname.startsWith(prefix)
        && ['begin','verify','restore','status','forget','revoke-all'].includes(route) && !url.search,
        'NOT_FOUND', 404);
      requireGate(request.method === 'POST', 'METHOD_NOT_ALLOWED', 405);
      requireGate(request.headers.get('origin') === STAGING_ORIGIN
        && request.headers.get('x-mushavo-csrf') === 'email-v1'
        && (!request.headers.has('sec-fetch-site') || request.headers.get('sec-fetch-site') === 'same-origin'),
        'ORIGIN_REJECTED', 403);
      const ip = request.headers.get('cf-connecting-ip');
      requireGate(typeof ip === 'string' && /^[0-9a-fA-F:.]{2,64}$/.test(ip));
      // Required shared limiter port. No in-memory fallback silently weakens IP protection.
      requireGate((await limit({ip, route}))?.success === true, 'RATE_LIMITED', 429);
      let body;
      try { body = await readBoundedJSON(request, 4096); }
      catch { throw new GateError('INVALID_REQUEST', 400); }
      requireGate(exactKeys(body, route === 'begin' ? ['remember'] : route === 'verify' ? ['challengeId','code'] : []), 'INVALID_REQUEST', 400);
      if (route === 'begin') requireGate(typeof body.remember === 'boolean', 'INVALID_REQUEST', 400);
      if (route === 'verify') requireGate(typeof body.challengeId === 'string' && uuid.test(body.challengeId)
        && typeof body.code === 'string' && /^\d{6}$/.test(body.code), 'INVALID_REQUEST', 400);
      const actor = await adapter.authenticate(request);
      const args = {p_user:actor.userId, p_session:actor.sessionId};
      const call = (name, more={}) => adapter.rpc(name, {...args,...more});
      const status = async () => {
        const value = await call('session_status'); requireGate(typeof value === 'boolean'); return value;
      };
      if (route === 'status') return reply(200,{verified:await status()});
      const remembered = getCredential(request, actor.userId);
      if (route === 'restore') {
        if (await status()) return reply(200,{result:'VERIFIED'});
        if (!remembered) return reply(200,{result:'CODE_REQUIRED'});
        const result = await call('restore_device',{p_device_digest:await deviceDigest(remembered)});
        requireGate(['APPROVED','CODE_REQUIRED'].includes(result?.result));
        // Restore never emits Set-Cookie: the seven-day deadline cannot slide.
        return reply(200,{result:result.result}, result.result === 'CODE_REQUIRED' ? clearCookie(actor.userId) : undefined);
      }
      if (route === 'forget') {
        requireGate(await status(), 'VERIFICATION_REQUIRED', 403);
        if (remembered) {
          const result = await call('revoke_device',{p_device_digest:await deviceDigest(remembered)});
          requireGate(['REVOKED','NOT_FOUND'].includes(result?.result));
        }
        return reply(200,{result:'FORGOTTEN'},clearCookie(actor.userId));
      }
      if (route === 'revoke-all') {
        const result = await call('revoke_all');
        requireGate(result?.result === 'REVOKED', 'VERIFICATION_REQUIRED', 403);
        return reply(200,{result:'REVOKED'},clearCookie(actor.userId));
      }
      if (route === 'begin') {
        if (await status()) return reply(200,{result:'VERIFIED'});
        const material = await newChallengeMaterial({userId:actor.userId, sessionId:actor.sessionId,
          keyVersion:currentKeyVersion, pepper:keyring.get(currentKeyVersion)});
        const begun = await call('begin_challenge',{p_challenge:material.challengeId,
          p_code_mac:material.codeMac, p_key_version:currentKeyVersion, p_remember:body.remember});
        if (['COOLDOWN','RATE_LIMIT'].includes(begun?.result)) return reply(429,{result:begun.result});
        requireGate(begun?.result === 'PENDING_DELIVERY' && begun.challenge_id === material.challengeId
          && Number.isFinite(Date.parse(begun.expires_at)));
        let accepted = false;
        try { accepted = (await mailer({to:actor.email,code:material.code}))?.accepted === true; }
        catch { accepted = false; }
        const delivery = await call('set_delivery',{p_challenge:material.challengeId,p_delivered:accepted});
        requireGate(accepted && delivery?.result === 'READY', 'MAIL_UNAVAILABLE', 503);
        return reply(200,{result:'CODE_REQUESTED',challengeId:material.challengeId,expiresAt:begun.expires_at});
      }
      const context = await call('challenge_context',{p_challenge:body.challengeId});
      requireGate(context && typeof context.remember_device === 'boolean'
        && typeof context.key_version === 'string' && keyring.has(context.key_version), 'CODE_UNAVAILABLE', 400);
      const mac = await codeMac({userId:actor.userId,sessionId:actor.sessionId,challengeId:body.challengeId,
        keyVersion:context.key_version,code:body.code,pepper:keyring.get(context.key_version)});
      const device = context.remember_device ? await newDeviceMaterial() : null;
      const verified = await call('verify_challenge',{p_challenge:body.challengeId,p_code_mac:mac,p_device_digest:device?.digest || null});
      if (['UNAVAILABLE','LOCKED','CODE_REJECTED','INVALID'].includes(verified?.result)) return reply(400,{result:'CODE_REJECTED'});
      requireGate(verified?.result === 'VERIFIED');
      const cookie = device ? approvalCookie(actor.userId,device.credential,verified.device_expires_at,now) : clearCookie(actor.userId);
      return reply(200,{result:'VERIFIED'},cookie);
    } catch (error) {
      return reply(error instanceof GateError ? error.status : 503,
        {result:error instanceof GateError ? error.code : 'UNAVAILABLE'});
    }
  };
}

export function gatewayFromEnvironment(env, fetcher=globalThis.fetch) {
  requireGate(env.EMAIL_GATE_MODE === 'STAGING_CONTROLLED_ONLY' && env.EMAIL_GATE_PROJECT === STAGING_PROJECT
    && env.EMAIL_GATE_ORIGIN === STAGING_ORIGIN && typeof env.EMAIL_GATE_RATE_LIMITER?.limit === 'function');
  let rawKeys, recipients;
  try { rawKeys=JSON.parse(env.EMAIL_GATE_PEPPERS_JSON); recipients=JSON.parse(env.ZOHO_TEST_RECIPIENTS_JSON); }
  catch { throw new GateError('UNAVAILABLE'); }
  requireGate(rawKeys && !Array.isArray(rawKeys) && Object.keys(rawKeys).length >= 1 && Object.keys(rawKeys).length <= 4);
  const keyring = new Map(Object.entries(rawKeys).map(([name,hex]) => {
    requireGate(/^[A-Za-z0-9_-]{1,32}$/.test(name) && typeof hex === 'string' && /^[a-f0-9]{64}$/.test(hex));
    return [name,Uint8Array.from(hex.match(/../g),x=>parseInt(x,16))];
  }));
  return createEmailGateway({
    adapter:createBackendAdapter({fetcher,publishableKey:env.SUPABASE_PUBLISHABLE_KEY,serviceKey:env.SUPABASE_SERVICE_ROLE_KEY}),
    mailer:createZohoCodeMailer({fetcher,config:{mailOrigin:env.ZOHO_MAIL_ORIGIN,accountsOrigin:env.ZOHO_ACCOUNTS_ORIGIN,
      accountId:env.ZOHO_ACCOUNT_ID,from:env.ZOHO_FROM_ADDRESS,clientId:env.ZOHO_CLIENT_ID,
      clientSecret:env.ZOHO_CLIENT_SECRET,refreshToken:env.ZOHO_REFRESH_TOKEN,allowedRecipients:recipients}}),
    keyring,currentKeyVersion:env.EMAIL_GATE_KEY_VERSION,
    limit:({ip})=>env.EMAIL_GATE_RATE_LIMITER.limit({key:'mushavo-email:' + ip})
  });
}

// Candidate entrypoint only. It is outside the public output and needs a reviewed real Worker bundle.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith(prefix)) {
      try { return await gatewayFromEnvironment(env)(request); }
      catch { return reply(503,{result:'UNAVAILABLE'}); }
    }
    if (!['GET','HEAD'].includes(request.method)) return reply(405,{result:'METHOD_NOT_ALLOWED'});
    if (typeof env.ASSETS?.fetch !== 'function') return reply(503,{result:'UNAVAILABLE'});
    // Static assets do not need the bearer or device cookies; prevent accidental forwarding/logging.
    const clean = new Request(request); clean.headers.delete('authorization'); clean.headers.delete('cookie');
    return env.ASSETS.fetch(clean);
  }
};
