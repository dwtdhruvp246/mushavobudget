(() => {
  if (!("serviceWorker" in navigator) || window.location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none"
    }).catch(() => {
      // Service-worker support is optional; the online website remains usable.
    });
  }, { once: true });
})();
