import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import jpeg from "../scripts/fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js";
import { decode as decodeWebp } from "../scripts/fixtures/logo-jpeg-tools/node_modules/@stacksjs/ts-webp/dist/index.js";
import { PROGRESSIVE_ROTATED_JPEG } from "../scripts/fixtures/logo-jpeg-tools/images.mjs";
import { LOSSY_ALPHA } from "../scripts/fixtures/logo-jpeg-tools/webp-images.mjs";
import { createProofHandler, OWNER, PAYMENT_ITEM, PREFIX, WORKSPACE } from "../supabase/functions/validate-payment-proof/handler.mjs";

const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");
const webp = Buffer.from(LOSSY_ALPHA, "base64");
function fixture({ owner = OWNER, active = true, gate = true, itemWorkspace = WORKSPACE, session = true } = {}) {
  const objects = new Map();
  const handle = createProofHandler({
    configured: () => true, allowedOrigin: () => false, gateReady: async () => gate,
    decodeJpeg: jpeg.decode, decodeWebp,
    createUserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: owner } } }) },
      rpc: async name => ({ data: name === "app_session_status" ? { session_valid: session }
        : [{ workspace_id: WORKSPACE, read_only: false, effective_status: active ? "active" : "suspended" }] }),
      from: () => ({ select: () => ({ eq: (_column, id) => ({ maybeSingle: async () => ({
        data: { id, workspace_id: itemWorkspace, owner_id: OWNER, visibility: "personal", family_id: null, status: "active" },
      }) }) }) }),
    }),
    store: async (path, png) => {
      if (objects.has(path)) throw Error("already committed");
      objects.set(path, new Blob([png]));
    },
    read: async path => objects.get(path),
  });
  const send = (body, type = "image/jpeg") => handle(new Request("https://proof.test.invalid", {
    method: "POST", headers: { "content-type": type, authorization: "Bearer " + "a".repeat(32) }, body,
  }));
  return { send, objects };
}

test("Personal proof validation normalizes all three image types and reuses identical output", async () => {
  const f = fixture();
  const jpegResponse = await f.send(jpg);
  assert.equal(jpegResponse.status, 200);
  const j = await jpegResponse.json();
  assert.equal(j.type, "image/png");
  assert.ok(j.path.startsWith(PREFIX) && j.path.endsWith(".png"));
  assert.equal(j.size, f.objects.get(j.path).size);
  assert.deepEqual(await (await f.send(jpg)).json(), j);
  const png = new Uint8Array(await f.objects.get(j.path).arrayBuffer());
  assert.deepEqual(await (await f.send(png, "image/png")).json(), j);
  assert.equal((await f.send(webp, "image/webp")).status, 200);
  assert.equal(f.objects.size, 2);
});

test("Personal proof validation fails closed before writing", async () => {
  for (const [opts, status] of [[{ owner: "foreign" }, 403], [{ active: false }, 403],
    [{ session: false }, 403], [{ itemWorkspace: "other" }, 403], [{ gate: false }, 503]]) {
    const f = fixture(opts);
    assert.equal((await f.send(jpg)).status, status);
    assert.equal(f.objects.size, 0);
  }
  const f = fixture();
  assert.equal((await f.send(jpg, "application/pdf")).status, 415);
  assert.equal((await f.send(jpg, "image/png")).status, 422);
  assert.equal((await f.send(Buffer.alloc(2097153))).status, 413);
  assert.equal(f.objects.size, 0);
});

test("the app uses confirmed normalized metadata only for the isolated item", async () => {
  const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const code = source.slice(source.indexOf("async function uploadPaymentProof("), source.indexOf("async function openPaymentProof("));
  const path = PREFIX + "11111111-1111-4111-8111-111111111111.png";
  const calls = [];
  const globals = {
    config: { supabaseUrl: "https://dczlddwbtgvfdujgcitb.supabase.co" },
    state: { session: { user: { id: OWNER } }, family: null }, authDataEpoch: 1,
    currentBudgetWorkspace: () => ({ id: WORKSPACE }), validateProofFile: () => "jpg",
    crypto: { randomUUID: () => "123" }, PAYMENT_PROOF_BUCKET: "payment-proofs",
    supabase: {
      functions: { invoke: async (name, options) => { calls.push([name, options]); return { data: { path, type: "image/png", size: 78 } }; } },
      storage: { from: bucket => ({ upload: async (name, file) => { calls.push([bucket, name, file]); return {}; } }) },
    },
  };
  const run = runInNewContext(code + "\nuploadPaymentProof", globals);
  const file = { name: "receipt.jpg", type: "image/jpeg", size: 100 };
  const accepted = await run({ id: PAYMENT_ITEM, visibility: "personal" }, file);
  assert.equal(accepted.path, path);
  assert.equal(accepted.name, "receipt.png");
  assert.equal(accepted.type, "image/png");
  assert.equal(accepted.size, 78);
  assert.equal(accepted.validatedTrial, true);
  assert.equal(calls[0][1].headers["Content-Type"], "image/jpeg");
  await run({ id: "other", visibility: "personal" }, file);
  assert.equal(calls[1][0], "payment-proofs");
  assert.ok(calls[1][1].endsWith(".jpg"));
});
