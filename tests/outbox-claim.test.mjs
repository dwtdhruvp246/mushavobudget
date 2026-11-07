import assert from 'node:assert/strict';
import test from 'node:test';
import { cancelClaimedOutboxJob, recordClaimedOutboxResult } from '../supabase/functions/_shared/outbox-claim.mjs';

const job = { id: '11111111-1111-4111-8111-111111111111', attempt_count: 2, claimed_at: '2026-11-07T06:00:00.000Z' };
const at = '2026-11-07T06:01:00.000Z';

for (const table of ['notification_outbox', 'admin_notification_outbox']) {
  test(`${table}: completion submits and verifies the exact lease`, async () => {
    const client = { async rpc(name, args) {
      assert.equal(name, `record_${table}_result`);
      assert.equal(args.p_expected_attempt_count, 2);
      assert.equal(args.p_expected_claimed_at, job.claimed_at);
      return { data: { id: job.id, attempt_count: 2, status: 'sent' }, error: null };
    } };
    await recordClaimedOutboxResult(client, table, job, true, false, null, at);
  });
  test(`${table}: lost lease cannot count as a successful completion`, async () => {
    await assert.rejects(recordClaimedOutboxResult({ rpc: async () => ({ data: null, error: null }) }, table, job, true, false, null, at), /claim_lost/);
  });
  test(`${table}: cancellation is conditional on the exact current lease`, async () => {
    const filters = [];
    const query = { update(value) { assert.equal(value.status, 'cancelled'); return this; },
      eq(key, value) { filters.push([key, value]); return this; },
      gt(key, value) { filters.push(['gt', key, value]); return this; },
      lte(key, value) { filters.push(['lte', key, value]); return this; },
      select(columns) { assert.equal(columns, 'id'); return this; },
      async maybeSingle() { return { data: { id: job.id }, error: null }; } };
    await cancelClaimedOutboxJob({ from(name) { assert.equal(name, table); return query; } }, table, job, 'Synthetic cancellation', at);
    assert.ok(filters.some(([key, value]) => key === 'attempt_count' && value === job.attempt_count));
    assert.ok(filters.some(([key, value]) => key === 'claimed_at' && value === job.claimed_at));
    assert.ok(filters.some(([key]) => key === 'gt'));
    assert.ok(filters.some(([key]) => key === 'lte'));
  });
  test(`${table}: missing, expired and future leases make no database calls`, async () => {
    const client = new Proxy({}, { get() { throw new Error('unexpected database call'); } });
    for (const variant of [{ ...job, attempt_count: undefined }, { ...job, claimed_at: '2026-11-07T05:00:00Z' }, { ...job, claimed_at: '2026-11-07T07:00:00Z' }]) {
      await assert.rejects(recordClaimedOutboxResult(client, table, variant, true, false, null, at), /outbox_claim:/);
      await assert.rejects(cancelClaimedOutboxJob(client, table, variant, 'Synthetic cancellation', at), /outbox_claim:/);
    }
  });
  test(`${table}: cancellation of a superseded claim is reported as lost`, async () => {
    const query = { update() { return this; }, eq() { return this; }, gt() { return this; }, lte() { return this; }, select() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
    await assert.rejects(cancelClaimedOutboxJob({ from() { return query; } }, table, job, 'Synthetic cancellation', at), /claim_lost/);
  });
}
