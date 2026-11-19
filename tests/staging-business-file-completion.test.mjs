import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBusinessFileCompletion,isBusinessFileCompletionPlan } from '../scripts/ci/staging-business-file-completion.mjs';
const W='dcf3d122-e99f-4fe5-bbd1-03c3547629df',NAME='audit-batch-x-receipt-d7be160c2026',DOC='e8e09b54-76ed-477b-a266-fb88502bcb40';
const A='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
const ids={USER_A:A,ADMIN:'00000000-0000-4000-8000-000000000003'};
const actors=Object.fromEntries(Object.entries(ids).map(([k,id])=>[k,{id,token:'synthetic.'+Buffer.from(JSON.stringify({sub:id,session_id:id})).toString('base64url')+'.signature'}]));
const plan={scope:'business-private-files',mode:'unfinished-archive-cleanup',project:'dczlddwbtgvfdujgcitb',workspace_id:W,fixture_name:NAME,
  document_id:DOC,expected_support_version:19,expected_subscription_version:17,expected_profile_version:3,parent_type:'workspace',
  temporary_paid_through_at:'2026-11-09T00:00:00.000Z',cleanup_files:[{bucket:'business-documents',path:`workspaces/${W}/${A}/${DOC}/broker.png`},
    {bucket:'business-logos',path:`${W}/${A}/af270748-93e4-4020-8fe6-65c68f43312c.png`}],
  case_ids:['X_RETAIN_COMPLETED_BUSINESS_ACCESS_CASES','X_WORKSPACE_DOCUMENT_ARCHIVE','X_EXACT_BUSINESS_FILE_CLEANUP']};
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=','base64');
function backend({support=19,parent='workspace',lostArchive=false,retainArchived=false,deleteFails=false}={}){
 const s={support,status:'active',version:17,seats:2,archived:false,files:2,calls:[]};
 const fetcher=async(input,options)=>{
  const u=new URL(input),name=u.pathname.split('/').at(-1),body=options.body?JSON.parse(options.body):null;
  s.calls.push({name,method:options.method});assert.equal(u.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');assert.equal(options.redirect,'error');
  const ok=x=>Response.json(x);
  if(name==='budget_workspaces')return ok([{id:W,owner_id:A,name:NAME,status:s.status,business_support_version:s.support}]);
  if(name==='workspace_subscriptions')return ok([{status:'active',version:s.version,member_limit:s.seats,paid_through_at:plan.temporary_paid_through_at}]);
  if(name==='business_profiles')return ok([{version:3,logo_storage_path:null,trading_name:NAME}]);
  if(name==='business_documents')return ok([{id:DOC,parent_type:parent,parent_id:W,status:'active',storage_path:plan.cleanup_files[0].path,uploaded_by:A}]);
  if(name==='workspace_members')return ok([{user_id:A,role:'business_owner',status:'active'},{user_id:'660a1463-6589-4c4d-ab6c-8ee50161038f',role:'finance_manager',status:'inactive'},{user_id:'8495c114-23c6-4d85-a643-fcb7a4781d74',role:'staff',status:'inactive'}]);
  if(name==='workspace_invitations')return ok([]);
  if(name==='get-private-file')return !s.archived||retainArchived?new Response(PNG,{headers:{'cache-control':'private, no-store'}}):Response.json({error:'FILE_NOT_AVAILABLE'},{status:404,headers:{'cache-control':'private, no-store'}});
  if(name==='archive_business_document'){assert.equal(body.p_document_id,DOC);s.archived=true;if(lostArchive)throw new Error('lost archive response');return ok(plan.cleanup_files[0].path);}
  if(name==='private_file_download_context')return ok(s.archived?[]:[{object_id:DOC}]);
  if(name==='app_session_status')return ok({session_valid:true,admin_authorized:false});
  if(options.method==='DELETE'){if(deleteFails)return Response.json({},{status:503});s.files--;return ok([{name:body.prefixes[0]}]);}
  if(name==='admin_set_business_seats'){assert.equal(body.p_expected_version,17);s.seats=1;s.version++;return ok(1);}
  if(name==='admin_business_set_status'){assert.equal(body.p_expected_version,19);s.status='suspended';s.support++;return ok('00000000-0000-4000-8000-000000000090');}
  throw new Error('unexpected completion route');
 };
 return {s,fetcher};
}
const run=(b,evidence={})=>checkBusinessFileCompletion({actors,evidence},'public','synthetic',plan,b.fetcher);
test('unfinished completion binds exact existing files and advanced state',()=>{
 assert.equal(isBusinessFileCompletionPlan(plan),true);
 for(const d of [{mode:'all-tests'},{document_id:'foreign'},{expected_support_version:18},{cleanup_files:[]},{parent_type:'business_bill'},{case_ids:[]}])assert.equal(isBusinessFileCompletionPlan({...plan,...d}),false);
});
test('only remaining archive and cleanup run, preserving earlier access/removal evidence',async()=>{
 const b=backend(),evidence={};await run(b,evidence);assert.ok(Object.values(evidence.checks).every(Boolean));
 assert.equal(b.s.files,0);assert.equal(b.s.archived,true);assert.equal(b.s.status,'suspended');assert.equal(b.s.version,18);assert.equal(b.s.support,20);
 assert.equal(evidence.uploads,0);assert.equal(evidence.new_invitations,0);assert.equal(evidence.member_or_role_writes,0);
 assert.doesNotMatch(JSON.stringify(evidence),/synthetic\.|signature/);
});
test('changed baseline prevents all writes and cleanup',async()=>{
 const b=backend({support:20});await assert.rejects(run(b),/EXACT_RETAINED_RUN_STATE/);assert.equal(b.s.calls.filter(c=>c.method!=='GET').length,0);
});
test('unreviewed paid-bill parent prevents writes instead of bypassing its lock',async()=>{
 const b=backend({parent:'business_bill'});await assert.rejects(run(b),/EXACT_CORRECTED_NEW_FIXTURE/);assert.equal(b.s.calls.filter(c=>c.method!=='GET').length,0);
});
test('lost committed archive is observed through current context and not replayed',async()=>{
 const b=backend({lostArchive:true});await assert.rejects(run(b),/lost archive response/);assert.equal(b.s.calls.filter(c=>c.name==='archive_business_document').length,1);assert.equal(b.s.files,0);assert.equal(b.s.status,'suspended');
});
test('retained warm archived bytes cannot pass and cleanup still completes',async()=>{
 const b=backend({retainArchived:true});await assert.rejects(run(b),/IDENTICAL_WARM_ARCHIVED_DOCUMENT_DENIED/);assert.equal(b.s.files,0);assert.equal(b.s.status,'suspended');
});
test('failed file deletion cannot pass or prematurely lock out the cleanup Owner',async()=>{
 const b=backend({deleteFails:true}),evidence={};await assert.rejects(run(b,evidence),/FILE_DELETE_ACK/);assert.equal(evidence.storage_cleanup_acknowledged,false);assert.equal(b.s.status,'active');assert.equal(b.s.files,2);
});
