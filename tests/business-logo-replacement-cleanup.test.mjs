import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileReplacedLogos } from "../supabase/functions/_shared/business-upload-cleanup.mjs";

const workspace = "7aefbb66-3daf-4ff3-acee-cc768ab59f08";
const owner = "976b2f32-fdb6-470e-aa3f-a310fb1f8385";
const file = "cf3d7822-0178-4446-a08d-fcc625d46a60";
const path = [workspace, owner, file + ".png"].join("/");
const token = "14ba3a2b-0f37-4acc-99e8-b5a414e2f038";
const item = {object_name:path,cleanup_token:token};

test("removes a queued logo through Storage and finishes its exact lease", async () => {
  const actions = [];
  const counts = await reconcileReplacedLogos({
    claim: async limit => { assert.equal(limit, 5); return [item]; },
    remove: async (...args) => { actions.push(args); return {data:[{name:path}]}; },
    finish: async (...args) => { actions.push(args); return true; },
  });
  assert.deepEqual(actions, [["business-logos",path],[path,token]]);
  assert.deepEqual(counts, {claimed:1,removed:1,retry:0});
});

test("inconsistent cleanup claims stop before the first removal", async () => {
  let calls = 0;
  for (const invalid of [item, {...item,object_name:"workspaces/" + path}]) {
    await assert.rejects(reconcileReplacedLogos({
      claim: async () => [item, invalid],
      remove: async () => { calls++; },
      finish: async () => { calls++; },
    }), /Invalid cleanup claim/);
  }
  assert.equal(calls, 0);
});

test("failed or unconfirmed removals do not settle the lease", async () => {
  const rejected = await reconcileReplacedLogos({
    claim: async () => [item],
    remove: async () => ({error:new Error("Storage unavailable")}),
    finish: async () => assert.fail("Failed removal cannot settle"),
  });
  const notSettled = await reconcileReplacedLogos({
    claim: async () => [item],
    remove: async () => ({data:[]}),
    finish: async () => false,
  });
  assert.deepEqual(rejected, {claimed:1,removed:0,retry:1});
  assert.deepEqual(notSettled, rejected);
});
