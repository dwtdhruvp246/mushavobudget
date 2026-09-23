import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const getFunction = (name) => {
  const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0];
  assert.ok(source, `${name} is present`);
  return source;
};

test("analytics date presets use inclusive UTC days and all-time launch boundary", () => {
  class FixedDate extends Date {
    constructor(...args) { super(...(args.length ? args : ["2026-09-23T23:50:00Z"])); }
  }
  const values = { "#analyticsPeriod": "7" };
  const filters = vm.runInNewContext(`${getFunction("analyticsFilterValues")}\nanalyticsFilterValues`, {
    Date: FixedDate,
    $: (selector) => ({ value: values[selector] || "" })
  });
  assert.equal(filters().p_from, "2026-09-17");
  assert.equal(filters().p_to, "2026-09-23");
  values["#analyticsPeriod"] = "all";
  assert.equal(filters().p_from, "2020-01-01");
});

test("a slow report cannot overwrite newer filters or a signed-out session", async () => {
  const calls = [];
  const state = { isAdmin: true, adminAnalytics: null };
  const nodes = {
    "#analyticsMessage": { textContent: "" },
    "#analyticsResults": { classList: { add() {} } }
  };
  const context = {
    state,
    $: (selector) => nodes[selector],
    supabase: { rpc: () => new Promise((resolve) => calls.push(resolve)) },
    analyticsFilterValues: () => ({}),
    query: (_label, result) => result,
    friendlyMessage: (message) => message
  };
  const load = vm.runInNewContext(`let analyticsRequestId = 0;\n${getFunction("loadAdminAnalytics")}\nloadAdminAnalytics`, context);
  const older = load();
  const newer = load();
  calls[1]({ date: "new" });
  await newer;
  calls[0]({ date: "old" });
  await older;
  assert.equal(state.adminAnalytics.date, "new");

  const logoutRequest = load();
  state.isAdmin = false;
  state.adminAnalytics = null;
  calls[2]({ date: "private" });
  await logoutRequest;
  assert.equal(state.adminAnalytics, null);
});
