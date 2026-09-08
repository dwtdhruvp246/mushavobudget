import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const helperSource = await readFile(new URL("../push-notifications.js", import.meta.url), "utf8");
const applicationSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const functionSource = await readFile(
  new URL("../supabase/functions/send-test-push/index.ts", import.meta.url),
  "utf8"
);

function listenerStore() {
  const listeners = new Map();
  return {
    add(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    async fire(type, event = {}) {
      let pending = Promise.resolve();
      const fullEvent = {
        ...event,
        waitUntil(promise) {
          pending = Promise.resolve(promise);
        }
      };
      for (const listener of listeners.get(type) || []) listener(fullEvent);
      await pending;
    }
  };
}

function createWorkerHarness({ windowClients = [], badgeMode = "supported" } = {}) {
  const events = listenerStore();
  const calls = {
    notifications: [],
    setBadges: [],
    clearBadges: 0,
    matchAll: [],
    openWindow: [],
    close: 0
  };
  const workerNavigator = {};
  if (badgeMode !== "unsupported") {
    workerNavigator.setAppBadge = async (value) => {
      calls.setBadges.push(value);
      if (badgeMode === "rejected") throw new Error("Badge unavailable");
    };
    workerNavigator.clearAppBadge = async () => {
      calls.clearBadges += 1;
      if (badgeMode === "rejected") throw new Error("Badge unavailable");
    };
  }
  const self = {
    location: { origin: "https://mushavobudget.com" },
    registration: {
      async showNotification(title, options) {
        calls.notifications.push({ title, options });
      }
    },
    clients: {
      async claim() {},
      async matchAll(options) {
        calls.matchAll.push(options);
        return windowClients;
      },
      async openWindow(url) {
        calls.openWindow.push(url);
        return { url };
      }
    },
    addEventListener: events.add,
    async skipWaiting() {}
  };
  vm.runInNewContext(workerSource, {
    self,
    navigator: workerNavigator,
    URL,
    Set,
    Math,
    Number,
    Date,
    Promise,
    console
  }, { filename: "sw.js" });
  return { calls, events };
}

function loadPushHelper() {
  const navigator = {};
  const window = { navigator };
  vm.runInNewContext(helperSource, {
    window,
    navigator,
    Number,
    Object,
    String,
    Uint8Array,
    atob: (value) => Buffer.from(value, "base64").toString("binary")
  }, { filename: "push-notifications.js" });
  return window.MushavoPushSupport;
}

test("test pushes use fixed private copy, timestamp, icons, and an allowlisted route", async () => {
  const harness = createWorkerHarness();
  await harness.events.fire("push", {
    data: {
      json: () => ({
        type: "test",
        title: "Untrusted title",
        body: "Untrusted body",
        url: "https://attacker.example/private"
      })
    }
  });

  assert.equal(harness.calls.notifications.length, 1);
  const notification = harness.calls.notifications[0];
  assert.equal(notification.title, "Mushavo Budget");
  assert.equal(notification.options.body, "Your payment reminder notifications are connected.");
  assert.equal(notification.options.icon, "/assets/pwa-icon-192.png");
  assert.equal(notification.options.badge, "/assets/pwa-icon-192.png");
  assert.equal(notification.options.tag, "mushavo-budget-test-push");
  assert.equal(notification.options.data.url, "/app.html#family/settings");
  assert.equal(typeof notification.options.timestamp, "number");
  assert.deepEqual(harness.calls.setBadges, [1]);
});

test("malformed and unknown pushes fall back to generic private content", async () => {
  const harness = createWorkerHarness({ badgeMode: "rejected" });
  await harness.events.fire("push", {
    data: { json: () => { throw new Error("Malformed payload"); } }
  });

  assert.equal(harness.calls.notifications[0].title, "Mushavo Budget");
  assert.equal(harness.calls.notifications[0].options.body, "You have a new Mushavo Budget notification.");
  assert.equal(harness.calls.notifications[0].options.data.url, "/app.html#family/dashboard");
});

test("notification clicks navigate and focus an existing authenticated app window", async () => {
  const clientCalls = { navigate: [], focus: 0 };
  const appClient = {
    url: "https://mushavobudget.com/app.html#family/dashboard",
    async navigate(url) {
      clientCalls.navigate.push(url);
      this.url = url;
      return this;
    },
    async focus() {
      clientCalls.focus += 1;
      return this;
    }
  };
  const harness = createWorkerHarness({ windowClients: [appClient] });
  await harness.events.fire("notificationclick", {
    notification: {
      data: { url: "/app.html#family/settings" },
      close() { harness.calls.close += 1; }
    }
  });

  assert.equal(harness.calls.close, 1);
  assert.deepEqual({ ...harness.calls.matchAll[0] }, { type: "window", includeUncontrolled: true });
  assert.deepEqual(clientCalls.navigate, ["https://mushavobudget.com/app.html#family/settings"]);
  assert.equal(clientCalls.focus, 1);
  assert.equal(harness.calls.openWindow.length, 0);
  assert.equal(harness.calls.clearBadges, 1);
});

test("external or unapproved click targets open only the safe dashboard route", async () => {
  const externalHarness = createWorkerHarness({ badgeMode: "unsupported" });
  await externalHarness.events.fire("notificationclick", {
    notification: {
      data: { url: "https://attacker.example/steal-session" },
      close() { externalHarness.calls.close += 1; }
    }
  });

  assert.deepEqual(externalHarness.calls.openWindow, [
    "https://mushavobudget.com/app.html#family/dashboard"
  ]);

  const queryHarness = createWorkerHarness({ badgeMode: "unsupported" });
  await queryHarness.events.fire("notificationclick", {
    notification: {
      data: { url: "/app.html?payment=private#family/settings" },
      close() { queryHarness.calls.close += 1; }
    }
  });
  assert.deepEqual(queryHarness.calls.openWindow, [
    "https://mushavobudget.com/app.html#family/dashboard"
  ]);
});

test("app badges mirror the in-app alert count and remain optional", async () => {
  const helper = loadPushHelper();
  const calls = { set: [], clear: 0 };
  const supported = {
    async setAppBadge(value) { calls.set.push(value); },
    async clearAppBadge() { calls.clear += 1; }
  };

  assert.equal(await helper.syncAppBadge(supported, 150), true);
  assert.deepEqual(calls.set, [99]);
  assert.equal(await helper.syncAppBadge(supported, 0), true);
  assert.equal(calls.clear, 1);
  assert.equal(await helper.syncAppBadge({}, 4), false);
  assert.match(applicationSource, /syncAppBadge\?\.\(navigator, alertCount\)/);
  assert.match(applicationSource, /syncAppBadge\?\.\(navigator, 0\)/);
});

test("the authenticated test payload contains only a fixed allowlisted route", () => {
  assert.match(functionSource, /url: "\/app\.html#family\/settings"/);
  assert.doesNotMatch(functionSource, /request\.json\(/);
});
