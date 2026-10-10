// 3.2.2: controlled Family lifecycle in the staging project only.
const { randomUUID } = require('node:crypto');
const STAGING = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const FRONTEND = 'https://mushavo-budget-staging.pages.dev/config.js';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const EMAILS = ['audit.owner@example.com', 'audit.outsider@example.com'];
const NAMES = ['AUDIT-S322-FAMILY-PRIMARY', 'AUDIT-S322-FAMILY-SECONDARY'];
const FIELDS = {
  payment_items: 'id,family_id,workspace_id,owner_id,created_by,visibility,responsible_member_id,name,amount,currency,status,notes',
  payment_records: 'id,family_id,workspace_id,payment_item_id,owner_id,recorded_by,visibility,paid_by_member_id,amount,currency,notes',
};
class AuditError extends Error {}
function ensure(ok, code) { if (!ok) throw new AuditError(code); }
function parseConfig(text) {
  let c;
  try { c = JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/, '').replace(/;\s*$/, '')); }
  catch { throw new AuditError('CONFIG_PARSE_FAILED'); }
  ensure(c.supabaseUrl === STAGING && !text.includes('kttkospkblwvguuwnhjj') && !c.vapidPublicKey, 'CONFIG_NOT_ISOLATED_STAGING');
  ensure(/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey || ''), 'CONFIG_KEY_TYPE_REJECTED'); return c;
}
const permissionDenied = r => [401, 403].includes(r.status) && r.data?.code === '42501';
const empty = r => r.status === 200 && Array.isArray(r.data) && r.data.length === 0;
const rowDenied = r => permissionDenied(r) || empty(r);
const rpcDenied = (r, messages) => permissionDenied(r) || (r.status === 400 && r.data?.code === 'P0001' && messages.includes(r.data?.message));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function one(r, code, statuses = [200]) { ensure(statuses.includes(r.status) && Array.isArray(r.data) && r.data.length === 1, code); return r.data[0]; }
async function run({ fetcher = fetch, ownerPassword, outsiderPassword, uuid = randomUUID, today = new Date().toISOString().slice(0, 10) } = {}) {
  const checks = [], sessions = [], fixtures = [];
  let config, problem = null, phase = 'Configuration', logoutOk = true, count = 0, memberRowsRemoved = false, memberSessionAfterRemoval = false;
  const pass = check => checks.push({ check, status: 'PASS' });
  async function request(route, { token, method = 'GET', body } = {}) {
    ensure(++count <= 300, 'REQUEST_BUDGET_EXCEEDED');
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    if (method !== 'GET') headers.Prefer = 'return=representation';
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetcher(STAGING + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(20000) });
    let data = null; try { const text = await r.text(); if (text) data = JSON.parse(text); } catch { /* Never accept malformed denials. */ }
    return { status: r.status, data };
  }
  const get = (route, s) => request(route, { token: s.token });
  const rpc = (name, s, body) => request('/rest/v1/rpc/' + name, { token: s?.token, method: 'POST', body });
  const payment = (table, id) => '/rest/v1/' + table + '?select=' + FIELDS[table] + '&id=eq.' + id;
  async function unchanged(f, table, expected) { ensure(equal(one(await get(payment(table, expected.id), f.session), 'PROTECTED_READBACK_FAILED'), expected), 'PROTECTED_ROW_CHANGED'); }
  async function participant(f, s, expected) {
    const r = await rpc('is_active_family_participant', s, { p_family_id: f.family.id });
    ensure(r.status === 200 && r.data === expected, 'PARTICIPANT_STATE_MISMATCH');
  }
  async function management(f, s, expected) {
    const r = await rpc('can_manage_family_members', s, { p_family_id: f.family.id });
    ensure(r.status === 200 && r.data === expected, 'MANAGEMENT_STATE_MISMATCH');
  }
  async function membership(f, s, expectedStatus) {
    const legacy = one(await get('/rest/v1/family_members?select=id,user_id,family_id,role,status&family_id=eq.' + f.family.id + '&user_id=eq.' + s.id, f.session), 'LEGACY_MEMBERSHIP_READ_FAILED');
    const generalized = one(await get('/rest/v1/workspace_members?select=id,user_id,workspace_id,role,status&workspace_id=eq.' + f.workspace.id + '&user_id=eq.' + s.id, f.session), 'WORKSPACE_MEMBERSHIP_READ_FAILED');
    ensure(legacy.user_id === s.id && legacy.family_id === f.family.id && legacy.role === 'Adult' && legacy.status === expectedStatus && generalized.user_id === s.id && generalized.workspace_id === f.workspace.id && generalized.role === 'family_member' && generalized.status === expectedStatus, 'MEMBERSHIP_SCOPE_ROLE_OR_STATUS_MISMATCH');
    return { legacy, generalized };
  }
  async function noMember(f, s) {
    const r = await get('/rest/v1/family_members?select=id&family_id=eq.' + f.family.id + '&user_id=eq.' + s.id, f.session);
    ensure(empty(r), 'UNEXPECTED_MEMBER_CREATED'); await participant(f, s, false);
  }
  async function invitation(f, id, expectedStatus) {
    const legacy = one(await get('/rest/v1/family_invitations?select=id,family_id,invited_by,invitee_email,role,status&id=eq.' + id, f.session), 'INVITATION_READ_FAILED');
    const generalized = one(await get('/rest/v1/workspace_invitations?select=legacy_invitation_id,workspace_id,invitee_user_id,role,status&legacy_invitation_id=eq.' + id, f.session), 'WORKSPACE_INVITATION_READ_FAILED');
    ensure(legacy.id === id && legacy.family_id === f.family.id && legacy.invited_by === f.session.id && legacy.invitee_email === EMAILS[1] && legacy.role === 'Adult' && legacy.status === expectedStatus && generalized.legacy_invitation_id === id && generalized.workspace_id === f.workspace.id && generalized.invitee_user_id === sessions[1].id && generalized.role === 'family_member' && generalized.status === expectedStatus, 'INVITATION_STATE_OR_SCOPE_MISMATCH');
  }
  async function invite(f) {
    const r = await rpc('invite_family_member', f.session, { p_family_id: f.family.id, p_email: EMAILS[1], p_role: 'Adult' });
    ensure(r.status === 200 && UUID.test(r.data || ''), 'HEAD_INVITE_POSITIVE_CONTROL_FAILED');
    await invitation(f, r.data, 'pending');
    const notice = one(await get('/rest/v1/notifications?select=id,type,invitation_id,user_id,email,workspace_id&invitation_id=eq.' + r.data + '&type=eq.family_invite', sessions[1]), 'RECIPIENT_NOTIFICATION_MISSING');
    ensure(notice.type === 'family_invite' && notice.invitation_id === r.data && notice.user_id === sessions[1].id && notice.email === EMAILS[1] && notice.workspace_id === f.workspace.id, 'INVITATION_NOTIFICATION_SCOPE_MISMATCH');
    return r.data;
  }
  async function deniedResponse(f, id, s) {
    ensure(rpcDenied(await rpc('respond_to_family_invitation', s, { p_invitation_id: id, p_accept: true }), ['INVITATION_NOT_AVAILABLE', 'AUTHENTICATION_REQUIRED']), 'WRONG_RECIPIENT_OR_STATE_RESPONSE_NOT_DENIED');
  }
  try {
    ensure(typeof ownerPassword === 'string' && ownerPassword.length > 0 && typeof outsiderPassword === 'string' && outsiderPassword.length > 0, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
    const response = await fetcher(FRONTEND, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    ensure(response.status === 200, 'CONFIG_FETCH_FAILED'); config = parseConfig(await response.text()); pass('Deployed config uses staging with no production reference or push key');
    phase = 'Verified ordinary staging sessions';
    for (const [i, password] of [ownerPassword, outsiderPassword].entries()) {
      const r = await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: EMAILS[i], password } });
      ensure(r.status === 200 && typeof r.data?.access_token === 'string', 'STAGING_APP_SIGN_IN_FAILED');
      const s = { token: r.data.access_token, id: r.data.user?.id }; sessions.push(s);
      ensure(UUID.test(s.id || '') && r.data.user?.email === EMAILS[i], 'SIGN_IN_IDENTITY_MISMATCH');
      const identity = await get('/auth/v1/user', s); ensure(identity.status === 200 && identity.data?.id === s.id && identity.data?.email === EMAILS[i], 'SESSION_IDENTITY_MISMATCH');
      const staff = await rpc('is_platform_staff', s, { p_roles: null }), suspended = await rpc('my_account_suspended', s, {});
      ensure(staff.status === 200 && staff.data === false && suspended.status === 200 && suspended.data === false, 'ORDINARY_ACTIVE_ACCOUNT_CONTROL_FAILED');
    }
    ensure(sessions[0].id !== sessions[1].id, 'ACCOUNTS_NOT_DISTINCT'); pass('Two distinct verified staging sessions are ordinary active accounts');
    phase = 'Fresh exact Family fixture controls';
    for (const [i, session] of sessions.entries()) {
      const family = one(await get('/rest/v1/families?select=id,owner_id,name&name=eq.' + NAMES[i] + '&owner_id=eq.' + session.id + '&limit=2', session), 'FAMILY_FIXTURE_MISSING_OR_AMBIGUOUS');
      ensure(UUID.test(family.id || '') && family.owner_id === session.id && family.name === NAMES[i], 'FAMILY_FIXTURE_SCOPE_MISMATCH');
      const workspace = one(await get('/rest/v1/budget_workspaces?select=id,owner_id,legacy_family_id,workspace_type,status&legacy_family_id=eq.' + family.id, session), 'HOUSEHOLD_WORKSPACE_MISSING');
      ensure(UUID.test(workspace.id || '') && workspace.owner_id === session.id && workspace.legacy_family_id === family.id && workspace.workspace_type === 'household' && workspace.status === 'active', 'HOUSEHOLD_WORKSPACE_SCOPE_MISMATCH');
      const entitlement = one(await rpc('effective_workspace_entitlement', session, { p_workspace_id: workspace.id }), 'HOUSEHOLD_ENTITLEMENT_MISSING');
      ensure(entitlement.workspace_id === workspace.id && entitlement.plan_code === 'household' && entitlement.effective_status === 'active' && entitlement.read_only === false, 'ACTIVE_HOUSEHOLD_ENTITLEMENT_REQUIRED');
      const settings = one(await get('/rest/v1/workspace_settings?select=reminder_enabled,conversion_enabled&workspace_id=eq.' + workspace.id, session), 'FIXTURE_SETTINGS_MISSING');
      ensure(settings.reminder_enabled === false && settings.conversion_enabled === false, 'FIXTURE_REMINDER_OR_CONVERSION_ENABLED');
      const head = one(await get('/rest/v1/family_members?select=id,user_id,family_id,role,status&family_id=eq.' + family.id + '&limit=3', session), 'FRESH_FAMILY_HEAD_FIXTURE_REQUIRED');
      ensure(UUID.test(head.id || '') && head.user_id === session.id && head.family_id === family.id && head.role === 'Owner' && head.status === 'active', 'HEAD_MEMBER_SCOPE_MISMATCH');
      const f = { session, family, workspace, head }; fixtures.push(f);
      f.item = one(await get('/rest/v1/payment_items?select=' + FIELDS.payment_items + '&family_id=eq.' + family.id + '&name=eq.' + NAMES[i] + '-PAYMENT&limit=2', session), 'FAMILY_PAYMENT_FIXTURE_MISSING');
      ensure(f.item.family_id === family.id && f.item.workspace_id === workspace.id && f.item.owner_id === session.id && f.item.created_by === session.id && f.item.visibility === 'family' && f.item.responsible_member_id === head.id && f.item.status === 'inactive' && Number(f.item.amount) === 1 && f.item.currency === 'USD', 'FAMILY_PAYMENT_FIXTURE_SCOPE_MISMATCH');
      f.record = one(await get('/rest/v1/payment_records?select=' + FIELDS.payment_records + '&payment_item_id=eq.' + f.item.id + '&limit=2', session), 'FAMILY_PAID_FIXTURE_MISSING');
      ensure(f.record.family_id === family.id && f.record.workspace_id === workspace.id && f.record.owner_id === session.id && f.record.recorded_by === session.id && f.record.visibility === 'family' && f.record.paid_by_member_id === head.id && Number(f.record.amount) === 1 && f.record.currency === 'USD', 'FAMILY_PAID_FIXTURE_SCOPE_MISMATCH');
      await participant(f, session, true); await management(f, session, true);
    }
    const [f, second] = fixtures, [head, member] = sessions;
    ensure(f.family.id !== second.family.id && f.workspace.id !== second.workspace.id, 'FAMILY_FIXTURES_NOT_DISTINCT');
    await noMember(f, member); await participant(second, head, false); await management(f, member, false);
    pass('Two separate Family heads have fresh exact fixtures and active entitlements');
    phase = 'Head positive control and foreign Family denial';
    const updated = one(await request(payment('payment_items', f.item.id), { token: head.token, method: 'PATCH', body: { notes: 'Synthetic head permitted update' } }), 'HEAD_PAYMENT_UPDATE_FAILED');
    ensure(equal(updated, { ...f.item, notes: 'Synthetic head permitted update' }), 'HEAD_PAYMENT_UPDATE_SCOPE_CHANGED'); f.item = updated; await unchanged(f, 'payment_items', f.item);
    pass('Matching head can update the known Family payment');
    for (const table of Object.keys(FIELDS)) ensure(rowDenied(await get(payment(table, second[table === 'payment_items' ? 'item' : 'record'].id), head)), 'HEAD_FOREIGN_FAMILY_ROW_EXPOSED');
    ensure(rpcDenied(await rpc('invite_family_member', head, { p_family_id: second.family.id, p_email: EMAILS[0], p_role: 'Adult' }), ['MEMBER_MANAGEMENT_ACCESS_REQUIRED']), 'HEAD_FOREIGN_FAMILY_MANAGEMENT_NOT_DENIED');
    await unchanged(second, 'payment_items', second.item); await unchanged(second, 'payment_records', second.record);
    pass('Head powers do not read or administer the other Family');
    phase = 'Before-join and anonymous protected payment requests';
    for (const [label, s] of [['Before-join user', member], ['Anonymous', undefined]]) {
      for (const [table, expected] of [['payment_items', f.item], ['payment_records', f.record]]) {
        ensure(rowDenied(await request(payment(table, expected.id), { token: s?.token })), 'OUTSIDER_OR_ANONYMOUS_FAMILY_READ_EXPOSED');
        for (const method of ['PATCH', 'DELETE']) {
          ensure(rowDenied(await request(payment(table, expected.id), { token: s?.token, method, body: method === 'PATCH' ? { notes: 'Unauthorized synthetic update' } : undefined })), 'OUTSIDER_OR_ANONYMOUS_FAMILY_MUTATION_NOT_DENIED');
          await unchanged(f, table, expected);
        }
      }
      ensure(rowDenied(await request('/rest/v1/budget_workspaces?select=id&id=eq.' + f.workspace.id, { token: s?.token })), 'OUTSIDER_OR_ANONYMOUS_WORKSPACE_EXPOSED');
      pass(label + ' cannot read or mutate the known protected Family payment rows or read its workspace');
    }
    phase = 'Invitation recipient and decline controls';
    const declined = await invite(f); pass('Head invite creates a pending mirrored invitation and recipient in-app notification');
    await deniedResponse(f, declined, head); await deniedResponse(f, declined, undefined);
    await invitation(f, declined, 'pending'); await noMember(f, member);
    pass('Wrong recipient and anonymous acceptance do not change the pending invitation or create membership');
    ensure(rpcDenied(await rpc('cancel_family_invitation', member, { p_invitation_id: declined }), ['INVITATION_NOT_AVAILABLE']), 'RECIPIENT_CANCEL_HEAD_POWER_NOT_DENIED');
    await invitation(f, declined, 'pending'); pass('Recipient cannot cancel with head authority');
    const rejection = await rpc('respond_to_family_invitation', member, { p_invitation_id: declined, p_accept: false });
    ensure(rejection.status === 200 && rejection.data === 'rejected', 'RECIPIENT_DECLINE_FAILED');
    await invitation(f, declined, 'rejected'); await deniedResponse(f, declined, member); await noMember(f, member); await invitation(f, declined, 'rejected');
    pass('Recipient decline is mirrored; replay cannot accept or create membership');
    phase = 'Head cancellation and cancelled invitation replay';
    const cancelled = await invite(f);
    ensure(permissionDenied(await request('/rest/v1/family_invitations?select=id&id=eq.' + cancelled, { token: head.token, method: 'DELETE' })), 'DIRECT_INVITATION_DELETE_NOT_PERMISSION_DENIED');
    await invitation(f, cancelled, 'pending'); pass('Direct head invitation DELETE is permission-denied; pending row retained');
    const cancellation = await rpc('cancel_family_invitation', head, { p_invitation_id: cancelled });
    ensure(cancellation.status === 200 && cancellation.data === 'cancelled', 'HEAD_CANCEL_POSITIVE_CONTROL_FAILED');
    await invitation(f, cancelled, 'cancelled');
    ensure(empty(await get('/rest/v1/notifications?select=id&invitation_id=eq.' + cancelled + '&type=eq.family_invite', member)), 'CANCELLED_INVITATION_NOTIFICATION_RETAINED');
    await deniedResponse(f, cancelled, member); await noMember(f, member); await invitation(f, cancelled, 'cancelled');
    pass('Protected head cancellation removes its notification; cancelled replay creates no membership');
    phase = 'Recipient acceptance and shared access';
    const accepted = await invite(f);
    ensure(rowDenied(await request('/rest/v1/family_invitations?select=id&id=eq.' + accepted, { token: member.token, method: 'PATCH', body: { status: 'accepted' } })), 'DIRECT_INVITATION_RESPONSE_UPDATE_NOT_DENIED');
    await invitation(f, accepted, 'pending'); await noMember(f, member);
    pass('Direct invitation status update cannot bypass the response RPC');
    const acceptance = await rpc('respond_to_family_invitation', member, { p_invitation_id: accepted, p_accept: true });
    ensure(acceptance.status === 200 && acceptance.data === 'accepted', 'RECIPIENT_ACCEPT_POSITIVE_CONTROL_FAILED');
    await invitation(f, accepted, 'accepted'); const active = await membership(f, member, 'active');
    await participant(f, member, true); await management(f, member, false);
    pass('Intended recipient joins as an active Family member without head authority');
    for (const [table, expected] of [['payment_items', f.item], ['payment_records', f.record]]) ensure(equal(one(await get(payment(table, expected.id), member), 'MEMBER_SHARED_READ_FAILED'), expected), 'MEMBER_SHARED_READ_SCOPE_CHANGED');
    ensure(one(await get('/rest/v1/budget_workspaces?select=id&id=eq.' + f.workspace.id, member), 'MEMBER_WORKSPACE_READ_FAILED').id === f.workspace.id, 'MEMBER_WORKSPACE_SCOPE_CHANGED');
    await deniedResponse(f, accepted, member); await membership(f, member, 'active');
    pass('Active member reads the shared fixture; accepted invitation replay preserves the member state');
    phase = 'Member attributed writes and protected head rows';
    const itemBody = { id: uuid(), family_id: f.family.id, workspace_id: f.workspace.id, owner_id: member.id, created_by: member.id, visibility: 'family', responsible_member_id: active.legacy.id, name: 'AUDIT-S322-MEMBER-' + uuid(), amount: 1, currency: 'USD', status: 'inactive', recurrence_type: 'once', start_date: today, notes: 'Synthetic member contribution' };
    let ownItem = one(await request('/rest/v1/payment_items?select=' + FIELDS.payment_items, { token: member.token, method: 'POST', body: itemBody }), 'MEMBER_ITEM_CREATE_FAILED', [201]);
    ensure(ownItem.id === itemBody.id && ownItem.owner_id === member.id && ownItem.created_by === member.id && ownItem.family_id === f.family.id && ownItem.workspace_id === f.workspace.id && ownItem.visibility === 'family' && ownItem.responsible_member_id === active.legacy.id && ownItem.status === 'inactive' && Number(ownItem.amount) === 1 && ownItem.currency === 'USD', 'MEMBER_ITEM_CREATE_SCOPE_CHANGED');
    const itemUpdated = one(await request(payment('payment_items', ownItem.id), { token: member.token, method: 'PATCH', body: { notes: 'Synthetic permitted member update' } }), 'MEMBER_ITEM_UPDATE_FAILED');
    ensure(equal(itemUpdated, { ...ownItem, notes: 'Synthetic permitted member update' }), 'MEMBER_ITEM_UPDATE_SCOPE_CHANGED'); ownItem = itemUpdated; await unchanged(f, 'payment_items', ownItem);
    const recordBody = { id: uuid(), family_id: f.family.id, workspace_id: f.workspace.id, payment_item_id: ownItem.id, owner_id: member.id, recorded_by: member.id, visibility: 'family', paid_by_member_id: active.legacy.id, amount: 1, currency: 'USD', period_start: today, due_date: today, payment_date: today, payment_method: 'Other', notes: 'Synthetic member paid record' };
    let ownRecord = one(await request('/rest/v1/payment_records?select=' + FIELDS.payment_records, { token: member.token, method: 'POST', body: recordBody }), 'MEMBER_RECORD_CREATE_FAILED', [201]);
    ensure(ownRecord.id === recordBody.id && ownRecord.payment_item_id === ownItem.id && ownRecord.owner_id === member.id && ownRecord.recorded_by === member.id && ownRecord.family_id === f.family.id && ownRecord.workspace_id === f.workspace.id && ownRecord.visibility === 'family' && ownRecord.paid_by_member_id === active.legacy.id && Number(ownRecord.amount) === 1 && ownRecord.currency === 'USD', 'MEMBER_RECORD_CREATE_SCOPE_CHANGED');
    const recordUpdated = one(await request(payment('payment_records', ownRecord.id), { token: member.token, method: 'PATCH', body: { notes: 'Synthetic permitted member paid update' } }), 'MEMBER_RECORD_UPDATE_FAILED');
    ensure(equal(recordUpdated, { ...ownRecord, notes: 'Synthetic permitted member paid update' }), 'MEMBER_RECORD_UPDATE_SCOPE_CHANGED'); ownRecord = recordUpdated; await unchanged(f, 'payment_records', ownRecord);
    pass('Active member creates and updates own attributed inactive item and paid record; head reads matching effects');
    for (const [table, expected] of [['payment_items', f.item], ['payment_records', f.record]]) for (const method of ['PATCH', 'DELETE']) {
      ensure(rowDenied(await request(payment(table, expected.id), { token: member.token, method, body: method === 'PATCH' ? { notes: 'Unauthorized member update' } : undefined })), 'MEMBER_HEAD_ROW_MUTATION_NOT_DENIED');
      await unchanged(f, table, expected);
    }
    pass('Member cannot change or delete the head-owned selected payment rows');
    for (const [table, expected] of [['payment_items', ownItem], ['payment_records', ownRecord]]) {
      ensure(rowDenied(await request(payment(table, expected.id), { token: member.token, method: 'DELETE' })), 'MEMBER_FAMILY_DELETE_NOT_DENIED'); await unchanged(f, table, expected);
    }
    pass('Member contribution ownership does not grant the existing head-only Family DELETE authority');
    phase = 'Family role escalation and payer scope';
    for (const [table, row, role] of [['family_members', active.legacy, 'Owner'], ['workspace_members', active.generalized, 'family_head']]) {
      ensure(rowDenied(await request('/rest/v1/' + table + '?select=id&id=eq.' + row.id, { token: member.token, method: 'PATCH', body: { role } })), 'MEMBER_ROLE_ESCALATION_NOT_DENIED');
      await membership(f, member, 'active'); await management(f, member, false);
      pass('Member cannot promote their ' + table + ' role');
    }
    ensure(rpcDenied(await request(payment('payment_records', ownRecord.id), { token: member.token, method: 'PATCH', body: { paid_by_member_id: second.head.id } }), ['PAID_BY_MEMBER_NOT_IN_FAMILY']), 'FOREIGN_FAMILY_PAYER_NOT_DENIED');
    await unchanged(f, 'payment_records', ownRecord); pass('Existing payer from the other Family cannot be assigned to a primary Family paid record');
    for (const [name, body] of [['invite_family_member', { p_family_id: f.family.id, p_email: EMAILS[0], p_role: 'Adult' }], ['remove_family_member', { p_family_id: f.family.id, p_member_id: f.head.id }]]) {
      ensure(rpcDenied(await rpc(name, member, body), ['MEMBER_MANAGEMENT_ACCESS_REQUIRED']), 'MEMBER_HEAD_MANAGEMENT_NOT_DENIED'); await membership(f, member, 'active');
    }
    pass('Ordinary member cannot invite or remove with head authority');
    ensure(rpcDenied(await rpc('remove_family_member', head, { p_family_id: f.family.id, p_member_id: second.head.id }), ['MEMBER_NOT_FOUND']), 'FOREIGN_FAMILY_MEMBER_REMOVAL_NOT_DENIED');
    await participant(second, second.session, true); pass('Head cannot remove an existing member ID belonging to the other Family');
    ensure(rpcDenied(await rpc('remove_family_member', head, { p_family_id: f.family.id, p_member_id: f.head.id }), ['CANNOT_REMOVE_FAMILY_OWNER']), 'HEAD_SELF_REMOVAL_NOT_DENIED');
    await management(f, head, true); pass('Head cannot remove the Family Owner');
    phase = 'Removal and requests using the same member session';
    const removal = await rpc('remove_family_member', head, { p_family_id: f.family.id, p_member_id: active.legacy.id });
    ensure(removal.status === 200 && removal.data === 'removed', 'HEAD_REMOVE_POSITIVE_CONTROL_FAILED');
    await membership(f, member, 'inactive'); await participant(f, member, false); await management(f, member, false);
    pass('Head removal makes both legacy and generalized memberships inactive');
    memberSessionAfterRemoval = true;
    for (const [table, expected] of [['payment_items', f.item], ['payment_records', f.record], ['payment_items', ownItem], ['payment_records', ownRecord]]) {
      ensure(rowDenied(await get(payment(table, expected.id), member)), 'REMOVED_MEMBER_FAMILY_READ_EXPOSED');
      for (const method of ['PATCH', 'DELETE']) {
        ensure(rowDenied(await request(payment(table, expected.id), { token: member.token, method, body: method === 'PATCH' ? { notes: 'Removed member synthetic update' } : undefined })), 'REMOVED_MEMBER_FAMILY_MUTATION_NOT_DENIED'); await unchanged(f, table, expected);
      }
    }
    ensure(rowDenied(await get('/rest/v1/budget_workspaces?select=id&id=eq.' + f.workspace.id, member)), 'REMOVED_MEMBER_WORKSPACE_EXPOSED');
    pass('Same member session loses protected primary Family reads and PATCH/DELETE access, including own prior contributions');
    for (const [table, body] of [['payment_items', itemBody], ['payment_records', recordBody]]) {
      const attempted = { ...body, id: uuid(), ...(table === 'payment_items' ? { responsible_member_id: f.head.id } : { paid_by_member_id: f.head.id }) };
      const r = await request('/rest/v1/' + table + '?select=id', { token: member.token, method: 'POST', body: attempted });
      ensure(rpcDenied(r, ['WORKSPACE_ACCESS_REQUIRED']), 'REMOVED_MEMBER_INSERT_NOT_DENIED');
      ensure(empty(await get(payment(table, attempted.id), head)), 'REMOVED_MEMBER_INSERT_EFFECT_PRESENT');
    }
    await membership(f, member, 'inactive'); pass('Removed member cannot create new attributed primary Family payment rows');
    await deniedResponse(f, accepted, member); await membership(f, member, 'inactive'); await participant(f, member, false);
    pass('Replaying the previously accepted invitation cannot reactivate a removed member');
    ensure(rpcDenied(await request(payment('payment_records', f.record.id), { token: head.token, method: 'PATCH', body: { paid_by_member_id: active.legacy.id } }), ['PAID_BY_MEMBER_NOT_IN_FAMILY']), 'INACTIVE_FAMILY_PAYER_NOT_DENIED');
    await unchanged(f, 'payment_records', f.record); pass('Inactive removed payer cannot be assigned to a new paid-record write');
    await unchanged(second, 'payment_items', second.item); await unchanged(second, 'payment_records', second.record); await participant(second, member, true); await management(second, member, true);
    pass('Removal from primary Family preserves legitimate head access in the separate Family');
    phase = 'Head delete positive controls for only new member contribution IDs';
    for (const [table, expected] of [['payment_records', ownRecord], ['payment_items', ownItem]]) {
      const deleted = one(await request(payment(table, expected.id), { token: head.token, method: 'DELETE' }), 'HEAD_CONTRIBUTION_DELETE_FAILED'); ensure(deleted.id === expected.id, 'HEAD_DELETE_TARGET_CHANGED');
      ensure(empty(await get(payment(table, expected.id), head)), 'HEAD_DELETED_ROW_REMAINS');
    }
    memberRowsRemoved = true; await unchanged(f, 'payment_items', f.item); await unchanged(f, 'payment_records', f.record);
    pass('Head deletes only this batch member contributions; both head fixture payments remain for currency tests');
  } catch (e) { problem = e instanceof AuditError ? e.message : 'NETWORK_OR_LOCAL_ERROR'; checks.push({ check: phase, status: 'REVIEW', problem_code: problem }); }
  finally {
    if (config) for (const s of sessions) { try { const r = await request('/auth/v1/logout?scope=local', { token: s.token, method: 'POST' }); if (![200, 204].includes(r.status)) logoutOk = false; } catch { logoutOk = false; } }
  }
  if (!problem && (!logoutOk || sessions.length !== 2)) { problem = 'TEST_SESSION_LOGOUT_FAILED'; checks.push({ check: 'Local test-session logout', status: 'REVIEW', problem_code: problem }); }
  else if (logoutOk && sessions.length === 2) pass('Only the two generated API test sessions receive local logout');
  return { stage_step: '3.2.2', result: problem ? 'STAGING_FAMILY_API_REVIEW' : 'STAGING_FAMILY_API_SCOPED_PASS', project: 'dczlddwbtgvfdujgcitb', checks, problem_code: problem,
    test_sessions_logged_out: logoutOk && sessions.length === 2, member_contribution_rows_removed: memberRowsRemoved,
    family_fixtures_and_invitation_history_retained: fixtures.length > 0, incomplete_batch_rows_may_remain: !!problem,
    original_personal_fixtures_targeted: false, same_member_session_used_after_removal: memberSessionAfterRemoval, caller_controlled_email_push_or_scheduler_requests_sent: false,
    hosted_transitive_dispatch_or_UI_behavior_independently_verified: false, selected_currency_settings_or_historical_conversion_integrity_verified: false,
    prior_paid_record_workspace_gap_fixed: false, full_f15_acceptance_verified: false, production_or_native_changed: false,
    credentials_tokens_keys_and_raw_identifiers_printed: false, completed_utc: new Date().toISOString() };
}
module.exports = { run, parseConfig, rpcDenied, rowDenied, AuditError };
