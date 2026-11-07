import { createHash } from 'node:crypto';

export const WEB_ORIGIN = 'https://mushavo-budget-staging.pages.dev';
export const API_ORIGIN = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BINDINGS = {
  USER_A: '78517e097a62a504568d89ea98e37c754446634cd03663e9edb9a6d5be5bab5d',
  USER_B: 'e8afd004e7935fea5c2244534828c287c5d38854f21c10061b9d7f2faf071c71',
  ADMIN: 'b0fb88c55c65b5b9d5e02301b421c25d031af5e4995c91dad53dd27c5e3839de'
};
export class Stop extends Error {
  constructor(code) { super(code); this.code = code; }
}
export function need(value, code) { if (!value) throw new Stop(code); }
export const digest = value => createHash('sha256').update(value).digest('hex');
export function tokenIdentity(token) {
  try {
    const value = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return UUID.test(value.sub || '') && UUID.test(value.session_id || '') ? { userId: value.sub, sessionId: value.session_id } : null;
  } catch { return null; }
}

const ACCOUNT_SCOPES = {
  standard: Object.keys(BINDINGS),
  ordinary: ['USER_A', 'USER_B'],
  businessFixture: ['USER_A', 'ADMIN']
};

function stagingSlots(accountScope) {
  need(Object.hasOwn(ACCOUNT_SCOPES, accountScope), 'REVIEWED_ACCOUNT_SCOPE_REQUIRED');
  return ACCOUNT_SCOPES[accountScope];
}

export function privateAccounts(env, { accountScope = "standard" } = {}) {
  return Object.fromEntries(stagingSlots(accountScope).map(slot => {
    const email = env[`MUSHAVO_STAGING_${slot}_EMAIL`]?.trim().toLowerCase();
    const password = env[`MUSHAVO_STAGING_${slot}_PASSWORD`];
    need(typeof email === 'string' && digest(email) === BINDINGS[slot]
      && typeof password === 'string' && password.length > 0 && password.length <= 4096,
    `PRIVATE_CREDENTIALS_REQUIRED_${slot}`);
    return [slot, { email, password }];
  }));
}

export function readPublicConfiguration(text) {
  const match = text.match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;?\s*$/);
  need(match, 'PUBLIC_CONFIGURATION_FORMAT_REQUIRED');
  let config;
  try { config = JSON.parse(match[1]); } catch { throw new Stop('PUBLIC_CONFIGURATION_FORMAT_REQUIRED'); }
  need(config.supabaseUrl === API_ORIGIN, 'EXACT_STAGING_PROJECT_REQUIRED');
  need(typeof config.supabasePublishableKey === 'string'
    && /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(config.supabasePublishableKey), 'PUBLIC_PUBLISHABLE_KEY_REQUIRED');
  return { key: config.supabasePublishableKey };
}

export function allowedAPICall(method, route) {
  if (method === 'POST') return ['/auth/v1/token?grant_type=password', '/auth/v1/logout?scope=local'].includes(route);
  if (method !== 'GET') return false;
  if (route === '/auth/v1/user') return true;
  return [
    /^\/rest\/v1\/profiles\?select=id,account_status&id=eq\.([0-9a-f-]{36})&limit=2$/,
    /^\/rest\/v1\/app_admins\?select=user_id,role&user_id=eq\.([0-9a-f-]{36})&limit=2$/,
    /^\/rest\/v1\/budget_workspaces\?select=id,owner_id,workspace_type,status&owner_id=eq\.([0-9a-f-]{36})&limit=21$/
  ].some(pattern => { const match = route.match(pattern); return match && UUID.test(match[1]); });
}

export function apiTransport(key, agent, fetcher = fetch) {
  return async ({ method, route, token, body }) => {
    need(allowedAPICall(method, route), 'UNPLANNED_API_CALL_REFUSED');
    const response = await fetcher(API_ORIGIN + route, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { apikey: key, 'Content-Type': 'application/json', 'User-Agent': agent,
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  };
}

export async function checkStagingAccess(accounts, transport, exercise = async () => ({}), { accountScope = "standard" } = {}) {
  const sessions = [], actors = {}, report = {
    progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z',
    result: 'STAGING_ACCESS_REVIEW_REQUIRED', checks: {}, accounts: {},
    API_requests: 0, created_sessions: 0, cleanup_sessions: 0,
    settings_or_finance_writes_requested: 0, production_changed: false,
    full_lettered_batch_W_complete: false, exit_code: 1
  };
  const call = async (method, route, token, body, cleanup = false) => {
    need(allowedAPICall(method, route), 'UNPLANNED_API_CALL_REFUSED');
    need(report.API_requests < (cleanup ? 24 : 20), 'REQUEST_BOUND_REACHED');
    report.API_requests++;
    return transport({ method, route, token, body });
  };
  const locate = token => {
    const identity = tokenIdentity(token);
    return sessions.find(item => item.token === token || identity && item.identity?.sessionId === identity.sessionId
      && item.identity.userId === identity.userId);
  };
  const registerSession = token => {
    if (typeof token !== 'string' || !token.length) return;
    const existing = locate(token);
    if (existing) existing.token = token;
    else { sessions.push({ token, identity: tokenIdentity(token), cleaned: false }); report.created_sessions++; }
  };
  const acknowledgeLogout = (token, status) => {
    const item = locate(token);
    need(item && [200, 204].includes(status), 'OWN_SCOPED_LOGOUT_ACKNOWLEDGEMENT_REQUIRED');
    if (!item.cleaned) { item.cleaned = true; report.cleanup_sessions++; }
  };
  const scopedLogout = async token => {
    need(locate(token), 'OWN_SESSION_REQUIRED_FOR_LOGOUT');
    const result = await call('POST', '/auth/v1/logout?scope=local', token, undefined, true);
    acknowledgeLogout(token, result.status);
    return result;
  };
  let complete = false;
  try {
    for (const slot of stagingSlots(accountScope)) {
      const account = accounts[slot];
      const login = await call('POST', '/auth/v1/token?grant_type=password', null, account);
      if (typeof login.data?.access_token === 'string' && login.data.access_token.length) {
        registerSession(login.data.access_token);
      }
      report.accounts[slot] = { signin_HTTP_status: login.status };
      need(login.status === 200 && locate(login.data?.access_token), `SIGNIN_NOT_ESTABLISHED_${slot}`);
      const token = login.data.access_token;
      const read = await call('GET', '/auth/v1/user', token);
      const user = read.data;
      need(read.status === 200 && UUID.test(user?.id || '') && user.email?.toLowerCase() === account.email
        && !!user.email_confirmed_at, `CONFIRMED_IDENTITY_REQUIRED_${slot}`);
      need(!Object.values(actors).some(actor => actor.id === user.id), 'DISTINCT_IDENTITIES_REQUIRED');
      const profile = await call('GET', `/rest/v1/profiles?select=id,account_status&id=eq.${user.id}&limit=2`, token);
      need(profile.status === 200 && Array.isArray(profile.data) && profile.data.length === 1
        && profile.data[0].id === user.id && profile.data[0].account_status === 'active', `ACTIVE_PROFILE_REQUIRED_${slot}`);
      const role = await call('GET', `/rest/v1/app_admins?select=user_id,role&user_id=eq.${user.id}&limit=2`, token);
      need(role.status === 200 && Array.isArray(role.data), `OWN_ROLE_READ_REQUIRED_${slot}`);
      need(slot === 'ADMIN'
        ? role.data.length === 1 && role.data[0].user_id === user.id && role.data[0].role === 'super_admin'
        : role.data.length === 0, `EXPECTED_ROLE_REQUIRED_${slot}`);
      const workspaces = await call('GET', `/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.${user.id}&limit=21`, token);
      need(workspaces.status === 200 && Array.isArray(workspaces.data) && workspaces.data.length <= 20
        && workspaces.data.every(row => UUID.test(row.id || '') && row.owner_id === user.id
          && ['personal', 'family', 'household', 'business'].includes(row.workspace_type)), `OWN_WORKSPACE_READ_REQUIRED_${slot}`);
      need(slot === 'ADMIN' || workspaces.data.some(row => row.workspace_type === 'personal'), `PERSONAL_WORKSPACE_REQUIRED_${slot}`);
      actors[slot] = { id: user.id, token, session: login.data };
      report.accounts[slot] = { signin_HTTP_status: 200, confirmed_identity: true, active_profile: true,
        expected_platform_role: true, owned_workspace_counts: Object.fromEntries(['personal', 'family', 'business']
          .map(type => [type, workspaces.data.filter(row => type === 'family'
            ? ['family', 'household'].includes(row.workspace_type) : row.workspace_type === type).length])) };
    }
    const verifiedActors = {
      standard: 'three_private_credentials_and_expected_roles_verified',
      ordinary: 'two_ordinary_credentials_and_roles_verified',
      businessFixture: 'fixture_owner_and_super_admin_verified'
    }[accountScope];
    report.checks[verifiedActors] = true;
    report.exercise = {};
    await exercise({ accounts, actors, evidence: report.exercise, registerSession, scopedLogout, acknowledgeLogout });
    complete = true;
  } catch (error) {
    report.problem_code = error instanceof Stop ? error.code : 'REQUEST_OR_BROWSER_CHECK_FAILED';
  } finally {
    for (const item of sessions.reverse()) {
      if (item.cleaned) continue;
      try {
        const result = await call('POST', '/auth/v1/logout?scope=local', item.token, undefined, true);
        acknowledgeLogout(item.token, result.status);
      } catch {}
    }
    report.checks.created_sessions_local_logout_acknowledged = report.created_sessions === report.cleanup_sessions;
    if (!report.checks.created_sessions_local_logout_acknowledged) report.cleanup_problem_code = 'SCOPED_SESSION_CLEANUP_NOT_VERIFIED';
    if (complete && report.checks.created_sessions_local_logout_acknowledged) {
      report.result = 'STAGING_ACCESS_AND_SELECTED_CHECKS_SCOPED_PASS'; report.exit_code = 0;
    }
  }
  return report;
}
