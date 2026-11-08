import assert from 'node:assert/strict';
import { AwsClient } from 'npm:aws4fetch@1.0.20';
import { readS3PrivateObject } from '../supabase/functions/get-private-file/s3-private-file.mjs';
let calls = 0;
const result = await readS3PrivateObject({
  bucket:'payment-proofs',path:'personal/synthetic/file.png',maxBytes:68,
  sign:request=>new AwsClient({accessKeyId:'dczlddwbtgvfdujgcitb',secretAccessKey:'synthetic-anon-key',
    sessionToken:'synthetic-service-JWT',service:'s3',region:'eu-west-1',retries:0})
    .sign(request,{redirect:'error',cache:'no-store',signal:request.signal}),
  fetcher:async request=>{
    calls++;
    assert.match(request.headers.get('authorization'),/^AWS4-HMAC-SHA256 Credential=dczlddwbtgvfdujgcitb\/\d{8}\/eu-west-1\/s3\/aws4_request,/);
    assert.equal(request.headers.get('x-amz-security-token'),'synthetic-service-JWT');
    assert.equal(new URL(request.url).search,'');assert.equal(request.redirect,'error');assert.equal(request.cache,'no-store');
    return new Response('safe');
  },
});
assert.equal(await result.data.text(),'safe');assert.equal(calls,1);
console.log(JSON.stringify({scope:'LOCAL_REAL_PINNED_AWS4FETCH_SIGNER_NO_NETWORK',pass:true,exit_code:0}));
