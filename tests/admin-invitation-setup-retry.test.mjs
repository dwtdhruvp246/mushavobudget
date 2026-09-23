import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const appPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const application = await readFile(new URL("../app.js", import.meta.url), "utf8");
const edgeFunction = await readFile(new URL("../supabase/functions/invite-admin-user/index.ts", import.meta.url), "utf8");
const invitationMigration = await readFile(new URL("../supabase/migrations/20260922113000_admin_user_invitations.sql", import.meta.url), "utf8");
const completionMigration = await readFile(new URL("../supabase/migrations/20260923100000_complete_admin_user_invitations.sql", import.meta.url), "utf8");

const helper = signup.match(/      async function saveInvitedPassword\([\s\S]*?\n      }/)?.[0];
assert.ok(helper, "invited signup needs a retryable password save");
const saveInvitedPassword = vm.runInNewContext(`${helper}\nsaveInvitedPassword`);

test("a saved password permits retrying workspace setup, while other auth errors stop it", async () => {
  const password = "test-password";
  const metadata = { signup_source: "admin_invitation" };
  let input;
  const client = (error) => ({ auth: { async updateUser(value) { input = value; return { error }; } } });
  await saveInvitedPassword(client(null), password, metadata);
  assert.equal(input.password, password);
  assert.equal(input.data, metadata);
  await saveInvitedPassword(client({ code: "same_password", message: "New password should be different" }), password, metadata);
  await assert.rejects(
    saveInvitedPassword(client({ code: "invalid_credentials", message: "Sign in again" }), password, metadata),
    { code: "invalid_credentials" }
  );
  assert.match(signup, /await saveInvitedPassword\([\s\S]*?supabase\.rpc\("complete_admin_user_invitation"/);
});

test("the admin cannot name or create the workspace before the invited user completes signup", () => {
  assert.doesNotMatch(appPage, /adminInviteWorkspaceName/);
  assert.doesNotMatch(application, /adminInviteWorkspaceName|workspace_name:\s*\$\("#adminInvite/);
  assert.doesNotMatch(edgeFunction, /body\.workspace_name/);
  assert.match(edgeFunction, /workspaceName = `\$\{fullName\.slice\(0, 88\)\}'s workspace`/);
  assert.match(invitationMigration, /if v_signup_source <> 'admin_invitation' then\s+perform public\.provision_budget_user/);
  assert.match(completionMigration, /v_invitation\.status <> 'sent'[\s\S]*insert into public\.budget_workspaces/);
  assert.match(signup, /<span>Workspace to create<\/span>/);
});
