import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../app-entry.js", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const manifest = JSON.parse(await readFile(new URL("../manifest.webmanifest", import.meta.url), "utf8"));
const publicHomepage = await readFile(new URL("../index.html", import.meta.url), "utf8");

function createElement() {
  const classes = new Set();
  return {
    textContent: "",
    href: "",
    attributes: {},
    classList: {
      add(value) { classes.add(value); },
      remove(value) { classes.delete(value); },
      toggle(value, force) {
        if (force === undefined ? !classes.has(value) : force) classes.add(value);
        else classes.delete(value);
      },
      contains(value) { return classes.has(value); }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener() {}
  };
}

async function runScenario({ online = true, getSession, getUser }) {
  const elements = Object.fromEntries([
    "entryShell", "entryEyebrow", "entryTitle", "entryCopy",
    "entryProgress", "entryActions", "entryRetry", "entrySignIn"
  ].map((id) => [id, createElement()]));
  const calls = { createClient: 0, getSession: 0, getUser: 0, signOut: 0, redirects: [], reloads: 0 };
  const client = {
    auth: {
      async getSession() {
        calls.getSession += 1;
        return getSession ? getSession() : { data: { session: null }, error: null };
      },
      async getUser() {
        calls.getUser += 1;
        return getUser ? getUser() : { data: { user: null }, error: null };
      },
      async signOut(options) {
        calls.signOut += 1;
        calls.signOutOptions = options;
        return { error: null };
      }
    }
  };
  const localStorage = {
    "sb-testproject-auth-token": "saved-session",
    removeItem(key) { delete this[key]; }
  };
  const context = {
    URL,
    Promise,
    TypeError,
    console,
    navigator: { onLine: online },
    document: { getElementById: (id) => elements[id] },
    window: {
      MUSHAVO_BUDGET_CONFIG: {
        supabaseUrl: "https://testproject.supabase.co",
        supabasePublishableKey: "sb_publishable_test"
      },
      __MUSHAVO_ENTRY_CREATE_CLIENT__: () => {
        calls.createClient += 1;
        return client;
      },
      location: {
        href: "https://mushavobudget.com/app-entry.html",
        replace(url) { calls.redirects.push(url); },
        reload() { calls.reloads += 1; }
      },
      localStorage,
      setTimeout,
      clearTimeout,
      addEventListener() {}
    }
  };

  vm.runInNewContext(source, context, { filename: "app-entry.js" });
  await context.window.__MUSHAVO_ENTRY_READY__;
  return { calls, elements, localStorage };
}

test("offline launch stops safely without checking or displaying account data", async () => {
  const { calls, elements } = await runScenario({ online: false });
  assert.equal(calls.createClient, 0);
  assert.equal(calls.redirects.length, 0);
  assert.equal(elements.entryTitle.textContent, "Connect to open your workspace");
  assert.match(elements.entryCopy.textContent, /cannot verify/i);
});

test("signed-out launch routes to the app sign-in screen", async () => {
  const { calls } = await runScenario({
    getSession: () => ({ data: { session: null }, error: null })
  });
  assert.equal(calls.getSession, 1);
  assert.equal(calls.getUser, 0);
  assert.equal(calls.redirects.length, 1);
  assert.match(calls.redirects[0], /app\.html\?source=pwa&auth=signed-out$/);
});

test("valid restored session routes to the authenticated app", async () => {
  const { calls } = await runScenario({
    getSession: () => ({ data: { session: { access_token: "test" } }, error: null }),
    getUser: () => ({ data: { user: { id: "user-1" } }, error: null })
  });
  assert.equal(calls.getSession, 1);
  assert.equal(calls.getUser, 1);
  assert.equal(calls.redirects.length, 1);
  assert.match(calls.redirects[0], /app\.html\?source=pwa$/);
});

test("expired session is cleared locally and routed to sign-in", async () => {
  const { calls, localStorage } = await runScenario({
    getSession: () => ({ data: { session: { access_token: "expired" } }, error: null }),
    getUser: () => ({ data: { user: null }, error: { status: 401, message: "JWT expired" } })
  });
  assert.equal(calls.signOut, 1);
  assert.equal(calls.signOutOptions.scope, "local");
  assert.equal(localStorage["sb-testproject-auth-token"], undefined);
  assert.equal(calls.redirects.length, 1);
  assert.match(calls.redirects[0], /app\.html\?source=pwa&auth=expired$/);
});

test("network failure shows the offline state instead of redirecting", async () => {
  const { calls, elements } = await runScenario({
    getSession: () => { throw new TypeError("Failed to fetch"); }
  });
  assert.equal(calls.redirects.length, 0);
  assert.equal(elements.entryTitle.textContent, "Connect to open your workspace");
});

test("installed app starts at the session-aware entry while the public homepage stays public", () => {
  assert.equal(manifest.start_url, "/app-entry.html?source=pwa");
  assert.doesNotMatch(publicHomepage, /location\.(?:replace|assign)\([^)]*app-entry/i);
});

test("service worker caches only the safe launcher shell", () => {
  assert.match(serviceWorkerSource, /pwa-shell-v9/);
  assert.match(serviceWorkerSource, /"\/app-entry\.js\?v=1"/);
  assert.doesNotMatch(serviceWorkerSource, /"\/app\.html/);
  assert.doesNotMatch(serviceWorkerSource, /"\/config\.js/);
  assert.doesNotMatch(serviceWorkerSource, /"\/manifest\.webmanifest/);
});
