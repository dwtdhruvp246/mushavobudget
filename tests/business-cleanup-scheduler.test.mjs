import test from "node:test";
import assert from "node:assert/strict";
import { dispatchCleanup } from "../workers/private-file-cleanup/worker.mjs";
import { verifiedCleanupAttempt } from "../supabase/functions/validate-business-lifecycle/scheduled-auth.mjs";

test("scheduled cleanup uses the fixed staging endpoint and a fresh signed invocation", async () => {
  const { privateKey, publicKey } = await crypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
  const env = {CLEANUP_SIGNING_KEY:JSON.stringify(await crypto.subtle.exportKey("jwk",privateKey))};
  const verifier = await crypto.subtle.exportKey("jwk",publicKey);
  let received;
  await dispatchCleanup(env, async (url,init) => {
    assert.equal(url,"https://dczlddwbtgvfdujgcitb.supabase.co/functions/v1/validate-business-lifecycle");
    assert.equal(init.redirect,"manual");
    assert.equal(init.method,"POST");
    assert.equal(init.headers["x-mushavo-attachment"],"scheduled-reconcile");
    received = new Headers(init.headers);
    return new Response(null,{status:204});
  });
  const attempt = await verifiedCleanupAttempt(received,verifier);
  assert.equal(attempt.nonce,received.get("x-mushavo-cleanup-nonce"));
  assert.equal(await verifiedCleanupAttempt(received,verifier,attempt.seconds+121),null);
  received.set("x-mushavo-cleanup-nonce",crypto.randomUUID());
  assert.equal(await verifiedCleanupAttempt(received,verifier),null);
  assert.equal(await verifiedCleanupAttempt(new Headers(),verifier),null);
});
