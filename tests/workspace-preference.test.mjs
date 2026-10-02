import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../workspace-preference.js', import.meta.url), 'utf8');
const idA = '11111111-1111-4111-8111-111111111111', idB = '22222222-2222-4222-8222-222222222222';
const familyId = '33333333-3333-4333-8333-333333333333';
const business = id => ({ id, workspace_type: 'business' });
function runtime({ store = new Map(), native, blocked = false, href = 'https://mushavobudget.com/app.html' } = {}) {
  const window = { location: { href }, localStorage: {
    getItem(key) { if (blocked) throw Error('disabled'); return store.get(key) || null; },
    setItem(key, value) { if (blocked) throw Error('disabled'); store.set(key, value); }
  }, MushavoNativeWorkspace: native };
  vm.runInNewContext(source, { window, URL, Map, Date, JSON, Number, Promise });
  return { api: window.MushavoWorkspace, store };
}

test('cold launch remembers the exact Business per account and per device', () => {
  const phone = runtime(), pc = runtime();
  phone.api.remember('owner', business(idA));
  phone.api.remember('staff', business(idB));
  pc.api.remember('owner', { workspace_type: 'personal' });
  const reopened = runtime({ store: phone.store });
  assert.equal(reopened.api.startup('owner').id, idA);
  assert.equal(reopened.api.startup('staff').id, idB);
  assert.equal(pc.api.startup('owner').kind, 'personal');
  assert.equal(reopened.api.startup('outsider'), null);
});
test('Personal and exact Family are stored without financial or session data', () => {
  const { api, store } = runtime();
  api.remember('owner', { id: idA, workspace_type: 'household', legacy_family_id: familyId, name: 'Private company', access_token: 'secret' });
  assert.equal(api.read('owner').familyId, familyId);
  assert.doesNotMatch([...store.values()].join(''), /Private company|secret/);
  api.remember('owner', { id: idB, workspace_type: 'personal' });
  assert.equal(api.startup('owner').kind, 'personal');
});
test('guest, corrupt, unsupported and unsafe workspace preferences are ignored', () => {
  const { api, store } = runtime();
  assert.equal(api.remember('guest', business(idA)), false);
  assert.equal(api.remember('owner', business('https://evil.test')), false);
  assert.equal(api.remember('owner', { workspace_type: 'household', id: idA }), false);
  for (const value of ['not json', '{}', '{"version":99,"kind":"personal"}', '{"version":1,"kind":"business","id":"../app.html","savedAt":1}']) {
    store.set('mushavo-budget:last-workspace:owner', value);
    assert.equal(api.startup('owner'), null);
  }
});
test('notification, invitation, checkout and explicit navigation take precedence', () => {
  const { api } = runtime(); api.remember('owner', business(idA));
  for (const target of ['#personal/payments', '#family/members', '#admin/finance', '?source=push&workspace='+idB, '?plan=business', '?invitation_id='+idB, '?code=auth-code', '?bill='+idB]) {
    assert.equal(api.startup('owner', 'https://mushavobudget.com/app.html'+target), null, target);
  }
  assert.equal(api.startup('owner', 'https://mushavobudget.com/app.html?source=pwa&auth=expired').id, idA);
});
test('storage rejection cannot prevent opening or remembering the workspace in memory', async () => {
  const { api } = runtime({ blocked: true });
  assert.equal(api.remember('owner', business(idA)), true);
  assert.equal((await api.hydrate('owner')).id, idA);
});
test('native preferences restore after WebView local storage is cleared', async () => {
  const nativeStore = new Map();
  const Preferences = { async get({ key }) { return { value: nativeStore.get(key) }; }, async set({ key, value }) { nativeStore.set(key, value); } };
  const first = runtime({ native: { Preferences } });
  first.api.remember('owner', business(idA)); await first.api.flush();
  const reopened = runtime({ native: { Preferences } });
  assert.equal((await reopened.api.hydrate('owner')).id, idA);
  assert.equal((await reopened.api.hydrate('other')), null);
});
test('rapid native writes stay ordered and use the latest selection', async () => {
  const writes = [];
  const { api } = runtime({ native: { Preferences: { async set({ value }) { writes.push(JSON.parse(value)); await Promise.resolve(); } } } });
  api.remember('owner', business(idA)); api.remember('owner', business(idB)); await api.flush();
  assert.deepEqual(writes.map(item => item.id), [idA, idB]);
  assert.ok(writes[1].savedAt > writes[0].savedAt);
});
test('a delayed native read cannot overwrite a newly selected workspace', async () => {
  let finish, started;
  const reading = new Promise(resolve => { started = resolve; });
  const old = JSON.stringify({ version: 1, kind: 'business', id: idA, savedAt: Date.now()+100000 });
  const { api } = runtime({ native: { Preferences: { get: () => new Promise(resolve => { finish = resolve; started(); }), async set() {} } } });
  const hydration = api.hydrate('owner'); await reading;
  api.remember('owner', business(idB)); finish({ value: old }); await hydration;
  assert.equal(api.read('owner').id, idB);
});
test('bridge failures retain the saved selection and native resume only rechecks access', async () => {
  let listener, resumed = 0;
  const { api } = runtime({ native: { Preferences: { async get() { throw Error('bridge'); }, async set() { throw Error('bridge'); } }, App: { async addListener(name, callback) { assert.equal(name, 'appStateChange'); listener = callback; } } } });
  api.remember('owner', business(idA)); await api.flush(); await api.hydrate('owner');
  api.onResume(() => resumed++); listener({ isActive: false }); listener({ isActive: true });
  assert.equal(resumed, 1); assert.equal(api.read('owner').id, idA);
});
test('restoration URLs stay on the current application origin and open dashboards', () => {
  const { api } = runtime({ href: 'https://localhost/app.html' });
  const businessURL = new URL(api.restoredBusinessUrl(idA));
  assert.equal(businessURL.origin, 'https://localhost'); assert.equal(businessURL.hash, '#business/overview');
  assert.equal(businessURL.searchParams.get('restore_workspace'), '1');
  assert.equal(new URL(api.personalFallbackUrl()).hash, '#personal/dashboard');
});
