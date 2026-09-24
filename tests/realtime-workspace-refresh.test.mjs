import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const realtimeSource = [
  app.slice(app.indexOf("const realtime ="), app.indexOf("let dashboardFitFrame")),
  app.slice(app.indexOf("function stopRealtime"), app.indexOf("async function query")),
  "globalThis.realtimeApi = { realtime, startRealtime, refreshVisibleData, refreshAfterAppResume };"
].join("\n");

function harness({ delayFirstAccess = false } = {}) {
  const timers = [];
  const calls = [];
  const handlers = new Map();
  let statusCallback = null;
  let releaseFirstAccess = null;
  let accessCalls = 0;
  const channel = {
    on(_kind, filter, callback) { handlers.set(filter.table, callback); return channel; },
    subscribe(callback) {
      statusCallback = callback;
      return channel;
    }
  };
  const context = {
    state: {
      session: { user: { id: "user-1" }, access_token: "token" },
      isAdmin: false,
      familyTab: "dashboard"
    },
    supabase: {
      realtime: { setAuth: () => calls.push("auth") },
      channel: () => channel,
      removeChannel: () => calls.push("removed")
    },
    window: {
      setTimeout(callback) {
        timers.push(callback);
        return timers.length;
      },
      clearTimeout: () => {}
    },
    document: { visibilityState: "visible" },
    console: { debug: () => {}, warn: () => {}, error: () => {} },
    navigator: { onLine: true },
    realtimeTablesForCurrentView: () => ["families", "budget_workspaces"],
    loadAccess() {
      accessCalls += 1;
      if (delayFirstAccess && accessCalls === 1) {
        return new Promise((resolve) => { releaseFirstAccess = resolve; });
      }
      return Promise.resolve();
    },
    loadFamily: async () => calls.push("families"),
    loadFamilyData: async () => calls.push("family-data"),
    loadWorkspaceSubscriptionData: async () => calls.push("subscriptions"),
    loadUserSupportData: async () => {},
    loadAdminData: async () => {},
    loadNotifications: async () => calls.push("notifications"),
    loadInvitations: async () => calls.push("invitations"),
    renderNotifications: () => calls.push("notification-rendered"),
    renderInvitations: () => calls.push("invitation-rendered"),
    renderAdmin: () => {},
    renderFamilyApp: () => calls.push("rendered"),
    showToast: (message) => calls.push(message)
  };
  vm.runInNewContext(realtimeSource, context);
  return {
    api: context.realtimeApi,
    calls,
    timers,
    getStatusCallback: () => statusCallback,
    getHandler: (table) => handlers.get(table),
    getAccessCalls: () => accessCalls,
    releaseFirstAccess: () => releaseFirstAccess()
  };
}

test("a realtime reconnect requests a fresh workspace snapshot", async () => {
  const h = harness();
  h.api.startRealtime();
  h.getStatusCallback()("SUBSCRIBED");
  assert.equal(h.timers.length, 2);
  h.timers.shift()();
  h.timers.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(h.calls.includes("notification-rendered"));
  assert.ok(h.calls.includes("families"));
  assert.ok(h.calls.includes("subscriptions"));
  assert.ok(h.calls.includes("rendered"));
});

test("a new invitation refreshes the recipient's notification without a page reload", async () => {
  const h = harness();
  h.api.startRealtime();
  h.getHandler("notifications")({ eventType: "INSERT" });
  assert.equal(h.timers.length, 1);
  await h.timers.shift()();
  assert.ok(h.calls.includes("notifications"));
  assert.ok(h.calls.includes("notification-rendered"));
  assert.equal(h.getAccessCalls(), 0);
});

test("a disconnected realtime channel reconnects without refreshing the page", () => {
  const h = harness();
  h.api.startRealtime();
  h.getStatusCallback()("CHANNEL_ERROR");
  assert.equal(h.timers.length, 1);
  h.timers.shift()();
  assert.ok(h.calls.includes("removed"));
});

test("changes received during a refresh are replayed instead of discarded", async () => {
  const h = harness({ delayFirstAccess: true });
  const firstRefresh = h.api.refreshVisibleData();
  await Promise.resolve();
  await h.api.refreshVisibleData();
  assert.equal(h.api.realtime.refreshPending, true);
  h.releaseFirstAccess();
  await firstRefresh;
  assert.equal(h.timers.length, 1);
  h.timers.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(h.getAccessCalls(), 2);
  assert.equal(h.calls.filter((call) => call === "rendered").length, 2);
});

test("returning to a suspended app refreshes data without reloading the page", () => {
  assert.match(app, /window\.addEventListener\("focus",[\s\S]{0,120}refreshAfterAppResume\("focus"\)/);
  assert.match(app, /window\.addEventListener\("pageshow",[\s\S]{0,120}refreshAfterAppResume\("pageshow"\)/);
  assert.match(app, /refreshAfterAppResume\("online"\)/);
  assert.match(app, /refreshAfterAppResume\("visibility"\)/);
  assert.doesNotMatch(app, /refreshAfterAppResume[\s\S]{0,300}window\.location\.reload/);
});

test("routine refreshes do not rewrite an existing Personal workspace", () => {
  const loadWorkspaceData = app.slice(
    app.indexOf("async function loadWorkspaceSubscriptionData"),
    app.indexOf("async function loadAdminData")
  );
  assert.match(loadWorkspaceData, /const hasPersonalWorkspace = state\.workspaces\.some/);
  assert.match(loadWorkspaceData, /if \(!hasPersonalWorkspace\) \{\s+await query\("personal workspace provision"/);
});
