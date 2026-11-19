# 8.1 — Notification, event and device source review

Date: 12 October 2026. Audit branch: `security/stage-3-authorization`. Source parent: `5306aa19adc42654cde1a8f415aa4318a4289321`. Stage 7 is closed with carry-forward. Existing **F11** governs native notification/device/private display acceptance; F12 and original authorization/native/privacy/operations dependencies remain OPEN.

**Source review complete: 53 selected inputs byte-hashed and matched to Git, zero mismatches.** This comprises 37 code/config/SQL inputs, 13 test files read but not executed, and three feature documents. Three notification Edge entrypoints were reviewed. Five public primary API/platform references were reviewed at their stated scope. Zero fresh local behavior, hosted/provider/cron/device cases were run.

[Finite plan](SECURITY_STAGE_8_NOTIFICATIONS_DEVICE_PLAN.md) · [Source inventory](security-stage-8-notification-source-inventory.json) · [Known/unconfirmed decisions](security-stage-8-notification-decisions.json) · [48 planned grouped cases](security-stage-8-notification-test-matrix.json) · [Eight OPEN actions](security-stage-8-remediation-actions.json).

## Source map and actual limits

| Layer | Selected source | Observed behavior |
|---|---|---|
| Browser opt-in/device | push-notifications.js and app.js | Secure browser API support checks, iOS standalone gate, explicit permission prompt, own subscription lookup/metadata/insert/delete, remembered per-user opt-in, disable/recovery and UI stale-result guards |
| Worker display/click | sw.js | Bounded display fields, generic malformed fallback, same-origin app/Admin/Business-bill route normalization, waitUntil, badge enhancement and navigate/focus/open |
| Server send | send-test-push, dispatch-push-reminders, dispatch-admin-notifications | Authenticated test + server cooldown; dedicated cron secret/source guards; guarded Web Push egress and per-device retirement/results |
| SQL queues/events | schema and selected migrations | Own subscription RLS/column grants, durable idempotent reminder/Admin queues, source/member/plan status checks, notification workspace context and server-managed Business invitations |
| Scheduling/operations | cron templates, monitoring SQL, feature deployment docs | Protected Vault secret names, reminder 15-minute/Admin five-minute templates, aggregate monitoring and documented rollback; actual installation/runs are unverified |
| PWA/update/offline | manifest, sw.js, pwa.js, app-entry, workspace-preference | Session-aware entry, saved-user workspace intent, generic offline fallback/private-data cache restrictions, immediate worker activation separate from manual page reload |
| Native source | package manifest/lock and build-capacitor | App/Preferences workspace/resume bridge; no identified native push transport/plugin/registration receiver; PWA service worker registration skips detected native platform |

The migration's comments refer to earlier PWA feature stage numbers; those are historical feature labels, not this audit's Stage 7/8 milestones. The tracked Pages workflow and feature deployment instructions are source artifacts, not proof of the current Cloudflare serving/deployment mapping.

## Findings that need source correction or direct recheck

### Device association and sign-out differ by surface

The main app's `signOutSafely` attempts `removeCurrentDevicePush` before Auth sign-out. It permits requested Auth sign-out after cleanup failure, preserves opt-in for recovery and warns that device cleanup could not finish. Successful cleanup removes this device's server association, unsubscribes the browser and clears badges.

Business `signOut` directly invokes local Auth sign-out, clears Business state and navigates to the app, with no equivalent push cleanup in the inspected function. Because the browser subscription belongs to the same site rather than a page-specific sign-in, this is a source lifecycle gap. No actual notification after Business logout or private disclosure was observed.

Auth reset clears in-memory display/session state; it is not remote endpoint retirement. Account-switch, forced expiry, offline cleanup and shared-device behavior require direct acceptance. Final UI commits in refresh use sequence/user checks, but delayed permission/subscribe/lookup/reconcile/save mutations need identity-bound tests too. A failed cleanup must not trap a user in Auth or delete another device/account's association.

### Queued detailed previews need current privacy revalidation

Existing SQL uses generic copy unless `detailed_notification_previews` is enabled. Enabled reminder rows may snapshot the payment/bill name, amount/currency and workspace title into the outbox. The current dispatcher revalidates source eligibility and sends the saved job title/body; it does not reread/redact the detailed-preview choice immediately before delivery.

Therefore a queued or retried detailed reminder can retain older private copy after the setting is disabled. This is a source counterexample to be tested, not an observed lock-screen incident. The worker bounds title/body and provides generic malformed fallbacks, but valid detailed content is still displayed without a current app-session/privacy lookup.

Retain the existing generic default and valid optional detailed behavior. Workspace-versus-recipient/device authority, queued transitions, retained OS notifications/badges and privacy/retention rules need an accepted decision and meaningful recheck; generic preview still reveals an event category and is not proof of post-logout privacy.

### Recipient account guards are inconsistent in selected handlers

Payment reminder validation rechecks current active profile/membership, assignment, payment/plan/settings and already-paid state. Business bill validation rechecks source/workspace/due state and delegates current eligibility to its service-only RPC.

Test push validates `auth.getUser`, own server-selected active subscriptions and the 60-second authoritative cooldown, but the handler has no explicit profile account-status check. Admin dispatcher validation rechecks current app_admins role, unread recipient-owned notification and pending source status, but has no explicit active-profile check in `validateAdminJob`. Service-role reads do not establish that ordinary suspended-user policy guards cover these paths.

These source discrepancies need confirmation/correction and direct denied/allowed staged cases. `verify_jwt=false` is accompanied by in-handler Auth or cron checks; it is not by itself an unauthenticated-send finding. Current installed policies/grants/functions/roles/MFA parity and existing AU/AM/Business dependencies remain unverified.

### Outbox state is not exactly-once physical delivery

Selected SQL has unique enqueue keys, SKIP LOCKED claims, at most three attempts, 15-minute abandoned-claim recovery and 5/30-minute retry delays. This is useful source behavior, not an actual database concurrency/recovery run.

Result writers accept the job ID and processing state without a claim-generation argument. Late workers across reclaim boundaries need a direct stale-attempt test. Any successful device marks the whole job sent even if another temporarily fails. Successful provider acceptance followed by a result-write failure may cause a retry of accepted content. Those semantics require an explicit partial-device/ambiguity/retry policy and bounded recovery proof.

A guarded sender resolving successfully is provider request acceptance, not proof that the OS displayed a notification, that the current recipient saw it, or that the user clicked it. Source counters/notification tags do not prove exactly-once delivery.

### Safe URLs are navigation intent, not authorization

Worker route normalization rejects external targets, keeps only approved app/Admin hashes and bounded identifiers, and requires workspace/bill context for a Business bill route. It reuses/focuses an existing same-origin app window or opens another. Current app/Business loads must still verify session, tenant/member/source access and Admin assurance.

Remembered workspace and notification IDs cannot authorize a foreign workspace, removed member, stale bill or Admin queue. Signed-out/old-account/expired route, existing tab and native cold return paths remain actual device/authorization checks.

Business invitation notifications are server-created in-app metadata with guarded client changes and current invitation handling. No invitation-specific Web Push outbox pipeline was identified. Do not silently promise that in-app invitations are already native/push events.

### PWA private fallback and update lifecycle require actual platform checks

The worker uses network-first no-store navigation with cached generic entry/offline documents and inline fallbacks; it does not cache live authenticated workspace navigation. Only same-origin designated static shell requests are intercepted; sensitive API prefixes/external requests are bypassed. The entry shell verifies current Auth online and does not present financial data as current offline.

Worker install immediately calls skipWaiting and activation claims clients; the page update notice waits for the Refresh action before reload. Dirty/in-flight beforeunload handling and update checks are source protections. **Immediate worker activation is separate from deferred page reload.** Multiple tabs/version mismatch/partial shell failure/old cached state/actual OS termination and offline/reconnect need genuine tests.

pwa.js skips worker registration on a detected Capacitor native platform. Its browser refresh behavior establishes no native app-store/OTA update capability. The native builder's App/Preferences bridge and earlier nine packaging fixture checks establish no native push SDK, merged manifest/APNs/FCM capability or real device delivery.

## Current primary references

The inventory lists exact URLs and review scopes; no SDK/provider/minimum-OS choice is adopted.

- WebKit describes Home Screen Web Push and direct-user-interaction permission requests. Browser Web Push/PWA support is distinct from native app integration.
- Android documents Android 13+ non-exempt notification runtime permission. Actual merged permission/channel and user-choice behavior remain required.
- Firebase's current registration-management guide includes FID and legacy token sections. Verify the actually selected SDK/API registration scheme rather than hard-coding an older token assumption.
- MDN documents notificationclick/waitUntil/client APIs and service worker installation/activation/update/cache lifecycle. These APIs provide no tenant/session authorization themselves.

The Apple Developer permission page returned only a JavaScript shell; it is not counted among the five substantively reviewed references. No private provider console/device/secret was inspected.

## Prior evidence and preservation

Stage 2's guarded egress source/local result (45 selected Node checks, local Deno transport and three bundles) remains its dated evidence. It is not rerun here. Its historical production zero-subscription metadata and staging empty public push key retain their 10 October scope; current configuration/provider delivery is unverified. Do not repeat the old production SQL/setup handoff embedded in that historical document.

Earlier owner PC/phone smoke success is not a fresh closed/background/lock-screen/account-switch native matrix. NR session/backup/app identity/tool/artifact gaps, AU/AM guards, PR/DL retention/privacy/audience decisions, IE native Auth callbacks and CO source attribution remain relevant.

All original 123 coverage rows/20 findings, Stage 0–7 progress and prior receipts are retained. No device permission/subscription, accounts/fixtures/two conversions, provider/cron/Vault/SQL/Auth/Storage setting, message or native artifact changed. No dependency/SDK, migration, runtime fix, hosted test or notification send occurred at 8.1.

## Bounded next work

**8.1 is complete at source/reference/decision scope. Next 8.2 prepares reviewable source-local candidates and meaningful offline actual-function/handler regressions.** Prioritize demonstrated cleanup, queued privacy and recipient-guard gaps where compatible; unresolved native transport/configuration and decision-dependent queue behavior remain explicitly limited. No native SDK or actual provider delivery is implied.

8.3 records one bounded isolated readiness/delivery/device outcome, carrying absent prerequisites rather than starting repeated setup. **Full Stage 8 report is due at 8.4.** Eight ND actions remain OPEN; the 48 planned ND cases have not run and overlap earlier audit requirements. No owner SQL/terminal/setup/file-opening action is needed for 8.1. APK update remains deferred and release gates remain OPEN.
