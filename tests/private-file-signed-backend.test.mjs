import test from 'node:test';
import assert from 'node:assert/strict';
import { readSignedPrivateObject } from '../supabase/functions/get-private-file/signed-private-file.mjs';
const url='https://dczlddwbtgvfdujgcitb.supabase.co/storage/v1/object/sign/payment-proofs/personal/actor/file.png?token=private-temporary-capability';
const args={bucket:'payment-proofs',path:'personal/actor/file.png',maxBytes:68,mint:async()=>({data:{signedUrl:url}})};
test('server-only signed fetch is exact, short-lived, bounded and returns only bytes',async()=>{
 let calls=0;
 const r=await readSignedPrivateObject({...args,mint:async(bucket,path,seconds)=>{assert.equal(bucket,args.bucket);assert.equal(path,args.path);assert.equal(seconds,15);return {data:{signedUrl:url}};},fetcher:async(u,init)=>{
  calls++;assert.equal(String(u),url);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store');assert.equal(init.headers,undefined);return new Response('safe');
 }});assert.equal(await r.data.text(),'safe');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(r),/private-temporary|signedUrl/);
});
for(const [label,value] of [['foreign host',url.replace('dczlddwbtgvfdujgcitb.supabase.co','foreign.invalid')],['wrong bucket',url.replace('payment-proofs','business-documents')],['wrong object',url.replace('file.png','other.png')],['query injection',url+'&redirect=evil'],['fragment',url+'#private'],['missing token',url.split('?')[0]]])test(`signed backend refuses ${label} without fetching`,async()=>{
 let calls=0;const r=await readSignedPrivateObject({...args,mint:async()=>({data:{signedUrl:value}}),fetcher:async()=>{calls++;}});assert.ok(r.error);assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r),/private-temporary/);
});
for(const [label,response] of [['expiry',()=>new Response('private',{status:403})],['redirect',()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})],['header limit',()=>new Response('private',{headers:{'content-length':'69'}})],['stream limit',()=>new Response('x'.repeat(69))],['empty',()=>new Response('')]])test(`signed backend fails closed on ${label}`,async()=>{
 const r=await readSignedPrivateObject({...args,fetcher:async()=>response()});assert.ok(r.error);assert.equal(r.data,undefined);
});
test('signing errors do not make HTTP requests or expose provider details',async()=>{
 let calls=0;const r=await readSignedPrivateObject({...args,mint:async()=>({error:{message:url}}),fetcher:async()=>{calls++;}});assert.ok(r.error);assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r),/private-temporary/);
});
