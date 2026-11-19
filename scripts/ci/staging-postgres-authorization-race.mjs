import {randomUUID} from 'node:crypto';
import {API_ORIGIN,need,tokenIdentity} from './staging-access.mjs';

const WORKSPACE='dcf3d122-e99f-4fe5-bbd1-03c3547629df';
const FIXTURE='audit-batch-x-receipt-d7be160c2026';
const CASES=['Y_RACE_REAL_SESSION_BASELINE','Y_RACE_SHARED_WORKSPACE_HOLD','Y_RACE_COMMITTED_SUSPENSION','Y_RACE_SAME_SESSION_DENIAL','Y_RACE_EXACT_CLEANUP'];
const RPCS=['app_session_status','business_has_permission','admin_business_set_status'];
const one=data=>Array.isArray(data)&&data.length===1?data[0]:data;

export function isPostgresAuthorizationRacePlan(plan){
  return plan.scope==='postgres-authorization-change'&&plan.project==='dczlddwbtgvfdujgcitb'
    &&plan.workspace_id===WORKSPACE&&plan.fixture_name===FIXTURE
    &&plan.expected_support_version===16&&plan.expected_subscription_version===15
    &&plan.hold_before_revoke_ms===35000&&plan.hold_after_revoke_ms===20000
    &&plan.original_paid_through_at==='2026-11-08T00:00:00.000Z'
    &&JSON.stringify(plan.case_ids)===JSON.stringify(CASES);
}

export async function checkPostgresAuthorizationRace({actors,evidence},key,agent,plan,fetcher=fetch,wait=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now=Date.now){
  need(isPostgresAuthorizationRacePlan(plan),'FROZEN_POSTGRES_AUTHORIZATION_RACE_REQUIRED');
  const owner=actors.USER_A,admin=actors.ADMIN;
  need(Object.keys(actors).length===3&&owner?.id!==admin?.id
    &&Object.values(actors).every(a=>tokenIdentity(a?.token)?.userId===a.id),'THREE_BOUND_REAL_ACTORS_REQUIRED');
  Object.assign(evidence,{checks:{},exercise_requests:0,email_requests:0,provider_push_requests:0,
    finance_write_requests:0,Auth_user_or_session_row_writes:0,resume_attempted:false,
    fixture_suspended_verified:false,independent_Postgres_witness_required:true});
  const check=(name,ok)=>{evidence.checks[name]=ok===true;need(ok===true,name+'_REQUIRED');};
  const call=async(method,route,actor,body,cleanup=false)=>{
    need(evidence.exercise_requests<(cleanup?48:36),'AUTHORIZATION_RACE_REQUEST_LIMIT');
    const url=new URL(route,API_ORIGIN),parts=url.pathname.split('/');
    need(url.origin===API_ORIGIN&&!url.hash&&route.startsWith('/')
      &&(method==='POST'&&parts.slice(0,4).join('/')==='/rest/v1/rpc'&&RPCS.includes(parts[4])
        ||method==='GET'&&parts.slice(0,3).join('/')==='/rest/v1'&&['budget_workspaces','workspace_subscriptions'].includes(parts[3])&&url.searchParams.get('limit')==='3'),
    'UNPLANNED_AUTHORIZATION_RACE_ROUTE');
    evidence.exercise_requests++;
    const response=await fetcher(url,{method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(12000),
      headers:{apikey:key,Authorization:'Bearer '+actor.token,'Content-Type':'application/json','User-Agent':agent},
      ...(body===undefined?{}:{body:JSON.stringify(body)})});
    let data=null;try{data=await response.json();}catch{}
    return {status:response.status,data};
  };
  const rpc=(name,actor,body={},cleanup=false)=>call('POST','/rest/v1/rpc/'+name,actor,body,cleanup);
  const fixture=async(cleanup=false)=>{
    const r=await call('GET',`/rest/v1/budget_workspaces?select=id,owner_id,name,workspace_type,status,business_support_version&id=eq.${WORKSPACE}&limit=3`,admin,undefined,cleanup),w=one(r.data);
    need(r.status===200&&w?.id===WORKSPACE&&w.owner_id===owner.id&&w.name===FIXTURE&&w.workspace_type==='business'
      &&['active','suspended'].includes(w.status)&&[16,17,18].includes(w.business_support_version),'EXACT_AUTHORIZATION_RACE_FIXTURE_REQUIRED');
    return w;
  };
  const subscription=async(cleanup=false)=>{
    const r=await call('GET',`/rest/v1/workspace_subscriptions?select=status,version,member_limit,paid_through_at&workspace_id=eq.${WORKSPACE}&limit=3`,admin,undefined,cleanup),s=one(r.data);
    need(r.status===200&&s?.status==='active'&&s.version===15&&s.member_limit===1
      &&Date.parse(s.paid_through_at)===Date.parse(plan.original_paid_through_at),'ORIGINAL_RACE_SUBSCRIPTION_REQUIRED');
    return s;
  };
  const setStatus=async(w,status,cleanup=false)=>{
    const r=await rpc('admin_business_set_status',admin,{p_workspace_id:WORKSPACE,p_status:status,p_expected_version:w.business_support_version,
      p_confirmation_name:FIXTURE,p_reason:'Bounded real PostgreSQL authorization-change overlap',p_request_id:randomUUID()},cleanup);
    need(r.status===200&&typeof r.data==='string'&&/^[0-9a-f-]{36}$/i.test(r.data),'SUPPORT_ACTION_ACK_REQUIRED');
    const after=await fixture(cleanup);
    need(after.status===status&&after.business_support_version===w.business_support_version+1,'RACE_STATUS_READBACK_REQUIRED');
    return after;
  };
  const permission=()=>rpc('business_has_permission',owner,{p_workspace_id:WORKSPACE,p_permission_code:'workspace.view'});
  let failure,cleanupFailure;
  try{
    for(const [slot,a] of Object.entries(actors)){
      const r=await rpc('app_session_status',a);
      check(slot+'_REAL_SESSION_VALID',r.status===200&&r.data?.session_valid===true&&r.data.admin_authorized===(slot==='ADMIN'));
    }
    const w=await fixture();await subscription();
    check('BASELINE_SUSPENDED_VERSION_16',w.status==='suspended'&&w.business_support_version===16);
    need(Date.parse(plan.original_paid_through_at)>now()+600000,'UNEXPIRED_RACE_TERM_REQUIRED');
    const tokenClaims=JSON.parse(Buffer.from(owner.token.split('.')[1],'base64url').toString('utf8'));
    need(tokenClaims.exp*1000>now()+120000,'TWO_MINUTE_OWNER_SESSION_REQUIRED');
    evidence.resume_attempted=true;
    const active=await setStatus(w,'active');
    const before=await permission();check('OWNER_BUSINESS_PERMISSION_BEFORE',before.status===200&&before.data===true);
    evidence.active_window_started_at=new Date(now()).toISOString();
    await wait(plan.hold_before_revoke_ms);
    await setStatus(active,'suspended');
    evidence.suspension_acknowledged_at=new Date(now()).toISOString();
    const after=await permission();check('SAME_TOKEN_BUSINESS_PERMISSION_AFTER',after.status===200&&after.data===false);
    const session=await rpc('app_session_status',owner);
    const claims=JSON.parse(Buffer.from(owner.token.split('.')[1],'base64url').toString('utf8'));
    check('SAME_UNEXPIRED_SESSION_STILL_VALID',session.status===200&&session.data?.session_valid===true
      &&session.data.admin_authorized===false&&claims.exp*1000>now());
    await wait(plan.hold_after_revoke_ms);
  }catch(error){failure=error;}
  finally{
    if(evidence.resume_attempted){try{
      let w=await fixture(true);
      if(w.status==='active')w=await setStatus(w,'suspended',true);
      await subscription(true);
      check('EXACT_FINAL_SUSPENDED_VERSION_18',w.status==='suspended'&&w.business_support_version===18);
      evidence.fixture_suspended_verified=true;
    }catch(error){cleanupFailure=error;}}
  }
  if(cleanupFailure)throw cleanupFailure;
  if(failure)throw failure;
}
