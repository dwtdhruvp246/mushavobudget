import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('../app.js', import.meta.url), 'utf8');
function harness(refreshResult, loadError = null) {
  const calls = { signOut: 0, removed: 0, opened: 0, errors: 0, refresh: 0 };
  const context = {
    state: { session: { user: { id: 'one' }, access_token: 'expired' } },
    config: { supabaseUrl: 'https://project.supabase.co' }, URL,
    console: { error() {} },
    window: { localStorage: { removeItem() { calls.removed++; } } },
    supabase: { auth: {
      async refreshSession() { calls.refresh++; return refreshResult; },
      async signOut() { calls.signOut++; }
    } },
    async openAuthenticatedSession() { calls.opened++; if (loadError) throw loadError; },
    handleSignedOut() {}, showToast() {}, setView() {},
    showAppError() { calls.errors++; }
  };
  vm.runInNewContext(source.slice(source.indexOf('function isInvalidStoredSessionError'), source.indexOf('function openAuthenticatedSession')), context);
  return { calls, context };
}
test('app refreshes expired access token and reloads authenticated data without clearing storage', async () => {
  const {calls,context} = harness({ data: { session: { user: {id:'one'}, access_token: 'fresh' } } });
  await context.handleLoadFailure(new Error('JWT expired'));
  assert.equal(context.state.session.access_token, 'fresh');
  assert.deepEqual(calls, {signOut:0, removed:0, opened:1, errors:0, refresh:1});
});
test('app preserves login on transient refresh failure and bounds rejected-token retries', async () => {
  const transient = harness({ error: new Error('Network timeout') });
  await transient.context.handleLoadFailure(new Error('JWT expired'));
  assert.equal(transient.calls.removed, 0);
  assert.equal(transient.calls.errors, 1);
  const repeated = harness({data:{session:{access_token:'fresh'}}}, new Error('JWT expired'));
  await repeated.context.handleLoadFailure(new Error('JWT expired'));
  assert.equal(repeated.calls.refresh, 1);
  assert.equal(repeated.calls.signOut, 0);
});
test('confirmed invalid refresh credentials still require sign-in', async () => {
  const {calls,context} = harness({error:{code:'refresh_token_not_found', message:'Refresh token not found'}});
  await context.handleLoadFailure(new Error('JWT expired'));
  assert.equal(calls.signOut, 1);
  assert.equal(calls.removed, 1);
});
test('submission protection spans the entire async handler and releases on failure', async () => {
  let active = 0;
  const context = {window:{MushavoPWA:{beginOperation(){ active++; return () => active--; }}}};
  vm.runInNewContext(source.slice(source.indexOf('function protectSubmission'),source.indexOf('function showSignupSuccessMessage')),context);
  const wrapped = context.protectSubmission(async () => {
    assert.equal(active, 1);
    await Promise.resolve();
    assert.equal(active, 1);
    throw new Error('save failed');
  });
  await assert.rejects(wrapped({}), /save failed/);
  assert.equal(active, 0);
});
