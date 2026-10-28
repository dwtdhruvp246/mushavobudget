import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
const part=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);};
const actor='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const session=()=>({user:{id:actor,email:'controlled@example.invalid'},access_token:'synthetic-current',refresh_token:'synthetic-refresh'});
function page({url='https://mushavo-budget-staging.pages.dev/app.html?auth=signed-out',stored=session(),cleanup=async()=>{},logoutError=null,loginError=null}={}){
 const events=[],messages=[],scheduled=[],nodes={},location={href:url};let current=stored,listener;
 Object.defineProperty(location,'pathname',{get:()=>new URL(location.href).pathname});
 for(const id of ['signOutStatus','signOutStatusMessage','email','password'])nodes[id]={value:'',textContent:'',hidden:true,classList:{toggle(name,on){nodes[id].hidden=on;}}};
 nodes.email.value='controlled@example.invalid';nodes.password.value='Eight888';
 const c={URL,URLSearchParams,Promise,Error,console:{error(){}},state:{session:null,manualSignInRequired:['manual','signed-out','expired'].includes(new URL(url).searchParams.get('auth')),signingOut:false},isConfigured:true,signInInProgress:false,signInExpectedEmail:null,preserveSignInDestination:false,authDataEpoch:0,appLoadPromise:null,appLoadUserId:null,appLoadToken:null,
  window:{location,history:{replaceState(a,b,href){location.href=new URL(href,location.href).href;events.push('url');}},setTimeout:fn=>scheduled.push(fn)},
  supabase:{auth:{async getSession(){return{data:{session:current},error:null};},onAuthStateChange(fn){listener=fn;},async signOut(){events.push('logout');if(logoutError)return{error:logoutError};current=null;listener?.('SIGNED_OUT',null);return{error:null};},async signInWithPassword(){events.push('password-signin');if(loginError)return{error:loginError};current=session();listener?.('SIGNED_IN',current);return{data:{session:current},error:null};}},realtime:{setAuth:()=>events.push('realtime')}},
  emailEntry:{authorized:false,bind:()=>events.push('email-lock')},adminSession:{bind:()=>events.push('admin-lock')},
  $:s=>nodes[s.slice(1)],showLoading:()=>events.push('loading'),setView:view=>events.push('view:'+view),showToast:m=>messages.push(m),showSignupSuccessMessage(){},showSignOutStatus:message=>{nodes.signOutStatusMessage.textContent=message;nodes.signOutStatus.hidden=!message;},applyRouteFromHash(){},assertSupabase(){},safeAuthMessage:()=> 'The active account changed.',
  clearApplicationPrivateData:()=>events.push('clear-private'),clearAdministrativeData(){},resetState(){c.state.session=null;events.push('reset');},isSameAuthUser:(a,b)=>a?.user?.id===b?.user?.id,
  openAuthenticatedSession:async s=>events.push('protected-open:'+s.user.id),handleLoadFailure:async()=>events.push('load-error'),setSubmitting(){},removeCurrentDevicePush:cleanup,forgetPushOptIn:()=>events.push('forget-push'),query:async(label,promise)=>{const r=await promise;if(r.error)throw r.error;return r.data;}};
 vm.createContext(c);
 if(source.includes('function requiresManualSignIn('))vm.runInContext(part('function requiresManualSignIn(','function isSameAuthUser('),c);
 if(source.includes('function showSignOutStatus('))vm.runInContext(part('function showSignOutStatus(','function showLoading('),c);
 vm.runInContext(part('async function init()','function isInvalidStoredSessionError('),c);
 vm.runInContext(part('async function signOutSafely(','function currencyCatalogue('),c);
 vm.runInContext(part('async function signIn(event)','async function createFamily('),c);
 return{c,events,messages,nodes,location,scheduled,emit(event,next){current=next;listener?.(event,next);},stored:()=>current,logoutError:value=>logoutError=value};
}
test('reload of an explicit signed-out route does not restore a leftover session into verification',async()=>{
 const h=page();await h.c.init();assert(!h.events.some(x=>x.startsWith('protected-open:')));assert.equal(h.events.at(-1),'view:auth');
});

test('manual, signed-out and expired navigation intents all stay on sign-in with an existing SDK session',async()=>{
 for(const flag of ['manual','signed-out','expired']){const h=page({url:'https://mushavo-budget-staging.pages.dev/app.html?auth='+flag});await h.c.init();assert.equal(h.c.requiresManualSignIn(h.location.href),true);assert(!h.events.some(x=>x.startsWith('protected-open:')));assert.equal(h.events.at(-1),'view:auth');}
});
test('ordinary saved-session startup still follows the protected app path',async()=>{
 const h=page({url:'https://mushavo-budget-staging.pages.dev/app.html'});await h.c.init();assert.equal(h.c.requiresManualSignIn(h.location.href),false);assert.equal(h.events.filter(x=>x.startsWith('protected-open:')).length,1);
});
test('a completed sign-out reload has no session, no warning and no protected entry',async()=>{
 const h=page({stored:null});await h.c.init();assert.equal(h.c.state.session,null);assert.equal(h.nodes.signOutStatus.hidden,true);assert(!h.events.some(x=>x.startsWith('protected-open:')));
});
test('sign-out records manual navigation and clears private views before delayed push cleanup can finish',async()=>{
 let release;const waiting=new Promise(r=>release=r),h=page({url:'https://mushavo-budget-staging.pages.dev/app.html',cleanup:()=>waiting});await h.c.init();h.events.length=0;
 const leaving=h.c.signOutSafely();assert.equal(new URL(h.location.href).searchParams.get('auth'),'signed-out');assert.equal(h.c.state.manualSignInRequired,true);assert(h.events.includes('email-lock'));assert(h.events.includes('clear-private'));assert(!h.events.includes('logout'));
 const reloaded=page({url:h.location.href,stored:h.stored()});await reloaded.c.init();assert(!reloaded.events.some(x=>x.startsWith('protected-open:')));assert.equal(reloaded.events.at(-1),'view:auth');assert.equal(reloaded.nodes.signOutStatus.hidden,false);
 release();await leaving;assert.equal(h.c.state.session,null);assert.equal(h.c.state.signingOut,false);assert.equal(h.events.at(-1),'view:auth');
});
test('a sign-out error remains visible on the sign-in page and permits an explicit retry',async()=>{
 const h=page({url:'https://mushavo-budget-staging.pages.dev/app.html',logoutError:{code:'network_error'}});await h.c.init();h.events.length=0;await h.c.signOutSafely();assert.equal(h.c.state.session.user.id,actor);assert.equal(h.c.state.manualSignInRequired,true);assert.equal(h.c.state.signingOut,false);assert.equal(h.nodes.signOutStatus.hidden,false);assert.match(h.nodes.signOutStatusMessage.textContent,/session may still be active/);assert(!h.events.some(x=>x.startsWith('protected-open:')));
 h.logoutError(null);await h.c.signOutSafely();assert.equal(h.c.state.session,null);assert.equal(h.nodes.signOutStatus.hidden,true);assert.equal(h.events.at(-1),'view:auth');
});
test('refresh and cross-tab sign-in events cannot reopen an explicit manual sign-in page',async()=>{
 const h=page();await h.c.init();h.events.length=0;
 for(const event of ['TOKEN_REFRESHED','SIGNED_IN'])h.emit(event,{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},access_token:'replacement'});
 assert(!h.events.some(x=>x.startsWith('protected-open:')));assert.equal(h.c.state.manualSignInRequired,true);assert.equal(h.scheduled.length,0);
});
test('a replacement account during cleanup is not signed out',async()=>{
 let release;const waiting=new Promise(r=>release=r),h=page({url:'https://mushavo-budget-staging.pages.dev/app.html',cleanup:()=>waiting});await h.c.init();h.events.length=0;const leaving=h.c.signOutSafely();h.emit('SIGNED_IN',{user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'},access_token:'replacement'});release();await leaving;assert(!h.events.includes('logout'));assert.equal(h.c.state.session.user.id,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');assert.equal(h.events.at(-1),'view:auth');
});
test('a repeated sign-out click shares the existing attempt rather than issuing another logout',async()=>{
 let release,cleanups=0;const waiting=new Promise(r=>release=r),h=page({url:'https://mushavo-budget-staging.pages.dev/app.html',cleanup:()=>{cleanups++;return waiting;}});await h.c.init();const first=h.c.signOutSafely();await h.c.signOutSafely();assert.equal(cleanups,1);release();await first;assert.equal(h.events.filter(x=>x==='logout').length,1);
});
test('manual sign-in only resumes after successful password authentication with the same current session',async()=>{
 const h=page();await h.c.init();h.events.length=0;await h.c.signIn({preventDefault(){},submitter:{disabled:false,textContent:'Sign in'}});assert.equal(h.c.state.manualSignInRequired,false);assert.equal(new URL(h.location.href).searchParams.has('auth'),false);assert.equal(h.events.filter(x=>x.startsWith('protected-open:')).length,1);
});
test('a rejected password cannot clear manual intent or restore the previous stored account',async()=>{
 const h=page({loginError:{code:'invalid_credentials'}});await h.c.init();h.events.length=0;await h.c.signIn({preventDefault(){},submitter:{}});h.emit('TOKEN_REFRESHED',session());assert.equal(h.c.state.manualSignInRequired,true);assert(!h.events.some(x=>x.startsWith('protected-open:')));assert.equal(h.events.at(-1),'view:auth');
});
test('an account/token race after password authentication keeps manual sign-in locked',async()=>{
 const h=page();await h.c.init();h.events.length=0;h.c.supabase.auth.getSession=async()=>({data:{session:{user:{id:actor},access_token:'foreign-session-token'}},error:null});await h.c.signIn({preventDefault(){},submitter:{}});assert.equal(h.c.state.manualSignInRequired,true);assert(!h.events.some(x=>x.startsWith('protected-open:')));assert.equal(h.events.at(-1),'view:auth');
});
test('sign-out intent removes callback material from the reload address',()=>{
 const h=page({url:'https://mushavo-budget-staging.pages.dev/app.html?code=SYNTHETIC_PRIVATE#access_token=SYNTHETIC_PRIVATE'});h.c.setManualSignInIntent('signed-out');assert.equal(h.location.href,'https://mushavo-budget-staging.pages.dev/app.html?auth=signed-out');
});
test('real Personal and Admin entry bindings expose no session while manual sign-in is required',()=>{
 const options=[],c={state:{manualSignInRequired:true,session:session()},createSessionEntry:x=>{options.push(x);return{};},supabase:{},views:{emailVerification:{},adminSession:{}}};vm.createContext(c);vm.runInContext(part('const emailEntry=createSessionEntry(','function clearApplicationPrivateData()'),c);assert.equal(options.length,2);for(const item of options)assert.equal(item.getSession(),null);c.state.manualSignInRequired=false;for(const item of options)assert.equal(item.getSession().user.id,actor);
});
