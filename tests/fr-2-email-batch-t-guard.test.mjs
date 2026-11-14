import test from 'node:test';
import assert from 'node:assert/strict';
import {stagingGuard,loopbackStagingGuard,stagingOrigin as origin,stagingAPI as api} from '../scripts/lib/browser-staging-guard.mjs';
import {input,actors,tokens} from './fixtures/fr-2-email-batch-t-transport.mjs';
import {harnessExpression} from '../scripts/lib/browser-staging-harness.mjs';
const key=input.publishableKey;
const create=()=>{const g=stagingGuard({publishableKey:key,origin:'https://foreign.invalid',api:'https://foreign.invalid'});g.sessions(actors.map((actor,i)=>({actor,token:tokens[i]})));for(let i=0;i<4;i++)g.bind('page'+i,i);return g;};
const request=(i=0,route='status',body={})=>({url:origin+'/api/email-verification/'+route,method:'POST',resourceType:'Fetch',headers:{Authorization:'Bearer '+tokens[i],'Content-Type':'application/json',Origin:origin,'X-Mushavo-CSRF':'email-v1'},postData:JSON.stringify(body)});
for(const [name,patch] of [
 ['foreign origin',{url:'https://foreign.invalid/api/email-verification/status'}],
 ['production API',{url:'https://kttkospkblwvguuwnhjj.supabase.co/rest/v1/rpc/email_gate_current_session_verified'}],
 ['another staging deployment',{url:'https://d24b6611.mushavo-budget-staging.pages.dev/api/email-verification/status'}],
 ['embedded userinfo',{url:origin.replace('https://','https://private@')+'/api/email-verification/status'}],
 ['query data',{url:origin+'/api/email-verification/status?private=sentinel'}],
 ['fragment data',{url:origin+'/api/email-verification/status#sentinel'}],
 ['unexpected method',{method:'GET'}],
 ['navigation to gateway',{resourceType:'Document'}],
 ['extra body field',{postData:'{"extra":true}'}],
 ['malformed JSON',{postData:'{'}],
 ['array JSON',{postData:'[]'}],
 ['null body',{postData:'null'}],
 ['oversize body',{postData:' '.repeat(513)}],
 ['no headers',{headers:null}],
 ['wrong bearer',{headers:{...request().headers,Authorization:'Bearer PRIVATE_SENTINEL'}}],
 ['wrong origin header',{headers:{...request().headers,Origin:'https://foreign.invalid'}}],
 ['wrong CSRF',{headers:{...request().headers,'X-Mushavo-CSRF':'wrong'}}],
 ['wrong MIME',{headers:{...request().headers,'Content-Type':'text/plain'}}],
 ['revoke all route',{url:origin+'/api/email-verification/revoke-all'}],
 ['forget route',{url:origin+'/api/email-verification/forget'}],
 ['canonical URL bypass',{url:origin+'/a/../api/email-verification/status'}]
])test('Fixed staging policy rejects '+name,()=>{const g=create();assert.equal(g.allow({...request(),...patch},'page0'),false);assert.equal(g.safe().blocked,1);assert(!JSON.stringify(g.safe()).includes('PRIVATE_SENTINEL'));});
test('Public requests allowed before identities only on exact fixed staging source paths',()=>{const g=stagingGuard({publishableKey:key});for(const route of ['/offline','/offline.html','/session-entry.js','/email-verification.js?v=2','/sw.js'])assert(g.allow({url:origin+route,method:'GET',headers:{},resourceType:'Fetch'},'new'));assert.equal(g.allow(request(),'new'),false);assert.equal(g.allow({url:api+'/auth/v1/user',method:'GET',headers:{},resourceType:'Fetch'},'new'),false);});
test('Sessions and tokens are bound to the current page; a changed page binding invalidates old request tokens',()=>{const g=create();assert(g.allow(request(0),'page0'));assert.equal(g.allow(request(1),'page0'),false);g.bind('page0',3);assert.equal(g.allow(request(0),'page0'),false);assert(g.allow(request(3),'page0'));});
test('One remembered email and one six-digit submission only for first bound session and observed challenge',()=>{const challenge='00000000-0000-4000-8000-000000000001',g=create();g.challenge(challenge);assert(g.allow(request(0,'begin',{remember:true}),'page0'));assert.equal(g.allow(request(0,'begin',{remember:true}),'page0'),false);assert.equal(create().allow(request(1,'begin',{remember:true}),'page1'),false);assert.equal(create().allow(request(0,'begin',{remember:false}),'page0'),false);assert(g.allow(request(0,'verify',{challengeId:challenge,code:'123456'}),'page0'));assert.equal(g.allow(request(0,'verify',{challengeId:challenge,code:'123456'}),'page0'),false);for(const body of [{challengeId:challenge,code:123456},{challengeId:challenge,code:'123'},{challengeId:'00000000-0000-4000-8000-000000000002',code:'123456'}])assert.equal(create().allow(request(0,'verify',body),'page0'),false);assert(!JSON.stringify(g.safe()).includes('123456'));});
test('CORS preflights carry no bearer and allow only selected RPC/profile methods and headers',()=>{const g=create(),base={url:api+'/rest/v1/rpc/email_gate_current_session_verified',method:'OPTIONS',resourceType:'Preflight',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'apikey,authorization,content-type'}};assert(g.allow(base,'page0'));for(const next of [{...base,headers:{...base.headers,Authorization:'Bearer '+tokens[0]}},{...base,headers:{...base.headers,'Access-Control-Request-Method':'DELETE'}},{...base,headers:{...base.headers,'Access-Control-Request-Headers':'apikey,private-secret'}},{...base,url:api+'/rest/v1/rpc/arbitrary'}])assert.equal(g.allow(next,'page0'),false);});
test('Own and selected foreign profile identifier reads are exact; no broad profile, application write or arbitrary RPC',()=>{const g=create(),headers={Authorization:'Bearer '+tokens[0],apikey:key};for(const id of [actors[0].user,actors[3].user])assert(g.allow({url:api+'/rest/v1/profiles?select=id&id=eq.'+id,method:'GET',headers,resourceType:'Fetch'},'page0'));for(const q of ['?select=*','?select=id','?select=id&id=eq.00000000-0000-4000-8000-000000000009','?id=eq.'+actors[0].user+'&select=id'])assert.equal(g.allow({url:api+'/rest/v1/profiles'+q,method:'GET',headers,resourceType:'Fetch'},'page0'),false);assert.equal(g.allow({...request(),url:api+'/rest/v1/rpc/admin_mfa_status'},'page0'),false);});
test('Total, restore and preflight budgets are finite and returned diagnostics cannot reset them',()=>{const g=create();for(let i=0;i<12;i++)assert(g.allow(request(0,'restore'),'page0'));assert.equal(g.allow(request(0,'restore'),'page0'),false);const h=create();for(let i=0;i<160;i++)assert(h.allow({url:origin+'/sw.js',method:'GET',headers:{},resourceType:'Fetch'},'page0'));assert.equal(h.allow({url:origin+'/sw.js',method:'GET',headers:{},resourceType:'Fetch'},'page0'),false);const copy=h.safe();copy.attempts=0;assert.equal(h.safe().attempts,161);});
test('Conservative active deadline stops sensitive requests and can be cleared only for quarantine checks',()=>{const g=create();assert.throws(()=>g.deadline(Date.now()-1));const now=Date.now(),real=Date.now;try{Date.now=()=>now;g.deadline(now+1000);Date.now=()=>now+1001;assert.equal(g.allow(request(),'page0'),false);g.deadline(null);assert(g.allow(request(),'page0'));}finally{Date.now=real;}});
test('Loopback factory rejects public/mixed API targets; production factory ignores attempted host overrides',()=>{assert.throws(()=>loopbackStagingGuard({origin,publishableKey:key}));assert.throws(()=>loopbackStagingGuard({origin:'https://localhost:123',api,publishableKey:key}));const local=loopbackStagingGuard({origin:'https://localhost:123',api:'https://127.0.0.1:123',publishableKey:key});assert(local.allow({url:'https://localhost:123/offline',method:'GET',resourceType:'Document',headers:{}},'new'));assert.equal(stagingGuard({publishableKey:key,origin:'https://foreign.invalid'}).allow({url:'https://foreign.invalid/offline',method:'GET',resourceType:'Document',headers:{}},'new'),false);});
test('Memory-only minimal client adapter syntax does not persist session/code or change Auth settings',()=>{const script=harnessExpression({actor:actors[0],token:tokens[0]},api,key);assert.doesNotThrow(()=>new Function(script));assert(!script.includes('localStorage'));assert(!script.includes('setSession'));assert(!script.includes('signInWithPassword'));assert(script.includes("import('/session-entry.js')"));});
