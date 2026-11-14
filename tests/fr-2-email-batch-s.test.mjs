import test from 'node:test';
import assert from 'node:assert/strict';
import {boundedLocalGuard} from '../scripts/lib/browser-bounded-local-guard.mjs';
const origin='https://localhost:32123';
const req=(route='/api/email-verification/status',body={},actor='a1')=>({url:origin+route,method:'POST',resourceType:'Fetch',headers:{Authorization:'Bearer SYNTHETIC_'+actor,'Content-Type':'application/json','X-Mushavo-CSRF':'email-v1',Origin:origin},postData:JSON.stringify(body)});
for(const [name,patch] of [
 ['foreign origin',{url:'https://example.invalid/api/email-verification/status'}],
 ['real staging origin',{url:'https://mushavo-budget-staging.pages.dev/api/email-verification/status'}],
 ['production origin',{url:'https://kttkospkblwvguuwnhjj.supabase.co/rest/v1/profiles'}],
 ['embedded userinfo',{url:'https://user@localhost:32123/api/email-verification/status'}],
 ['unexpected query',{url:origin+'/api/email-verification/status?key=PRIVATE_SENTINEL'}],
 ['URL fragment',{url:origin+'/api/email-verification/status#PRIVATE_SENTINEL'}],
 ['wrong method',{method:'GET'}],
 ['wrong resource type',{resourceType:'Document'}],
 ['missing body',{postData:undefined}],
 ['malformed body',{postData:'{'}],
 ['array body',{postData:'[]'}],
 ['null body',{postData:'null'}],
 ['extra body field',{postData:'{"private":"PRIVATE_SENTINEL"}'}],
 ['oversized body',{postData:' '.repeat(513)}],
 ['missing Auth',{headers:{}}],
 ['non-synthetic Auth',{headers:{...req().headers,Authorization:'Bearer PRIVATE_SENTINEL'}}],
 ['wrong Origin',{headers:{...req().headers,Origin:'https://foreign.invalid'}}],
 ['wrong CSRF',{headers:{...req().headers,'X-Mushavo-CSRF':'wrong'}}],
 ['wrong content type',{headers:{...req().headers,'Content-Type':'text/plain'}}],
 ['revocation route',{url:origin+'/api/email-verification/revoke-all'}],
 ['forget route',{url:origin+'/api/email-verification/forget'}],
 ['unreviewed RPC',{url:origin+'/rpc/email_gate_admin_status'}],
 ['arbitrary profile selector',{url:origin+'/profile',postData:'{"scope":"all"}'}],
 ['noncanonical path',{url:origin+'/foo/../api/email-verification/status'}],
])test('Local guard rejects '+name,()=>{const g=boundedLocalGuard(origin);assert.equal(g.allow({...req(),...patch}),false);assert.equal(g.safe().blocked,1);assert(!JSON.stringify(g.safe()).includes('PRIVATE_SENTINEL'));});
test('Guard configuration cannot accept public, HTTP or credential-bearing origins',()=>{for(const o of ['https://mushavo-budget-staging.pages.dev','https://localhost','http://localhost:1','https://user@localhost:1','https://localhost:1/','https://127.0.0.1:1'])assert.throws(()=>boundedLocalGuard(o));for(const maximum of [0,97,1.1,'96'])assert.throws(()=>boundedLocalGuard(origin,{maximum}));});
test('Exact local component GETs and synthetic actor documents permitted, other paths denied',()=>{for(const route of ['/session-entry.js','/email-verification.js?v=2','/favicon.ico'])assert(boundedLocalGuard(origin).allow({url:origin+route,method:'GET',resourceType:'Script'}));for(const actor of ['a1','a2','a3','b1'])assert(boundedLocalGuard(origin).allow({url:origin+'/fixture.html?actor='+actor,method:'GET',resourceType:'Document'}));for(const route of ['/email-verification.js','/session-entry.js?key=secret','/fixture.html?actor=foreign','/sw.js','/config.js'])assert.equal(boundedLocalGuard(origin).allow({url:origin+route,method:'GET',resourceType:'Script'}),false);});
test('One remembered email only for first account; second send is denied even after failure',()=>{const g=boundedLocalGuard(origin);assert(g.allow(req('/api/email-verification/begin',{remember:true})));assert.equal(g.allow(req('/api/email-verification/begin',{remember:true})),false);assert.equal(g.safe().begin,2);for(const actor of ['a2','a3','b1'])assert.equal(boundedLocalGuard(origin).allow(req('/api/email-verification/begin',{remember:true},actor)),false);assert.equal(boundedLocalGuard(origin).allow(req('/api/email-verification/begin',{remember:false})),false);});
test('Verification is one attempt, six digits and exact shape for first session',()=>{const body={challengeId:'00000000-0000-4000-8000-000000000001',code:'123456'},g=boundedLocalGuard(origin);assert(g.allow(req('/api/email-verification/verify',body)));assert.equal(g.allow(req('/api/email-verification/verify',body)),false);for(const next of [{...body,code:123456},{...body,code:'12'},{...body,extra:true},{...body,challengeId:'wrong'}])assert.equal(boundedLocalGuard(origin).allow(req('/api/email-verification/verify',next)),false);assert.equal(boundedLocalGuard(origin).allow(req('/api/email-verification/verify',body,'a2')),false);assert(!JSON.stringify(g.safe()).includes('123456'));assert.equal(boundedLocalGuard(origin).allow({...req(),headers:null}),false);});
test('Bounded counter includes blocked attempts and cannot be reset',()=>{const g=boundedLocalGuard(origin,{maximum:2});assert.equal(g.allow({...req(),url:'https://foreign.invalid'}),false);assert(g.allow(req()));assert.equal(g.allow(req()),false);assert.deepEqual(g.safe(),{attempts:3,blocked:2,begin:0,verify:0,maximum:2});const copy=g.safe();copy.attempts=0;assert.equal(g.safe().attempts,3);});
test('Status restore proof and profile are narrowly selected for all synthetic sessions',()=>{for(const actor of ['a1','a2','a3','b1'])for(const route of ['/api/email-verification/status','/api/email-verification/restore','/rpc/email_gate_current_session_verified'])assert(boundedLocalGuard(origin).allow(req(route,{},actor)));for(const scope of ['own','foreign'])assert(boundedLocalGuard(origin).allow(req('/profile',{scope})));});
