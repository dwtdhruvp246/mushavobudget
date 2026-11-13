import assert from "node:assert/strict";
import test from "node:test";
import jpeg from "../scripts/fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js";
import { PROGRESSIVE_ROTATED_JPEG } from "../scripts/fixtures/logo-jpeg-tools/images.mjs";
import { createProofHandler } from "../supabase/functions/validate-payment-proof/handler.mjs";
import { FAMILY, ITEM, OWNER, MEMBER, bindFamilyProof, prefixFor } from "../supabase/functions/validate-family-proof/scope.mjs";

const workspace = "10000000-0000-4000-8000-000000000000";
const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");

function fixture({ actor = MEMBER, membership = true, expiresBeforeStore = false,
  wrongFamily = false, active = true, gate = true, session = true } = {}) {
  const objects = new Map();
  let membershipReads = 0;
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: actor } } }) },
    rpc: async name => {
      if (name === "app_session_status") return { data: { session_valid: session } };
      if (name === "is_active_family_participant") return { data: membership && (!expiresBeforeStore || ++membershipReads === 1) };
      return { data: [{ workspace_id: workspace, read_only: !active, effective_status: active ? "active" : "expired" }] };
    },
    from: table => ({ select: () => ({ eq: (_key, id) => ({ maybeSingle: async () => ({
      data: table === "payment_items"
        ? { id: ITEM, workspace_id: workspace, family_id: FAMILY, owner_id: OWNER, visibility: "family", status: "active" }
        : { id, legacy_family_id: wrongFamily ? "another-family" : FAMILY, owner_id: OWNER, workspace_type: "household", status: "active" },
    }) }) }) }),
  };
  const handle = createProofHandler({
    configured: () => true, allowedOrigin: () => false, createUserClient: () => client,
    bind: bindFamilyProof, denied: "FAMILY_PROOF_MEMBERSHIP_REQUIRED", gateReady: async () => gate,
    decodeJpeg: jpeg.decode,
    store: async (path, bytes) => {
      if (objects.has(path)) throw Error("already committed");
      objects.set(path, new Blob([bytes]));
    },
    read: async path => objects.get(path),
  });
  return { objects, send: (body = jpg, type = "image/jpeg") => handle(new Request("https://proof.test.invalid", {
    method: "POST", headers: { authorization: "Bearer " + "a".repeat(32), "content-type": type }, body,
  })) };
}

test("Family image validation binds both authorized actors to distinct immutable paths", async () => {
  const files = [];
  for (const actor of [OWNER, MEMBER]) {
    const f = fixture({ actor });
    const response = await f.send();
    assert.equal(response.status, 200);
    const first = await response.json();
    assert.ok(first.path.startsWith(prefixFor(actor)));
    assert.equal(first.type, "image/png");
    assert.equal(first.size, f.objects.get(first.path).size);
    assert.deepEqual(await (await f.send()).json(), first);
    assert.equal(f.objects.size, 1);
    files.push(first.path);
  }
  assert.notEqual(files[0], files[1]);
});

test("Family image validation declines unverified scope before Storage writes", async () => {
  for (const opts of [{ actor: "other" }, { membership: false }, { session: false },
    { active: false }, { wrongFamily: true }, { expiresBeforeStore: true }]) {
    const f = fixture(opts);
    assert.equal((await f.send()).status, 403);
    assert.equal(f.objects.size, 0);
  }
  const closed = fixture({ gate: false });
  assert.equal((await closed.send()).status, 503);
  assert.equal(closed.objects.size, 0);
  const f = fixture();
  assert.equal((await f.send(jpg, "image/png")).status, 422);
  assert.equal((await f.send(jpg, "application/pdf")).status, 415);
  assert.equal(f.objects.size, 0);
});
