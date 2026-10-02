import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const businessSource = readFileSync(new URL('../business.js', import.meta.url), 'utf8');
const preference = readFileSync(new URL('../workspace-preference.js', import.meta.url), 'utf8');
const idA = '11111111-1111-4111-8111-111111111111', idB = '22222222-2222-4222-8222-222222222222', familyId = '33333333-3333-4333-8333-333333333333';
const personal = { id: idB, workspace_type: 'personal', owner_id: 'owner', status: 'active' };
const family = { id: idA, workspace_type: 'household', owner_id: 'owner', legacy_family_id: familyId, status: 'active' };
const company = { id: idA, workspace_type: 'business', owner_id: 'owner', status: 'active' };
const slice = (source, start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
function browser(href = 'https://mushavobudget.com/app.html') {
  const store = new Map(), redirects = [];
  const location = { href, get hash() { return new URL(this.href).hash; }, get search() { return new URL(this.href).search; } };
  location.replace = location.assign = value => { redirects.push(value); };
  const window = { location, localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) }, history: { replaceState(_a, _b, url) { location.href = new URL(url, location.href).href; } } };
  vm.runInNewContext(preference, { window, URL, Map, Date, JSON, Number, Promise });
  return { window, store, redirects };
}
async function launchApp({ saved, families = [], suspended = false, unfinished = false, admin = false, href } = {}) {
  const { window, redirects } = browser(href), events = [];
  if (saved) window.MushavoWorkspace.remember('owner', saved);
  const request = new Proxy({}, { get: () => () => request });
  const context = { window, URL, Promise, console: { info() {}, warn() {} }, performance: { now: () => 0 },
    startupWorkspacePreference: null, startupWorkspaceUnavailable: false,
    state: { session: { user: { id: 'owner', email: 'owner@test.invalid' } }, family: null, families: [], isAdmin: admin, familyTab: 'dashboard', workspaces: [personal, family] },
    supabase: { from: () => request, rpc: () => request },
    query: async label => label === 'account status load' ? suspended : label === 'families load' ? families : [],
    assertSupabase() {}, blockUnfinishedAdminInvitationSession: async () => unfinished,
    ensureProfile: async () => {}, loadInvitations: async () => {}, loadNotifications: async () => {},
    loadAccess: async () => true, loadAdminData: async () => {}, renderAdmin() { events.push('admin'); },
    loadFamilyFinancialData: async () => { events.push('finance'); }, loadWorkspaceSubscriptionData: async () => {},
    loadPersonalPlanAccess: async () => {}, syncRouteForWorkspace() {}, loadCashbookData: async () => {}, loadUserSupportData: async () => {},
    setView: view => events.push(view), renderFamilyApp() { events.push('render'); }, handleNotificationDeepLink: async () => {},
    startRealtime() {}, schedulePushNotificationRefresh() {}, recordVisibleActivity: async () => {}, renderNotifications() {}, renderInvitations() {},
    clearBudgetDataBeforeBusinessNavigation() { events.push('clear'); }, showToast: value => events.push(value),
    routeFromHash: () => ({ area: new URL(window.location.href).hash.slice(1).split('/')[0] }),
    currentBudgetWorkspace: () => context.state.family ? family : personal
  };
  vm.createContext(context);
  vm.runInContext(slice(app, 'async function loadFamily()', 'function businessWorkspaceUrl('), context);
  vm.runInContext(slice(app, 'async function loadApp()', 'async function ensureProfile()'), context);
  await context.loadApp();
  return { context, window, redirects, events };
}

test('last Business redirects to its Overview without loading Personal financial data', async () => {
  const { redirects, events } = await launchApp({ saved: company });
  assert.equal(new URL(redirects[0]).searchParams.get('workspace'), idA);
  assert.equal(new URL(redirects[0]).hash, '#business/overview');
  assert.equal(events.includes('render'), false); assert.equal(events.includes('finance'), false);
});
test('last Personal remains Personal even when an owned Family exists', async () => {
  const { context, redirects } = await launchApp({ saved: personal, families: [{ id: familyId, owner_id: 'owner' }] });
  assert.equal(context.state.family, null); assert.equal(redirects.length, 0);
});
test('last Family restores that exact authorized Family rather than the first one', async () => {
  const { context, window } = await launchApp({ saved: family, families: [{ id: idB, owner_id: 'owner' }, { id: familyId, owner_id: 'owner' }] });
  assert.equal(context.state.family.id, familyId);
  assert.equal(window.MushavoWorkspace.read('owner').familyId, familyId);
});
test('deleted or removed Family falls back to Personal and replaces its saved selection', async () => {
  const { context, window, events } = await launchApp({ saved: family, families: [{ id: idB, owner_id: 'owner' }, { id: familyId, owner_id: 'outsider' }] });
  assert.equal(context.state.family, null); assert.equal(window.MushavoWorkspace.read('owner').kind, 'personal');
  assert.ok(events.some(value => /previous workspace is unavailable/.test(value)));
});
test('suspended and unfinished invitation accounts cannot restore a workspace', async () => {
  for (const options of [{ suspended: true }, { unfinished: true }]) {
    const { redirects, events, window } = await launchApp({ saved: company, ...options });
    assert.equal(redirects.length, 0); assert.equal(events.includes('render'), false);
    assert.equal(window.MushavoWorkspace.read('owner').id, idA);
  }
});
test('Admin entry and explicit Personal destination take precedence over remembered Business', async () => {
  const admin = await launchApp({ saved: company, admin: true });
  assert.ok(admin.events.includes('admin')); assert.equal(admin.redirects.length, 0);
  const explicit = await launchApp({ saved: company, href: 'https://mushavobudget.com/app.html?source=push#personal/payments' });
  assert.equal(explicit.redirects.length, 0); assert.ok(explicit.events.includes('render'));
});

async function launchBusiness({ requested = idA, restoring = true, available = true, incoming = [], signedIn = true, suspended = false } = {}) {
  const { window, redirects } = browser(`https://mushavobudget.com/business.html?workspace=${requested}${restoring ? '&restore_workspace=1' : ''}#business/overview`);
  const events = [], request = new Proxy({}, { get: () => () => request });
  const context = { window, URL, console: { error() {} }, appOpening: false, isConfigured: true,
    state: { session: null, workspaces: [], memberships: [] },
    supabase: { auth: { getSession: async () => ({ data: { session: signedIn ? { user: { id: 'owner' } } : null } }) }, from: () => request, rpc: () => request },
    query: async label => label === 'account status load' ? suspended : label === 'Business workspace load' ? available ? [company] : [{ ...company, id: idB }] : label === 'Business invitation load' ? incoming : [],
    showOnly: value => events.push(value), clearBusinessWorkspaceState() {}, renderIncomingInvitations() {},
    selectedWorkspaceStorageKey: () => 'legacy', currentTab: () => 'overview',
    selectBusinessWorkspace: async id => events.push(`selected:${id}`), friendlyMessage: error => error.message,
    $: () => ({ textContent: '' })
  };
  vm.createContext(context);
  vm.runInContext(slice(businessSource, 'function authorizedBusinessWorkspaces(', 'function currentTab()'), context);
  vm.runInContext(slice(businessSource, 'async function loadBusinessAccess()', 'async function signOut()'), context);
  await context.loadBusinessAccess(); return { window, redirects, events };
}
test('restored Business with removed access returns to Personal rather than another Business', async () => {
  const { redirects, events } = await launchBusiness({ available: false });
  assert.equal(new URL(redirects[0]).hash, '#personal/dashboard');
  assert.equal(new URL(redirects[0]).searchParams.get('workspace_unavailable'), '1');
  assert.equal(events.some(value => value.startsWith('selected:')), false);
});
test('an inaccessible explicit Business link shows no-access rather than a different company', async () => {
  const { redirects, events } = await launchBusiness({ available: false, restoring: false });
  assert.equal(redirects.length, 0); assert.ok(events.includes('businessNoAccess'));
});
test('pending invitations do not replace a restored or explicitly requested Business', async () => {
  const { events } = await launchBusiness({ incoming: [{ invitation_id: idB }] });
  assert.ok(events.includes(`selected:${idA}`)); assert.equal(events.includes('businessInvitations'), false);
});
test('expired sign-in retains the exact Business destination through the sign-in page', async () => {
  const { redirects } = await launchBusiness({ signedIn: false });
  const url = new URL(redirects[0]);
  assert.equal(url.pathname, '/app.html'); assert.equal(url.searchParams.get('workspace'), idA);
  assert.equal(url.searchParams.get('restore_workspace'), '1'); assert.equal(url.hash, '#business/overview');
});
test('Business suspension blocks selection and preserves the remembered destination', async () => {
  const { events, redirects } = await launchBusiness({ suspended: true });
  assert.ok(events.includes('businessSuspended')); assert.equal(redirects.length, 0);
  assert.equal(events.some(value => value.startsWith('selected:')), false);
});

test('expired Business restoration uses the existing owner renewal and member lock rules', () => {
  for (const owner of [true, false]) {
    const nodes = new Map(), node = () => ({ classList: { toggle() {}, add() {} }, textContent: '' });
    const context = { state: { workspace: { status: 'active' }, workspaceSubscription: { status: 'active', paid_through_at: '2020-01-01T00:00:00Z' }, workspaceEntitlement: { effective_status: 'expired' }, tab: 'overview' }, Date, Number,
      businessBillingOwner: () => owner, $: selector => { if (!nodes.has(selector)) nodes.set(selector, node()); return nodes.get(selector); }, $$: () => [] };
    vm.runInNewContext(slice(businessSource, 'function resolveWorkspaceLock()', 'function renderRoute()')+';resolveWorkspaceLock();', context);
    assert.equal(context.state.locked, true); assert.equal(context.state.lockOwner, owner);
    assert.equal(context.state.tab, owner ? 'subscription' : 'overview');
  }
});

test('ordinary sign-out clears stale destinations while session recovery preserves an intended link', () => {
  for (const preserve of [true, false]) {
    const { window } = browser('https://mushavobudget.com/app.html?workspace='+idA+'&source=push#family/payments');
    const context = { window, preserveSignInDestination: preserve, resetState() {}, setView() {} };
    vm.runInNewContext(slice(app, 'function handleSignedOut()', 'function isInvalidStoredSessionError(')+';handleSignedOut();', context);
    const url = new URL(window.location.href);
    assert.equal(url.searchParams.has('workspace'), preserve);
    assert.equal(Boolean(url.hash), preserve);
  }
});

test('Business reauthentication forwards bill and invitation destinations to the Business app', () => {
  for (const query of ['bill='+idB, 'invitation='+idB]) {
    const { window } = browser('https://mushavobudget.com/app.html?workspace='+idA+'&'+query+'#business/team');
    const context = { window, URL, routeFromHash: () => ({ area: 'business' }) };
    vm.runInNewContext(slice(app, 'function businessWorkspaceUrl(', 'function clearBudgetDataBeforeBusinessNavigation()'), context);
    const url = new URL(context.businessWorkspaceUrl(idA, 'team'), window.location.href);
    assert.equal(url.searchParams.get(query.split('=')[0]), idB);
    assert.equal(url.searchParams.get('workspace'), idA);
  }
});
