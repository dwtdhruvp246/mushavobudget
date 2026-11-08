import test from 'node:test';
import assert from 'node:assert/strict';
import { createPrivateFileHandler, validPrivateFileSelector } from '../supabase/functions/get-private-file/handler.mjs';

const token = 'synthetic.ordinary.token';
const bucket = 'payment-proofs', path = 'personal/actor/file.png';
function harness(options = {}) {
  const calls = { auth: 0, session: 0, context: 0, service: 0, downloads: 0 };
  const selected = options.selector || { bucket, path };
  const row = { object_id: 'object-A', bucket_id: selected.bucket, object_name: selected.path,
    object_version: 'v1:updated', size_bytes: 4, mime_type: 'image/png', ...options.row };
  const handle = createPrivateFileHandler({
    configured: () => options.configured !== false,
    allowedOrigin: origin => origin === 'https://mushavo-budget-staging.pages.dev',
    createUserClient(received) {
      assert.equal(received, token);
      return { auth: { async getUser() { calls.auth++; return options.identity || { data: { user: { id: 'actor' } } }; } },
        async rpc(name, args) {
          if (name === 'app_session_status') { calls.session++; return options.session || { data: { session_valid: true } }; }
          assert.equal(name, 'private_file_download_context');
          assert.deepEqual(args, { p_bucket_id: selected.bucket, p_object_name: selected.path });
          calls.context++;
          if (options.context) return options.context(calls.context, row);
          return { data: [{ ...row }] };
        } };
    },
    async readPrivateObject(name, objectPath, maxBytes) {
      calls.service++;
      assert.equal(name, selected.bucket); assert.ok(maxBytes > 0);
        calls.downloads++; assert.equal(objectPath, selected.path);
        if (options.download) return options.download();
        return { data: new Blob(['safe']) };
    },
  });
  const request = (overrides = {}) => new Request('https://staging.invalid/get-private-file', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
      Origin: 'https://mushavo-budget-staging.pages.dev', ...overrides.headers },
    body: JSON.stringify(selected), ...Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== 'headers')),
  });
  return { calls, handle, request, row };
}
function noStore(response) {
  assert.match(response.headers.get('cache-control'), /private, no-store/);
  assert.equal(response.headers.get('surrogate-control'), 'no-store');
  assert.match(response.headers.get('vary'), /Authorization/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
}

for (const name of ['payment-proofs', 'subscription-proofs', 'business-documents', 'business-logos']) {
  test(`broker ${name}: current RLS checked twice and no signed URL emitted`, async () => {
    const h = harness({ selector: { bucket: name, path } }); const response = await h.handle(h.request());
    assert.equal(response.status, 200); noStore(response);
    assert.equal(await response.text(), 'safe'); assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('x-mushavo-media-type'), 'image/png');
    assert.match(response.headers.get('content-disposition'), /^attachment;/);
    assert.deepEqual(h.calls, { auth: 1, session: 1, context: 2, service: 1, downloads: 1 });
  });
}
const rejected = [
  ['missing bearer', {}, { headers: { Authorization: '' } }, 401],
  ['unverified Auth identity', { identity: { data: { user: null }, error: { message: 'secret' } } }, {}, 401],
  ['inactive application session', { session: { data: { session_valid: false } } }, {}, 403],
  ['session database error', { session: { error: { message: 'secret' } } }, {}, 403],
  ['foreign/removed object', { context: () => ({ data: [] }) }, {}, 404],
  ['RLS metadata failure', { context: () => ({ error: { message: 'secret' } }) }, {}, 404],
  ['unknown Origin', {}, { headers: { Origin: 'https://foreign.invalid' } }, 403],
  ['server target mismatch', { configured: false }, {}, 503],
  ['unknown bucket', { selector: { bucket: 'public', path } }, {}, 400],
  ['authority injection', { selector: { bucket, path, owner_id: 'other' } }, {}, 400],
  ['path traversal', { selector: { bucket, path: 'personal/actor/../file.png' } }, {}, 400],
  ['encoded path', { selector: { bucket, path: 'personal/actor/%2e%2e/file.png' } }, {}, 400],
  ['oversized request', {}, { body: ' '.repeat(1025) }, 400],
  ['invalid JSON', {}, { body: '{' }, 400],
  ['invalid content type', {}, { headers: { 'Content-Type': 'text/plain' } }, 400],
  ['oversized metadata', { row: { size_bytes: 10485761 } }, {}, 404],
  ['active content metadata', { row: { mime_type: 'text/html' } }, {}, 404],
  ['logo non-image metadata', { selector: { bucket: 'business-logos', path }, row: { mime_type: 'application/pdf' } }, {}, 404],
];
for (const [name, options, request, status] of rejected) test(`broker refuses ${name} before privileged fetch`, async () => {
  const h = harness(options), response = await h.handle(h.request(request));
  assert.equal(response.status, status); noStore(response); assert.equal(h.calls.service, 0);
  assert.doesNotMatch(await response.text(), /secret|actor|personal\//);
});
for (const [name, context] of [
  ['membership removed', () => []],
  ['session suspended', () => []],
  ['document archived', () => []],
  ['object replaced', row => [{ ...row, object_id: 'replacement' }]],
  ['version changed', row => [{ ...row, object_version: 'v2' }]],
  ['size changed', row => [{ ...row, size_bytes: 5 }]],
  ['type changed', row => [{ ...row, mime_type: 'application/pdf' }]],
]) test(`broker discards fetched bytes when ${name} during fetch`, async () => {
  const h = harness({ context: (count, row) => ({ data: count === 1 ? [row] : context(row) }) });
  const response = await h.handle(h.request()); assert.equal(response.status, 404); noStore(response);
  assert.equal(h.calls.downloads, 1); assert.equal(h.calls.context, 2); assert.doesNotMatch(await response.text(), /safe/);
});
for (const [name, download] of [
  ['mismatched byte size', async () => ({ data: new Blob(['too long']) })],
  ['empty response', async () => ({ data: new Blob([]) })],
  ['provider error', async () => ({ error: { message: 'secret' } })],
  ['exception', async () => { throw new Error('secret'); }],
]) test(`broker fails closed on ${name}`, async () => {
  const h = harness({ download }), response = await h.handle(h.request());
  assert.ok([404, 503].includes(response.status)); noStore(response); assert.doesNotMatch(await response.text(), /secret/);
});
test('broker OPTIONS/GET do not create clients and retain no-store headers', async () => {
  for (const method of ['OPTIONS', 'GET']) {
    const h = harness(), response = await h.handle(h.request({ method, body: undefined }));
    assert.equal(response.status, method === 'OPTIONS' ? 204 : 405); noStore(response); assert.equal(h.calls.auth, 0);
  }
});
test('selector accepts current generated paths, rejects URL query/fragment and inherited bucket names', () => {
  for (const value of ['families/family/head/actor/file.png', 'workspaces/workspace/actor/file.pdf', 'workspace/expenses/actor/file.xlsx'])
    assert.ok(validPrivateFileSelector({ bucket, path: value }));
  for (const value of ['personal/actor/file.png?x=1', 'personal/actor/file.png#x', '/personal/actor/file.png', 'personal\\actor\\file.png'])
    assert.ok(!validPrivateFileSelector({ bucket, path: value }));
  assert.ok(!validPrivateFileSelector({ bucket: '__proto__', path }));
});
