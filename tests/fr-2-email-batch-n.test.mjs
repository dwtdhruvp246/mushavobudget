import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import {X509Certificate,createPrivateKey,createPublicKey} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {readFile} from 'node:fs/promises';
import {LocalCDP,evaluate,until} from '../scripts/lib/browser-local-cdp.mjs';
import {localTLS} from '../scripts/lib/browser-local-tls.mjs';
import {browserFixture,actors} from '../scripts/lib/browser-email-fixture.mjs';
import {browserAcceptance} from '../scripts/check-fr-2-email-batch-n.mjs';
const endpoint='ws://127.0.0.1:12345/devtools/browser/synthetic';
class Socket extends EventTarget{
 static current;
 constructor(){super();Socket.current=this;queueMicrotask(()=>this.dispatchEvent(new Event('open')));this.sent=[];}
 send(s){this.sent.push(JSON.parse(s));}
 close(){this.dispatchEvent(new Event('close'));}
 message(x){this.dispatchEvent(new MessageEvent('message',{data:typeof x==='string'?x:JSON.stringify(x)}));}
}
test('Ephemeral TLS certificate has localhost/IP SAN and matches a private key generated only in memory',()=>{
 const x=localTLS(),cert=new X509Certificate(x.cert);assert(cert.verify(cert.publicKey));assert.equal(cert.checkHost('localhost'),'localhost');assert.equal(cert.checkIP('127.0.0.1'),'127.0.0.1');assert(cert.checkPrivateKey(createPrivateKey(x.key)));assert.equal(cert.checkHost('foreign.invalid'),undefined);
});
test('CDP refuses remote, credential-bearing, malformed and out-of-range debugger URLs',async()=>{
 for(const url of ['ws://foreign.invalid:12345/devtools/browser/x','wss://127.0.0.1:12345/devtools/browser/x','ws://user:pass@127.0.0.1:12345/devtools/browser/x','ws://127.0.0.1:99999/devtools/browser/x',endpoint+'?x=1'])await assert.rejects(LocalCDP.connect(url,{Socket}));
});
test('CDP correlates out-of-order responses, ignores events and never exposes raw command errors',async()=>{
 const c=await LocalCDP.connect(endpoint,{Socket}),a=c.call('first'),b=c.call('second');Socket.current.message({method:'event'});Socket.current.message({id:2,result:{value:2}});Socket.current.message({id:1,result:{value:1}});assert.deepEqual(await a,{value:1});assert.deepEqual(await b,{value:2});
 const failed=c.call('third');Socket.current.message({id:3,error:{message:'SYNTHETIC_RAW_PROVIDER'}});await assert.rejects(failed,{message:'CDP_COMMAND_REQUIRED'});c.close();
});
test('CDP timeout, disconnect and malformed frame reject pending calls without hanging',async()=>{
 for(const kind of ['timeout','close','bad']){const c=await LocalCDP.connect(endpoint,{Socket}),pending=c.call('pending',{},undefined,20);if(kind==='close')Socket.current.close();if(kind==='bad')Socket.current.message('bad');await assert.rejects(pending);assert.equal(c.pending.size,0);c.close();}
});
test('Browser evaluation rejects runtime exceptions and polling is bounded',async()=>{
 await assert.rejects(evaluate({call:async()=>({exceptionDetails:{text:'SYNTHETIC_PRIVATE'}})},'s','ignored'),{message:'BROWSER_EVALUATION_REQUIRED'});assert.equal(await evaluate({call:async()=>({result:{value:true}})},'s','ignored'),true);await assert.rejects(until(()=>false,{timeout:10}));
});
const request=(url,{method='GET',headers={},body}={})=>new Promise((resolve,reject)=>{const req=https.request(url,{method,headers,rejectUnauthorized:false,lookup:(host,options,cb)=>cb(null,options?.all?[{address:'127.0.0.1',family:4}]:'127.0.0.1',4)},res=>{let text='';res.on('data',x=>text+=x);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.on('error',reject);req.end(body);});
async function withFixture(fn){const f=await browserFixture();try{return await fn(f);}finally{await f.close();}}
test('Loopback HTTPS serves exact shared source bytes; rejects foreign Host and unknown paths',()=>withFixture(async f=>{
 for(const file of ['email-verification.js','session-entry.js','sw.js','offline.html','manifest.webmanifest']){const r=await request(f.origin+'/'+file);assert.equal(r.status,200);assert.equal(r.text,await readFile(new URL('../'+file,import.meta.url),'utf8'));if(file==='manifest.webmanifest')assert.equal(r.headers['content-type'],'application/manifest+json');}
 assert.equal((await request(f.origin+'/fixture.html?actor=a1',{headers:{Host:'foreign.invalid'}})).status,403);assert.equal((await request(f.origin+'/not-reviewed')).status,404);
}));
test('Actual gateway over synthetic HTTPS binds remember cookie, code MAC and sessions without external Auth/SQL/mail',()=>withFixture(async f=>{
 const send=async(route,body={},actor='a1',cookie)=>request(f.origin+'/api/email-verification/'+route,{method:'POST',headers:{Origin:f.origin,'Content-Type':'application/json','X-Mushavo-CSRF':'email-v1',Authorization:'Bearer SYNTHETIC_'+actor,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
 assert.equal(JSON.parse((await send('restore')).text).result,'CODE_REQUIRED');assert.equal(f.state.mail,0);
 const begun=JSON.parse((await send('begin',{remember:true})).text);assert.equal(begun.result,'CODE_REQUESTED');const verified=await send('verify',{challengeId:begun.challengeId,code:f.state.code});assert.equal(JSON.parse(verified.text).result,'VERIFIED');const cookie=verified.headers['set-cookie'][0].split(';')[0];assert.match(verified.headers['set-cookie'][0],/Secure; HttpOnly; SameSite=Strict; Max-Age=/);
 assert.equal(JSON.parse((await send('restore',{},'a2',cookie)).text).result,'APPROVED');assert.equal((await send('restore',{},'a2',cookie)).headers['set-cookie'],undefined);assert.equal(JSON.parse((await send('restore',{},'b1',cookie.replace(actors.a1.user.replaceAll('-',''),actors.b1.user.replaceAll('-','')))).text).result,'CODE_REQUIRED');
 assert.equal((await send('verify',{challengeId:begun.challengeId,code:f.state.code})).status,400);assert.equal(f.state.mail,1);
}));
test('Fixture rejects origin/CSRF mismatch before synthetic code delivery and exposes no key through public pages',()=>withFixture(async f=>{
 const r=await request(f.origin+'/api/email-verification/begin',{method:'POST',headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},body:'{"remember":true}'});assert.equal(r.status,403);assert.equal(f.state.mail,0);const html=(await request(f.origin+'/fixture.html')).text;assert(!html.includes('BEGIN PRIVATE KEY'));assert(!html.includes('new Uint8Array(32)'));
}));
test('Missing browser is a safe local failure with no hosted operation or private inputs',async()=>{
 const r=await browserAcceptance('relative');assert.equal(r.exit_code,1);assert.equal(r.actual_browser_engine_executed,false);assert.equal(r.actual_hosted_requests_by_harness,0);assert.equal(r.real_email_requests,0);assert.equal(r.private_packets_accessed,false);
});
test('Browser harness contains 21 explicit engine checks, own-child cleanup and no persistent user-profile/session import',async()=>{
 const s=await readFile(new URL('../scripts/check-fr-2-email-batch-n.mjs',import.meta.url),'utf8');assert.equal([...s.matchAll(/check\('[A-Z_]+',/g)].length,21);for(const x of ['--user-data-dir=','Browser.close','temporary_profile_removed','loopback_fixture_closed'])assert(s.includes(x));assert(!s.includes('storageState'));assert(!s.includes('api.supabase.com'));
});
test('Route diagnostics redact raw host/path/query/header values and emit a bounded fixed schema',async()=>{
 const {summarizeUnreviewedRoute}=await import('../scripts/lib/browser-route-audit.mjs');
 const x=summarizeUnreviewedRoute(new URL('https://private-host.invalid/SYNTHETIC_PRIVATE_PATH?token=SYNTHETIC_PRIVATE_QUERY'),'TRACE','SYNTHETIC_PRIVATE_DESTINATION');
 assert.deepEqual(Object.keys(x).sort(),['destination','method','pathname_sha256','probe_tag','query_present']);assert.equal(x.probe_tag,'UNCLASSIFIED');assert.match(x.pathname_sha256,/^[a-f0-9]{64}$/);assert.equal(x.query_present,true);assert.equal(x.method,'OTHER');assert.equal(x.destination,'OTHER');assert(!JSON.stringify(x).includes('SYNTHETIC_PRIVATE'));assert(!JSON.stringify(x).includes('private-host'));
});
test('Recognized diagnostic probe names still receive 404 and remain acceptance failures',()=>withFixture(async f=>{
 const r=await request(f.origin+'/.well-known/appspecific/com.chrome.devtools.json');assert.equal(r.status,404);assert.equal(f.state.unexpected,1);const {safeRouteAudit}=await import('../scripts/lib/browser-route-audit.mjs');const x=safeRouteAudit(f.state);assert.equal(x.entries[0].probe_tag,'DEVTOOLS_WORKSPACE_PROBE');assert.equal(x.entries[0].count,1);
}));
test('Repeated unreviewed requests aggregate while retaining method/destination/query differences',async()=>{
 const {collectUnreviewedRoute,safeRouteAudit}=await import('../scripts/lib/browser-route-audit.mjs');const s={unexpected:0,unreviewedRoutes:new Map(),unreviewedRouteOverflow:0},u=new URL('https://localhost/path');for(let i=0;i<3;i++)collectUnreviewedRoute(s,u,'GET','image');collectUnreviewedRoute(s,new URL(u+'?secret=ignored'),'GET','image');const a=safeRouteAudit(s);assert.equal(a.unexpected_request_count,4);assert.equal(a.entries.length,2);assert.equal(a.entries[0].count,3);assert.equal(a.entries[1].query_present,true);
});
test('Route audit caps distinct entries and counts overflow without retaining extra raw material',async()=>{
 const {collectUnreviewedRoute,safeRouteAudit}=await import('../scripts/lib/browser-route-audit.mjs');const s={unexpected:0,unreviewedRoutes:new Map(),unreviewedRouteOverflow:0};for(let i=0;i<40;i++)collectUnreviewedRoute(s,new URL('https://localhost/private'+i),'GET','');const a=safeRouteAudit(s);assert.equal(a.entries.length,16);assert.equal(a.unexpected_request_count,40);assert.equal(a.overflow_request_count,24);assert(!JSON.stringify(a).includes('private'));
});
test('Harness takes the immutable safe route snapshot after browser and listener cleanup before the final route check',async()=>{
 const s=await readFile(new URL('../scripts/check-fr-2-email-batch-n.mjs',import.meta.url),'utf8');assert(s.indexOf('await fixture.close()')<s.indexOf('r.route_audit=safeRouteAudit'));assert(s.indexOf('r.route_audit=safeRouteAudit')<s.indexOf("check('LOCAL_FIXTURE_NO_UNREVIEWED_ROUTE'"));
});
