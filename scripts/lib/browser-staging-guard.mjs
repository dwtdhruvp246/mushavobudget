// Fixed staging policy. A separate explicitly named loopback factory is for synthetic tests.
export const stagingOrigin='https://mushavo-budget-staging.pages.dev';
export const stagingAPI='https://dczlddwbtgvfdujgcitb.supabase.co';
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const empty=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===0;
export function stagingGuard(options){return policy({...options,origin:stagingOrigin,api:stagingAPI});}
export function loopbackStagingGuard({origin,api=origin,...options}){if(!/^https:\/\/localhost:[1-9][0-9]{0,4}$/.test(origin))throw Error('LOCAL_FIXTURE_ONLY');if(api!==origin&&!/^https:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(api))throw Error('LOCAL_FIXTURE_ONLY');return policy({...options,origin,api});}
function policy({origin,api,publishableKey}){
 if(typeof publishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(publishableKey))throw Error('BROWSER_INPUT_REQUIRED');
 let selected=[],challenge=null,activeDeadline=null;const pageActors=new Map();
 const r={attempts:0,blocked:0,email_request_attempts:0,verify_attempts:0,maximum:160,preflight_attempts:0};
 const publicPaths=new Set(['/offline','/offline.html','/session-entry.js','/email-verification.js','/email-verification.js?v=2','/sw.js','/manifest.webmanifest?v=5','/pwa-shell.css?v=3','/pwa-update.css?v=2','/pwa.js?v=80','/assets/pwa-icon-192.png','/assets/apple-touch-icon.png','/assets/mushavo-budget-logo.png','/favicon.ico']);
 const routeCounts=new Map();
 function allow(p,page){
  r.attempts++;const no=()=>{r.blocked++;return false;};
  if(r.attempts>160||!p||typeof p.url!=='string'||!p.headers||typeof p.headers!=='object'||Array.isArray(p.headers))return no();
  let u;try{u=new URL(p.url);}catch{return no();}
  if(u.username||u.password||u.hash||p.url!==u.href||p.redirected===true&&u.origin!==origin)return no();
  const h=Object.fromEntries(Object.entries(p.headers).map(([k,v])=>[k.toLowerCase(),v]));
  const route=u.pathname+u.search,resource=p.resourceType;
  if(u.origin===origin&&publicPaths.has(route)&&p.method==='GET'&&p.postData===undefined&&!h.authorization&&['Document','Script','Stylesheet','Image','Manifest','Fetch','XHR','Other'].includes(resource))return true;
  const index=pageActors.get(page),s=selected[index];if(!s||!['Fetch','XHR','Preflight','Other'].includes(resource))return no();
  if(activeDeadline!==null&&Date.now()>=activeDeadline)return no();
  const rpc=u.origin===api&&u.pathname==='/rest/v1/rpc/email_gate_current_session_verified'&&!u.search;
  const profile=u.origin===api&&u.pathname==='/rest/v1/profiles'&&[s.actor.user,selected[3].actor.user].some(id=>u.search==='?select=id&id=eq.'+id);
  const gateway=u.origin===origin&&/^\/api\/email-verification\/(?:status|restore|begin|verify)$/.test(u.pathname)&&!u.search;
  if(p.method==='OPTIONS'&&(rpc||profile)&&h.origin===origin&&!h.authorization&&!h.apikey&&!p.postData){
   const names=typeof h['access-control-request-headers']==='string'?h['access-control-request-headers'].toLowerCase().split(',').map(x=>x.trim()).sort():[];
   if(h['access-control-request-method']!==(profile?'GET':'POST')||names.length<1||names.some(x=>!['apikey','authorization','content-type'].includes(x)))return no();r.preflight_attempts++;return r.preflight_attempts<=48?true:no();
  }
  if(h.authorization!=='Bearer '+s.token)return no();
  if(profile&&p.method==='GET'&&p.postData===undefined&&h.apikey===publishableKey)return true;
  if(p.method!=='POST'||h['content-type']!=='application/json'||typeof p.postData!=='string'||p.postData.length>512)return no();
  let body;try{body=JSON.parse(p.postData);}catch{return no();}
  if(rpc&&h.apikey===publishableKey&&empty(body))return true;
  if(!gateway||h.origin!==origin||h['x-mushavo-csrf']!=='email-v1'||h.apikey)return no();
  const routeName=u.pathname.split('/').at(-1),key=index+':'+routeName,n=(routeCounts.get(key)||0)+1;routeCounts.set(key,n);
  if(['status','restore'].includes(routeName)&&empty(body))return n<=12?true:no();
  if(index===0&&routeName==='begin'&&body&&Object.keys(body).length===1&&body.remember===true){r.email_request_attempts++;return r.email_request_attempts===1?true:no();}
  if(index===0&&routeName==='verify'&&body&&Object.keys(body).sort().join(',')==='challengeId,code'&&uuid(body.challengeId)&&body.challengeId===challenge&&typeof body.code==='string'&&/^\d{6}$/.test(body.code)){r.verify_attempts++;return r.verify_attempts===1?true:no();}
  return no();
 }
 return {allow,sessions(values){if(selected.length||!Array.isArray(values)||values.length!==4||!values.every(s=>uuid(s?.actor?.user)&&typeof s.token==='string'&&s.token.length<=16384))throw Error('BROWSER_IDENTITY_REQUIRED');selected=values;},bind(page,index){if(!Number.isInteger(index)||index<0||index>3)throw Error('BROWSER_IDENTITY_REQUIRED');pageActors.set(page,index);},challenge(value){if(!uuid(value))throw Error('BROWSER_RESPONSE_REQUIRED');challenge=value;},deadline(value){if(value!==null&&(!Number.isFinite(value)||value<=Date.now()))throw Error('WINDOW_REQUIRED');activeDeadline=value;},safe:()=>({...r}),clear(){selected=[];pageActors.clear();challenge=null;}};
}
