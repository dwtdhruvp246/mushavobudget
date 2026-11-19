// Offline review candidate only. No Auth, database, Storage, HTTP or filesystem adapter.
// Inputs from verifySession/loadSnapshot are trusted fixture ports, NEVER browser claims.
export const STAGING_PROJECT = 'dczlddwbtgvfdujgcitb';
export const CATEGORIES = Object.freeze(['identity', 'personal', 'shared_finance', 'invitations_support',
  'telemetry_devices', 'storage', 'processors_backups', 'completion_record']);
export const STEPS = Object.freeze(['CAPTURE_MANIFEST', 'REVOKE_ACCESS', 'RESOLVE_OWNERSHIP',
  'REMOVE_STORAGE', 'RESOLVE_DATA', 'DELETE_AUTH', 'RECONCILE']);
// Proposed verification/snapshot/retry bounds for the model, not adopted product policy.
export const RECENT_VERIFICATION_MS = 5 * 60_000;
export const SNAPSHOT_AGE_MS = 60_000;
export const MAX_ATTEMPTS = 3;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = x => typeof x === 'string' && uuid.test(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const record = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const plain = x => record(x) && [Object.prototype, null].includes(Object.getPrototypeOf(x));
const freeze = x => { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
const result = (status, reasons, plan = null) => freeze({scope: 'OFFLINE_REVIEW_MODEL', status,
  reasons: [...new Set(reasons)].sort(), execution_allowed: false, account_deleted: false,
  hosted_acceptance: false, plan});
const validIdentity = (identity, time) => Number.isFinite(time) && record(identity)
  && identity.source === 'SERVER_VERIFIED' && isUuid(identity.user_id) && isUuid(identity.session_id)
  && identity.session_active === true && Number.isFinite(identity.expires_at_ms) && identity.expires_at_ms > time
  && Number.isFinite(identity.verified_at_ms) && identity.verified_at_ms <= time
  && time - identity.verified_at_ms <= RECENT_VERIFICATION_MS;

function decisionProblems(decisions) {
  const reasons = [];
  if (!record(decisions) || decisions.approved !== true || decisions.operator_facts_verified !== true)
    reasons.push('RETENTION_DECISIONS_REQUIRED');
  for (const name of CATEGORIES) {
    const d = decisions?.categories?.[name];
    if (!record(d) || d.approved !== true || !['delete', 'anonymize', 'retain', 'mixed'].includes(d.disposition)
      || !text(d.decision_id) || !text(d.purpose) || !text(d.grounds) || !text(d.expiry_rule)
      || !text(d.access_rule) || !text(d.notice_version)) reasons.push('CATEGORY_DECISION_REQUIRED:' + name);
  }
  return reasons;
}

function ownershipProblems(workspaces, subject) {
  if (!Array.isArray(workspaces)) return ['OWNERSHIP_INVENTORY_REQUIRED'];
  const reasons = [], ids = new Set();
  for (const w of workspaces) {
    if (!record(w) || !isUuid(w.id) || ids.has(w.id)
      || !['personal', 'family', 'business'].includes(w.kind) || !['owner', 'member'].includes(w.role)
      || !text(w.version)) { reasons.push('INVALID_OWNERSHIP_INVENTORY'); continue; }
    ids.add(w.id);
    if (w.resolution_approved !== true || w.current_guard_satisfied !== true) {
      reasons.push('OWNERSHIP_RESOLUTION_REQUIRED'); continue;
    }
    if (w.role === 'member') {
      if (w.kind === 'personal' || w.resolution !== 'leave') reasons.push('INVALID_MEMBER_RESOLUTION');
      continue;
    }
    if (w.resolution === 'close') {
      if (w.kind !== 'personal' && w.shared_closure_approved !== true) reasons.push('SHARED_CLOSURE_REQUIRES_REVIEW');
    } else if (w.resolution === 'transfer' && w.kind !== 'personal') {
      const s = w.successor;
      if (!record(s) || !isUuid(s.id) || s.id === subject || s.active_member !== true
        || s.registered !== true || s.active_account !== true || s.non_platform !== true)
        reasons.push('INVALID_SUCCESSOR');
      if (w.kind === 'family' && w.guarded_transfer_candidate_reviewed !== true)
        reasons.push('HOUSEHOLD_TRANSFER_NOT_IMPLEMENTED');
    } else reasons.push('INVALID_OWNER_RESOLUTION');
  }
  return reasons;
}

function validPath(value) {
  if (!text(value) || value.length > 1024 || /[\\\u0000-\u001f\u007f]/.test(value)) return false;
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..')) return false;
  // Ambiguous URL-encoded separators/traversal need authoritative API handling, not a guessed path.
  return !/%(?:2e|2f|5c|00)/i.test(value);
}
function fileProblems(objects, subject, decisions) {
  if (!Array.isArray(objects)) return ['FILE_MANIFEST_REQUIRED'];
  const reasons = [], keys = new Set();
  for (const f of objects) {
    if (!record(f) || !/^[a-z0-9][a-z0-9_-]{0,62}$/.test(f.bucket || '') || !validPath(f.path)
      || !['own', 'shared'].includes(f.scope) || !['delete', 'retain', 'transfer'].includes(f.disposition)
      || !isUuid(f.storage_owner_id)) { reasons.push('INVALID_OR_FOREIGN_OBJECT'); continue; }
    const key = f.bucket + '\u0000' + f.path;
    if (keys.has(key)) reasons.push('DUPLICATE_OBJECT');
    keys.add(key);
    if (f.scope === 'own' && f.storage_owner_id !== subject) reasons.push('OBJECT_OWNER_MISMATCH');
    if (f.storage_owner_id !== subject && f.disposition !== 'retain') reasons.push('FOREIGN_OBJECT_MUTATION');
    if (f.scope === 'shared' && f.disposition !== 'retain' && f.shared_action_approved !== true)
      reasons.push('SHARED_OBJECT_ACTION_UNAPPROVED');
    const d = decisions?.categories?.storage;
    if (f.decision_id !== d?.decision_id) reasons.push('OBJECT_DECISION_MISMATCH');
    if (f.disposition === 'retain' && (!['retain', 'mixed'].includes(d?.disposition)
      || !text(f.retention_rule))) reasons.push('OBJECT_RETENTION_UNAPPROVED');
    if (f.disposition === 'retain' && f.storage_owner_id === subject)
      reasons.push('RETAINED_OBJECT_STILL_OWNED_BY_DEPARTING_USER');
    if (f.disposition === 'transfer' && (!isUuid(f.transfer_owner_id)
      || f.transfer_owner_id === subject || f.transfer_approved !== true || f.transfer_owner_verified !== true
      || !['retain', 'mixed'].includes(d?.disposition))) reasons.push('OBJECT_TRANSFER_UNAPPROVED');
    if (f.disposition === 'delete' && !['delete', 'mixed'].includes(d?.disposition))
      reasons.push('OBJECT_DELETION_UNAPPROVED');
  }
  return reasons;
}

export function createLifecycleReviewer({verifySession, loadSnapshot, decisions, now = Date.now}) {
  if (typeof verifySession !== 'function' || typeof loadSnapshot !== 'function' || typeof now !== 'function')
    throw new TypeError('Trusted fixture ports and a clock are required.');
  return async function review(request, bearerToken) {
    if (!plain(request) || Object.keys(request).some(k => !['confirmation', 'request_id'].includes(k))
      || !isUuid(request.request_id) || request.confirmation !== 'DELETE MY ACCOUNT')
      return result('DENIED', ['INVALID_SELF_REQUEST']);
    if (!text(bearerToken)) return result('DENIED', ['VERIFIED_SELF_IDENTITY_REQUIRED']);
    let identity;
    try { identity = await verifySession(bearerToken); } catch { return result('DENIED', ['IDENTITY_VERIFICATION_UNAVAILABLE']); }
    if (!validIdentity(identity, now()))
      return result('DENIED', ['VERIFIED_RECENT_SELF_IDENTITY_REQUIRED']);
    let snapshot;
    try { snapshot = await loadSnapshot(identity.user_id); } catch { return result('BLOCKED', ['SNAPSHOT_UNAVAILABLE']); }
    const time = now();
    if (!validIdentity(identity, time)) return result('DENIED', ['VERIFIED_RECENT_SELF_IDENTITY_REQUIRED']);
    if (!record(snapshot) || snapshot.subject_id !== identity.user_id || snapshot.project !== STAGING_PROJECT
      || snapshot.source !== 'SERVER_ENUMERATED' || !text(snapshot.revision)
      || !Number.isFinite(snapshot.captured_at_ms) || snapshot.captured_at_ms > time
      || time - snapshot.captured_at_ms > SNAPSHOT_AGE_MS)
      return result('BLOCKED', ['CURRENT_SCOPED_SNAPSHOT_REQUIRED']);
    const reasons = decisionProblems(decisions);
    for (const [key, reason] of Object.entries({database_inventory_complete: 'DATABASE_INVENTORY_INCOMPLETE',
      storage_inventory_complete: 'STORAGE_INVENTORY_INCOMPLETE', copied_identity_inventory_complete: 'COPIED_IDENTITY_INVENTORY_INCOMPLETE',
      history_integrity_verified: 'FINANCIAL_HISTORY_UNVERIFIED', source_parity_verified: 'SOURCE_PARITY_UNVERIFIED',
      recovery_verified: 'RECOVERY_UNVERIFIED', provider_lifecycle_verified: 'PROVIDER_LIFECYCLE_UNVERIFIED',
      residual_access_controls_verified: 'RESIDUAL_ACCESS_UNVERIFIED'})) if (snapshot[key] !== true) reasons.push(reason);
    reasons.push(...ownershipProblems(snapshot.workspaces, identity.user_id), ...fileProblems(snapshot.objects, identity.user_id, decisions));
    if (reasons.length) return result('BLOCKED', reasons);
    const plan = {request_id: request.request_id, subject_id: identity.user_id, revision: snapshot.revision,
      project: STAGING_PROJECT, category_decisions: structuredClone(decisions.categories),
      workspaces: structuredClone(snapshot.workspaces), objects: structuredClone(snapshot.objects),
      steps: [...STEPS]};
    return result('REVIEW_READY', [], plan);
  };
}

export function safeReviewSummary(review) {
  return {scope: review.scope, status: review.status, reasons: [...review.reasons], execution_allowed: false,
    account_deleted: false, hosted_acceptance: false, workspace_count: review.plan?.workspaces.length ?? 0,
    object_count: review.plan?.objects.length ?? 0};
}

// Pure state simulation. Receipts/ports are synthetic; no durable job or actual effect is implemented.
export function startSimulation(review) {
  if (review?.status !== 'REVIEW_READY' || !review.plan || review.execution_allowed !== false)
    throw new Error('A complete offline review plan is required.');
  return freeze({scope: 'OFFLINE_STATE_SIMULATION', status: 'PLANNED', plan: structuredClone(review.plan),
    completed: [], attempts: {}, account_deleted: false, execution_allowed: false});
}
const proofs = Object.freeze({CAPTURE_MANIFEST: ['durable_manifest_acknowledged'], REVOKE_ACCESS: ['access_gate_confirmed'],
  RESOLVE_OWNERSHIP: ['ownership_resolved'], REMOVE_STORAGE: ['bytes_removed_or_approved_transfer_verified', 'departing_storage_owner_empty'],
  RESOLVE_DATA: ['approved_data_actions_verified', 'financial_history_preserved'], DELETE_AUTH: ['auth_absent_verified'],
  RECONCILE: ['database_reconciled', 'storage_reconciled', 'provider_reconciled', 'backup_treatment_documented',
    'residual_access_window_documented', 'only_approved_retention_remains']});

export function advanceSimulation(job, receipt) {
  if (job?.scope !== 'OFFLINE_STATE_SIMULATION' || !record(receipt) || !STEPS.includes(receipt.step))
    throw new Error('Invalid simulation input.');
  if (receipt.request_id !== job.plan.request_id || receipt.subject_id !== job.plan.subject_id
    || receipt.revision !== job.plan.revision || receipt.current_revision !== job.plan.revision
    || receipt.current_guards_verified !== true || receipt.operation_id !== job.plan.request_id + '/' + receipt.step)
    throw new Error('Receipt identity, revision or operation does not match.');
  if (job.completed.includes(receipt.step)) return job; // Confirmed operation replay; no duplicate effect.
  if (job.status === 'MANUAL_REVIEW' || job.status === 'SIMULATED_COMPLETE') throw new Error('Terminal simulation.');
  if (receipt.step !== STEPS[job.completed.length]) throw new Error('Out-of-order effect.');
  const next = structuredClone(job);
  next.attempts[receipt.step] = (next.attempts[receipt.step] || 0) + 1;
  const verified = receipt.ok === true && proofs[receipt.step].every(p => receipt.proof?.[p] === true);
  if (!verified) { next.status = next.attempts[receipt.step] >= MAX_ATTEMPTS ? 'MANUAL_REVIEW' : 'RETRY_REQUIRED'; }
  else { next.completed.push(receipt.step); next.status = next.completed.length === STEPS.length ? 'SIMULATED_COMPLETE' : 'IN_PROGRESS'; }
  return freeze(next);
}

export function safeSimulationSummary(job) {
  return {scope: job.scope, status: job.status, completed_steps: [...job.completed], attempts: {...job.attempts},
    account_deleted: false, execution_allowed: false, hosted_acceptance: false};
}
