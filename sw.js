const CACHE_PREFIX = "mushavo-budget-";
const STATIC_CACHE = `${CACHE_PREFIX}pwa-shell-v4`;
const OFFLINE_URL = "/offline.html";
const SAFE_SHELL = [
  "/app-entry.html",
  OFFLINE_URL,
  "/app-entry.js?v=1",
  "/pwa-shell.css?v=2",
  "/pwa-update.css?v=1",
  "/pwa.js?v=2",
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
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
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
