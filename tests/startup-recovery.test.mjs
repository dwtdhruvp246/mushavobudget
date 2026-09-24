import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const workspaceLoader = app.slice(
  app.indexOf("async function loadWorkspaceSubscriptionData()"),
  app.indexOf("async function loadAdminData(")
);

function workspaceScenario(hasPersonalWorkspace) {
  const calls = [];
  const personal = { id: "personal-1", owner_id: "user-1", workspace_type: "personal", status: "active" };
  let provisioned = hasPersonalWorkspace;
  const request = new Proxy({}, { get: (_target, property) => () => request });
  const responses = {
    "workspace load": () => provisioned ? [personal] : [],
    "workspace load after provision": () => [personal],
    "workspace subscription load": () => [],
    "workspace entitlement load": () => [{ plan_code: "free" }],
    "workspace seat usage load": () => 1,
    "workspace member capacity load": () => [],
    "workspace currency settings load": () => ({ default_payment_currency: "USD" })
  };
  const context = {
    state: {
      session: { user: { id: "user-1" } }, workspaces: [],
      workspacePlanWorkspaceId: null, family: null
    },
    supabase: { from: () => request, rpc: () => request },
    query: async (label) => {
      calls.push(label);
      if (label === "personal workspace provision") {
        provisioned = true;
        return "personal-1";
      }
      return (responses[label] || (() => []))();
    },
    currentBudgetWorkspace: () => provisioned ? personal : null,
    populateWorkspaceCreationCurrencySelects() {}
  };
  vm.runInNewContext(workspaceLoader, context);
  return { context, calls };
}

test("existing Personal workspace opens without a provisioning request", async () => {
  const { context, calls } = workspaceScenario(true);
  await context.loadWorkspaceSubscriptionData();
  assert.equal(calls.includes("personal workspace provision"), false);
  assert.equal(context.state.workspaces[0].id, "personal-1");
});

test("a genuinely missing Personal workspace is provisioned and reloaded", async () => {
  const { context, calls } = workspaceScenario(false);
  await context.loadWorkspaceSubscriptionData();
  assert.equal(calls.filter((label) => label === "personal workspace provision").length, 1);
  assert.ok(calls.indexOf("workspace load") < calls.indexOf("personal workspace provision"));
  assert.ok(calls.indexOf("personal workspace provision") < calls.indexOf("workspace load after provision"));
  assert.equal(context.state.workspaces[0].id, "personal-1");
});

test("the password sign-in handler owns the initial workspace load", () => {
  const authListener = app.slice(app.indexOf("supabase.auth.onAuthStateChange"), app.indexOf("if (state.session) {\n    await openAuthenticatedSession"));
  assert.match(authListener, /if \(signInInProgress && event === "SIGNED_IN"\) return/);
  assert.match(app, /signedInSession = authData\.session;\s+await openAuthenticatedSession\(signedInSession\)/);
});
