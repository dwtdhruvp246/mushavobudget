import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const helperSource = await readFile(new URL("../push-notifications.js", import.meta.url), "utf8");
const applicationSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const applicationPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const applicationStyles = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const configSource = await readFile(new URL("../config.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const workflowSource = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");

function loadHelper({
  userAgent = "Mozilla/5.0 (Windows NT 10.0) Chrome/140",
  platform = "Win32",
  touchPoints = 0,
  standalone = false,
  secure = true,
  includeApis = true
} = {}) {
  const navigator = {
    userAgent,
    platform,
    maxTouchPoints: touchPoints,
    standalone
  };
  if (includeApis) navigator.serviceWorker = {};
  const window = {
    isSecureContext: secure,
    navigator,
    matchMedia: () => ({ matches: standalone })
  };
  if (includeApis) {
    window.PushManager = function PushManager() {};
    window.Notification = { permission: "default" };
  }
  const context = {
    window,
    navigator,
    Number,
    Object,
    String,
    Uint8Array,
    atob: (value) => Buffer.from(value, "base64").toString("binary")
  };
  vm.runInNewContext(helperSource, context, { filename: "push-notifications.js" });
  return window.MushavoPushSupport;
}

test("support checks require secure Web Push APIs", () => {
  assert.equal(loadHelper().supportStatus().supported, true);
  assert.equal(loadHelper({ secure: false }).supportStatus().code, "insecure");
  assert.equal(loadHelper({ includeApis: false }).supportStatus().code, "service-worker");
});

test("iPhone and iPad require an installed Home Screen app", () => {
  const browser = loadHelper({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
    platform: "iPhone"
  });
  assert.equal(browser.supportStatus().code, "ios-install-required");

  const installed = loadHelper({
    userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
    platform: "iPad",
    standalone: true
  });
  assert.equal(installed.supportStatus().supported, true);
  assert.equal(installed.deviceLabel(), "iPad app");
});

test("the public VAPID key decodes to an uncompressed P-256 key", () => {
  const helper = loadHelper();
  const match = configSource.match(/vapidPublicKey:\s*"([A-Za-z0-9_-]+)"/);
  assert.ok(match, "public VAPID key is missing from browser configuration");
  const bytes = helper.base64UrlToUint8Array(match[1]);
  assert.equal(bytes.length, 65);
  assert.equal(bytes[0], 4);
});

test("subscription serialization requires endpoint and both browser keys", () => {
  const helper = loadHelper();
  const payload = helper.subscriptionPayload({
    toJSON: () => ({ endpoint: "https://push.example.test/device", keys: { p256dh: "public-key-value", auth: "auth-value" } })
  });
  assert.deepEqual({ ...payload }, {
    endpoint: "https://push.example.test/device",
    p256dh: "public-key-value",
    auth: "auth-value"
  });
  assert.throws(() => helper.subscriptionPayload({ toJSON: () => ({ endpoint: "missing-keys" }) }), /PUSH_SUBSCRIPTION_INVALID/);
});

test("the UI asks for permission only inside the explicit enable action", () => {
  const matches = applicationSource.match(/Notification\.requestPermission\(\)/g) || [];
  assert.equal(matches.length, 1);
  const enableStart = applicationSource.indexOf("async function enablePushNotifications()");
  const disableStart = applicationSource.indexOf("async function deleteOwnPushRecord", enableStart);
  const permissionCall = applicationSource.indexOf("Notification.requestPermission()", enableStart);
  assert.ok(enableStart >= 0 && permissionCall > enableStart && permissionCall < disableStart);
  assert.match(applicationPage, /id="enablePushNotificationsButton"/);
  assert.match(applicationPage, /Enable payment reminders on this device/);
});

test("disabled devices distinguish browser permission from an active subscription", () => {
  assert.match(applicationPage, /<dt>Browser permission<\/dt>/);
  assert.match(applicationSource, /Allowed by browser/);
  assert.match(applicationSource, /reminders are disabled on this device/);
  assert.match(applicationSource, /disableButton\.hidden = !hasBrowserSubscription/);
});

test("the hidden attribute overrides global button display styles", () => {
  assert.match(applicationPage, /id="disablePushNotificationsButton"[^>]*hidden/);
  assert.match(applicationStyles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("subscription writes preserve restricted Stage 7 column permissions", () => {
  assert.match(applicationSource, /\.update\(metadata\)/);
  assert.match(applicationSource, /\.insert\(\{ user_id: userId, endpoint: keys\.endpoint, \.\.\.metadata \}\)/);
  assert.doesNotMatch(applicationSource, /from\("push_subscriptions"\)[\s\S]{0,120}\.upsert\(/);
  assert.match(applicationSource, /PUSH_SUBSCRIPTION_ENDPOINT_CONFLICT/);
});

test("logout cleans up this device before Supabase sign-out", () => {
  const start = applicationSource.indexOf("async function signOutSafely");
  const end = applicationSource.indexOf("function currencyCatalogue", start);
  const body = applicationSource.slice(start, end);
  assert.ok(body.indexOf("await removeCurrentDevicePush()") < body.indexOf("supabase.auth.signOut()"));
  assert.match(applicationSource, /signOutButton"\)\.addEventListener\("click", \(event\) => signOutSafely/);
});

test("Stage 8 assets deploy without adding push delivery yet", () => {
  assert.match(applicationPage, /\/push-notifications\.js\?v=1/);
  assert.match(workflowSource, /push-notifications\.js/);
  assert.doesNotMatch(workerSource, /addEventListener\("push"/);
});
