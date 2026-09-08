(() => {
  "use strict";

  const RELEASE = "4.3.0";
  const UPDATE_CHECK_INTERVAL_MS = 15000;
  const RELOAD_FALLBACK_MS = 5000;
  const dirtyForms = new Set();
  let registration = null;
  let pendingWorker = null;
  let dismissedWorker = null;
  let banner = null;
  let updateButton = null;
  let laterButton = null;
  let bannerMessage = null;
  let discardConfirmed = false;
  let reloadRequested = false;
  let reloadStarted = false;
  let reloadFallbackTimer = null;
  let lastUpdateCheck = 0;

  function closestForm(target) {
    if (!target || typeof target.closest !== "function") return null;
    return target.closest("form");
  }

  function formIsActive(form) {
    if (!form || form.dataset?.pwaIgnoreDirty === "true") return false;
    if (form.isConnected === false) return false;
    if (typeof form.closest === "function" && form.closest("[hidden], .hidden")) return false;
    const dialog = typeof form.closest === "function" ? form.closest("dialog") : null;
    return !dialog || Boolean(dialog.open);
  }

  function markDirty(event) {
    const form = closestForm(event.target);
    if (form && formIsActive(form)) dirtyForms.add(form);
  }

  function markFormClean(formOrSelector) {
    const form = typeof formOrSelector === "string"
      ? document.querySelector(formOrSelector)
      : formOrSelector;
    if (form) dirtyForms.delete(form);
  }

  function hasUnsavedChanges() {
    for (const form of dirtyForms) {
      if (formIsActive(form)) return true;
    }
    return false;
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function announceUiState(name) {
    if (typeof window.CustomEvent !== "function" || typeof window.dispatchEvent !== "function") return;
    window.dispatchEvent(new window.CustomEvent(name));
  }

  function ensureBanner() {
    if (banner) return banner;

    banner = createElement("aside", "pwa-update-banner pwa-update-hidden");
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");
    banner.setAttribute("aria-label", "Mushavo Budget update");

    const copy = createElement("div", "pwa-update-copy");
    copy.append(createElement("strong", "", "New Mushavo Budget update available"));
    bannerMessage = createElement("p", "", "Reload the page to use the latest version.");
    copy.append(bannerMessage);

    const actions = createElement("div", "pwa-update-actions");
    updateButton = createElement("button", "pwa-update-primary", "Reload page");
    updateButton.type = "button";
    laterButton = createElement("button", "pwa-update-secondary", "Later");
    laterButton.type = "button";
    actions.append(updateButton, laterButton);
    banner.append(copy, actions);
    document.body.append(banner);

    updateButton.addEventListener("click", handleUpdateRequest);
    laterButton.addEventListener("click", dismissUpdate);
    return banner;
  }

  function resetBannerCopy() {
    discardConfirmed = false;
    if (!bannerMessage || !updateButton || !laterButton) return;
    bannerMessage.textContent = "Reload the page to use the latest version.";
    updateButton.textContent = "Reload page";
    updateButton.disabled = false;
    laterButton.textContent = "Later";
    laterButton.disabled = false;
  }

  function showUpdate(worker) {
    if (!worker || worker === dismissedWorker) return;
    pendingWorker = worker;
    ensureBanner();
    resetBannerCopy();
    banner.classList.remove("pwa-update-hidden");
    announceUiState("mushavo:pwa-update-visible");
  }

  function dismissUpdate() {
    if (discardConfirmed) {
      resetBannerCopy();
      return;
    }
    dismissedWorker = pendingWorker;
    banner?.classList.add("pwa-update-hidden");
    announceUiState("mushavo:pwa-update-hidden");
  }

  function reloadPageOnce() {
    if (!reloadRequested || reloadStarted) return;
    reloadStarted = true;
    if (reloadFallbackTimer) window.clearTimeout(reloadFallbackTimer);
    window.location.reload();
  }

  function beginUpdate() {
    if (!pendingWorker) return;
    reloadRequested = true;
    updateButton.disabled = true;
    laterButton.disabled = true;
    updateButton.textContent = "Reloading…";
    bannerMessage.textContent = "Applying the update and reloading Mushavo Budget.";
    pendingWorker.addEventListener("statechange", () => {
      if (pendingWorker?.state === "activated") reloadPageOnce();
    });
    try {
      pendingWorker.postMessage({ type: "SKIP_WAITING" });
    } finally {
      reloadFallbackTimer = window.setTimeout(reloadPageOnce, RELOAD_FALLBACK_MS);
    }
  }

  function handleUpdateRequest() {
    if (hasUnsavedChanges() && !discardConfirmed) {
      discardConfirmed = true;
      bannerMessage.textContent = "You have unsaved changes. Updating will discard them.";
      updateButton.textContent = "Update and discard changes";
      laterButton.textContent = "Keep editing";
      return;
    }
    beginUpdate();
  }

  function observeInstallingWorker(worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && navigator.serviceWorker.controller) showUpdate(worker);
    });
  }

  function watchRegistration(activeRegistration) {
    if (activeRegistration.waiting) showUpdate(activeRegistration.waiting);
    activeRegistration.addEventListener("updatefound", () => {
      observeInstallingWorker(activeRegistration.installing);
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
      // A failed update check must not interrupt the online app.
    }
  }

  async function registerServiceWorker() {
    const register = typeof window.__MUSHAVO_PWA_REGISTER__ === "function"
      ? window.__MUSHAVO_PWA_REGISTER__
      : navigator.serviceWorker.register.bind(navigator.serviceWorker);
    registration = await register("/sw.js", {
      scope: "/",
      updateViaCache: "none"
    });
    watchRegistration(registration);
    await checkForUpdate(true);
    return registration;
  }

  document.addEventListener("input", markDirty, true);
  document.addEventListener("change", markDirty, true);
  document.addEventListener("reset", (event) => {
    const form = closestForm(event.target) || event.target;
    window.setTimeout(() => markFormClean(form), 0);
  }, true);
  window.addEventListener("beforeunload", (event) => {
    if (reloadRequested || !hasUnsavedChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  const api = {
    release: RELEASE,
    checkForUpdate: () => checkForUpdate(true),
    hasUnsavedChanges,
    markFormClean
  };
  window.MushavoPWA = Object.freeze(api);

  document.querySelectorAll("[data-pwa-release]").forEach((element) => {
    element.textContent = `Version ${RELEASE}`;
  });

  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    reloadPageOnce();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });

  window.addEventListener("online", () => checkForUpdate(true));
  window.addEventListener("load", () => {
    window.__MUSHAVO_PWA_READY__ = registerServiceWorker().catch(() => null);
  }, { once: true });
})();
