import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function page({session={user:{id:'original'},access_token:'old'},read=async()=>({data:{session:null}})}={}){
 const button={id:'retrySignOutButton',textContent:'Retry sign-out',disabled:false};
 const c={state:{session,signingOut:false},authDataEpoch:0,preserveSignInDestination:false,
  supabase:{auth:{getSession:read,signOut:async()=>({error:null})}},
  resetState(){c.state.session=null;c.authDataEpoch++;},setManualSignInIntent(){},showSignOutStatus(m=''){c.message=m;},setView(v){c.view=v;},
  setSubmitting(b,on,label){if(b){b.disabled=on;b.textContent=label;}},
  resumeSharedSignIn(){},applicationSessionKey(){return null;},beginManualSignOut(){c.showSignOutStatus();},removeCurrentDevicePush:async()=>{},
  forgetPushOptIn(){},showToast(){},message:'old failure'};
 vm.runInNewContext(source.slice(source.indexOf('function handleSignedOut()'),source.indexOf('function isInvalidStoredSessionError')),c);
 const start=source.indexOf('async function retrySignOut');
 assert(start>=0,'retry reconciliation must exist');
 vm.runInNewContext(source.slice(start,source.indexOf('function currencyCatalogue',start)),c);
 return {c,button};
}
test('delayed signed-out notification removes stale warning without reload',()=>{
 const {c}=page();c.handleSignedOut();assert.equal(c.message,'');assert.equal(c.view,'auth');assert.equal(c.state.session,null);
});
test('failed request followed by empty session can retry without reloading',async()=>{
 const {c,button}=page();let reads=0;
 c.supabase.auth.signOut=async()=>{c.handleSignedOut();return {error:{code:'network_error'}};};
 c.supabase.auth.getSession=async()=>{reads++;return {data:{session:null}};};
 await c.signOutSafely(button);assert.match(c.message,/session may still be active/);assert.equal(c.state.session,null);
 await c.retrySignOut(button);assert.equal(reads,1);assert.equal(c.message,'');assert.equal(c.view,'auth');assert.equal(button.disabled,false);
});
test('retry with active session retries Auth and clears warning on success',async()=>{
 const {c,button}=page();let calls=0;c.supabase.auth.signOut=async()=>{calls++;return {error:null};};
 await c.retrySignOut(button);assert.equal(calls,1);assert.equal(c.message,'');assert.equal(c.state.session,null);assert.equal(button.textContent,'Retry sign-out');
});
test('failed SDK reconciliation preserves an explicit warning and enables retry',async()=>{
 const {c,button}=page({session:null,read:async()=>({error:{code:'network_error'}})});
 await c.retrySignOut(button);assert.match(c.message,/could not be confirmed/);assert.equal(button.disabled,false);assert.equal(c.state.signingOut,false);
});
test('SDK-only replacement session is never revoked by a stale retry',async()=>{
 const replacement={user:{id:'replacement'}};
 const {c,button}=page({session:null,read:async()=>({data:{session:replacement}})});
 c.supabase.auth.signOut=()=>assert.fail('must not revoke replacement');
 await c.retrySignOut(button);assert.match(c.message,/session changed/);assert.equal(c.state.session,null);
});
test('a concurrent account switch wins over delayed reconciliation',async()=>{
 let finish;const {c,button}=page({session:null,read:()=>new Promise(resolve=>finish=resolve)});
 const pending=c.retrySignOut(button);c.state.session={user:{id:'replacement'}};c.authDataEpoch++;c.message='new session UI';
 finish({data:{session:null}});await pending;assert.equal(c.state.session.user.id,'replacement');assert.equal(c.message,'new session UI');
});
test('duplicate retry is suppressed while reconciliation is pending',async()=>{
 let finish,reads=0;const {c,button}=page({session:null,read:()=>{reads++;return new Promise(resolve=>finish=resolve);}});
 const pending=c.retrySignOut(button);await c.retrySignOut(button);assert.equal(reads,1);finish({data:{session:null}});await pending;
});
test('retry button dispatches through reconciliation',()=>assert.match(source,/#retrySignOutButton"[\s\S]*?retrySignOut\(event.currentTarget\)/));

