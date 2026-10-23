> Latest FRE156/FRE157: Windows24 local checks pass; hosted public DOM passes but TLS assertion stops (1 PASS,1 FAIL), cleanup verified. Exact TLS-metadata cause unknown. Short collection-only diagnostic prepared (197 hashes,47 syntax); no full rerun requested. See [TLS review](SECURITY_FR_2_4_BATCH_O_TLS_REVIEW.md).

> Latest FRE154/FRE155: Windows8 unit passes then local browser setup stop; no hosted probe, cleanup verified. Explicit page attachment, worker-only auto-attach and safe phase diagnostics now pass24 local checks (195 hashes,45 syntax). Exact original cause remains unknown; corrected Windows/hosted result pending. See [target setup review](SECURITY_FR_2_4_BATCH_O_TARGET_REVIEW.md).

# Batch O — hosted public browser TLS and service-worker acceptance

Stage: `FR.2.4.E5.28_BATCH_O_HOSTED_PUBLIC_BROWSER_TLS_AND_SERVICE_WORKER`.
Main Stage 3 Authorization and Admin MFA remains in progress. Target month remains December 2026, subject to evidence and release approval.

## Purpose and scope

Continue after Batch N's Windows short36 scoped pass. Combine public source parity, browser TLS, real service-worker activation/cache cleanup and offline navigation on the canonical staging origin. No existing installation, email proof, device lifecycle or acceptance window is repeated. No database, deployment, secret, Auth account or production/native change is requested.

The runner opens installed Edge/Chrome headless with a new disposable profile, validates the public offline document and 16 public asset byte hashes, verifies the actually executed service-worker source through CDP, seeds one synthetic stale product cache and one unrelated cache only in that profile, activates the deployed worker, checks stale deletion/unrelated preservation, and hashes all14 product cache entries. It then simulates failed/offline browser transport and verifies `/app.html?batch_o=offline` shows the safe cached offline page and is not cached as private app HTML. It closes its browser child and removes only its own profile on success or failure.

Document scripts are disabled deliberately; CDP evaluates harness assertions and the service worker runs normally. This is public browser/service-worker acceptance, not the full app, signed-in DOM, remembered credential UI, installed PWA/OS lifecycle, mobile/native or hosted TLS/CSRF authorization acceptance. No backend request or acceptance window is needed. No new hosted database/quarantine readback occurs; last hosted state evidence remains Batch M QUARANTINED.

## Transport boundaries and limits

Only fixed reviewed public paths and GET requests are permitted by the intercepted-request policy. App navigation is allowed solely during simulated offline failure. Non-staging DNS is disabled for the browser's resolver, background services/extensions/sync are disabled, and no user profile or credentials are imported. Production uses normal browser certificate verification with no certificate bypass.

The 128 limit covers intercepted requests, not every browser request. Service-worker startup fetches begin before worker interception is enabled: pausing worker startup deadlocked CDP network initialization in the local experiment. Their scope is constrained by the prechecked, unchanged public worker source; the actually executed source is independently checked too. Total browser traffic is not independently counted or OS sandboxed. The receipt explicitly reports these limits. Do not present the intercepted count as a total hosted request count or the local fixture TLS bypass as hosted TLS acceptance.

Local regression uses only an in-memory localhost test certificate. It tests8 request-policy cases,10 actual Chromium assertions and2 expected failure/cleanup cases (source drift and blocked unreviewed request). Both deliberate failures left zero unexpected requests reaching the fixture and removed the browser/profile. All20 passed,194 source hashes and44 syntax checks verified, Node24.19.0/Linux/Chromium153. Windows22.17.0/Edge execution remains owner-pending. Batch N's earlier89 Windows regression passes remain historical; they are not rerun or newly counted here.

The assistant attempted the fixed hosted public document once: one intercepted hosted request attempt, zero checks passed, no TLS result established, timeout at PUBLIC_OFFLINE_DOCUMENT, browser/profile cleanup verified. Exact cause unknown; no site outage is inferred. Receipt retained separately. Owner execution uses stricter safe navigation-failure classes and does not bypass TLS or change the site to compensate.

## Owner inputs and execution

The complete PowerShell is supplied directly in chat and pinned to the published correction commit. It fetches the security branch, verifies the pin is published, creates an LF archive in a new temporary folder, finds an existing Edge/Chrome executable, and runs the combined verifier with `--hosted-public`. No npm install, execution-policy change, packet read, password, Management token or email code is required. Git fetch uses interactive credentials disabled and should not prompt; it stops if access is unavailable.

Expected prompts: none when Edge or Chrome is found in the normal Windows locations. If not found, one prompt asks for the full existing browser EXE path. Find it in the browser shortcut's Properties → Target; paste the EXE path without shortcut flags or surrounding quotation marks. Never enter credentials. Successful Windows output will show20 local passes plus10 hosted public assertions. Any failure stops for review, with cleanup attempted and safe JSON only; do not reinstall, relax TLS, open a window or repeat email probes.

## Next scope

After the owner's scoped result, prepare signed-in hosted browser acceptance reusing the reviewed five-minute account-bounded controls, private input dialogue and exact quarantine/device/session cleanup from M. That later batch needs explicit email/password prompts and must be reviewed as a concrete runner before execution. Full cross-account/roles/finance, Admin MFA, real PostgreSQL concurrency, scheduler/caller graph, production rollout and release/store acceptance remain separate pending work. No findings are closed by this preparation.
