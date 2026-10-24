import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{gatewayFromEnvironment,createBackendAdapter,STAGING_ORIGIN,STAGING_PROJECT} from '../supabase/functions/_shared/email-verification-gateway.mjs';
import {createZohoCodeMailer} from '../supabase/functions/_shared/email-verification-zoho.mjs';
import {codeMac,deviceDigest} from '../supabase/functions/_shared/email-verification-crypto.mjs';
const U='00000000-0000-4000-8000-000000000501',S='00000000-0000-4000-8000-000000000601';
const V='00000000-0000-4000-8000-000000000502',C='00000000-0000-4000-8000-000000000701';
const origin='https://' + STAGING_PROJECT + '.supabase.co';
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'content-type':'application/json'}});
const cookieName=user=>'__Host-mushavo_device_' + user.replaceAll('-','');
const baseClaims=()=>({sub:U,session_id:S,role:'authenticated',aud:'authenticated',iss:origin+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600});
const jwt=c=>Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c3ludGhldGlj';
function fixture(options={}) {
 const calls=[]; const state={...options};
 const env={EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:STAGING_PROJECT,EMAIL_GATE_ORIGIN:STAGING_ORIGIN,
  EMAIL_GATE_PEPPERS_JSON:JSON.stringify({v1:'2a'.repeat(32),old:'2b'.repeat(32)}),EMAIL_GATE_KEY_VERSION:'v1',
  SUPABASE_PUBLISHABLE_KEY:'sb_publishable_SYNTHETIC_ONLY',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_SYNTHETIC_ONLY',
  ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',
  ZOHO_ACCOUNT_ID:'12345678',ZOHO_FROM_ADDRESS:'notification@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',
  ZOHO_CLIENT_SECRET:'SYNTHETIC_CLIENT_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH_TOKEN',
  ZOHO_TEST_RECIPIENTS_JSON:'["primary@example.invalid"]',
  EMAIL_GATE_RATE_LIMITER:{async limit(args){calls.push({kind:'limit',args});return{success:state.limit!==false};}}};
 const fetcher=async(url,init)=>{
  calls.push({kind:'fetch',url,init}); assert.equal(init.redirect,'manual'); assert(init.signal instanceof AbortSignal);
  if(state.throwUpstream)throw Error('SYNTHETIC_SECRET_NEVER_RETURN_THIS');
  if(url.endsWith('/auth/v1/user')) {
   if(state.authResponse)return state.authResponse();
   return json({id:state.userId||U,email:state.email||'primary@example.invalid',email_confirmed_at:state.unconfirmed?null:new Date().toISOString(),is_anonymous:state.anonymous||false},state.authStatus||200);
  }
  if(url.includes('/rest/v1/rpc/')) {
   const name=url.split('email_gate_')[1],args=JSON.parse(init.body);calls.push({kind:'rpc',name,args});
   assert.equal(args.p_user,state.userId||U);assert.equal(args.p_session,state.session||S);
   assert.equal(init.headers.apikey,env.SUPABASE_SERVICE_ROLE_KEY);
   assert.equal(init.headers.authorization,undefined);
   if(state.rpcResponse)return state.rpcResponse(name,args);
   if(name==='session_status')return json(state.verified||false);
   if(name==='begin_challenge'){state.challenge=args;return json({result:state.beginResult||'PENDING_DELIVERY',challenge_id:args.p_challenge,expires_at:new Date(Date.now()+600000).toISOString()});}
   if(name==='set_delivery')return json({result:state.deliveryResult||(args.p_delivered?'READY':'DELIVERY_FAILED')});
   if(name==='challenge_context')return json(state.noContext?null:{key_version:state.keyVersion||'v1',remember_device:state.remember!==false,expires_at:new Date(Date.now()+600000).toISOString()});
   if(name==='verify_challenge')return json({result:state.verifyResult||'VERIFIED',device_expires_at:new Date(Date.now()+604800000).toISOString()});
   if(name==='restore_device')return json({result:state.restoreResult||'APPROVED',device_expires_at:new Date(Date.now()+5000).toISOString()});
   if(name==='revoke_device')return json({result:state.revokeResult||'REVOKED'});
   if(name==='revoke_all')return json({result:state.revokeAllResult||'REVOKED'});
   throw Error('unexpected RPC');
  }
  if(url==='https://accounts.zoho.com/oauth/v2/token')return state.tokenResponse?state.tokenResponse():json({access_token:'SYNTHETIC_ZOHO_ACCESS_TOKEN',expires_in:3600});
  if(url==='https://mail.zoho.com/api/accounts/12345678/messages') {
   state.mail=JSON.parse(init.body);return state.mailResponse?state.mailResponse():json({status:{code:state.mailCode||200}});
  }
  throw Error('UNEXPECTED_HOST');
 };
 const gateway=()=>gatewayFromEnvironment(env,fetcher);
 const request=(route='begin',body={remember:true},headers={},claims=baseClaims())=>new Request(STAGING_ORIGIN+'/api/email-verification/'+route,{
  method:'POST',headers:{'content-type':'application/json',origin:STAGING_ORIGIN,'x-mushavo-csrf':'email-v1',
   'sec-fetch-site':'same-origin','cf-connecting-ip':'192.0.2.1',authorization:'Bearer '+jwt(claims),...headers},body:JSON.stringify(body)});
 return{state,calls,env,fetcher,gateway,request};
}
const rpc=(f,name)=>f.calls.filter(c=>c.kind==='rpc'&&c.name===name);
const fetches=f=>f.calls.filter(c=>c.kind==='fetch');

test('Actual Auth adapter validates the exact bearer with staging Auth before service RPC and derives recipient/session',async()=>{
 const f=fixture();const req=f.request();const r=await f.gateway()(req);assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.result,'CODE_REQUESTED');assert.equal(f.state.mail.toAddress,'primary@example.invalid');
 const auth=fetches(f)[0];assert.equal(auth.url,origin+'/auth/v1/user');assert.equal(auth.init.headers.authorization,req.headers.get('authorization'));
 assert.equal(auth.init.headers.apikey,f.env.SUPABASE_PUBLISHABLE_KEY);assert.equal(rpc(f,'begin_challenge').length,1);
 assert.equal(data.challengeId,f.state.challenge.p_challenge);assert(!('code' in data));assert(!('email' in data));
});
test('Plaintext code is only in provider payload; SQL receives its actor/session/challenge-bound HMAC',async()=>{
 const f=fixture();await f.gateway()(f.request());const code=f.state.mail.content.match(/is (\d{6})\./)[1];
 assert.equal(f.state.challenge.p_code_mac,await codeMac({userId:U,sessionId:S,challengeId:f.state.challenge.p_challenge,keyVersion:'v1',code,pepper:new Uint8Array(32).fill(42)}));
 assert(!Object.hasOwn(f.state.challenge,'code'));assert.equal(f.state.mail.mailFormat,'plaintext');assert(!Object.hasOwn(f.state.mail,'ccAddress'));
 assert.equal(rpc(f,'set_delivery')[0].args.p_delivered,true);
});
test('Zoho OAuth secret material is in the server POST body and never in the URL or gateway JSON',async()=>{
 const f=fixture();const r=await f.gateway()(f.request());const response=await r.text();
 const token=fetches(f).find(x=>x.url.includes('/oauth/v2/token'));assert(!token.url.includes('?'));
 const form=new URLSearchParams(token.init.body);assert.equal(form.get('refresh_token'),f.env.ZOHO_REFRESH_TOKEN);
 assert.equal(form.get('grant_type'),'refresh_token');assert(!response.includes('SYNTHETIC'));assert(!response.includes('00000000'));
 const mail=fetches(f).find(x=>x.url.includes('/messages'));assert.equal(mail.init.headers.authorization,'Zoho-oauthtoken SYNTHETIC_ZOHO_ACCESS_TOKEN');
});
for(const [name,change]of [
 ['expired',c=>{c.exp=1;}],['wrong issuer',c=>{c.iss='https://foreign.invalid/auth/v1';}],
 ['privileged role',c=>{c.role='service_role';}],['missing session',c=>{delete c.session_id;}],
 ['wrong audience',c=>{c.aud='service_role';}]
])test('Malformed '+name+' bearer claims never reach Auth, RPC or mail',async()=>{
 const f=fixture(),c=baseClaims();change(c);const r=await f.gateway()(f.request('begin',{remember:true},{},c));assert.equal(r.status,401);assert.equal(fetches(f).length,0);
});
test('A decodable forged token denied by Auth cannot obtain a challenge or proof',async()=>{
 const f=fixture({authStatus:401});assert.equal((await f.gateway()(f.request())).status,401);assert.equal(rpc(f,'begin_challenge').length,0);assert(!f.state.mail);
});
test('Auth user/sub mismatch cannot substitute another account',async()=>{
 const f=fixture({userId:V});assert.equal((await f.gateway()(f.request())).status,401);assert.equal(f.calls.filter(x=>x.kind==='rpc').length,0);
});
for(const [name,opts]of [['unconfirmed',{unconfirmed:true}],['anonymous',{anonymous:true}],['recipient injection',{email:'attacker@example.invalid,other@example.invalid'}]])
test('Auth '+name+' state is denied before any service writes',async()=>{
 const f=fixture(opts);assert.equal((await f.gateway()(f.request())).status,401);assert.equal(f.calls.filter(x=>x.kind==='rpc').length,0);
});
test('Ordinary and Admin-labelled tokens use the same session proof path without role promotion',async()=>{
 const f=fixture();const claims={...baseClaims(),app_metadata:{role:'super_admin'},user_metadata:{admin:true}};
 assert.equal((await f.gateway()(f.request('begin',{remember:true},{},claims))).status,200);
 assert(f.calls.filter(x=>x.kind==='rpc').every(x=>x.name.startsWith('session_')||['begin_challenge','set_delivery'].includes(x.name)));
});
for(const [name,headers]of [['foreign origin',{origin:'https://foreign.invalid'}],['missing CSRF',{'x-mushavo-csrf':''}],['cross-site fetch',{'sec-fetch-site':'cross-site'}]])
test(name+' is rejected before limiter/Auth/DB/mail',async()=>{
 const f=fixture();assert.equal((await f.gateway()(f.request('begin',{remember:true},headers))).status,403);assert.equal(f.calls.length,0);
});
test('GET, query-bearing and unknown API routes are denied without upstream access',async()=>{
 const f=fixture();for(const req of [new Request(STAGING_ORIGIN+'/api/email-verification/status'),new Request(f.request().url+'?code=123456',{method:'POST'}),f.request('unknown',{})])assert([404,405].includes((await f.gateway()(req)).status));assert.equal(f.calls.length,0);
});
test('Client actor/email/device/expiry fields are rejected rather than trusted',async()=>{
 const f=fixture();for(const body of [{remember:true,email:'other@example.invalid'},{remember:true,userId:V},{remember:true,expiresAt:'2099'},{remember:true,device:'A'.repeat(43)}])assert.equal((await f.gateway()(f.request('begin',body))).status,400);assert.equal(fetches(f).length,0);
});
test('Oversized chunked request bodies are rejected before Auth',async()=>{
 const f=fixture();const req=f.request('begin',{remember:true,extra:'x'.repeat(5000)});assert.equal((await f.gateway()(req)).status,400);assert.equal(fetches(f).length,0);
});
test('Numeric code values are rejected before they can be coerced into verification strings',async()=>{
 const f=fixture();assert.equal((await f.gateway()(f.request('verify',{challengeId:C,code:123456}))).status,400);assert.equal(fetches(f).length,0);
});
test('Mandatory shared IP limiter denies excess requests and missing binding fails closed',async()=>{
 const f=fixture({limit:false});assert.equal((await f.gateway()(f.request())).status,429);assert.equal(fetches(f).length,0);
 delete f.env.EMAIL_GATE_RATE_LIMITER;assert.throws(()=>f.gateway());
});
test('Only controlled staging mode/project/origin and explicit server secrets are accepted',()=>{
 for(const [key,value]of [['EMAIL_GATE_MODE','production'],['EMAIL_GATE_PROJECT','foreign'],['EMAIL_GATE_ORIGIN','https://foreign.invalid'],['SUPABASE_SERVICE_ROLE_KEY',''],['EMAIL_GATE_PEPPERS_JSON','{}']]){
  const f=fixture();f.env[key]=value;assert.throws(()=>f.gateway());
 }
});
test('Mail endpoint redirects are never followed and cannot mark a challenge delivered',async()=>{
 const f=fixture({mailResponse:()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})});
 assert.equal((await f.gateway()(f.request())).status,503);assert.equal(rpc(f,'set_delivery')[0].args.p_delivered,false);
 assert(!fetches(f).some(x=>x.url.includes('foreign.invalid')));
});
test('A provider HTTP200 error payload never grants delivery-ready status',async()=>{
 const f=fixture({mailCode:500});assert.equal((await f.gateway()(f.request())).status,503);assert.equal(rpc(f,'set_delivery')[0].args.p_delivered,false);
});
test('Zoho OAuth failure is sanitized and no mail request is made',async()=>{
 const f=fixture({tokenResponse:()=>json({error:'SYNTHETIC_REFRESH_TOKEN'})});const r=await f.gateway()(f.request());assert.equal(r.status,503);assert(!String(await r.text()).includes('SYNTHETIC'));assert(!f.state.mail);
});
test('Recipient allowlist blocks arbitrary real-user mail while recording failed delivery',async()=>{
 const f=fixture({email:'unprepared@example.invalid'});assert.equal((await f.gateway()(f.request())).status,503);assert(!f.state.mail);assert.equal(rpc(f,'set_delivery')[0].args.p_delivered,false);
});
test('Unsupported Zoho data-centre origin or multiple sender addresses fail before network',()=>{
 const f=fixture();for(const patch of [{ZOHO_MAIL_ORIGIN:'https://mail.zoho.eu'},{ZOHO_FROM_ADDRESS:'one@example.invalid,two@example.invalid'},{ZOHO_ACCOUNTS_ORIGIN:'https://foreign.invalid'}]){
  assert.throws(()=>gatewayFromEnvironment({...f.env,...patch},f.fetcher));
 }
 assert.equal(fetches(f).length,0);
});
for(const result of ['COOLDOWN','RATE_LIMIT'])test('Database '+result+' prevents any provider call or delivery mutation',async()=>{
 const f=fixture({beginResult:result});assert.equal((await f.gateway()(f.request())).status,429);assert.equal(rpc(f,'set_delivery').length,0);assert(!f.state.mail);
});
test('Late delivery acknowledgement failure cannot claim the superseded code is ready',async()=>{
 const f=fixture({deliveryResult:'UNAVAILABLE'});const r=await f.gateway()(f.request());assert.equal(r.status,503);assert.equal((await r.json()).result,'MAIL_UNAVAILABLE');
});
test('Verification generates an opaque HttpOnly host cookie with a capped fixed expiry and no JSON credential',async()=>{
 const f=fixture();const r=await f.gateway()(f.request('verify',{challengeId:C,code:'123456'}));assert.equal(r.status,200);
 const cookie=r.headers.get('set-cookie');assert(cookie.startsWith(cookieName(U)+'='));assert(cookie.includes('; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age='));assert(!cookie.includes('Domain='));
 const max=Number(cookie.match(/Max-Age=(\d+)/)[1]);assert(max>604790&&max<=604800);
 const raw=cookie.split(';')[0].split('=')[1];assert.equal(raw.length,43);assert.equal(rpc(f,'verify_challenge')[0].args.p_device_digest,await deviceDigest(raw));
 assert.deepEqual(await r.json(),{result:'VERIFIED'});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(r.headers.get('access-control-allow-origin'),null);
});
test('Remember-off verification passes a null digest and clears only its account cookie',async()=>{
 const f=fixture({remember:false});const r=await f.gateway()(f.request('verify',{challengeId:C,code:'123456'}));assert.equal(r.status,200);assert.equal(rpc(f,'verify_challenge')[0].args.p_device_digest,null);assert(r.headers.get('set-cookie').includes('Max-Age=0'));
});
test('Existing challenge key version is used after server pepper rotation',async()=>{
 const f=fixture({keyVersion:'old',remember:false});await f.gateway()(f.request('verify',{challengeId:C,code:'123456'}));
 assert.equal(rpc(f,'verify_challenge')[0].args.p_code_mac,await codeMac({userId:U,sessionId:S,challengeId:C,keyVersion:'old',code:'123456',pepper:new Uint8Array(32).fill(43)}));
});
test('Unknown or missing challenge context cannot mint proof or device cookies',async()=>{
 for(const opts of [{noContext:true},{keyVersion:'missing'}]){const f=fixture(opts);const r=await f.gateway()(f.request('verify',{challengeId:C,code:'123456'}));assert.equal(r.status,400);assert.equal(rpc(f,'verify_challenge').length,0);assert.equal(r.headers.get('set-cookie'),null);}
});
for(const result of ['UNAVAILABLE','LOCKED','CODE_REJECTED','INVALID'])test('Database '+result+' verification result never emits a remembered credential',async()=>{
 const f=fixture({verifyResult:result});const r=await f.gateway()(f.request('verify',{challengeId:C,code:'123456'}));assert.equal(r.status,400);assert.equal(r.headers.get('set-cookie'),null);
});
test('Remembered-device restore reads only the matching account cookie and never renews expiry',async()=>{
 const f=fixture();const token='A'.repeat(43);const r=await f.gateway()(f.request('restore',{}, {cookie:cookieName(V)+'='+'B'.repeat(43)+'; '+cookieName(U)+'='+token}));
 assert.equal((await r.json()).result,'APPROVED');assert.equal(r.headers.get('set-cookie'),null);assert.equal(rpc(f,'restore_device')[0].args.p_device_digest,await deviceDigest(token));
});
test('Missing or other-account-only device cookie requires a code without restore RPC',async()=>{
 const f=fixture();const r=await f.gateway()(f.request('restore',{}, {cookie:cookieName(V)+'='+'B'.repeat(43)}));assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(rpc(f,'restore_device').length,0);
});
test('Expired/revoked restore clears the stale cookie and grants no success',async()=>{
 const f=fixture({restoreResult:'CODE_REQUIRED'});const r=await f.gateway()(f.request('restore',{}, {cookie:cookieName(U)+'='+'A'.repeat(43)}));assert.equal((await r.json()).result,'CODE_REQUIRED');assert(r.headers.get('set-cookie').includes('Max-Age=0'));
});
test('Duplicate and malformed account cookies cannot choose an attacker credential',async()=>{
 const f=fixture();for(const value of [cookieName(U)+'=bad',cookieName(U)+'='+'A'.repeat(43)+'; '+cookieName(U)+'='+'B'.repeat(43)])assert.equal((await f.gateway()(f.request('restore',{}, {cookie:value}))).status,400);assert.equal(rpc(f,'restore_device').length,0);
});
test('Already-verified open session bypasses restore and code-send without extending device trust',async()=>{
 const f=fixture({verified:true});for(const [route,body]of [['restore',{}],['begin',{remember:true}]]){const r=await f.gateway()(f.request(route,body));assert.equal((await r.json()).result,'VERIFIED');assert.equal(r.headers.get('set-cookie'),null);}assert.equal(rpc(f,'restore_device').length,0);assert.equal(rpc(f,'begin_challenge').length,0);
});
test('Forget-device requires proof and revokes the cookie digest before clearing it',async()=>{
 const f=fixture({verified:true}),token='A'.repeat(43);const r=await f.gateway()(f.request('forget',{}, {cookie:cookieName(U)+'='+token}));assert.equal((await r.json()).result,'FORGOTTEN');assert.equal(rpc(f,'revoke_device')[0].args.p_device_digest,await deviceDigest(token));assert(r.headers.get('set-cookie').includes('Max-Age=0'));
 const denied=fixture();assert.equal((await denied.gateway()(denied.request('forget',{}))).status,403);assert.equal(rpc(denied,'revoke_device').length,0);
});
test('Revoke-all calls only the verified actor/session RPC and clears its own cookie',async()=>{
 const f=fixture();const r=await f.gateway()(f.request('revoke-all',{}));assert.equal((await r.json()).result,'REVOKED');assert.equal(rpc(f,'revoke_all').length,1);assert(r.headers.get('set-cookie').startsWith(cookieName(U)+'='));
});
test('Upstream oversized/HTML/redirected Auth responses cannot reach privileged RPCs',async()=>{
 const cases=[()=>new Response('x'.repeat(70000),{headers:{'content-type':'application/json'}}),()=>new Response('<html>',{headers:{'content-type':'text/html'}}),()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})];
 for(const authResponse of cases){const f=fixture({authResponse});assert.equal((await f.gateway()(f.request())).status,503);assert.equal(f.calls.filter(x=>x.kind==='rpc').length,0);}
});
test('Unexpected exceptions and upstream bodies never appear in JSON error responses',async()=>{
 const f=fixture({throwUpstream:true});const r=await f.gateway()(f.request());assert.equal(r.status,503);assert.deepEqual(await r.json(),{result:'UNAVAILABLE'});
});
test('Actual default Worker static fallback strips cookies/bearer and preserves asset response headers',async()=>{
 const f=fixture();const req=new Request(STAGING_ORIGIN+'/app.js',{headers:{authorization:'Bearer SYNTHETIC',cookie:'SYNTHETIC'}});
 const r=await worker.fetch(req,{ASSETS:{async fetch(clean){assert.equal(clean.headers.get('cookie'),null);assert.equal(clean.headers.get('authorization'),null);return new Response('asset',{headers:{'content-type':'text/javascript','x-asset-test':'retained'}});}}});
 assert.equal(await r.text(),'asset');assert.equal(r.headers.get('x-asset-test'),'retained');assert.equal(fetches(f).length,0);
});
test('Actual default Worker refuses API setup without secrets and denies static POST',async()=>{
 const f=fixture();assert.equal((await worker.fetch(f.request(),{})).status,503);assert.equal((await worker.fetch(new Request(STAGING_ORIGIN+'/app',{method:'POST'}),{})).status,405);
});
