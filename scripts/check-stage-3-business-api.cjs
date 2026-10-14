// 3.3.3 bounded staging-only acceptance. No email Edge, scheduler or provider call.
const {randomUUID}=require('node:crypto');
const STAGING='https://dczlddwbtgvfdujgcitb.supabase.co';
const FRONTEND='https://mushavo-budget-staging.pages.dev/config.js';
const EMAILS=['audit.owner@example.com','audit.outsider@example.com'];
const NAMES=['AUDIT-S332-BUSINESS-PRIMARY','AUDIT-S332-BUSINESS-SECONDARY'];
const ROLES=['business_admin','finance_manager','team_manager','staff','contributor','viewer'];
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
class AuditError extends Error{}
const ensure=(ok,code)=>{if(!ok)throw new AuditError(code);};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const permissionDenied=r=>[401,403].includes(r.status)&&r.data?.code==='42501';
const empty=r=>r.status===200&&Array.isArray(r.data)&&r.data.length===0;
const rowDenied=r=>empty(r)||permissionDenied(r);
const rpcDenied=(r,messages)=>permissionDenied(r)||(r.status===400&&r.data?.code==='P0001'&&messages.includes(r.data.message));
// Exact reviewed RPCs whose PostgreSQL return type is void.
const VOID_RPCS=new Set(['archive_business_role','set_business_member_permission']);
function rpcSucceeded(name,r){
 if(!r.body_read_ok)return false;
 if(!VOID_RPCS.has(name))return r.status===200&&r.body_json_ok;
 if(r.status===204)return r.body_empty&&r.data===null;
 return r.status===200&&(r.body_empty||r.body_json_ok)&&(r.data===null||r.data==='');
}
function parseConfig(text){
 let c;try{c=JSON.parse(text.replace(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*/,'').replace(/;\s*$/,''));}catch{throw new AuditError('CONFIG_PARSE_FAILED');}
 ensure(c.supabaseUrl===STAGING&&!text.includes('kttkospkblwvguuwnhjj')&&!c.vapidPublicKey,'CONFIG_NOT_ISOLATED_STAGING');
 ensure(/^sb_publishable_[A-Za-z0-9_-]+$/.test(c.supabasePublishableKey||''),'CONFIG_KEY_TYPE_REJECTED');return c;
}
async function run({fetcher=fetch,ownerPassword,outsiderPassword,uuid=randomUUID}={}){
 const checks=[],sessions=[],fixtures=[],permissions=[];let config,phase='Staging configuration',problem=null,requests=0,logoutOk=true,writes=false,removed=false,positiveRpcFailure=null;
 const pass=check=>checks.push({check,status:'PASS'});
 const blocked=(check,code)=>checks.push({check,status:'BLOCKED',problem_code:code});
 async function request(route,{session,method='GET',body}={}){
  ensure(++requests<=1400,'REQUEST_BUDGET_EXCEEDED');
  const headers={apikey:config.supabasePublishableKey,Accept:'application/json'};
  if(session)headers.Authorization='Bearer '+session.token;
  if(method!=='GET')headers.Prefer='return=representation';
  if(body!==undefined)headers['Content-Type']='application/json';
  const r=await fetcher(STAGING+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  let data=null,bodyReadOk=false,bodyEmpty=false,bodyJsonOk=false;
  try{const text=await r.text();bodyReadOk=true;bodyEmpty=text.length===0;if(!bodyEmpty){data=JSON.parse(text);bodyJsonOk=true;}}catch{data=null;}
  return {status:r.status,data,body_read_ok:bodyReadOk,body_empty:bodyEmpty,body_json_ok:bodyJsonOk};
 }
 const rpc=(name,session,body)=>request('/rest/v1/rpc/'+name,{session,method:'POST',body});
 const route=(table,filter,select='*')=>'/rest/v1/'+table+'?select='+select+'&'+filter;
 async function rows(table,filter,session,select='*'){
  const r=await request(route(table,filter,select),{session});ensure(r.status===200&&Array.isArray(r.data),'OWNER_READBACK_FAILED');
  return [...r.data].sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
 }
 async function one(table,filter,session,select='*'){
  const r=await rows(table,filter,session,select);ensure(r.length===1,'KNOWN_ROW_MISSING_OR_AMBIGUOUS');return r[0];
 }
 async function ok(name,session,body){
  writes=true;const r=await rpc(name,session,body);
  if(!rpcSucceeded(name,r)){
   positiveRpcFailure={rpc:name,http_status:r.status,body_kind:!r.body_read_ok?'UNREADABLE':r.body_empty?'EMPTY':r.body_json_ok?'JSON':'MALFORMED',error_code:/^(?:PGRST[0-9]{3}|[A-Z0-9]{5})$/.test(r.data?.code||'')?r.data.code:null};
   throw new AuditError('POSITIVE_'+name.toUpperCase()+'_FAILED');
  }return r.data;
 }
 async function snapshot(f,tables){
  const value={};for(const t of tables){
   if(t==='business_invitation_scopes'){
    const r=await rpc('business_team_snapshot',f.session,{p_workspace_id:f.id});ensure(r.status===200&&Array.isArray(r.data?.invitations),'OWNER_READBACK_FAILED');
    value[t]=r.data.invitations.map(x=>({id:x.id,scope_ids:x.scope_ids})).sort((a,b)=>a.id.localeCompare(b.id));
   }else value[t]=await rows(t,'workspace_id=eq.'+f.id,f.session);
  }return value;
 }
 async function deny(name,actor,body,messages,f,tables,code){
  const before=await snapshot(f,tables);writes=true;
  ensure(rpcDenied(await rpc(name,actor,body),messages),code||'REQUEST_NOT_AUTHORIZATION_DENIED');
  ensure(equal(await snapshot(f,tables),before),'PROTECTED_BUSINESS_CHANGED');
 }
 async function directDenied(table,filter,actor,method,body,f,tables){
  const before=await snapshot(f,tables);writes=true;
  ensure(rowDenied(await request(route(table,filter),{session:actor,method,body})),'DIRECT_TABLE_BYPASS_NOT_DENIED');
  ensure(equal(await snapshot(f,tables),before),'PROTECTED_BUSINESS_CHANGED');
 }
 const reportArgs=f=>({p_workspace_id:f.id,p_from:null,p_to:null,p_mode:'reporting',p_currency:'',p_category_id:null,p_dimension_id:null});
 async function report(f,actor,expected){
  const s=await rpc('business_report_summary',actor,reportArgs(f));ensure(s.status===200&&/^[0-9a-f]{32}$/.test(s.data?.fingerprint||''),'REPORT_POSITIVE_FAILED');
  const args={...reportArgs(f),p_section:'missing',p_expected_fingerprint:s.data.fingerprint};
  const r=await rpc('business_report_records',actor,args);ensure(r.status===200&&Array.isArray(r.data?.items),'REPORT_RECORDS_POSITIVE_FAILED');
  ensure(equal(r.data.items.map(x=>x.record_id).sort(),[...expected].sort()),'REPORT_SCOPE_MISMATCH');return {summary:s.data,args};
 }
 async function preservation(){
  const saved=[];for(const s of sessions){
   const workspaces=await rows('budget_workspaces','owner_id=eq.'+s.id,s,'id,workspace_type');
   for(const w of workspaces.filter(x=>['personal','household'].includes(x.workspace_type))){
    const f={id:w.id,session:s};saved.push({type:w.workspace_type,data:await snapshot(f,['workspace_settings','payment_items','payment_records','payment_conversions'])});
   }
  }return saved;
 }
 try{
  ensure(ownerPassword&&outsiderPassword,'TWO_STAGING_APP_PASSWORDS_REQUIRED');
  const c=await fetcher(FRONTEND,{redirect:'error',signal:AbortSignal.timeout(20000)});ensure(c.status===200,'CONFIG_FETCH_FAILED');config=parseConfig(await c.text());pass('Deployed config targets staging, with no production reference or push key');
  phase='Ordinary active caller controls';
  for(const [i,password] of [ownerPassword,outsiderPassword].entries()){
   const r=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email:EMAILS[i],password}});
   ensure(r.status===200&&r.data?.access_token,'STAGING_APP_SIGN_IN_FAILED');const s={token:r.data.access_token,id:r.data.user?.id};sessions.push(s);
   ensure(UUID.test(s.id||'')&&r.data.user.email===EMAILS[i],'SIGN_IN_IDENTITY_MISMATCH');
   const identity=await request('/auth/v1/user',{session:s}),staff=await rpc('is_platform_staff',s,{p_roles:null}),suspended=await rpc('my_account_suspended',s,{});
   ensure(identity.status===200&&identity.data.id===s.id&&identity.data.email===EMAILS[i]&&staff.status===200&&staff.data===false&&suspended.status===200&&suspended.data===false,'ORDINARY_ACTIVE_CALLER_REQUIRED');
  }
  ensure(sessions[0].id!==sessions[1].id,'TWO_DISTINCT_ACCOUNTS_REQUIRED');pass('Both verified sessions are distinct ordinary active staging accounts');
  phase='Exact synthetic Business prerequisites';
  for(const [i,s] of sessions.entries()){
   const w=await one('budget_workspaces','name=eq.'+NAMES[i]+'&owner_id=eq.'+s.id,s);
   ensure(UUID.test(w.id||'')&&w.workspace_type==='business'&&w.status==='active','BUSINESS_WORKSPACE_SCOPE_MISMATCH');
   const f={id:w.id,session:s,owner:w.owner_id};
   const setting=await one('workspace_settings','workspace_id=eq.'+f.id,s);
   ensure(setting.reminder_enabled===false&&setting.conversion_enabled===false&&setting.reporting_currency==='USD'&&equal(setting.enabled_currencies,['USD']),'BUSINESS_DISABLED_USD_BASELINE_REQUIRED');
   const sub=await one('workspace_subscriptions','workspace_id=eq.'+f.id,s);
   ensure(sub.status==='active'&&Date.parse(sub.paid_through_at)>Date.now()&&sub.member_limit===4,'ACTIVE_SYNTHETIC_BUSINESS_ENTITLEMENT_REQUIRED');
   f.dims=await rows('business_dimensions','workspace_id=eq.'+f.id,s);ensure(f.dims.length===2&&f.dims.every(x=>x.status==='active'&&/^AUDIT-S332-TEAM-[12]$/.test(x.name)),'EXACT_DIMENSIONS_REQUIRED');f.dims.sort((a,b)=>a.name.localeCompare(b.name));
   f.category=await one('business_categories','workspace_id=eq.'+f.id+'&name=eq.AUDIT-S332-EXPENSE',s);
   f.claims=await rows('business_expense_claims','workspace_id=eq.'+f.id,s);ensure(f.claims.length===2&&f.claims.every(x=>x.submitted_by===s.id&&x.status==='approved'&&Number(x.amount)===1&&x.currency==='USD'&&x.category_id===f.category.id&&f.dims.some(d=>d.id===x.dimension_id)),'EXACT_USD_1_OWNER_CLAIMS_REQUIRED');
   f.ownerMember=await one('workspace_members','workspace_id=eq.'+f.id+'&user_id=eq.'+s.id,s);ensure(f.ownerMember.role==='business_owner'&&f.ownerMember.status==='active','OWNER_MEMBER_REQUIRED');
   const rs=await rpc('business_roles_snapshot',s,{p_workspace_id:f.id});ensure(rs.status===200&&rs.data?.can_manage===true&&rs.data.roles.length===6&&rs.data.overrides.length===0,'PRISTINE_BUILTIN_ROLES_REQUIRED');f.roles=rs.data.roles;
   ensure(f.roles.every(x=>x.is_system&&x.scope_mode==='legacy'&&x.status==='active')&&equal(f.roles.map(x=>x.code).sort(),[...ROLES].sort()),'BUILTIN_ROLE_CONTRACT_MISMATCH');
   fixtures.push(f);
  }
  const [f,other]=fixtures,[owner,member]=sessions;ensure(f.id!==other.id,'DISTINCT_BUSINESSES_REQUIRED');const originalOther=await snapshot(other,['business_profiles','workspace_members','business_roles','business_role_permissions','business_member_permissions','business_member_scopes','business_dimensions','business_categories','business_expense_claims']);const preserved=await preservation();
  pass('Two isolated businesses have active synthetic entitlement, exact known dimensions and approved USD 1 claims; reminders and FX disabled');
  phase='B01 owner and foreign permission controls';
  const ep=await rpc('business_effective_permissions',owner,{p_workspace_id:f.id});ensure(ep.status===200&&Array.isArray(ep.data)&&ep.data.length>=24&&ep.data.every(x=>x.allowed===true),'OWNER_EFFECTIVE_PERMISSION_CONTROL_FAILED');permissions.push({role:'business_owner',allowed:ep.data.map(x=>x.permission_code).sort()});
  const unknown=await rpc('business_has_permission',owner,{p_workspace_id:f.id,p_permission_code:'audit.unknown'});ensure(unknown.status===200&&unknown.data===false,'UNKNOWN_PERMISSION_GRANTED');
  for(const actor of [member,undefined]){
   const r=await rpc('business_has_permission',actor,{p_workspace_id:f.id,p_permission_code:'workspace.view'});ensure((r.status===200&&r.data===false)||permissionDenied(r),'FOREIGN_BUSINESS_PERMISSION_GRANTED');
   for(const claim of f.claims)ensure(rowDenied(await request(route('business_expense_claims','id=eq.'+claim.id),{session:actor})),'FOREIGN_CLAIM_EXPOSED');
  }pass('B01 Owner has known effective permissions; unknown, foreign and anonymous boundaries deny access to known claims');
  phase='B03 role owner gate and effect checks';
  const roleBody={p_workspace_id:f.id,p_code:null,p_name:'AUDIT-S333-ROLE',p_description:'Synthetic audit',p_scope_mode:'all',p_permissions:['workspace.view','reports.view'],p_expected_version:null};
  const roleTables=['business_profiles','business_roles','business_role_permissions','business_member_permissions'];
  for(const actor of [member,undefined])await deny('save_business_role',actor,roleBody,['BUSINESS_OWNER_REQUIRED'],f,roleTables,'ROLE_DENIAL_NOT_AUTHORIZATION');
  for(const patch of [{p_permissions:['workspace.view','reports.export']},{p_scope_mode:'own',p_permissions:['workspace.view','finance.view_all']},{p_name:'Owner'}])await deny('save_business_role',owner,{...roleBody,...patch},['BUSINESS_PERMISSION_DEPENDENCY_REQUIRED','BUSINESS_OWN_RECORDS_PERMISSION_CONFLICT','BUSINESS_SYSTEM_ROLE_PROTECTED'],f,roleTables);
  const disposable=await ok('save_business_role',owner,roleBody);ensure(disposable.scope_mode==='all'&&disposable.version===1,'ROLE_CREATE_VALUES_INVALID');
  const edited=await ok('save_business_role',owner,{...roleBody,p_code:disposable.code,p_name:'AUDIT-S333-ROLE-EDITED',p_expected_version:1});ensure(edited.version===2,'ROLE_EDIT_VERSION_INVALID');
  await deny('save_business_role',owner,{...roleBody,p_code:disposable.code,p_expected_version:1},['BUSINESS_ROLE_CHANGED'],f,roleTables);
  await ok('archive_business_role',owner,{p_workspace_id:f.id,p_code:disposable.code,p_expected_version:2});ensure((await one('business_roles','workspace_id=eq.'+f.id+'&code=eq.'+disposable.code,owner)).status==='archived','ROLE_ARCHIVE_READBACK_FAILED');
  await deny('archive_business_role',owner,{p_workspace_id:f.id,p_code:'viewer',p_expected_version:1},['BUSINESS_SYSTEM_ROLE_PROTECTED'],f,roleTables);
  await directDenied('business_roles','workspace_id=eq.'+f.id+'&code=eq.viewer',owner,'PATCH',{scope_mode:'all'},f,roleTables);
  pass('B03 Owner creates, edits and archives a custom role; nonowner/anonymous, dependency, own-mode, stale-version, system-role and direct-table controls preserve protected state');
  phase='B04 invitations, recipient and state controls';
  const invArgs={p_workspace_id:f.id,p_email:EMAILS[1],p_role:'viewer',p_scope_ids:[]};
  const teamTables=['workspace_members','workspace_invitations','business_member_scopes','business_invitation_scopes'];
  let inv=await ok('create_business_invitation',owner,invArgs);ensure(UUID.test(inv.invitation_id||'')&&inv.invitee_user_id===member.id,'INVITATION_RECIPIENT_INVALID');
  await deny('respond_business_invitation',owner,{p_invitation_id:inv.invitation_id,p_accept:true},['BUSINESS_INVITATION_NOT_AVAILABLE'],f,teamTables);
  await deny('respond_business_invitation',undefined,{p_invitation_id:inv.invitation_id,p_accept:true},['AUTHENTICATION_REQUIRED'],f,teamTables);
  await ok('edit_business_invitation',owner,{p_invitation_id:inv.invitation_id,p_role:'staff',p_scope_ids:[],p_expected_version:1});
  await deny('edit_business_invitation',owner,{p_invitation_id:inv.invitation_id,p_role:'viewer',p_scope_ids:[],p_expected_version:1},['BUSINESS_INVITATION_CHANGED'],f,teamTables);
  await ok('cancel_business_invitation',owner,{p_invitation_id:inv.invitation_id});
  await deny('respond_business_invitation',member,{p_invitation_id:inv.invitation_id,p_accept:true},['BUSINESS_INVITATION_NOT_AVAILABLE'],f,teamTables);
  inv=await ok('create_business_invitation',owner,invArgs);await ok('respond_business_invitation',member,{p_invitation_id:inv.invitation_id,p_accept:true});
  f.member=await one('workspace_members','workspace_id=eq.'+f.id+'&user_id=eq.'+member.id,owner);ensure(f.member.role==='viewer'&&f.member.status==='active','ACCEPTED_MEMBER_READBACK_FAILED');
  await deny('respond_business_invitation',member,{p_invitation_id:inv.invitation_id,p_accept:true},['BUSINESS_INVITATION_NOT_AVAILABLE'],f,teamTables);
  const acceptedInvitation=inv.invitation_id;
  pass('B04 Owner invitation create/edit/cancel and matching recipient acceptance work; wrong-recipient, anonymous, stale edit, cancelled and accepted replay have no membership effects');
  async function changeRole(code,scopes=[]){await ok('update_business_member_access',owner,{p_workspace_id:f.id,p_member_id:f.member.id,p_role:code,p_scope_ids:scopes});const m=await one('workspace_members','id=eq.'+f.member.id,owner);ensure(m.role===code&&m.status==='active','ROLE_TRANSITION_READBACK_FAILED');const ss=await rows('business_member_scopes','workspace_id=eq.'+f.id+'&member_id=eq.'+m.id,owner);ensure(equal(ss.map(x=>x.dimension_id).sort(),[...scopes].sort()),'ROLE_SCOPE_TRANSITION_READBACK_FAILED');}
  phase='B01 six built-in role captures and valid paths';
  const deps={'reports.export':'reports.view','budgets.manage':'budgets.view','team.manage':'team.view','approvals.review':'approvals.view','finance.record_payment':'finance.view_all','documents.manage':'documents.view'};
  for(const code of ROLES){
   await changeRole(code);const effective=await rpc('business_effective_permissions',member,{p_workspace_id:f.id});ensure(effective.status===200&&effective.data.length===ep.data.length,'MEMBER_EFFECTIVE_PERMISSIONS_FAILED');
   const grants=f.roles.find(x=>x.code===code).permissions;const expected=grants.filter(x=>!deps[x]||grants.includes(deps[x])).sort();
   ensure(equal(effective.data.filter(x=>x.allowed).map(x=>x.permission_code).sort(),expected),'BUILTIN_EFFECTIVE_PERMISSION_MISMATCH');permissions.push({role:code,allowed:expected});
   const view=await rpc('business_has_permission',member,{p_workspace_id:f.id,p_permission_code:'workspace.view'});ensure(view.status===200&&view.data===true,'MATCHING_MEMBER_POSITIVE_FAILED');
   if(expected.includes('reports.view')){const r=await rpc('business_report_summary',member,reportArgs(f));ensure(r.status===200&&r.data?.metadata?.workspace_id===f.id,'MATCHING_ROLE_REPORT_POSITIVE_FAILED');}
   else ensure(rpcDenied(await rpc('business_report_summary',member,reportArgs(f)),['BUSINESS_REPORT_ACCESS_REQUIRED']),'ROLE_REPORT_DENIAL_FAILED');
   pass('B01 '+code+' effective grant/dependency capture and legitimate workspace/report control');
  }
  phase='B04 matching nonowner manager and escalation checks';await changeRole('team_manager',[f.dims[0].id]);
  const pending=await ok('create_business_invitation',member,{p_workspace_id:f.id,p_email:'audit.pending@example.com',p_role:'viewer',p_scope_ids:[f.dims[0].id]});
  await ok('edit_business_invitation',member,{p_invitation_id:pending.invitation_id,p_role:'viewer',p_scope_ids:[f.dims[0].id],p_expected_version:1});
  await deny('edit_business_invitation',member,{p_invitation_id:pending.invitation_id,p_role:'business_admin',p_scope_ids:[f.dims[0].id],p_expected_version:2},['BUSINESS_PRIVILEGE_ESCALATION_BLOCKED'],f,teamTables);
  await deny('edit_business_invitation',member,{p_invitation_id:pending.invitation_id,p_role:'viewer',p_scope_ids:[f.dims[1].id],p_expected_version:2},['BUSINESS_SCOPE_ESCALATION_BLOCKED'],f,teamTables);
  await deny('update_business_member_access',member,{p_workspace_id:f.id,p_member_id:f.member.id,p_role:'viewer',p_scope_ids:[f.dims[0].id]},['BUSINESS_SELF_ACCESS_CHANGE_BLOCKED'],f,teamTables);
  await deny('update_business_member_access',member,{p_workspace_id:f.id,p_member_id:f.ownerMember.id,p_role:'viewer',p_scope_ids:[f.dims[0].id]},['INVALID_BUSINESS_MEMBER'],f,teamTables);
  await deny('update_business_member_access',owner,{p_workspace_id:f.id,p_member_id:other.ownerMember.id,p_role:'viewer',p_scope_ids:[]},['INVALID_BUSINESS_MEMBER'],f,teamTables);
  await ok('cancel_business_invitation',member,{p_invitation_id:pending.invitation_id});
  pass('B04 Scoped Team Manager can create/edit/cancel a lower-role database-only invitation; privilege, outside-scope, self, Owner and foreign-member changes are rejected');
  phase='B05 selected finance lifecycle';await changeRole('staff');
  const today=new Date().toISOString().slice(0,10),claimArgs={p_workspace_id:f.id,p_kind:'company_expense',p_title:'AUDIT-S333-MEMBER-CLAIM',p_description:'Synthetic USD 1',p_category_id:f.category.id,p_dimension_id:f.dims[0].id,p_amount:1,p_currency:'USD',p_expense_date:today};
  let claim=await ok('create_business_claim',member,claimArgs);ensure(UUID.test(claim.id||'')&&claim.submitted_by===member.id&&claim.status==='draft','MEMBER_DRAFT_SCOPE_INVALID');
  const draftArgs={...claimArgs,p_claim_id:claim.id,p_expected_version:1};delete draftArgs.p_kind;
  claim=await ok('save_business_claim_draft',member,{...draftArgs,p_title:'AUDIT-S333-MEMBER-CLAIM-EDITED'});ensure(claim.version===2,'DRAFT_VERSION_INVALID');
  await deny('save_business_claim_draft',owner,{...draftArgs,p_expected_version:claim.version},['BUSINESS_CLAIM_CHANGED'],f,['business_expense_claims']);
  await deny('create_business_claim',member,{...claimArgs,p_category_id:other.category.id},['BUSINESS_EXPENSE_CATEGORY_REQUIRED'],f,['business_expense_claims']);
  await deny('create_business_claim',member,{...claimArgs,p_dimension_id:other.dims[0].id},['BUSINESS_DIMENSION_REQUIRED'],f,['business_expense_claims']);
  await deny('create_business_claim',owner,{...claimArgs,p_workspace_id:other.id,p_category_id:other.category.id,p_dimension_id:other.dims[0].id},['BUSINESS_CLAIM_ACCESS_REQUIRED'],other,['business_expense_claims']);
  await directDenied('business_expense_claims','id=eq.'+claim.id,member,'PATCH',{submitted_by:owner.id,status:'approved'},f,['business_expense_claims']);
  await deny('save_business_claim_draft',member,{...draftArgs,p_expected_version:1},['BUSINESS_CLAIM_CHANGED'],f,['business_expense_claims']);
  await deny('submit_business_claim',member,{p_workspace_id:f.id,p_claim_id:claim.id,p_expected_version:claim.version},['BUSINESS_RECEIPT_REQUIRED'],f,['business_expense_claims']);
  await deny('review_business_claim',member,{p_workspace_id:f.id,p_claim_id:claim.id,p_expected_version:claim.version,p_decision:'approved',p_reason:null},['BUSINESS_REVIEW_ACCESS_REQUIRED'],f,['business_expense_claims']);
  pass('B05 Staff creates/edits an attributed draft; parent/workspace substitution, other submitter, direct DML, stale edit and missing-receipt state checks preserve known claims; unauthorized review is denied');
  blocked('B05 Complete submit/review and review replay with valid receipt','NO_CONTROLLED_PRIVATE_FILE_PREPARED');
  phase='B02 custom own assigned all scope modes';
  const custom=[];
  for(const mode of ['own','assigned','all'])custom.push(await ok('save_business_role',owner,{...roleBody,p_name:'AUDIT-S333-'+mode.toUpperCase(),p_scope_mode:mode,p_permissions:mode==='own'?['workspace.view','finance.create','reports.view','documents.view']:['workspace.view','finance.create','finance.view_all','reports.view','reports.export','documents.view','budgets.view','budgets.manage']}));
  const ownerFirst=f.claims.find(x=>x.dimension_id===f.dims[0].id),ownerSecond=f.claims.find(x=>x.dimension_id===f.dims[1].id);
  await changeRole(custom[0].code);ensure((await rows('business_expense_claims','id=eq.'+claim.id,member)).length===1,'CUSTOM_OWN_POSITIVE_FAILED');
  for(const c of f.claims)ensure(rowDenied(await request(route('business_expense_claims','id=eq.'+c.id),{session:member})),'CUSTOM_OWN_FOREIGN_SUBMITTER_EXPOSED');
  await report(f,member,[claim.id]);pass('B02 Custom own role sees its own known claim and report row; other submitter rows stay hidden');
  await deny('update_business_member_access',owner,{p_workspace_id:f.id,p_member_id:f.member.id,p_role:custom[1].code,p_scope_ids:[]},['BUSINESS_ASSIGNED_SCOPE_REQUIRED'],f,teamTables);
  await changeRole(custom[1].code,[f.dims[0].id]);ensure((await rows('business_expense_claims','id=eq.'+ownerFirst.id,member)).length===1,'ASSIGNED_POSITIVE_FAILED');
  ensure(rowDenied(await request(route('business_expense_claims','id=eq.'+ownerSecond.id),{session:member})),'OUTSIDE_ASSIGNED_CLAIM_EXPOSED');
  await deny('create_business_claim',member,{...claimArgs,p_dimension_id:f.dims[1].id},['BUSINESS_SCOPE_ACCESS_REQUIRED'],f,['business_expense_claims']);
  await report(f,member,[ownerFirst.id,claim.id]);pass('B02 Custom assigned role sees known matching scope and report rows; empty assignment and outside-dimension writes are rejected');
  await changeRole(custom[2].code);await report(f,member,[...f.claims.map(x=>x.id),claim.id]);
  for(const c of other.claims)ensure(rowDenied(await request(route('business_expense_claims','id=eq.'+c.id),{session:owner})),'OTHER_BUSINESS_CLAIM_EXPOSED');
  pass('B02 Custom all sees both matching-business dimensions; all never grants another business');
  phase='B03 in-use and overrides with dependencies';
  await deny('archive_business_role',owner,{p_workspace_id:f.id,p_code:custom[2].code,p_expected_version:1},['BUSINESS_ROLE_IN_USE'],f,roleTables);
  await deny('save_business_role',owner,{...roleBody,p_code:custom[2].code,p_name:custom[2].name,p_scope_mode:'assigned',p_expected_version:1},['BUSINESS_ROLE_SCOPE_IN_USE'],f,roleTables);
  const override={p_workspace_id:f.id,p_member_id:f.member.id,p_permission_code:'reports.view',p_effect:'deny'};
  await deny('set_business_member_permission',member,override,['BUSINESS_OWNER_REQUIRED'],f,roleTables);
  await ok('set_business_member_permission',owner,override);const dependent=await rpc('business_has_permission',member,{p_workspace_id:f.id,p_permission_code:'reports.export'});ensure(dependent.status===200&&dependent.data===false,'EXPORT_VIEW_DEPENDENCY_BYPASSED');
  await deny('business_report_summary',member,reportArgs(f),['BUSINESS_REPORT_ACCESS_REQUIRED'],f,['business_expense_claims']);
  await ok('set_business_member_permission',owner,{...override,p_effect:'allow'});ensure((await rpc('business_has_permission',member,{p_workspace_id:f.id,p_permission_code:'reports.export'})).data===true,'OWNER_ALLOW_OVERRIDE_FAILED');
  await ok('set_business_member_permission',owner,{...override,p_effect:null});
  await directDenied('business_member_permissions','workspace_id=eq.'+f.id,member,'POST',{workspace_id:f.id,member_id:f.member.id,permission_code:'subscription.manage',effect:'allow'},f,['business_member_permissions']);
  pass('B03 In-use archive/scope changes and nonowner/direct overrides are blocked; Owner deny/allow/clear works and export cannot bypass denied report view');
  phase='B06 records and protected export';
  const rep=await report(f,member,[...f.claims.map(x=>x.id),claim.id]);
  const exportArgs={...rep.args,p_export_id:uuid(),p_format:'print'};
  const exported=await ok('business_report_export',member,exportArgs);ensure(exported.total_count===3&&equal(exported.items.map(x=>x.record_id).sort(),[...f.claims.map(x=>x.id),claim.id].sort()),'EXPORT_SCOPE_MISMATCH');
  await deny('business_report_export',member,{...exportArgs,p_expected_fingerprint:'0'.repeat(32)},['BUSINESS_REPORT_CHANGED'],f,['business_expense_claims']);
  await deny('business_report_summary',member,{...reportArgs(f),p_dimension_id:other.dims[0].id},['INVALID_BUSINESS_REPORT_FILTER'],f,['business_expense_claims']);
  await deny('business_report_export',owner,{...exportArgs,p_workspace_id:other.id},['ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'],other,['business_expense_claims']);
  await changeRole('viewer');const vr=await rpc('business_report_summary',member,reportArgs(f));ensure(vr.status===200,'VIEWER_REPORT_POSITIVE_FAILED');
  await deny('business_report_export',member,{...exportArgs,p_expected_fingerprint:vr.data.fingerprint},['BUSINESS_REPORT_EXPORT_REQUIRED'],f,['business_expense_claims']);
  pass('B06 Known report rows and original protected export agree; stale fingerprint, foreign filters/business and Viewer export denial are verified');
  blocked('B06 Harmless private receipt original/download authorization','NO_CONTROLLED_PRIVATE_FILE_PREPARED');
  phase='B05 budget and bill selected controls';
  const budgetArgs={p_workspace_id:f.id,p_budget_id:uuid(),p_expected_version:null,p_name:'AUDIT-S333-BUDGET',p_category_id:f.category.id,p_dimension_id:f.dims[0].id,p_starts_on:today,p_ends_on:today,p_period_type:'custom',p_planned_amount:1};
  const budget=await ok('save_business_budget',owner,budgetArgs);ensure(budget.status==='draft'&&budget.workspace_id===f.id,'BUDGET_POSITIVE_VALUES_INVALID');
  await deny('save_business_budget',member,{...budgetArgs,p_expected_version:budget.version,p_planned_amount:2},['BUSINESS_BUDGET_ACCESS_REQUIRED'],f,['business_budgets']);
  await deny('save_business_budget',owner,{...budgetArgs,p_expected_version:budget.version,p_dimension_id:other.dims[0].id},['BUSINESS_DIMENSION_REQUIRED'],f,['business_budgets']);
  await directDenied('business_budgets','id=eq.'+budget.id,member,'PATCH',{planned_amount:2},f,['business_budgets']);
  await changeRole('finance_manager');
  const paid=await ok('record_business_claim_payment',member,{p_workspace_id:f.id,p_claim_id:ownerFirst.id,p_expected_version:ownerFirst.version,p_paid_at:new Date().toISOString(),p_payment_reference:'AUDIT-S333-SYNTHETIC'});ensure(paid.status==='paid'&&paid.paid_by===member.id,'PAYMENT_POSITIVE_VALUES_INVALID');
  await deny('record_business_claim_payment',member,{p_workspace_id:f.id,p_claim_id:ownerFirst.id,p_expected_version:ownerFirst.version,p_paid_at:new Date().toISOString(),p_payment_reference:'AUDIT-S333-REPLAY'},['BUSINESS_CLAIM_CHANGED'],f,['business_expense_claims']);
  pass('B05 Owner draft budget and Finance Manager synthetic payment recording work; Viewer budget, foreign dimension, direct DML and payment replay are denied');
  blocked('B05 Bill and spending-request lifecycle','NOT_SELECTED_FOR_THIS_TWO_ACCOUNT_BATCH');
  phase='B08 backend permits and business labels';
  for(const [name,body] of [['business_public_provision_permit',{p_workspace_id:f.id,p_owner_id:owner.id}],['business_team_permit',{p_workspace_id:f.id,p_operation:'member_write'}]])ensure(permissionDenied(await rpc(name,member,body)),'BACKEND_PERMIT_NOT_PERMISSION_DENIED');
  ensure((await rpc('is_platform_staff',member,{p_roles:null})).data===false,'BUSINESS_LABEL_GAINED_PLATFORM_STAFF');
  await directDenied('workspace_members','id=eq.'+f.member.id,member,'PATCH',{role:'business_owner'},f,['workspace_members']);
  pass('B08 Business labels cannot gain platform staff; ordinary callers cannot invoke protected provisioning/team permits or directly promote membership');
  phase='B07 removal same-session denials';await changeRole('viewer');
  ensure((await rpc('business_has_permission',member,{p_workspace_id:f.id,p_permission_code:'workspace.view'})).data===true,'PRE_REMOVAL_POSITIVE_FAILED');
  await deny('remove_business_member',owner,{p_workspace_id:f.id,p_member_id:f.ownerMember.id},['INVALID_BUSINESS_MEMBER'],f,teamTables);
  await ok('remove_business_member',owner,{p_workspace_id:f.id,p_member_id:f.member.id});removed=true;
  ensure((await one('workspace_members','id=eq.'+f.member.id,owner)).status==='inactive','REMOVAL_READBACK_FAILED');
  for(const c of [...f.claims,claim])ensure(rowDenied(await request(route('business_expense_claims','id=eq.'+c.id),{session:member})),'REMOVED_MEMBER_CLAIM_EXPOSED');
  const lost=await rpc('business_has_permission',member,{p_workspace_id:f.id,p_permission_code:'workspace.view'});ensure(lost.status===200&&lost.data===false,'REMOVED_MEMBER_PERMISSION_RETAINED');
  await deny('business_report_summary',member,reportArgs(f),['ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'],f,['business_expense_claims']);
  await deny('respond_business_invitation',member,{p_invitation_id:acceptedInvitation,p_accept:true},['BUSINESS_INVITATION_NOT_AVAILABLE'],f,teamTables);
  await directDenied('workspace_members','id=eq.'+f.member.id,member,'PATCH',{status:'active'},f,['workspace_members']);
  ensure((await rpc('business_has_permission',member,{p_workspace_id:other.id,p_permission_code:'workspace.view'})).data===true,'REMOVAL_AFFECTED_OTHER_BUSINESS_OWNER');
  pass('B07 Exact matching member is removed; same session loses known claim/RPC/report access and cannot regain membership by replay or PATCH; Owner and separate business stay accessible');
  blocked('B07 Nonowner manager removes another ordinary member','THIRD_DISTINCT_IDENTITY_NOT_AVAILABLE');
  blocked('B07 Suspended account and expired entitlement acceptance','ISOLATED_STATE_FIXTURES_NOT_PREPARED');
  phase='Final retained-fixture and previous-stage preservation';
  ensure(equal(await snapshot(other,Object.keys(originalOther)),originalOther),'SECOND_BUSINESS_CHANGED');
  ensure(equal(await preservation(),preserved),'PREVIOUS_PERSONAL_FAMILY_OR_CONVERSIONS_CHANGED');
  pass('B08 Second Business selected state and previous Personal/Family/payment/conversion values remain unchanged');
 }catch(e){problem=e instanceof AuditError?e.message:'NETWORK_OR_LOCAL_ERROR';checks.push({check:phase,status:'REVIEW',problem_code:problem});}
 finally{if(config)for(const s of sessions){try{const r=await request('/auth/v1/logout?scope=local',{session:s,method:'POST'});if(![200,204].includes(r.status))logoutOk=false;}catch{logoutOk=false;}}}
 if(!problem&&(!logoutOk||sessions.length!==2)){problem='TEST_SESSION_LOGOUT_FAILED';checks.push({check:'Local test-session logout',status:'REVIEW',problem_code:problem});}
 else if(logoutOk&&sessions.length===2)pass('Only the two generated API sessions receive local logout');
 return {stage_step:'3.3.3',result:problem?'STAGING_BUSINESS_API_REVIEW':'STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD',project:'dczlddwbtgvfdujgcitb',checks,problem_code:problem,positive_rpc_failure:positiveRpcFailure,effective_permission_captures:permissions,
 request_count:requests,test_sessions_logged_out:logoutOk&&sessions.length===2,exact_primary_member_removed:removed,synthetic_business_fixtures_retained:true,
 incomplete_write_effects_may_remain:!!problem&&writes,private_original_download_or_actual_dispatch_verified:false,full_role_operation_matrix_or_F15_acceptance_verified:false,
 Auth_platform_roles_product_launch_production_or_native_changed:false,credentials_tokens_keys_private_identifiers_or_raw_rows_printed:false,completed_utc:new Date().toISOString()};
}
module.exports={run,parseConfig,rowDenied,rpcDenied,permissionDenied,AuditError,rpcSucceeded};
