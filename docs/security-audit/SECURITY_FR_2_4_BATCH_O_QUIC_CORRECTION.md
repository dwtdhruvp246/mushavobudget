> Latest FRE160/FRE161: Windows13 local passes +7 hosted public passes (transport/assets/worker/cache); timeout during offline navigation, cleanup verified. Worker-fetch-only failure injection and safe snapshots now pass43 local checks (199 hashes,49 syntax); corrected Windows/hosted followup pending. See [offline review](SECURITY_FR_2_4_BATCH_O_OFFLINE_REVIEW.md).

# Batch O secure QUIC correction — 2026-10-23

## Owner evidence and diagnosis

The owner diagnostic at published `6676d9c934fe32257c7538e5fcc2fc2ed544c506` passed197 hashes/47 syntax,8 fresh local diagnostic checks and1 hosted public DOM check; combined exit0. Chrome155.0.8059.79 on Windows/Node22.17.0 reported both Document and visible security state **secure**, both protocol labels **QUIC**, a present/current certificate, no certificate network error, no certificate error event and no hosted certificate bypass. It matched the original clean offline URL. Five hosted attempts were intercepted; this remains an intercepted count, not a complete browser traffic count. Browser/profile and local fixture cleanup passed. No real email, private packet or committed mode request occurred.

This proves the old TLS-only label matcher rejects the connection observed in this diagnostic: its regex excludes QUIC. It does not retroactively identify the uncaptured raw protocol from the earlier11:57 failure. The old collection receipt stays unchanged and does not become a full hosted acceptance pass.

Primary references: https://chromedevtools.github.io/devtools-protocol/tot/Security/ documents separate protocol/security/certificate metadata, including QUIC as an example label. https://www.rfc-editor.org/rfc/rfc9001.html defines TLS securing QUIC. The correction accepts a supported browser transport label with complete certificate/security evidence; it does not infer a negotiated TLS version from the QUIC label alone.

## Correction

A separate strict predicate supports TLS1.2, TLS1.3 and QUIC. Each requires an observed fixed-target offline document, secure Document state, secure visible state, matching supported protocol observations, a present/current certificate, an explicit absence of certificate network error and error events, and certificate bypass false. Missing/unknown protocol, missing state, expired/not-yet-valid certificate, errors, conflicting observations and any bypass fail closed. The isolated self-signed fixture cannot pass the hosted predicate. Actual captured owner metadata passes its offline replay; the captured fixture metadata fails it.

The checker waits briefly for complete visible certificate metadata before evaluation. It retains original source pinning, GET allowlist, disabled document scripts, worker-source/cache checks, offline fallback and exact browser/profile cleanup. No browser/site certificate settings, deployments, Auth/backend configuration or production/native files are changed. The receipt adds hosted_secure_transport_verified; legacy hosted_TLS_verified denotes the same validated HTTPS-transport check for compatibility, not an independently measured TLS version for QUIC.

## Validation and next owner run

Full local regression passed37/37 (25 unit/protocol cases,10 real Chromium fixture checks,2 expected failure cleanup exercises),197 source hashes and47 syntax checks. The first assistant engine attempt timed out before startup because the retained scratch executable was truncated (122911744 bytes versus209022176 in the retained package). That state was inspected before retry; the executable was restored from the already retained package, SHA256 matched, no download/install was performed, and the full regression then passed. Both local attempts cleaned up. The initial receipt is retained in the local evidence wrapper. No new hosted requests were made by this correction.

Use the complete chat PowerShell at the new published commit with `--hosted-public-followup`: verify all source/syntax, run13 focused transport/metadata cases, then run10 hosted public-browser assertions. It reuses the earlier Windows24 local browser passes and8 diagnostic passes without representing them as fresh or repeating their browser exercises. A new disposable profile is required for reliable public cache checks.

Prompts remain none if an installed Edge/Chrome EXE is found, otherwise one existing EXE path from the shortcut Properties → Target. No credentials/packets/email codes, installs or acceptance window are required. The followup remains public GET-only: its service worker and synthetic caches live solely in the disposable browser profile. Cleanup removes that profile and its browser child.

Batch O public scope remains pending until its returned checks pass. Full authenticated browser/installed-PWA/OS lifecycle, role/Admin MFA and release acceptance remain pending beyond this public scope. Main Stage3 remains in progress, production/native remain excluded and APK deferred. Last hosted database state observation remains Batch M QUARANTINED; no current database readback is claimed by this public diagnostic.
