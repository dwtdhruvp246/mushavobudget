(() => {
  "use strict";

  const RELEASE = "4.7.8";
  const WORKER_URL = "/sw.js?v=41";
  const UPDATE_CHECK_INTERVAL_MS = 15000;
  const dirtyForms = new Set();
  const operations = new Set();
  let registration = null;
  let pendingWorker = null;
  let controllerChanged = false;
  let refreshRequested = false;
  let updateBanner = null;
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
  }
  function hasUnsavedChanges() {
    return [...dirtyForms].some(formIsActive);
  }
  function beginOperation() {
    const token = {};
    operations.add(token);
    return () => {
      operations.delete(token);
    };
  }

  function createUpdateBanner() {
    if (updateBanner) return updateBanner;
    const banner = document.createElement("aside");
    banner.className = "pwa-update-banner pwa-update-hidden";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    const copy = document.createElement("div");
    copy.className = "pwa-update-copy";
    const title = document.createElement("strong");
    title.textContent = "A new version is ready";
    const message = document.createElement("p");
    message.textContent = "Refresh the page to use the latest version. This notice will remain until you refresh.";
    copy.append(title, message);

    const actions = document.createElement("div");
    actions.className = "pwa-update-actions";
    const refreshButton = document.createElement("button");
    refreshButton.type = "button";
    refreshButton.className = "pwa-update-primary";
    refreshButton.textContent = "Refresh page";
    refreshButton.addEventListener("click", requestPageRefresh);
    actions.append(refreshButton);
    banner.append(copy, actions);
    document.body.append(banner);
    updateBanner = banner;
    return banner;
  }

  function showUpdateNotice(worker = null) {
    if (worker) pendingWorker = worker;
    const banner = createUpdateBanner();
    if (!banner.classList.contains("pwa-update-hidden")) return;
    banner.classList.remove("pwa-update-hidden");
    window.dispatchEvent(new window.Event("mushavo:pwa-update-visible"));
  }

  function requestPageRefresh() {
    refreshRequested = true;
    if (controllerChanged || !pendingWorker) {
      window.location.reload();
      return;
    }
    try {
      pendingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch (_error) {
      window.location.reload();
    }
  }

  function showUpdate(worker) {
    if (!worker) return;
    showUpdateNotice(worker);
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
  window.addEventListener("beforeunload", (event) => {
    if (!hasUnsavedChanges() && operations.size === 0) return;
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
      showUpdateNotice();
      if (refreshRequested) window.location.reload();
    }
    hadController = Boolean(navigator.serviceWorker.controller);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdate();
    }
  });
  window.addEventListener("online", () => checkForUpdate(true));
  window.addEventListener("load", () => {
    window.__MUSHAVO_PWA_READY__ = registerServiceWorker().catch(() => null);
    window.setInterval(() => {
      if (document.visibilityState === "visible") checkForUpdate();
    }, UPDATE_CHECK_INTERVAL_MS);
  }, { once: true });
})();
