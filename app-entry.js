(() => {
  "use strict";

  const CLIENT_VERSION = "2.110.9";
  const CHECK_TIMEOUT_MS = 12000;
  const elements = {
    shell: document.getElementById("entryShell"),
    eyebrow: document.getElementById("entryEyebrow"),
    title: document.getElementById("entryTitle"),
    copy: document.getElementById("entryCopy"),
    progress: document.getElementById("entryProgress"),
    actions: document.getElementById("entryActions"),
    retry: document.getElementById("entryRetry"),
    signIn: document.getElementById("entrySignIn")
  };

  function appUrl(authState) {
    const url = new URL("./app.html", window.location.href);
    url.searchParams.set("source", "pwa");
    if (authState) url.searchParams.set("auth", authState);
    return url.href;
  }

  function showState({ eyebrow, title, copy, retry = true, signIn = true }) {
    elements.eyebrow.textContent = eyebrow;
    elements.title.textContent = title;
    elements.copy.textContent = copy;
    elements.progress.classList.add("pwa-hidden");
    elements.actions.classList.remove("pwa-hidden");
    elements.retry.classList.toggle("pwa-hidden", !retry);
    elements.signIn.classList.toggle("pwa-hidden", !signIn);
    elements.signIn.href = appUrl("manual");
    elements.shell.setAttribute("aria-busy", "false");
  }

  function showOffline() {
    showState({
      eyebrow: "You are offline",
      title: "Connect to open your workspace",
      copy: "Mushavo Budget cannot verify your saved sign-in while offline. Reconnect and try again. No financial information is being shown as current.",
      signIn: false
    });
  }

  function isInvalidSessionError(error) {
    const status = Number(error?.status || error?.statusCode || 0);
    const message = String(error?.message || "").toLowerCase();
    return status === 401 || status === 403 ||
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found") ||
      message.includes("jwt") ||
      message.includes("session not found");
  }

  function isNetworkError(error) {
    const message = String(error?.message || error || "").toLowerCase();
    return !navigator.onLine ||
      error instanceof TypeError ||
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("timeout");
  }

  function withTimeout(promise, milliseconds) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error("Session check timeout")), milliseconds);
    });
    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
  }

  function removeStoredSession(projectUrl) {
    let projectRef = "";
    try {
      projectRef = new URL(projectUrl).hostname.split(".")[0];
    } catch (_error) {
      return;
    }

    const prefix = `sb-${projectRef}-auth-token`;
    try {
      Object.keys(window.localStorage)
        .filter((key) => key === prefix || key.startsWith(`${prefix}.`))
        .forEach((key) => window.localStorage.removeItem(key));
    } catch (_error) {
      // Storage may be unavailable. Supabase signOut remains the primary cleanup.
    }
  }

  async function clearInvalidSession(client, projectUrl) {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch (_error) {
      // Continue with project-scoped local cleanup below.
    }
    removeStoredSession(projectUrl);
  }

  async function loadCreateClient() {
    if (typeof window.__MUSHAVO_ENTRY_CREATE_CLIENT__ === "function") {
      return window.__MUSHAVO_ENTRY_CREATE_CLIENT__;
    }
    const module = await import(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${CLIENT_VERSION}/+esm`);
    return module.createClient;
  }

  async function routeFromSession() {
    if (!navigator.onLine) {
      showOffline();
      return;
    }

    const config = window.MUSHAVO_BUDGET_CONFIG || {};
    if (!config.supabaseUrl || !config.supabasePublishableKey) {
      showState({
        eyebrow: "Setup required",
        title: "The app could not start",
        copy: "The public connection settings are unavailable. Try again after the site deployment finishes."
      });
      return;
    }

    try {
      const createClient = await loadCreateClient();
      const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false
        }
      });

      const sessionResult = await withTimeout(client.auth.getSession(), CHECK_TIMEOUT_MS);
      if (sessionResult.error) throw sessionResult.error;

      if (!sessionResult.data?.session) {
        window.location.replace(appUrl("signed-out"));
        return;
      }

      const userResult = await withTimeout(client.auth.getUser(), CHECK_TIMEOUT_MS);
      if (userResult.error) throw userResult.error;
      if (!userResult.data?.user) {
        await clearInvalidSession(client, config.supabaseUrl);
        window.location.replace(appUrl("expired"));
        return;
      }

      window.location.replace(appUrl());
    } catch (error) {
      if (isInvalidSessionError(error)) {
        try {
          const createClient = await loadCreateClient();
          const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
            auth: { persistSession: true, autoRefreshToken: false, detectSessionInUrl: false }
          });
          await clearInvalidSession(client, config.supabaseUrl);
        } catch (_cleanupError) {
          removeStoredSession(config.supabaseUrl);
        }
        window.location.replace(appUrl("expired"));
        return;
      }

      if (isNetworkError(error)) {
        showOffline();
        return;
      }

      console.error("PWA session routing failed", error);
      showState({
        eyebrow: "Loading stopped",
        title: "Mushavo Budget could not open",
        copy: "Your sign-in could not be checked safely. Try again, or continue to the sign-in screen."
      });
    }
  }

  elements.retry.addEventListener("click", () => window.location.reload());
  window.addEventListener("online", () => window.location.reload(), { once: true });
  window.__MUSHAVO_ENTRY_READY__ = routeFromSession();
})();
