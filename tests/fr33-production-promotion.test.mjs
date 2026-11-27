import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  callbackUrl, redirectLegacyAuthLink, requireVerifiedApplicationSession,
} from '../auth-security.js';

const productionUrl = 'https://kttkospkblwvguuwnhjj.supabase.co';
const local = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('production email callbacks keep the live app destination and hand off only supported flows', () => {
  globalThis.MUSHAVO_BUDGET_CONFIG = { supabaseUrl: productionUrl };
  try {
    const callback = new URL(callbackUrl('https://mushavobudget.com/auth.html', 'recover'));
    assert.equal(callback.pathname, '/app.html');
    assert.equal(callback.searchParams.get('securityFlow'), 'recover');
    callback.searchParams.set('code', 'provider-test-code');
    let next;
    assert.equal(redirectLegacyAuthLink(callback.href, 'budget', value => { next = new URL(value); }), true);
    assert.equal(next.pathname, '/auth.html');
    assert.equal(next.searchParams.get('flow'), 'recover');
    assert.equal(next.searchParams.get('code'), 'provider-test-code');
    assert.equal(redirectLegacyAuthLink('https://mushavobudget.com/app?securityFlow=confirm', 'budget', () => {}), false);
  } finally {
    delete globalThis.MUSHAVO_BUDGET_CONFIG;
  }
});

test('password settings use the actual production authorization policy', async () => {
  globalThis.MUSHAVO_BUDGET_CONFIG = { supabaseUrl: productionUrl };
  const user = { id: 'synthetic-user' };
  const session = { user, access_token: 'synthetic-token' };
  function clientWith(policy) {
    return {
      auth: {
        getUser: async () => ({ data: { user }, error: null }),
        getSession: async () => ({ data: { session }, error: null }),
      },
      rpc: async name => {
        assert.equal(name, 'app_session_status');
        return { data: { contract: 1, policy, session_valid: true }, error: null };
      },
    };
  }
  try {
    assert.equal(await requireVerifiedApplicationSession(clientWith('ACTIVE_SUPABASE_SESSION'), user.id), session);
    await assert.rejects(requireVerifiedApplicationSession(clientWith('PASSWORD_ONLY_ALL_USERS'), user.id),
      { code: 'application_session_required' });
  } finally {
    delete globalThis.MUSHAVO_BUDGET_CONFIG;
  }
});

test('promoted settings and retained payment names are wired to production views', () => {
  const app = local('../app.js');
  const business = local('../business.js');
  const account = local('../auth-flows.js');
  assert.match(app, /fr33_family_payment_names\(payer_name,recorder_name\)/);
  assert.match(app, /retained\?\.payer_name/);
  assert.match(app, /retained\?\.recorder_name/);
  assert.match(app, /const form = event.currentTarget;[\s\S]*form\.reset\(\);/);
  assert.match(business, /fr33_bill_payment_names\(recorder_name\)/);
  assert.match(business, /item\.fr33_bill_payment_names\?\.recorder_name/);
  assert.match(account, /if \(settings\.accountDeletionEnabled !== true\) return;/);
  assert.match(local('../app.html'), /data-admin-panel="settings"/);
  assert.match(local('../business.html'), /businessAccountSecurityTitle/);
});
