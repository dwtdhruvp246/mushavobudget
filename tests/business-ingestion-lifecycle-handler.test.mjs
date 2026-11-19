import assert from "node:assert/strict";
import test from "node:test";
import { createProofHandler } from "../supabase/functions/validate-payment-proof/handler.mjs";

function setup({ reserve = true, verify = true, storageMatches = true } = {}) {
  const calls = [];
  const bytes = new TextEncoder().encode("Synthetic CSV content");
  const prefix = "fixture-documents/";
  const handler = createProofHandler({
    configured: () => true,
    allowedOrigin: () => true,
    createUserClient: () => ({
      auth: { getUser: async () => ({ data: { user: {id:"fixture-user"} } }) },
    }),
    bind: () => ({prefix, canWrite: async () => true}),
    gateReady: async () => true,
    standardFormats: false, decodeJpeg: null, decodeWebp: null,
    extraFormats: new Map([["text/csv",{suffix:".csv",normalize:input => input}]]),
    lifecycle: {
      reserve: async file => { calls.push(["reserve",file]); return reserve; },
      verify: async file => { calls.push(["verify",file]); return verify; },
    },
    store: async (path,stored,type) => {
      assert.deepEqual(stored,bytes);
      calls.push(["store",{path,type,size:stored.length}]);
    },
    read: async (path,size) => {
      calls.push(["read",{path,type:"text/csv",size}]);
      return new Blob([storageMatches ? bytes : new Uint8Array(bytes.length)]);
    },
  });
  return { calls, run: () => handler(new Request("https://example.invalid",{
    method:"POST",headers:{authorization:"Bearer " + "a".repeat(32),"content-type":"text/csv"},body:bytes,
  })) };
}

test("upload reserves exact normalized metadata before writing and verifies after readback", async () => {
  const { calls, run } = setup();
  const response = await run();
  assert.equal(response.status,200);
  const file = await response.json();
  assert.match(file.path,/^fixture-documents\/[a-f0-9-]{36}[.]csv$/);
  assert.deepEqual(calls,["reserve","store","read","verify"].map(step => [step,file]));
});

test("capacity exhaustion prevents all writes and returns an explicit response", async () => {
  const { calls, run } = setup({reserve:false});
  const response = await run();
  assert.equal(response.status,429);
  assert.equal((await response.json()).error,"PROOF_UPLOAD_CAPACITY_REACHED");
  assert.deepEqual(calls.map(([step]) => step),["reserve"]);
});

test("an unconfirmed Storage readback keeps the file out of verified state", async () => {
  const { calls, run } = setup({storageMatches:false});
  const response = await run();
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,"PROOF_WRITE_UNCONFIRMED");
  assert.deepEqual(calls.map(([step]) => step),["reserve","store","read"]);
});

test("an unconfirmed manifest update prevents a successful upload response", async () => {
  const { calls, run } = setup({verify:false});
  const response = await run();
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,"PROOF_WRITE_UNCONFIRMED");
  assert.deepEqual(calls.map(([step]) => step),["reserve","store","read","verify"]);
});
