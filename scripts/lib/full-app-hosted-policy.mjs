// Finite full-app traffic policy; SQL/RLS remains authoritative for allowed reads.
import {appTables,appRPCs} from './full-app-rest-fixture.mjs';
import {pagesHTMLAliases} from './full-app-pages-redirects.mjs';
export const hostedAppLimits=Object.freeze({attempts:1800,preflights:450,begin:1,verify:1,refresh:1,localLogout:2,activity:12,socketConnections:12,socketMessages:128});
const uuid=s=>typeof s==='string'&&/^[a-f0-9-]{36}$/i.test(s),empty=b=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).length===0;
export function fullAppHostPolicy({origin,api,publishableKey,sources,fixture=false}){
 if((!fixture&&(origin!=='https://mushavo-budget-staging.pages.dev'||api!=='https://dczlddwbtgvfdujgcitb.supabase.co'))||fixture&&(!/^https:\/\/localhost:[0-9]+$/.test(origin)||!/^https:\/\/127\.0\.0\.1:[0-9]+$/.test(api))||!(sources instanceof Map))throw Error('FULL_APP_POLICY_INPUT_REQUIRED');
 const r={attempts:0,blocked:0,session_transitions:0,retired_requests_cancelled:0,preflights:0,begin:0,verify:0,refresh:0,localLogout:0,activity:0,maximum:hostedAppLimits.attempts};let selected=[],challenge=null,deadline=null,firstDenial=null,firstDenialFacts=null,lastRequestFacts=null;const pages=new Map(),transitions=new Map();
 const no=c=>{r.blocked++;firstDenial??=c;firstDenialFacts??={code:c,...lastRequestFacts};return false;};
 function allow(p,session){
  lastRequestFacts={route:'OTHER',method:['GET','POST','OPTIONS','PATCH','DELETE','PUT'].includes(p?.method)?p.method:'OTHER',bound_index:Number.isInteger(pages.get(session))?pages.get(session):null};r.attempts++;if(r.attempts>hostedAppLimits.attempts||!p||typeof p.url!=='string'||p.url.length>8192)return no('REQUEST_BOUND');let u,b;try{u=new URL(p.url);b=p.postData?JSON.parse(p.postData):{};}catch{return no('URL_OR_BODY');}
  if(u.username||u.password||u.hash||p.url!==u.href||p.redirectedRequestId)return no('URL_IDENTITY');const h=Object.fromEntries(Object.entries(p.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  if(u.origin===origin&&p.method==='GET'&&!h.authorization&&!p.postData&&(sources.has(u.pathname)||Object.hasOwn(pagesHTMLAliases,u.pathname)||['/config.js','/app','/app-entry','/offline','/favicon.ico'].includes(u.pathname))&&[...u.searchParams.keys()].every(k=>['v','source','auth','workspace_unavailable'].includes(k)))return true;
  let index=pages.get(session),s=selected[index];if(!s)return no('UNBOUND_PRIVATE_PAGE');
  const gate=u.origin===origin&&!u.search&&/^\/api\/email-verification\/(?:status|restore|begin|verify)$/.test(u.pathname),rpc=u.origin===api&&!u.search&&u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/),table=u.origin===api&&u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/),auth=u.origin===api&&u.pathname.match(/^\/auth\/v1\/(user|logout|token)$/);
  const backend=!!(rpc&&appRPCs.has(rpc[1])||table&&appTables.has(table[1])||auth);
  const t=transitions.get(session),to=t?selected[t.to]:null,from=t?selected[t.from]:null;lastRequestFacts={...lastRequestFacts,route:auth?'AUTH_'+auth[1].toUpperCase():rpc&&appRPCs.has(rpc[1])?'RPC_'+rpc[1]:table&&appTables.has(table[1])?'TABLE_'+table[1]:gate?'GATE_'+u.pathname.split('/').at(-1):'OTHER',bearer_matches_bound:h.authorization==='Bearer '+s.token,bearer_matches_transition_from:!!from&&h.authorization==='Bearer '+from.token,bearer_matches_transition_to:!!to&&h.authorization==='Bearer '+to.token,transition_phase:t?.phase||'NONE'};
  if(p.method==='OPTIONS'&&backend&&!h.authorization&&!h.apikey&&!p.postData){const names=String(h['access-control-request-headers']||'').toLowerCase().split(',').map(x=>x.trim()).filter(Boolean);return ++r.preflights<=hostedAppLimits.preflights&&h.origin===origin&&['GET','POST'].includes(h['access-control-request-method'])&&names.every(x=>['accept','authorization','apikey','content-type','x-client-info','x-supabase-api-version','accept-profile','content-profile','prefer','range','range-unit'].includes(x))?true:no('PREFLIGHT_BOUND');}
  if(deadline!==null&&Date.now()>=deadline&&!gate)return no('ACTIVE_DEADLINE');
  // The SDK must validate the replacement identity before its auth callback
  // rebinds the app. No replacement-session application read is admitted until
  // its first exact proof request; the driver holds that request before send.
  if(t?.phase==='PENDING_AUTH'&&h.authorization==='Bearer '+to.token&&h.apikey===publishableKey){
   if(auth?.[1]==='user'&&p.method==='GET'&&!u.search&&!p.postData){if(++t.userReads>2)return no('TRANSITION_USER_READ_BOUND');return true;}
   if(rpc?.[1]==='email_gate_current_session_verified'&&p.method==='POST'&&empty(b)){if(t.identityConfirmed!==true)return no('TRANSITION_IDENTITY_REQUIRED');pages.set(session,t.to);t.phase='PROOF_BOUND';index=t.to;s=to;}
  }
  if(auth&&auth[1]==='token'&&u.search==='?grant_type=refresh_token'&&p.method==='POST'&&index===0&&h.apikey===publishableKey&&Object.keys(b).join(',')==='refresh_token'&&b.refresh_token===s.refreshToken)return ++r.refresh<=1?true:no('REFRESH_BOUND');
  if(!(h.authorization==='Bearer '+s.token||typeof s.previousToken==='string'&&h.authorization==='Bearer '+s.previousToken))return no('BEARER_BINDING');
  if(gate&&p.method==='POST'&&h.origin===origin&&h['x-mushavo-csrf']==='email-v1'&&!h.apikey){const route=u.pathname.split('/').at(-1);if(['status','restore'].includes(route)&&empty(b))return true;if(index===0&&route==='begin'&&Object.keys(b).join(',')==='remember'&&b.remember===true)return ++r.begin<=1?true:no('EMAIL_BOUND');if(index===0&&route==='verify'&&Object.keys(b).sort().join(',')==='challengeId,code'&&b.challengeId===challenge&&/^\d{6}$/.test(b.code))return ++r.verify<=1?true:no('VERIFY_BOUND');return no('GATEWAY_BODY');}
  if(h.apikey!==publishableKey)return no('API_KEY_BINDING');
  if(auth){if(auth[1]==='user')return p.method==='GET'&&!u.search;if(auth[1]==='logout'&&p.method==='POST'&&u.search==='?scope=local'&&empty(b))return ++r.localLogout<=2?true:no('LOGOUT_BOUND');return no('AUTH_ROUTE');}
  if(rpc&&p.method==='POST'&&appRPCs.has(rpc[1])&&b&&typeof b==='object'&&!Array.isArray(b)){
   if(['effective_workspace_entitlement','workspace_billable_member_count','workspace_member_usage','personal_payment_plan_access'].includes(rpc[1]))return Object.keys(b).join(',')==='p_workspace_id'&&uuid(b.p_workspace_id)?true:no('RPC_BODY');
   if(rpc[1]==='exchange_rate_status')return Object.keys(b).join(',')==='p_include_admin_details'&&b.p_include_admin_details===false?true:no('RPC_BODY');
   if(!empty(b))return no('RPC_BODY');if(rpc[1]==='record_my_analytics_activity')return ++r.activity<=hostedAppLimits.activity?true:no('ACTIVITY_BOUND');return true;
  }
  if(table&&appTables.has(table[1])&&p.method==='GET'&&!p.postData&&[...u.searchParams].length<=12&&[...u.searchParams.keys()].every(k=>/^[a-z_]+$/.test(k))){if(table[1]==='profiles'&&![s.actor.user,selected[3]?.actor.user].some(id=>u.searchParams.get('id')==='eq.'+id))return no('PROFILE_SCOPE');return true;}
  return no('UNREVIEWED_ROUTE_OR_WRITE');
 }

 function beginSessionChange(page,toIndex){
  const fromIndex=pages.get(page),from=selected[fromIndex],to=selected[toIndex],prior=transitions.get(page);
  if(![1,2].includes(fromIndex)||![1,2].includes(toIndex)||fromIndex===toIndex||!from||!to||from.actor.user!==to.actor.user||from.actor.session===to.actor.session||deadline===null||Date.now()>=deadline||prior?.phase==='PENDING_AUTH'||r.session_transitions>=2)throw Error('SESSION_TRANSITION_REQUIRED');
  transitions.set(page,{from:fromIndex,to:toIndex,phase:'PENDING_AUTH',userReads:0,identityConfirmed:false});r.session_transitions++;
 }
 function confirmTransitionIdentity(page,index){const t=transitions.get(page);if(!t||t.phase!=='PENDING_AUTH'||t.to!==index||t.userReads<1)throw Error('SESSION_TRANSITION_REQUIRED');t.identityConfirmed=true;}
 function cancelRetiredRequest(p,page){
  const t=transitions.get(page);if(!t||t.phase!=='PROOF_BOUND')return false;
  if(typeof p?.url!=='string'||p.url.length>8192)return false;let u,b;try{u=new URL(p.url);b=p.postData?JSON.parse(p.postData):{};}catch{return false;}
  const h=Object.fromEntries(Object.entries(p.headers||{}).map(([k,v])=>[k.toLowerCase(),v])),from=selected[t.from];
  if(!from||u.username||u.password||u.hash||u.href!==p.url||p.redirectedRequestId||h.authorization!=='Bearer '+from.token)return false;
  const rpc=u.origin===api&&!u.search&&u.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/),table=u.origin===api&&u.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
  let valid=false;
  if(u.origin===api&&h.apikey===publishableKey){
   if(p.method==='GET'&&!p.postData&&u.pathname==='/auth/v1/user'&&!u.search)valid=true;
   if(table&&appTables.has(table[1])&&p.method==='GET'&&!p.postData&&[...u.searchParams].length<=12&&[...u.searchParams.keys()].every(k=>/^[a-z_]+$/.test(k))&&(table[1]!=='profiles'||[from.actor.user,selected[3].actor.user].some(id=>u.searchParams.get('id')==='eq.'+id)))valid=true;
   if(rpc&&appRPCs.has(rpc[1])&&p.method==='POST'&&b&&typeof b==='object'&&!Array.isArray(b)){
    if(['effective_workspace_entitlement','workspace_billable_member_count','workspace_member_usage','personal_payment_plan_access'].includes(rpc[1]))valid=Object.keys(b).join(',')==='p_workspace_id'&&uuid(b.p_workspace_id);
    else if(rpc[1]==='exchange_rate_status')valid=Object.keys(b).join(',')==='p_include_admin_details'&&b.p_include_admin_details===false;
    else valid=empty(b);
   }
  }
  if(u.origin===origin&&!u.search&&['/api/email-verification/status','/api/email-verification/restore'].includes(u.pathname)&&p.method==='POST'&&empty(b)&&h.origin===origin&&h['x-mushavo-csrf']==='email-v1'&&!h.apikey)valid=true;
  if(!valid)return false;
  if(++r.attempts>hostedAppLimits.attempts||++r.retired_requests_cancelled>64){no('RETIRED_REQUEST_BOUND');return false;}
  return true; // Caller must abort the paused request, never continue it.
 }

 return {allow,beginSessionChange,confirmTransitionIdentity,cancelRetiredRequest,currentIndex:page=>pages.get(page),transitionInfo:page=>{const t=transitions.get(page);return t?{from_index:t.from,to_index:t.to,phase:t.phase,identity_reads:t.userReads,identity_confirmed:t.identityConfirmed}:null;},denialFacts:()=>firstDenialFacts,bind:(page,index)=>{if(!Number.isInteger(index)||index<0||index>3)throw Error('PAGE_BIND_REQUIRED');pages.set(page,index);},sessions:values=>{if(selected.length||!Array.isArray(values)||values.length!==4)throw Error('SELECTED_SESSIONS_REQUIRED');selected=values;},challenge:value=>{if(!uuid(value))throw Error('CHALLENGE_REQUIRED');challenge=value;},deadline:value=>{deadline=value;},safe:()=>({...r}),diagnostic:()=>firstDenial,clear:()=>{selected=[];pages.clear();transitions.clear();challenge=null;}};
}
