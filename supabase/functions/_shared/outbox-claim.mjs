const LEASE_MS = 15 * 60 * 1000;
const TABLES = new Set(['notification_outbox', 'admin_notification_outbox']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireClaim(table, job, referenceTime) {
  const claimed = Date.parse(job?.claimed_at);
  const reference = Date.parse(referenceTime);
  if (!TABLES.has(table) || !UUID.test(job?.id || '')
    || !Number.isInteger(job?.attempt_count) || job.attempt_count < 1 || job.attempt_count > 3
    || !Number.isFinite(claimed) || !Number.isFinite(reference)) {
    throw new Error('outbox_claim:invalid_claim');
  }
  if (reference < claimed || reference >= claimed + LEASE_MS) {
    throw new Error('outbox_claim:expired_claim');
  }
  return reference;
}

export function isOutboxClaimLost(error) {
  return error instanceof Error && /^(?:outbox_claim:|outbox_(?:delivery|cancel|result):claim_lost$)/.test(error.message);
}

export async function requireCurrentOutboxClaim(client, table, job, now = () => new Date().toISOString()) {
  requireClaim(table, job, now());
  const { data, error } = await client.from(table)
    .select('id,status,attempt_count,claimed_at').eq('id', job.id).maybeSingle();
  if (error) throw new Error('outbox_delivery:database_error');
  if (data?.id !== job.id || data.status !== 'processing'
    || data.attempt_count !== job.attempt_count
    || Date.parse(data.claimed_at) !== Date.parse(job.claimed_at)) {
    throw new Error('outbox_delivery:claim_lost');
  }
  // A slow lookup must not extend the worker's original lease.
  requireClaim(table, job, now());
}

export async function cancelClaimedOutboxJob(client, table, job, reason, referenceTime = new Date().toISOString()) {
  const reference = requireClaim(table, job, referenceTime);
  const { data, error } = await client.from(table)
    .update({ status: 'cancelled', last_error: String(reason).slice(0, 500) })
    .eq('id', job.id).eq('status', 'processing')
    .eq('attempt_count', job.attempt_count).eq('claimed_at', job.claimed_at)
    .gt('claimed_at', new Date(reference - LEASE_MS).toISOString())
    .lte('claimed_at', referenceTime).select('id').maybeSingle();
  if (error) throw new Error(`outbox_cancel:${error.code || 'database_error'}`);
  if (data?.id !== job.id) throw new Error('outbox_cancel:claim_lost');
}

export async function recordClaimedOutboxResult(client, table, job, succeeded, permanentFailure, errorSummary, referenceTime) {
  requireClaim(table, job, referenceTime);
  const { data, error } = await client.rpc(`record_${table}_result`, {
    p_outbox_id: job.id, p_succeeded: succeeded, p_permanent_failure: permanentFailure,
    p_error: errorSummary, p_reference_time: referenceTime,
    p_expected_attempt_count: job.attempt_count, p_expected_claimed_at: job.claimed_at,
  });
  if (error) throw new Error(`outbox_result:${error.code || 'database_error'}`);
  const row = Array.isArray(data) && data.length === 1 ? data[0] : data;
  const status = succeeded ? 'sent' : permanentFailure || job.attempt_count >= 3 ? 'failed' : 'retry';
  if (row?.id !== job.id || row.attempt_count !== job.attempt_count || row.status !== status) {
    throw new Error('outbox_result:claim_lost');
  }
}
