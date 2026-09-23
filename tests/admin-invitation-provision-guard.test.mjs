import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260923190000_guard_pending_admin_invitation_workspace.sql", import.meta.url), "utf8");
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

test("the database refuses premature Free provisioning even if another tab tries it", () => {
  for (const source of [migration, schema]) {
    const guard = source.slice(source.lastIndexOf("create or replace function public.provision_my_budget_workspace()"));
    assert.match(guard, /invitations\.auth_user_id = v_user_id/);
    assert.match(guard, /invitations\.status = 'sent'/);
    assert.ok(guard.indexOf("ADMIN_INVITATION_SETUP_REQUIRED") < guard.indexOf("return public.provision_budget_user(v_user_id)"));
  }
});
