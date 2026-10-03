import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../business.js', import.meta.url), 'utf8');
const loader = source.slice(source.indexOf('async function selectBusinessWorkspace('), source.indexOf('async function loadBusinessAccess('));
function fixture() {
  const company = {id: 'company', owner_id: 'owner'};
  const chain = {select() {return chain;}, eq() {return chain;}, limit() {return chain;}, maybeSingle() {return chain;}, order() {return chain;}};
  const context = vm.createContext({
    state: {workspace: company, workspaces: [company, {id: 'second', owner_id: 'owner'}], memberships: [], session: {user: {id: 'owner'}}, locked: false},
    setupStep: 'categories', setupOpen: true, workspaceLoadSequence: 1,
    window: {localStorage: {setItem() {}}}, $: () => ({open: false}),
    supabase: {from() {return chain;}, rpc() {return chain;}},
    query: async label => label === 'Business subscription load' || label === 'Business entitlement load' ? [{}]
      : label === 'Business permissions load' ? [] : label === 'Business team load' ? {members: []} : [],
    currentTab: () => 'overview', selectedWorkspaceStorageKey: () => 'test', setWorkspaceUrl() {},
    showOnly() {}, renderWorkspaceSelectors() {}, resolveWorkspaceLock() {},
    prepareBusinessReports() {}, rememberBusinessWorkspace() {}, populateActivityFilters() {}, renderBusinessWorkspace() {},
    businessBillingOwner: () => false, refreshClaims: async () => {}, refreshBills: async () => {}, startBusinessRealtime() {}
  });
  context.clearBusinessWorkspaceState = () => {
    context.workspaceLoadSequence++; context.state.workspace = null;
    context.setupStep = 'basics'; context.setupOpen = false;
  };
  context.businessOwnerCanSetUp = () => context.state.workspace.owner_id === context.state.session.user.id;
  vm.runInContext(loader, context);
  return context;
}
test('same-company live reload restores the latest setup step and reopened setup', async () => {
  const f = fixture();
  await f.selectBusinessWorkspace('company', {preserveSetup: true});
  assert.equal(f.setupStep, 'categories'); assert.equal(f.setupOpen, true);
});
test('switching companies starts with that company’s setup', async () => {
  const f = fixture();
  await f.selectBusinessWorkspace('second', {preserveSetup: true});
  assert.equal(f.setupStep, 'basics'); assert.equal(f.setupOpen, false);
});
test('reload does not reopen owner setup after ownership is removed', async () => {
  const f = fixture();
  f.state.workspaces[0] = {id: 'company', owner_id: 'another-owner'};
  await f.selectBusinessWorkspace('company', {preserveSetup: true});
  assert.equal(f.setupStep, 'basics'); assert.equal(f.setupOpen, false);
});
