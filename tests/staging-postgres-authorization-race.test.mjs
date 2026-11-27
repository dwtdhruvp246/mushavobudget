import assert from 'node:assert/strict';
import test from 'node:test';
import {checkPostgresAuthorizationRace,isPostgresAuthorizationRacePlan} from '../scripts/ci/staging-postgres-authorization-race.mjs';
const id=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const actor=n=>({id:id(n),token:'test.'+Buffer.from(JSON.stringify({sub:id(n),session_id:id(n),exp:Date.now()/1000+3600})).toString('base64url')+'.test'});
const actors={USER_A:actor('1'),USER_B:actor('2'),ADMIN:actor('3')};
const plan={scope:'postgres-authorization-change',project:'dczlddwbtgvfdujgcitb',workspace_id:'dcf3d122-e99f-4fe5-bbd1-03c3547629df',fixture_name:'audit-batch-x-receipt-d7be160c2026',expected_support_version:16,expected_subscription_version:15,hold_before_revoke_ms:35000,hold_after_revoke_ms:20000,original_paid_through_at:'2026-11-08T00:00:00.000Z',case_ids:['Y_RACE_REAL_SESSION_BASELINE','Y_RACE_SHARED_WORKSPACE_HOLD','Y_RACE_COMMITTED_SUSPENSION','Y_RACE_SAME_SESSION_DENIAL','Y_RACE_EXACT_CLEANUP']};
function backend({version=16,lostResume=false,retainedAccess=false}={}){
 const state={status:'suspended',version,calls:[],waits:[]};
 const fetcher=async(url,options)=>{
  const u=new URL(url),name=u.pathname.split('/').at(-1),body=options.body?JSON.parse(options.body):{};
  state.calls.push({name,body,method:options.method});
  assert.equal(u.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');assert.equal(options.cache,'no-store');
  const caller=Object.values(actors).find(a=>options.headers.Authorization==='Bearer '+a.token);assert.ok(caller);
  if(name==='app_session_status')return Response.json({session_valid:true,admin_authorized:caller===actors.ADMIN});
  if(name==='business_has_permission')return Response.json(state.status==='active'||retainedAccess);
  if(name==='budget_workspaces')return Response.json([{id:plan.workspace_id,name:plan.fixture_name,owner_id:actors.USER_A.id,workspace_type:'business',status:state.status,business_support_version:state.version}]);
  if(name==='workspace_subscriptions')return Response.json([{status:'active',version:15,member_limit:1,paid_through_at:plan.original_paid_through_at}]);
  if(name==='admin_business_set_status'){
   assert.equal(caller,actors.ADMIN);assert.equal(body.p_expected_version,state.version);state.status=body.p_status;state.version++;
   if(lostResume&&body.p_status==='active')throw Error('synthetic lost acknowledgement');
   return Response.json(id('4'));
  }
  throw Error('unplanned route');
 };
 return {state,fetcher,wait:async ms=>{state.waits.push(ms);}};
}
test('real PostgreSQL race plan binds project, fixture, versions and wait windows',()=>{
 assert.equal(isPostgresAuthorizationRacePlan(plan),true);
 for(const change of [{project:'production'},{expected_support_version:18},{hold_before_revoke_ms:1},{hold_after_revoke_ms:60000},{workspace_id:id('5')},{case_ids:[]}])assert.equal(isPostgresAuthorizationRacePlan({...plan,...change}),false);
});
test('supported status transition keeps the same sessions and restores the fixture',async()=>{
 const b=backend(),evidence={};await checkPostgresAuthorizationRace({actors,evidence},'synthetic','synthetic',plan,b.fetcher,b.wait,()=>Date.parse('2026-11-07T21:00:00Z'));
 assert.deepEqual(b.state.waits,[35000,20000]);assert.equal(b.state.status,'suspended');assert.equal(b.state.version,18);assert.equal(evidence.fixture_suspended_verified,true);assert.equal(evidence.independent_Postgres_witness_required,true);
});
test('advanced fixture versions stop before mutation',async()=>{
 const b=backend({version:18});await assert.rejects(checkPostgresAuthorizationRace({actors,evidence:{}},'synthetic','synthetic',plan,b.fetcher,b.wait,()=>Date.parse('2026-11-07T21:00:00Z')),/BASELINE_SUSPENDED/);
 assert.equal(b.state.calls.filter(c=>c.name==='admin_business_set_status').length,0);
});
test('lost resume acknowledgement is read back and suspended without replaying the write',async()=>{
 const b=backend({lostResume:true});await assert.rejects(checkPostgresAuthorizationRace({actors,evidence:{}},'synthetic','synthetic',plan,b.fetcher,b.wait,()=>Date.parse('2026-11-07T21:00:00Z')),/synthetic lost acknowledgement/);
 assert.deepEqual(b.state.calls.filter(c=>c.name==='admin_business_set_status').map(c=>c.body.p_status),['active','suspended']);assert.equal(b.state.status,'suspended');assert.equal(b.state.version,18);
});
