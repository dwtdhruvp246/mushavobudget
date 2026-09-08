(() => {
  "use strict";

  function isIosDevice(navigatorLike = navigator) {
    return /iPad|iPhone|iPod/i.test(navigatorLike.userAgent || "") ||
      (navigatorLike.platform === "MacIntel" && Number(navigatorLike.maxTouchPoints) > 1);
  }

  function isStandalone(windowLike = window, navigatorLike = navigator) {
    return Boolean(
      navigatorLike.standalone === true ||
      windowLike.matchMedia?.("(display-mode: standalone)")?.matches
    );
  }

  function supportStatus(windowLike = window, navigatorLike = navigator) {
    if (!windowLike.isSecureContext) {
      return { supported: false, code: "insecure" };
    }
    if (!("serviceWorker" in navigatorLike)) {
      return { supported: false, code: "service-worker" };
    }
    if (!("PushManager" in windowLike)) {
      return { supported: false, code: "push-api" };
    }
    if (!("Notification" in windowLike)) {
      return { supported: false, code: "notifications-api" };
    }
    if (isIosDevice(navigatorLike) && !isStandalone(windowLike, navigatorLike)) {
      return { supported: false, code: "ios-install-required" };
    }
    return { supported: true, code: "supported" };
  }

  function base64UrlToUint8Array(value) {
    const normalized = String(value || "").trim().replace(/-/g, "+").replace(/_/g, "/");
    if (!normalized) throw new Error("VAPID_PUBLIC_KEY_MISSING");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = atob(normalized + padding);
    return Uint8Array.from(bytes, (character) => character.charCodeAt(0));
  }

  function subscriptionPayload(subscription) {
    const serialized = subscription?.toJSON?.() || {};
    const endpoint = String(serialized.endpoint || subscription?.endpoint || "").trim();
    const p256dh = String(serialized.keys?.p256dh || "").trim();
    const auth = String(serialized.keys?.auth || "").trim();
    if (!endpoint || !p256dh || !auth) throw new Error("PUSH_SUBSCRIPTION_INVALID");
    return { endpoint, p256dh, auth };
  }

  function deviceLabel(navigatorLike = navigator, windowLike = window) {
    const agent = navigatorLike.userAgent || "";
    let platform = "Browser";
    if (isIosDevice(navigatorLike)) platform = /iPad/i.test(agent) ? "iPad" : "iPhone";
    else if (/Android/i.test(agent)) platform = "Android";
    else if (/Windows/i.test(agent)) platform = "Windows";
    else if (/Macintosh|Mac OS X/i.test(agent)) platform = "Mac";
    else if (/Linux/i.test(agent)) platform = "Linux";
    return `${platform}${isStandalone(windowLike, navigatorLike) ? " app" : " browser"}`.slice(0, 100);
  }

  function isEndpointConflict(error) {
    const text = `${error?.code || ""} ${error?.message || error || ""}`.toLowerCase();
    return text.includes("23505") && (
      text.includes("push_subscriptions_endpoint") ||
      text.includes("push_subscriptions_endpoint_unique_idx") ||
      text.includes("endpoint")
    );
  }

  async function syncAppBadge(navigatorLike = navigator, count = 0) {
    const numericCount = Number(count);
    const badgeCount = Number.isFinite(numericCount)
      ? Math.max(0, Math.min(99, Math.floor(numericCount)))
      : 0;
    try {
      if (badgeCount > 0 && typeof navigatorLike.setAppBadge === "function") {
        await navigatorLike.setAppBadge(badgeCount);
        return true;
      }
      if (badgeCount === 0 && typeof navigatorLike.clearAppBadge === "function") {
        await navigatorLike.clearAppBadge();
        return true;
      }
      if (badgeCount === 0 && typeof navigatorLike.setAppBadge === "function") {
        await navigatorLike.setAppBadge(0);
        return true;
      }
    } catch (_error) {
      // Badge support is optional and must not interrupt the app.
    }
    return false;
  }

  window.MushavoPushSupport = Object.freeze({
    base64UrlToUint8Array,
    deviceLabel,
    isEndpointConflict,
    isIosDevice,
    isStandalone,
    syncAppBadge,
    subscriptionPayload,
    supportStatus
  });
})();
