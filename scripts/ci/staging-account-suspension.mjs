import { API_ORIGIN, need, tokenIdentity } from './staging-access.mjs';

const CASES = ['X_ACCOUNT_NONADMIN_DENIAL', 'X_ACCOUNT_EXISTING_SESSION_SUSPENDED',
  'X_ACCOUNT_OTHER_ACTORS_UNAFFECTED', 'X_ACCOUNT_SUPPORTED_RESTORE'];
const ABSENT = '00000000-0000-4000-8000-000000000000';

export function isAccountSuspensionPlan(plan) {
  return plan.scope === 'account-suspension-boundaries'
    && plan.project === 'dczlddwbtgvfdujgcitb' && plan.target_slot === 'USER_A'
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkAccountSuspension({ actors, evidence }, key, agent, fetcher = fetch) {
  const target = actors.USER_A, other = actors.USER_B, admin = actors.ADMIN;
  const selected = [target, other, admin];
  need(Object.keys(actors).length === 3 && selected.every(actor => actor?.id
    && tokenIdentity(actor.token)?.userId === actor.id)
    && new Set(selected.map(actor => actor.id)).size === 3
    && new Set(selected.map(actor => tokenIdentity(actor.token).sessionId)).size === 3,
  'THREE_DISTINCT_BOUND_SESSIONS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, status_write_requests: 0,
    email_requests: 0, provider_requests: 0, finance_write_requests: 0,
    suspension_attempted: false, restoration_attempted: false, restored_active_verified: false });
  const profileRoute = `/rest/v1/profiles?select=id,account_status&id=eq.${target.id}&limit=2`;
  const workspaceRoute = actor => `/rest/v1/budget_workspaces?select=id,owner_id,workspace_type,status&owner_id=eq.${actor.id}&limit=21`;
  const call = async (actor, method, route, body, cleanup = false) => {
    need(evidence.exercise_requests < (cleanup ? 30 : 24), 'ACCOUNT_SUSPENSION_REQUEST_LIMIT_REQUIRED');
    need(method === 'GET' && [profileRoute, workspaceRoute(target), workspaceRoute(other), '/auth/v1/user'].includes(route)
      || method === 'POST' && ['/rest/v1/rpc/app_session_status', '/rest/v1/rpc/set_user_account_status',
        '/rest/v1/rpc/archive_business_document'].includes(route), 'ACCOUNT_SUSPENSION_ROUTE_REFUSED');
    if (route === '/rest/v1/rpc/set_user_account_status') {
      need(body?.p_user_id === target.id && ['active', 'suspended'].includes(body.p_status)
        && (actor === admin || actor === other && body.p_status === 'suspended'), 'EXACT_TARGET_STATUS_ACTION_REQUIRED');
      evidence.status_write_requests++;
    }
    evidence.exercise_requests++;
    const response = await fetcher(API_ORIGIN + route, { method, redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(20000),
      headers: { apikey: key, Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json', 'User-Agent': agent },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  };
  const check = (name, passed) => {
    evidence.checks[name] = passed === true;
    need(passed === true, 'ACCOUNT_SUSPENSION_' + name + '_REQUIRED');
  };
  const sessionStatus = async (actor, cleanup = false) => {
    const result = await call(actor, 'POST', '/rest/v1/rpc/app_session_status', {}, cleanup);
    need(result.status === 200 && result.data?.contract === 1
      && result.data.policy === 'PASSWORD_ONLY_ALL_USERS', 'SESSION_STATUS_CONTRACT_REQUIRED');
    return result.data;
  };
  const targetStatus = async (cleanup = false) => {
    const result = await call(admin, 'GET', profileRoute, undefined, cleanup);
    need(result.status === 200 && Array.isArray(result.data) && result.data.length === 1
      && result.data[0].id === target.id && ['active', 'suspended'].includes(result.data[0].account_status),
    'ADMIN_TARGET_PROFILE_READ_REQUIRED');
    return result.data[0].account_status;
  };
  const workspaceSnapshot = async (actor, cleanup = false) => {
    const result = await call(actor, 'GET', workspaceRoute(actor), undefined, cleanup);
    need(result.status === 200 && Array.isArray(result.data) && result.data.length <= 20
      && result.data.every(row => row.owner_id === actor.id), 'OWN_WORKSPACE_SNAPSHOT_REQUIRED');
    return JSON.stringify(result.data.map(row => ({ id: row.id, owner_id: row.owner_id,
      workspace_type: row.workspace_type, status: row.status })).sort((a, b) => a.id.localeCompare(b.id)));
  };
  let baseline, otherBaseline, failure, cleanupFailure;
  try {
    const initial = await sessionStatus(target);
    check('TARGET_INITIAL_SESSION_VALID', initial.session_valid === true && initial.admin_authorized === false);
    const otherInitial = await sessionStatus(other);
    check('OTHER_INITIAL_SESSION_VALID', otherInitial.session_valid === true && otherInitial.admin_authorized === false);
    const adminInitial = await sessionStatus(admin);
    check('ADMIN_INITIAL_SESSION_AUTHORIZED', adminInitial.session_valid === true && adminInitial.admin_authorized === true
      && adminInitial.role === 'super_admin');
    baseline = await workspaceSnapshot(target);
    otherBaseline = await workspaceSnapshot(other);
    check('BOTH_PERSONAL_BASELINES_PRESENT', [baseline, otherBaseline].every(value => JSON.parse(value)
      .some(row => row.workspace_type === 'personal')));
    check('TARGET_INITIAL_ACTIVE', await targetStatus() === 'active');
    const denied = await call(other, 'POST', '/rest/v1/rpc/set_user_account_status',
      { p_user_id: target.id, p_status: 'suspended' });
    check('ORDINARY_CANNOT_SUSPEND_TARGET', denied.status === 400 && denied.data?.message === 'ADMIN_REQUIRED');
    check('ORDINARY_DENIAL_PRESERVED_ACTIVE', await targetStatus() === 'active');
    evidence.suspension_attempted = true;
    const suspended = await call(admin, 'POST', '/rest/v1/rpc/set_user_account_status',
      { p_user_id: target.id, p_status: 'suspended' });
    evidence.suspension_HTTP_status = suspended.status;
    check('ADMIN_SUSPENSION_ACKNOWLEDGED', [200, 204].includes(suspended.status));
    check('TARGET_SUSPENDED_READBACK', await targetStatus() === 'suspended');
    const blocked = await sessionStatus(target);
    check('EXISTING_SESSION_INVALID_FOR_APP', blocked.session_valid === false && blocked.admin_authorized === false);
    check('PROTECTED_WORKSPACES_HIDDEN', await workspaceSnapshot(target) === '[]');
    const write = await call(target, 'POST', '/rest/v1/rpc/archive_business_document',
      { p_workspace_id: ABSENT, p_document_id: ABSENT, p_reason: 'Synthetic absent-target suspension denial' });
    check('PROTECTED_MUTATION_REJECTED_BEFORE_LOOKUP', write.status === 403
      && write.data?.code === '42501' && write.data?.message === 'EMAIL_VERIFICATION_REQUIRED');
    const auth = await call(target, 'GET', '/auth/v1/user');
    check('UNDERLYING_AUTH_USER_STILL_VERIFIED', auth.status === 200 && auth.data?.id === target.id
      && !!auth.data.email_confirmed_at);
    const otherDuring = await sessionStatus(other);
    check('OTHER_ACCOUNT_SESSION_UNAFFECTED', otherDuring.session_valid === true && otherDuring.admin_authorized === false);
    check('OTHER_WORKSPACES_UNCHANGED', await workspaceSnapshot(other) === otherBaseline);
    const adminDuring = await sessionStatus(admin);
    check('ADMIN_SESSION_UNAFFECTED', adminDuring.session_valid === true && adminDuring.admin_authorized === true
      && adminDuring.role === 'super_admin');
  } catch (error) {
    failure = error;
  } finally {
    if (evidence.suspension_attempted) {
      try {
        if (await targetStatus(true) === 'suspended') {
          evidence.restoration_attempted = true;
          try {
            const restored = await call(admin, 'POST', '/rest/v1/rpc/set_user_account_status',
              { p_user_id: target.id, p_status: 'active' }, true);
            evidence.restoration_HTTP_status = restored.status;
            check('ADMIN_RESTORATION_ACKNOWLEDGED', [200, 204].includes(restored.status));
          } catch (error) { cleanupFailure = error; }
        }
        evidence.restored_active_verified = await targetStatus(true) === 'active';
        check('TARGET_ACTIVE_AFTER_CLEANUP', evidence.restored_active_verified);
        const restoredStatus = await sessionStatus(target, true);
        check('SAME_SESSION_VALID_AFTER_RESTORE', restoredStatus.session_valid === true && restoredStatus.admin_authorized === false);
        check('TARGET_WORKSPACES_RESTORED_EXACTLY', await workspaceSnapshot(target, true) === baseline);
      } catch (error) { cleanupFailure ??= error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
