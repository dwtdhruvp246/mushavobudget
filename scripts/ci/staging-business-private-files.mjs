import { randomUUID } from 'node:crypto';
import { API_ORIGIN, digest, need, tokenIdentity } from './staging-access.mjs';
const WORKSPACE='dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const FIXTURE='audit-batch-x-receipt-d7be160c2026';
const BILL='c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45';
const CASES=['X_BUSINESS_BROKER_OWNER_FOREIGN','X_BUSINESS_BROKER_REGISTERED_PARENT',
  'X_BUSINESS_BROKER_MEMBER_REMOVAL','X_BUSINESS_BROKER_ARCHIVE','X_BUSINESS_BROKER_EXACT_CLEANUP'];
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PNG=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF6sAAAAASUVORK5CYII=','base64');
const single=value=>Array.isArray(value)&&value.length===1?value[0]:value;
const one=value=>Array.isArray(value)&&value.length===1?value[0]:null;
const RPCS=['app_session_status','admin_business_set_status','admin_set_business_seats','create_business_invitation',
  'respond_business_invitation','cancel_business_invitation','remove_business_member','register_business_document',
  'archive_business_document','save_business_branding','private_file_download_context'];
const TABLES=['budget_workspaces','workspace_subscriptions','workspace_members','workspace_invitations','business_profiles','business_bills'];
export function isBusinessPrivateFilesPlan(plan){
  return plan.scope==='business-private-files'&&plan.project==='dczlddwbtgvfdujgcitb'
    &&plan.workspace_id===WORKSPACE&&plan.fixture_name===FIXTURE&&plan.bill_id===BILL
    &&plan.expected_support_version===18&&plan.expected_subscription_version===16&&plan.expected_profile_version===1
    &&plan.original_paid_through_at==='2026-11-08T00:00:00.000Z'
    &&plan.temporary_paid_through_at==='2026-11-09T00:00:00.000Z'
    &&JSON.stringify(plan.case_ids)===JSON.stringify(CASES);
}
export async function checkBusinessPrivateFiles({actors,accounts,evidence},key,agent,plan,fetcher=fetch,now=Date.now){
  need(isBusinessPrivateFilesPlan(plan),'REVIEWED_BUSINESS_FILE_PLAN_REQUIRED');
  const owner=actors.USER_A,member=actors.USER_B,admin=actors.ADMIN;
  need(Object.keys(actors).length===3&&new Set([owner?.id,member?.id,admin?.id]).size===3
    &&[owner,member,admin].every(a=>UUID.test(a?.id||'')&&tokenIdentity(a.token)?.userId===a.id),'THREE_BOUND_BUSINESS_FILE_ACTORS_REQUIRED');
  Object.assign(evidence,{checks:{},exercise_requests:0,upload_attempts:0,cleanup_paths:[],provider_email_requests:0,
    provider_payment_requests:0,financial_ledger_writes:0,Auth_accounts_created:0,raw_observations:[],fixture_suspended:false,
    storage_cleanup_acknowledged:false,original_seats_restored:false,branding_restored:false,temporary_member_removed:false});
  const check=(name,passed)=>{evidence.checks[name]=passed===true;need(passed===true,name+'_REQUIRED');};
  const documentId=randomUUID(),files=[{bucket:'business-documents',path:`workspaces/${WORKSPACE}/${owner.id}/${documentId}/broker.png`},
    {bucket:'business-logos',path:`${WORKSPACE}/${owner.id}/${randomUUID()}.png`}];
  const attempted=[];let fixtureBound=false,resumeAttempted=false,failure,cleanupFailure;
  const request=async(method,route,actor,body,{cleanup=false,upload=false}={})=>{
    need(evidence.exercise_requests<(cleanup?100:70),'BUSINESS_FILE_REQUEST_BOUND_REQUIRED');
    const u=new URL(route,API_ORIGIN),rpcName=u.pathname.startsWith('/rest/v1/rpc/')?u.pathname.slice(13):null;
    const table=u.pathname.startsWith('/rest/v1/')?u.pathname.slice(9):null;
    const tableRead=method==='GET'&&TABLES.includes(table)&&u.searchParams.get('limit')==='4'
      &&u.searchParams.get(table==='budget_workspaces'?'id':'workspace_id')==='eq.'+WORKSPACE;
    const rpc=method==='POST'&&RPCS.includes(rpcName)
      &&(rpcName==='app_session_status'||rpcName==='private_file_download_context'
        ||['respond_business_invitation','cancel_business_invitation'].includes(rpcName)&&UUID.test(body?.p_invitation_id||'')
        ||body?.p_workspace_id===WORKSPACE);
    const broker=method==='POST'&&u.pathname==='/functions/v1/get-private-file'&&Object.keys(body||{}).sort().join()==='bucket,path'
      &&files.some(f=>body.bucket===f.bucket&&body.path===f.path);
    const fileUpload=method==='POST'&&upload&&attempted.some(f=>route===`/storage/v1/object/${f.bucket}/${f.path}`);
    const raw=method==='GET'&&files.some(f=>u.pathname===`/storage/v1/object/authenticated/${f.bucket}/${f.path}`)
      &&([...u.searchParams.keys()].join()===''||[...u.searchParams.keys()].join()==='cacheNonce');
    const sign=method==='POST'&&files.some(f=>u.pathname===`/storage/v1/object/sign/${f.bucket}/${f.path}`)&&body?.expiresIn===60;
    const remove=method==='DELETE'&&cleanup&&files.some(f=>u.pathname===`/storage/v1/object/${f.bucket}`)
      &&Array.isArray(body?.prefixes)&&body.prefixes.length===1&&attempted.some(f=>u.pathname.endsWith('/'+f.bucket)&&body.prefixes[0]===f.path);
    need(route.startsWith('/')&&u.origin===API_ORIGIN&&!u.hash&&(tableRead||rpc||broker||fileUpload||raw||sign||remove),'BUSINESS_FILE_ROUTE_REFUSED');
    evidence.exercise_requests++;
    const response=await fetcher(u,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),
      headers:{apikey:key,'User-Agent':agent,...(actor?{Authorization:'Bearer '+actor.token}:{}),
        ...(body===undefined?{}:{'Content-Type':upload?'image/png':'application/json'}),...(upload?{'x-upsert':'false'}:{})},
      ...(body===undefined?{}:{body:upload?body:JSON.stringify(body)})});
    let data=null;if((broker||raw)&&response.status===200)data=Buffer.from(await response.arrayBuffer());
    else{try{data=await response.json();}catch{}}
    const headers=Object.fromEntries(['cache-control','cf-cache-status','vary','content-type'].map(k=>[k,response.headers.get(k)]));
    if(response.status>=400&&/^[A-Z][A-Z0-9_]{2,79}$/.test(data?.message||''))evidence.last_application_refusal={status:response.status,code:data.message};
    return{status:response.status,data,headers};
  };
  const rpc=(name,actor,body={},cleanup=false)=>request('POST','/rest/v1/rpc/'+name,actor,body,{cleanup});
  const get=(table,fields,actor=owner,cleanup=false)=>request('GET',`/rest/v1/${table}?select=${fields}&${table==='budget_workspaces'?'id':'workspace_id'}=eq.${WORKSPACE}&limit=4`,actor,undefined,{cleanup});
  const members=(cleanup=false)=>get('workspace_members','id,user_id,role,status',owner,cleanup);
  const pending=(cleanup=false)=>request('GET',`/rest/v1/workspace_invitations?select=id,invitee_user_id,status&workspace_id=eq.${WORKSPACE}&status=eq.pending&limit=4`,owner,undefined,{cleanup});
  const fixture=async(cleanup=false)=>{
    const r=await get('budget_workspaces','id,owner_id,name,workspace_type,status,business_support_version',admin,cleanup),w=one(r.data);
    need(r.status===200&&w?.id===WORKSPACE&&w.name===FIXTURE&&w.owner_id===owner.id&&w.workspace_type==='business'
      &&['active','suspended'].includes(w.status)&&Number.isInteger(w.business_support_version),'EXACT_BUSINESS_FILE_FIXTURE_REQUIRED');return w;
  };
  const subscription=async(cleanup=false)=>{
    const r=await get('workspace_subscriptions','status,version,member_limit,paid_through_at',admin,cleanup),s=one(r.data);
    need(r.status===200&&s?.status==='active'&&Number.isInteger(s.version)&&[1,2].includes(s.member_limit)
      &&Date.parse(s.paid_through_at)===Date.parse(plan.temporary_paid_through_at),'EXACT_TEMPORARY_FILE_TERM_REQUIRED');return s;
  };
  const profile=async(cleanup=false)=>{
    const r=await get('business_profiles','workspace_id,trading_name,logo_storage_path,version',owner,cleanup),p=one(r.data);
    need(r.status===200&&p?.workspace_id===WORKSPACE&&p.trading_name===FIXTURE&&Number.isInteger(p.version),'EXACT_BUSINESS_FILE_PROFILE_REQUIRED');return p;
  };
  const setStatus=async(w,status,cleanup=false)=>{
    const r=await rpc('admin_business_set_status',admin,{p_workspace_id:WORKSPACE,p_status:status,p_expected_version:w.business_support_version,
      p_confirmation_name:FIXTURE,p_reason:'Bounded private-file broker acceptance',p_request_id:randomUUID()},cleanup);
    need(r.status===200&&UUID.test(r.data||''),'FILE_STATUS_ACK_REQUIRED');const after=await fixture(cleanup);
    need(after.status===status&&after.business_support_version===w.business_support_version+1,'FILE_STATUS_READBACK_REQUIRED');
  };
  const setSeats=async(s,seats,cleanup=false)=>{
    const r=await rpc('admin_set_business_seats',admin,{p_workspace_id:WORKSPACE,p_total_seats:seats,p_expected_version:s.version,
      p_confirmation_name:FIXTURE,p_reason:'Temporary controlled Business file viewer'},cleanup);
    need(r.status===200&&r.data===seats,'FILE_SEAT_ACK_REQUIRED');const after=await subscription(cleanup);
    need(after.member_limit===seats&&after.version===s.version+1,'FILE_SEAT_READBACK_REQUIRED');
  };
  const read=(f,actor=owner,cleanup=false)=>request('POST','/functions/v1/get-private-file',actor,{bucket:f.bucket,path:f.path},{cleanup});
  const matches=r=>r.status===200&&Buffer.isBuffer(r.data)&&digest(r.data)===digest(PNG)&&/private, no-store/.test(r.headers['cache-control']||'');
  const denied=r=>[401,403,404].includes(r.status)||r.status===400&&[401,403,404].includes(Number(r.data?.statusCode));
  const checkRaw=async(f)=>{
    const r=await request('GET',`/storage/v1/object/authenticated/${f.bucket}/${f.path}`,owner);
    evidence.raw_observations.push({bucket:f.bucket,status:r.status,headers:r.headers});check('RAW_ORIGINAL_BLOCKED_'+f.bucket,denied(r));
    const signed=await request('POST',`/storage/v1/object/sign/${f.bucket}/${f.path}`,owner,{expiresIn:60});
    check('CLIENT_SIGNING_BLOCKED_'+f.bucket,denied(signed)&&typeof signed.data?.signedURL!=='string');
  };
  try{
    const w=await fixture(),s=await subscription();
    check('EXACT_SUSPENDED_BASELINE',w.status==='suspended'&&w.business_support_version===18&&s.version===16&&s.member_limit===1
      &&Date.parse(s.paid_through_at)>now()+600000);
    fixtureBound=true;resumeAttempted=true;await setStatus(w,'active');
    const m=await members(),p=await profile(),inv=await pending();
    check('ONLY_ORIGINAL_OWNER_ACTIVE',m.status===200&&m.data?.length===3&&m.data.filter(x=>x.status==='active').length===1
      &&m.data.some(x=>x.user_id===owner.id&&x.status==='active'&&x.role==='business_owner')
      &&m.data.some(x=>x.user_id===member.id&&x.status==='inactive'&&x.role==='finance_manager'));
    check('ORIGINAL_PROFILE_AND_NO_PENDING_INVITATIONS',p.version===1&&p.logo_storage_path===null&&inv.status===200&&Array.isArray(inv.data)&&!inv.data.some(x=>x.status==='pending'));
    const bill=await get('business_bills','id,status,amount,paid_amount,reference');
    check('ORIGINAL_USD1_PAID_BILL_BOUND',bill.status===200&&bill.data?.length===1&&bill.data[0].id===BILL&&bill.data[0].status==='paid'
      &&Number(bill.data[0].amount)===1&&Number(bill.data[0].paid_amount)===1&&bill.data[0].reference==='AUDIT-X-FINANCE-20261107');
    for(const f of files){attempted.push(f);evidence.upload_attempts++;evidence.cleanup_paths=attempted.map(x=>({...x}));
      check('UPLOAD_'+f.bucket,[200,201].includes((await request('POST',`/storage/v1/object/${f.bucket}/${f.path}`,owner,PNG,{upload:true})).status));}
    check('UNREGISTERED_DOCUMENT_HIDDEN',(await read(files[0])).status===404);
    check('OWNER_UNLINKED_LOGO_ALLOWED',matches(await read(files[1])));
    const attached=await rpc('register_business_document',owner,{p_document_id:documentId,p_workspace_id:WORKSPACE,p_parent_type:'business_bill',p_parent_id:BILL,
      p_storage_path:files[0].path,p_original_name:'Synthetic broker proof.png',p_mime_type:'image/png',p_size_bytes:PNG.length});
    check('EXACT_DOCUMENT_REGISTERED',attached.status===200&&single(attached.data)?.id===documentId&&single(attached.data).parent_id===BILL);
    const branded=await rpc('save_business_branding',owner,{p_workspace_id:WORKSPACE,p_trading_name:FIXTURE,p_logo_path:files[1].path,p_expected_version:1});
    check('EXACT_LOGO_LINKED',branded.status===200&&single(branded.data)?.logo_storage_path===files[1].path&&single(branded.data).version===2);
    for(const f of files){check('OWNER_BYTES_'+f.bucket,matches(await read(f)));check('FOREIGN_DENIED_'+f.bucket,(await read(f,member)).status===404);await checkRaw(f);}
    await setSeats(await subscription(),2);
    const invitation=await rpc('create_business_invitation',owner,{p_workspace_id:WORKSPACE,p_email:accounts.USER_B.email,p_role:'finance_manager',p_scope_ids:[]});
    check('CONTROLLED_DATABASE_ONLY_INVITATION',invitation.status===200&&UUID.test(invitation.data?.invitation_id||'')&&invitation.data.invitee_user_id===member.id);
    const accepted=await rpc('respond_business_invitation',member,{p_invitation_id:invitation.data.invitation_id,p_accept:true});
    check('EXACT_MEMBER_JOINED',accepted.status===200&&accepted.data===WORKSPACE);
    for(const f of files)check('MEMBER_BYTES_'+f.bucket,matches(await read(f,member)));
    const joined=await members(),row=joined.data?.find(x=>x.user_id===member.id);
    need(row?.status==='active'&&row.role==='finance_manager','EXACT_JOINED_MEMBER_REQUIRED');
    const removed=await rpc('remove_business_member',owner,{p_workspace_id:WORKSPACE,p_member_id:row.id});
    check('OWNER_REMOVED_EXACT_TEMPORARY_MEMBER',removed.status===200&&removed.data==='removed');
    const live=await rpc('app_session_status',member);
    check('REMOVED_MEMBER_SAME_ORDINARY_SESSION_VALID',live.status===200&&live.data?.session_valid===true&&live.data.admin_authorized===false);
    for(const f of files){check('WARM_REMOVED_MEMBER_DENIED_'+f.bucket,(await read(f,member)).status===404);check('OWNER_RETAINS_'+f.bucket,matches(await read(f)));}
    const archived=await rpc('archive_business_document',owner,{p_workspace_id:WORKSPACE,p_document_id:documentId,p_reason:'Completed harmless broker check'});
    check('EXACT_DOCUMENT_ARCHIVED',archived.status===200&&archived.data===files[0].path);
    check('WARM_ARCHIVED_OWNER_DOCUMENT_DENIED',(await read(files[0])).status===404);
  }catch(error){failure=error;}
  finally{
    if(fixtureBound&&resumeAttempted)try{
      const w=await fixture(true);
      if(w.status==='active'){
        const p=await profile(true);
        if(p.logo_storage_path===files[1].path){const r=await rpc('save_business_branding',owner,{p_workspace_id:WORKSPACE,p_trading_name:FIXTURE,p_logo_path:null,p_expected_version:p.version},true);need(r.status===200&&single(r.data)?.logo_storage_path===null,'LOGO_RESTORE_ACK_REQUIRED');}
        evidence.branding_restored=(await profile(true)).logo_storage_path===null;check('ORIGINAL_BRANDING_RESTORED',evidence.branding_restored);
        // A registered document may have committed even if its response was lost.
        if(attempted.some(f=>f.bucket==='business-documents')){
          const context=await rpc('private_file_download_context',owner,{p_bucket_id:files[0].bucket,p_object_name:files[0].path},true);
          need(context.status===200&&Array.isArray(context.data),'DOCUMENT_CLEANUP_CONTEXT_REQUIRED');
          if(context.data.length){const r=await rpc('archive_business_document',owner,{p_workspace_id:WORKSPACE,p_document_id:documentId,p_reason:'Harmless broker fixture cleanup'},true);need(r.status===200&&r.data===files[0].path,'DOCUMENT_CLEANUP_ARCHIVE_REQUIRED');}
        }
        for(const f of attempted){const r=await request('DELETE',`/storage/v1/object/${f.bucket}`,owner,{prefixes:[f.path]},{cleanup:true});check('STORAGE_DELETE_ACK_'+f.bucket,r.status===200&&Array.isArray(r.data));}
        evidence.storage_cleanup_acknowledged=true;
        const invites=await pending(true);need(invites.status===200&&Array.isArray(invites.data),'INVITATION_CLEANUP_READ_REQUIRED');
        for(const invite of invites.data.filter(i=>i.status==='pending')){need(invite.invitee_user_id===member.id,'ONLY_EXACT_CONTROLLED_PENDING_INVITATION');const r=await rpc('cancel_business_invitation',owner,{p_invitation_id:invite.id},true);need(r.status===200,'EXACT_INVITATION_CANCEL_REQUIRED');}
        const m=await members(true);need(m.status===200&&Array.isArray(m.data),'MEMBER_CLEANUP_READ_REQUIRED');
        for(const row of m.data.filter(x=>x.user_id===member.id&&x.status==='active')){const r=await rpc('remove_business_member',owner,{p_workspace_id:WORKSPACE,p_member_id:row.id},true);need(r.status===200&&r.data==='removed','EXACT_MEMBER_CLEANUP_REQUIRED');}
        const final=await members(true);evidence.temporary_member_removed=final.status===200&&final.data.filter(x=>x.status==='active').length===1
          &&final.data.some(x=>x.user_id===member.id&&x.status==='inactive'&&x.role==='finance_manager');check('ORIGINAL_MEMBER_STATE_RESTORED',evidence.temporary_member_removed);
        const sub=await subscription(true);if(sub.member_limit===2)await setSeats(sub,1,true);
        evidence.original_seats_restored=(await subscription(true)).member_limit===1;check('ORIGINAL_ONE_SEAT_RESTORED',evidence.original_seats_restored);
        await setStatus(await fixture(true),'suspended',true);
      }
      evidence.fixture_suspended=(await fixture(true)).status==='suspended';check('FIXTURE_SUSPENDED',evidence.fixture_suspended);
    }catch(error){cleanupFailure=error;}
  }
  if(cleanupFailure)throw cleanupFailure;if(failure)throw failure;
}
