import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {deployBatchD,acknowledgement,uploadFiles,deploymentForm,exactSourceReadback} from '../scripts/deploy-fr-2-email-edge-batch-d.mjs';
import {impactRef,sixNames,selectedSlugs} from '../scripts/review-fr-2-email-edge-installed.mjs';
const token='sbp_fc'+'SYNTHETIC_TOKEN'.repeat(3),privateMarker='PRIVATE_PROVIDER_NEVER_PRINT',root=new URL('../',import.meta.url);
const sha=x=>createHash('sha256').update(x).digest('hex');
const row={slug:'submit-enquiry',id:'PRIVATE_CONTACT_ID',status:'ACTIVE',version:7,verify_jwt:false,created_at:1,updated_at:3};
const baseline=sha(JSON.stringify([row])),contactEntry='/home/deno/functions/submit-enquiry/index.ts';
function body(files,entry){const f=new FormData();f.append('metadata',JSON.stringify({deno2_entrypoint_path:entry}));for(const[n,b]of files)f.append('file',new Blob([b]),n);return new Response(f);}
function contactBody(bad=false){return body(new Map(['index.ts','handler.mjs'].map(n=>[contactEntry.replace('index.ts',n),bad?Buffer.from(privateMarker):fs.readFileSync(new URL('supabase/functions/submit-enquiry/'+n,root))])),contactEntry);}
function fixture(settings={}){
 const calls=[],deployed=[];let contact=row,postCount=0;
 const transport=async(url,init)=>{
  calls.push({url,init});const n=calls.length;
  assert.equal(init.redirect,'error');assert(init.signal instanceof AbortSignal);
  if(settings.failAt===n){if(settings.throwAt)throw Error(privateMarker);return new Response(privateMarker,{status:403});}
  let r;
  const suffix=url.split('/v1/projects/'+impactRef)[1];
  if(url.includes('.supabase.co/functions/v1/')){
   const slug=url.split('/').at(-1);assert.equal(init.method,'POST');assert.equal(init.body,'{}');assert.equal(init.headers.Authorization,undefined);assert.equal(init.headers.apikey,undefined);assert.equal(init.headers['x-cron-secret'],undefined);
   r=Response.json(settings.allowUnauth?{success:true}:selectedSlugs.indexOf(slug)<2?{code:401,message:'Missing authorization header'}:{error:'EDGE_FUNCTION_AUTHENTICATION_REQUIRED'},{status:settings.allowUnauth?200:401});
  }else{
   assert(url.startsWith('https://api.supabase.com/v1/projects/'+impactRef));assert.equal(init.headers.Authorization,'Bearer '+token);
   if(suffix==='')r=Response.json({ref:impactRef,status:'ACTIVE_HEALTHY',database:{host:settings.wrongTarget?'db.foreign.supabase.co':'db.'+impactRef+'.supabase.co'}});
   else if(suffix==='/functions')r=Response.json([contact,...deployed,...(settings.preexisting?[{...row,slug:'send-test-push',id:'PRIVATE_APPEARED_ID'}]:[])]);
   else if(suffix==='/secrets'){assert.equal(init.method,'GET');r=Response.json((settings.missingNames?sixNames.slice(1):sixNames).map(name=>({name,value:privateMarker})));}
   else if(suffix==='/functions/submit-enquiry')r=Response.json({...contact,entrypoint_path:'file://'+contactEntry,ezbr_sha256:'a'.repeat(64),import_map:false});
   else if(suffix==='/functions/submit-enquiry/body')r=contactBody(settings.badContact);
   else if(suffix.startsWith('/functions/deploy?slug=')){
    assert.equal(init.method,'POST');const slug=suffix.split('=').at(-1);assert(!deployed.some(x=>x.slug===slug));postCount++;
    const form=init.body;assert(form instanceof FormData);const meta=JSON.parse(form.get('metadata'));
    assert.deepEqual(meta,{name:slug,entrypoint_path:'supabase/functions/'+slug+'/index.ts',verify_jwt:selectedSlugs.indexOf(slug)<2,import_map_path:'',static_patterns:[]});
    const expected=uploadFiles(slug);assert.equal(form.getAll('file').length,expected.size);
    for(const file of form.getAll('file'))assert(Buffer.from(await file.arrayBuffer()).equals(expected.get(file.name)));
    const installed={slug,id:'PRIVATE_DEPLOYED_ID_'+slug,status:'ACTIVE',version:settings.version??1,verify_jwt:settings.badJWT?!meta.verify_jwt:meta.verify_jwt,created_at:5,updated_at:5};deployed.push(installed);
    if(settings.contactDrift)contact={...row,updated_at:4};
    r=Response.json({...installed,ezbr_sha256:'b'.repeat(64),entrypoint_path:meta.entrypoint_path,import_map:false},{status:201});
   }else{
    const slug=suffix.split('/')[2],installed=deployed.find(x=>x.slug===slug);assert(installed);
    if(suffix.endsWith('/body')){const files=uploadFiles(slug);if(settings.badNewSource)files.set([...files.keys()][0],Buffer.from(privateMarker));r=body(files,'supabase/functions/'+slug+'/index.ts');}
    else r=Response.json({...installed,ezbr_sha256:settings.bundleDrift?'c'.repeat(64):'b'.repeat(64),entrypoint_path:'supabase/functions/'+slug+'/index.ts',import_map:false});
   }
  }
  return settings.mutate?settings.mutate(n,r):r;
 };
 return {calls,deployed,get postCount(){return postCount;},run:(input={token,acknowledgement})=>deployBatchD(input,{transport,baseline:settings.baseline??baseline})};
}
function safe(r){const s=JSON.stringify(r);for(const v of [token,privateMarker,row.id,contactEntry,'PRIVATE_DEPLOYED_ID'])assert(!s.includes(v));assert.equal(r.SQL_Auth_secret_write_or_scheduler_endpoint_used,false);assert.equal(r.automatic_retry_or_delete_performed,false);assert.equal(r.application_rows_read,false);assert.equal(r.email_push_or_FX_dispatched,false);assert.equal(r.live_activation_approved,false);assert.equal(r.hosted_acceptance,false);assert.equal(r.runtime_authenticated_JWT_and_user_authorization_verified,false);}
test('one combined run deploys four exact pinned sources and checks independent metadata, body, denied requests and preserved contact',async()=>{const f=fixture(),r=await f.run();assert.equal(r.exit_code,0,JSON.stringify(r));assert.equal(r.actual_hosted_requests,37);assert.equal(f.postCount,4);assert.equal(r.deployment_HTTP_accepted_count,4);assert.equal(r.unauthenticated_Edge_requests,4);assert.equal(r.all_four_source_readbacks_exact,true);assert.equal(r.unrelated_contact_metadata_and_artifacts_preserved,true);assert.equal(r.deployment_write_outcome_uncertain,false);safe(r);});
test('first currently absent routes retain the returned version instead of assuming provider version one',async()=>{const r=await fixture({version:3}).run();assert.equal(r.exit_code,0);assert(r.selected_functions.every(x=>x.version===3));safe(r);});
test('unknown inputs, missing acknowledgement and invalid tokens cause no provider request',async()=>{for(const input of [{token,acknowledgement:'wrong'},{token,acknowledgement,url:'https://foreign.invalid'},{token:'invalid',acknowledgement}]){const f=fixture(),r=await f.run(input);assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);safe(r);}});
test('fresh wrong-target observation stops before source, configuration or deployment',async()=>{const f=fixture({wrongTarget:true}),r=await f.run();assert.equal(f.calls.length,1);assert.equal(f.postCount,0);assert.equal(r.exit_code,1);safe(r);});
test('preexisting selected route prevents every deployment write',async()=>{const f=fixture({preexisting:true}),r=await f.run();assert.equal(f.postCount,0);assert.equal(r.current_review_problem,'SELECTED_FUNCTION_APPEARED');safe(r);});
test('modified unrelated contact source fails before any deployment',async()=>{const f=fixture({badContact:true}),r=await f.run();assert.equal(f.postCount,0);assert.equal(r.current_review_problem,'FUNCTION_SOURCE_MISMATCH');safe(r);});
test('missing installed configuration names stop before deployment',async()=>{const f=fixture({missingNames:true}),r=await f.run();assert.equal(f.postCount,0);assert.equal(r.current_review_problem,'INSTALLED_NAMES_NOT_OBSERVED');safe(r);});
test('an unapproved current metadata fingerprint cannot become a new write baseline',async()=>{const f=fixture({baseline:'0'.repeat(64)}),r=await f.run();assert.equal(r.exit_code,1);assert.equal(r.deployment_POST_requests,0);assert.equal(r.problem_code,'CURRENT_BASELINE_CHANGED');assert.equal(f.calls.length,7);safe(r);});
test('provider failure at any one of 37 operations stops at that operation without retries or cleanup writes',async()=>{for(let failAt=1;failAt<=37;failAt++){const f=fixture({failAt}),r=await f.run();assert.equal(r.exit_code,1,'failure '+failAt);assert.equal(f.calls.length,failAt);assert(f.calls.every(x=>!['DELETE','PUT','PATCH'].includes(x.init.method)));safe(r);}});
test('transport-uncertain first deployment retains uncertainty and stops after one POST',async()=>{const f=fixture({failAt:11,throwAt:true}),r=await f.run();assert.equal(r.deployment_POST_requests,1);assert.equal(r.deployment_HTTP_accepted_count,0);assert.equal(r.deployment_write_outcome_uncertain,true);assert.equal(r.deployment_may_have_changed,true);assert.equal(r.uploaded_or_deployed,false);safe(r);});
test('gateway JWT setting mismatch stops before the second deployment',async()=>{const f=fixture({badJWT:true}),r=await f.run();assert.equal(f.postCount,1);assert.equal(r.problem_code,'METADATA_REVIEW_REQUIRED');safe(r);});
test('bundle identity differs on independent readback and blocks further writes',async()=>{const f=fixture({bundleDrift:true}),r=await f.run();assert.equal(f.postCount,1);assert.equal(r.problem_code,'METADATA_REVIEW_REQUIRED');safe(r);});
test('any changed downloaded deployed source byte stops before invocation or next deployment',async()=>{const f=fixture({badNewSource:true}),r=await f.run();assert.equal(f.postCount,1);assert.equal(r.unauthenticated_Edge_requests,0);assert.equal(r.problem_code,'SOURCE_READBACK_REVIEW_REQUIRED');safe(r);});
test('a successful unauthenticated request cannot pass a denial checkpoint',async()=>{const f=fixture({allowUnauth:true}),r=await f.run();assert.equal(f.postCount,1);assert.equal(r.exit_code,1);safe(r);});
test('contact metadata drift after a deployment blocks the next write',async()=>{const f=fixture({contactDrift:true}),r=await f.run();assert.equal(f.postCount,1);assert.equal(r.problem_code,'OBSERVATION_CHANGED');safe(r);});
test('redirected and oversized responses cannot authorize a first deployment',async()=>{for(const mode of ['redirect','oversize']){const f=fixture({mutate:(n,r)=>{if(n!==8)return r;if(mode==='redirect'){Object.defineProperty(r,'redirected',{value:true});return r;}return new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}});}}),r=await f.run();assert.equal(f.postCount,0);assert.equal(r.exit_code,1);safe(r);}});
test('source readback rejects duplicate paths, traversal, unknown and CRLF-modified artifacts',async()=>{const slug=selectedSlugs[0],expected=uploadFiles(slug),entry=[...expected.keys()][0];for(const mode of ['unknown','CRLF','duplicate','traversal']){const f=new FormData();f.append('metadata',JSON.stringify({deno2_entrypoint_path:entry}));for(const[n,b]of expected){f.append('file',new Blob([mode==='CRLF'?Buffer.from(b.toString().replaceAll('\n','\r\n')):b]),mode==='traversal'?'../'+n:n);}if(mode==='unknown'||mode==='duplicate')f.append('file',new Blob(['bad']),mode==='unknown'?'unknown.ts':entry);const response=new Response(f);await assert.rejects(exactSourceReadback(Buffer.from(await response.arrayBuffer()),response.headers.get('content-type'),entry,slug,expected));}});
test('private CLI preflight and malformed private input return no credentials and perform no requests',()=>{for(const[input,status]of [['{"preflight":true}',0],['{'+token,1],[JSON.stringify({token,acknowledgement:'wrong'}),1]]){const p=spawnSync(process.execPath,['scripts/deploy-fr-2-email-edge-batch-d.mjs','--private-parent-pipe'],{input,encoding:'utf8'});assert.equal(p.status,status);assert.equal(p.stderr,'');assert(!p.stdout.includes(token));assert.equal(JSON.parse(p.stdout).actual_hosted_requests,0);}});
