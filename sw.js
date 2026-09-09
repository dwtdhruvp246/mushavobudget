const CACHE_PREFIX = "mushavo-budget-";
const STATIC_CACHE = `${CACHE_PREFIX}pwa-shell-v16`;
const APP_ENTRY_URL = "/app-entry.html";
const OFFLINE_URL = "/offline.html";
const OFFLINE_ENTRY_CACHE_KEY = "/__mushavo-budget-offline/app-entry";
const OFFLINE_PAGE_CACHE_KEY = "/__mushavo-budget-offline/page";
const DEFAULT_NOTIFICATION_TITLE = "Mushavo Budget";
const DEFAULT_NOTIFICATION_BODY = "You have a new Mushavo Budget notification.";
const DEFAULT_NOTIFICATION_TARGET = "/app.html?source=push#family/payments";
const NOTIFICATION_ICON = "/assets/pwa-icon-192.png";
const NOTIFICATION_BADGE = "/assets/pwa-icon-192.png";
const ALLOWED_NOTIFICATION_PATHS = new Set(["/app.html"]);
const ALLOWED_NOTIFICATION_HASHES = new Set([
  "#family/dashboard",
  "#family/payments",
  "#family/settings"
]);
const APP_ENTRY_PATHS = new Set(["/app-entry", "/app-entry.html"]);
const APP_WINDOW_PATHS = new Set(["/app", "/app.html", "/app-entry", "/app-entry.html"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SAFE_SHELL = [
  "/app-entry.js?v=1",
  "/pwa-shell.css?v=2",
  "/pwa-update.css?v=1",
  "/pwa-install.css?v=1",
  "/pwa-install.js?v=1",
  "/pwa.js?v=12",
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

function boundedText(value, fallback, maximumLength) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized ? normalized.slice(0, maximumLength) : fallback;
}

function safeNotificationTag(value, fallback) {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9:_-]{0,95}$/i.test(normalized) ? normalized : fallback;
}

function safeNotificationTimestamp(value) {
  const candidate = typeof value === "number" ? value : Date.parse(String(value || ""));
  return Number.isFinite(candidate) && candidate > 0 ? candidate : Date.now();
}

function safeNotificationTarget(value) {
  const fallback = new URL(DEFAULT_NOTIFICATION_TARGET, self.location.origin);
  if (typeof value !== "string" || !value.trim()) return fallback.href;

  try {
    const requested = new URL(value, self.location.origin);
    if (requested.origin !== self.location.origin || !ALLOWED_NOTIFICATION_PATHS.has(requested.pathname)) {
      return fallback.href;
    }

    const target = new URL(requested.pathname, self.location.origin);
    target.searchParams.set("source", "push");

    const paymentItemId = requested.searchParams.get("payment_item");
    const isPaymentReminder = paymentItemId && UUID_PATTERN.test(paymentItemId);
    if (isPaymentReminder) {
      target.searchParams.set("payment_item", paymentItemId);
      const paymentDueDate = requested.searchParams.get("payment_due_date");
      if (paymentDueDate && DATE_PATTERN.test(paymentDueDate)) {
        target.searchParams.set("payment_due_date", paymentDueDate);
      }
    }

    const notificationId = requested.searchParams.get("notification_id");
    if (notificationId && UUID_PATTERN.test(notificationId)) {
      target.searchParams.set("notification_id", notificationId);
    }

    target.hash = isPaymentReminder
      ? "#family/payments"
      : ALLOWED_NOTIFICATION_HASHES.has(requested.hash)
        ? requested.hash
        : "#family/settings";
    return target.href;
  } catch (_error) {
    return fallback.href;
  }
}

function notificationDetails(eventData) {
  let payload = {};
  try {
    const parsed = eventData?.json?.();
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed;
  } catch (_error) {
    // A malformed provider payload falls back to private, non-financial copy.
  }

  const isTest = payload.type === "test";
  const fallbackBody = isTest
    ? "Your payment reminder notifications are connected."
    : DEFAULT_NOTIFICATION_BODY;
  const fallbackTag = isTest ? "mushavo-budget-test-push" : "mushavo-budget-notification";

  return {
    title: boundedText(payload.title, DEFAULT_NOTIFICATION_TITLE, 80),
    options: {
      body: boundedText(payload.body, fallbackBody, 240),
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_BADGE,
      tag: safeNotificationTag(payload.tag, fallbackTag),
      timestamp: safeNotificationTimestamp(payload.timestamp || payload.sent_at),
      renotify: false,
      data: {
        targetUrl: safeNotificationTarget(payload.target_url || payload.url),
        type: boundedText(payload.type, "notification", 40)
      }
    }
  };
}

async function showPushNotification(eventData) {
  const { title, options } = notificationDetails(eventData);
  await self.registration.showNotification(title, options);
  if (typeof self.navigator?.setAppBadge === "function") {
    try {
      await self.navigator.setAppBadge(1);
    } catch (_error) {
      // Badging is an optional enhancement and must never block a push.
    }
  }
}

async function openNotificationTarget(value) {
  const target = new URL(safeNotificationTarget(value), self.location.origin);
  if (typeof self.navigator?.clearAppBadge === "function") {
    try {
      await self.navigator.clearAppBadge();
    } catch (_error) {
      // The application recalculates the badge after it opens.
    }
  }

  const windowClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windowClients) {
    let clientUrl;
    try {
      clientUrl = new URL(client.url);
    } catch (_error) {
      continue;
    }
    if (clientUrl.origin !== self.location.origin || !APP_WINDOW_PATHS.has(clientUrl.pathname)) continue;

    try {
      const focusedClient = typeof client.navigate === "function"
        ? (await client.navigate(target.href)) || client
        : client;
      await focusedClient.focus();
      return;
    } catch (_error) {
      // If the existing window cannot navigate, open a fresh authorized route.
    }
  }

  const openedClient = await self.clients.openWindow(target.href);
  if (openedClient && typeof openedClient.focus === "function") await openedClient.focus();
}

async function navigationResponse(request) {
  try {
    return await fetch(request, { cache: "no-store" });
  } catch (_error) {
    const cache = await caches.open(STATIC_CACHE);
    const requestUrl = new URL(request.url);
    const offlineCacheKey = APP_ENTRY_PATHS.has(requestUrl.pathname)
      ? OFFLINE_ENTRY_CACHE_KEY
      : OFFLINE_PAGE_CACHE_KEY;
    return (await cache.match(offlineCacheKey)) ||
      Response.error();
  }
}

async function cacheStaticShell() {
  const cache = await caches.open(STATIC_CACHE);
  const [entryResponse, offlineResponse] = await Promise.all([
    fetch(APP_ENTRY_URL, { cache: "no-cache" }),
    fetch(OFFLINE_URL, { cache: "no-cache" })
  ]);
  if (!entryResponse.ok || !offlineResponse.ok) {
    throw new Error("PWA_OFFLINE_SHELL_FETCH_FAILED");
  }
  await Promise.all([
    cache.addAll(SAFE_SHELL),
    cache.put(OFFLINE_ENTRY_CACHE_KEY, entryResponse),
    cache.put(OFFLINE_PAGE_CACHE_KEY, offlineResponse)
  ]);
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
  event.waitUntil(cacheStaticShell());
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

self.addEventListener("push", (event) => {
  event.waitUntil(showPushNotification(event.data));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openNotificationTarget(event.notification.data?.targetUrl));
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
