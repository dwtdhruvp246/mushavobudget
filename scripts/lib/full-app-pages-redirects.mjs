// Cloudflare Pages' finite HTML canonicalization. Never admits private or cross-origin redirects.
export const pagesHTMLAliases=Object.freeze({'/app':'/app.html','/app-entry':'/app-entry.html','/business':'/business.html','/auth':'/auth.html','/offline':'/offline.html'});
const fail=()=>{throw Error('BROWSER_PUBLIC_REDIRECT_REQUIRED');};
export function pagesPublicRedirects(origin){
 const pending=new Map();let verified=0,followed=0;
 const key=(session,id)=>session+'/'+id;
 return {
  response(p,session){
   if(!(p.responseStatusCode>=300&&p.responseStatusCode<400))return false;
   const u=new URL(p.request.url),clean=u.pathname.endsWith('.html')?u.pathname.slice(0,-5):null;
   const locations=(p.responseHeaders||[]).filter(h=>h.name.toLowerCase()==='location');
   if(p.responseStatusCode!==308||p.request.method!=='GET'||u.origin!==origin||u.username||u.password||u.hash||!clean||pagesHTMLAliases[clean]!==u.pathname||locations.length!==1||locations[0].value!==clean+u.search||Object.keys(p.request.headers||{}).some(h=>h.toLowerCase()==='authorization')||p.request.postData||pending.has(key(session,p.requestId)))fail();
   pending.set(key(session,p.requestId),origin+clean+u.search);verified++;return true;
  },
  request(p,session){
   if(!p.redirectedRequestId)return p;
   const k=key(session,p.redirectedRequestId),expected=pending.get(k);
   if(!expected||p.url!==expected||p.method!=='GET'||p.postData||Object.keys(p.headers||{}).some(h=>h.toLowerCase()==='authorization'))fail();
   pending.delete(k);followed++;return {...p,redirectedRequestId:undefined};
  },
  safe:()=>({public_HTML_redirects_verified:verified,public_HTML_redirect_requests_verified:followed}),
  clear(){pending.clear();}
 };
}
