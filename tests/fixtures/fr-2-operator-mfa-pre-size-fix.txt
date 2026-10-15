// Fixed staging Auth endpoints only. No SQL, role changes, factor deletion or persistence.
export const PROJECT = 'dczlddwbtgvfdujgcitb';
export const AUTH = `https://${PROJECT}.supabase.co/auth/v1`;
export const CONFIG = 'https://mushavo-budget-staging.pages.dev/config.js';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class SetupError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const need = (ok, code) => { if (!ok) throw new SetupError(code); };
export function validateEmails(emails) {
  need(Array.isArray(emails) && emails.length === 2, 'TWO_DISTINCT_ISOLATED_EMAILS_REQUIRED');
  const v = emails.map(e => typeof e === 'string' ? e.trim().toLowerCase() : '');
  need(v.every(e => e.length <= 254 && /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)
    && !['audit.owner@example.com', 'audit.outsider@example.com'].includes(e)) && v[0] !== v[1],
  'TWO_DISTINCT_ISOLATED_EMAILS_REQUIRED');
  return v;
}
export function parseConfig(text) {
  let c;
  try { c = JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/, '').replace(/;\s*$/, '')); }
  catch { throw new SetupError('STAGING_CONFIG_FORMAT_REJECTED'); }
  need(c && c.supabaseUrl === `https://${PROJECT}.supabase.co`
    && !text.includes('kttkospkblwvguuwnhjj') && !c.vapidPublicKey
    && /^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey || '')
    && !/sb_secret_|service_role|private_key/i.test(text), 'STAGING_CONFIG_REJECTED');
  return c.supabasePublishableKey;
}
export async function boundedBody(response, max = 262144) {
  need(response.body && typeof response.body.getReader === 'function', 'HTTP_BODY_UNAVAILABLE');
  const reader = response.body.getReader(), chunks = []; let bytes = 0;
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength; need(bytes <= max, 'HTTP_RESPONSE_TOO_LARGE'); chunks.push(value);
    }
    const body = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', {fatal:true}).decode(body);
  } finally { try { await reader.cancel(); } catch {} reader.releaseLock(); }
}
function claims(token) {
  try {
    const parts = token.split('.'); need(parts.length === 3, 'SESSION_SHAPE_REJECTED');
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch { throw new SetupError('SESSION_SHAPE_REJECTED'); }
}
// Claims are constraints, not local signature verification. Every accepted session
// must also pass GET /user against the fixed HTTPS Auth server and match its actor.
function sessionClaims(token, aal, expectedId, priorSession) {
  const c = claims(token);
  need(c.iss === AUTH && c.role === 'authenticated' && c.aud === 'authenticated'
    && c.aal === aal && UUID.test(c.sub || '') && UUID.test(c.session_id || '')
    && Number.isFinite(c.exp) && c.exp > Date.now()/1000
    && (!expectedId || c.sub === expectedId)
    && (!priorSession || c.session_id === priorSession), 'SESSION_CONSTRAINT_REJECTED');
  return c;
}
export async function runOperatorMfa({emails, io, fetcher = globalThis.fetch}) {
  const receipt = {
    stage_step:'FR.2.4_OPERATOR_MFA_SETUP', project:PROJECT,
    result:'STAGING_OPERATOR_MFA_REVIEW_REQUIRED', accounts:[], problem_code:null,
    requests_attempted:0, all_created_sessions_local_logout_confirmed:true,
    password_session_creation_state_may_require_review:false,
    enrollment_request_attempted:false, factor_state_may_require_review:false,
    fresh_password_and_TOTP_sessions_verified:false,
    roles_SQL_settings_payment_or_workspace_writes_performed:false,
    factors_deleted:false, secret_or_token_files_written:false,
    MFA_material_displayed_only_in_private_terminal:true,
    credentials_tokens_emails_actor_or_factor_identifiers_in_receipt:false,
    publishable_key_ownership_independently_verified:false,
    independent_device_or_account_recovery_drill_verified:false,
    hosted_Admin_authorization_acceptance:false, hosted_acceptance:false,
    production_or_native_changed:false, findings_closed:[]
  };
  let key, currentToken, logoutNeeded=false;
  async function http(url, {method='GET', body, token}={}) {
    need(url === CONFIG || (url.startsWith(AUTH+'/') && (
      (method === 'POST' && ['/token?grant_type=password','/logout?scope=local','/factors'].includes(url.slice(AUTH.length)))
      || (method === 'GET' && url === AUTH+'/user')
      || (method === 'POST' && /^\/factors\/[0-9a-f-]{36}\/(challenge|verify)$/i.test(url.slice(AUTH.length)))
    )), 'ENDPOINT_REJECTED');
    const headers = {Accept:url === CONFIG ? 'application/javascript' : 'application/json'};
    if (url !== CONFIG) headers.apikey = key;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    receipt.requests_attempted++;
    let response;
    try { response = await fetcher(url, {method,headers,body:body?JSON.stringify(body):undefined,
      redirect:'error',signal:AbortSignal.timeout(20000)}); }
    catch { throw new SetupError('HTTP_TRANSPORT_FAILED'); }
    need(!response.redirected && response.status >= 200 && response.status < 300
      || (!response.redirected && url.endsWith('/verify') && [400,422].includes(response.status)), 'HTTP_STATUS_REVIEW_REQUIRED');
    if (response.status === 204) return null;
    let text;
    try { text = await boundedBody(response, url === CONFIG ? 8192 : 262144); }
    catch (e) { if (e instanceof SetupError) throw e; throw new SetupError('HTTP_BODY_REJECTED'); }
    if (url === CONFIG) { need(response.status===200, 'CONFIG_HTTP_STATUS_REJECTED'); return text; }
    if (url.endsWith('/logout?scope=local') && text.trim()==='') return null;
    let data;
    try { data = JSON.parse(text); } catch { throw new SetupError('AUTH_RESPONSE_FORMAT_REJECTED'); }
    if (response.status >= 400) {
      if (data?.code === 'mfa_verification_failed') throw new SetupError('TOTP_CODE_REJECTED');
      throw new SetupError('AUTH_VERIFY_REVIEW_REQUIRED');
    }
    return data;
  }
  async function logout() {
    if (!logoutNeeded) return;
    try { await http(AUTH+'/logout?scope=local', {method:'POST',token:currentToken}); }
    catch { receipt.all_created_sessions_local_logout_confirmed=false; throw new SetupError('LOCAL_LOGOUT_NOT_CONFIRMED'); }
    finally { currentToken=null; logoutNeeded=false; }
  }
  async function authenticatedUser(email, aal, actor, sameSession) {
    const c = sessionClaims(currentToken,aal,actor,sameSession);
    const user = await http(AUTH+'/user', {token:currentToken});
    need(user && user.id===c.sub && user.email?.toLowerCase()===email
      && user.email_confirmed_at && user.role==='authenticated'
      && !user.is_anonymous, 'AUTHENTICATED_ACTOR_REJECTED');
    return {user,c};
  }
  async function signIn(email, slot, actor) {
    let password = await io.password(slot);
    need(typeof password==='string' && password.length>0, 'PASSWORD_REQUIRED');
    let data;
    receipt.password_session_creation_state_may_require_review=true;
    try { data=await http(AUTH+'/token?grant_type=password', {method:'POST',body:{email,password}}); }
    finally { password=''; }
    need(typeof data?.access_token==='string', 'PASSWORD_SESSION_MISSING');
    currentToken=data.access_token; logoutNeeded=true;
    receipt.password_session_creation_state_may_require_review=false;
    const checked=await authenticatedUser(email,'aal1',actor);
    return checked;
  }
  async function stepUp(email, slot, id, actor, sid, previousCode) {
    for(let attempt=0;attempt<3;attempt++) {
      const code=await io.code(slot, {fresh:!!previousCode,retry:attempt>0});
      need(/^\d{6}$/.test(code||''), 'SIX_DIGIT_CODE_REQUIRED');
      if(code===previousCode) { io.notice('WAIT_FOR_A_NEW_AUTHENTICATOR_CODE'); continue; }
      const challenge=await http(`${AUTH}/factors/${id}/challenge`, {method:'POST',token:currentToken,body:{}});
      need(UUID.test(challenge?.id||''), 'CHALLENGE_SHAPE_REJECTED');
      let verified;
      try { verified=await http(`${AUTH}/factors/${id}/verify`, {method:'POST',token:currentToken,body:{challenge_id:challenge.id,code}}); }
      catch(e) { if(e.code==='TOTP_CODE_REJECTED') { io.notice('CODE_NOT_ACCEPTED_TRY_CURRENT_CODE'); continue; } throw e; }
      need(typeof verified?.access_token==='string', 'VERIFIED_SESSION_MISSING');
      currentToken=verified.access_token;
      const checked=await authenticatedUser(email,'aal2',actor,sid);
      need(checked.user.factors?.some(f=>f.id===id&&f.factor_type==='totp'&&f.status==='verified'), 'VERIFIED_FACTOR_READBACK_FAILED');
      return code;
    }
    throw new SetupError('TOTP_RETRIES_EXHAUSTED');
  }
  try {
    const selected=validateEmails(emails);
    key=parseConfig(await http(CONFIG));
    const actorIds=[];
    for(let i=0;i<2;i++) {
      const slot=i===0?'PRIMARY':'RECOVERY', email=selected[i];
      const state={slot,password_signin_verified:false,existing_verified_factor_reused:false,
        new_factor_enrollment_attempted:false,initial_TOTP_and_AAL2_verified:false,
        fresh_password_session_and_TOTP_AAL2_verified:false,local_logout_confirmed:false};
      receipt.accounts.push(state); io.notice(slot+'_START');
      const initial=await signIn(email,slot);
      need(!actorIds.includes(initial.user.id), 'DISTINCT_ACTORS_REQUIRED'); actorIds.push(initial.user.id);
      state.password_signin_verified=true;
      const factors=initial.user.factors||[];
      if(!Array.isArray(factors)||factors.length>1||factors.some(f=>f.factor_type!=='totp'||f.status!=='verified'))
        receipt.factor_state_may_require_review=true;
      need(Array.isArray(factors)&&factors.length<=1, 'EXISTING_FACTORS_REQUIRE_REVIEW');
      let factor=factors[0];
      if(factor) {
        need(factor.factor_type==='totp'&&factor.status==='verified'&&UUID.test(factor.id||''), 'EXISTING_FACTORS_REQUIRE_REVIEW');
        state.existing_verified_factor_reused=true;
      } else {
        receipt.enrollment_request_attempted=true; state.new_factor_enrollment_attempted=true;
        receipt.factor_state_may_require_review=true;
        factor=await http(AUTH+'/factors', {method:'POST',token:currentToken,
          body:{factor_type:'totp',friendly_name:'Mushavo staging '+slot,issuer:'Mushavo staging'}});
        need(UUID.test(factor?.id||'')&&factor.type==='totp'
          && /^[A-Z2-7]{16,128}$/.test(factor.totp?.secret||''), 'ENROLLMENT_RESPONSE_REJECTED');
        await io.setup(slot,factor.totp.secret);
        factor={id:factor.id}; // Drop enrollment response and secret references promptly.
      }
      const priorCode=await stepUp(email,slot,factor.id,initial.user.id,initial.c.session_id);
      state.initial_TOTP_and_AAL2_verified=true;
      await logout();
      io.notice(slot+'_FRESH_SIGNIN_USE_SAME_PASSWORD_AND_WAIT_FOR_NEXT_TOTP');
      const fresh=await signIn(email,slot,initial.user.id);
      need(fresh.c.session_id!==initial.c.session_id, 'FRESH_SESSION_NOT_DISTINCT');
      const freshFactors=fresh.user.factors||[];
      need(freshFactors.length===1&&freshFactors[0].id===factor.id
        && freshFactors[0].status==='verified'&&freshFactors[0].factor_type==='totp','FACTOR_STATE_CHANGED');
      await stepUp(email,slot,factor.id,initial.user.id,fresh.c.session_id,priorCode);
      state.fresh_password_session_and_TOTP_AAL2_verified=true;
      await logout(); state.local_logout_confirmed=true; io.notice(slot+'_PASS');
    }
    receipt.fresh_password_and_TOTP_sessions_verified=true;
    receipt.factor_state_may_require_review=false;
    receipt.result='STAGING_TWO_OPERATOR_TOTP_AND_FRESH_AUTH_SESSIONS_SCOPED_PASS';
  } catch(e) {
    receipt.problem_code=e instanceof SetupError ? e.code : 'LOCAL_SETUP_ERROR';
  } finally {
    try { await logout(); } catch { receipt.problem_code ||= 'LOCAL_LOGOUT_NOT_CONFIRMED'; }
    if(!receipt.all_created_sessions_local_logout_confirmed) {
      receipt.result='STAGING_OPERATOR_MFA_REVIEW_REQUIRED';
      receipt.fresh_password_and_TOTP_sessions_verified=false;
    }
    receipt.completed_UTC=new Date().toISOString();
  }
  return receipt;
}
