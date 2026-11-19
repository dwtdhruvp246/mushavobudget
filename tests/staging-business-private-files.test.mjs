import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBusinessPrivateFiles,isBusinessPrivateFilesPlan } from '../scripts/ci/staging-business-private-files.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const actors=Object.fromEntries(['USER_A','USER_B','ADMIN'].map((name,i)=>[name,{id:id(i+1),token:'synthetic.'+Buffer.from(JSON.stringify({sub:id(i+1),session_id:id(i+10)})).toString('base64url')+'.signature'}]));
const accounts={USER_B:{email:'controlled@example.invalid'}};
const plan={scope:'business-private-files',project:'dczlddwbtgvfdujgcitb',workspace_id:'dcf3d122-e99f-4fe5-bbd1-03c3547629df',
  fixture_name:'audit-batch-x-receipt-d7be160c2026',bill_id:'c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45',expected_support_version:18,
  expected_subscription_version:16,expected_profile_version:1,original_paid_through_at:'2026-11-08T00:00:00.000Z',
  temporary_paid_through_at:'2026-11-09T00:00:00.000Z',case_ids:['X_BUSINESS_BROKER_OWNER_FOREIGN','X_BUSINESS_BROKER_REGISTERED_PARENT',
    'X_BUSINESS_BROKER_MEMBER_REMOVAL','X_BUSINESS_BROKER_ARCHIVE','X_BUSINESS_BROKER_EXACT_CLEANUP']};
const now=()=>Date.parse('2026-11-08T10:00:00Z');
function backend({support=18,lostActivate=false,lostRegister=false,retainMember=false,failDelete=false,rawAllowed=false}={}){
  const s={status:'suspended',support,seats:1,subVersion:16,profileVersion:1,logo:null,member:false,joined:false,invitation:null,doc:null,files:new Map(),calls:[]};
  const profile=()=>({workspace_id:plan.workspace_id,trading_name:plan.fixture_name,logo_storage_path:s.logo,version:s.profileVersion});
  const fetcher=async(input,options)=>{
    const u=new URL(input),name=u.pathname.split('/').at(-1),method=options.method;
    assert.equal(u.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
    const caller=Object.keys(actors).find(k=>options.headers.Authorization==='Bearer '+actors[k].token);
    const body=options.body&&options.headers['Content-Type']==='application/json'?JSON.parse(options.body):null;
    s.calls.push({name,method,caller});
    const ok=data=>Response.json(data),deny=()=>Response.json({statusCode:'404',error:'not_found'},{status:400});
    if(method==='GET'&&u.pathname.startsWith('/rest/v1/')){
      if(name==='budget_workspaces')return ok([{id:plan.workspace_id,owner_id:actors.USER_A.id,name:plan.fixture_name,workspace_type:'business',status:s.status,business_support_version:s.support}]);
      if(name==='workspace_subscriptions')return ok([{status:'active',version:s.subVersion,member_limit:s.seats,paid_through_at:plan.temporary_paid_through_at}]);
      if(name==='business_profiles')return ok([profile()]);
      if(name==='workspace_members')return ok([{id:id(20),user_id:actors.USER_A.id,role:'business_owner',status:'active'},
        {id:id(21),user_id:actors.USER_B.id,role:'finance_manager',status:s.member?'active':'inactive'},
        {id:id(22),user_id:id(4),role:'staff',status:'inactive'}]);
      if(name==='workspace_invitations'){assert.equal(u.searchParams.get('status'),'eq.pending');return ok(s.invitation?.status==='pending'?[s.invitation]:[]);}
      if(name==='business_bills')return ok([{id:plan.bill_id,status:'paid',amount:1,paid_amount:1,reference:'AUDIT-X-FINANCE-20261107'}]);
      throw new Error('unknown table');
    }
    if(u.pathname.startsWith('/rest/v1/rpc/')){
      if(name==='admin_business_set_status'){s.status=body.p_status;s.support++;if(lostActivate&&body.p_status==='active')throw new Error('lost activate acknowledgement');return ok(id(90));}
      if(name==='admin_set_business_seats'){assert.equal(body.p_expected_version,s.subVersion);s.seats=body.p_total_seats;s.subVersion++;return ok(s.seats);}
      if(name==='register_business_document'){s.doc={id:body.p_document_id,parent_id:body.p_parent_id,path:body.p_storage_path,status:'active'};if(lostRegister)throw new Error('lost register acknowledgement');return ok([{id:s.doc.id,parent_id:s.doc.parent_id}]);}
      if(name==='save_business_branding'){assert.equal(body.p_expected_version,s.profileVersion);s.logo=body.p_logo_path;s.profileVersion++;return ok(profile());}
      if(name==='create_business_invitation'){assert.equal(body.p_email,accounts.USER_B.email);s.invitation={id:id(30),invitee_user_id:actors.USER_B.id,status:'pending'};return ok({invitation_id:id(30),invitee_user_id:actors.USER_B.id});}
      if(name==='respond_business_invitation'){s.member=true;s.joined=true;s.invitation.status='accepted';return ok(plan.workspace_id);}
      if(name==='cancel_business_invitation'){s.invitation.status='cancelled';return ok('cancelled');}
      if(name==='remove_business_member'){s.member=false;return ok('removed');}
      if(name==='archive_business_document'){assert.equal(s.doc.status,'active');s.doc.status='archived';return ok(s.doc.path);}
      if(name==='private_file_download_context')return ok(s.doc?.status==='active'?[{object_id:s.doc.id}]:[]);
      if(name==='app_session_status')return ok({session_valid:true,admin_authorized:caller==='ADMIN'});
      throw new Error('unknown RPC');
    }
    if(u.pathname==='/functions/v1/get-private-file'){
      const key=body.bucket+'/'+body.path,exists=s.files.has(key),authorized=s.status==='active'&&(caller==='USER_A'||caller==='USER_B'&&(s.member||retainMember&&s.joined));
      const allowed=authorized&&exists&&(body.bucket==='business-documents'?s.doc?.status==='active':caller==='USER_A'||s.logo===body.path);
      return allowed?new Response(s.files.get(key),{headers:{'cache-control':'private, no-store'}}):Response.json({error:'FILE_NOT_AVAILABLE'},{status:404,headers:{'cache-control':'private, no-store'}});
    }
    if(u.pathname.includes('/object/sign/'))return deny();
    if(u.pathname.includes('/object/authenticated/'))return rawAllowed?new Response('unsafe'):deny();
    if(u.pathname.startsWith('/storage/v1/object/')){
      const key=u.pathname.slice('/storage/v1/object/'.length);
      if(method==='POST'){s.files.set(key,Buffer.from(options.body));return ok({Key:key});}
      if(method==='DELETE'){if(failDelete)return Response.json({},{status:503});const path=body.prefixes[0];s.files.delete(key+'/'+path);return ok([{name:path}]);}
    }
    throw new Error('unplanned route');
  };
  return {s,fetcher};
}
const run=(b,evidence={})=>checkBusinessPrivateFiles({actors,accounts,evidence},'public-key','synthetic-runner',plan,b.fetcher,now);
test('Business file plan binds the exact isolated fixture, versions, dates and finite cases',()=>{
  assert.equal(isBusinessPrivateFilesPlan(plan),true);
  for(const delta of [{scope:'all-business'},{project:'production'},{workspace_id:id(99)},{bill_id:id(99)},{expected_support_version:19},{expected_subscription_version:17},{temporary_paid_through_at:'2027-01-01'},{case_ids:[]}])assert.equal(isBusinessPrivateFilesPlan({...plan,...delta}),false);
});
test('Business broker Owner/foreign/member/archive flow restores only the exact test fixture',async()=>{
  const b=backend(),evidence={};await run(b,evidence);assert.ok(Object.values(evidence.checks).every(Boolean));
  assert.equal(b.s.status,'suspended');assert.equal(b.s.support,20);assert.equal(b.s.subVersion,18);assert.equal(b.s.seats,1);
  assert.equal(b.s.logo,null);assert.equal(b.s.profileVersion,3);assert.equal(b.s.member,false);assert.equal(b.s.doc.status,'archived');assert.equal(b.s.files.size,0);
  assert.doesNotMatch(JSON.stringify(evidence),/synthetic\.|signature|controlled@example/);
});
test('advanced baseline stops before any activation or file mutation',async()=>{
  const b=backend({support:20});await assert.rejects(run(b),/EXACT_SUSPENDED_BASELINE/);assert.equal(b.s.calls.filter(c=>c.name==='admin_business_set_status').length,0);assert.equal(b.s.files.size,0);
});
test('lost activation is read back and compensated without replaying activation',async()=>{
  const b=backend({lostActivate:true});await assert.rejects(run(b),/lost activate/);assert.equal(b.s.status,'suspended');assert.equal(b.s.support,20);
  assert.equal(b.s.calls.filter(c=>c.name==='admin_business_set_status').length,2);
});
test('lost registration is archived from current metadata and all attempted objects are cleaned',async()=>{
  const b=backend({lostRegister:true});await assert.rejects(run(b),/lost register/);assert.equal(b.s.doc.status,'archived');assert.equal(b.s.files.size,0);assert.equal(b.s.status,'suspended');
  assert.equal(b.s.calls.filter(c=>c.name==='register_business_document').length,1);
});
test('retained removed-member access fails and still restores exact resources',async()=>{
  const b=backend({retainMember:true});await assert.rejects(run(b),/WARM_REMOVED_MEMBER_DENIED/);assert.equal(b.s.files.size,0);assert.equal(b.s.logo,null);assert.equal(b.s.status,'suspended');
});
test('unexpected original bytes are rejected and cleaned',async()=>{
  const b=backend({rawAllowed:true});await assert.rejects(run(b),/RAW_ORIGINAL_BLOCKED/);assert.equal(b.s.files.size,0);assert.equal(b.s.status,'suspended');
});
test('failed file cleanup remains a failure and retains active Owner access for compensation',async()=>{
  const b=backend({failDelete:true}),evidence={};await assert.rejects(run(b,evidence),/STORAGE_DELETE_ACK/);assert.equal(evidence.storage_cleanup_acknowledged,false);assert.equal(b.s.status,'active');assert.equal(b.s.files.size,2);
});
