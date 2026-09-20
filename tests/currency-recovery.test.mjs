import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { currencyApiUrl, providerFailure, normalizeCurrencyApiPayload, crossRate } from '../supabase/functions/_shared/currencyapi.ts';

const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
test('latest request uses default USD without optional validation filters', () => {
  assert.equal(String(currencyApiUrl()), 'https://api.currencyapi.com/v3/latest');
  assert.equal(currencyApiUrl('2026-09-01').searchParams.get('date'), '2026-09-01');
});
test('provider errors expose only allowlisted validation fields, never raw values', () => {
  const message = providerFailure(422, { message: 'secret-value', errors: { apikey: ['secret-value'], 'secret-field': ['secret-value'] } });
  assert.match(message, /422.*apikey/);
  assert.doesNotMatch(message, /secret/);
  assert.match(providerFailure(429, null), /quota/);
});
test('monetary results round to two decimals while rates retain precision', () => {
  const source = app.slice(app.indexOf('function money('), app.indexOf('const DECIMAL_SCALE_DIGITS'));
  const context = { Intl, currencyNames: {}, Number };
  vm.runInNewContext(source, context);
  assert.equal(context.money(1.235, 'USD'), 'USD 1.24');
  assert.equal(context.money(1, 'JPY'), 'JPY 1.00');
  assert.equal(context.money(1.2345, 'KWD'), 'KWD 1.23');
  const result = normalizeCurrencyApiPayload({ meta: { last_updated_at: '2026-09-20T00:00:00Z' }, data: { INR: {code: 'INR', value: 84.123456} } }, ['USD','INR']);
  assert.equal(result.rates[1].rate, '84.123456');
  assert.ok(Math.abs(crossRate(84, 1) - 1/84) < 1e-12);
});
test('manual sync uses refreshed auth and extracts the safe server error', () => {
  const source = app.slice(app.indexOf('async function syncExchangeRates()'), app.indexOf('function renderAdminPlans()'));
  assert.match(source, /refreshSessionForProtectedFunction/);
  assert.match(source, /Authorization/);
  assert.match(source, /payload\?\.error/);
});
