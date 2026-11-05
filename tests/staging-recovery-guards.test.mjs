import test from 'node:test';
import assert from 'node:assert/strict';
import { bridgeKey, publicBridgeKey, sealBridge, openBridge, createMailbox } from '../scripts/ci/staging-recovery-bridge.mjs';
import { recoveryFixtures, cleanupSQL, expirySQL } from '../scripts/ci/staging-recovery-fixtures.mjs';
import { recoveryMailToken, recoveryBrowserDecision } from '../scripts/ci/staging-recovery.mjs';
import { API_ORIGIN, WEB_ORIGIN } from '../scripts/ci/staging-access.mjs';
import { recoveryFeedbackDecision } from '../scripts/ci/staging-recovery-feedback.mjs';
const binding={run:'12345',commit:'a'.repeat(40),phase:'RECOVER_A'};

test('mailbox encryption binds the exact run, commit, phase and ephemeral runner key',()=>{
  const receiver=bridgeKey(),other=bridgeKey(),secret={url:'https://example.invalid/private-token'};
  const sealed=sealBridge(publicBridgeKey(receiver.publicKey),binding,secret);
  assert.deepEqual(openBridge(receiver.privateKey,binding,sealed),secret);
  assert.equal(JSON.stringify(sealed).includes('private-token'),false);
  for(const changed of [{run:'23456'},{commit:'b'.repeat(40)},{phase:'RECOVER_B'}])
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
  const run='w300-mw3dwzsv-m9siry',f=recoveryFixtures(run);
  assert.equal(f.A,'pkisgettingscammed+'+run+'a@gmail.com');
  for(const bad of ["x'; DELETE FROM auth.users; --",'w300-other','w300-a-b']) assert.throws(()=>cleanupSQL(bad));
  const cleanup=cleanupSQL(run),expiry=expirySQL(run);
  for(const guard of ['FOR UPDATE','RECOVERY_FIXTURE_UNEXPECTED_REFERENCE','RECOVERY_FIXTURE_EMPTY_FREE_PERSONAL_STATE_REQUIRED',
    'RECOVERY_FIXTURE_CLEANUP_ABSENCE_REQUIRED','raw_user_meta_data','financial_or_shared_rows_deleted']) assert.ok(cleanup.includes(guard));
  assert.ok(expiry.includes("token_type='recovery_token'"));assert.ok(expiry.includes('GLOBAL')===false);
  assert.equal(/ALTER\s+(SYSTEM|ROLE|DATABASE)|TRUNCATE|DISABLE\s+TRIGGER|SECURITY\s+DEFINER/i.test(cleanup+expiry),false);
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
  for(const [path,method,phase]of [['/auth/v1/user','PUT','idle'],['/auth/v1/signup','POST','recovery'],
    ['/auth/v1/logout?scope=global','POST','save'],['/rest/v1/profiles','PATCH','save'],['/rest/v1/rpc/complete_admin_user_invitation','POST','save']])
    assert.equal(recoveryBrowserDecision(API_ORIGIN+path,method,phase),'refuse');
});
test('feedback-only execution refuses password changes, fixture creation, session adoption and unrelated mutations',()=>{
  for(const mode of ['absent','blocked','rate']){
    assert.equal(recoveryFeedbackDecision(API_ORIGIN+'/auth/v1/recover','POST',mode),mode);
    for(const[path,method]of [['/auth/v1/signup','POST'],['/auth/v1/verify','POST'],['/auth/v1/user','PUT'],
      ['/rest/v1/profiles','PATCH'],['/auth/v1/logout?scope=global','POST']])assert.equal(recoveryFeedbackDecision(API_ORIGIN+path,method,mode),'refuse');
  }
  assert.equal(recoveryFeedbackDecision(API_ORIGIN+'/auth/v1/recover','POST','unreviewed'),'refuse');
});
