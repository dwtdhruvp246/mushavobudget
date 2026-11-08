import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { PUBLIC_SITE_FILES } from '../scripts/build-public-site.mjs';

const source = (await readFile(new URL('../private-files.js', import.meta.url), 'utf8')).replaceAll('export ', '');
function harness() {
  const calls = { invoked: 0, created: [], revoked: [], opened: [], timers: [] }; let current = true, finish;
  const pending = new Promise(resolve => { finish = resolve; });
  const client = { functions: { invoke(name, args) { assert.equal(name, 'get-private-file'); assert.deepEqual(Object.keys(args.body).sort(), ['bucket','path']); calls.invoked++; return pending; } } };
  const context = { Blob, document: { createElement() { return { click() { calls.opened.push({ ...this }); } }; } },
    URL: { createObjectURL(blob) { calls.created.push(blob); return 'blob:synthetic'; }, revokeObjectURL(url) { calls.revoked.push(url); } },
    setTimeout(fn, delay) { calls.timers.push({ fn, delay }); } };
  vm.runInNewContext(source, context);
  const open = () => context.openPrivateFile(client, 'business-documents', 'workspace/actor/file.csv', () => current, '../../test.csv');
  const response = type => ({ data: new Blob(['safe']), response: new Response(null, { headers: { 'X-Mushavo-Media-Type': type } }) });
  return { calls, context, open, finish, response, change() { current = false; } };
}
test('already stale request never invokes backend', async () => {
  const h = harness(); h.change(); await h.open(); assert.equal(h.calls.invoked, 0);
});
test('late current-context change discards returned bytes without creating a URL', async () => {
  const h = harness(), work = h.open(); h.change(); h.finish(h.response('image/png')); await work;
  assert.equal(h.calls.created.length, 0); assert.equal(h.calls.opened.length, 0);
});
test('late error after identity change is discarded', async () => {
  const h = harness(), work = h.open(); h.change(); h.finish({ error: new Error('failure') }); await work;
  assert.equal(h.calls.created.length, 0);
});
for (const type of ['image/png','image/jpeg','image/webp','application/pdf']) test(`${type} opens a protected typed preview and releases the URL`, async () => {
  const h = harness(), work = h.open(); h.finish(h.response(type)); await work;
  assert.equal(h.calls.created[0].type, type); assert.equal(h.calls.opened[0].rel, 'noopener noreferrer');
  assert.equal(h.calls.opened[0].referrerPolicy, 'no-referrer');
  assert.equal(h.calls.opened[0].download, undefined); assert.equal(h.calls.timers[0].delay, 60000);
  h.calls.timers[0].fn(); assert.deepEqual(h.calls.revoked, ['blob:synthetic']);
});
for (const type of ['text/csv','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/html','']) test(`${type || 'missing MIME'} is attachment-only`, async () => {
  const h = harness(), work = h.open(); h.finish(h.response(type)); await work;
  assert.equal(h.calls.created[0].type, 'application/octet-stream'); assert.equal(h.calls.opened[0].download, '.._.._test.csv');
});
test('broker failures and empty payloads never create object URLs', async () => {
  for (const value of [{ error: new Error('private error') }, { data: new Blob([]) }, { data: { signedUrl: 'https://foreign.invalid' } }]) {
    const h = harness(), work = h.open(); h.finish(value); await assert.rejects(work, /unavailable/); assert.equal(h.calls.created.length, 0);
  }
});
test('exporter includes the new public module and worker still excludes private APIs', async () => {
  assert.ok(PUBLIC_SITE_FILES.includes('private-files.js'));
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(worker, /"\/functions\/"/); assert.match(worker, /"\/storage\/"/);
  for (const file of ['app.js','business.js']) assert.doesNotMatch(await readFile(new URL('../'+file, import.meta.url), 'utf8'), /createSignedUrl/);
});

const application = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const business = await readFile(new URL('../business.js', import.meta.url), 'utf8');
const part = (value, start, end) => value.slice(value.indexOf(start), value.indexOf(end, value.indexOf(start)));
for (const change of ['account','epoch','workspace','role','proof']) test(`actual Admin proof opener discards stale ${change}`, async () => {
  const h = harness(); let done;
  const wait = new Promise(resolve => { done = resolve; });
  const context = {
    state: { session: { user: { id: 'admin' } }, isAdmin: true, adminSubscriptionProofs: [{ id: 'proof', storage_path: 'path.pdf' }] },
    authDataEpoch: 1, workspace: { id: 'personal' }, SUBSCRIPTION_PROOF_BUCKET: 'subscription-proofs', supabase: {},
    currentBudgetWorkspace: () => context.workspace, showToast() { throw new Error('stale error'); },
    async openPrivateFile(_client,_bucket,_path,isCurrent) { await wait; assert.equal(isCurrent(), false); },
  };
  vm.runInNewContext(part(application,'async function openSubscriptionProof(', 'function renderAdminTabs('), context);
  const work = context.openSubscriptionProof('proof');
  if (change === 'account') context.state.session.user.id = 'other';
  if (change === 'epoch') context.authDataEpoch++;
  if (change === 'workspace') context.workspace.id = 'other';
  if (change === 'role') context.state.isAdmin = false;
  if (change === 'proof') context.state.adminSubscriptionProofs = [];
  done(); await work;
});
function logoHarness() {
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  const calls = { created: 0, revoked: [], rendered: 0 };
  const context = { state: { session: { user: { id: 'actor' } }, workspace: { id: 'business' }, locked: false,
    businessProfile: { logo_storage_path: 'logo.png' }, businessLogo: { url: 'blob:old' } },
    workspaceLoadSequence: 1, businessAuthEpoch: 1, brandingLoadKey: null, BUSINESS_LOGO_BUCKET: 'business-logos', supabase: {},
    fetchPrivateFile: async (_client,_bucket,_path,isCurrent) => { await pending; return isCurrent() ? { blob: new Blob(['safe']), mediaType: 'image/png' } : null; },
    URL: { createObjectURL() { calls.created++; return 'blob:new'; } },
    revokePrivateFileUrl: url => { if (url) calls.revoked.push(url); },
    renderBusinessBranding() { calls.rendered++; },
  };
  vm.createContext(context);
  vm.runInContext(part(business,'function captureBusinessFileContext(', 'async function openBusinessDocumentProof('), context);
  vm.runInContext(part(business,'async function refreshBusinessLogo(', 'async function chooseBusinessLogo('), context);
  return { context, calls, finish };
}
test('actual logo refresh revokes previous bytes before retaining its new local URL', async () => {
  const h = logoHarness(), work = h.context.refreshBusinessLogo('logo.png'); h.finish(); await work;
  assert.equal(h.context.state.businessLogo.url, 'blob:new'); assert.deepEqual(h.calls.revoked, ['blob:old']);
});
for (const change of ['account','epoch','sequence','workspace','path','locked']) test(`actual logo refresh never creates a URL after ${change} changes`, async () => {
  const h = logoHarness(), work = h.context.refreshBusinessLogo('logo.png');
  if (change === 'account') h.context.state.session.user.id = 'other';
  if (change === 'epoch') h.context.businessAuthEpoch++;
  if (change === 'sequence') h.context.workspaceLoadSequence++;
  if (change === 'workspace') h.context.state.workspace.id = 'other';
  if (change === 'path') h.context.state.businessProfile.logo_storage_path = 'other.png';
  if (change === 'locked') h.context.state.locked = true;
  h.finish(); await work; assert.equal(h.calls.created, 0); assert.deepEqual(h.calls.revoked, []);
});
