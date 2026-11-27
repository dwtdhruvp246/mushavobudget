// Real Deno + real imported SDK/entrypoints; only HTTP and env inputs are synthetic.
import assert from 'node:assert/strict';
const origin='https://mushavo-budget-staging.pages.dev';
const api='https://dczlddwbtgvfdujgcitb.supabase.co';
const actor='00000000-0000-4000-8000-000000008401';
const token='eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDg0MDEifQ.c3ludGhldGlj';
const settings:Record<string,string>={APP_ORIGIN:origin,SUPABASE_URL:api,SUPABASE_ANON_KEY:'sb_publishable_SYNTHETIC',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC',VAPID_PUBLIC_KEY:'SYNTHETIC_PUBLIC',VAPID_PRIVATE_KEY:'SYNTHETIC_PRIVATE',VAPID_SUBJECT:'mailto:synthetic@example.invalid',CURRENCYAPI_API_KEY:'SYNTHETIC_PROVIDER',CURRENCY_SYNC_SECRET:'SYNTHETIC_CRON'};
let handler:(r:Request)=>Promise<Response>,mode='false',unexpected=0;
let calls:Array<{path:string,bearer:string|null,body:unknown}>=[];
const checks:Array<{check:string,status:string}>=[];
Deno.env.get=(key:string)=>settings[key];
Deno.serve=((fn:typeof handler)=>{handler=fn;return {shutdown:async()=>{}};}) as typeof Deno.serve;
const json=(x:unknown,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
globalThis.fetch=(async(input:Request|string|URL,init?:RequestInit)=>{
 const request=new Request(input,init),u=new URL(request.url);let body:unknown=null;if(request.method!=='GET'&&request.method!=='HEAD')body=await request.json().catch(()=>null);
 calls.push({path:u.pathname,bearer:request.headers.get('authorization'),body});
 assert.equal(u.origin,api);
 if(u.pathname==='/auth/v1/user'){
  assert.equal(request.headers.get('authorization'),'Bearer '+token);
  return mode==='auth-rejected'?json({msg:'SYNTHETIC_AUTH_DENIED'},401):json({id:actor,email:'deno@example.invalid',aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-10-18T00:00:00Z',app_metadata:{},user_metadata:{}});
 }
 if(u.pathname==='/rest/v1/rpc/email_gate_current_session_verified'){
  assert.equal(request.headers.get('authorization'),'Bearer '+token);assert.deepEqual(body,{});
  if(mode==='proof-error')return json({code:'42501',message:'SYNTHETIC_PROOF_FAILURE'},403);
  return json(mode==='true'?true:mode==='malformed'?{verified:true}:false);
 }
 if(mode==='true'&&u.pathname==='/rest/v1/app_admins'){assert.equal(request.headers.get('authorization'),'Bearer sb_secret_SYNTHETIC');return json(null);}
 if(mode==='true'&&u.pathname==='/rest/v1/profiles'){assert.equal(request.headers.get('authorization'),'Bearer sb_secret_SYNTHETIC');return json({account_status:'suspended'});}
 if(mode==='true'&&u.pathname==='/rest/v1/rpc/create_business_invitation'){assert.equal(request.headers.get('authorization'),'Bearer '+token);return json({code:'42501',message:'BUSINESS_TEAM_ACCESS_REQUIRED'},403);}
 unexpected++;throw Error('UNEXPECTED_UPSTREAM_REFUSED');
}) as typeof fetch;
const before=console.error;console.error=()=>{};
let problem:string|null=null;
try{
 for(const name of ['net','run','write','env'] as const)assert.equal((await Deno.permissions.query({name})).state,'denied');
 for(const name of ['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates']){
  await import(Deno.args.includes('--bundled')?'../../../bundles/'+name+'.mjs':'../../../supabase/functions/'+name+'/index.ts');assert.equal(typeof handler!,'function');
  const body=name==='invite-business-member'?{workspace_id:'00000000-0000-4000-8000-000000008402',email:'recipient@example.invalid',role:'staff',scope_ids:[]}:{};
  const invoke=async(bearer=true,method='POST')=>handler(new Request(origin+'/functions/v1/'+name,{method,headers:{origin,'content-type':'application/json',...(bearer?{authorization:'Bearer '+token}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{})}));
  const run=async(label:string,selectedMode:string,expected:number,bearer=true,method='POST')=>{
   mode=selectedMode;calls=[];const r=await invoke(bearer,method);assert.equal(r.status,expected,name+':'+label);const payload=await r.json().catch(()=>null);
   if(['false','malformed','proof-error'].includes(mode)){assert.equal(calls.filter(x=>x.path==='/auth/v1/user').length,1);assert.equal(calls.filter(x=>x.path==='/rest/v1/rpc/email_gate_current_session_verified').length,1);assert.equal(calls.length,2);assert.equal(payload.error,mode==='false'?'EMAIL_VERIFICATION_REQUIRED':'EMAIL_VERIFICATION_UNAVAILABLE');}
   checks.push({check:name+': '+label,status:'PASS'});
  };
  mode='auth-rejected';calls=[];let r=await invoke(false);assert.equal(r.status,401);assert.equal(calls.length,0);checks.push({check:name+': missing bearer refused before SDK HTTP',status:'PASS'});
  await run('real SDK Auth rejection precedes proof','auth-rejected',401);assert.equal(calls.length,1);
  await run('password-only SDK proof is rejected','false',403);
  await run('malformed proof fails closed','malformed',503);
  await run('SDK proof error fails closed','proof-error',503);
  await run('verified proof retains independent role or recipient boundary','true',name==='sync-exchange-rates'?401:403);assert.equal(calls[0].path,'/auth/v1/user');assert.equal(calls[1].path,'/rest/v1/rpc/email_gate_current_session_verified');assert.equal(calls.length,3);
  mode='true';calls=[];r=await invoke(true,'GET');assert.equal(r.status,405);assert.equal(calls.length,0);checks.push({check:name+': unsupported method refused before SDK HTTP',status:'PASS'});
 }
 assert.equal(unexpected,0);assert.equal(checks.length,28);
}catch{problem='ACTUAL_DENO_ENTRYPOINT_SDK_BOUNDARY_REVIEW_REQUIRED';}
finally{console.error=before;}
const good=!problem&&checks.length===28;
console.log(JSON.stringify({stage_step:'FR.2.4.E4.17_DENO_EDGE_RUNTIME',result:good?'ACTUAL_DENO_IMPORTED_SDK_AND_FOUR_EDGE_BOUNDARIES_SCOPED_PASS':'DENO_EDGE_RUNTIME_REVIEW_REQUIRED',deno_version:Deno.version.deno,tests:checks.length,pass:checks.length,fail:good?0:1,exit_code:good?0:1,checks,actual_SDK_imports_and_TypeScript_entrypoints_executed:good,bundled_entrypoints:Deno.args.includes('--bundled'),SDK_objects_or_source_imports_replaced:false,HTTP_and_environment_inputs_synthetic:true,OS_network_and_subprocess_permissions_denied:true,unexpected_upstream_attempts:unexpected,real_Auth_SQL_mail_push_FX_or_Cloudflare_requests:0,real_notification_email_or_charge_dispatched:false,actual_provider_Supabase_Edge_runtime_or_JWT_validation_verified:false,hosted_acceptance:false,production_or_native_changed:false,findings_closed:[],problem_code:problem},null,2));if(!good)Deno.exit(1);
