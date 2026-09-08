import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const pwaSource = await readFile(new URL("../pwa.js", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const workflowSource = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const applicationSource = await readFile(new URL("../app.js", import.meta.url), "utf8");

class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.textContent = "";
    this.disabled = false;
    this.type = "";
    this._classes = new Set();
    this.classList = {
      add: (...values) => values.forEach((value) => this._classes.add(value)),
      remove: (...values) => values.forEach((value) => this._classes.delete(value)),
      contains: (value) => this._classes.has(value)
    };
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this._classes].join(" ");
  }

  append(...children) {
    this.children.push(...children);
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, ...event });
  }
}

function listenerStore() {
  const listeners = new Map();
  return {
    listeners,
    add(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    fire(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    }
  };
}

function findElement(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

async function createHarness({ waiting = true } = {}) {
  const documentEvents = listenerStore();
  const windowEvents = listenerStore();
  const workerEvents = listenerStore();
  const registrationEvents = listenerStore();
  const calls = { register: [], update: 0, postMessage: [], reload: 0 };
  let now = 1000;
  let nextTimerId = 1;
  const timers = new Map();

  const worker = {
    state: "installed",
    postMessage(message) { calls.postMessage.push(message); },
    addEventListener: workerEvents.add.bind(workerEvents)
  };
  const registration = {
    waiting: waiting ? worker : null,
    installing: null,
    async update() { calls.update += 1; },
    addEventListener: registrationEvents.add.bind(registrationEvents)
  };
  const body = new MockElement("body");
  const document = {
    body,
    visibilityState: "visible",
    createElement: (tag) => new MockElement(tag),
    querySelectorAll: () => [],
    querySelector: () => null,
    addEventListener: documentEvents.add.bind(documentEvents)
  };
  const navigator = {
    onLine: true,
    serviceWorker: {
      controller: {},
      register: async () => registration,
      addEventListener: workerEvents.add.bind(workerEvents)
    }
  };
  class HarnessDate extends Date {
    static now() { return now; }
  }
  const window = {
    document,
    navigator,
    location: {
      protocol: "https:",
      reload() { calls.reload += 1; }
    },
    __MUSHAVO_PWA_REGISTER__: async (url, options) => {
      calls.register.push({ url, options });
      return registration;
    },
    addEventListener: windowEvents.add.bind(windowEvents),
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); }
  };
  const context = { window, document, navigator, Date: HarnessDate, Set, Object, console };
  vm.runInNewContext(pwaSource, context, { filename: "pwa.js" });
  windowEvents.fire("load");
  await window.__MUSHAVO_PWA_READY__;

  return {
    calls,
    document,
    documentEvents,
    window,
    windowEvents,
    worker,
    workerEvents,
    registration,
    setNow(value) { now = value; },
    updateButton: () => findElement(body, (item) => item.textContent === "Reload page" || item.textContent === "Update and discard changes" || item.textContent === "Reloading…"),
    laterButton: () => findElement(body, (item) => item.textContent === "Later" || item.textContent === "Keep editing"),
    banner: () => findElement(body, (item) => item.tagName === "ASIDE"),
    runTimers() {
      const pending = [...timers.values()];
      timers.clear();
      pending.forEach(({ callback }) => callback());
    }
  };
}

function activeFormAndInput() {
  const form = {
    dataset: {},
    isConnected: true,
    closest(selector) {
      if (selector === "form") return this;
      return null;
    }
  };
  const input = { closest: (selector) => selector === "form" ? form : null };
  return { form, input };
}

test("registers with service-worker HTTP caching disabled and checks immediately", async () => {
  const harness = await createHarness();
  assert.equal(harness.calls.register[0].url, "/sw.js");
  assert.equal(harness.calls.register[0].options.scope, "/");
  assert.equal(harness.calls.register[0].options.updateViaCache, "none");
  assert.equal(harness.calls.update, 1);
  assert.equal(harness.window.MushavoPWA.release, "4.1.1");
});

test("waiting worker displays an update banner without reloading", async () => {
  const harness = await createHarness();
  assert.ok(harness.banner());
  assert.equal(harness.banner().classList.contains("pwa-update-hidden"), false);
  assert.equal(harness.calls.reload, 0);
  assert.equal(harness.calls.postMessage.length, 0);
});

test("reload page activates the waiting worker and reloads on controller change", async () => {
  const harness = await createHarness();
  harness.updateButton().dispatch("click");
  assert.equal(harness.calls.postMessage[0].type, "SKIP_WAITING");
  assert.equal(harness.calls.reload, 0);
  harness.workerEvents.fire("controllerchange");
  assert.equal(harness.calls.reload, 1);
  harness.workerEvents.fire("controllerchange");
  assert.equal(harness.calls.reload, 1);
});

test("reload fallback prevents the interface remaining stuck on reloading", async () => {
  const harness = await createHarness();
  harness.updateButton().dispatch("click");
  assert.equal(harness.calls.reload, 0);
  harness.runTimers();
  assert.equal(harness.calls.reload, 1);
  harness.runTimers();
  assert.equal(harness.calls.reload, 1);
});

test("unsaved form requires a separate destructive confirmation", async () => {
  const harness = await createHarness();
  const { input } = activeFormAndInput();
  harness.documentEvents.fire("input", { target: input });
  assert.equal(harness.window.MushavoPWA.hasUnsavedChanges(), true);

  harness.updateButton().dispatch("click");
  assert.equal(harness.calls.postMessage.length, 0);
  assert.equal(harness.updateButton().textContent, "Update and discard changes");
  assert.equal(harness.laterButton().textContent, "Keep editing");

  harness.updateButton().dispatch("click");
  assert.equal(harness.calls.postMessage[0].type, "SKIP_WAITING");
  let prevented = false;
  harness.windowEvents.fire("beforeunload", { preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test("beforeunload protects active dirty forms and markFormClean releases them", async () => {
  const harness = await createHarness({ waiting: false });
  const { form, input } = activeFormAndInput();
  harness.documentEvents.fire("change", { target: input });
  let prevented = false;
  const event = { preventDefault() { prevented = true; }, returnValue: undefined };
  harness.windowEvents.fire("beforeunload", event);
  assert.equal(prevented, true);
  assert.equal(event.returnValue, "");

  harness.window.MushavoPWA.markFormClean(form);
  prevented = false;
  harness.windowEvents.fire("beforeunload", { preventDefault() { prevented = true; } });
  assert.equal(prevented, false);
});

test("returning to the foreground checks for updates again", async () => {
  const harness = await createHarness({ waiting: false });
  harness.setNow(20000);
  harness.document.visibilityState = "visible";
  harness.documentEvents.fire("visibilitychange");
  await Promise.resolve();
  assert.equal(harness.calls.update, 2);
});

test("service worker uses explicit activation and revalidation without caching private data", () => {
  assert.match(workerSource, /pwa-shell-v8/);
  assert.match(workerSource, /event\.waitUntil\(self\.skipWaiting\(\)\)/);
  assert.match(workerSource, /fetch\(request, \{ cache: "no-cache" \}\)/);
  assert.doesNotMatch(workerSource, /"\/app\.html/);
  assert.doesNotMatch(workerSource, /"\/config\.js/);
  assert.doesNotMatch(workerSource, /supabase/i);
  assert.match(workflowSource, /pwa-update\.css/);
  assert.match(workflowSource, /pwa-install\.js/);
  assert.match(workflowSource, /pwa-install\.css/);
});

test("saved persistent settings are marked clean after successful writes", () => {
  assert.match(applicationSource, /markFormClean\("#workspaceCurrencySettingsForm"\)/);
  assert.match(applicationSource, /markFormClean\("#adminCurrencySettingsForm"\)/);
});
