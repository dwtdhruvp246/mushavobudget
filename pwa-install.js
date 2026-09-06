(() => {
  "use strict";

  const DISMISSED_KEY = "mushavo-pwa-install-promo-dismissed-v1";
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)");
  const isIos = /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints) > 1);
  const isAndroid = /Android/i.test(navigator.userAgent);
  let deferredPrompt = null;
  let installed = Boolean(standaloneMedia?.matches || navigator.standalone === true);
  let promo = null;
  let promoMessage = null;
  let promoAction = null;
  let guideDialog = null;
  let guideTitle = null;
  let guideCopy = null;
  let guideSteps = null;
  let promoSuppressedByUpdate = false;

  function storageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function storageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      // Installation remains available if browser storage is blocked.
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function createInstallButton(className = "") {
    const button = createElement("button", `pwa-install-trigger ${className}`.trim(), "Install app");
    button.type = "button";
    button.hidden = true;
    button.setAttribute("data-open-install-guide", "");
    button.addEventListener("click", openInstallExperience);
    return button;
  }

  function addPermanentTriggers() {
    document.querySelectorAll(".site-actions").forEach((actions) => {
      if (!actions.querySelector("[data-open-install-guide]")) {
        actions.prepend(createInstallButton("text-link"));
      }
    });

    const authForm = document.querySelector("#authForm");
    if (authForm && !authForm.querySelector("[data-open-install-guide]")) {
      const homeLink = authForm.querySelector(".auth-home-link");
      authForm.insertBefore(createInstallButton("auth-home-link"), homeLink || null);
    }

    const signupActions = document.querySelector("#signupForm .button-row");
    if (signupActions && !signupActions.querySelector("[data-open-install-guide]")) {
      signupActions.append(createInstallButton("button-link"));
    }

    document.querySelectorAll(".sidebar-footer").forEach((footer) => {
      if (!footer.querySelector("[data-open-install-guide]")) {
        footer.prepend(createInstallButton());
      }
    });
  }

  function triggers() {
    return [...document.querySelectorAll("[data-open-install-guide]")];
  }

  function canOfferInstall() {
    return !installed && Boolean(deferredPrompt || isIos || isAndroid);
  }

  function refreshTriggers() {
    const available = canOfferInstall();
    triggers().forEach((button) => {
      button.hidden = !available;
    });
  }

  function ensurePromo() {
    if (promo) return promo;
    promo = createElement("aside", "pwa-install-banner pwa-install-hidden");
    promo.setAttribute("role", "status");
    promo.setAttribute("aria-live", "polite");
    promo.setAttribute("aria-label", "Install Mushavo Budget");

    const icon = createElement("img", "pwa-install-icon");
    icon.src = "/assets/pwa-icon-192.png";
    icon.alt = "";
    icon.width = 52;
    icon.height = 52;

    const copy = createElement("div", "pwa-install-copy");
    copy.append(createElement("strong", "", "Install Mushavo Budget"));
    promoMessage = createElement("p");
    copy.append(promoMessage);

    const actions = createElement("div", "pwa-install-actions");
    promoAction = createElement("button", "pwa-install-primary");
    promoAction.type = "button";
    promoAction.addEventListener("click", openInstallExperience);
    const dismiss = createElement("button", "pwa-install-secondary", "Not now");
    dismiss.type = "button";
    dismiss.addEventListener("click", dismissPromo);
    actions.append(promoAction, dismiss);
    promo.append(icon, copy, actions);
    document.body.append(promo);
    return promo;
  }

  function showPromo() {
    if (!canOfferInstall() || promoSuppressedByUpdate || storageGet(DISMISSED_KEY) === "true") return;
    ensurePromo();
    promoMessage.textContent = isIos
      ? "Add it to your Home Screen for quicker access."
      : "Keep your budget one tap away and open it in its own app window.";
    promoAction.textContent = deferredPrompt ? "Install app" : "View steps";
    promo.classList.remove("pwa-install-hidden");
  }

  function dismissPromo() {
    storageSet(DISMISSED_KEY, "true");
    promo?.classList.add("pwa-install-hidden");
  }

  function ensureGuideDialog() {
    if (guideDialog) return guideDialog;
    guideDialog = createElement("dialog", "pwa-install-dialog");
    guideDialog.setAttribute("aria-labelledby", "pwaInstallGuideTitle");
    const header = createElement("div", "pwa-install-dialog-header");
    const heading = createElement("div");
    heading.append(createElement("span", "pwa-install-eyebrow", "Install Mushavo Budget"));
    guideTitle = createElement("h2");
    guideTitle.id = "pwaInstallGuideTitle";
    heading.append(guideTitle);
    const close = createElement("button", "pwa-install-dialog-close", "Close");
    close.type = "button";
    close.addEventListener("click", closeGuide);
    header.append(heading, close);
    guideCopy = createElement("p", "pwa-install-dialog-copy");
    guideSteps = createElement("ol", "pwa-install-steps");
    const done = createElement("button", "pwa-install-dialog-done", "Done");
    done.type = "button";
    done.addEventListener("click", closeGuide);
    guideDialog.append(header, guideCopy, guideSteps, done);
    guideDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeGuide();
    });
    document.body.append(guideDialog);
    return guideDialog;
  }

  function setGuideSteps(items) {
    guideSteps.replaceChildren(...items.map((text, index) => {
      const item = createElement("li");
      item.append(createElement("span", "", String(index + 1)), createElement("p", "", text));
      return item;
    }));
  }

  function showManualGuide() {
    ensureGuideDialog();
    if (isIos) {
      guideTitle.textContent = "Add to your Home Screen";
      guideCopy.textContent = "Your iPhone or iPad installs Mushavo Budget through the browser Share menu.";
      setGuideSteps([
        "Tap the Share button in your browser toolbar.",
        "Choose Add to Home Screen.",
        "Confirm the name Mushavo Budget, then tap Add."
      ]);
    } else {
      guideTitle.textContent = "Install from your browser menu";
      guideCopy.textContent = "Your browser did not provide its automatic install window. You can still install Mushavo Budget manually.";
      setGuideSteps([
        "Open your browser menu.",
        "Choose Install app or Add to Home Screen.",
        "Confirm Install."
      ]);
    }
    if (typeof guideDialog.showModal === "function") guideDialog.showModal();
    else guideDialog.setAttribute("open", "");
  }

  function closeGuide() {
    if (!guideDialog) return;
    if (typeof guideDialog.close === "function") guideDialog.close();
    else guideDialog.removeAttribute("open");
  }

  async function requestNativeInstall() {
    const promptEvent = deferredPrompt;
    if (!promptEvent) {
      showManualGuide();
      return;
    }
    deferredPrompt = null;
    promo?.classList.add("pwa-install-hidden");
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === "accepted") finishInstallation();
    else refreshTriggers();
  }

  function openInstallExperience() {
    if (installed) return;
    if (deferredPrompt) requestNativeInstall().catch(showManualGuide);
    else showManualGuide();
  }

  function finishInstallation() {
    installed = true;
    deferredPrompt = null;
    promo?.classList.add("pwa-install-hidden");
    closeGuide();
    refreshTriggers();
  }

  addPermanentTriggers();
  refreshTriggers();
  if (isIos && !installed) showPromo();

  window.addEventListener("beforeinstallprompt", (event) => {
    if (installed) return;
    event.preventDefault();
    deferredPrompt = event;
    refreshTriggers();
    showPromo();
  });
  window.addEventListener("appinstalled", finishInstallation);
  standaloneMedia?.addEventListener?.("change", (event) => {
    if (event.matches) finishInstallation();
  });
  window.addEventListener("mushavo:pwa-update-visible", () => {
    promoSuppressedByUpdate = Boolean(promo && !promo.classList.contains("pwa-install-hidden"));
    promo?.classList.add("pwa-install-hidden");
  });
  window.addEventListener("mushavo:pwa-update-hidden", () => {
    if (!promoSuppressedByUpdate) return;
    promoSuppressedByUpdate = false;
    showPromo();
  });

  window.MushavoInstall = Object.freeze({
    canOfferInstall,
    isInstalled: () => installed,
    open: openInstallExperience
  });
})();
