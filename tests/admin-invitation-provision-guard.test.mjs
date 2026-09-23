import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260923200000_hold_invited_workspace_until_setup.sql", import.meta.url), "utf8");
const replacement = await readFile(new URL("../supabase/migrations/20260923143000_replace_pending_admin_invitations.sql", import.meta.url), "utf8");
const setupPage = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const repair = await readFile(new URL("../supabase/repair-empty-pending-invite-workspace.sql", import.meta.url), "utf8");
const delivery = await readFile(new URL("../supabase/functions/invite-admin-user/index.ts", import.meta.url), "utf8");
const deployment = await readFile(new URL("../ADMIN_INVITATION_RESEND_DEPLOYMENT.md", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const guardSource = app.slice(
  app.indexOf("async function blockUnfinishedAdminInvitationSession()"),
  app.indexOf("async function loadApp()")
);

function runGuard(profile, invitation, rpcError = null) {
  const calls = [];
  const supabase = {
    from() {
      return { select() { return this; }, eq() { return this; }, maybeSingle() { return { data: profile, error: null }; } };
    },
    rpc(name) { calls.push(name); return { data: invitation, error: rpcError }; },
    auth: { async signOut(options) { calls.push(`signout:${options.scope}`); return { error: null }; } }
  };
  const context = {
    state: { session: { user: { id: "user-1" } } }, supabase,
    query: async (_label, result) => result.data,
    setView: (view) => calls.push(`view:${view}`),
    showToast: (message) => calls.push(message)
  };
  vm.runInNewContext(guardSource, context);
  return context.blockUnfinishedAdminInvitationSession().then((blocked) => ({ calls, blocked, session: context.state.session }));
}

test("an unfinished invited Auth session is signed out before the app loads data", async () => {
  const { calls, blocked, session } = await runGuard(
    { signup_source: "admin_invitation", admin_invitation_id: "invitation-1" },
    { invitation_status: "sent", provisioned_workspace_id: null }
  );
  assert.equal(blocked, true);
  assert.equal(session, null);
  assert.deepEqual(calls.slice(0, 3), ["get_my_admin_user_invitation", "signout:local", "view:auth"]);
  const appLoad = app.slice(app.indexOf("async function loadApp()"), app.indexOf("async function ensureProfile()"));
  assert.ok(appLoad.indexOf("await blockUnfinishedAdminInvitationSession()") < appLoad.indexOf("loadWorkspaceSubscriptionData()"));
});

test("normally registered and fully completed invited accounts can enter the app", async () => {
  const result = await runGuard({ signup_source: "self_signup", admin_invitation_id: null }, null);
  assert.equal(result.blocked, false);
  assert.deepEqual(result.calls, []);
  const completed = await runGuard(
    { signup_source: "admin_invitation", admin_invitation_id: "invitation-1" },
    { invitation_status: "provisioned", provisioned_workspace_id: "workspace-1" }
  );
  assert.equal(completed.blocked, false);
  assert.deepEqual(completed.calls, ["get_my_admin_user_invitation"]);
});

test("expired or unavailable invitations fail closed", async () => {
  const result = await runGuard(
    { signup_source: "admin_invitation", admin_invitation_id: "invitation-1" },
    null, { message: "ADMIN_INVITATION_NOT_AVAILABLE" }
  );
  assert.equal(result.blocked, true);
  assert.ok(result.calls.includes("signout:local"));
});

test("every Free provisioning path refuses pending, replaced, and failed invite setup", () => {
  for (const source of [migration, schema]) {
    const direct = source.slice(source.lastIndexOf("create or replace function public.provision_budget_user(p_user_id uuid)"));
    const wrapper = source.slice(source.lastIndexOf("create or replace function public.provision_my_budget_workspace()"));
    for (const [guard, userId] of [[direct, "p_user_id"], [wrapper, "v_user_id"]]) {
      assert.match(guard, new RegExp(`invitations\\.auth_user_id = ${userId}`));
      assert.match(guard, /invitations\.status in \('pending_delivery', 'sent'\)/);
      assert.match(guard, /profiles\.signup_source = 'admin_invitation'/);
      assert.match(guard, /invitations\.status = 'provisioned'/);
      assert.match(guard, /invitations\.provisioned_workspace_id is not null/);
      assert.match(guard, /raise exception 'ADMIN_INVITATION_SETUP_REQUIRED'/);
    }
    assert.ok(direct.indexOf("ADMIN_INVITATION_SETUP_REQUIRED") < direct.indexOf("insert into public.budget_workspaces"));
    assert.ok(wrapper.indexOf("ADMIN_INVITATION_SETUP_REQUIRED") < wrapper.indexOf("return public.provision_budget_user(v_user_id)"));
  }
  assert.match(replacement, /set status = 'cancelled'[^]*?status = 'sent'/);
  assert.match(replacement, /set full_name = btrim\(p_full_name\), signup_source = 'self_signup'[^]*?v_workspace_id := public.provision_budget_user\(v_user_id\)/);
  assert.match(setupPage, /await saveInvitedPassword\([^]*?supabase\.rpc\("complete_admin_user_invitation"/);
});

test("resends target setup and an old empty workspace can be repaired safely", () => {
  assert.match(delivery, /signup\.html\?mode=admin-invite&invitation=/);
  assert.match(delivery, /signInWithOtp\([\s\S]*?shouldCreateUser: false, emailRedirectTo: redirectTo/);
  assert.match(deployment, /Magic Link[\s\S]*?\.Data\.signup_source[\s\S]*?Complete account setup/);
  assert.match(repair, /invitations\.status in \('pending_delivery', 'sent'\)/);
  assert.match(repair, /constraint_row\.confrelid = 'public\.budget_workspaces'::regclass/);
  assert.ok(repair.indexOf("raise exception 'Workspace data in %") < repair.indexOf("delete from public.budget_workspaces"));
});
