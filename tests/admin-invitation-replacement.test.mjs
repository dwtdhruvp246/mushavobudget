import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const migration = await readFile(new URL("../supabase/migrations/20260923143000_replace_pending_admin_invitations.sql", import.meta.url), "utf8");
const functionSource = await readFile(new URL("../supabase/functions/invite-admin-user/index.ts", import.meta.url), "utf8");
const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");

test("a replaced invitation cannot provision the account and retains an audit trail", () => {
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(v_email, 0\)\)/);
  assert.match(migration, /set status = 'cancelled', cancelled_at = now\(\)[\s\S]*where lower\(email\) = v_email and status = 'sent'/);
  assert.match(migration, /'reason', 'replaced'/);
  assert.match(migration, /admin_user_invitations_active_auth_user_idx[\s\S]*status in \('pending_delivery', 'sent'\)/);
  assert.match(migration, /set admin_invitation_id = v_invitation_id/);
  assert.match(functionSource, /signInWithOtp\([\s\S]*shouldCreateUser: false/);
  assert.match(functionSource, /updateUserById\([\s\S]*user_metadata: metadata/);
  assert.match(functionSource, /status: reservation\.auth_user_id \? "replaced" : "sent"/);
});

test("normal signup cancels only a verified unfinished invite and provisions Free", () => {
  assert.match(migration, /profiles\.id = auth\.uid\(\)/);
  assert.match(migration, /invitations\.auth_user_id = profiles\.id/);
  assert.match(migration, /invitations\.status = 'sent'/);
  assert.match(migration, /where invitations\.id = v_invitation_id[\s\S]*invitations\.auth_user_id = v_user_id/);
  assert.match(migration, /where id = v_invitation_id and status = 'sent'[\s\S]*"reason":"self_signup"/);
  assert.match(migration, /v_workspace_id := public\.provision_budget_user\(v_user_id\)/);
  assert.match(migration, /grant execute on function public\.complete_self_signup_from_admin_invitation[\s\S]*to authenticated/);
  assert.doesNotMatch(migration, /grant execute on function public\.complete_self_signup_from_admin_invitation[\s\S]*to anon/);
  assert.match(schema, /complete_self_signup_from_admin_invitation/);
  assert.match(signup, /resetPasswordForEmail\(email/);
  assert.match(signup, /emailRedirectTo: new URL\("\.\/signup\.html\?mode=self-signup"/);
  assert.match(signup, /complete_self_signup_from_admin_invitation/);
});

test("signup page inline JavaScript parses after both new branches", () => {
  const inlineScript = signup.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(inlineScript);
  assert.doesNotThrow(() => new vm.Script(inlineScript.replace(/^\s*import .*;\s*$/m, "")));
});
