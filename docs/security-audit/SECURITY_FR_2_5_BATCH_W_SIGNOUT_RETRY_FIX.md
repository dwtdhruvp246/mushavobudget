# Batch W — AU05.05 sign-out retry correction

29 October 2026. Stage 3 / FR.2 / FR.2.5 / Batch W. Existing case AU05.05; no scope expansion.

## Owner result

The supplied screenshot shows the expected offline warning: “Sign-out could not finish. Your session may still be active. Retry signing out.” The private dashboard is hidden. The owner restored No throttling and clicked Retry sign-out, saw no visible completion, and only after refresh saw the signed-out state. This is partial evidence, not a full AU05.05 pass. The timing of actual SDK session clearance cannot be established from the screenshot.

## Source issue and correction

The previous retry binding called signOutSafely, which silently returned when application state.session was empty. handleSignedOut did not clear the old warning. These are reproducible code paths consistent with the reported stale display; no claim is made that a browser trace established the exact event ordering.

The signed-out handler now removes the stale warning. A retry with no application session checks SDK session state before clearing the warning. SDK errors retain a warning; a replacement session is not revoked; an intervening account change wins over delayed reconciliation; duplicate clicks are suppressed. Active-session retries retain the normal Auth sign-out path. The retry button retains its correct label. app.html loads app.js?v=123.

No forced storage purge, password change, new verification-code requirement, or automatic sign-in is introduced.

## Validation

Node v24.22.1: 85 tests passed, zero failed/skipped, exit 0, across:
- tests/signout-retry-reconciliation.test.mjs (8 new tests)
- tests/signout-retry-package.test.mjs (7 packaging tests)
- tests/signout-entry.test.mjs
- tests/stage-3-auth-flows.test.mjs
- tests/session-recovery.test.mjs

Tests are local synthetic/VM/package checks. Actual hosted retry completion is pending. Original recovery save/adoption/new-password sign-in owner passes remain accepted.

## Staging package preparation

Run scripts/prepare-fr-2-batch-w-signout-retry.mjs with the retained accepted shared-tabs ZIP and an empty output directory. It checks the expected 42 entries and source manifest, replaces only app.js/app.html, preserves the other 40 entries, and validates ZIP readback. The retained input is unchanged.

Expected retained file:
C:\Users\HP\Desktop\Mushavo-W-SharedTabs-ad17c392878e4ef1afb13ec5e9bbd008\mushavo-shared-tabs-staging.zip

Output filename: mushavo-signout-retry-staging.zip.
The actual owner's retained ZIP was not available in this workspace; full owner package preparation remains pending. No upload or successful deployment is claimed.

Use Cloudflare Pages project mushavo-budget-staging and its existing direct-upload workflow. Keep the stable staging URL. No Supabase SQL/settings/callback change. The production/native applications and APK are unchanged.

## Acceptance after deployment

First verify served app.html uses app.js?v=123 and app.js matches the prepared source. Then repeat only the affected offline sign-out / online Retry sign-out sequence. Expected: warning is visible for an unconfirmed failure, then clears after confirmed sign-out without manual refresh; a subsequent online reload stays signed out. Record unexpected SDK behavior without inventing a pass. Full Batch W, V/X/Y/Z, and release acceptance remain open.

## Package verification correction — 29 October 2026

Owner preparation at 403e412 stopped with SIGNOUT_RETRY_SOURCE_REQUIRED before upload, hosted requests or settings writes. Reproduced using the exact published files, verified against Git blob identities. The manifest had hashes of local copies of scripts/lib/read-public-zip.mjs and scripts/lib/store-public-zip.mjs with an extra trailing newline; those helper changes were never published. Corrected only their two manifest hashes to the existing published bytes at 878c8711e021f4dbc28b73c4e797e43fa08755e9. App source and output target hashes are unchanged. All 15 focused packaging/reconciliation tests pass against exact published source with corrected manifest. Earlier 85 local passes remain historical; the earlier package-source check did not establish published-byte parity. Owner preparation retry and hosted deployment remain pending.

## Owner public source readback — 29 October 2026: 4/4 PASS

The owner ran the supplied read-only Node SHA-256 comparison and reports PASS for app.html and app.js?v=123 on both https://04fbca77.mushavo-budget-staging.pages.dev and https://mushavo-budget-staging.pages.dev. Expected app.html SHA-256: a900dc61d505321a4a11817fd59cbeb9c432c5dd78772d1c18e45feb4213d0d7; app.js SHA-256: 34ebb8fe15c112483f535c86e469e071b5f37e8191a41e6e8e6a36f5c4ab5e76. The assistant's separate HTTP 403 attempts remain recorded; successful owner readback verifies these selected served bytes. Browser runtime retry outcome remains pending.

Next: online hard reload of stable app to load current files, then sign in if needed; Network Offline, one Sign out; restore No throttling; one Retry sign-out if warning appears. Observe whether the warning clears without reload, then reload once online to verify signed-out persistence. Restore No throttling on every outcome. If stuck beyond 30 seconds or unexpected result, report rather than repeatedly clicking. No repeat recovery/password-save test.

## Owner version 123 observation — 29 October 2026

Owner reports: after selecting Offline and clicking Sign out, the warning appeared, disappeared after some time, and reloading showed the signed-out page. Screenshot image(20261029-085646).png shows the sign-in view with a transient bottom warning toast; the persistent retry notice is not visible at capture. No email, password, token or other private form value is transcribed into this report. The toast has a normal auto-dismiss timer, so its disappearance alone is not proof that Retry sign-out was exercised. Signed-out persistence after the reported reload is accepted. Whether No throttling was restored and Retry sign-out was clicked is not specified. Preserve this observation; ask only for that action clarification, not a repeat test. Full AU05.05 acceptance and Batch W closure remain pending.

## Owner action clarification — 29 October 2026: scoped AU05.05 PASS

In reply to the explicit question whether No throttling was restored and Retry sign-out clicked, the owner answered “yes”. This is accepted as confirmation of those actions, together with the preceding warning disappearance and reload remaining signed out. The original stale-warning defect is accepted as corrected at this observed hosted scope. Preserve the v123 public 4/4 source readback and this owner browser result. No repeat requested. This does not establish independent push-cleanup-only failure, refresh/invalid-refresh, or full Batch W/FR.2/Stage 3 acceptance. The next existing session item for preparation is AU05.01 actual same-user token refresh, followed by the other original AU05 variants; no new cases or runtime changes are introduced by recording this result.
