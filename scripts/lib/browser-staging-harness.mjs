// In-memory adapter only. Actual deployed modules; full application bootstrap is excluded.
// Private values travel only over the loopback CDP socket, never a URL or persisted storage.
export function harnessExpression(session,api,key){
 return `(async()=>{const {createSessionEntry}=await import('/session-entry.js');
 let current=${JSON.stringify({user:{id:session.actor.user},access_token:session.token})};
 const api=${JSON.stringify(api)},key=${JSON.stringify(key)};
 const auth=()=>({apikey:key,Authorization:'Bearer '+current.access_token});
 const json=async response=>{if(response.redirected||!response.ok||!/application\\/json/i.test(response.headers.get('content-type')||''))throw Error('CHECK_REQUIRED');const bytes=await response.arrayBuffer();if(bytes.byteLength>8192)throw Error('CHECK_REQUIRED');return JSON.parse(new TextDecoder().decode(bytes));};
 const rpc=async()=>{try{return {data:await json(await fetch(api+'/rest/v1/rpc/email_gate_current_session_verified',{method:'POST',credentials:'omit',cache:'no-store',redirect:'error',headers:{...auth(),'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(12000)})),error:null};}catch{return {data:null,error:{}};}};
 const root=document.querySelector('#gate'),view=document.querySelector('#private');
 const entry=createSessionEntry({client:{rpc},getSession:()=>current,root,origin:location.origin,events:null,show:()=>{root.hidden=false;},onInvalidated:()=>view.replaceChildren(),onUnlocked:()=>{view.textContent='Controlled session verified';},onSignOut:()=>{current=null;entry.bind(null);}});
 window.__mushavoAcceptance={entry,async recheck(){const ok=await entry.recheck();if(ok&&entry.ticket()())view.textContent='Controlled session verified';return ok;},bind(next){current=next;entry.bind(current);},async http(foreign){const gateway=await json(await fetch('/api/email-verification/status',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{Authorization:'Bearer '+current.access_token,'Content-Type':'application/json','X-Mushavo-CSRF':'email-v1'},body:'{}',signal:AbortSignal.timeout(12000)}));const proof=await rpc();const own=await json(await fetch(api+'/rest/v1/profiles?select=id&id=eq.'+current.user.id,{credentials:'omit',cache:'no-store',redirect:'error',headers:auth(),signal:AbortSignal.timeout(12000)}));const other=await json(await fetch(api+'/rest/v1/profiles?select=id&id=eq.'+foreign,{credentials:'omit',cache:'no-store',redirect:'error',headers:auth(),signal:AbortSignal.timeout(12000)}));return {gateway:gateway.verified,rpc:proof.data,own:Array.isArray(own)&&own.length===1&&own[0].id===current.user.id,ownDenied:Array.isArray(own)&&own.length===0,foreignDenied:Array.isArray(other)&&other.length===0};}};
 await window.__mushavoAcceptance.recheck();return true;})()`;
}
export const lockedExpression='!__mushavoAcceptance.entry.authorized&&document.querySelector("#private").textContent===""';
export const cleanDocument='<!doctype html><meta charset="utf-8"><title>Controlled Mushavo staging acceptance</title><main id="gate"></main><section id="private"></section>';
