import test from 'node:test';
import assert from 'node:assert/strict';
import { readS3PrivateObject } from '../supabase/functions/get-private-file/s3-private-file.mjs';
const args = { bucket:'payment-proofs', path:'personal/actor/file.png',maxBytes:68,sign:async r=>r };
test('S3 read uses only fixed staging host, signed headers, no-store and no redirects',async()=>{
  let called=0;
  const result=await readS3PrivateObject({...args,sign:async r=>{r.headers.set('Authorization','AWS4-HMAC-SHA256 synthetic');r.headers.set('X-Amz-Security-Token','private-synthetic');return r;},fetcher:async r=>{
    called++;assert.equal(r.url,'https://dczlddwbtgvfdujgcitb.storage.supabase.co/storage/v1/s3/payment-proofs/personal/actor/file.png');
    assert.equal(r.redirect,'error');assert.equal(r.cache,'no-store');assert.equal(r.method,'GET');assert.equal(r.headers.get('Cache-Control'),'no-store');
    assert.equal(new URL(r.url).search,'');assert.equal(r.headers.get('X-Amz-Security-Token'),'private-synthetic');return new Response('safe');
  }});
  assert.equal(await result.data.text(),'safe');assert.equal(called,1);assert.doesNotMatch(JSON.stringify(result),/private-synthetic/);
});
for(const [label,response] of [
  ['missing',()=>new Response('secret',{status:404})],['redirect',()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})],
  ['oversize header',()=>new Response('secret',{headers:{'Content-Length':'69'}})],
  ['oversize stream',()=>new Response('x'.repeat(69))],['empty',()=>new Response('')],
])test(`S3 reader fails closed on ${label}`,async()=>{
  const result=await readS3PrivateObject({...args,fetcher:async()=>response()});assert.ok(result.error);assert.equal(result.data,undefined);
});
test('S3 signing failure never fetches and cannot expose credentials in its error',async()=>{
  let calls=0;const result=await readS3PrivateObject({...args,sign:async()=>{throw new Error('private-synthetic');},fetcher:async()=>{calls++;}});
  assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(result),/private-synthetic/);
});
test('S3 reader refuses a signer that changes the fixed target or redirect policy',async()=>{
  for(const sign of [async()=>new Request('https://foreign.invalid'),async r=>new Request(r,{redirect:'follow'})]){
    let calls=0;const result=await readS3PrivateObject({...args,sign,fetcher:async()=>{calls++;}});assert.ok(result.error);assert.equal(calls,0);
  }
});
