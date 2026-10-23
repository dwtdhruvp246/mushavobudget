# Batch O target setup review — 2026-10-23

The owner ran published commit `25d76a3029e9abd009098437b6fa328d543647fa` on Node22.17.0/Windows with Chrome155.0.8059.79. All194 source hashes,44 syntax checks and8 policy units passed. Local browser setup stopped before the first browser assertion and before any intercepted request. The hosted probe was not started. Browser process, temporary profile and localhost fixture cleanup passed. Combined exit1. This is not a hosted TLS failure or a need to reinstall Chrome.

## Diagnosis and correction

The old browser-level auto-attach used no target filter. It configured existing/transient startup targets as well as the requested test page; any asynchronous setup rejection became the same generic BROWSER_NETWORK_GUARD_REQUIRED. The receipt captures neither the failing target kind nor the failing command, so the exact original Windows cause is unknown. No claim is made that Chrome155's target behavior is proven as that cause.

The corrected runner auto-attaches only service_worker/worker targets. It explicitly creates and attaches its own about:blank page, then installs Network, Fetch request interception, Page, Runtime and document-script blocking before navigating. Browser startup tabs/pages are not configured. A separate helper records only fixed phase, normalized target kind and a fixed error enum on failure; no URLs, target/session IDs or raw protocol messages are emitted. The request allowlist, TLS policy, public-source pinning and cleanup rules remain enforced.

Local verification:12 policy/protocol tests +10 actual Chromium browser checks +2 expected source-drift/unreviewed-route cleanup exercises =24/24 PASS,195 source hashes,45 syntax checks. Tests execute the target setup helper, inject failure at every page setup command, verify setup stops immediately, exclude transient page/tab auto-attachment and reject unknown target kinds without exposing raw text. Real Chromium activation, public cached bytes, offline navigation and cleanup passed with the explicit attachment path. Windows corrected execution remains pending.

## Owner next run

Use the complete chat PowerShell pinned to the new published commit. Prompts and inputs are unchanged: no prompt if existing Edge/Chrome is found; otherwise one full EXE path from the browser shortcut's Properties → Target. No installation, token, packet, password or code is needed. The same combined verifier runs24 local checks first, and only if they pass starts10 hosted public checks. This is a reviewed code correction, not a blind retry of the unchanged failure.

No window opens, no real email is sent and no backend/production/native settings are changed. The browser/profile are disposable. The last hosted database state observation remains Batch M QUARANTINED. Worker startup interception/total request-count limits documented in the original handoff still apply. Full hosted acceptance, authenticated browser/PWA/OS lifecycle and Stage3 completion remain pending.
