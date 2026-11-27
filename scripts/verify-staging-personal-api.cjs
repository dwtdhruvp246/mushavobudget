// 1.3.5: two synthetic accounts only. Never supply production passwords.
const STAGING='https://dczlddwbtgvfdujgcitb.supabase.co';
const FRONTEND='https://mushavo-budget-staging.pages.dev/config.js';
const MARKER='AUDIT-S135-OWNER-ONLY';
const fields='id,name,owner_id,workspace_id,visibility,amount,currency';
class AuditError extends Error {}
function requireCheck(ok,code){if(!ok)throw new AuditError(code);}
function parseConfig(text){let c;try{c=JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/,'').replace(/;\s*$/,''));}catch{throw new AuditError('CONFIG_PARSE_FAILED');}
 requireCheck(c.supabaseUrl===STAGING,'CONFIG_NOT_STAGING');
 requireCheck(/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey||''),'CONFIG_KEY_TYPE_REJECTED');
 requireCheck(!c.vapidPublicKey&&!text.includes('kttkospkblwvguuwnhjj'),'CONFIG_PRODUCTION_REFERENCE_OR_PUSH_KEY');return c;}
function denied(r){return (r.status===200&&Array.isArray(r.data)&&r.data.length===0)||([401,403].includes(r.status)&&r.data?.code==='42501');}
function row(r,code){requireCheck(r.status===200&&Array.isArray(r.data)&&r.data.length===1,code);return r.data[0];}
async function run({fetcher=fetch,ownerPassword,outsiderPassword}){
 requireCheck(!!ownerPassword&&!!outsiderPassword,'TEST_PASSWORDS_REQUIRED');
 const checks=[];let config;const sessions=[];let logoutOk=true;let problem=null;
 async function request(route,{token,method='GET',body}={}){
  const headers={apikey:config.supabasePublishableKey,Accept:'application/json'};
  if(token)headers.Authorization='Bearer '+token;
  if(body!==undefined){headers['Content-Type']='application/json';headers.Prefer='return=representation';}
  const res=await fetcher(STAGING+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  const text=await res.text();let data=null;try{if(text)data=JSON.parse(text);}catch{/* Unparseable responses can never pass row/denial checks. */}
  return {status:res.status,data};
 }
 try{
  const publicResponse=await fetcher(FRONTEND,{redirect:'error',signal:AbortSignal.timeout(20000)});
  requireCheck(publicResponse.status===200,'PUBLIC_CONFIG_FETCH_FAILED');config=parseConfig(await publicResponse.text());checks.push({check:'Deployed config is staging only',status:'PASS'});
  for(const [email,password]of [['audit.owner@example.com',ownerPassword],['audit.outsider@example.com',outsiderPassword]]){
   const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
   requireCheck(r.status===200&&typeof r.data?.access_token==='string'&&typeof r.data?.user?.id==='string','SYNTHETIC_SIGN_IN_FAILED');
   const session={token:r.data.access_token,id:r.data.user.id};sessions.push(session);
   const identity=await request('/auth/v1/user',{token:session.token});requireCheck(identity.status===200&&identity.data?.id===session.id,'SESSION_IDENTITY_CHECK_FAILED');
  }
  const [owner,outsider]=sessions;requireCheck(owner.id!==outsider.id,'ACCOUNTS_NOT_DISTINCT');checks.push({check:'Two distinct staging Auth sessions verified',status:'PASS'});
  const seedQuery='/rest/v1/payment_items?select='+fields+'&name=eq.'+encodeURIComponent(MARKER)+'&owner_id=eq.'+encodeURIComponent(owner.id)+'&limit=2';
  const seed=row(await request(seedQuery,{token:owner.token}),'OWNER_SEED_MISSING_OR_AMBIGUOUS');
  requireCheck(seed.owner_id===owner.id&&seed.visibility==='personal'&&seed.name===MARKER&&Number(seed.amount)===20&&seed.currency==='USD'&&typeof seed.id==='string'&&typeof seed.workspace_id==='string','OWNER_SEED_SCOPE_MISMATCH');
  const workspace=row(await request('/rest/v1/budget_workspaces?select=id,owner_id,workspace_type&id=eq.'+encodeURIComponent(seed.workspace_id),{token:owner.token}),'OWNER_WORKSPACE_READ_FAILED');
  requireCheck(workspace.owner_id===owner.id&&workspace.workspace_type==='personal','WORKSPACE_SCOPE_MISMATCH');checks.push({check:'Owner reads seeded USD 20 personal item and workspace',status:'PASS'});
  const itemQuery='/rest/v1/payment_items?select='+fields+'&id=eq.'+encodeURIComponent(seed.id);
  const recordQuery='/rest/v1/payment_records?select=id,payment_item_id,owner_id,amount,currency&payment_item_id=eq.'+encodeURIComponent(seed.id);
  const record=row(await request(recordQuery,{token:owner.token}),'OWNER_PAYMENT_RECORD_READ_FAILED');requireCheck(record.owner_id===owner.id&&Number(record.amount)===20&&record.currency==='USD','PAYMENT_RECORD_SCOPE_MISMATCH');checks.push({check:'Owner reads matching paid record',status:'PASS'});
  // Positive control: exactly the same name is written, never a changed amount.
  const updated=row(await request(itemQuery,{token:owner.token,method:'PATCH',body:{name:MARKER}}),'OWNER_NOOP_UPDATE_FAILED');requireCheck(updated.id===seed.id&&updated.name===MARKER,'OWNER_UPDATE_TARGET_MISMATCH');
  checks.push({check:'Owner same-name update positive control',status:'PASS'});
  for(const [label,token]of [['Outsider',outsider.token],['Anonymous',undefined]]){
   for(const [table,query]of [['payment item',itemQuery],['paid record',recordQuery]]){const r=await request(query,{token});requireCheck(denied(r),label.toUpperCase()+'_PRIVATE_READ_NOT_DENIED');checks.push({check:label+' cannot read owner '+table,status:'PASS',http_status:r.status});}
   const r=await request(itemQuery,{token,method:'PATCH',body:{name:MARKER}});requireCheck(denied(r),label.toUpperCase()+'_UPDATE_NOT_DENIED');checks.push({check:label+' same-name update affects no owner row',status:'PASS',http_status:r.status});
  }
  const after=row(await request(itemQuery,{token:owner.token}),'FINAL_OWNER_READ_FAILED');
  requireCheck(JSON.stringify(after)===JSON.stringify(updated),'FINAL_PAYMENT_VALUES_CHANGED');checks.push({check:'Owner still reads unchanged selected payment values',status:'PASS'});
 }catch(e){problem=e instanceof AuditError?e.message:'NETWORK_OR_LOCAL_ERROR';}
 finally{if(config)for(const session of sessions){try{const r=await request('/auth/v1/logout?scope=local',{token:session.token,method:'POST'});if(r.status!==204&&r.status!==200)logoutOk=false;}catch{logoutOk=false;}}}
 return {stage_step:'1.3.5',result:problem?'PERSONAL_API_CHECK_REVIEW':'PERSONAL_API_READ_AND_NOOP_UPDATE_PASS',project:'dczlddwbtgvfdujgcitb',checks,problem_code:problem,test_sessions_logged_out:logoutOk&&sessions.length===2,credentials_or_tokens_printed:false,raw_rows_or_private_identifiers_printed:false,synthetic_payment_retained:true,insert_delete_rpc_storage_family_business_checks_verified:false,email_push_or_edge_workflows_verified:false,complete_staging_isolation_verified:false};
}
module.exports={parseConfig,denied,row,run,AuditError};
if(require.main===module){run({ownerPassword:process.env.MUSHAVO_TEST_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_TEST_OUTSIDER_PASSWORD}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.problem_code||!r.test_sessions_logged_out)process.exitCode=1;}).catch(()=>{console.log(JSON.stringify({stage_step:'1.3.5',result:'PERSONAL_API_CHECK_REVIEW',problem_code:'LOCAL_PREREQUISITE_ERROR'}));process.exitCode=1;});}
