import { unavailableInvitationSQL } from './unavailable-admin-invitation-sql.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class Review extends Error { constructor(code) { super(code); this.safeCode = code; } }
const need = (condition, code) => { if (!condition) throw new Review(code); };
const successfulRead = response => [200, 206].includes(response.status) && Array.isArray(response.data);

export async function checkUnavailableAdminInvitation(input, transport, interact, options = {}) {
  const sessions = [], checks = {}, variants = {};
  const now = options.now || (() => performance.now());
  const knownCodes = new Set(['42501', '42703', 'PGRST301', 'PGRST302', 'PGRST303', 'P0001',
    'bad_jwt', 'session_expired', 'session_not_found', 'refresh_token_not_found', 'refresh_token_already_used', 'invalid_credentials']);
  const responseSummary = response => ({
    HTTP_status: Number.isInteger(response?.status) ? response.status : null,
    response_is_array: Array.isArray(response?.data),
    row_count: Array.isArray(response?.data) ? response.data.length : null,
    error_code: knownCodes.has(response?.data?.code || response?.data?.error_code) ? response.data.code || response.data.error_code : null
  });
  const report = { progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z',
    result: 'UNAVAILABLE_ADMIN_INVITATION_REVIEW_REQUIRED', checks, variants,
    actual_hosted_requests: 0, manual_SQL_dashboard_requests_measured: false,
    real_email_requests: 0, completion_RPC_calls: 0, valid_first_provisioning_requested: false,
    unprovisioned_fixture_completion_denial_attempts: 0,
    settings_or_existing_account_writes_requested: 0, fixture_SQL_steps_acknowledged: 0,
    created_sessions: 0, cleanup_sessions: 0, fixture_cleanup_required: false,
    refresh_grants: 0, refresh_checks: [], fixture_preflights: {}, session_cleanup_responses: [],
    other_existing_sessions_signout_requested: false,
    full_lettered_batch_W_complete: false, exit_code: 1 };
  let admin, pack, fixtureMayExist = false, complete = false;
  const call = async (method, route, token, body) => {
    need(report.actual_hosted_requests < 50, 'REQUEST_BOUND_REACHED');
    report.actual_hosted_requests++;
    return transport({ method, route, token, body });
  };
  const claims = token => {
    try {
      need(typeof token === 'string' && token.length < 20000 && token.split('.').length === 3, 'SESSION_METADATA_REQUIRED');
      const value = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
      need(UUID.test(value?.session_id || '') && UUID.test(value?.sub || ''), 'SESSION_METADATA_REQUIRED');
      return { sessionId: value.session_id, userId: value.sub };
    } catch { throw new Review('SESSION_METADATA_REQUIRED'); }
  };
  const refreshMetadata = response => {
    need(typeof response.data?.refresh_token === 'string' && response.data.refresh_token.length > 0
      && response.data.refresh_token.length < 20000 && Number.isFinite(response.data?.expires_in)
      && response.data.expires_in > 0 && response.data.expires_in <= 86400, 'SESSION_REFRESH_METADATA_REQUIRED');
    return { refreshToken: response.data.refresh_token, refreshAt: now() + Math.max(0, response.data.expires_in - 60) * 1000 };
  };
  const ensureFresh = async actor => {
    if (!actor.validated) return;
    need(!actor.renewalFailed, 'SESSION_REFRESH_PREVIOUSLY_FAILED');
    if (now() < actor.refreshAt) return;
    need(report.refresh_grants < 8, 'SESSION_REFRESH_BOUND_REACHED');
    actor.renewalFailed = true; report.refresh_grants++;
    const result = await call('POST', '/auth/v1/token?grant_type=refresh_token', null, { refresh_token: actor.refreshToken });
    const diagnostic = { account_slot: actor.slot, ...responseSummary(result), same_user_and_session_verified: false };
    report.refresh_checks.push(diagnostic);
    need(result.status === 200 && typeof result.data?.access_token === 'string', 'SESSION_REFRESH_NOT_ESTABLISHED');
    const identity = claims(result.data.access_token), metadata = refreshMetadata(result);
    need(identity.sessionId === actor.sessionId && identity.userId === actor.user.id, 'REFRESH_SESSION_IDENTITY_CHANGED');
    // Retain this same-session token for local cleanup even if getUser subsequently fails.
    // Protected reads/RPCs remain blocked until getUser confirms the identity below.
    actor.token = result.data.access_token; Object.assign(actor, metadata);
    const checked = await call('GET', '/auth/v1/user', result.data.access_token);
    need(checked.status === 200 && checked.data?.id === actor.user.id
      && checked.data.email?.toLowerCase() === actor.user.email.toLowerCase()
      && !!checked.data.email_confirmed_at, 'REFRESH_USER_IDENTITY_NOT_ESTABLISHED');
    actor.renewalFailed = false;
    diagnostic.same_user_and_session_verified = true;
  };
  const readAs = async (actor, route) => { await ensureFresh(actor); return call('GET', route, actor.token); };
  const rpc = async (actor, name, body) => { await ensureFresh(actor); return call('POST', '/rest/v1/rpc/' + name, actor.token, body); };
  const login = async (account, slot) => {
    need(typeof account?.email === 'string' && account.email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)
      && typeof account.password === 'string' && account.password.length > 0 && account.password.length <= 4096, 'PRIVATE_ACCOUNT_INPUT_REQUIRED');
    const response = await call('POST', '/auth/v1/token?grant_type=password', null, { email: account.email, password: account.password });
    const token = response.data?.access_token;
    let actor;
    if (response.status === 200 && typeof token === 'string' && token.length) {
      actor = { token, slot, validated: false, renewalFailed: false }; sessions.push(actor); report.created_sessions++;
    }
    if (response.status !== 200) {
      const allowed = new Set(['invalid_credentials', 'email_not_confirmed', 'over_request_rate_limit', 'user_banned']);
      const code = response.data?.error_code || response.data?.code;
      report.failed_auth = { account_slot: slot, HTTP_status: response.status, code: allowed.has(code) ? code : 'UNCLASSIFIED' };
    }
    need(response.status === 200 && actor, 'SIGNIN_NOT_ESTABLISHED');
    const checked = await call('GET', '/auth/v1/user', token);
    need(checked.status === 200 && UUID.test(checked.data?.id || '') && checked.data?.email?.toLowerCase() === account.email.toLowerCase()
      && !!checked.data.email_confirmed_at, 'CONFIRMED_IDENTITY_NOT_ESTABLISHED');
    const identity = claims(token), metadata = refreshMetadata(response);
    need(identity.userId === checked.data.id, 'SIGNIN_SESSION_IDENTITY_NOT_ESTABLISHED');
    Object.assign(actor, metadata, { user: checked.data, sessionId: identity.sessionId, validated: true });
    return actor;
  };
  const profile = async actor => {
    const response = await readAs(actor, '/rest/v1/profiles?select=id,signup_source,admin_invitation_id,account_status&id=eq.' + actor.user.id + '&limit=2');
    const row = successfulRead(response) && response.data.length === 1 ? response.data[0] : null;
    need(row?.id === actor.user.id && row.signup_source === 'self_signup' && row.admin_invitation_id === null
      && row.account_status === 'active', 'EXISTING_ORDINARY_SELF_SIGNUP_PROFILE_REQUIRED');
    return JSON.stringify([row.id, row.signup_source, row.admin_invitation_id, row.account_status]);
  };
  const workspaces = async actor => {
    const response = await readAs(actor, '/rest/v1/budget_workspaces?select=id,owner_id,workspace_type&owner_id=eq.' + actor.user.id + '&limit=21');
    need(successfulRead(response) && response.data.length >= 1 && response.data.length <= 20
      && response.data.every(row => UUID.test(row.id || '') && row.owner_id === actor.user.id)
      && response.data.some(row => row.workspace_type === 'personal'), 'EXISTING_PERSONAL_WORKSPACE_REQUIRED');
    return JSON.stringify(response.data.map(row => [row.id, row.owner_id, row.workspace_type]).sort((a, b) => a[0].localeCompare(b[0])));
  };
  const invitationRoute = '/rest/v1/admin_user_invitations?select=id,email,full_name,workspace_name,auth_user_id,invited_by,plan_code,workspace_type,payment_received,status,expires_at,provisioned_workspace_id,completed_at&id=eq.' + input?.invitationId + '&limit=2';
  const auditRoute = '/rest/v1/admin_user_invitation_audit?select=actor_id,action,safe_details&invitation_id=eq.' + input?.invitationId + '&limit=5';
  try {
    need(UUID.test(input?.invitationId || '') && typeof interact?.prepare === 'function' && typeof interact?.sqlStep === 'function', 'FIXTURE_RUN_BINDING_REQUIRED');
    const actor = await login(input.actor, 'ordinary_test_user');
    const beforeProfile = await profile(actor), beforeWorkspaces = await workspaces(actor);
    const adminAccount = typeof input.admin === 'function' ? await input.admin() : input.admin;
    need(adminAccount?.email?.toLowerCase() !== input.actor.email.toLowerCase(), 'DISTINCT_TEST_AND_ADMIN_ACCOUNTS_REQUIRED');
    admin = await login(adminAccount, 'super_admin');
    need(admin.user.id !== actor.user.id, 'DISTINCT_TEST_AND_ADMIN_ACCOUNTS_REQUIRED');
    const role = await readAs(admin, '/rest/v1/app_admins?select=user_id,role&user_id=eq.' + admin.user.id + '&limit=2');
    need(successfulRead(role) && role.data.length === 1 && role.data[0].user_id === admin.user.id && role.data[0].role === 'super_admin', 'CURRENT_SUPER_ADMIN_REQUIRED');
    for (const route of [invitationRoute, auditRoute]) {
      const empty = await readAs(admin, route);
      need(successfulRead(empty) && empty.data.length === 0, 'STAFF_FIXTURE_READ_OR_FRESH_ID_REQUIRED');
    }
    checks.real_distinct_recipient_and_super_admin_verified = true;
    pack = unavailableInvitationSQL({ actorId: actor.user.id, adminId: admin.user.id, invitationId: input.invitationId });
    await interact.prepare(pack);
    checks.complete_cleanup_SQL_prepared_before_fixture = true;
    for (const phase of ['expired', 'cancelled', 'replaced']) {
      fixtureMayExist = true; report.fixture_cleanup_required = true;
      await interact.sqlStep(phase, pack[phase]); report.fixture_SQL_steps_acknowledged++;
      const response = await readAs(admin, invitationRoute);
      const row = successfulRead(response) && response.data.length === 1 ? response.data[0] : null;
      const marker = 'AU02.04 temporary fixture ' + input.invitationId;
      report.fixture_preflights[phase] = { ...responseSummary(response),
        invitation_id_matches: row?.id === input.invitationId,
        recipient_user_matches: row?.auth_user_id === actor.user.id,
        inviter_matches: row?.invited_by === admin.user.id,
        recipient_email_matches: row?.email?.toLowerCase() === actor.user.email.toLowerCase(),
        name_marker_matches: row?.full_name === marker, workspace_marker_matches: row?.workspace_name === marker,
        free_personal: row?.plan_code === 'free' && row?.workspace_type === 'personal',
        no_payment: row?.payment_received === false,
        unprovisioned: !!row && row.provisioned_workspace_id === null && row.completed_at === null
      };
      need(row?.id === input.invitationId && row.auth_user_id === actor.user.id && row.invited_by === admin.user.id
        && row.email?.toLowerCase() === actor.user.email.toLowerCase() && row.full_name === marker && row.workspace_name === marker
        && row.plan_code === 'free' && row.workspace_type === 'personal' && row.payment_received === false
        && row.provisioned_workspace_id === null && row.completed_at === null, 'EXACT_UNPROVISIONED_FIXTURE_NOT_VERIFIED');
      const expiry = Date.parse(row.expires_at), serverTime = Date.parse(response.serverDate);
      need(Number.isFinite(expiry) && Number.isFinite(serverTime)
        && (phase === 'expired' ? row.status === 'sent' && expiry <= serverTime
          : row.status === 'cancelled' && expiry > serverTime), 'EXPECTED_UNAVAILABLE_STATE_NOT_VERIFIED');
      if (phase === 'replaced') {
        const audit = await readAs(admin, auditRoute);
        need(successfulRead(audit) && audit.data.some(a => a.actor_id === admin.user.id && a.action === 'cancelled'
          && a.safe_details?.fixture === 'AU02.04' && a.safe_details?.run_id === input.invitationId
          && a.safe_details?.reason === 'replaced'), 'REPLACED_STATE_AUDIT_NOT_VERIFIED');
      }
      variants[phase] = { exact_recipient_bound_fixture_verified: true };
      const read = await rpc(actor, 'get_my_admin_user_invitation', { p_invitation_id: input.invitationId });
      need([400, 403].includes(read.status) && read.data?.message === 'ADMIN_INVITATION_NOT_AVAILABLE', 'UNAVAILABLE_READ_DENIAL_NOT_ESTABLISHED');
      variants[phase].invitation_read_denied = true;
      report.completion_RPC_calls++;
      report.unprovisioned_fixture_completion_denial_attempts++;
      const completion = await rpc(actor, 'complete_admin_user_invitation', { p_invitation_id: input.invitationId, p_enabled_currencies: ['USD'], p_default_currency: 'USD' });
      need([400, 403].includes(completion.status) && completion.data?.message === (phase === 'expired' ? 'ADMIN_INVITATION_EXPIRED' : 'ADMIN_INVITATION_NOT_AVAILABLE'), 'UNAVAILABLE_COMPLETION_DENIAL_NOT_ESTABLISHED');
      variants[phase].completion_denied = true;
    }
    need(await profile(actor) === beforeProfile, 'ORIGINAL_PROFILE_CHANGED');
    need(await workspaces(actor) === beforeWorkspaces, 'ORIGINAL_OWNED_WORKSPACES_CHANGED');
    checks.original_profile_and_owned_workspaces_preserved = true;
    complete = true;
  } catch (error) {
    report.problem_code = error instanceof Review ? error.safeCode : error?.message === 'OWNER_CANCELLED' ? 'OWNER_CANCELLED' : 'REQUEST_OR_SQL_HANDOFF_FAILED';
  } finally {
    if (fixtureMayExist && pack && admin) {
      try {
        await interact.sqlStep('cleanup', pack.cleanup); report.fixture_SQL_steps_acknowledged++;
        const invitation = await readAs(admin, invitationRoute), audit = await readAs(admin, auditRoute);
        report.fixture_cleanup_responses = { invitation: responseSummary(invitation), audit: responseSummary(audit) };
        need(successfulRead(invitation) && invitation.data.length === 0 && successfulRead(audit) && audit.data.length === 0, 'FIXTURE_CLEANUP_NOT_VERIFIED');
        checks.temporary_invitation_and_audit_absent = true; report.fixture_cleanup_required = false;
      } catch { report.cleanup_problem_code = 'FIXTURE_CLEANUP_NOT_VERIFIED'; }
    }
    for (const actor of sessions.reverse()) {
      const diagnostic = { account_slot: actor.slot, HTTP_status: null, error_code: null };
      report.session_cleanup_responses.push(diagnostic);
      try { await ensureFresh(actor); } catch { diagnostic.renewal_before_logout_verified = false; }
      try {
        const response = await call('POST', '/auth/v1/logout?scope=local', actor.token);
        const summary = responseSummary(response); diagnostic.HTTP_status = summary.HTTP_status; diagnostic.error_code = summary.error_code;
        if ([200, 204].includes(response.status)) report.cleanup_sessions++;
      } catch {}
    }
    checks.created_sessions_cleaned_up = report.created_sessions === report.cleanup_sessions;
    if (!checks.created_sessions_cleaned_up) report.session_cleanup_problem_code = 'SCOPED_SESSION_CLEANUP_NOT_VERIFIED';
    checks.session_renewals_verified = report.refresh_grants === report.refresh_checks.length
      && report.refresh_checks.every(item => item.same_user_and_session_verified)
      && sessions.every(actor => !actor.renewalFailed)
      && report.session_cleanup_responses.every(item => item.renewal_before_logout_verified !== false);
    if (!checks.session_renewals_verified) report.session_renewal_problem_code = 'TEST_SESSION_RENEWAL_NOT_VERIFIED';
    if (complete && checks.temporary_invitation_and_audit_absent && checks.created_sessions_cleaned_up && checks.session_renewals_verified) {
      report.result = 'UNAVAILABLE_ADMIN_INVITATION_SERVER_STATE_DENIAL_SCOPED_PASS'; report.exit_code = 0;
    }
  }
  return report;
}
