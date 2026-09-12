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

test("installed app starts at the canonical session-aware entry while the public homepage stays public", () => {
  assert.equal(manifest.start_url, "/app-entry?source=pwa");
  assert.equal(manifest.shortcuts[0].url, "/app-entry?source=shortcut");
  assert.doesNotMatch(publicHomepage, /location\.(?:replace|assign)\([^)]*app-entry/i);
});

test("service worker caches only the safe launcher shell", () => {
  const shellStart = serviceWorkerSource.indexOf("const SAFE_SHELL = [");
  const shellEnd = serviceWorkerSource.indexOf("];", shellStart);
  const safeShellSource = serviceWorkerSource.slice(shellStart, shellEnd);
  assert.match(serviceWorkerSource, /pwa-shell-v22/);
  assert.match(serviceWorkerSource, /"\/app-entry\.js\?v=1"/);
  assert.doesNotMatch(safeShellSource, /"\/app\.html/);
  assert.doesNotMatch(safeShellSource, /"\/config\.js/);
  assert.doesNotMatch(safeShellSource, /"\/manifest\.webmanifest/);
});

function createOfflineWorkerHarness() {
  const listeners = new Map();
  const stored = new Map();
  let offline = false;
  let skipWaitingCalls = 0;
  const cache = {
    async addAll(urls) {
      for (const url of urls) stored.set(url, new Response(`asset:${url}`));
    },
    async put(key, response) { stored.set(String(key), response.clone()); },
    async match(key) { return stored.get(String(key))?.clone(); }
  };
  const caches = {
    async open() { return cache; },
    async keys() { return ["mushavo-budget-pwa-shell-v21", "mushavo-budget-pwa-shell-v22"]; },
    async delete(key) { stored.delete(key); return true; }
  };
  const self = {
    location: { origin: "https://mushavobudget.com" },
    navigator: {},
    registration: { async showNotification() {} },
    clients: { async claim() {}, async matchAll() { return []; }, async openWindow() {} },
    addEventListener(type, listener) { listeners.set(type, listener); },
    async skipWaiting() { skipWaitingCalls += 1; }
  };
  async function fetch(input) {
    if (offline) throw new TypeError("Failed to fetch");
    const url = String(input?.url || input);
    if (url.includes("app-entry.html")) {
      return new Response("<!doctype html><title>Opening Mushavo Budget</title>", { status: 200 });
    }
    if (url.includes("offline.html")) {
      return new Response("<!doctype html><title>You are offline</title>", { status: 200 });
    }
    return new Response("asset", { status: 200 });
  }
  vm.runInNewContext(serviceWorkerSource, {
    self, caches, fetch, URL, Date, Number, String, Set, Promise, Array, Response, console
  }, { filename: "sw.js" });

  async function fireInstall() {
    let pending;
    listeners.get("install")({ waitUntil(value) { pending = Promise.resolve(value); } });
    await pending;
  }

  async function navigate(path) {
    let responsePromise;
    listeners.get("fetch")({
      request: { method: "GET", mode: "navigate", url: `https://mushavobudget.com${path}` },
      respondWith(value) { responsePromise = Promise.resolve(value); }
    });
    return responsePromise;
  }

  return {
    fireInstall,
    navigate,
    setOffline(value) { offline = value; },
    stored,
    get skipWaitingCalls() { return skipWaitingCalls; }
  };
}

test("cold offline launch uses redirect-independent cached entry and fallback pages", async () => {
  const harness = createOfflineWorkerHarness();
  await harness.fireInstall();
  assert.equal(harness.stored.has("/__mushavo-budget-offline/app-entry"), true);
  assert.equal(harness.stored.has("/__mushavo-budget-offline/page"), true);

  harness.setOffline(true);
  const legacyEntry = await harness.navigate("/app-entry.html?source=pwa");
  assert.match(await legacyEntry.text(), /Opening Mushavo Budget/);
  const canonicalEntry = await harness.navigate("/app-entry?source=pwa");
  assert.match(await canonicalEntry.text(), /Opening Mushavo Budget/);
  const privateRoute = await harness.navigate("/app.html#family/dashboard");
  assert.match(await privateRoute.text(), /You are offline/);
});

test("recovery worker activates and returns a private inline page when shell caching is interrupted", async () => {
  const harness = createOfflineWorkerHarness();
  harness.setOffline(true);
  await harness.fireInstall();
  assert.equal(harness.skipWaitingCalls, 1);

  const response = await harness.navigate("/app-entry?source=pwa");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Mushavo-Offline"), "inline");
  assert.match(await response.text(), /Connect to open your workspace/);
});
