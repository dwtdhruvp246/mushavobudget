import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPrivateFileBroker, isPrivateFileBrokerPlan } from '../scripts/ci/staging-private-file-broker.mjs';
const id = n => '00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actors = Object.fromEntries(['USER_A','USER_B','ADMIN'].map((key,i)=>[key,{id:id(i+1),token:'synthetic.'+Buffer.from(JSON.stringify({sub:id(i+1),session_id:id(i+10)})).toString('base64url')+'.signature'}]));
const plan = { scope:'private-file-broker', project:'dczlddwbtgvfdujgcitb', phase:'additive',raw_delivery_blocked:false,
  case_ids:['X_BROKER_PERSONAL_OWNER_FOREIGN','X_BROKER_SUBSCRIPTION_OWNER_STAFF','X_BROKER_NO_STORE','X_BROKER_EXACT_CLEANUP'] };
function backend({foreignAllowed=false,firstUploadLost=false,deleteFails=false}={}) {
  const files=new Map(),calls=[];let lost=false;
  const fetcher=async(input,options)=>{
    const url=new URL(input), route=url.pathname;
    assert.equal(url.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');assert.equal(options.cache,'no-store');
    const actor=Object.entries(actors).find(([,a])=>options.headers.Authorization==='Bearer '+a.token)?.[0];
    calls.push({route,method:options.method});
    if(route==='/rest/v1/budget_workspaces')return Response.json([{id:id(20),owner_id:actors.USER_A.id,workspace_type:'personal'}]);
    if(route.startsWith('/storage/v1/object/')) {
      const key=route.slice('/storage/v1/object/'.length);
      if(options.method==='POST'){files.set(key,Buffer.from(options.body));if(firstUploadLost&&!lost){lost=true;throw new Error('lost acknowledgement');}return Response.json({Key:key});}
      if(deleteFails)return Response.json({}, {status:503});
      const body=JSON.parse(options.body);for(const path of body.prefixes)files.delete(key+'/'+path);return Response.json([]);
    }
    const body=JSON.parse(options.body), key=(body.bucket || body.p_bucket_id)+'/'+(body.path || body.p_object_name);
    if(route.endsWith('/private_file_download_context'))return Response.json(files.has(key)?[{size_bytes:files.get(key).length}]:[]);
    assert.equal(route,'/functions/v1/get-private-file');
    const headers={'cache-control':'private, no-store, max-age=0','referrer-policy':'no-referrer','x-content-type-options':'nosniff',vary:'Authorization','x-mushavo-media-type':'image/png'};
    if(!actor)return Response.json({error:'AUTHENTICATION_REQUIRED'},{status:401,headers});
    if(actor==='USER_B'&&!foreignAllowed || !files.has(key))return Response.json({error:'FILE_NOT_AVAILABLE'},{status:404,headers});
    return new Response(files.get(key),{headers});
  };
  return {fetcher,files,calls};
}
test('broker plan is finite and does not accept expanded stages or authority flags',()=>{
  assert.equal(isPrivateFileBrokerPlan(plan),true);
  for(const delta of [{scope:'all-files'},{project:'production'},{phase:'enforced'},{raw_delivery_blocked:true},{case_ids:[...plan.case_ids,'EXTRA']}])assert.equal(isPrivateFileBrokerPlan({...plan,...delta}),false);
});
test('broker runner verifies ordinary/staff boundaries and removes both harmless files',async()=>{
  const b=backend(),evidence={};await checkPrivateFileBroker({actors,evidence},'public-fixture','runner',plan,b.fetcher);
  assert.equal(b.files.size,0);assert.equal(evidence.storage_cleanup_acknowledged,true);assert.equal(evidence.original_cached_access_finding_closed,false);
  assert.ok(Object.values(evidence.checks).every(Boolean));assert.doesNotMatch(JSON.stringify(evidence),/synthetic\.|signature|access_token/);
});
test('unexpected foreign access fails and still cleans exact files',async()=>{
  const b=backend({foreignAllowed:true}),evidence={};await assert.rejects(checkPrivateFileBroker({actors,evidence},'fixture','runner',plan,b.fetcher),/FOREIGN_DENIED/);assert.equal(b.files.size,0);
});
test('lost upload response is cleaned without retrying an uncertain upload',async()=>{
  const b=backend({firstUploadLost:true});await assert.rejects(checkPrivateFileBroker({actors,evidence:{}},'fixture','runner',plan,b.fetcher),/lost acknowledgement/);
  assert.equal(b.files.size,0);assert.equal(b.calls.filter(c=>c.method==='POST'&&c.route.startsWith('/storage')).length,1);
});
test('cleanup errors remain a failure',async()=>{
  const b=backend({deleteFails:true}),evidence={};await assert.rejects(checkPrivateFileBroker({actors,evidence},'fixture','runner',plan,b.fetcher),/DELETE_ACK/);
  assert.equal(evidence.storage_cleanup_acknowledged,false);
});
