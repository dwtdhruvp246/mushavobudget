import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { createCleanupHandler } from "../supabase/functions/fr33-file-cleanup/handler.mjs";
import scheduler from "../deployment/cloudflare/fr33-production-cleanup.mjs";

const {publicKey,privateKey} = generateKeyPairSync("ec",{namedCurve:"P-256"});
const publicJWK = publicKey.export({format:"jwk"});
const privateJWK = JSON.stringify(privateKey.export({format:"jwk"}));
const path = "personal/11111111-1111-4111-8111-111111111111/managed-upload-v1/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.png";
const token = "44444444-4444-4444-8444-444444444444";

async function signedRequest() {
  let request;
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url,options) => {
      request = new Request(url,options);
      return new Response(null,{status:204});
    };
    await scheduler.scheduled({}, {FR33_SIGNING_KEY:privateJWK});
    return request;
  } finally { globalThis.fetch = original; }
}

test("unsigned and altered scheduler requests never reach the database", async () => {
  const runner = createCleanupHandler({projectReady:true,publicKey:publicJWK,
    rpc:() => assert.fail("unauthenticated database call")});
  const signed = await signedRequest();
  const headers = new Headers(signed.headers);
  headers.set("x-mushavo-cleanup-nonce",token);
  assert.equal((await runner(new Request(signed.url,{method:"POST"}))).status,403);
  assert.equal((await runner(new Request(signed.url,{method:"POST",headers}))).status,403);
});

test("a scheduled request stops when production and rehearsal are paused", async () => {
  const calls = [];
  const runner = createCleanupHandler({projectReady:true,publicKey:publicJWK,
    rpc:(name) => {calls.push(name); return null;},
    remove:() => assert.fail("unexpected Storage removal")});
  assert.equal((await runner(await signedRequest())).status,204);
  assert.deepEqual(calls,["fr33_begin_storage_job"]);
});

test("the authorized rehearsal removes and acknowledges only its disposable proof", async () => {
  const calls = [];
  const runner = createCleanupHandler({projectReady:true,publicKey:publicJWK,
    rpc:(name,args) => {
      calls.push([name,args]);
      if (name === "fr33_begin_storage_job") return {operation:"rehearsal",rehearsal_path:path};
      if (name === "fr33_claim_storage_rehearsal") return [{bucket_id:"payment-proofs",object_name:path,cleanup_token:token}];
      if (name === "fr32_finish_ordinary_cleanup") return true;
      assert.fail(name);
    },
    remove:(bucket,key) => {
      assert.equal(bucket,"payment-proofs");assert.equal(key,path);
      return {data:[{name:path}]};
    }});
  const result = await runner(await signedRequest());
  assert.equal(result.status,200);
  assert.deepEqual(await result.json(),{ordinaryUploads:{claimed:1,removed:1,retry:0}});
  assert.deepEqual(calls.at(-1),["fr32_finish_ordinary_cleanup",{p_bucket:"payment-proofs",p_path:path,p_token:token}]);
});

test("a different proof in the queue or missing seeder fails without touching Storage", async () => {
  const supplied = path.replace("33333333","55555555");
  let mode = "rehearsal";
  const runner = createCleanupHandler({projectReady:true,publicKey:publicJWK,
    rpc:(name) => name === "fr33_begin_storage_job" ? {operation:mode,rehearsal_path:path}
      : [{bucket_id:"payment-proofs",object_name:supplied,cleanup_token:token}],
    remove:() => assert.fail("unscoped Storage removal")});
  const result = await runner(await signedRequest());
  assert.deepEqual(await result.json(),{ordinaryUploads:{claimed:1,removed:0,retry:1}});
  mode = "rehearsal_seed";
  assert.equal((await runner(await signedRequest())).status,503);
});
