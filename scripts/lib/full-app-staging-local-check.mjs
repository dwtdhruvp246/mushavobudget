// End-to-end local rehearsal of the hosted browser driver, never a real account/provider.
import https from 'node:https';
import {fullAppPagesFixture as fullAppLocalFixture} from './full-app-pages-fixture.mjs';
import {startFullAppLoopbackBrowser} from './full-app-staging-browser.mjs';
export async function fullAppStagingLocalCheck(executable,modulePath,{failure=null,pagesFailure=null}={}){
 const f=await fullAppLocalFixture(modulePath,{failure,pagesFailure});let browser,opened=false,problem=null,failedCheckpoint=null;
 const read=(url,body)=>new Promise((resolve,reject)=>{const u=new URL(url);if(u.origin!==f.api){reject(Error('LOCAL_ORIGIN_REQUIRED'));return;}const q=https.request(url,{method:'POST',rejectUnauthorized:false,headers:{apikey:f.publishableKey,'Content-Type':'application/json'}},r=>{let b='';r.on('data',x=>{b+=x;if(b.length>65536){q.destroy();reject(Error('LOCAL_RESPONSE_BOUND'));}});r.on('end',()=>{try{resolve(JSON.parse(b));}catch{reject(Error('LOCAL_RESPONSE_REQUIRED'));}});});q.on('error',()=>reject(Error('LOCAL_NETWORK_REQUIRED')));q.end(JSON.stringify(body));});
 let close,inspection;try{
  browser=startFullAppLoopbackBrowser(executable,{origin:f.origin,api:f.api,publishableKey:f.publishableKey});await browser.preflight();const selected=[];
  for(let i=0;i<4;i++){const a=f.actors[i===3?1:0],v=await read(f.api+'/auth/v1/token?grant_type=password',{email:a.email,password:a.password}),c=JSON.parse(Buffer.from(v.access_token.split('.')[1],'base64url'));selected.push({actor:{user:c.sub,session:c.session_id,email:a.email},token:v.access_token,refreshToken:v.refresh_token});}
  await browser.attachSessions(selected);await browser.prove(async()=>f.state.code);await browser.restoreAndBind();opened=true;await f.setWindow(true);await browser.activeWindow(Date.now()+290000);await f.setWindow(false);opened=false;await browser.afterQuarantine();
 }catch(e){const code=e.safeCode||e.message;problem=/^[A-Z][A-Z_0-9]{3,80}$/.test(code)?code:'LOCAL_FULL_APP_REVIEW_REQUIRED';failedCheckpoint=browser?.snapshot().failure_checkpoint||browser?.snapshot().checkpoint||'LOCAL_INPUT';}
 finally{
  if(opened){const state=await f.inspect();if(state.mode!=='QUARANTINED'||state.windows!==0){try{await f.setWindow(false);}catch{const after=await f.inspect();if(after.mode!=='QUARANTINED'||after.windows!==0)problem??='LOCAL_QUARANTINE_REQUIRED';}}}
  await f.cleanup();close=await browser?.close();inspection=await f.inspect();await f.close();
 }
 return {result:problem?'LOCAL_U_HOSTED_DRIVER_REVIEW_REQUIRED':'LOCAL_U_HOSTED_DRIVER_FULL_APP_SCOPED_PASS',failure_scenario:failure,failure_checkpoint:failedCheckpoint,problem_code:problem,browser:close,fixture_state:inspection,synthetic_email_requests:f.state.mail,synthetic_refreshes:f.state.refreshes,synthetic_activity_RPC_writes:f.state.analyticsWrites,synthetic_profile_write_attempts:f.state.profileWriteAttempts,unreviewed_fixture_requests:f.state.unreviewed,SQL_error_codes:[...new Set(f.state.SQL_errors.map(x=>x.code||'LOCAL_ERROR'))],actual_hosted_requests:0,real_email_requests:0,private_packets_or_real_credentials_accessed:false,exit_code:problem?1:0};
}
