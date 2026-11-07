# FR.2.4 — Deno Windows pass and E5.1 local staging package

19 October 2026, FRE84. The owner returned the pinned E4.17 run at commit `5a14f0c61a7ce91e3c3cefa16dc5ba276d11cc18`: **144 PASS, 0 FAIL, exit 0**, Node v22.17.0, Deno 2.9.5. The [safe receipt](security-fr-2-email-deno-edge-owner-Windows-pass.json) verifies 119 source hashes, four actual native type checks and four native bundles, 28 source SDK boundary cases, 28 bundled SDK boundary cases and 88 affected Node/actual-SQL cases. The old TS2345 is reproduced; the accepted type correction emits identical runtime JavaScript. Temporary source/bundles were removed. No completion timestamp was supplied; 19 October is the receipt date, not an invented execution timestamp. Deno bundle hashes remain those reported by this Windows run; cross-platform byte parity is not inferred.

This remains Final Remediation, under FR.2.4. E4 covered email verification implementation and compatibility; E5.1 prepares a local staging delivery artifact. No finding or release gate is closed by either checkpoint.

## Concrete package

The [package contract](security-fr-2-email-staging-package-contract.json) pins the 40 current public source inputs plus the current header generator by bytes, Git blob SHA and SHA256. These 41 identities were independently matched to the parent GitHub tree before preparing this contract. The [57-input manifest](security-fr-2-email-staging-package-source-manifest.json) additionally pins the helpers, new packaging code, seven actual Worker source modules, tool locks and tests. Application UI/JS/CSS, Edge runtime source, SQL migrations and canonical schema are unchanged by this checkpoint.

The new `prepare-fr-2-email-staging.mjs` reuses the existing generic static preparer with the new public source contract. Its nested STATIC_ONLY profile is a historical helper input, not the final serving profile. The complete new package is Cloudflare Pages **advanced mode**: 40 current public assets, generated `404.html` and `_headers`, the reviewed `_worker.js`, and `_routes.json` = **44 files**. The two shared email UI modules are included. Final HTML drives the unchanged header generator; the webmanifest Content-Type rule is retained. This does not promote CSP Report-Only to enforcement or assert actual hosted header behavior.

Actual esbuild 0.28.2 compiles the existing source, and the Pages Worker must match the previously accepted SHA256 `fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99`. No limiter bundle is included or redeployed. The SQLite Durable Object limiter already has a separate deployed metadata pass. Routes version 1 invokes the Worker on all paths; the accepted Worker forwards static requests to ASSETS and handles the email API. The ZIP excludes function sources, SQL, audit receipts, tool dependencies, .env files, OAuth/DPAPI material and the separate limiter output.

The preparer reads the previous corrected candidate's `public/config.js` as bounded JSON data, never evaluates JavaScript, requires exactly the staging URL, publishable key and empty push key, and rejects source/production-key reuse. It never asks for a service key or accesses private Zoho credentials. The original candidate/configuration remain unchanged. The 43 non-configuration asset identities are recorded in a sidecar outside public output; no individual generated configuration/key hash or body is printed. The complete ZIP digest is provided for later artifact identification.

The new ZIP writer uses ZIP STORE, fixed standard headers/CRC32 and literal forward-slash paths without a parent folder. It rejects traversal, backslashes, duplicate names and oversized entries, preventing the Windows backslash packaging defect observed in FR.1. The PowerShell wrapper independently reads all 44 entries through .NET, compares entry bytes to public files and the 43-row sidecar manifest, then verifies the complete ZIP hash. The owner must still execute that actual Windows/.NET readback. It does not trust the Node writer's own path or hash assertion alone.

## Verification and scope

[Local checks](security-fr-2-email-staging-package-local-checks.json): Node v24.19.0, **21 PASS, 0 FAIL**, 57 source hashes, 12 Node syntax checks. Tests build the actual accepted Worker, prepare all 44 files, and use Python's independent zipfile implementation to check every name, CRC and payload byte. A second concrete synthetic 44-file review package was also independently read. Binary images remain byte-identical. Tests cover regenerated headers, all-route routing, source/config preservation, foreign project, secret/push/extra config fields, executable config rejection, production key reuse, changed tool locks, equal-length public/header/Worker tampering, missing source, existing output, redirected paths, unsafe ZIP entries, corrupted CRCs and safe CLI failure output. All fixture keys are synthetic; there are no hosted calls or email dispatches. Windows PowerShell syntax and .NET execution are not claimed as run locally.

The final owner block exports this new pinned commit to a fresh temporary folder with LF bytes, installs only the existing locked Worker tools with npm lifecycle scripts disabled, parses the PowerShell wrapper, and prepares a new Desktop review folder. It reuses this retained local file:

`C:\Users\HP\Desktop\Mushavo-Staging-Corrected-8b88f9465732442890ad06803e0513bc\public\config.js`

Return only the safe summary, ZIP path/digest and exit code. The receipt and manifest stay outside public output. Do not upload this ZIP yet. No auth/session/code input, private encrypted file, SQL Editor action or Cloudflare API token is needed. Public npm dependency downloads are distinct from hosted application/provider requests. Installed dependency metadata/version and full lock identity are checked; installed package bytes are not independently rehashed.

## Remaining rollout work

The package is review material. Pages gateway bindings, secret provisioning, selected recipient allowlist, actual controlled email delivery, deployed protected Edge handlers, a staging-only installer/activation and rollback contract, and coordinated SQL/UI/gateway rollout remain pending. The current private atomic installer still has its offline rehearsal acknowledgement; this checkpoint does not activate it or approve its use against a live database. Packaging cannot establish genuine provider Auth/JWT, browser cookie persistence, day-seven behavior, recovery, concurrent transactions or provider-hosted Edge acceptance. The old 1525-case full offline receipt remains at its original source pin; it is not relabeled as rerun here.

All prior events, 123 coverage rows, 20 finding definitions and other stage objects are preserved. All 20 full findings remain open; release gate OPEN_PENDING_REQUIRED_EVIDENCE; final re-audit PLANNED_NOT_PERFORMED. No production/native or APK change. Email-code verification remains the user's selected all-user policy, including Admin; it is not asserted to be Supabase AAL2. The stronger original MFA acceptance finding remains open.

## Primary delivery references checked 19 October 2026

- https://developers.cloudflare.com/pages/functions/advanced-mode/ — module Worker entrypoint and ASSETS forwarding.
- https://developers.cloudflare.com/pages/get-started/direct-upload/ — dashboard direct upload supports `_worker.js`; normal functions-folder compilation differs.
- https://developers.cloudflare.com/pages/functions/routing/ — version 1 include/exclude routing.
- https://developers.cloudflare.com/pages/configuration/headers/ — `_headers` applies to static responses; Worker API responses need their own response headers. Actual hosted headers remain pending.
