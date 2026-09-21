import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const applicationSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

function createWorkerHarness({ windowClients = [] } = {}) {
  const listeners = new Map();
  const calls = {
    badges: [],
    badgeClears: 0,
    notifications: [],
    opened: []
  };

  const self = {
    location: { origin: "https://mushavobudget.com" },
    navigator: {
      async setAppBadge(count) { calls.badges.push(count); },
      async clearAppBadge() { calls.badgeClears += 1; }
    },
    registration: {
      async showNotification(title, options) { calls.notifications.push({ title, options }); }
    },
    clients: {
      async matchAll(options) {
        calls.matchOptions = options;
        return windowClients;
      },
      async openWindow(url) {
        calls.opened.push(url);
        return { async focus() { calls.openedFocused = true; } };
      },
      async claim() {}
    },
    addEventListener(type, listener) { listeners.set(type, listener); }
  };

  vm.runInNewContext(workerSource, {
    self,
    URL,
    Date,
    Number,
    String,
    Set,
    Promise,
    Array,
    Response,
    console
  }, { filename: "sw.js" });

  async function fire(type, event) {
    let pending = Promise.resolve();
    listeners.get(type)({
      ...event,
      waitUntil(value) { pending = Promise.resolve(value); }
    });
    await pending;
  }

  return { calls, fire };
}

test("push payloads use bounded display fields and an approved payment route", async () => {
  const harness = createWorkerHarness();
  const paymentId = "123e4567-e89b-42d3-a456-426614174000";
  const workspaceId = "123e4567-e89b-42d3-a456-426614174001";
  await harness.fire("push", {
    data: {
      json: () => ({
        type: "payment_due",
        title: `  ${"A".repeat(100)}  `,
        body: " Electricity is due tomorrow. ",
        tag: "payment:due_tomorrow",
        sent_at: "2026-09-08T12:30:00.000Z",
        target_url: `/app.html?workspace=${workspaceId}&payment_item=${paymentId}&plan=business#family/payments`
      })
    }
  });

  assert.equal(harness.calls.notifications.length, 1);
  const notification = harness.calls.notifications[0];
  assert.equal(notification.title.length, 80);
  assert.equal(notification.options.body, "Electricity is due tomorrow.");
  assert.equal(notification.options.tag, "payment:due_tomorrow");
  assert.equal(notification.options.timestamp, Date.parse("2026-09-08T12:30:00.000Z"));
  assert.equal(
    notification.options.data.targetUrl,
    `https://mushavobudget.com/app.html?source=push&workspace=${workspaceId}&payment_item=${paymentId}#family/payments`
  );
  assert.deepEqual(harness.calls.badges, [1]);
});

test("payment clicks open Payments and highlight the matching payment item", () => {
  assert.match(applicationSource, /selectNotificationWorkspace\(workspaceId\)/);
  assert.match(applicationSource, /state\.familyTab = "payments"/);
  assert.match(applicationSource, /setRoute\("family", "payments", true\)/);
  assert.match(applicationSource, /data-payment-item-id/);
  assert.match(applicationSource, /target\.scrollIntoView/);
});

test("malformed push payloads fall back to private display text", async () => {
  const harness = createWorkerHarness();
  await harness.fire("push", { data: { json: () => { throw new Error("invalid JSON"); } } });

  const notification = harness.calls.notifications[0];
  assert.equal(notification.title, "Mushavo Budget");
  assert.equal(notification.options.body, "You have a new Mushavo Budget notification.");
  assert.equal(
    notification.options.data.targetUrl,
    "https://mushavobudget.com/app.html?source=push#family/payments"
  );
});

test("notification clicks reject an external URL and open the safe signed-in route", async () => {
  const harness = createWorkerHarness();
  let closed = 0;
  await harness.fire("notificationclick", {
    notification: {
      data: { targetUrl: "https://attacker.example/payment/secret" },
      close() { closed += 1; }
    }
  });

  assert.equal(closed, 1);
  assert.equal(harness.calls.badgeClears, 1);
  assert.equal(harness.calls.matchOptions.type, "window");
  assert.equal(harness.calls.matchOptions.includeUncontrolled, true);
  assert.deepEqual(harness.calls.opened, [
    "https://mushavobudget.com/app.html?source=push#family/payments"
  ]);
  assert.equal(harness.calls.openedFocused, true);
});

test("notification clicks navigate and focus an existing Mushavo app window", async () => {
  const calls = { navigated: [], focused: 0 };
  const client = {
    url: "https://mushavobudget.com/app#family/dashboard",
    async navigate(url) {
      calls.navigated.push(url);
      return this;
    },
    async focus() { calls.focused += 1; }
  };
  const harness = createWorkerHarness({ windowClients: [client] });
  await harness.fire("notificationclick", {
    notification: {
      data: { targetUrl: "https://mushavobudget.com/app.html#family/settings" },
      close() {}
    }
  });

  assert.deepEqual(calls.navigated, [
    "https://mushavobudget.com/app.html?source=push#family/settings"
  ]);
  assert.equal(calls.focused, 1);
  assert.deepEqual(harness.calls.opened, []);
});

test("admin alerts open only an approved admin queue and preserve notification identity", async () => {
  const harness = createWorkerHarness();
  const notificationId = "123e4567-e89b-42d3-a456-426614174000";
  await harness.fire("push", {
    data: {
      json: () => ({
        type: "subscription_payment_submitted",
        title: "Subscription payment needs review",
        body: "A workspace owner submitted a subscription payment for review.",
        target_url: `/app.html?source=push&notification_id=${notificationId}#admin/finance`
      })
    }
  });

  assert.equal(
    harness.calls.notifications[0].options.data.targetUrl,
    `https://mushavobudget.com/app.html?source=push&notification_id=${notificationId}#admin/finance`
  );
});

test("admin subscription alerts preserve only validated workspace and payment identity", async () => {
  const harness = createWorkerHarness();
  const notificationId = "123e4567-e89b-42d3-a456-426614174000";
  const workspaceId = "123e4567-e89b-42d3-a456-426614174001";
  const subscriptionPaymentId = "123e4567-e89b-42d3-a456-426614174002";
  await harness.fire("push", {
    data: {
      json: () => ({
        target_url: `/app.html?source=push&notification_id=${notificationId}&workspace=${workspaceId}&subscription_payment=${subscriptionPaymentId}&unsafe=yes#admin/finance`
      })
    }
  });

  assert.equal(
    harness.calls.notifications[0].options.data.targetUrl,
    `https://mushavobudget.com/app.html?source=push&workspace=${workspaceId}&notification_id=${notificationId}&subscription_payment=${subscriptionPaymentId}#admin/finance`
  );
});
