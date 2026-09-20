(() => {
  "use strict";

  const RELEASE = "4.6.4";
  const WORKER_URL = "/sw.js?v=27";
  const UPDATE_CHECK_INTERVAL_MS = 15000;
  const dirtyForms = new Set();
  const operations = new Set();
  let registration = null;
  let pendingWorker = null;
  let activationRequested = false;
  let controllerChanged = false;
  let reloadStarted = false;
  let retryTimer = null;
  let lastUpdateCheck = 0;
  let hadController = Boolean(navigator.serviceWorker?.controller);

  function closestForm(target) {
    return target?.closest?.("form") || null;
  }
  function formIsActive(form) {
    if (!form || form.dataset?.pwaIgnoreDirty === "true" || form.isConnected === false) return false;
    if (form.closest?.("[hidden], .hidden")) return false;
    const dialog = form.closest?.("dialog");
    return !dialog || Boolean(dialog.open);
  }
  function markDirty(event) {
    const form = closestForm(event.target);
    if (form && formIsActive(form)) dirtyForms.add(form);
  }
  function markFormClean(formOrSelector) {
    const form = typeof formOrSelector === "string" ? document.querySelector(formOrSelector) : formOrSelector;
    if (form) dirtyForms.delete(form);
    scheduleUpdate();
  }
  function hasUnsavedChanges() {
    return [...dirtyForms].some(formIsActive);
  }
  function beginOperation() {
    const token = {};
    operations.add(token);
    return () => {
      operations.delete(token);
      scheduleUpdate();
    };
  }
  function safeToReload() {
    return navigator.onLine && document.visibilityState === "visible" &&
      !hasUnsavedChanges() && operations.size === 0 &&
      !document.querySelector('button[disabled][type="submit"], [aria-busy="true"]');
  }
  function scheduleUpdate() {
    if (retryTimer || reloadStarted || (!pendingWorker && !controllerChanged)) return;
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      applyUpdateWhenSafe();
    }, 1000);
  }
  function applyUpdateWhenSafe() {
    if (reloadStarted || (!pendingWorker && !controllerChanged)) return;
    if (!safeToReload()) {
      scheduleUpdate();
      return;
    }
    // Recheck safety after activation, including activation by another tab.
    if (controllerChanged) {
      reloadStarted = true;
      window.location.reload();
      return;
    }
    if (!activationRequested && pendingWorker) {
      activationRequested = true;
      try {
        pendingWorker.postMessage({ type: "SKIP_WAITING" });
      } catch (_error) {
        activationRequested = false;
      }
    }
    // A timer must never force a reload before the new worker controls this page.
    scheduleUpdate();
  }
  function showUpdate(worker) {
    if (!worker) return;
    if (pendingWorker !== worker) activationRequested = false;
    pendingWorker = worker;
    scheduleUpdate();
  }
  function watchRegistration(activeRegistration) {
    if (activeRegistration.waiting) showUpdate(activeRegistration.waiting);
    activeRegistration.addEventListener("updatefound", () => {
      const worker = activeRegistration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
      });
    });
  }
  async function checkForUpdate(force = false) {
    if (!registration || !navigator.onLine) return;
    const now = Date.now();
    if (!force && now - lastUpdateCheck < UPDATE_CHECK_INTERVAL_MS) return;
    lastUpdateCheck = now;
    try {
      await registration.update();
      if (registration.waiting) showUpdate(registration.waiting);
    } catch (_error) {
      // Failed checks must not clear the user's saved session.
    }
  }
  async function registerServiceWorker() {
    const register = window.__MUSHAVO_PWA_REGISTER__ || navigator.serviceWorker.register.bind(navigator.serviceWorker);
    registration = await register(WORKER_URL, { scope: "/", updateViaCache: "none" });
    watchRegistration(registration);
    await checkForUpdate(true);
    return registration;
  }
  document.addEventListener("input", markDirty, true);
  document.addEventListener("change", markDirty, true);
  document.addEventListener("reset", (event) => {
    window.setTimeout(() => markFormClean(closestForm(event.target) || event.target), 0);
  }, true);
  document.addEventListener("close", scheduleUpdate, true);
  window.addEventListener("beforeunload", (event) => {
    if (reloadStarted || (!hasUnsavedChanges() && operations.size === 0)) return;
    event.preventDefault();
    event.returnValue = "";
  });
  window.MushavoPWA = Object.freeze({
    release: RELEASE,
    checkForUpdate: () => checkForUpdate(true),
    hasUnsavedChanges,
    markFormClean,
    beginOperation
  });
  document.querySelectorAll("[data-pwa-release]").forEach((element) => {
    element.textContent = `Version ${RELEASE}`;
  });
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) {
      controllerChanged = true;
      scheduleUpdate();
    }
    hadController = Boolean(navigator.serviceWorker.controller);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdate();
      scheduleUpdate();
    }
  });
  window.addEventListener("online", () => { checkForUpdate(true); scheduleUpdate(); });
  window.addEventListener("load", () => {
    window.__MUSHAVO_PWA_READY__ = registerServiceWorker().catch(() => null);
  }, { once: true });
})();
