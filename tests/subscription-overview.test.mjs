import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const helpers = app.slice(app.indexOf('function formatSubscriptionDate('), app.indexOf('function renderSubscription()'));

function subscriptionHelpers(history = []) {
  const context = { Date, Number, state: { entitlementHistory: history } };
  vm.runInNewContext(helpers, context);
  return context;
}

test('subscription start uses the first approved purchase, not the date a Free workspace was created', () => {
  const subscription = {
    workspace_id: 'personal-1', billing_period: 'annual',
    entitlement_start_at: '2025-01-01T00:00:00Z', billing_anchor_at: '2026-09-01T00:00:00Z'
  };
  const { subscriptionStartDate } = subscriptionHelpers([
    { workspace_id: 'personal-1', reason: 'Approved subscription payment later', effective_from: '2027-09-01T00:00:00Z' },
    { workspace_id: 'another-workspace', reason: 'Approved subscription payment other', effective_from: '2024-01-01T00:00:00Z' },
    { workspace_id: 'personal-1', reason: 'Approved subscription payment first', effective_from: '2026-09-01T00:00:00Z' }
  ]);
  assert.equal(subscriptionStartDate(subscription), '2026-09-01T00:00:00Z');
  assert.equal(subscriptionHelpers().subscriptionStartDate(subscription), '2026-09-01T00:00:00Z');
  assert.equal(subscriptionStartDate({ ...subscription, billing_period: null }), null);
});

test('expiry countdown uses the actual expiry instant, including the last day', () => {
  const { subscriptionTimeRemaining } = subscriptionHelpers();
  const now = new Date('2026-09-25T12:00:00Z');
  assert.equal(subscriptionTimeRemaining(null, now), 'No expiry');
  assert.equal(subscriptionTimeRemaining('2026-09-28T12:00:00Z', now), '3 days left');
  assert.equal(subscriptionTimeRemaining('2026-09-26T11:59:59Z', now), 'Less than 1 day left');
  assert.equal(subscriptionTimeRemaining('2026-09-25T11:59:59Z', now), 'Expired');
});
