// Loopback synthetic acceptance policy only. Not authorization for hosted traffic.
import {appTables,appRPCs} from './full-app-rest-fixture.mjs';
export function localAppRequestAllowed(request,{origin,api,sources,guard}){
 let url;try{url=new URL(request.url);}catch{return false;}
 if(url.username||url.password||url.hash||request.url.length>8192)return false;
 const method=request.method;
 const object=body=>body&&typeof body==='object'&&!Array.isArray(body)&&Object.keys(body).length<=6;
 if(url.origin===origin){
  if(method==='GET'&&(sources.has(url.pathname)||['/config.js','/app','/app-entry','/offline','/favicon.ico'].includes(url.pathname)))return [...url.searchParams.keys()].every(x=>['v','source','auth','workspace_unavailable'].includes(x));
  if(method!=='POST'||url.search||!/^\/api\/email-verification\/(status|restore|begin|verify)$/.test(url.pathname))return false;
  let body;try{body=JSON.parse(request.postData);}catch{return false;}
  if(!body||Array.isArray(body)||typeof body!=='object')return false;
  const route=url.pathname.split('/').at(-1),keys=Object.keys(body).sort().join(',');
  if(route==='begin')return ++guard.begin<=1&&keys==='remember'&&typeof body.remember==='boolean';
  if(route==='verify')return ++guard.verify<=1&&keys==='challengeId,code'&&/^[a-f0-9-]{36}$/i.test(body.challengeId)&&/^[0-9]{6}$/.test(body.code);
  return keys==='';
 }
 if(url.origin!==api)return false;
 const rpc=url.pathname.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/),table=url.pathname.match(/^\/rest\/v1\/([a-z_]+)$/);
 const auth=url.pathname.match(/^\/auth\/v1\/(token|user|logout)$/);
 if(method==='OPTIONS')return ++guard.preflights<=400&&!!(auth||rpc&&appRPCs.has(rpc[1])||table&&appTables.has(table[1]));
 if(auth){
  if(auth[1]==='user')return method==='GET'&&!url.search;
  if(method!=='POST')return false;
  let body;try{body=JSON.parse(request.postData||'{}');}catch{return false;}
  if(!object(body))return false;
  if(auth[1]==='logout')return url.search==='?scope=local'&&Object.keys(body).length===0;
  if(url.search==='?grant_type=password')return Object.keys(body).every(k=>['email','password','gotrue_meta_security'].includes(k))&&typeof body.email==='string'&&body.email.endsWith('@example.invalid')&&typeof body.password==='string'&&body.password.startsWith('SYNTHETIC_');
  if(url.search==='?grant_type=refresh_token')return Object.keys(body).length===1&&typeof body.refresh_token==='string'&&body.refresh_token.startsWith('SYNTHETIC_REFRESH_');
  return false;
 }
 if(rpc){
  if(method!=='POST'||url.search||!appRPCs.has(rpc[1]))return false;
  let body;try{body=JSON.parse(request.postData||'{}');}catch{return false;}
  if(!object(body))return false;
  const workspace=['effective_workspace_entitlement','workspace_billable_member_count','workspace_member_usage','personal_payment_plan_access'];
  if(workspace.includes(rpc[1]))return Object.keys(body).join(',')==='p_workspace_id'&&/^[a-f0-9-]{36}$/.test(body.p_workspace_id);
  if(rpc[1]==='exchange_rate_status')return Object.keys(body).join(',')==='p_include_admin_details'&&body.p_include_admin_details===false;
  return Object.keys(body).length===0;
 }
 return !!table&&appTables.has(table[1])&&method==='GET'&&[...url.searchParams].length<=12&&[...url.searchParams.keys()].every(k=>/^[a-z_]+$/.test(k));
}
