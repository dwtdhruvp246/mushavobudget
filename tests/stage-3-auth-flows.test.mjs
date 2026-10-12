import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {validateNewPassword, safeAuthMessage, consumeAuthUrl, isolatedAuthOptions, createLinkController, createPasswordChanger, redirectLegacyAuthLink} from '../auth-security.js';

const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', other='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const invitationId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const password='valid-secret-password';
function harness(flow='recover') {
  const calls=[];
  let current={id,email:'controlled@example.test',email_confirmed_at:'2026-10-11T00:00:00Z'};
  let updateError=null, linkError=null, getUserError=null;
  let rows=[{invitation_id:invitationId,workspace_name:'Synthetic Business',status:'pending',expires_at:'2099-01-01T00:00:00Z'}];
  const session=()=>({user:current,access_token:'synthetic-access',refresh_token:'synthetic-refresh'});
  const client={auth:{
    async setSession(tokens){calls.push(['setSession',tokens]);return linkError?{error:linkError}:{data:{session:session(),user:current}};},
    async verifyOtp(args){calls.push(['verifyOtp',args]);return linkError?{error:linkError}:{data:{session:session()}};},
    async exchangeCodeForSession(code){calls.push(['code',code]);return linkError?{error:linkError}:{data:{session:session()}};},
    async getSession(){calls.push(['getSession']);return {data:{session:session()}};},
    async getUser(){calls.push(['getUser']);return getUserError?{error:getUserError}:{data:{user:current}};},
    async updateUser(args){calls.push(['updateUser',args]);return {error:updateError};},
    async reauthenticate(){calls.push(['reauthenticate']);return {error:null};}
  },async rpc(name){calls.push(['rpc',name]);return {data:rows};}};
  const material={flow,invitation:invitationId,access_token:'synthetic-access',refresh_token:'synthetic-refresh',type:flow==='recover'?'recovery':flow==='confirm'?'signup':flow==='business-new'?'invite':'magiclink'};
  return {client,material,calls,controller:createLinkController(client,material),setUser:u=>current=u,setRows:r=>rows=r,setUpdateError:e=>updateError=e,setLinkError:e=>linkError=e,setUserError:e=>getUserError=e};
}
const count=(h,name)=>h.calls.filter(c=>c[0]===name).length;
test('new-password boundary accepts 12 characters and rejects short/mismatched values',()=>{
  validateNewPassword('123456789012','123456789012');
  assert.throws(()=>validateNewPassword('12345678901','12345678901'),{code:'new_password_too_short'});
  assert.throws(()=>validateNewPassword(password,'different'),{code:'password_mismatch'});
  assert.throws(()=>validateNewPassword('😀'.repeat(6),'😀'.repeat(6)),{code:'new_password_too_short'});
});
test('SDK messages never echo raw callback material',()=>{
  assert.equal(safeAuthMessage({code:'invalid_credentials',message:'synthetic-sensitive'}).includes('synthetic-sensitive'),false);
  assert.match(safeAuthMessage({code:'email_not_confirmed'}),/Confirm your email/);
  assert.match(safeAuthMessage({status:429}),/Wait/);
  assert.match(safeAuthMessage({code:'reauthentication_needed'}),/verification code/);
});
test('capture removes sensitive query and fragment before any asynchronous Auth work',()=>{
  let replaced='';const material=consumeAuthUrl('https://app.test/auth.html?flow=recover&token_hash=synthetic-hash&type=recovery&error_description=synthetic-sensitive#access_token=synthetic-access&refresh_token=synthetic-refresh',value=>replaced=value);
  assert.equal(replaced,'/auth.html?flow=recover');assert.equal(material.token_hash,'synthetic-hash');assert.equal(material.access_token,'synthetic-access');
});
test('link storage is tab-isolated and SDK auto-detection is disabled',()=>{
  const storage={};const options=isolatedAuthOptions({supabaseUrl:'https://project.supabase.co'},storage).auth;
  assert.equal(options.storage,storage);assert.equal(options.storageKey,'mushavo-invitation-project');assert.equal(options.detectSessionInUrl,false);
});
test('legacy Business callback redirects before normal app Auth can adopt it',()=>{
  let next;assert.equal(redirectLegacyAuthLink('https://app.test/business.html?invitation='+invitationId+'#access_token=synthetic&refresh_token=synthetic&type=invite','business',url=>next=url),true);
  assert.equal(new URL(next).searchParams.get('flow'),'business-new');assert.equal(new URL(next).searchParams.get('invitation'),invitationId);
});
test('legacy ordinary recovery reaches recovery page; normal workspace links are preserved',()=>{
  let next;assert.equal(redirectLegacyAuthLink('https://app.test/app.html#access_token=synthetic&refresh_token=synthetic&type=recovery','budget',url=>next=url),true);
  assert.equal(new URL(next).searchParams.get('flow'),'recover');
  assert.equal(redirectLegacyAuthLink('https://app.test/business.html?invitation='+invitationId+'#business/team','business',()=>assert.fail()),false);
});
test('a recovery flag without link material never loads an existing session',async()=>{
  const h=harness(); const c=createLinkController(h.client,{flow:'recover'});
  await assert.rejects(c.verify(),{code:'link_unavailable'});assert.equal(h.calls.length,0);
});
test('Auth callback errors stop without accepting a stored session',async()=>{
  const h=harness();h.material.error='access_denied';await assert.rejects(h.controller.verify(),{code:'link_unavailable'});assert.equal(h.calls.length,0);
});
test('expired token-hash links stop before user lookup or password mutation',async()=>{
  const h=harness();h.material.token_hash='expired';h.setLinkError({code:'otp_expired'});
  await assert.rejects(h.controller.verify(),{code:'otp_expired'});assert.equal(count(h,'getUser'),0);assert.equal(count(h,'updateUser'),0);
});
test('wrong callback type is rejected before token-hash verification',async()=>{
  const h=harness();h.material.token_hash='hash';h.material.type='signup';await assert.rejects(h.controller.verify(),{code:'link_unavailable'});assert.equal(count(h,'verifyOtp'),0);
});
test('PKCE code exchange is validated through server getUser',async()=>{
  const h=harness('confirm');h.material.code='synthetic-code';await h.controller.verify();assert.equal(count(h,'code'),1);assert.equal(count(h,'getUser'),1);
});
test('server identity disagreement with link session stops verification',async()=>{
  const h=harness();const original=h.client.auth.setSession;
  h.client.auth.setSession=async tokens=>{const r=await original(tokens);return {data:{session:{...r.data.session,user:{id:other}}}};};
  await assert.rejects(h.controller.verify(),{code:'identity_mismatch'});assert.equal(h.controller.user,null);
});
test('unconfirmed link user remains blocked',async()=>{
  const h=harness();h.setUser({id,email:'controlled@example.test'});await assert.rejects(h.controller.verify(),{code:'email_not_confirmed'});
});
test('ordinary confirmation cannot change a password',async()=>{
  const h=harness('confirm');await h.controller.verify();await assert.rejects(h.controller.save(password,password),{code:'link_unavailable'});assert.equal(count(h,'updateUser'),0);
});
test('verified recovery checks strength and identity before password write',async()=>{
  const h=harness();await h.controller.verify();await assert.rejects(h.controller.save('short','short'),{code:'new_password_too_short'});assert.equal(count(h,'updateUser'),0);
  await h.controller.save(password,password);assert.equal(h.controller.passwordSaved,true);assert.deepEqual(h.calls.find(c=>c[0]==='updateUser')[1],{password});
});
test('changing the isolated recovery identity blocks the write',async()=>{
  const h=harness();await h.controller.verify();h.setUser({id:other,email_confirmed_at:'today'});await assert.rejects(h.controller.save(password,password),{code:'identity_mismatch'});assert.equal(count(h,'updateUser'),0);
});
test('initial same-password or backend strength error does not report recovery success',async()=>{
  for(const code of ['same_password','weak_password']) {const h=harness();await h.controller.verify();h.setUpdateError({code});await assert.rejects(h.controller.save(password,password),{code});assert.equal(h.controller.passwordSaved,false);}
});
test('a successful password write can retry after a transient post-write verification error',async()=>{
  const h=harness();await h.controller.verify();const getUser=h.client.auth.getUser;let calls=0;
  h.client.auth.getUser=async()=>++calls===2?{error:{code:'network_error'}}:getUser();
  await assert.rejects(h.controller.save(password,password),{code:'network_error'});assert.equal(h.controller.passwordSaved,true);
  h.setUpdateError({code:'same_password'});await h.controller.save(password,password);
});
test('recovery cannot adopt an app session before successful password save',async()=>{
  const h=harness();await h.controller.verify();const app=harness('confirm');await assert.rejects(h.controller.continueToApp(app.client,true),{code:'link_unavailable'});assert.equal(app.calls.length,0);
});
test('app adoption always requires deliberate acknowledgment',async()=>{
  const h=harness('confirm');await h.controller.verify();const app=harness('confirm');await assert.rejects(h.controller.continueToApp(app.client,false),{code:'link_unavailable'});assert.equal(app.calls.length,0);
});
test('verified session transfer checks the adopted user and returns fixed destination',async()=>{
  const h=harness('confirm');await h.controller.verify();const app=harness('confirm');assert.equal(await h.controller.continueToApp(app.client,true),'./app.html');assert.equal(count(app,'setSession'),1);
});
test('adopted server identity mismatch is reported rather than navigating',async()=>{
  const h=harness('confirm');await h.controller.verify();const app=harness('confirm');app.setUser({id:other});await assert.rejects(h.controller.continueToApp(app.client,true),{code:'identity_mismatch'});
});
test('Business link requires a server-visible pending recipient invitation',async()=>{
  const h=harness('business-new');h.setRows([]);await assert.rejects(h.controller.verify(),{code:'business_invitation_unavailable'});assert.equal(count(h,'updateUser'),0);
});
test('expired or accepted Business invitation is unavailable for first-password setup',async()=>{
  for(const row of [{status:'pending',expires_at:'2000-01-01'},{status:'accepted',expires_at:'2099-01-01'}]) {const h=harness('business-new');h.setRows([{invitation_id:invitationId,...row}]);await assert.rejects(h.controller.verify(),{code:'business_invitation_unavailable'});}
});
test('Business state is rechecked before password mutation',async()=>{
  const h=harness('business-new');await h.controller.verify();h.setRows([]);await assert.rejects(h.controller.save(password,password),{code:'business_invitation_unavailable'});assert.equal(count(h,'updateUser'),0);
});
test('existing Business recipient continues without overwriting a password',async()=>{
  const h=harness('business-existing');await h.controller.verify();await assert.rejects(h.controller.save(password,password),{code:'link_unavailable'});
  const app=harness('confirm');assert.match(await h.controller.continueToApp(app.client,true),/^\.\/business\.html\?invitation=.*#business\/team$/);assert.equal(count(h,'updateUser'),0);
});
test('new Business recipient saves password before adopting, without accepting membership',async()=>{
  const h=harness('business-new');await h.controller.verify();await h.controller.save(password,password);const app=harness('confirm');await h.controller.continueToApp(app.client,true);
  assert.equal(count(h,'updateUser'),1);assert.equal(h.calls.some(c=>c[0]==='rpc'&&c[1]==='respond_business_invitation'),false);
});
test('signed-in change carries nonce/current password and checks the displayed identity',async()=>{
  const h=harness();const changer=createPasswordChanger(h.client);await changer.verify();await changer.requestCode();await changer.save(password,password,'synthetic-code','old-password');
  assert.equal(count(h,'reauthenticate'),1);assert.deepEqual(h.calls.find(c=>c[0]==='updateUser')[1],{password,nonce:'synthetic-code',current_password:'old-password'});
});
test('signed-in change and code dispatch reject a switched account',async()=>{
  const h=harness();const changer=createPasswordChanger(h.client);await changer.verify();h.setUser({id:other});await assert.rejects(changer.save(password,password),{code:'identity_mismatch'});await assert.rejects(changer.requestCode(),{code:'identity_mismatch'});assert.equal(count(h,'updateUser'),0);assert.equal(count(h,'reauthenticate'),0);
});
test('secure-change errors leave the signed-in password operation retryable',async()=>{
  const h=harness();const changer=createPasswordChanger(h.client);await changer.verify();h.setUpdateError({code:'reauthentication_needed'});await assert.rejects(changer.save(password,password),{code:'reauthentication_needed'});h.setUpdateError(null);await changer.save(password,password,'latest-code');
});

const appSource=await readFile(new URL('../app.js',import.meta.url),'utf8');
const businessSource=await readFile(new URL('../business.js',import.meta.url),'utf8');
test('application ignores only its own password-sign-in event; another account is cleared and rebound immediately',()=>{
  let handler;const events=[],timers=[];
  const context={state:{session:{user:{id,email:'controlled@example.test'}},isAdmin:false},signInInProgress:true,signInExpectedEmail:'controlled@example.test',authDataEpoch:0,
    supabase:{auth:{onAuthStateChange:fn=>handler=fn},realtime:{setAuth(){}}},isSameAuthUser:(a,b)=>a?.user?.id===b?.user?.id,
    adminMfa:{bind(){},lock(){}},clearAdministrativeData(){},resetState(){context.authDataEpoch++;context.state.session=null;events.push('reset');},setView:value=>events.push(value),
    window:{setTimeout:fn=>timers.push(fn)},openAuthenticatedSession:async()=>{},handleLoadFailure(){},handleSignedOut(){}};
  const callback=appSource.match(/supabase.auth.onAuthStateChange\(\(event, session\) => \{[\s\S]*?\n  \}\);/)[0];
  vm.runInNewContext(callback,context);handler('SIGNED_IN',{user:{id,email:'controlled@example.test'}});assert.equal(events.length,0);
  handler('SIGNED_IN',{user:{id:other,email:'other@example.test'}});assert.deepEqual(events,['reset','loading']);assert.equal(context.state.session.user.id,other);assert.equal(timers.length,1);
});
test('duplicate signup uses confirmation-pending destination without extra email or password mutation',async()=>{
  const signup=await readFile(new URL('../signup.html',import.meta.url),'utf8');const helper=signup.match(/      async function offerVerifiedSelfSignup\([\s\S]*?\n      }/)[0];
  const navigations=[],context={URL,URLSearchParams,form:{},window:{location:{href:'https://app.test/signup.html',search:'',replace:value=>navigations.push(value)},MushavoPWA:{markFormClean(){}}}};
  vm.runInNewContext(helper,context);await context.offerVerifiedSelfSignup(new Proxy({},{get(){assert.fail('duplicate signup must not send another email');}}),'controlled@example.test');assert.equal(navigations[0],'https://app.test/app.html?signup=pending');
});
function appLogout(cleanupFails=false, authFails=false) {
  const messages=[], context={state:{session:{user:{id}}},supabase:{auth:{async signOut(){context.authCalls++;return {error:authFails?{code:'network_error'}:null};}}},authCalls:0,
    setSubmitting(){}, async removeCurrentDevicePush(){if(cleanupFails)throw Error('cleanup');},forgetPushOptIn(){context.forgot=true;},handleSignedOut(){context.state.session=null;},showToast:m=>messages.push(m)};
  vm.runInNewContext(appSource.slice(appSource.indexOf('async function signOutSafely'),appSource.indexOf('function currencyCatalogue')),context);
  return {context,messages};
}
test('push cleanup failure still executes Auth logout and clears successful session',async()=>{
  const h=appLogout(true);await h.context.signOutSafely();assert.equal(h.context.authCalls,1);assert.equal(h.context.state.session,null);assert.match(h.messages[0],/cleanup could not finish/);assert.equal(h.context.forgot,undefined);
});
test('Auth logout failure reports an active-session risk and permits retry',async()=>{
  const h=appLogout(false,true);await h.context.signOutSafely();assert.equal(h.context.authCalls,1);assert.equal(h.context.state.session.user.id,id);assert.match(h.messages[0],/session may still be active/);
});
test('account switch during push cleanup never logs out the replacement account',async()=>{
  const h=appLogout();h.context.removeCurrentDevicePush=async()=>{h.context.state.session={user:{id:other}};};await h.context.signOutSafely();assert.equal(h.context.authCalls,0);
});
test('application query rejects a delayed old-account result after reset',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);
  const context={authDataEpoch:0,window:{setTimeout,clearTimeout},QUERY_TIMEOUT_MS:1000,console};
  vm.runInNewContext(appSource.slice(appSource.indexOf('async function query('),appSource.indexOf('async function init()')),context);
  const request=context.query('synthetic',pending);context.authDataEpoch++;finish({data:{private:'old'}});await assert.rejects(request,{code:'session_changed'});
});
test('application query preserves Auth error codes for safe confirmation/rate guidance',async()=>{
  const context={authDataEpoch:0,window:{setTimeout,clearTimeout},QUERY_TIMEOUT_MS:1000,console:{warn(){}}};vm.runInNewContext(appSource.slice(appSource.indexOf('async function query('),appSource.indexOf('async function init()')),context);
  await assert.rejects(context.query('sign in',Promise.resolve({error:{code:'email_not_confirmed',message:'not confirmed',status:400}})),{code:'email_not_confirmed',status:400});
});
test('Business query rejects delayed old-account data',async()=>{
  let finish;const pending=new Promise(resolve=>finish=resolve);const context={businessAuthEpoch:0};vm.runInNewContext(businessSource.slice(businessSource.indexOf('async function query('),businessSource.indexOf('function selectedWorkspaceStorageKey')),context);
  const request=context.query('synthetic',pending);context.businessAuthEpoch++;finish({data:['old']});await assert.rejects(request,{code:'session_changed'});
});
test('Business logout error does not navigate as if sign-out succeeded',async()=>{
  const message={};let navigations=0,cleared=0;const context={businessSignOutInProgress:false,businessAuthEpoch:0,state:{session:{user:{id}}},removeBusinessDevicePush:async()=>{},supabase:{auth:{async signOut(){return {error:{code:'network_error'}};}}},window:{setTimeout,clearTimeout,location:{replace(){navigations++;}}},$:()=>message,clearBusinessWorkspaceState(){cleared++;},showOnly(){}};
  vm.runInNewContext(businessSource.slice(businessSource.indexOf('async function signOut()'),businessSource.indexOf('function leaveBusiness(')),context);await context.signOut();assert.equal(navigations,0);assert.equal(cleared,0);assert.match(message.textContent,/session may still be active/);
});
test('Business Auth switch clears all access state before deferred reload',()=>{
  let handler;const events=[],timer=[];const context={authLinkRedirect:false,state:{session:{user:{id}},profile:{id},workspaces:[{id}],memberships:[{id}],incomingInvitations:[{id}],supportedCurrencies:['USD']},businessAuthEpoch:0,appOpening:true,
    supabase:{auth:{onAuthStateChange(callback){handler=callback;}},realtime:{setAuth(){}}},clearBusinessWorkspaceState(){events.push('clear');},showOnly:view=>events.push(view),window:{setTimeout:callback=>timer.push(callback)},loadBusinessAccess(){events.push('load');}};
  vm.runInNewContext(businessSource.slice(businessSource.lastIndexOf('supabase?.auth.onAuthStateChange')),context);
  events.length=0;handler('SIGNED_IN',{user:{id:other}});assert.deepEqual(events,['clear','businessLoading']);assert.equal(context.state.profile,null);assert.equal(context.state.workspaces.length,0);assert.equal(context.state.incomingInvitations.length,0);assert.equal(context.state.session.user.id,other);timer[0]();assert.equal(events.at(-1),'load');
});
