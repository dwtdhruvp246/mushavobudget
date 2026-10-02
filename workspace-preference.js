(() => {
  "use strict";
  const PREFIX = "mushavo-budget:last-workspace:";
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const memory = new Map();
  let nativeWrites = Promise.resolve();

  function key(userId) {
    return typeof userId === "string" && userId && userId !== "guest" ? `${PREFIX}${userId}` : null;
  }
  function decode(value) {
    try {
      const item = JSON.parse(value);
      if (item?.version !== 1 || !["personal", "family", "business"].includes(item.kind)) return null;
      if (item.kind !== "personal" && !UUID.test(item.id || "")) return null;
      if (item.kind === "family" && !UUID.test(item.familyId || "")) return null;
      if (!Number.isSafeInteger(item.savedAt) || item.savedAt < 0) return null;
      return { version: 1, kind: item.kind, id: item.kind === "personal" ? null : item.id,
        familyId: item.kind === "family" ? item.familyId : null, savedAt: item.savedAt };
    } catch (_) { return null; }
  }
  function read(userId) {
    const storageKey = key(userId);
    if (!storageKey) return null;
    try {
      const stored = decode(window.localStorage.getItem(storageKey));
      if (stored) return stored;
    } catch (_) { /* A disabled store must not block the workspace. */ }
    return memory.get(storageKey) || null;
  }
  function cache(storageKey, item) {
    memory.set(storageKey, item);
    try { window.localStorage.setItem(storageKey, JSON.stringify(item)); } catch (_) {}
  }
  function nativeStore() { return window.MushavoNativeWorkspace?.Preferences; }
  function persistNative(storageKey, item) {
    const preferences = nativeStore();
    if (!preferences) return;
    // Serialize rapid switches; a slow earlier write cannot replace the latest one.
    nativeWrites = nativeWrites.then(() => preferences.set({ key: storageKey, value: JSON.stringify(item) })).catch(() => {});
  }
  function remember(userId, workspace) {
    const storageKey = key(userId);
    if (!storageKey) return false;
    const kind = workspace?.workspace_type === "household" ? "family" : workspace?.workspace_type;
    const item = decode(JSON.stringify({ version: 1, kind, id: workspace?.id,
      familyId: workspace?.legacy_family_id, savedAt: Math.max(Date.now(), (read(userId)?.savedAt || 0) + 1) }));
    if (!item) return false;
    const previous = read(userId);
    if (previous?.kind === item.kind && previous.id === item.id && previous.familyId === item.familyId) return true;
    cache(storageKey, item);
    persistNative(storageKey, item);
    return true;
  }
  async function hydrate(userId) {
    const storageKey = key(userId), preferences = nativeStore();
    if (!storageKey || !preferences) return read(userId);
    try {
      await nativeWrites;
      const local = read(userId);
      const native = decode((await preferences.get({ key: storageKey })).value);
      // Read local again because a workspace switch may have completed during get().
      const latest = read(userId) || local;
      if (latest && JSON.stringify(latest) !== JSON.stringify(local)) return latest;
      if (native && (!latest || native.savedAt > latest.savedAt)) cache(storageKey, native);
      else if (latest) persistNative(storageKey, latest);
    } catch (_) { /* Keep the last known preference on bridge failures. */ }
    return read(userId);
  }
  function hasDestination(href = window.location.href) {
    const url = new URL(href);
    return Boolean(url.hash || ["workspace", "family", "plan", "notification_id", "payment_item", "bill", "invitation", "invitation_id", "token", "code", "subscription_payment"].some(name => url.searchParams.has(name)));
  }
  function startup(userId, href = window.location.href) {
    return hasDestination(href) ? null : read(userId);
  }
  function restoredBusinessUrl(id) {
    const url = new URL("./business.html", window.location.href);
    url.searchParams.set("workspace", id);
    url.searchParams.set("restore_workspace", "1");
    url.hash = "business/overview";
    return url.href;
  }
  function personalFallbackUrl() {
    const url = new URL("./app.html", window.location.href);
    url.searchParams.set("workspace_unavailable", "1");
    url.hash = "personal/dashboard";
    return url.href;
  }
  function onResume(callback) {
    const app = window.MushavoNativeWorkspace?.App;
    if (!app) return;
    Promise.resolve(app.addListener("appStateChange", ({ isActive }) => {
      if (isActive) callback();
    })).catch(() => {});
  }
  window.MushavoWorkspace = Object.freeze({ read, remember, hydrate, startup, hasDestination,
    restoredBusinessUrl, personalFallbackUrl, onResume, flush: () => nativeWrites });
})();
