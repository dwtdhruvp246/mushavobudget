import { randomUUID } from 'node:crypto';
import { API_ORIGIN, need, tokenIdentity } from './staging-access.mjs';

const FIXTURE = 'audit-batch-x-receipt-d7be160c2026';
const WORKSPACE = 'dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const CASES = ['X_THREE_ORDINARY_TEAM_ACTORS', 'X_MANAGER_OWNER_AND_ESCALATION_DENIALS',
  'X_MANAGER_REMOVES_ANOTHER_MEMBER', 'X_REMOVED_MEMBER_SAME_SESSION', 'X_TEAM_FIXTURE_CLEANUP'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const RPCS = ['app_session_status', 'admin_business_set_status', 'admin_set_business_seats',
  'create_business_invitation', 'respond_business_invitation', 'cancel_business_invitation',
  'remove_business_member', 'update_business_member_access', 'set_business_member_permission',
  'business_has_permission', 'business_team_snapshot'];
const TABLES = ['budget_workspaces', 'workspace_subscriptions', 'workspace_members', 'workspace_invitations',
  'business_dimensions', 'business_categories', 'business_member_scopes', 'business_member_permissions'];
const one = data => Array.isArray(data) && data.length === 1 ? data[0] : data;
const rows = result => result.status === 200 && Array.isArray(result.data) && result.data.length < 4;
const voidSuccess = result => [200, 204].includes(result.status) && result.data === null;
const denied = (result, code) => result.status === 400 && result.data?.message === code;

export function isBusinessTeamPlan(plan) {
  return plan.scope === 'business-team-boundaries' && plan.project === 'dczlddwbtgvfdujgcitb'
    && plan.fixture_name === FIXTURE && plan.workspace_id === WORKSPACE
    && plan.expected_support_version === 14 && plan.expected_subscription_version === 13
    && plan.original_paid_through_at === '2026-11-08T00:00:00.000Z'
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkBusinessTeam({ actors, accounts, evidence }, key, agent, plan, fetcher = fetch, now = Date.now) {
  need(isBusinessTeamPlan(plan), 'REVIEWED_BUSINESS_TEAM_PLAN_REQUIRED');
  const owner = actors.USER_A, manager = actors.USER_B, member = actors.USER_C, admin = actors.ADMIN;
  const selected = [owner, manager, member, admin];
  need(Object.keys(actors).length === 4 && selected.every(actor => UUID.test(actor?.id || '')
    && tokenIdentity(actor.token)?.userId === actor.id)
    && new Set(selected.map(actor => actor.id)).size === 4
    && new Set(selected.map(actor => tokenIdentity(actor.token).sessionId)).size === 4,
  'FOUR_DISTINCT_BOUND_TEAM_ACTORS_REQUIRED');
  Object.assign(evidence, { checks: {}, exercise_requests: 0, email_requests: 0, provider_payment_requests: 0,
    Storage_requests: 0, finance_write_requests: 0, resume_attempted: false,
    temporary_members_removed: false, original_seats_restored: false, fixture_suspended_verified: false });
  const check = (name, passed) => { evidence.checks[name] = passed === true; need(passed === true, name + '_REQUIRED'); };
  const call = async (method, route, actor, body, cleanup = false) => {
    need(evidence.exercise_requests < (cleanup ? 130 : 100), 'TEAM_REQUEST_LIMIT_REQUIRED');
    const url = new URL(route, API_ORIGIN), parts = url.pathname.split('/');
    need(route.startsWith('/') && url.origin === API_ORIGIN && !url.hash
      && (method === 'POST' && parts.slice(0, 4).join('/') === '/rest/v1/rpc' && RPCS.includes(parts[4])
        || method === 'GET' && parts.slice(0, 3).join('/') === '/rest/v1' && TABLES.includes(parts[3])
          && url.searchParams.get('limit') === '4'), 'TEAM_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response = await fetcher(url, { method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
      headers: { apikey: key, Authorization: 'Bearer ' + actor.token, 'Content-Type': 'application/json', 'User-Agent': agent },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data = null;
    try { data = await response.json(); } catch {}
    if (response.status >= 400) evidence.last_refusal = { status: response.status,
      ...(/^[A-Z][A-Z0-9_]{2,79}$/.test(data?.message || '') ? { application_code: data.message } : {}) };
    return { status: response.status, data };
  };
  const rpc = (name, actor, body = {}, cleanup = false) => call('POST', '/rest/v1/rpc/' + name, actor, body, cleanup);
  const get = (table, fields, filters, actor = owner, cleanup = false) => call('GET',
    `/rest/v1/${table}?select=${fields}&${filters}&limit=4`, actor, undefined, cleanup);
  const scoped = 'workspace_id=eq.' + WORKSPACE;
  const members = (cleanup = false) => get('workspace_members', 'id,user_id,role,status', scoped, owner, cleanup);
  const pending = (cleanup = false) => get('workspace_invitations', 'id,invitee_user_id', scoped + '&status=eq.pending', owner, cleanup);
  const permission = (actor, code, cleanup = false) => rpc('business_has_permission', actor,
    { p_workspace_id: WORKSPACE, p_permission_code: code }, cleanup);
  const fixture = async (cleanup = false) => {
    const result = await get('budget_workspaces', 'id,owner_id,name,workspace_type,status,business_support_version',
      'id=eq.' + WORKSPACE, admin, cleanup);
    const row = one(result.data);
    need(result.status === 200 && row?.id === WORKSPACE && row.owner_id === owner.id && row.name === FIXTURE
      && row.workspace_type === 'business' && ['active', 'suspended'].includes(row.status)
      && Number.isInteger(row.business_support_version), 'EXACT_TEAM_FIXTURE_REQUIRED');
    return row;
  };
  const subscription = async (cleanup = false) => {
    const result = await get('workspace_subscriptions', 'status,version,member_limit,paid_through_at', scoped, admin, cleanup);
    const row = one(result.data);
    need(result.status === 200 && row?.status === 'active' && Number.isInteger(row.version)
      && [1, 3].includes(row.member_limit) && Date.parse(row.paid_through_at) === Date.parse(plan.original_paid_through_at),
    'EXACT_TEAM_SUBSCRIPTION_REQUIRED');
    return row;
  };
  const setStatus = async (row, status, cleanup = false) => {
    const result = await rpc('admin_business_set_status', admin, { p_workspace_id: WORKSPACE, p_status: status,
      p_expected_version: row.business_support_version, p_confirmation_name: FIXTURE,
      p_reason: 'Bounded three-ordinary-account Business team acceptance', p_request_id: randomUUID() }, cleanup);
    need(result.status === 200 && UUID.test(result.data || ''), 'TEAM_SUPPORT_ACTION_ACK_REQUIRED');
    const after = await fixture(cleanup);
    need(after.status === status && after.business_support_version === row.business_support_version + 1,
      'TEAM_STATUS_INDEPENDENT_READBACK_REQUIRED');
  };
  const setSeats = async (row, seats, cleanup = false) => {
    const result = await rpc('admin_set_business_seats', admin, { p_workspace_id: WORKSPACE, p_total_seats: seats,
      p_expected_version: row.version, p_confirmation_name: FIXTURE,
      p_reason: 'Temporary three-actor synthetic Business role check' }, cleanup);
    need(result.status === 200 && result.data === seats, 'TEAM_SEAT_ACTION_ACK_REQUIRED');
    const after = await subscription(cleanup);
    need(after.member_limit === seats && after.version === row.version + 1, 'TEAM_SEATS_INDEPENDENT_READBACK_REQUIRED');
  };
  let failure, cleanupFailure;
  try {
    for (const [slot, actor] of Object.entries(actors)) {
      const session = await rpc('app_session_status', actor);
      check(slot + '_APPLICATION_SESSION_VALID', session.status === 200 && session.data?.session_valid === true
        && session.data.admin_authorized === (slot === 'ADMIN'));
    }
    const initial = await fixture(), sub = await subscription();
    check('EXACT_ISOLATED_FIXTURE_AND_ORIGINAL_TERM', initial.status === 'suspended'
      && initial.business_support_version === plan.expected_support_version && sub.version === plan.expected_subscription_version
      && sub.member_limit === 1 && Date.parse(sub.paid_through_at) > now() + 600000);
    evidence.resume_attempted = true;
    await setStatus(initial, 'active');
    const baseline = await members(), invitations = await pending();
    check('EXACT_ORIGINAL_OWNER_AND_INACTIVE_MANAGER', rows(baseline) && baseline.data.length === 3
      && baseline.data.some(row => row.user_id === owner.id && row.role === 'business_owner' && row.status === 'active')
      && baseline.data.some(row => row.user_id === manager.id && row.role === 'finance_manager' && row.status === 'inactive')
      && baseline.data.some(row => row.user_id === member.id && row.role === 'staff' && row.status === 'inactive')
      && rows(invitations) && invitations.data.length === 0);
    await setSeats(sub, 3);
    const dimensions = await get('business_dimensions', 'id', scoped + '&name=eq.Synthetic%20audit%20team&status=eq.active');
    const dimension = one(dimensions.data)?.id;
    check('EXISTING_SYNTHETIC_TEAM_BOUND', rows(dimensions) && dimensions.data.length === 1 && UUID.test(dimension || ''));
    for (const [slot, actor, role] of [['USER_B', manager, 'team_manager'], ['USER_C', member, 'staff']]) {
      const invite = await rpc('create_business_invitation', owner, { p_workspace_id: WORKSPACE,
        p_email: accounts[slot].email, p_role: role, p_scope_ids: [dimension] });
      check(slot + '_DATABASE_ONLY_INVITATION_BOUND', invite.status === 200 && UUID.test(invite.data?.invitation_id || '')
        && invite.data.invitee_user_id === actor.id);
      const accepted = await rpc('respond_business_invitation', actor, { p_invitation_id: invite.data.invitation_id, p_accept: true });
      check(slot + '_ACCEPTED_EXACT_BUSINESS', accepted.status === 200 && accepted.data === WORKSPACE);
    }
    const joined = await members();
    check('EXACT_THREE_ORDINARY_ACTIVE_MEMBERS', rows(joined) && joined.data.length === 3
      && joined.data.every(row => row.status === 'active' && [owner.id, manager.id, member.id].includes(row.user_id)));
    const ownerRow = joined.data.find(row => row.user_id === owner.id);
    const managerRow = joined.data.find(row => row.user_id === manager.id);
    const memberRow = joined.data.find(row => row.user_id === member.id);
    check('ORDINARY_MANAGER_AND_STAFF_ROLES_BOUND', managerRow?.role === 'team_manager' && memberRow?.role === 'staff');
    const sameScope = async row => get('business_member_scopes', 'member_id,dimension_id', scoped + '&member_id=eq.' + row.id);
    for (const [label, row] of [['MANAGER', managerRow], ['MEMBER', memberRow]]) {
      const scopes = await sameScope(row);
      check(label + '_ASSIGNED_SYNTHETIC_SCOPE_BOUND', rows(scopes) && scopes.data.length === 1 && scopes.data[0].dimension_id === dimension);
    }
    check('MANAGER_HAS_DELEGATED_TEAM_MANAGE', (await permission(manager, 'team.manage')).data === true);
    check('STAFF_CANNOT_REMOVE_MANAGER', denied(await rpc('remove_business_member', member,
      { p_workspace_id: WORKSPACE, p_member_id: managerRow.id }), 'BUSINESS_TEAM_ACCESS_REQUIRED'));
    check('MANAGER_CANNOT_REMOVE_OWNER', denied(await rpc('remove_business_member', manager,
      { p_workspace_id: WORKSPACE, p_member_id: ownerRow.id }), 'INVALID_BUSINESS_MEMBER'));
    check('MANAGER_CANNOT_REMOVE_SELF', denied(await rpc('remove_business_member', manager,
      { p_workspace_id: WORKSPACE, p_member_id: managerRow.id }), 'INVALID_BUSINESS_MEMBER'));
    check('MANAGER_CANNOT_GRANT_MEMBER_OVERRIDE', denied(await rpc('set_business_member_permission', manager,
      { p_workspace_id: WORKSPACE, p_member_id: memberRow.id, p_permission_code: 'team.manage', p_effect: 'allow' }), 'BUSINESS_OWNER_REQUIRED'));
    check('MANAGER_CANNOT_ESCALATE_MEMBER_ROLE', denied(await rpc('update_business_member_access', manager,
      { p_workspace_id: WORKSPACE, p_member_id: memberRow.id, p_role: 'finance_manager', p_scope_ids: [dimension] }),
    'BUSINESS_PRIVILEGE_ESCALATION_BLOCKED'));
    const override = await rpc('set_business_member_permission', owner, { p_workspace_id: WORKSPACE,
      p_member_id: memberRow.id, p_permission_code: 'team.view', p_effect: 'allow' });
    evidence.permission_update_HTTP_statuses = { member_allow: override.status };
    const overrideRows = await get('business_member_permissions', 'member_id,permission_code,effect', scoped + '&member_id=eq.' + memberRow.id);
    check('OWNER_SET_ONE_REMOVABLE_MEMBER_OVERRIDE', voidSuccess(override) && rows(overrideRows) && overrideRows.data.length === 1
      && overrideRows.data[0].permission_code === 'team.view' && overrideRows.data[0].effect === 'allow');
    const deniedOverride = await rpc('set_business_member_permission', owner, { p_workspace_id: WORKSPACE,
      p_member_id: managerRow.id, p_permission_code: 'team.manage', p_effect: 'deny' });
    evidence.permission_update_HTTP_statuses.manager_deny = deniedOverride.status;
    check('EXPLICIT_MANAGER_DENIAL_EFFECTIVE', voidSuccess(deniedOverride) && (await permission(manager, 'team.manage')).data === false);
    check('DENIED_MANAGER_CANNOT_REMOVE_MEMBER', denied(await rpc('remove_business_member', manager,
      { p_workspace_id: WORKSPACE, p_member_id: memberRow.id }), 'BUSINESS_TEAM_ACCESS_REQUIRED'));
    const stillJoined = await members();
    check('ALL_DENIED_ACTIONS_PRESERVE_THREE_MEMBERS', rows(stillJoined) && stillJoined.data.every(row => row.status === 'active')
      && stillJoined.data.find(row => row.user_id === member.id)?.role === 'staff');
    const cleared = await rpc('set_business_member_permission', owner, { p_workspace_id: WORKSPACE,
      p_member_id: managerRow.id, p_permission_code: 'team.manage', p_effect: null });
    evidence.permission_update_HTTP_statuses.manager_clear = cleared.status;
    check('OWNER_RESTORED_DEFAULT_MANAGER_AUTHORITY', voidSuccess(cleared) && (await permission(manager, 'team.manage')).data === true);
    const beforeRead = await get('business_categories', 'id,name,status', scoped + '&name=eq.Synthetic%20audit%20expense&status=eq.active', member);
    check('MEMBER_PROTECTED_CATEGORY_VISIBLE_BEFORE_REMOVAL', rows(beforeRead) && beforeRead.data.length === 1);
    const personalBefore = await get('budget_workspaces', 'id,owner_id,workspace_type,status',
      `owner_id=eq.${member.id}&workspace_type=eq.personal&status=eq.active`, member);
    check('MEMBER_OWN_PERSONAL_BASELINE_BOUND', rows(personalBefore) && personalBefore.data.length === 1);
    const removed = await rpc('remove_business_member', manager, { p_workspace_id: WORKSPACE, p_member_id: memberRow.id });
    check('NONOWNER_MANAGER_REMOVED_ANOTHER_ORDINARY_MEMBER', removed.status === 200 && removed.data === 'removed');
    const afterMembers = await members();
    check('REMOVAL_PRESERVES_OWNER_AND_MANAGER', rows(afterMembers) && afterMembers.data.length === 3
      && afterMembers.data.find(row => row.user_id === member.id)?.status === 'inactive'
      && afterMembers.data.filter(row => row.status === 'active').length === 2);
    const removedScopes = await sameScope(memberRow);
    const removedOverrides = await get('business_member_permissions', 'member_id', scoped + '&member_id=eq.' + memberRow.id);
    check('REMOVAL_CLEARS_SCOPES_AND_OVERRIDES', rows(removedScopes) && removedScopes.data.length === 0
      && rows(removedOverrides) && removedOverrides.data.length === 0);
    const claims = JSON.parse(Buffer.from(member.token.split('.')[1], 'base64url').toString('utf8'));
    const sameSession = await rpc('app_session_status', member);
    check('REMOVED_MEMBER_SAME_UNEXPIRED_ORDINARY_SESSION_VALID', claims.exp * 1000 > now()
      && sameSession.status === 200 && sameSession.data?.session_valid === true && sameSession.data.admin_authorized === false);
    const afterPermission = await permission(member, 'workspace.view');
    check('REMOVED_MEMBER_BUSINESS_PERMISSION_REVOKED', afterPermission.status === 200 && afterPermission.data === false);
    const afterRead = await get('business_categories', 'id', scoped + '&name=eq.Synthetic%20audit%20expense&status=eq.active', member);
    check('REMOVED_MEMBER_DIRECT_CATEGORY_ROWS_HIDDEN', rows(afterRead) && afterRead.data.length === 0);
    check('REMOVED_MEMBER_TEAM_RPC_DENIED', denied(await rpc('business_team_snapshot', member,
      { p_workspace_id: WORKSPACE }), 'BUSINESS_MEMBERSHIP_REQUIRED'));
    const personalAfter = await get('budget_workspaces', 'id,owner_id,workspace_type,status',
      `owner_id=eq.${member.id}&workspace_type=eq.personal&status=eq.active`, member);
    check('REMOVED_MEMBER_PERSONAL_WORKSPACE_UNAFFECTED', rows(personalAfter)
      && JSON.stringify(personalAfter.data) === JSON.stringify(personalBefore.data));
    check('REMOVAL_REPLAY_DENIED', denied(await rpc('remove_business_member', manager,
      { p_workspace_id: WORKSPACE, p_member_id: memberRow.id }), 'INVALID_BUSINESS_MEMBER'));
  } catch (error) { failure = error; }
  finally {
    if (evidence.resume_attempted) {
      try {
        const invitations = await pending(true);
        need(rows(invitations) && invitations.data.every(row => [manager.id, member.id].includes(row.invitee_user_id)),
          'EXACT_TEAM_CLEANUP_INVITATIONS_REQUIRED');
        for (const invitation of invitations.data) {
          const cancelled = await rpc('cancel_business_invitation', owner, { p_invitation_id: invitation.id }, true);
          need(cancelled.status === 200 && cancelled.data === 'cancelled', 'TEAM_PENDING_INVITATION_CLEANUP_REQUIRED');
        }
        const current = await members(true);
        need(rows(current) && current.data.every(row => [owner.id, manager.id, member.id].includes(row.user_id)), 'EXACT_TEAM_CLEANUP_MEMBERS_REQUIRED');
        for (const row of current.data.filter(row => row.status === 'active' && row.user_id !== owner.id)) {
          if (row.user_id === manager.id) {
            const restored = await rpc('update_business_member_access', owner, { p_workspace_id: WORKSPACE,
              p_member_id: row.id, p_role: 'finance_manager', p_scope_ids: [] }, true);
            need(restored.status === 200 && restored.data === 'updated', 'ORIGINAL_INACTIVE_MEMBER_ROLE_RESTORE_REQUIRED');
          }
          const removed = await rpc('remove_business_member', owner, { p_workspace_id: WORKSPACE, p_member_id: row.id }, true);
          need(removed.status === 200 && removed.data === 'removed', 'TEAM_TEMPORARY_MEMBER_REMOVAL_REQUIRED');
        }
        const after = await members(true), afterPending = await pending(true);
        evidence.temporary_members_removed = rows(after) && after.data.filter(row => row.status === 'active').length === 1
          && after.data.some(row => row.user_id === owner.id && row.status === 'active')
          && after.data.some(row => row.user_id === manager.id && row.status === 'inactive' && row.role === 'finance_manager')
          && rows(afterPending) && afterPending.data.length === 0;
        check('ONLY_OWNER_ACTIVE_AND_ORIGINAL_MANAGER_ROLE_RESTORED', evidence.temporary_members_removed);
        for (const row of after.data.filter(row => row.user_id !== owner.id)) {
          const scopes = await get('business_member_scopes', 'member_id', scoped + '&member_id=eq.' + row.id, owner, true);
          const overrides = await get('business_member_permissions', 'member_id', scoped + '&member_id=eq.' + row.id, owner, true);
          check((row.user_id === manager.id ? 'MANAGER' : 'MEMBER') + '_TEMPORARY_SCOPES_AND_OVERRIDES_CLEANED',
            rows(scopes) && scopes.data.length === 0 && rows(overrides) && overrides.data.length === 0);
        }
        const sub = await subscription(true);
        if (sub.member_limit === 3) await setSeats(sub, 1, true);
        evidence.original_seats_restored = (await subscription(true)).member_limit === 1;
        check('ORIGINAL_ONE_SEAT_AND_UNCHANGED_TERM_RESTORED', evidence.original_seats_restored);
      } catch (error) { cleanupFailure = error; }
      try {
        const row = await fixture(true);
        if (row.status === 'active') await setStatus(row, 'suspended', true);
        evidence.fixture_suspended_verified = (await fixture(true)).status === 'suspended';
        check('EXACT_TEAM_FIXTURE_SUSPENDED_AFTER_CLEANUP', evidence.fixture_suspended_verified);
      } catch (error) { cleanupFailure ??= error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}
