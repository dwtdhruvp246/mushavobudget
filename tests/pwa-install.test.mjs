import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../pwa-install.js", import.meta.url), "utf8");
const installCss = await readFile(new URL("../pwa-install.css", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");
const workflowSource = await readFile(new URL("../.github/workflows/pages.yml", import.meta.url), "utf8");
const pageNames = ["index.html", "about.html", "pricing.html", "contact.html", "signup.html", "app.html"];
const pages = await Promise.all(pageNames.map(async (name) => [
  name,
  await readFile(new URL(`../${name}`, import.meta.url), "utf8")
]));

class MockElement {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.listeners = new Map();
    this.attributes = {};
    this.textContent = "";
    this.hidden = false;
    this.open = false;
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

  prepend(...children) {
    this.children.unshift(...children);
  }

  insertBefore(child, reference) {
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "open") this.open = false;
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  dispatch(type, event = {}) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, ...event });
  }

  showModal() {
    this.open = true;
  }

  close() {
    this.open = false;
  }

  querySelector(selector) {
    return findElement(this, (element) => selector === "[data-open-install-guide]" &&
      Object.hasOwn(element.attributes, "data-open-install-guide"));
  }
}

function findElement(root, predicate) {
  if (predicate(root)) return root;
  for (const child of root.children || []) {
    const result = findElement(child, predicate);
    if (result) return result;
  }
  return null;
}

function findElements(root, predicate, results = []) {
  if (predicate(root)) results.push(root);
  for (const child of root.children || []) findElements(child, predicate, results);
  return results;
}

function listenerStore() {
  const listeners = new Map();
  return {
    add(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    fire(type, event = {}) {
      for (const listener of listeners.get(type) || []) listener(event);
    }
  };
}

function createHarness({ userAgent = "Mozilla/5.0", platform = "Linux", touchPoints = 0, standalone = false } = {}) {
  const windowEvents = listenerStore();
  const mediaEvents = listenerStore();
  const body = new MockElement("body");
  const footer = new MockElement("footer");
  footer.className = "sidebar-footer";
  body.append(footer);
  const storage = new Map();
  const media = {
    matches: standalone,
    addEventListener: mediaEvents.add.bind(mediaEvents)
  };
  const document = {
    body,
    createElement: (tag) => new MockElement(tag),
    querySelector(selector) {
      if (selector === "#authForm" || selector === "#signupForm .button-row") return null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector === ".site-actions") return [];
      if (selector === ".sidebar-footer") return [footer];
      if (selector === "[data-open-install-guide]") {
        return findElements(body, (element) => Object.hasOwn(element.attributes, "data-open-install-guide"));
      }
      return [];
    }
  };
  const navigator = { userAgent, platform, maxTouchPoints: touchPoints, standalone };
  const window = {
    document,
    navigator,
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    matchMedia: () => media,
    addEventListener: windowEvents.add.bind(windowEvents)
  };
  vm.runInNewContext(source, { window, document, navigator, Number, Object, Promise, console }, {
    filename: "pwa-install.js"
  });
  return {
    body,
    footer,
    media,
    mediaEvents,
    storage,
    window,
    windowEvents,
    trigger: () => findElement(body, (element) => Object.hasOwn(element.attributes, "data-open-install-guide")),
    promo: () => findElement(body, (element) => element.tagName === "ASIDE"),
    dialog: () => findElement(body, (element) => element.tagName === "DIALOG"),
    button: (text) => findElement(body, (element) => element.tagName === "BUTTON" && element.textContent === text)
  };
}

test("Android native installation is offered only after the browser event and a user click", async () => {
  const harness = createHarness({ userAgent: "Mozilla/5.0 (Linux; Android 15) Chrome/140" });
  let prevented = false;
  let prompts = 0;
  const installEvent = {
    preventDefault() { prevented = true; },
    prompt() { prompts += 1; },
    userChoice: Promise.resolve({ outcome: "accepted" })
  };

  assert.equal(harness.trigger().hidden, false);
  assert.equal(harness.promo(), null);
  assert.equal(prompts, 0);
  harness.windowEvents.fire("beforeinstallprompt", installEvent);
  assert.equal(prevented, true);
  assert.equal(harness.trigger().hidden, false);
  assert.equal(prompts, 0);

  harness.button("Install app").dispatch("click");
  assert.equal(prompts, 1);
  await installEvent.userChoice;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.trigger().hidden, true);
  harness.trigger().dispatch("click");
  assert.equal(prompts, 1, "the consumed native prompt must not be reused");
});

test("iPhone and iPad users receive the correct manual Home Screen steps", () => {
  const harness = createHarness({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone" });
  assert.equal(harness.trigger().hidden, false);
  assert.equal(harness.promo().classList.contains("pwa-install-hidden"), false);

  harness.button("View steps").dispatch("click");
  assert.equal(harness.dialog().open, true);
  const dialogText = findElements(harness.dialog(), () => true).map((element) => element.textContent).join(" ");
  assert.match(dialogText, /Share button/);
  assert.match(dialogText, /Add to Home Screen/);
  assert.match(dialogText, /Mushavo Budget/);
});

test("dismissing the promotion keeps installation available from the permanent menu control", () => {
  const harness = createHarness({ userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)", platform: "iPad" });
  harness.button("Not now").dispatch("click");
  assert.equal(harness.promo().classList.contains("pwa-install-hidden"), true);
  assert.equal(harness.trigger().hidden, false);
  assert.equal(harness.storage.get("mushavo-pwa-install-promo-dismissed-v1"), "true");
});

test("standalone and newly installed users do not see install controls", () => {
  const standalone = createHarness({ userAgent: "Mozilla/5.0 (Linux; Android 15)", standalone: true });
  assert.equal(standalone.window.MushavoInstall.isInstalled(), true);
  assert.equal(standalone.trigger().hidden, true);
  assert.equal(standalone.promo(), null);

  const browser = createHarness({ userAgent: "Mozilla/5.0 (Linux; Android 15)" });
  browser.windowEvents.fire("beforeinstallprompt", {
    preventDefault() {},
    prompt() {},
    userChoice: Promise.resolve({ outcome: "accepted" })
  });
  assert.equal(browser.trigger().hidden, false);
  browser.windowEvents.fire("appinstalled");
  assert.equal(browser.trigger().hidden, true);
  assert.equal(browser.promo().classList.contains("pwa-install-hidden"), true);
});

test("the install promotion yields to the update banner and returns after it closes", () => {
  const harness = createHarness({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", platform: "iPhone" });
  assert.equal(harness.promo().classList.contains("pwa-install-hidden"), false);
  harness.windowEvents.fire("mushavo:pwa-update-visible");
  assert.equal(harness.promo().classList.contains("pwa-install-hidden"), true);
  harness.windowEvents.fire("mushavo:pwa-update-hidden");
  assert.equal(harness.promo().classList.contains("pwa-install-hidden"), false);
});

test("all user-facing pages and the deployment shell include Stage 4 assets", () => {
  for (const [name, page] of pages) {
    assert.match(page, /\/pwa-install\.css\?v=1/, `${name} is missing install styles`);
    assert.match(page, /\/pwa-install\.js\?v=1/, `${name} is missing install logic`);
    assert.match(page, /\/pwa\.js\?v=7/, `${name} is missing the current release helper`);
  }
  assert.match(workerSource, /pwa-shell-v10/);
  assert.match(workerSource, /"\/pwa-install\.js\?v=1"/);
  assert.match(workerSource, /"\/pwa-install\.css\?v=1"/);
  assert.match(workflowSource, /pwa-install\.js/);
  assert.match(workflowSource, /pwa-install\.css/);
  assert.match(installCss, /pwa-install-trigger\[hidden\]/);
  assert.match(installCss, /env\(safe-area-inset-bottom\)/);
});
