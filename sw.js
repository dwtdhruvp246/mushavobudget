const CACHE_PREFIX = "mushavo-budget-";
const STATIC_CACHE = `${CACHE_PREFIX}pwa-shell-v10`;
const OFFLINE_URL = "/offline.html";
const DEFAULT_NOTIFICATION_TARGET = "/app.html#family/dashboard";
const ALLOWED_NOTIFICATION_TARGETS = new Set([
  DEFAULT_NOTIFICATION_TARGET,
  "/app.html#family/payments",
  "/app.html#family/settings"
]);
const SAFE_SHELL = [
  "/app-entry.html",
  OFFLINE_URL,
  "/app-entry.js?v=1",
  "/pwa-shell.css?v=2",
  "/pwa-update.css?v=1",
  "/pwa-install.css?v=1",
  "/pwa-install.js?v=1",
  "/pwa.js?v=7",
  "/assets/mushavo-budget-logo.png",
  "/assets/pwa-icon-192.png",
  "/assets/pwa-icon-512.png",
  "/assets/pwa-icon-maskable-512.png",
  "/assets/apple-touch-icon.png"
];

const SAFE_SHELL_PATHS = new Set(SAFE_SHELL.map((url) => new URL(url, self.location.origin).pathname));
const NEVER_CACHE_PATH_PREFIXES = [
  "/auth/",
  "/rest/",
  "/storage/",
  "/functions/",
  "/realtime/"
];

function isSensitiveRequest(url) {
  return NEVER_CACHE_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));
}

async function navigationResponse(request) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch (_error) {
    const cache = await caches.open(STATIC_CACHE);
    return (await cache.match(request, { ignoreSearch: true })) ||
      (await cache.match(OFFLINE_URL)) ||
      Response.error();
  }
}

async function revalidatedShellResponse(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch (_error) {
    return (await cache.match(request, { ignoreSearch: true })) || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(SAFE_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") event.waitUntil(self.skipWaiting());
});

function allowedNotificationTarget(value, fallback = DEFAULT_NOTIFICATION_TARGET) {
  const safeFallback = new URL(fallback, self.location.origin);
  if (typeof value !== "string" || !value || value.length > 512) return safeFallback;
  try {
    const target = new URL(value, self.location.origin);
    const route = `${target.pathname}${target.hash}`;
    if (target.origin !== self.location.origin || target.search || !ALLOWED_NOTIFICATION_TARGETS.has(route)) {
      return safeFallback;
    }
    return target;
  } catch (_error) {
    return safeFallback;
  }
}

function notificationDetails(payload) {
  const isTest = payload?.type === "test";
  const fallbackTarget = isTest
    ? "/app.html#family/settings"
    : DEFAULT_NOTIFICATION_TARGET;
  const target = allowedNotificationTarget(payload?.url, fallbackTarget);
  return {
    title: "Mushavo Budget",
    options: {
      body: isTest
        ? "Your payment reminder notifications are connected."
        : "You have a new Mushavo Budget notification.",
      icon: "/assets/pwa-icon-192.png",
      badge: "/assets/pwa-icon-192.png",
      tag: isTest ? "mushavo-budget-test-push" : "mushavo-budget-notification",
      renotify: false,
      timestamp: Date.now(),
      data: {
        type: isTest ? "test" : "notification",
        url: `${target.pathname}${target.hash}`
      }
    }
  };
}

async function setWorkerBadge(count) {
  if (typeof navigator.setAppBadge !== "function") return;
  try {
    await navigator.setAppBadge(Math.max(1, Number(count) || 1));
  } catch (_error) {
    // Badges are progressive enhancement and must never block a notification.
  }
}

async function clearWorkerBadge() {
  try {
    if (typeof navigator.clearAppBadge === "function") {
      await navigator.clearAppBadge();
    } else if (typeof navigator.setAppBadge === "function") {
      await navigator.setAppBadge(0);
    }
  } catch (_error) {
    // Unsupported or rejected badge operations do not block click routing.
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data?.json?.() || {};
  } catch (_error) {
    // Always display a safe notification even if a provider payload is malformed.
  }
  const notification = notificationDetails(payload);
  event.waitUntil(Promise.all([
    self.registration.showNotification(notification.title, notification.options),
    setWorkerBadge(1)
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification?.close?.();
  const target = allowedNotificationTarget(event.notification?.data?.url);
  event.waitUntil((async () => {
    await clearWorkerBadge();
    const windowClients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true
    });
    const appClient = windowClients.find((client) => {
      try {
        const clientUrl = new URL(client.url);
        return clientUrl.origin === self.location.origin &&
          ["/app.html", "/app-entry.html"].includes(clientUrl.pathname);
      } catch (_error) {
        return false;
      }
    });

    if (!appClient) return self.clients.openWindow(target.href);
    let focusedClient = appClient;
    if (typeof appClient.navigate === "function" && appClient.url !== target.href) {
      try {
        focusedClient = await appClient.navigate(target.href) || appClient;
      } catch (_error) {
        return self.clients.openWindow(target.href);
      }
    }
    return typeof focusedClient.focus === "function"
      ? focusedClient.focus()
      : self.clients.openWindow(target.href);
  })());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (isSensitiveRequest(requestUrl)) return;

  if (event.request.mode === "navigate") {
    event.respondWith(navigationResponse(event.request));
    return;
  }

  if (!SAFE_SHELL_PATHS.has(requestUrl.pathname)) return;
  event.respondWith(revalidatedShellResponse(event.request));
});
