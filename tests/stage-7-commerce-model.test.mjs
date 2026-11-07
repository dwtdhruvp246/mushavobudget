import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeSnapshot, projectAccess} from '../scripts/lib/stage-7-commerce-model.mjs';
const binding = {provider: 'google_play', environment: 'sandbox', application: 'synthetic.app',
  account: 'actor-A', workspace: 'workspace-A', intent: 'intent-A'};
const catalog = [{...binding, product: 'synthetic.family.monthly', plan: 'family', cycle: 'monthly', seats: 4}];
const snapshot = {...binding, product: catalog[0].product, chain: 'chain-A', transaction: 'tx-A', sequence: 1,
  startsAt: 100, endsAt: 200, state: 'active'};
const input = () => ({request: {proofReference: 'synthetic-reference'}, binding: structuredClone(binding),
  catalog: structuredClone(catalog), expectedRevision: 0});
const propose = (s = snapshot, i = input()) => proposeSnapshot(i, async () => structuredClone(s));
const record = async s => (await propose(s)).record;

test('adapter missing/failing yields no proposal; no client fallback', async () => {
  await assert.rejects(proposeSnapshot(input()), /unavailable/);
  await assert.rejects(proposeSnapshot(input(), async () => { throw Error('provider unavailable'); }), /unavailable/);
});
test('client verified flags, price, plan or owner cannot authorize a snapshot', async () => {
  for (const [key, value] of Object.entries({verified: true, price: 0, plan: 'business', account: 'actor-B', receipt: snapshot})) {
    const i = input(); i.request[key] = value;
    let called = false;
    await assert.rejects(proposeSnapshot(i, async () => { called = true; return snapshot; }), /client authority/);
    assert.equal(called, false);
  }
});
test('each account/workspace/intent/provider/environment/application mismatch is denied', async () => {
  for (const key of Object.keys(binding)) await assert.rejects(propose({...snapshot, [key]: 'foreign'}), /binding/);
});
test('unknown and duplicated catalog identities are denied', async () => {
  await assert.rejects(propose({...snapshot, product: 'unknown'}), /product/);
  const i = input(); i.catalog.push({...catalog[0], seats: 99}); await assert.rejects(propose(snapshot, i), /ambiguous/);
});
test('server mapping supplies plan/cycle/seats, with no client money conversion', async () => {
  const r = await record(); assert.deepEqual(r.product, {plan: 'family', cycle: 'monthly', seats: 4});
  assert.deepEqual(projectAccess(r, null, {now: 150}), {outcome: 'STORE_MODEL', access: true,
    plan: 'family', cycle: 'monthly', seats: 4, endsAt: 200});
});
test('malformed term/sequence/state and unmapped grace fail closed', async () => {
  for (const patch of [{endsAt: 100}, {startsAt: -1}, {endsAt: NaN}, {sequence: 0}, {sequence: 1.5},
    {state: 'grace'}, {chain: ''}, {transaction: null}]) await assert.rejects(propose({...snapshot, ...patch}));
});
test('invalid plan/cycle/capacity cannot become entitlement', async () => {
  for (const patch of [{plan: 'admin'}, {cycle: 'forever'}, {seats: 0}, {seats: 1.5}, {seats: '4'}]) {
    const i = input(); Object.assign(i.catalog[0], patch); await assert.rejects(propose(snapshot, i));
  }
});
test('accepted proposal detaches mutable caller and adapter objects', async () => {
  const i = input(), s = structuredClone(snapshot);
  const result = await proposeSnapshot(i, async context => { assert.equal(Object.isFrozen(context), true); return s; });
  s.endsAt = 999; i.catalog[0].seats = 999;
  assert.equal(result.record.snapshot.endsAt, 200); assert.equal(result.record.product.seats, 4);
});
test('retry is idempotent and does not add a second paid term', async () => {
  const prior = await record(); const i = {...input(), prior, expectedRevision: prior.revision};
  const r = await propose(snapshot, i); assert.equal(r.outcome, 'UNCHANGED'); assert.deepEqual(r.record, prior);
});
test('refresh of unchanged window advances watermark without extending access', async () => {
  const prior = await record(); const r = await propose({...snapshot, sequence: 5}, {...input(), prior, expectedRevision: 1});
  assert.equal(r.outcome, 'UNCHANGED'); assert.equal(r.record.snapshot.endsAt, 200); assert.equal(r.record.revision, 2);
  const stale = await propose({...snapshot, sequence: 3, state: 'hold'}, {...input(), prior: r.record, expectedRevision: 2});
  assert.equal(stale.outcome, 'STALE'); assert.deepEqual(stale.record, r.record);
});
test('renewal replaces authoritative window instead of adding client days', async () => {
  const prior = await record(); const r = await propose({...snapshot, sequence: 2, transaction: 'tx-B', startsAt: 200, endsAt: 300},
    {...input(), prior, expectedRevision: 1});
  assert.equal(r.record.snapshot.endsAt, 300); assert.equal(r.record.revision, 2);
  assert.equal(projectAccess(r.record, null, {now: 199}).access, false);
});
test('same sequence with different purchase facts is a conflict', async () => {
  const prior = await record(); await assert.rejects(propose({...snapshot, state: 'revoked'}, {...input(), prior, expectedRevision: 1}), /conflicting/);
  assert.equal(prior.snapshot.state, 'active');
});
test('revision mismatch rejects proposal; caller must implement durable compare-and-swap', async () => {
  const prior = await record(); await assert.rejects(propose(snapshot, {...input(), prior, expectedRevision: 0}), /revision/);
  await assert.rejects(propose(snapshot, {...input(), expectedRevision: 1}), /revision/);
});
test('foreign stored binding or changed chain cannot transfer an entitlement', async () => {
  const prior = await record(); await assert.rejects(propose({...snapshot, sequence: 2, chain: 'chain-B'}, {...input(), prior, expectedRevision: 1}), /transfer/);
  prior.snapshot.workspace = 'workspace-B'; await assert.rejects(propose(snapshot, {...input(), prior, expectedRevision: 1}), /binding/);
});
test('cancellation preserves paid window; expiry boundary excludes access', async () => {
  const r = await record({...snapshot, state: 'canceled_paid'});
  assert.equal(projectAccess(r, null, {now: 100}).access, true);
  assert.equal(projectAccess(r, null, {now: 199}).access, true);
  assert.equal(projectAccess(r, null, {now: 200}).access, false);
  assert.equal(projectAccess(r, null, {now: 99}).access, false);
});
test('pending, hold, expired and revoked snapshots never grant store access', async () => {
  for (const state of ['pending', 'hold', 'expired', 'revoked']) {
    assert.equal(projectAccess(await record({...snapshot, state}), null, {now: 150}).access, false);
  }
});
test('refund/revocation projection preserves independent manual source and original records', async () => {
  const r = await record({...snapshot, state: 'revoked'}), manual = {startsAt: 100, endsAt: 220, audit: 'manual-grant'};
  const before = structuredClone({r, manual});
  assert.deepEqual(projectAccess(r, manual, {now: 150}), {outcome: 'EXISTING_MANUAL_SOURCE', access: true});
  assert.deepEqual({r, manual}, before);
});
test('overlapping sources require decision; no last-writer precedence or seat merge', async () => {
  const r = await record(), manual = {startsAt: 100, endsAt: 300, seats: 99};
  assert.deepEqual(projectAccess(r, manual, {now: 150}), {outcome: 'REVIEW_SOURCE_PRECEDENCE', access: null});
});
test('suspension cannot be removed by either payment source', async () => {
  assert.deepEqual(projectAccess(await record(), {startsAt: 100, endsAt: 300}, {now: 150, suspended: true}),
    {outcome: 'SUSPENDED', access: false});
});
test('Apple fixture follows same binding boundary, without claiming JWS verification', async () => {
  const i = input(); i.binding.provider = 'apple_app_store'; i.catalog[0].provider = 'apple_app_store';
  const r = await propose({...snapshot, provider: 'apple_app_store'}, i);
  assert.equal(r.record.snapshot.provider, 'apple_app_store');
  await assert.rejects(propose(snapshot, i), /binding/);
});
