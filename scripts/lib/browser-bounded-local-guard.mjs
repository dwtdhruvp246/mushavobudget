// Local-only preparation guard. No hosted target or real credential is accepted.
// A future hosted integration needs a separately reviewed fixed staging policy.
export function boundedLocalGuard(origin,{maximum=96}={}){
 const u=new URL(origin);
 if(u.origin!==origin||u.protocol!=='https:'||u.hostname!=='localhost'||!u.port||!Number.isInteger(maximum)||maximum<1||maximum>96)throw Error('LOCAL_GUARD_INPUT_REQUIRED');
 const counts={attempts:0,blocked:0,begin:0,verify:0};
 const assets=new Set(['/session-entry.js','/email-verification.js?v=2','/favicon.ico']);
 const known=new Set(['a1','a2','a3','b1']);
 function allow({url,method,headers={},postData,resourceType}){
  counts.attempts++;
  const no=()=>{counts.blocked++;return false;};
  if(counts.attempts>maximum||typeof url!=='string'||url.length>2048)return no();
  let target;try{target=new URL(url);}catch{return no();}
  if(target.origin!==origin||target.username||target.password||target.hash||url!==target.href)return no();
  const route=target.pathname+target.search;
  if(!headers||typeof headers!=='object'||Array.isArray(headers))return no();
  const h=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]));
  if(method==='GET'&&postData===undefined&&!h.authorization){
   if(assets.has(route)&&['Script','Other'].includes(resourceType))return true;
   if(/^\/fixture\.html\?actor=(?:a1|a2|a3|b1)$/.test(route)&&resourceType==='Document')return true;
  }
  if(method!=='POST'||!['Fetch','XHR'].includes(resourceType)||target.search||typeof postData!=='string'||postData.length>512)return no();
  const actor=typeof h.authorization==='string'?h.authorization.replace(/^Bearer SYNTHETIC_/,''):'';
  if(!known.has(actor)||h.authorization!=='Bearer SYNTHETIC_'+actor||h['content-type']!=='application/json')return no();
  let body;try{body=JSON.parse(postData);}catch{return no();}
  if(!body||typeof body!=='object'||Array.isArray(body))return no();
  const empty=Object.keys(body).length===0;
  if(target.pathname==='/rpc/email_gate_current_session_verified'&&empty)return true;
  if(target.pathname==='/profile'&&Object.keys(body).length===1&&['own','foreign'].includes(body.scope))return true;
  if(h['x-mushavo-csrf']!=='email-v1'||h.origin!==origin)return no();
  const routeName=target.pathname.replace('/api/email-verification/','');
  if(target.pathname!=='/api/email-verification/'+routeName)return no();
  if(['status','restore'].includes(routeName)&&empty)return true;
  if(routeName==='begin'&&actor==='a1'&&Object.keys(body).length===1&&body.remember===true){counts.begin++;return counts.begin===1?true:no();}
  if(routeName==='verify'&&actor==='a1'&&Object.keys(body).sort().join(',')==='challengeId,code'&&typeof body.challengeId==='string'&&typeof body.code==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(body.challengeId)&&/^\d{6}$/.test(body.code)){counts.verify++;return counts.verify===1?true:no();}
  return no();
 }
 return {allow,safe:()=>({...counts,maximum})};
}
