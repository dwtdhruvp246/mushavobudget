import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260923190000_guard_pending_admin_invitation_workspace.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const redirectSource = app.slice(
  app.indexOf("async function redirectUnfinishedAdminInvitation()"),
  app.indexOf("async function loadApp()")
);

function runRedirect(profile, pending) {
  const calls = [];
  const supabase = {
    from() {
      return { select() { return this; }, eq() { return this; }, maybeSingle() { return { data: profile, error: null }; } };
    },
    rpc(name) { calls.push(name); return { data: pending, error: null }; }
  };
  const context = {
    state: { session: { user: { id: "user-1" } } }, supabase,
    query: async (_label, result) => result.data,
    URL,
    window: {
      location: { href: "https://mushavobudget.com/app.html" },
      locationRedirects: [],
    }
  };
  context.window.location.replace = (url) => context.window.locationRedirects.push(url);
  vm.runInNewContext(redirectSource, context);
  return context.redirectUnfinishedAdminInvitation().then((redirected) => ({ calls, redirected, destinations: context.window.locationRedirects }));
}

test("an invited Auth session goes to signup before the app provisions a workspace", async () => {
  const { calls, redirected, destinations } = await runRedirect(
    { signup_source: "admin_invitation", admin_invitation_id: "invitation-1" }, true
  );
  assert.equal(redirected, true);
  assert.deepEqual(calls, ["has_my_unfinished_admin_invitation"]);
  assert.equal(destinations.length, 1);
  assert.equal(new URL(destinations[0]).searchParams.get("mode"), "admin-invite");
  assert.equal(new URL(destinations[0]).searchParams.get("invitation"), "invitation-1");
  const appLoad = app.slice(app.indexOf("async function loadApp()"), app.indexOf("async function ensureProfile()"));
  assert.ok(appLoad.indexOf("await redirectUnfinishedAdminInvitation()") < appLoad.indexOf("loadWorkspaceSubscriptionData()"));
});

test("a normally registered account continues into the app", async () => {
  const result = await runRedirect({ signup_source: "self_signup", admin_invitation_id: null }, false);
  assert.equal(result.redirected, false);
  assert.deepEqual(result.calls, []);
  assert.deepEqual(result.destinations, []);
});

test("the database refuses premature Free provisioning even if another tab tries it", () => {
  for (const source of [migration, schema]) {
    const guard = source.slice(source.lastIndexOf("create or replace function public.provision_my_budget_workspace()"));
    assert.match(guard, /invitations\.auth_user_id = v_user_id/);
    assert.match(guard, /invitations\.status = 'sent'/);
    assert.ok(guard.indexOf("ADMIN_INVITATION_SETUP_REQUIRED") < guard.indexOf("return public.provision_budget_user(v_user_id)"));
  }
});
