import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const source = app.match(/async function recordVisibleActivity\(\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(source);

test("activity is recorded only for a visible, online, completed app session and throttled per user", async () => {
  const calls = [];
  const state = { session: { user: { id: "user-a" } } };
  const document = { visibilityState: "visible" };
  const navigator = { onLine: true };
  const analyticsActivity = { userId: null, lastSentAt: 0, inFlight: false };
  let time = 10_000;
  const context = {
    state, document, navigator, analyticsActivity,
    ANALYTICS_ACTIVITY_INTERVAL_MS: 50 * 60 * 1000,
    Date: { now: () => time },
    supabase: { async rpc(name) { calls.push(name); return { error: null }; } },
    console: { warn() {} }
  };
  const record = vm.runInNewContext(`${source}\nrecordVisibleActivity`, context);
  await record();
  await record();
  assert.deepEqual(calls, ["record_my_analytics_activity"]);

  document.visibilityState = "hidden";
  time += 60 * 60 * 1000;
  await record();
  document.visibilityState = "visible";
  navigator.onLine = false;
  await record();
  assert.equal(calls.length, 1);

  navigator.onLine = true;
  await record();
  assert.equal(calls.length, 2);
  state.session.user.id = "user-b";
  await record();
  assert.equal(calls.length, 3);
});
