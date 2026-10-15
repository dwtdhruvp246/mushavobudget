import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {runOperatorMfa,AUTH,CONFIG,parseConfig,validateEmails,boundedBody} from '../scripts/lib/fr-2-operator-mfa.mjs';
globalThis.fetch=()=>{throw Error('REAL_NETWORK_FORBIDDEN_IN_TEST');};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const emails=['operator.primary@example.invalid','operator.recovery@example.invalid'];
const KEY='sb_publishable_synthetic_only', SECRET='JBSWY3DPEHPK3PXP';
const config=JSON.stringify({supabaseUrl:AUTH.replace('/auth/v1',''),supabasePublishableKey:KEY,vapidPublicKey:''});
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json'}});
function fixture(options={}) {
  const calls=[],displays=[],notices=[],tokens=new Map(),actors=emails.map((email,i)=>({id:id(i+1),email,email_confirmed_at:'2026-10-15T00:00:00Z',role:'authenticated',factors:[]}));
  if(options.existing)for(let i=0;i<2;i++)actors[i].factors=[{id:id(i+10),factor_type:'totp',status:'verified'}];
  if(options.pending)actors[0].factors=[{id:id(10),factor_type:'totp',status:'unverified'}];
  if(options.multiple)actors[0].factors=[{id:id(10),factor_type:'totp',status:'verified'},{id:id(11),factor_type:'totp',status:'verified'}];
  let sid=100,verifyCount=0,signIns=0,rejections=0;
  function token(actor,session,aal) {
    const claims={iss:AUTH,sub:actor.id,role:'authenticated',aud:'authenticated',aal,session_id:session,exp:Math.floor(Date.now()/1000)+600};
    if(options.badIssuer)claims.iss='https://production.invalid/auth/v1';
    if(options.badAal&&aal==='aal2')claims.aal='aal1';
    if(options.verifyActorSwitch&&aal==='aal2')claims.sub=id(999);
    if(options.verifySessionSwitch&&aal==='aal2')claims.session_id=id(998);
    const jwt='header.'+Buffer.from(JSON.stringify({...claims,nonce:tokens.size})).toString('base64url')+'.synthetic';
    tokens.set(jwt,{actor,session,aal});return jwt;
  }
  const io={password:async()=>options.cancelPassword?Promise.reject(Error('PASSWORD PRIVATE RAW ERROR')):'synthetic-password',
    code:async(_s,{fresh})=>fresh?'654321':'123456',notice:n=>notices.push(n),
    setup:async(slot,secret)=>{displays.push({slot,secret});if(options.cancelSetup)throw Error('PRIVATE SETUP ERROR');}};
  const fetcher=async(url,init)=>{
    calls.push({url,init});assert.equal(init.redirect,'error');assert(init.signal);
    assert(url===CONFIG||url.startsWith(AUTH+'/'));assert(!/\/rest\/|\/functions\/|storage|admin\/users/.test(url));
    if(options.throwTransport)throw Error('PRIVATE TRANSPORT ERROR '+SECRET);
    if(url===CONFIG){assert(!init.headers.apikey&&!init.headers.Authorization);
      if(options.redirectConfig)return new Response('redirect',{status:302});
      if(options.configBody)return new Response(options.configBody);
      return new Response('window.MUSHAVO_BUDGET_CONFIG = '+config+';');}
    assert.equal(init.headers.apikey,KEY);
    if(url.endsWith('/token?grant_type=password')) {
      const body=JSON.parse(init.body);assert.equal(body.password,'synthetic-password');
      const actor=actors.find(x=>x.email===body.email);assert(actor);signIns++;
      if(options.missingSession)return json({error:'PRIVATE PASSWORD FAILURE'});
      const session=options.sameFreshSession&&signIns===2?id(101):id(++sid);
      return json({access_token:token(actor,session,'aal1'),refresh_token:'NOT_PERSISTED',user:actor});
    }
    const bearer=init.headers.Authorization?.replace(/^Bearer /,'');const session=tokens.get(bearer);assert(session);
    if(url.endsWith('/user')){
      const user=structuredClone(session.actor);
      if(options.wrongEmail)user.email='foreign@example.invalid';
      if(options.wrongRole)user.role='service_role';
      if(options.changedFactorAfterFresh&&signIns===2)user.factors[0].id=id(777);
      return json(user);
    }
    if(url.endsWith('/logout?scope=local'))return options.logoutFailure?json({error:'SECRET SERVER TEXT'},500):options.logout200?new Response(''):new Response(null,{status:204});
    if(url===AUTH+'/factors'){
      const body=JSON.parse(init.body);assert.equal(body.factor_type,'totp');assert(!('phone' in body));
      const f={id:id(10+actors.indexOf(session.actor)),factor_type:'totp',status:'unverified'};session.actor.factors.push(f);
      if(options.lostEnrollment)throw Error('LOST RESPONSE '+SECRET);
      return json({id:f.id,type:'totp',totp:{secret:SECRET,qr_code:'PRIVATE_QR',uri:'PRIVATE_URI'}});
    }
    const match=url.match(/\/factors\/([^/]+)\/(challenge|verify)$/);assert(match);
    const factor=session.actor.factors.find(x=>x.id===match[1]);assert(factor);
    if(match[2]==='challenge')return json({id:options.badChallenge?'bad':id(900)});
    const body=JSON.parse(init.body);assert.equal(body.challenge_id,id(900));assert(/^\d{6}$/.test(body.code));verifyCount++;
    if(options.badCode&&rejections++<options.badCode)return json({code:'mfa_verification_failed',message:'PRIVATE SERVER MESSAGE '+SECRET},422);
    factor.status='verified';return json({access_token:token(session.actor,session.session,'aal2'),refresh_token:'ALSO_NOT_PERSISTED'});
  };
  return {io,fetcher,calls,displays,notices,actors,get verifyCount(){return verifyCount;}};
}
const run=async(options={})=>{const f=fixture(options);return {f,r:await runOperatorMfa({emails,io:f.io,fetcher:f.fetcher})};};
test('two new actors enroll once each, prove four AAL2 sessions with fresh session IDs, and use four local logouts',async()=>{
  const {f,r}=await run();assert.equal(r.result,'STAGING_TWO_OPERATOR_TOTP_AND_FRESH_AUTH_SESSIONS_SCOPED_PASS');
  assert.equal(f.displays.length,2);assert.equal(f.verifyCount,4);assert.equal(r.requests_attempted,27);
  assert.equal(f.calls.filter(c=>c.url===AUTH+'/factors').length,2);
  assert.equal(f.calls.filter(c=>c.url.endsWith('/logout?scope=local')).length,4);
  assert(r.accounts.every(a=>a.initial_TOTP_and_AAL2_verified&&a.fresh_password_session_and_TOTP_AAL2_verified&&a.local_logout_confirmed));
  assert.equal(r.fresh_password_and_TOTP_sessions_verified,true);assert.equal(r.hosted_acceptance,false);
});
test('exactly one verified existing factor is reused without enrollment or secret display',async()=>{
  const {f,r}=await run({existing:true});assert.equal(r.problem_code,null);assert.equal(f.displays.length,0);
  assert(r.accounts.every(a=>a.existing_verified_factor_reused));assert.equal(r.enrollment_request_attempted,false);
});
test('unverified existing factor blocks duplicate enrollment and is left untouched',async()=>{
  const {f,r}=await run({pending:true});assert.equal(r.problem_code,'EXISTING_FACTORS_REQUIRE_REVIEW');
  assert.equal(f.displays.length,0);assert.equal(f.actors[0].factors.length,1);assert.equal(f.actors[0].factors[0].status,'unverified');
  assert.equal(r.all_created_sessions_local_logout_confirmed,true);assert(!f.calls.some(x=>x.init.method==='DELETE'));
});
test('multiple factors require review instead of selecting or removing one',async()=>{const {r}=await run({multiple:true});assert.equal(r.problem_code,'EXISTING_FACTORS_REQUIRE_REVIEW');});
for(const [option,code]of [['badIssuer','SESSION_CONSTRAINT_REJECTED'],['wrongEmail','AUTHENTICATED_ACTOR_REJECTED'],['wrongRole','AUTHENTICATED_ACTOR_REJECTED'],['badAal','SESSION_CONSTRAINT_REJECTED'],['verifyActorSwitch','SESSION_CONSTRAINT_REJECTED'],['verifySessionSwitch','SESSION_CONSTRAINT_REJECTED'],['sameFreshSession','FRESH_SESSION_NOT_DISTINCT'],['changedFactorAfterFresh','FACTOR_STATE_CHANGED'],['badChallenge','CHALLENGE_SHAPE_REJECTED']]) {
  test(option+' is rejected with no successful MFA acceptance and local logout attempted',async()=>{
    const {f,r}=await run({[option]:true});assert.equal(r.problem_code,code);assert.equal(r.fresh_password_and_TOTP_sessions_verified,false);
    assert(f.calls.some(c=>c.url.endsWith('/logout?scope=local')));
  });
}
test('a rejected code can be retried, without a second enrollment',async()=>{const {f,r}=await run({badCode:1});assert.equal(r.problem_code,null);assert.equal(f.displays.length,2);assert(f.notices.includes('CODE_NOT_ACCEPTED_TRY_CURRENT_CODE'));});
test('bounded failed-code retries preserve pending factor and require review',async()=>{const {f,r}=await run({badCode:3});assert.equal(r.problem_code,'TOTP_RETRIES_EXHAUSTED');assert.equal(f.verifyCount,3);assert(r.factor_state_may_require_review);assert.equal(f.actors[0].factors[0].status,'unverified');});
test('lost enrollment response is reported without re-enrollment or blind cleanup',async()=>{const {f,r}=await run({lostEnrollment:true});assert.equal(r.problem_code,'HTTP_TRANSPORT_FAILED');assert(r.enrollment_request_attempted&&r.factor_state_may_require_review);assert.equal(f.calls.filter(x=>x.url===AUTH+'/factors').length,1);assert.equal(f.actors[0].factors.length,1);});
test('logout failure overrides success and leaves session-cleanup review explicit',async()=>{const {r}=await run({logoutFailure:true});assert.equal(r.problem_code,'LOCAL_LOGOUT_NOT_CONFIRMED');assert.equal(r.all_created_sessions_local_logout_confirmed,false);assert.equal(r.fresh_password_and_TOTP_sessions_verified,false);});
test('successful local logout also accepts a 200 empty response',async()=>{const {r}=await run({logout200:true});assert.equal(r.problem_code,null);assert(r.all_created_sessions_local_logout_confirmed);});
test('missing password-session response reports uncertain session creation without printing provider text',async()=>{const {r}=await run({missingSession:true});assert.equal(r.problem_code,'PASSWORD_SESSION_MISSING');assert(r.password_session_creation_state_may_require_review);assert(!JSON.stringify(r).includes('PRIVATE PASSWORD'));});
test('cancelled private setup still attempts local logout and preserves created factor for exact review',async()=>{const {r}=await run({cancelSetup:true});assert.equal(r.problem_code,'LOCAL_SETUP_ERROR');assert(r.enrollment_request_attempted&&r.factor_state_may_require_review);assert(r.all_created_sessions_local_logout_confirmed);});
test('invalid isolated actor inputs fail before any HTTP request',async()=>{
 for(const selected of [[emails[0],emails[0]],['audit.owner@example.com',emails[1]],['bad',emails[1]]]){
  const f=fixture();const r=await runOperatorMfa({emails:selected,io:f.io,fetcher:f.fetcher});assert.equal(r.problem_code,'TWO_DISTINCT_ISOLATED_EMAILS_REQUIRED');assert.equal(f.calls.length,0);
 }
 assert.deepEqual(validateEmails([' X@EXAMPLE.INVALID ',emails[1]]),['x@example.invalid',emails[1]]);
});
test('production, push and secret-key configurations are refused before any Auth request',async()=>{
 for(const body of [config.replace('dczlddwbtgvfdujgcitb','kttkospkblwvguuwnhjj'),config.replace(KEY,'sb_secret_rejected'),config.replace('"vapidPublicKey":""','"vapidPublicKey":"enabled"'),'window.MUSHAVO_BUDGET_CONFIG = evil();']){
  const {f,r}=await run({configBody:body});assert(r.problem_code?.startsWith('STAGING_CONFIG'));assert.equal(f.calls.length,1);
 }
 assert.equal(parseConfig('window.MUSHAVO_BUDGET_CONFIG = '+config+';'),KEY);
});
test('redirect and transport failure cannot advance to Auth or print raw errors',async()=>{
 for(const opts of [{redirectConfig:true},{throwTransport:true}]){const {f,r}=await run(opts);assert(r.problem_code);assert.equal(f.calls.length,1);assert(!JSON.stringify(r).includes('PRIVATE TRANSPORT'));}
});
test('HTTP body reader enforces byte limits and rejects malformed UTF8',async()=>{
 await assert.rejects(boundedBody(new Response('x'.repeat(100)),10),/HTTP_RESPONSE_TOO_LARGE/);
 await assert.rejects(boundedBody(new Response(new Uint8Array([0xff]))));
 assert.equal(await boundedBody(new Response('valid')),'valid');
});
test('safe receipt excludes emails, IDs, passwords, setup material, key and JWTs',async()=>{
 const {r}=await run();const text=JSON.stringify(r);for(const value of [...emails,id(1),id(10),'synthetic-password',SECRET,KEY,'header.','PRIVATE_QR','PRIVATE_URI','NOT_PERSISTED'])assert(!text.includes(value),value);
});
test('fresh verification cannot reuse the previous TOTP value and never silently waits',async()=>{
 const f=fixture();f.io.code=async()=> '123456';const r=await runOperatorMfa({emails,io:f.io,fetcher:f.fetcher});
 assert.equal(r.problem_code,'TOTP_RETRIES_EXHAUSTED');assert.equal(f.verifyCount,1);assert(f.notices.includes('WAIT_FOR_A_NEW_AUTHENTICATOR_CODE'));
});
test('CLI rejects missing staging acknowledgement and redirected input before HTTP or prompting for secrets',()=>{
 const cli=fileURLToPath(new URL('../scripts/setup-fr-2-operator-mfa.mjs',import.meta.url));
 for(const [args,code]of [[[],'EXACT_STAGING_ARGUMENT_REQUIRED'],[['--confirm-staging=dczlddwbtgvfdujgcitb'],'PRIVATE_INTERACTIVE_TERMINAL_REQUIRED']]){
  const p=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',input:''});assert.equal(p.status,1);assert.equal(JSON.parse(p.stdout).problem_code,code);assert.equal(p.stderr,'');
 }
});
