import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeKey, publicBridgeKey, sealBridge, openBridge, createMailbox } from '../scripts/ci/staging-recovery-bridge.mjs';
import { recoveryFixtures, cleanupSQL, expirySQL, recoveryTimestampSnapshotSQL } from '../scripts/ci/staging-recovery-fixtures.mjs';
import { checkRecovery, recoveryMailToken, recoveryBrowserDecision, safeRecoveryRequestOutcome, isBoundRecoveryPasswordUpdate, isBoundRecoveryProvision } from '../scripts/ci/staging-recovery.mjs';
import { API_ORIGIN, WEB_ORIGIN } from '../scripts/ci/staging-access.mjs';
import { recoveryFeedbackDecision } from '../scripts/ci/staging-recovery-feedback.mjs';
const binding={run:'12345',commit:'a'.repeat(40),phase:'RECOVER_A'};

test('mailbox encryption binds the exact run, commit, phase and ephemeral runner key',()=>{
  const receiver=bridgeKey(),other=bridgeKey(),secret={url:'https://example.invalid/private-token'};
  const sealed=sealBridge(publicBridgeKey(receiver.publicKey),binding,secret);
  assert.deepEqual(openBridge(receiver.privateKey,binding,sealed),secret);
  assert.equal(JSON.stringify(sealed).includes('private-token'),false);
  for(const changed of [{run:'23456'},{commit:'b'.repeat(40)},{phase:'RESTORE_A'}])
    assert.throws(()=>openBridge(receiver.privateKey,{...binding,...changed},sealed));
  assert.throws(()=>openBridge(other.privateKey,binding,sealed));
  assert.throws(()=>openBridge(receiver.privateKey,binding,{...sealed,ciphertext:sealed.ciphertext.slice(2)}));
});
test('mailbox refuses another repository, branch, missing token, or unreviewed phase',async()=>{
  for(const env of [{},{GITHUB_REPOSITORY:'other/repo'}, {GITHUB_REPOSITORY:'dwtdhruvp246/mushavobudget',GITHUB_REF:'refs/heads/main'}])
    assert.throws(()=>createMailbox(env));
  assert.throws(()=>sealBridge(publicBridgeKey(bridgeKey().publicKey),{...binding,phase:'UNREVIEWED'},{}));
});
test('only exact disposable plus aliases can be bound into guarded fixture SQL',()=>{
  const run='w304-mw3dwzsv-m9siry',f=recoveryFixtures(run);
  assert.equal(f.A,'pkisgettingscammed+'+run+'a@gmail.com');
  for(const bad of ["x'; DELETE FROM auth.users; --",'w300-other','w300-a-b']) assert.throws(()=>cleanupSQL(bad));
  const cleanup=cleanupSQL(run);
  for(const guard of ['FOR UPDATE','RECOVERY_FIXTURE_UNEXPECTED_REFERENCE','RECOVERY_FIXTURE_EMPTY_FREE_PERSONAL_STATE_REQUIRED',
    'RECOVERY_FIXTURE_CLEANUP_ABSENCE_REQUIRED','raw_user_meta_data','financial_or_shared_rows_deleted']) assert.ok(cleanup.includes(guard));
  assert.ok(cleanup.includes(f.A));
  assert.ok(!cleanup.includes(f.B) && cleanup.includes('v_total>1'));
  assert.equal(/ALTER\s+(SYSTEM|ROLE|DATABASE)|TRUNCATE|DISABLE\s+TRIGGER|SECURITY\s+DEFINER/i.test(cleanup),false);
});
test('expiry and restoration require the same unused disposable recovery row and its original timestamps', () => {
  const run = 'w304-mw3dwzsv-m9siry';
  const fixture = recoveryFixtures(run);
  const snapshot = { result: 'BOUND_UNUSED_RECOVERY_TIMESTAMPS', user_digest: 'a'.repeat(64),
    token_row_digest: 'b'.repeat(64), sent_at: '2026-11-05T12:00:00.123456Z', expires_at: '2026-11-05T13:00:00.123456Z' };
  const read = recoveryTimestampSnapshotSQL(run);
  assert.ok(read.includes(fixture.A) && !read.includes(fixture.B) && !read.includes('token_hash'));
  const expire = expirySQL(run, snapshot), restore = expirySQL(run, snapshot, true);
  for (const sql of [expire, restore]) {
    for (const guard of [fixture.A, snapshot.user_digest, snapshot.token_row_digest, 'FOR UPDATE OF u, t',
      'RECOVERY_ORIGINAL_VALIDITY_WINDOW_REQUIRED', "t.token_type = 'recovery_token'", 'IS NOT DISTINCT FROM']) assert.ok(sql.includes(guard));
    assert.ok(!sql.includes(fixture.B) && !sql.includes('token_hash'));
    assert.equal(/ALTER\s+(SYSTEM|ROLE|DATABASE)|TRUNCATE|DISABLE\s+TRIGGER|SECURITY\s+DEFINER/i.test(sql), false);
  }
  assert.match(expire, /UPDATE auth\.users SET recovery_sent_at = '2000-01-01T00:00:00Z'/);
  assert.ok(restore.includes("UPDATE auth.users SET recovery_sent_at = '" + snapshot.sent_at + "'::timestamptz"));
  assert.ok(restore.includes("UPDATE auth.one_time_tokens SET expires_at = '" + snapshot.expires_at + "'::timestamptz"));
  assert.match(expirySQL(run, { ...snapshot, expires_at: null }, true), /SET expires_at = NULL::timestamptz/);
  for (const bad of [{}, { ...snapshot, sent_at: "x'; DELETE FROM auth.users; --" }, { ...snapshot, token_row_digest: 'bad' }])
    assert.throws(() => expirySQL(run, bad));
});
test('test mail parser requires the exact staging Auth host, type, stable callback and bounded hash',()=>{
  const good=API_ORIGIN+'/auth/v1/verify?type=recovery&token='+'a'.repeat(64)+'&redirect_to='+encodeURIComponent(WEB_ORIGIN+'/auth.html?flow=recover');
  assert.equal(recoveryMailToken(good,'recovery'),'a'.repeat(64));
  for(const bad of [good.replace('dczlddwbtgvfdujgcitb','other-project'),good.replace('type=recovery','type=signup'),
    good.replace('mushavo-budget-staging.pages.dev','other.pages.dev'),good.replace('flow%3Drecover','flow%3Dconfirm'),good.replace('a'.repeat(64),'short')])
    assert.throws(()=>recoveryMailToken(bad,'recovery'));
});
test('recovery browser permits only its phase-specific Auth mutations and retains all finance/role/global-logout denials',()=>{
  assert.equal(recoveryBrowserDecision(API_ORIGIN+'/auth/v1/user','PUT','block-save'),'password-save');
  assert.equal(recoveryBrowserDecision(API_ORIGIN+'/auth/v1/verify','POST','recovery'),'verify-recovery');
  assert.equal(recoveryBrowserDecision(API_ORIGIN+'/auth/v1/recover','POST','live-request'),'recovery-request');
  assert.equal(recoveryBrowserDecision(API_ORIGIN+'/auth/v1/token?grant_type=password','POST','legacy-sign-in'),'legacy-sign-in');
  for(const [path,method,phase]of [['/auth/v1/user','PUT','idle'],['/auth/v1/signup','POST','recovery'],
    ['/auth/v1/token?grant_type=password','POST','save'],['/auth/v1/user','PUT','legacy-sign-in'],
    ['/auth/v1/logout?scope=global','POST','save'],['/rest/v1/profiles','PATCH','save'],['/rest/v1/rpc/complete_admin_user_invitation','POST','save']])
    assert.equal(recoveryBrowserDecision(API_ORIGIN+path,method,phase),'refuse');
});
test('password retry accepts SDK null PKCE fields only for the exact recovery actor and session', () => {
  const actor = '11111111-1111-4111-8111-111111111111';
  const recovery = '22222222-2222-4222-8222-222222222222';
  const different = '33333333-3333-4333-8333-333333333333';
  const makeToken = (sub, session_id) => 'e30.' + Buffer.from(JSON.stringify({ sub, session_id })).toString('base64url') + '.test';
  const identity = { userId: actor, sessionId: recovery }, token = makeToken(actor, recovery), password = 'ExampleFixture9!';
  const body = { password, code_challenge: null, code_challenge_method: null };
  assert.equal(isBoundRecoveryPasswordUpdate(body, token, identity, password), true);
  assert.equal(isBoundRecoveryPasswordUpdate({ password }, token, identity, password), true);
  for (const extra of [{ email: 'other@example.invalid' }, { data: {} }, { code_challenge: 'unexpected' }, { code_challenge_method: 's256' }])
    assert.equal(isBoundRecoveryPasswordUpdate({ ...body, ...extra }, token, identity, password), false);
  assert.equal(isBoundRecoveryPasswordUpdate(body, makeToken(different, recovery), identity, password), false);
  assert.equal(isBoundRecoveryPasswordUpdate(body, makeToken(actor, different), identity, password), false);
  assert.equal(isBoundRecoveryPasswordUpdate(body, token, identity, 'DifferentFixture9!'), false);
  const provision = API_ORIGIN + '/rest/v1/rpc/provision_my_budget_workspace';
  assert.equal(recoveryBrowserDecision(provision, 'POST', 'block-save'), 'refuse');
  assert.equal(recoveryBrowserDecision(provision, 'POST', 'save'), 'provision-fixture');
  assert.equal(isBoundRecoveryProvision({}, token, identity), true);
  assert.equal(isBoundRecoveryProvision({ user_id: different }, token, identity), false);
  assert.equal(isBoundRecoveryProvision(null, token, identity), false);
  assert.equal(isBoundRecoveryProvision({}, makeToken(actor, different), identity), false);
});
test('retry-only recovery refuses other cases, reruns and an early email window before any request', async () => {
  const plan = { scope: 'recovery-save-retry', case_ids: ['AU04.05'], fixture_run_id: 'w304-mw3dwzsv-m9siry',
    not_before_utc: new Date(Date.now() + 60_000).toISOString() };
  const env = { GITHUB_REPOSITORY: 'dwtdhruvp246/mushavobudget', GITHUB_REF: 'refs/heads/security/stage-3-authorization', GITHUB_RUN_ATTEMPT: '1' };
  let requests = 0;
  const fetcher = async () => { requests++; throw new Error('Unexpected request'); };
  await assert.rejects(checkRecovery({ ...plan, case_ids: ['AU04.03', 'AU04.05'] }, {}, null, env, fetcher),
    { code: 'EXACT_RECOVERY_CASE_SCOPE_REQUIRED' });
  const early = await checkRecovery(plan, {}, null, env, fetcher);
  assert.equal(early.problem_code, 'STAGING_AUTH_EMAIL_WINDOW_PENDING');
  const rerun = await checkRecovery(plan, {}, null, { ...env, GITHUB_RUN_ATTEMPT: '2' }, fetcher);
  assert.equal(rerun.problem_code, 'NEW_REVIEWED_RECOVERY_ATTEMPT_REQUIRED');
  assert.equal(requests, 0);
  assert.equal(early.actual_confirmation_email_requests + early.actual_recovery_email_requests, 0);
});
test('feedback-only execution refuses password changes, fixture creation, session adoption and unrelated mutations',()=>{
  for(const mode of ['absent','blocked','rate']){
    assert.equal(recoveryFeedbackDecision(API_ORIGIN+'/auth/v1/recover','POST',mode),mode);
    for(const[path,method]of [['/auth/v1/signup','POST'],['/auth/v1/verify','POST'],['/auth/v1/user','PUT'],
      ['/rest/v1/profiles','PATCH'],['/auth/v1/logout?scope=global','POST']])assert.equal(recoveryFeedbackDecision(API_ORIGIN+path,method,mode),'refuse');
  }
  assert.equal(recoveryFeedbackDecision(API_ORIGIN+'/auth/v1/recover','POST','unreviewed'),'refuse');
});
test('recovery outcomes preserve named Auth rate codes and never export arbitrary messages or tokens',()=>{
  assert.deepEqual(safeRecoveryRequestOutcome(429,{code:429,error_code:'over_email_send_rate_limit',msg:'private-provider-body'}),
    {HTTP_status:429,error_code:'over_email_send_rate_limit',accepted_by_Auth:false,rate_limited:true});
  const result=safeRecoveryRequestOutcome(500,{code:'untrusted-arbitrary-text',msg:'private-message',access_token:'private-token'});
  assert.equal(result.error_code,'OTHER');assert.equal(JSON.stringify(result).includes('private'),false);
  assert.equal(safeRecoveryRequestOutcome(200,{}).accepted_by_Auth,true);
});
