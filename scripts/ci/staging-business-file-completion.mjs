import { randomUUID } from 'node:crypto';
import { API_ORIGIN,digest,need,tokenIdentity } from './staging-access.mjs';
const W='dcf3d122-e99f-4fe5-bbd1-03c3547629df',NAME='audit-batch-x-receipt-d7be160c2026';
const DOC='e8e09b54-76ed-477b-a266-fb88502bcb40';
const FILES=[{bucket:'business-documents',path:'workspaces/'+W+'/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/'+DOC+'/broker.png'},
  {bucket:'business-logos',path:W+'/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/af270748-93e4-4020-8fe6-65c68f43312c.png'}];
const CASES=['X_RETAIN_COMPLETED_BUSINESS_ACCESS_CASES','X_WORKSPACE_DOCUMENT_ARCHIVE','X_EXACT_BUSINESS_FILE_CLEANUP'];
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=','base64');
const one=x=>Array.isArray(x)&&x.length===1?x[0]:null;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isBusinessFileCompletionPlan(p){return p.scope==='business-private-files'&&p.mode==='unfinished-archive-cleanup'
  &&p.project==='dczlddwbtgvfdujgcitb'&&p.workspace_id===W&&p.fixture_name===NAME&&p.document_id===DOC
  &&p.expected_support_version===19&&p.expected_subscription_version===17&&p.expected_profile_version===3
  &&p.temporary_paid_through_at==='2026-11-09T00:00:00.000Z'&&p.parent_type==='workspace'
  &&JSON.stringify(p.cleanup_files)===JSON.stringify(FILES)&&JSON.stringify(p.case_ids)===JSON.stringify(CASES);}
export async function checkBusinessFileCompletion({actors,evidence},key,agent,plan,fetcher=fetch){
  need(isBusinessFileCompletionPlan(plan),'EXACT_UNFINISHED_FILE_COMPLETION_PLAN_REQUIRED');
  const owner=actors.USER_A,admin=actors.ADMIN;
  need(Object.keys(actors).length===2&&owner?.id!==admin?.id&&[owner,admin].every(a=>UUID.test(a?.id||'')&&tokenIdentity(a.token)?.userId===a.id),'TWO_BOUND_COMPLETION_ACTORS_REQUIRED');
  Object.assign(evidence,{checks:{},exercise_requests:0,uploads:0,new_invitations:0,member_or_role_writes:0,
    financial_ledger_writes:0,provider_requests:0,storage_cleanup_acknowledged:false,fixture_suspended:false,
    previous_access_run_not_repeated:42467355998,cleanup_paths:FILES});
  const check=(name,value)=>{evidence.checks[name]=value===true;need(value===true,name+'_REQUIRED');};
  const request=async(method,route,actor,body,cleanup=false)=>{
    need(evidence.exercise_requests<(cleanup?40:18),'FILE_COMPLETION_REQUEST_BOUND_REQUIRED');
    const u=new URL(route,API_ORIGIN),name=u.pathname.split('/').at(-1);
    const table=method==='GET'&&['budget_workspaces','workspace_subscriptions','business_profiles','workspace_members','business_documents','workspace_invitations'].includes(name)
      &&u.searchParams.get('limit')==='4'&&u.searchParams.get(name==='budget_workspaces'?'id':'workspace_id')==='eq.'+W;
    const rpc=method==='POST'&&u.pathname.startsWith('/rest/v1/rpc/')&&['private_file_download_context','archive_business_document','app_session_status','admin_set_business_seats','admin_business_set_status'].includes(name)
      &&(name==='app_session_status'||name==='private_file_download_context'&&body?.p_bucket_id===FILES[0].bucket&&body?.p_object_name===FILES[0].path||body?.p_workspace_id===W);
    const broker=method==='POST'&&u.pathname==='/functions/v1/get-private-file'&&JSON.stringify(body)===JSON.stringify(FILES[0]);
    const remove=method==='DELETE'&&cleanup&&FILES.some(f=>route==='/storage/v1/object/'+f.bucket&&JSON.stringify(body)===JSON.stringify({prefixes:[f.path]}));
    need(u.origin===API_ORIGIN&&route.startsWith('/')&&!u.hash&&(table||rpc||broker||remove),'FILE_COMPLETION_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const r=await fetcher(u,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{apikey:key,Authorization:'Bearer '+actor.token,'User-Agent':agent,'Content-Type':'application/json'},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data=null;if(broker&&r.status===200)data=Buffer.from(await r.arrayBuffer());else{try{data=await r.json();}catch{}}
    return{status:r.status,data,no_store:/private, no-store/.test(r.headers.get('cache-control')||'')};
  };
  const rpc=(name,actor,body={},cleanup=false)=>request('POST','/rest/v1/rpc/'+name,actor,body,cleanup);
  const get=(name,fields,actor=owner,cleanup=false,extra='')=>request('GET',`/rest/v1/${name}?select=${fields}&${name==='budget_workspaces'?'id':'workspace_id'}=eq.${W}${extra}&limit=4`,actor,undefined,cleanup);
  const work=async(cleanup=false)=>{const r=await get('budget_workspaces','id,owner_id,name,status,business_support_version',admin,cleanup),w=one(r.data);
    need(r.status===200&&w?.id===W&&w.name===NAME&&w.owner_id===owner.id,'EXACT_COMPLETION_WORKSPACE_REQUIRED');return w;};
  const sub=async(cleanup=false)=>{const r=await get('workspace_subscriptions','status,version,member_limit,paid_through_at',admin,cleanup),s=one(r.data);
    need(r.status===200&&s?.status==='active'&&Date.parse(s.paid_through_at)===Date.parse(plan.temporary_paid_through_at),'EXACT_COMPLETION_TERM_REQUIRED');return s;};
  const read=()=>request('POST','/functions/v1/get-private-file',owner,FILES[0]);
  let bound=false,failure,cleanupFailure;
  try{
    const w=await work(),s=await sub(),p=await get('business_profiles','version,logo_storage_path,trading_name');
    check('EXACT_RETAINED_RUN_STATE',w.status==='active'&&w.business_support_version===19&&s.version===17&&s.member_limit===2
      &&one(p.data)?.version===3&&one(p.data).logo_storage_path===null&&one(p.data).trading_name===NAME);
    const d=await get('business_documents','id,parent_type,parent_id,status,storage_path,uploaded_by',owner,false,'&id=eq.'+DOC),row=one(d.data);
    check('EXACT_CORRECTED_NEW_FIXTURE',d.status===200&&row?.id===DOC&&row.parent_type==='workspace'&&row.parent_id===W
      &&row.status==='active'&&row.storage_path===FILES[0].path&&row.uploaded_by===owner.id);
    bound=true;
    const before=await read();check('OWNER_WORKSPACE_DOCUMENT_BYTES',before.status===200&&Buffer.isBuffer(before.data)&&digest(before.data)===digest(PNG)&&before.no_store);
    const archived=await rpc('archive_business_document',owner,{p_workspace_id:W,p_document_id:DOC,p_reason:'Complete remaining isolated private-file archive check'});
    check('WORKSPACE_DOCUMENT_ARCHIVE_ALLOWED',archived.status===200&&archived.data===FILES[0].path);
    const after=await read();check('IDENTICAL_WARM_ARCHIVED_DOCUMENT_DENIED',after.status===404&&after.no_store);
    const session=await rpc('app_session_status',owner);check('SAME_OWNER_SESSION_STILL_VALID',session.status===200&&session.data?.session_valid===true&&session.data.admin_authorized===false);
  }catch(error){failure=error;}
  finally{if(bound)try{
    const context=await rpc('private_file_download_context',owner,{p_bucket_id:FILES[0].bucket,p_object_name:FILES[0].path},true);
    need(context.status===200&&Array.isArray(context.data),'CURRENT_ARCHIVE_CONTEXT_REQUIRED');
    if(context.data.length){const a=await rpc('archive_business_document',owner,{p_workspace_id:W,p_document_id:DOC,p_reason:'Exact remaining fixture cleanup'},true);need(a.status===200&&a.data===FILES[0].path,'EXACT_ARCHIVE_COMPENSATION_REQUIRED');}
    for(const f of FILES){const r=await request('DELETE','/storage/v1/object/'+f.bucket,owner,{prefixes:[f.path]},true);check('FILE_DELETE_ACK_'+f.bucket,r.status===200&&Array.isArray(r.data));}
    evidence.storage_cleanup_acknowledged=true;
    const m=await get('workspace_members','user_id,role,status',owner,true),inv=await get('workspace_invitations','id,status',owner,true,'&status=eq.pending');
    check('ORIGINAL_ONLY_OWNER_ACTIVE',m.status===200&&m.data?.length===3&&m.data.filter(x=>x.status==='active').length===1
      &&m.data.some(x=>x.user_id===owner.id&&x.role==='business_owner'&&x.status==='active')
      &&m.data.some(x=>x.user_id==='660a1463-6589-4c4d-ab6c-8ee50161038f'&&x.role==='finance_manager'&&x.status==='inactive'));
    check('NO_PENDING_INVITATIONS',inv.status===200&&Array.isArray(inv.data)&&inv.data.length===0);
    const s=await sub(true);need(s.member_limit===2&&s.version===17,'EXACT_SEAT_RESTORE_BASELINE_REQUIRED');
    const seats=await rpc('admin_set_business_seats',admin,{p_workspace_id:W,p_total_seats:1,p_expected_version:17,p_confirmation_name:NAME,p_reason:'Restore original capacity after private-file checks'},true);
    check('ORIGINAL_SEAT_ACTION_ACK',seats.status===200&&seats.data===1);const restored=await sub(true);
    check('ORIGINAL_ONE_SEAT_RESTORED',restored.member_limit===1&&restored.version===18);
    const w=await work(true);need(w.status==='active'&&w.business_support_version===19,'EXACT_SUSPEND_BASELINE_REQUIRED');
    const suspended=await rpc('admin_business_set_status',admin,{p_workspace_id:W,p_status:'suspended',p_expected_version:19,p_confirmation_name:NAME,
      p_reason:'Restore suspended private-file fixture',p_request_id:randomUUID()},true);
    need(suspended.status===200&&UUID.test(suspended.data||''),'SUSPEND_ACK_REQUIRED');const final=await work(true);
    evidence.fixture_suspended=final.status==='suspended'&&final.business_support_version===20;check('ORIGINAL_SUSPENDED_STATE_RESTORED',evidence.fixture_suspended);
  }catch(error){cleanupFailure=error;}}
  if(cleanupFailure)throw cleanupFailure;if(failure)throw failure;
}
