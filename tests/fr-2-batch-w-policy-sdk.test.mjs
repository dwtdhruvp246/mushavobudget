// Actual pinned SDK modules; synthetic Auth transport only, no real account/session.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadFullAppSDK} from '../scripts/lib/full-app-sdk-fixture.mjs';
const actor = '11111111-1111-4111-8111-111111111111';
async function sdk(response) {
  const graph = await loadFullAppSDK(), calls = [];
  const synthetic = async (input, options = {}) => {
    const url = String(input); assert.equal(url, 'https://synthetic.invalid/auth/v1/token?grant_type=password');
    assert.equal(options.method, 'POST'); calls.push(JSON.parse(options.body));
    return response();
  };
  const context = vm.createContext({URL, URLSearchParams, Headers, Response, Request, AbortController,
    TextEncoder, TextDecoder, setTimeout, clearTimeout, setInterval, clearInterval,
    WebSocket: class { constructor() { throw Error('UNEXPECTED_SYNTHETIC_SOCKET'); } },
    console: {log() {}, warn() {}, error() {}}, fetch: synthetic});
  const modules = new Map([...graph.modules].map(([url, row]) => [url, new vm.SourceTextModule(row.bytes.toString(), {
    identifier: url, context, importModuleDynamically() { throw Error('DYNAMIC_IMPORT_NOT_AUTHORIZED'); }
  })]));
  const root = modules.get(graph.entry);
  await root.link((specifier, referencing) => {
    const target = modules.get(new URL(specifier, referencing.identifier).href);
    assert(target); return target;
  });
  await root.evaluate();
  const client = root.namespace.createClient('https://synthetic.invalid', 'sb_publishable_SYNTHETIC_ONLY', {
    auth: {persistSession: false, autoRefreshToken: false, detectSessionInUrl: false},
    global: {fetch: synthetic}
  });
  await client.auth.initialize();
  return {client, calls};
}

test('actual pinned SDK accepts a synthetic successful older six-character login with a strength advisory', async () => {
  const h = await sdk(() => Response.json({access_token: 'synthetic-access', refresh_token: 'synthetic-refresh',
    token_type: 'bearer', expires_in: 3600, user: {id: actor, email: 'synthetic@example.invalid'},
    weak_password: {message: 'SYNTHETIC_STRENGTH_ADVISORY', reasons: ['length']}}));
  const result = await h.client.auth.signInWithPassword({email: 'synthetic@example.invalid', password: 'Old123'});
  assert.equal(result.error, null); assert.equal(result.data.session.user.id, actor);
  assert.equal(result.data.weakPassword.reasons[0], 'length');
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].password, 'Old123');
  await h.client.auth.stopAutoRefresh();
});

test('actual pinned SDK retains password rejection without returning a session', async () => {
  const h = await sdk(() => Response.json({code: 'invalid_credentials', msg: 'Synthetic rejection'}, {
    status: 400, headers: {'X-Supabase-Api-Version': '2024-01-01'}
  }));
  const result = await h.client.auth.signInWithPassword({email: 'synthetic@example.invalid', password: 'Wrong1'});
  assert.equal(result.error.code, 'invalid_credentials'); assert.equal(result.data.session, null);
  assert.equal(h.calls.length, 1); await h.client.auth.stopAutoRefresh();
});
