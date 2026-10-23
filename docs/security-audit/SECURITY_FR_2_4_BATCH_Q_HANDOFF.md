# Batch Q — reviewed staging worker upload and public browser readback

FR.2.4.E5.30, FRE165. Main Stage3 Authorization and Admin MFA remains current. Batch P Windows29/29 and independent .NET ZIP readback are complete. Do not rerun P or rebuild its ZIP.

## Exact artifact and effects

Existing ZIP: C:/Users/HP/AppData/Local/Temp/mushavo-batch-p-397169b10cd441e7b9a7833f67e56484/public-candidate/mushavo-pages-offline-review.zip. SHA2565bbbea1dfaca36a05c513b087012657c0dfd7380901dcf2f47dc2eac45309fe0.44 canonical entries;43 preserved from Batch B, only sw.js replaced. Worker SHA2560bc471318eb7156aed4f004c153a3e45fd08a71f665ad77ba59caa29fd8d8c47; cache pwa-shell-v89. Configuration/public push key, gateway _worker.js, headers and routes are byte-preserved. Root repository sw.js stays v88 pending hosted readback; Q explicitly selects the reviewed candidate source and v89 cache for both hosted origins.

The full pinned PowerShell supplied in chat fetches the security branch into an isolated LF snapshot, verifies206 source hashes,56 syntax paths,12 credential-free boundary units and the existing exact ZIP before upload. It reuses the installed Edge/Chrome. No dependency installation, packet, credential, code, key generation, ZIP rewrite or Windows worktree change occurs. Only source/temp files and disposable browser profiles are created locally.

Only after local preparation exits0, the terminal displays the exact ZIP and pauses. In Cloudflare Workers & Pages select the existing **mushavo-budget-staging** project → Create a new deployment → **Production**, within this staging project. Upload this ZIP, preserve existing bindings/secrets/settings and deployment history, then Save and Deploy once. Actual application production is outside scope. After dashboard success copy the new unique HTTPS deployment URL into the waiting terminal. If upload fails or is uncertain, type STOP and inspect the existing deployment before retrying. No automatic upload or retry is performed.

Cloudflare documents ZIP drag-and-drop and prebuilt _worker.js support: https://developers.cloudflare.com/pages/get-started/direct-upload/ and https://developers.cloudflare.com/pages/functions/advanced-mode/ (read23 October2026). Reuse the existing dashboard session; no dashboard credential belongs in terminal output or chat.

## Every terminal prompt

1. Only if the exact default ZIP is absent: full existing mushavo-pages-offline-review.zip path from Batch P output/Explorer. The fixed hash cannot be overridden. Missing artifact stops; no rebuild fallback.
2. Only if normal installed Edge/Chrome paths are absent: full existing msedge.exe/chrome.exe path from shortcut Properties → Target. No installation fallback.
3. After successful local preparation: the new unique https://<8 hexadecimal characters>.mushavo-budget-staging.pages.dev/ URL from the successful Cloudflare deployment details. This is public. Type STOP if success is not established. No other terminal prompt is expected; fetch disables interactive credential entry.

## Independent readback

At most four fixed direct public GETs read /sw.js and /config.js on the new unique deployment and canonical staging URL. Exact bytes must match the owner-reviewed ZIP, JavaScript MIME and selected HSTS/nosniff/frame/referrer headers must match. Configuration/public key contents are compared in memory and never printed. Redirects, retries and private API requests are refused.

Each origin then gets a separate disposable actual-browser profile. Ten checks establish public DOM, normal-trust TLS/QUIC/current error-free certificate,16 exact public asset bytes with the explicit reviewed v89 worker, empty Auth/cookie storage, actually executed worker bytes, stale product-cache cleanup/unrelated cache preservation,14 exact cached public entries, safe200 offline worker navigation/public DOM, no private app HTML cached and no allowed unreviewed intercepted request. Browser process/profile cleanup must pass. Document scripts are disabled; no hosted certificate bypass is permitted. Offline handling uses worker-fetch failure plus separate navigator state override. Cached redirect status is recorded as observed, not required true on every provider response.

Expected scoped hosted total24 = four direct public byte checks +20 browser checks across two origins.128 is the intercepted-request budget per browser, not total traffic. Worker startup fetches are not intercepted before their guard is installed; total browser traffic is not independently counted or OS-sandboxed. This scope does not compare deployed gateway source, recheck fresh Pages binding/secret metadata, execute authenticated UI/device restore, or establish installed PWA/OS acceptance. Preserve existing settings during upload.

## Local validation and open gates

Assistant75/75:12 new boundary/failure units +43 retained O regression checks +20 candidate actual-browser checks,206 source hashes/56 syntax. Tests cover strict staging origins, denied credential URLs/local TLS bypass, wrong ZIP and byte/MIME/header drift, bounded responses, all four direct transport-failure positions without retry, failure before the next browser origin, redacted errors, source/offline/cleanup requirements. Local HTTPS fixtures explicitly bypass ephemeral localhost certificates and establish no hosted TLS claim. The actual owner ZIP and Windows Q parent have not been accessed/executed by the assistant. Owner preparation runs12 new units only.

No Q upload or hosted readback result exists yet. Last hosted database observation remains Batch M QUARANTINED at2026-10-23T10:34:20.604Z; Q neither reads nor changes it. No email, window, DB reinstall, key generation, production/native update or APK build. Full authenticated browser/PWA, roles/Admin MFA, concurrency/scheduler/caller graph, findings closure and launch approval remain pending. December2026 remains the target month subject to those gates.

Send me the safe JSON and exit code.
