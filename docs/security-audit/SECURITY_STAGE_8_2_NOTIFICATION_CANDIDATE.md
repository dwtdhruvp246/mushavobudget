# 8.2 — Notification boundary source candidate and offline regression

Date: 12 October 2026. Audit branch: `security/stage-3-authorization`. Source parent: `a51e29cb2b71182dc5373c3804ec5ebc4a3c2ce0`. This is step two of four; next **8.3** is one bounded readiness/delivery/device outcome. Full Stage 8 report remains due at **8.4**.

## Final recorded result

**70 PASS / 0 FAIL / exit code 0**, with **nine Node syntax checks**: six JavaScript targets and three TypeScript entrypoints stripped and parsed as JavaScript. Final assistant Node: v24.19.0. The TypeScript stripping API emits a non-failing experimental warning; it is retained, not counted as a test failure.

The [local receipt/history](security-stage-8-notification-local-checks.json) records the 32 new boundary cases, 38 selected existing regressions and all 21 consumed SHA256 values. There are no skipped/cancelled/todo cases. This is actual selected function/handler execution with synthetic Auth/database/browser/provider ports, not real browser/OS/hosted/provider acceptance.

The earlier standalone primary pass (32 cases) and first verifier pass (70 cases/eight syntax checks) are retained. Friendly status messages and script cache references were then added and the final same 70-case suite passed again with nine syntax checks. History totals **172 case executions, all PASS**, not 172 unique controls. The final unique suite has 70 cases; historical explicit syntax target executions total 17.

**Zero of 48 planned hosted/device ND cases ran.** All eight actions and original findings remain OPEN.

## Concrete source corrections

| Changed runtime candidate | Resulting behavior |
|---|---|
| business.js | Attempts current browser-device push cleanup before local Auth sign-out; exact initiating user/endpoint filters and Auth epoch checks; ten-second cleanup deadline, duplicate-click guard and safe account-switch boundaries |
| business.html | Business script cache reference advances from v19 to v20 |
| app.js | Existing friendly formatter maps inactive-recipient/status-lookup failure to clear user-facing copy |
| app.html | App script cache reference advances from v114 to v115 |
| shared notification-recipient.mjs | Service-side active-profile and current reminder-preview helpers; no new SDK or credentials |
| send-test-push/index.ts | Authenticated caller must also have active profile; missing/inactive returns 403, lookup failure 500, before subscriptions/cooldown/send |
| dispatch-admin-notifications/index.ts | Current permitted role also requires active recipient profile before notification/source/subscription delivery; inactive cancels, lookup failure enters existing retry path |
| dispatch-push-reminders/index.ts | Rereads current workspace reminder/preview settings after eligibility/subscription lookup, before constructing the outgoing payload; preview-off replaces queued details with existing generic copy |

The helper file is `supabase/functions/_shared/notification-recipient.mjs`. The existing `push-destination.mjs` implementation is unchanged and still used by all three senders.

Business successful cleanup deletes only the initiating user's current endpoint association, unsubscribes that browser and clears its optional badge; successful Auth sign-out forgets that user's remembered opt-in. Missing browser APIs/worker/subscription does not block sign-out. Database/browser cleanup failure or deadline still permits requested Auth sign-out and gives a generic device-settings warning; recovery opt-in remains if cleanup did not finish. Auth failure does not display successful sign-out/navigation.

Delayed lookup/result paths check initiating UUID and Auth epoch before later browser mutations. After timeout the continuation is invalidated. A database request already in flight is not retroactively canceled; its explicit UUID/endpoint filters and effective RLS remain essential. Already initiated browser/provider operations are not atomic with Auth. Real cross-tab/provider/SDK account-switch behavior remains a required recheck.

Current privacy-off uses the established generic payment-timing or Business reminder text and title; enabled detailed preference preserves accepted queued copy and route rather than recalculating finance values. Missing/disabled current reminder setting cancels without delivery; a setting-read error cannot fall back to stored private content and follows retry. The helper receives server-selected jobs/settings from existing service-side paths, not caller verified/privacy/recipient flags.

**Privacy limit:** this is a current read snapshot before payload construction, not an atomic settings/provider transaction. A toggle after that read or an already accepted/displayed notification cannot be recalled by this patch. Per-device preference authority, OS-retained notifications and queued-provider/account-switch privacy still need accepted decisions and actual device tests.

## Exact non-document diff

Eight runtime candidate paths above plus three offline paths form the **11-path non-audit-document diff**, with no deletions:

- New `tests/stage-8-notification-boundaries.test.mjs`.
- New `scripts/verify-stage-8-notifications.mjs`.
- Updated `tests/security-stage-2-push-destination.test.mjs` harness.

The existing guard regression keeps the same 17 cases/assertions. Its valid actor fixture now supplies an active profile/enabled reminder settings, and its data-URI entrypoint loader resolves the actual new shared module. This is harness alignment, not bypass of the new guard. Three other selected regression files remain byte-identical.

Eight existing paths have intentional replacements, and three non-document files are added. The receipt records before/candidate Git/SHA identities. The 8.1 inventory remains immutable; intentional replacements are not hidden by rewriting it.

No SQL/schema/migration/grant/policy, package/lock/SDK, cron/Vault, service worker/PWA/native builder/native project, finance/proration/currency or membership/role source changed. Only script cache query references advance; no app release or actual installed/native artifact is adopted.

## Meaningful local verification

| Batch | Cases | Executed behavior and limits |
|---|---:|---|
| New shared helpers | 10 | Active/missing/suspended/unknown profiles, lookup privacy, exact recipient query binding, generic/detail/disabled/malformed preference and source cases |
| Actual three Edge handlers | 11 | Stripped actual source with synthetic Auth/DB/transport: queued preview change/error/disable, valid detail, inactive/missing/read failure/role/source/caller-authority cases; no hosted service/crypto/provider request |
| Actual Business cleanup/sign-out VM | 11 | Current-device filters/order, unsupported/no-worker/no-subscription, DB/unsubscribe/Auth outages, lookup/deletion/epoch/ABA/account-switch/late Auth paths, fake-clock deadline, repeated click and optional badge/storage failure |
| Existing destination/actual-entrypoint regression | 17 | Existing endpoint/DNS/Agent/deadline/protected-option/source-handler cases with controlled doubles and private-DNS rejection; no external provider acceptance |
| Existing worker display/click regression | 7 | Actual selected worker VM/source route/display behavior |
| Existing workspace context regression | 9 | SQL/app/diagnostic source assertions, not PostgreSQL/RLS execution |
| Existing Business billing regression | 5 | Four selected actual client-function VM cases plus SQL-source containment; accepted billing behavior unchanged |

The Node verifier uses built-ins only. Nine unchanged consumed inputs still match the pinned parent Git blobs; all 21 consumed file hashes match final tested bytes. No full application suite, actual Deno dependency resolution/bundle/typecheck, installed Edge runtime, genuine RLS/MFA/direct API transaction, native compile or physical device matrix is certified.

Existing profiles/settings columns are used; **no SQL migration is needed** for this source candidate. Effective installed source/schema/grants/settings and proper function deployment remain unverified.

## Action contribution and carry-forward

ND-R02 gets a concrete Business explicit-sign-out correction; main app/forced Auth expiry/multiple device/permission/re-registration races still need wider acceptance. ND-R03 gets queued preview-off redaction; independent recipient/device policy, retained OS notifications and actual lock-screen privacy remain open. ND-R04 gets active-recipient source checks, while current roles/MFA/cron/paid/removed/invitation and installed policy parity need direct tests.

ND-R05's claim-generation, partial-device, provider-acceptance-versus-display, ambiguous result failure, actual scheduler/egress/operations requirements are unchanged and open. ND-R01 native transport/registration and ND-R06 click/identity, ND-R07 PWA update/offline, ND-R08 actual device/provider/retention/recovery/release requirements retain their earlier scope.

No decision is newly approved, no finding closes and no synthetic PASS is relabeled an ND hosted/device case. Original 123 rows/20 finding definitions, Stage 0–7, completed 8.1, S8E01 and prior receipts are preserved.

## Owner handoff and next step

An optional complete PowerShell block is supplied in chat: fetch the audit branch, export the exact published candidate into a unique temp directory and run the Node verifier. **Expected: 70 PASS / 0 FAIL / exit 0, nine syntax checks.** Node's experimental TypeScript warning may appear and is non-failing. No checkout, npm install, PowerShell execution-policy change, deployment or SQL is required; the exported SQL is read as source only.

The verifier starts local child Node processes with synthetic ports. No notification, permission request, subscription/account/fixture/SQL/Auth/Storage setting, provider/key/cron/Vault configuration, actual production or native action was performed. Retained fixtures/two conversions remain outside these checks. Offline `candidate_deployed=false` is not a fresh deployment probe.

**8.2 is complete at source-candidate/selected-local-regression scope. Next 8.3 records one bounded readiness/delivery/device outcome; full Stage 8 report 8.4.** Actual native push SDK/transport/registration remains unimplemented in this candidate. APK update remains deferred; release gate remains OPEN_PENDING_REQUIRED_EVIDENCE and accepted remediation/full re-audit remain required.
