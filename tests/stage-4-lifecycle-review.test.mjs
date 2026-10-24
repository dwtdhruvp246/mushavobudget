import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLifecycleReviewer, safeReviewSummary, startSimulation, advanceSimulation, safeSimulationSummary,
  CATEGORIES, STEPS, STAGING_PROJECT, RECENT_VERIFICATION_MS, SNAPSHOT_AGE_MS} from '../scripts/lib/stage-4-lifecycle-review.mjs';

const ids = {owner: '10000000-0000-4000-8000-000000000001', other: '10000000-0000-4000-8000-000000000002',
  session: '10000000-0000-4000-8000-000000000003', request: '10000000-0000-4000-8000-000000000004',
  workspace: '10000000-0000-4000-8000-000000000005'};
const time = 1_800_000_000_000;
const request = () => ({request_id: ids.request, confirmation: 'DELETE MY ACCOUNT'});
const identity = () => ({source: 'SERVER_VERIFIED', user_id: ids.owner, session_id: ids.session,
  session_active: true, verified_at_ms: time, expires_at_ms: time + 60_000});
const decisions = () => ({approved: true, operator_facts_verified: true, categories: Object.fromEntries(CATEGORIES.map(c => [c,
  {approved: true, disposition: 'delete', decision_id: 'SYNTHETIC-' + c, purpose: 'Synthetic test purpose',
    grounds: 'Synthetic test ground only', expiry_rule: 'Synthetic test disposal rule', access_rule: 'Fixture-only', notice_version: 'TEST-ONLY'}]))});
const ownWorkspace = () => ({id: ids.workspace, kind: 'personal', role: 'owner', version: 'w1',
  resolution: 'close', resolution_approved: true, current_guard_satisfied: true});
const ownObject = () => ({bucket: 'payment-proofs', path: ids.owner + '/proof.png', scope: 'own',
  storage_owner_id: ids.owner, disposition: 'delete', decision_id: 'SYNTHETIC-storage'});
const snapshot = () => ({subject_id: ids.owner, project: STAGING_PROJECT, source: 'SERVER_ENUMERATED', revision: 'r1',
  captured_at_ms: time, database_inventory_complete: true, storage_inventory_complete: true,
  copied_identity_inventory_complete: true, history_integrity_verified: true, source_parity_verified: true,
  recovery_verified: true, provider_lifecycle_verified: true, residual_access_controls_verified: true,
  workspaces: [ownWorkspace()], objects: [ownObject()]});
async function run({id = identity(), snap = snapshot(), policy = decisions(), req = request(), token = 'SYNTHETIC-NOT-A-JWT', verify, load} = {}) {
  return createLifecycleReviewer({verifySession: verify || (async () => id), loadSnapshot: load || (async subject => {
    assert.equal(subject, ids.owner); return snap;
  }), decisions: policy, now: () => time})(req, token);
}
const blocked = (r, reason) => { assert.equal(r.status, 'BLOCKED'); assert.ok(r.reasons.includes(reason)); assert.equal(r.plan, null); };
const denied = r => { assert.equal(r.status, 'DENIED'); assert.equal(r.plan, null); };
const proofFields = {
  CAPTURE_MANIFEST: ['durable_manifest_acknowledged'], REVOKE_ACCESS: ['access_gate_confirmed'],
  RESOLVE_OWNERSHIP: ['ownership_resolved'], REMOVE_STORAGE: ['bytes_removed_or_approved_transfer_verified', 'departing_storage_owner_empty'],
  RESOLVE_DATA: ['approved_data_actions_verified', 'financial_history_preserved'], DELETE_AUTH: ['auth_absent_verified'],
  RECONCILE: ['database_reconciled', 'storage_reconciled', 'provider_reconciled', 'backup_treatment_documented',
    'residual_access_window_documented', 'only_approved_retention_remains']};
function receipt(step, overrides = {}) { return {step, request_id: ids.request, subject_id: ids.owner,
  revision: 'r1', current_revision: 'r1', current_guards_verified: true, operation_id: ids.request + '/' + step,
  ok: true, proof: Object.fromEntries(proofFields[step].map(p => [p, true])), ...overrides}; }
async function jobAt(index = 0) { let job = startSimulation(await run()); for (const s of STEPS.slice(0, index)) job = advanceSimulation(job, receipt(s)); return job; }

test('complete synthetic Personal review produces an immutable plan but never deletion authority', async () => {
  const snap = snapshot(); const before = structuredClone(snap); const r = await run({snap});
  assert.equal(r.status, 'REVIEW_READY'); assert.equal(r.execution_allowed, false); assert.equal(r.account_deleted, false);
  assert.equal(r.hosted_acceptance, false); assert.deepEqual(r.plan.steps, STEPS); assert.deepEqual(snap, before);
  assert.ok(Object.isFrozen(r.plan.objects[0])); assert.throws(() => {r.plan.objects[0].path = 'foreign';}, TypeError);
});
test('missing bearer never invokes identity or inventory ports', async () => {
  denied(await run({token: '', verify: () => {throw Error('must not run');}, load: () => {throw Error('must not run');}}));
});
test('caller-supplied user, email, project or verified flags cannot select a target', async () => {
  for (const key of ['user_id', 'email', 'project', 'verified']) {
    let calls = 0; denied(await run({req: {...request(), [key]: ids.other}, verify: () => {calls++; return identity();}})); assert.equal(calls, 0);
  }
});
test('confirmation, request ID and non-record inputs reject without effects', async () => {
  for (const req of [null, [], {...request(), confirmation: 'yes'}, {...request(), request_id: 'bad'},
    {...request(), request_id: {toString: () => ids.request}}]) denied(await run({req}));
});
test('identity adapter outage produces a safe denial without leaking token or exception', async () => {
  const r = await run({verify: () => {throw Error('SECRET TOKEN FULL-LINK');}}); denied(r);
  assert.ok(!JSON.stringify(r).includes('SECRET')); assert.ok(!JSON.stringify(r).includes('SYNTHETIC-NOT-A-JWT'));
});
test('unverified identity, inactive session and missing server verification reject', async () => {
  for (const patch of [{source: 'BROWSER_CLAIMS'}, {session_active: false}, {session_id: null}, {verified_at_ms: null}])
    denied(await run({id: {...identity(), ...patch}}));
});
test('stale, future and expired verification fail at time boundaries', async () => {
  for (const patch of [{verified_at_ms: time - RECENT_VERIFICATION_MS - 1}, {verified_at_ms: time + 1}, {expires_at_ms: time}])
    denied(await run({id: {...identity(), ...patch}}));
  assert.equal((await run({id: {...identity(), verified_at_ms: time - RECENT_VERIFICATION_MS}})).status, 'REVIEW_READY');
});
test('slow inventory work cannot reuse an identity that expired during preflight', async () => {
  let timeNow = time;
  const review = createLifecycleReviewer({verifySession: async () => identity(),
    loadSnapshot: async () => {timeNow += 60_001; return {...snapshot(), captured_at_ms: timeNow};},
    decisions: decisions(), now: () => timeNow});
  denied(await review(request(), 'SYNTHETIC-NOT-A-JWT'));
});
test('different authenticated subject cannot reuse the owner inventory', async () => {
  blocked(await run({id: {...identity(), user_id: ids.other}, load: async subject => {assert.equal(subject, ids.other); return snapshot();}}),
    'CURRENT_SCOPED_SNAPSHOT_REQUIRED');
});
test('production, browser or stale snapshots cannot be planned', async () => {
  for (const patch of [{project: 'kttkospkblwvguuwnhjj'}, {source: 'CLIENT_STATE'}, {captured_at_ms: time - SNAPSHOT_AGE_MS - 1},
    {captured_at_ms: time + 1}, {revision: ''}]) blocked(await run({snap: {...snapshot(), ...patch}}), 'CURRENT_SCOPED_SNAPSHOT_REQUIRED');
});
test('inventory adapter outage returns a blocker without raw details', async () => {
  const r = await run({load: () => {throw Error('private-row-values');}}); blocked(r, 'SNAPSHOT_UNAVAILABLE');
  assert.ok(!JSON.stringify(r).includes('private-row'));
});
test('unapproved operator and retention template prevents a plan', async () => {
  const d = decisions(); d.approved = false; d.operator_facts_verified = false;
  blocked(await run({policy: d}), 'RETENTION_DECISIONS_REQUIRED');
});
test('the actual tracked unresolved decision template blocks even a complete synthetic inventory', async () => {
  const d = JSON.parse(await readFile(new URL('../docs/security-audit/security-stage-4-retention-decisions.json', import.meta.url), 'utf8'));
  const r = await run({policy: d}); blocked(r, 'RETENTION_DECISIONS_REQUIRED');
  for (const c of CATEGORIES) assert.ok(r.reasons.includes('CATEGORY_DECISION_REQUIRED:' + c));
  assert.equal(d.hosted_execution_authorized, false);
});
test('every data category needs purpose, grounds, expiry, access and notice approval', async () => {
  for (const category of CATEGORIES) for (const field of ['approved', 'purpose', 'grounds', 'expiry_rule', 'access_rule', 'notice_version']) {
    const d = decisions(); delete d.categories[category][field]; blocked(await run({policy: d}), 'CATEGORY_DECISION_REQUIRED:' + category);
  }
});
test('unreviewed disposition cannot become blanket retention', async () => {
  const d = decisions(); d.categories.shared_finance.disposition = 'forever';
  blocked(await run({policy: d}), 'CATEGORY_DECISION_REQUIRED:shared_finance');
});
test('database, Storage and copied identity completeness each gate planning', async () => {
  for (const [key, reason] of [['database_inventory_complete', 'DATABASE_INVENTORY_INCOMPLETE'],
    ['storage_inventory_complete', 'STORAGE_INVENTORY_INCOMPLETE'], ['copied_identity_inventory_complete', 'COPIED_IDENTITY_INVENTORY_INCOMPLETE']])
    blocked(await run({snap: {...snapshot(), [key]: false}}), reason);
});
test('history, parity, recovery, providers and residual access are independent blockers', async () => {
  for (const [key, reason] of [['history_integrity_verified', 'FINANCIAL_HISTORY_UNVERIFIED'], ['source_parity_verified', 'SOURCE_PARITY_UNVERIFIED'],
    ['recovery_verified', 'RECOVERY_UNVERIFIED'], ['provider_lifecycle_verified', 'PROVIDER_LIFECYCLE_UNVERIFIED'],
    ['residual_access_controls_verified', 'RESIDUAL_ACCESS_UNVERIFIED']]) blocked(await run({snap: {...snapshot(), [key]: false}}), reason);
});
test('missing ownership or file enumeration is not treated as empty', async () => {
  const s = snapshot(); delete s.workspaces; blocked(await run({snap: s}), 'OWNERSHIP_INVENTORY_REQUIRED');
  delete s.objects; blocked(await run({snap: s}), 'FILE_MANIFEST_REQUIRED');
});
test('unknown ownership resolution and stale guards do not offer a payment bypass', async () => {
  for (const patch of [{resolution_approved: false}, {current_guard_satisfied: false}]) {
    const s = snapshot(); Object.assign(s.workspaces[0], {kind: 'business'}, patch);
    const r = await run({snap: s}); blocked(r, 'OWNERSHIP_RESOLUTION_REQUIRED'); assert.equal(r.execution_allowed, false);
  }
});
test('member departure and owner closure are distinct approved resolutions', async () => {
  const s = snapshot(); Object.assign(s.workspaces[0], {kind: 'family', role: 'member', resolution: 'leave'});
  assert.equal((await run({snap: s})).status, 'REVIEW_READY');
  s.workspaces[0].resolution = 'close'; blocked(await run({snap: s}), 'INVALID_MEMBER_RESOLUTION');
});
test('shared workspace closure requires separate preservation review', async () => {
  const s = snapshot(); s.workspaces[0].kind = 'family'; blocked(await run({snap: s}), 'SHARED_CLOSURE_REQUIRES_REVIEW');
  s.workspaces[0].shared_closure_approved = true; assert.equal((await run({snap: s})).status, 'REVIEW_READY');
});
test('Business transfer needs a distinct active registered non-platform member', async () => {
  const s = snapshot(); Object.assign(s.workspaces[0], {kind: 'business', resolution: 'transfer',
    successor: {id: ids.other, active_member: true, registered: true, active_account: true, non_platform: true}});
  assert.equal((await run({snap: s})).status, 'REVIEW_READY');
  for (const patch of [{id: ids.owner}, {active_member: false}, {registered: false}, {active_account: false}, {non_platform: false}]) {
    const bad = structuredClone(s); Object.assign(bad.workspaces[0].successor, patch); blocked(await run({snap: bad}), 'INVALID_SUCCESSOR');
  }
});
test('household transfer remains blocked without a reviewed guarded implementation', async () => {
  const s = snapshot(); Object.assign(s.workspaces[0], {kind: 'family', resolution: 'transfer',
    successor: {id: ids.other, active_member: true, registered: true, active_account: true, non_platform: true}});
  blocked(await run({snap: s}), 'HOUSEHOLD_TRANSFER_NOT_IMPLEMENTED');
});
test('duplicate or unknown workspace entries are refused', async () => {
  const s = snapshot(); s.workspaces.push(structuredClone(s.workspaces[0])); blocked(await run({snap: s}), 'INVALID_OWNERSHIP_INVENTORY');
  s.workspaces = [{...ownWorkspace(), kind: 'unknown'}]; blocked(await run({snap: s}), 'INVALID_OWNERSHIP_INVENTORY');
});
test('foreign objects and own-scope owner mismatches cannot be deleted', async () => {
  const s = snapshot(); s.objects[0].scope = 'foreign'; blocked(await run({snap: s}), 'INVALID_OR_FOREIGN_OBJECT');
  s.objects[0].scope = 'own'; s.objects[0].storage_owner_id = ids.other; blocked(await run({snap: s}), 'OBJECT_OWNER_MISMATCH');
  s.objects[0].scope = 'shared'; blocked(await run({snap: s}), 'FOREIGN_OBJECT_MUTATION');
});
test('paths reject traversal, encoded ambiguity and malformed bucket names', async () => {
  for (const path of ['../foreign', '/absolute', 'a//b', 'a/./b', 'a\\b', 'a/%2e%2e/b', 'a/%2F/b', 'a/\u0000b']) {
    const s = snapshot(); s.objects[0].path = path; blocked(await run({snap: s}), 'INVALID_OR_FOREIGN_OBJECT');
  }
  const s = snapshot(); s.objects[0].bucket = 'bucket/other'; blocked(await run({snap: s}), 'INVALID_OR_FOREIGN_OBJECT');
});
test('duplicate object paths cannot hide conflicting dispositions', async () => {
  const s = snapshot(); s.objects.push({...s.objects[0], disposition: 'retain'}); blocked(await run({snap: s}), 'DUPLICATE_OBJECT');
});
test('same object name in distinct buckets stays distinct in a manifest', async () => {
  const s = snapshot(); s.objects.push({...s.objects[0], bucket: 'business-proofs'});
  const r = await run({snap: s}); assert.equal(r.status, 'REVIEW_READY'); assert.equal(r.plan.objects.length, 2);
});
test('approved shared retention cannot leave Storage ownership on the departing user', async () => {
  const s = snapshot(), d = decisions(); d.categories.storage.disposition = 'mixed';
  Object.assign(s.objects[0], {scope: 'shared', disposition: 'retain', retention_rule: 'SYNTHETIC expiry'});
  blocked(await run({snap: s, policy: d}), 'RETAINED_OBJECT_STILL_OWNED_BY_DEPARTING_USER');
  s.objects[0].storage_owner_id = ids.other; assert.equal((await run({snap: s, policy: d})).status, 'REVIEW_READY');
});
test('object disposition must match the approved policy and decision ID', async () => {
  const s = snapshot(); s.objects[0].decision_id = 'unapproved'; blocked(await run({snap: s}), 'OBJECT_DECISION_MISMATCH');
  const d = decisions(); d.categories.storage.disposition = 'retain'; blocked(await run({policy: d}), 'OBJECT_DELETION_UNAPPROVED');
});
test('approved object transfer requires a different verified successor', async () => {
  const s = snapshot(), d = decisions(); d.categories.storage.disposition = 'mixed';
  Object.assign(s.objects[0], {scope: 'shared', disposition: 'transfer', transfer_owner_id: ids.other, transfer_approved: true});
  s.objects[0].shared_action_approved = true; s.objects[0].transfer_owner_verified = true;
  assert.equal((await run({snap: s, policy: d})).status, 'REVIEW_READY');
  s.objects[0].transfer_owner_id = ids.owner; blocked(await run({snap: s, policy: d}), 'OBJECT_TRANSFER_UNAPPROVED');
});
test('shared objects require explicit action approval rather than an owner-wide delete rule', async () => {
  const s = snapshot(); s.objects[0].scope = 'shared'; blocked(await run({snap: s}), 'SHARED_OBJECT_ACTION_UNAPPROVED');
  s.objects[0].shared_action_approved = true; assert.equal((await run({snap: s})).status, 'REVIEW_READY');
});
test('object transfer approval alone cannot substitute for recipient verification', async () => {
  const s = snapshot(), d = decisions(); d.categories.storage.disposition = 'mixed';
  Object.assign(s.objects[0], {scope: 'shared', disposition: 'transfer', transfer_owner_id: ids.other,
    transfer_approved: true, shared_action_approved: true});
  blocked(await run({snap: s, policy: d}), 'OBJECT_TRANSFER_UNAPPROVED');
});
test('safe receipt contains no bearer, identity, workspace IDs, file paths or policy body', async () => {
  const value = JSON.stringify(safeReviewSummary(await run()));
  for (const secret of [ids.owner, ids.workspace, ids.request, 'proof.png', 'SYNTHETIC-NOT-A-JWT', 'Synthetic test ground']) assert.ok(!value.includes(secret));
});
test('simulation cannot start with a denied or blocked review', async () => {
  assert.throws(() => startSimulation({status: 'DENIED'}));
  assert.throws(() => startSimulation({status: 'BLOCKED', plan: {}}));
});
test('data, Storage or Auth removal cannot precede durable manifest capture', async () => {
  const job = await jobAt(); for (const step of ['REMOVE_STORAGE', 'RESOLVE_DATA', 'DELETE_AUTH']) assert.throws(() => advanceSimulation(job, receipt(step)), /Out-of-order/);
});
test('manifest success without durable evidence is partial failure', async () => {
  const job = advanceSimulation(await jobAt(), receipt('CAPTURE_MANIFEST', {proof: {}}));
  assert.equal(job.status, 'RETRY_REQUIRED'); assert.equal(job.completed.length, 0); assert.equal(job.account_deleted, false);
});
test('foreign request, subject, revision or operation receipts cannot advance', async () => {
  const job = await jobAt(); for (const patch of [{request_id: ids.other}, {subject_id: ids.other}, {revision: 'stale'},
    {operation_id: 'different'}]) assert.throws(() => advanceSimulation(job, receipt('CAPTURE_MANIFEST', patch)), /does not match/);
});
test('concurrent dependency change and rechecked guard failure stop the next effect', async () => {
  const job = await jobAt(2); for (const patch of [{current_revision: 'r2'}, {current_guards_verified: false}])
    assert.throws(() => advanceSimulation(job, receipt('RESOLVE_OWNERSHIP', patch)), /does not match/);
});
test('confirmed phase replay does not duplicate an effect or count an attempt', async () => {
  const job = await jobAt(4); assert.equal(advanceSimulation(job, receipt('REMOVE_STORAGE')), job);
  assert.equal(job.attempts.REMOVE_STORAGE, 1);
});
test('Storage failure prevents data/Auth removal and stays recoverable within bound', async () => {
  let job = await jobAt(3); job = advanceSimulation(job, receipt('REMOVE_STORAGE', {ok: false}));
  assert.equal(job.status, 'RETRY_REQUIRED'); assert.equal(job.completed.includes('DELETE_AUTH'), false);
  assert.throws(() => advanceSimulation(job, receipt('DELETE_AUTH')), /Out-of-order/);
  job = advanceSimulation(job, receipt('REMOVE_STORAGE')); assert.equal(job.status, 'IN_PROGRESS'); assert.equal(job.attempts.REMOVE_STORAGE, 2);
});
test('bounded failures stop at manual review without fabricating completion', async () => {
  let job = await jobAt(3); for (let i = 0; i < 3; i++) job = advanceSimulation(job, receipt('REMOVE_STORAGE', {ok: false}));
  assert.equal(job.status, 'MANUAL_REVIEW'); assert.equal(job.account_deleted, false);
  assert.throws(() => advanceSimulation(job, receipt('REMOVE_STORAGE')), /Terminal/);
});
test('each phase requires actual synthetic proof fields, not just success', async () => {
  for (let i = 0; i < STEPS.length; i++) {
    const job = await jobAt(i); for (const field of proofFields[STEPS[i]]) {
      const r = receipt(STEPS[i]); delete r.proof[field]; const after = advanceSimulation(job, r);
      assert.equal(after.status, 'RETRY_REQUIRED'); assert.equal(after.completed.length, i);
    }
  }
});
test('Auth absence alone does not report a completed account erasure', async () => {
  const job = await jobAt(6); assert.equal(job.status, 'IN_PROGRESS'); assert.equal(job.account_deleted, false);
  const after = advanceSimulation(job, receipt('RECONCILE', {proof: {database_reconciled: true}}));
  assert.equal(after.status, 'RETRY_REQUIRED'); assert.equal(after.completed.length, 6);
});
test('full reconciliation reaches only simulated completion and safe summaries', async () => {
  const job = await jobAt(7); assert.equal(job.status, 'SIMULATED_COMPLETE'); assert.equal(job.account_deleted, false);
  assert.equal(job.execution_allowed, false); assert.deepEqual(job.completed, STEPS);
  const summary = JSON.stringify(safeSimulationSummary(job)); assert.ok(!summary.includes(ids.owner)); assert.ok(!summary.includes('proof.png'));
});
test('repeated review request is stable but does not claim persisted idempotency', async () => {
  const a = await run(), b = await run(); assert.deepEqual(a, b); assert.equal(a.execution_allowed, false);
  assert.equal(Object.hasOwn(a, 'persisted_request'), false);
});
