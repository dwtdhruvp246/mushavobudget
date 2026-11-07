import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {invitedSignupHarness,choices,ID} from "./helpers/invited-signup.mjs";

const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const appPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const application = await readFile(new URL("../app.js", import.meta.url), "utf8");
const edgeFunction = await readFile(new URL("../supabase/functions/invite-admin-user/index.ts", import.meta.url), "utf8");
const invitationMigration = await readFile(new URL("../supabase/migrations/20260922113000_admin_user_invitations.sql", import.meta.url), "utf8");
const completionMigration = await readFile(new URL("../supabase/migrations/20260923100000_complete_admin_user_invitations.sql", import.meta.url), "utf8");

test("a saved password permits retrying workspace setup, while other auth errors stop it", async () => {
  for(const code of [null,"same_password","invalid_credentials"]) {
    const h=invitedSignupHarness();await h.controller.verify();
    h.setUpdateError(code?{code}:null);
    const save=h.controller.savePassword("synthetic-password","synthetic-password",choices);
    if(code==="invalid_credentials") {await assert.rejects(save,{code});assert.equal(h.controller.passwordSaved,false);}
    else {await save;assert.equal(h.controller.passwordSaved,true);const input=h.calls.find(x=>x[0]==="password")[1];assert.equal(input.password,"synthetic-password");assert.equal(input.data.signup_source,"admin_invitation");}
  }
});

test("setup requires the invited session before saving a password", async () => {
  const missing=invitedSignupHarness();missing.setSession(null);
  await assert.rejects(missing.controller.verify(),{code:"session_not_found"});
  assert(!missing.calls.some(x=>x[0]==="password"));
  const wrong=invitedSignupHarness();wrong.setRow({invitation_id:"cccccccc-cccc-4ccc-8ccc-cccccccccccc",email:"other@example.invalid",invitation_status:"sent"});
  await assert.rejects(wrong.controller.verify(),{code:"ADMIN_INVITATION_NOT_AVAILABLE"});
  assert(!wrong.calls.some(x=>x[0]==="password"));
  const correct=invitedSignupHarness();await correct.controller.verify();assert.equal(correct.controller.userId,ID);
  assert.match(signup,/if \(isAdminInvite && isMissingInviteSession\(error\)\) \{\s+lockInviteForm/);
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
