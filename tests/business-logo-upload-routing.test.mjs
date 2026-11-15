import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { FIXTURE_ID } from "../supabase/functions/validate-business-logo/handler.mjs";

const business = await readFile(new URL("../business.js", import.meta.url), "utf8");
const managed = (await readFile(new URL("../private-files.js", import.meta.url), "utf8")).replaceAll("export ", "");
function extract(start, end) {
  return business.slice(business.indexOf(start), business.indexOf(end, business.indexOf(start)));
}
const code = [
  extract("function usesValidatedLogoTrial(", "\n}"),
  extract("async function uploadBrandingDraft(", "function applySavedBusinessBranding("),
];
const staging = "https://dczlddwbtgvfdujgcitb.supabase.co";
const user = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
function fixture({ project = staging, workspace = FIXTURE_ID, responsePath, fileType = "image/png", changeWorkspace = false } = {}) {
  const calls = [];
  const draft = { file: { type: fileType, name: "synthetic-logo", size: 78 } };
  const state = { workspace: { id: workspace }, session: { user: { id: user } } };
  const context = {
    config: { supabaseUrl: project },
    brandingDrafts: { settings: draft },
    BUSINESS_LOGO_BUCKET: "business-logos",
    workspaceLoadSequence: 1,
    state,
    crypto: { randomUUID: () => id },
    query: async (_label, result) => result,
    supabase: {
      functions: { invoke: async (name, options) => {
        calls.push({ name, options });
        if (changeWorkspace) state.workspace = { id };
        return { data: { path: responsePath ?? `${workspace}/${user}/f3320000${id.slice(8)}.png`, type: "image/png", size: 77 } };
      } },
      storage: { from: bucket => ({ upload: async (path, file, options) => calls.push({ bucket, path, file, options }) }) },
    },
  };
  runInNewContext(managed + "\n" + code[0] + "\n}\n" + code[1], context);
  return { upload: () => context.uploadBrandingDraft("settings"), calls, draft };
}

test("the staging workspace uses the ordinary validator and reuses its confirmed path", async () => {
  const f = fixture();
  const path = await f.upload();
  assert.equal(path, `${FIXTURE_ID}/${user}/f3320000${id.slice(8)}.png`);
  assert.equal(await f.upload(), path);
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].name, "validate-ordinary-private-upload");
  assert.equal(f.calls[0].options.headers["Content-Type"], "image/png");
});

test("ordinary staging workspaces use validation and other projects retain their route", async () => {
  const staged = fixture({ workspace: id, fileType: "image/webp" });
  assert.ok((await staged.upload()).endsWith(".png"));
  assert.equal(staged.calls[0].name, "validate-ordinary-private-upload");
  const other = fixture({ project: "https://other-project.invalid", fileType: "image/webp" });
  assert.ok((await other.upload()).endsWith(".webp"));
  assert.equal(other.calls[0].bucket, "business-logos");
  assert.equal(other.calls[0].options.upsert, false);
});

test("staging logos send JPEG and WebP with their actual type", async () => {
  for (const fileType of ["image/jpeg", "image/webp"]) {
    const f = fixture({ fileType });
    assert.ok((await f.upload()).endsWith(".png"));
    assert.equal(f.calls[0].name, "validate-ordinary-private-upload");
    assert.equal(f.calls[0].options.headers["Content-Type"], fileType);
  }
});

test("foreign paths and a changed workspace do not attach a candidate logo", async () => {
  for (const input of [{ responsePath: `${id}/${user}/${id}.png` }, { changeWorkspace: true }]) {
    const f = fixture(input);
    await assert.rejects(f.upload(), /could not be confirmed|workspace changed/);
    assert.equal(f.draft.uploadedPath, undefined);
  }
});
