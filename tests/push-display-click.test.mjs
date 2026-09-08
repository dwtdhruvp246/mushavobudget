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
  await harness.fire("push", {
    data: {
      json: () => ({
        type: "payment_due",
        title: `  ${"A".repeat(100)}  `,
        body: " Electricity is due tomorrow. ",
        tag: "payment:due_tomorrow",
        sent_at: "2026-09-08T12:30:00.000Z",
        target_url: `/app.html?payment_item=${paymentId}&plan=business#family/payments`
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
    `https://mushavobudget.com/app.html?source=push&payment_item=${paymentId}&open_notifications=1#family/dashboard`
  );
  assert.deepEqual(harness.calls.badges, [1]);
});

test("payment clicks open the actionable Notifications panel instead of payment setup", () => {
  assert.match(applicationSource, /url\.searchParams\.get\("source"\) === "push"/);
  assert.match(applicationSource, /state\.familyTab = "dashboard"/);
  assert.match(applicationSource, /openNotificationDialog\(\)/);
  assert.match(applicationSource, /data-notification-payment-item-id/);
  assert.match(applicationSource, /data-notification-payment-due-date/);
});

test("malformed push payloads fall back to private display text", async () => {
  const harness = createWorkerHarness();
  await harness.fire("push", { data: { json: () => { throw new Error("invalid JSON"); } } });

  const notification = harness.calls.notifications[0];
  assert.equal(notification.title, "Mushavo Budget");
  assert.equal(notification.options.body, "You have a new Mushavo Budget notification.");
  assert.equal(
    notification.options.data.targetUrl,
    "https://mushavobudget.com/app.html?source=push#family/settings"
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
    "https://mushavobudget.com/app.html?source=push#family/settings"
  ]);
  assert.equal(harness.calls.openedFocused, true);
});

test("notification clicks navigate and focus an existing Mushavo app window", async () => {
  const calls = { navigated: [], focused: 0 };
  const client = {
    url: "https://mushavobudget.com/app.html#family/dashboard",
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
