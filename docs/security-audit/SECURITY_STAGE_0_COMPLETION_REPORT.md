# 0.6 — Stage 0 completion audit report and action plan

Mushavo Budget · 7 October 2026 · Owner-approved **CLOSED BASELINE WITH CARRY-FORWARD**.

The owner approved the Stage 0 sign-off and Stage 1 start on 7 October. Documentation PR #91 merged at 05:51:06Z into `067cb5f00ad7f644647926c5fd1e82a5c754f058`. At Stage 0 close, Stage 1 began at **1.1 — Account security and recovery**, with provider verification pending. Later current-step outcomes are tracked in [audit progress](SECURITY_AUDIT_PROGRESS.json) and [Stage 1 evidence](security-stage-1-evidence.json). This report completes baseline collection and records unresolved work; it does not clear the app for stores or certify all controls/security/recovery/native behavior.

## Result summary

| Area | Result at Stage 0 close | Evidence limit |
|---|---|---|
| Master coverage | All 123 sections mapped; all 20 original findings preserved | Worklist/applicability coverage, not 123 completed tests |
| Original priorities | 17 P1 and 3 P2 in the dated baseline | Mixed store/security/evidence priorities; not reclassified without source evidence |
| Private-table metadata diagnostic | Initial 12 PASS / 1 FAIL / 7 REVIEW / 4 CANNOT VERIFY; repaired 13 PASS / 7 REVIEW / 4 CANNOT VERIFY | 24 owner-supplied metadata rows; no final live JWT/data-access guarantee |
| Currency helper diagnostic | 10 PASS / 1 REVIEW / 1 CANNOT VERIFY, zero FAIL | 12 owner-supplied effective-grant/caller properties; scheduler/workflow/history remain unverified |
| Business notification SQL | Owner 8/8 PASS | Metadata/invariants; no full live event/action/denial matrix inferred |
| Automated tests | Historical suites 387 → 395 → 406; latest full invitation-candidate run 406/406; later focused 18/18 | Snapshots of evolving suites, not additive totals or production/native tests |
| SQL behavior fixtures | Selected actual migrations/RPC/policies pass disposable PGlite 0.5.8 checks | Synthetic environment; some surrounding helpers are substitutes |
| Native assets/dependencies | Locked clean install, actual asset/consumer checks PASS locally/owner Windows/CI; scoped npm audit zero known findings | Web packaging/npm snapshot; no compiled/signed APK/AAB/iOS artifact or physical-device proof |
| Deployed frontend/invitations | Merged 4.9.40 source/checks; owner revised notification UI working | Dated source/normal owner behavior; full individual action/replay/denial/realtime cases remain open |
| SMTP | Owner sending worked after host correction | Normal sending outcome; current template save/rendering, redirects and every Auth email type not certified |
| Security headers/public notices | Sampled header families missing and policy/delete routes 404 | Dated sampled public/source findings, not an exploit or a fresh all-route result |
| Recovery/isolation/operations | No external backups, no staging project, no configured alerts; MFA tentative/unconfirmed | Owner facts/unknowns assigned to foundations; no recovery or security PASS |
| Native/store prerequisites | No Mac/Xcode or Play/Apple accounts; APK updating deferred | Later build/release gates remain open |

No single pass percentage is meaningful: fixtures, catalog properties, screenshots, normal owner smokes and missing prerequisites have different scopes. The 24- and 12-row diagnostics are not a replacement for the whole 123-section audit.

## 0.1 — Discovery and baseline inventory

Original repository baseline was `d2a32032b1c560bbae853de87837c3436ea44887`, web/PWA 4.9.39. The source inventory identified 48 baseline migrations and 79 declared application tables, Personal/Family/Business flows, public pages, Supabase RPC/Edge/Storage and browser Web Push. Later Stage 0 repairs add migrations; the baseline count is preserved as a dated inventory rather than rewritten as a current migration total.

Owner hosting evidence identifies **Cloudflare Workers Static Assets**, a main production build/domain and audit-branch version uploads. Earlier informal “Pages” wording is not the verified Cloudflare serving type. A separate GitHub Pages workflow also exists; its exact operational role and Cloudflare active version/traffic/TLS/redirect settings remain partly unverified. A public Worker version-preview URL does not isolate its Supabase backend.

All 123 master sections received applicability, evidence scope, next verification, owner and work-stage mappings. The 20 original definitions remain unchanged. Missing evidence is recorded as unknown rather than inapplicable. Limited current/history signature checks found no targeted private-key/secret-key/decoded service-role signature matches; this was not a comprehensive secret or full supply-chain scan.

## 0.2 — Repository and isolated verification

The original automated suite passed 387/387. Security evidence/native build additions brought a later suite to 395/395 on Linux Node 22.17.0 and 24.19.0; the invitation follow-up's historical full suite passed 406/406 with concurrency limited to two. A later targeted invitation/refresh recheck passed 18/18. Do not sum these suites or infer a full browser/device pass. The custom-role browser fixture could not launch because Chromium was absent; this is NOT TESTED, not a proven UI failure.

Disposable PGlite checks exercised selected custom-role, budgets/approvals, reports, billing, realtime, metadata, private-read, currency-helper and invitation SQL behavior. Positive/negative grant, scope, rollback, expiry/idempotency and protected RPC cases were included. Some surrounding services/permission/billing helpers in the focused invitation fixture were substitutes; the separate complete custom-role verifier passed. These tests do not establish real production JWT, Storage download, websocket removal, scheduler or concurrency behavior.

GitHub PR CI at `2c4b570` passed automated checks, locked asset/consumer and SQL steps; deployment was correctly skipped for a PR. The merged 4.9.40 commit had successful deployment/build/release checks. Before documentation PR #91 merged, Workers Builds and Verify production release were successful at its approved head; deploy was skipped by `github.event_name != 'pull_request'`. None of these checks builds a signed native release.

## 0.3 — Live metadata and external settings

The initial owner diagnostic had 24 rows: 12 PASS, one FAIL, seven REVIEW and four CANNOT VERIFY. All 79 expected tables had RLS and required buckets were private with type/size limits. The failure was effective anonymous SELECT on seven private tables. After the narrow repair, only that row changed: 13 PASS, seven REVIEW, four CANNOT VERIFY, zero FAIL. RLS targeting authenticated means the initial SELECT grant alone did not prove customer data exposure.

The helper recheck had 12 rows: ten PASS, one REVIEW and one CANNOT VERIFY. Direct anon/authenticated execution on the two internal helpers was absent, while service and protected caller access and existing entry-point metadata remained. Five protected caller owners, six signed-in currency entry points and two public lookups retained the checked access. The anonymous SECURITY DEFINER inventory went from 61 to 59, removing exactly those two helper signatures. Remaining functions require classification/actual authorization checks; blanket revocation is not an action plan.

Live helper definition checks were limited to SECURITY DEFINER and pinned search-path metadata rather than body retrieval. Legitimate payment/settings writes, scheduled execution, historical conversion integrity and the full tenant/API/export/Storage/realtime matrix remain unverified. Catalog PASS is not authorization PASS.

Auth screenshots/owner reports show Email enabled, Phone disabled, secure email change on, minimum length six, secure/current-password/leaked checks off in the displayed baseline; Confirm email was only then enabled. Apple is screenshot-disabled; Google owner-reported disabled. A new signup email arrived, pre-confirmation sign-in was denied and correct-account normal sign-in worked after confirmation at owner smoke scope. Historical previously auto-confirmed accounts are not proven inbox-verified by a newly enabled toggle.

The specified Admin invitation smoke passed: identity prefilled, no workspace access through Back to sign in before completion, correct workspace/plan/currencies after fresh setup. Direct API denial, premature DB-row absence, old-link invalidation and expiry/replay were not captured. Initial redirect screenshots showed a signup-only allowlist, not the Business source callback; later normal Business behavior does not independently establish the entire saved allowlist/APP_ORIGIN/template/rate/session/MFA configuration. Recovery remains separate evidence.

Public source/GET samples identified seven absent header families (CSP/report-only CSP, HSTS, nosniff, frame policy, Referrer-Policy and Permissions-Policy), missing public policy/deletion routes and Cloudflare analytics. These are dated sampled/source findings. The independent 7 October source recheck received 403 from this execution path; no fresh all-route PASS or new outage was inferred.

## 0.4 — Native baseline and tooling

The owner's Windows Node was 22.17.0; application ID/namespace `com.mushavo.budget`, app name Mushavo Budget and webDir www were preserved. Installed core/CLI/Android were already 8.5.2. Selected source values were min/compile/target SDK 24/36/36, Gradle 8.14.3, Android Gradle plugin 8.13.0, versionCode 1/versionName 1.0 and density handling. These source values are not a merged/signed manifest or actual toolchain execution result.

The old local asset builder deleted www first, skipped missing copies and omitted Business/launcher/native bridge files. Repository repair pins the established Capacitor packages, includes App 8.1.2/Preferences 8.0.1/esbuild 0.28.2, builds complete assets and preserves/restores the prior output when inputs/bundling/promotion fail. Five filesystem regressions cover normal/repeated packaging and failure preservation; the successful bundle uses actual dependencies. Nine HTML pages, 85 local references and a bridge bundle were checked at the dated native follow-up.

The original Windows checkout's local native/package/config edits remain untouched. Verification ran in a separate detached Native Audit worktree. Initial three moderate npm entries reproduced as a UUID advisory through CLI → xcode → uuid. The scoped xcode 3.0.1 override moves UUID alone to 11.1.1 while retaining Capacitor pins/other locked paths. CommonJS template parse/edit/write/reparse, nine invalid buffer cases, three valid methods and 256 generated identifiers passed locally and on owner Windows; npm audit then reported zero known findings. Native/CDN/Edge dependencies and final artifacts remain a separate assessment.

No APK was built or updated by this audit. The user explicitly deferred APK updating. No Mac/Xcode or store accounts are available. Selected allowBackup=true without supplied full explicit exclusions and missing inspected secure-session adapter require full artifact/token/backup/device-transfer review; token leakage is not established by those selected source lines.

## 0.5 — Repairs and invitation/SMTP follow-ups

| Demonstrated problem | Completed action and recheck | Residual scope |
|---|---|---|
| Unnecessary anonymous SELECT on seven private tables | Narrow anon/PUBLIC read-grant migration; preserves effective authenticated/service access; isolated allowed/denied/rollback fixtures; owner diagnostic 08 now PASS | Full JWT/RLS/data-access matrix still required |
| Direct API-role internal currency helpers | Narrow effective EXECUTE restriction with service/protected caller/legitimate entry-point retention; isolated actual-source checks; owner ten-property helper PASS | Scheduler/legitimate workflows/history and other 59 anonymous functions need evidence |
| Clean native asset build missing dependencies/incomplete destructive builder | Pinned compatible dependencies and complete failure-preserving builder; isolated regressions/actual bundles; Windows and CI PASS | Original native checkout reconciliation, compile/signing/devices not done |
| UUID dependency advisory | Version-scoped override and real CommonJS/UUID consumer checks; dated local/Windows audit zero known findings | No global dependency/native/secret guarantee |
| Business request absent from main Notifications; generic email | Server-managed deduplicated notifications, protected recipient Accept/Decline and safe Business routing/rendering; conditional templates prepared; owner SQL 8/8 PASS; 406/406/SQL fixtures | Hosted template wording/rendering/current redirects and full behavior/event matrix remain unverified |
| Notification visible but missing controls/broken Open | Public code still 4.9.39 explained the gap; merged 4.9.40 controls/route and dated exact source verification; owner says now working | Individual action/replay/denial/device/live refresh cases not inferred from general working report |
| Auth email timeout/duplicate Create | Redacted /otp 504 request_timeout log; existing pending invitation remains; owner corrected wrong SMTP host and reports sending worked | Use Resend for an existing pending request; no SQL rerun needed solely for SMTP; full mail-type/settings evidence remains open |

PR #90 merged the reviewed source/runtime follow-up into main `464f52c39ff56cc57bf8dfd2b0e35bd3d51a4436`. The dated public app.js?v=112 matched candidate SHA-256 `3db774eb22115bd0b5ff6c4e0c2a93a4efd249e33360b3008a4391a3d8febbb2`; pwa.js identified 4.9.40. Hosted template files do not save themselves into Supabase. Zoho's API and SMTP host distinction was corrected at owner scope; no secret or recipient/private Auth link was retained.

The full signed Auth Send Email Hook/shared template/application dispatcher architecture remains a Stage 6 proposal. No such new hook/queue/mailer is activated. Existing normal SMTP and in-app invitation functionality are preserved while later designs are verified.

## 0.6 — Owner prerequisites, acceptance and unresolved actions

| Owner input | Recorded result | Remaining dependency |
|---|---|---|
| Separate staging Supabase project | No | Establish isolation; preview URL alone is insufficient |
| Supabase plan/PITR | Free; Point in time upgrade screen | Feasible external protection/recovery, no paid purchase implied |
| External database/uploaded-file copies | No | Separate protected database/file coverage and restore proof |
| Infrastructure two-step | Thinks only GitHub; no independent check | Actual sign-in path/factor/recovery verification at 1.1 |
| Automatic error/outage/spending alerts | No | Feasible alerts, delivery and incident runbooks |
| Support | support@mushavobudget.com designated | Mailbox/response ownership/delivery not tested |
| Individual/business operator | Undecided | Factual operator/identity/billing/store decisions later |
| Launch | Worldwide | Actual territory/processor/privacy/store rule rechecks before release |
| Age audience | Unspecified | Later audience/privacy/store decision; no adult-only/child-safe claim |
| Mac/Xcode, Play/Apple accounts | None | Native build/account/enrollment/release prerequisites |
| APK/full email architecture | Deferred | Separate accepted native/email stages |

Owner sign-off closes the baseline with these gaps assigned. Stage 1 is authorized, starting 1.1 inspection rather than an assumed provider-account PASS. Every stage ends with a report; outstanding failed/uncertain/blocked/decision items stay in the central register for final resolution and a fresh full re-audit. Existing approved stage work continues; an impossible check is recorded with its missing prerequisite instead of using a riskier production substitute. Final unresolved blockers keep release gates open.

## Action plan for all original findings

The 20 rows below contain the current residual observation, concrete action, responsible owner/stage and final closure test. The original definitions are preserved in the baseline; these current actions supplement them. **PARTIAL PASS is not whole-finding closure.** No new unsupported priority score or evidence is introduced.

### F01 — Public policies and support notices

**Current result:** GAP / confirmed missing. Source lacks dedicated policies; sampled privacy/terms routes returned 404. Operator is undecided, launch worldwide and age audience unspecified.

**Action:** Resolve actual operator/age/territory/data/retention facts, then publish factual privacy/terms/support notices and functioning links.

**Owner/work stage:** Owner/Both; 4,9.

**Final closure/re-audit evidence:** Public URLs return the intended notices; logged-in/signup/native/store surfaces link to the same factual versions; processor/retention facts match actual behavior.

### F02 — Account deletion and shared ownership

**Current result:** GAP / decision required. No tracked user deletion process or sampled public deletion resource; shared household/business finance/file ownership complicates deletion.

**Action:** Define ownership transfer, shared-record retention and personal-data removal, then implement authenticated deletion with provider/Storage cleanup.

**Owner/work stage:** Both; 4,9.

**Final closure/re-audit evidence:** Owned synthetic users complete deletion; unauthorized/replayed requests fail; retained shared records and removed personal files/tokens follow the agreed rules.

### F03 — Native subscriptions and billing

**Current result:** GAP / decision required. Manual web proof/review exists; native store purchases and entitlement reconciliation are absent from inspected source.

**Action:** Decide channel/plan/seat mapping, then implement server verification, idempotent entitlement updates, refunds/restore and web/native consistency.

**Owner/work stage:** Both; 7,9.

**Final closure/re-audit evidence:** Actual sandbox purchases, restore/refund/expiry/replay and cross-channel seat/plan cases match server-authoritative entitlement outcomes.

### F04 — Google/Apple login and linking

**Current result:** GAP / future integration. Both providers disabled by screenshot/owner scope; no tracked integration. This is a planned feature gap, not a failed working social-login test.

**Action:** Design supported providers/callbacks/linking and invitation collisions; implement only the agreed flows and correct purpose-aware emails.

**Owner/work stage:** Both; 6,9.

**Final closure/re-audit evidence:** Controlled web/PWA/native sign-in, cancellation, mismatched identity, existing-account linking and invitation collision cases pass with exact supported callbacks.

### F05 — Native release and store readiness

**Current result:** UNSURE / prerequisites absent. Selected Android source values/identity supplied; no Mac/Xcode or store accounts, merged/signed release artifact or device matrix available.

**Action:** Preserve signing/app identity, establish native/tool/store prerequisites and build/review actual artifacts on accepted environments.

**Owner/work stage:** Owner/Both; 5,9,10.

**Final closure/re-audit evidence:** SDK/toolchain, complete merged manifest, permissions/signing, physical-device behavior and required store-account testing evidenced for the final release.

### F06 — Native dependency and asset build

**Current result:** PARTIAL PASS / native unknown. Pinned/locked asset build, UUID consumer checks and zero known npm findings pass; original Windows native project and final compile/device acceptance remain unresolved.

**Action:** Reconcile original local edits without reset; maintain compatible pins and failure-preserving complete asset packaging, then compile and inspect actual native output.

**Owner/work stage:** Both; 1,5,9.

**Final closure/re-audit evidence:** Clean locked install/consumer/asset checks repeat; packaging failure preserves old assets; final native artifacts contain complete latest pages/bridge and pass device smoke checks.

### F07 — Browser security headers

**Current result:** GAP / sampled live failure. Seven header families missing from sampled responses; serving layer identified as Workers Static Assets, with mapping partly evidenced.

**Action:** Add compatible serving-layer headers/CSP in isolation, check required CDN/Auth/assets, then verify actual served header/routes and native-origin compatibility.

**Owner/work stage:** Both; 2,5,9.

**Final closure/re-audit evidence:** Header/CSP checks on public/app/assets and redirects; ordinary signup, invitation, push, downloads and supported native origins still work; deliberate injection/frame checks behave as intended.

### F08 — Admin MFA, password and Auth UX

**Current result:** GAP / partial owner PASS. App Admin MFA/aal2 absent; minimum length 6 and secure/current-password checks off in displayed baseline. Normal confirmation/Admin setup owner-PASS; wider protection unverified.

**Action:** Coordinate server-enforced Admin step-up with UI, password/recovery/setup behavior, rates/session policy and unconfirmed-email guidance. Verify infrastructure access through actual sign-in paths in 1.1.

**Owner/work stage:** Both; 1,3,9.

**Final closure/re-audit evidence:** Direct privileged API denies inadequate assurance; authorized step-up works; confirmation/setup cannot be bypassed; normal recovery, password changes, expiry and rate/failure cases pass.

### F09 — Contact/enquiry abuse control

**Current result:** GAP / source finding. Direct client insertion with column validation exists; authoritative challenge/quota enforcement absent in the reviewed submission path.

**Action:** Define server-authoritative submission/challenge/quota and input policy, retain ordinary enquiries and audit safe failure behavior.

**Owner/work stage:** Developer; 2,9.

**Final closure/re-audit evidence:** Normal controlled submissions succeed; forged/missing challenge, malformed/oversized data and repeated abusive submissions are denied without exposing private enquiries.

### F10 — Native origins and callbacks

**Current result:** UNSURE / conditional. APP_ORIGIN checks exist, but actual native/local origins and final callback configuration are not established.

**Action:** Inventory actual deployed/native origins, retain verified identity/authorization and support explicit required callbacks rather than broad origin relaxation.

**Owner/work stage:** Both; 5,6,9.

**Final closure/re-audit evidence:** Supported web/PWA/native callbacks succeed; unrelated origins, edited identity/request links and expired/revoked links fail with safe routing.

### F11 — Native notifications

**Current result:** UNSURE / native transport. Browser Web Push works at owner smoke scope; FCM/APNs/native transport and private physical-device behavior unverified.

**Action:** Select and implement/reconcile native transport as required; bind tokens to actual users/devices and define private notification content.

**Owner/work stage:** Both; 8,9.

**Final closure/re-audit evidence:** Closed/minimized delivery on actual devices, sign-out/account-switch token cleanup, permission revocation, route handling and lock-screen privacy checks pass.

### F12 — Web Push outbound destinations

**Current result:** GAP / source finding. Reviewed senders use stored Web Push endpoints without explicit destination/network controls; no exploitation is established.

**Action:** Assess actual endpoint provider rules and implement justified egress/destination controls with compatibility and failure/retry handling.

**Owner/work stage:** Developer; 2,8,9.

**Final closure/re-audit evidence:** Controlled private-network/malformed/redirect/rebinding cases are blocked where applicable; legitimate provider endpoints still deliver and retries do not cause duplicate/unsafe requests.

### F13 — Uploads and downloads

**Current result:** GAP / validation needs improvement. Buckets/type/size metadata restrictions present; content-signature/normalization controls absent from inspected source and effective download validation untested.

**Action:** Add justified server content/size/quota validation, safe storage/download treatment and ownership authorization; preserve accepted file types.

**Owner/work stage:** Developer; 4,9.

**Final closure/re-audit evidence:** MIME/signature mismatch, malformed/oversized/unauthorized uploads/downloads denied; valid owned files render/share safely with correct access and size behavior.

### F14 — Native sessions and device/cloud backup

**Current result:** UNSURE / native source gap. No inspected secure native session adapter; selected owner manifest allowBackup=true with no reported explicit exclusions. No token exposure established.

**Action:** Inspect full merged artifact/session storage; define secure sensitive storage and cloud/device-transfer exclusions, expiry and account-switch handling.

**Owner/work stage:** Both; 5,9.

**Final closure/re-audit evidence:** Artifact/storage inspection and device backup/restore/transfer tests exclude sensitive session material; expiry/sign-out/switch/resume behavior preserves correct identity and workspace.

### F15 — Supabase grants, tenant and currency workflows

**Current result:** PARTIAL PASS / wider behavior unsure. Both narrow grant metadata rechecks PASS; remaining 59 anonymous SECURITY DEFINER signatures need classification. Live JWT/storage/realtime/scheduler/history matrix unverified.

**Action:** Review actual function authorization without blanket revokes; verify legitimate currency/payment/settings/scheduler paths and direct allowed/denied tenant/file/event behavior in isolation. Reconcile current redirects/APP_ORIGIN.

**Owner/work stage:** Both; 1,3,7,8,9.

**Final closure/re-audit evidence:** Real controlled JWT callers exercise own/other/removed users, public/server/protected functions, files/exports/realtime; authorized currency writes and scheduler preserve historical integrity; replay/tampering denied.

### F16 — Database and uploaded-file recovery

**Current result:** KNOWN GAP / recovery unsure. Owner Free, PITR not enabled and no external database/file backups; actual restore history/provider-internal recovery not verified.

**Action:** Establish protected external database plus file/configuration coverage, retention/completeness checks and isolated recovery evidence with explicit targets.

**Owner/work stage:** Both; 1,9.

**Final closure/re-audit evidence:** Owner-held artifacts cover selected data/roles/files/config dependencies; failure/incomplete-run detection works; isolated restore with integrity/scope checks and realistic completeness limits is documented.

### F17 — Apple privacy manifests and SDKs

**Current result:** UNSURE / artifact missing. Preferences UserDefaults/CA92.1 documented; actual iOS archive/manifests/SDK signatures uninspected.

**Action:** Inventory actual SDK data/required reasons; include and validate correct manifests/signatures in the final iOS archive.

**Owner/work stage:** Both; 5,9.

**Final closure/re-audit evidence:** Final archive/privacy report and SDK/reason declarations match shipped APIs/data use; device/build/store validation completed for that artifact.

### F18 — Repository/tool/dependency protection

**Current result:** PARTIAL PASS / supply chain unsure. Locked asset CI and scoped npm repair pass; limited signatures have no matches. Wrangler command version/native/CDN/Edge/artifact/history/protection evidence incomplete.

**Action:** Reconcile tooling/deployment provenance, pin justified build tools, review repo access/protection and perform appropriate dependency/history/artifact scans without exposing secrets.

**Owner/work stage:** Both; 1,5,9.

**Final closure/re-audit evidence:** Actual tool versions/locked installs/CI provenance recorded; relevant scans and protection/access checks complete; final native/web/Edge artifacts contain no unauthorized secrets/development assets.

### F19 — Staging, monitoring and incident operations

**Current result:** KNOWN GAPS / operations unsure. No separate staging, no configured alerts; support selected but operation unverified. Hosting/version/traffic/TLS/Pages roles, schedules/budget/incident runbooks partial.

**Action:** Establish isolated synthetic environment, read-only deployed/cron inventory, actual alert/support routing, owner/budget/incident/export/restore runbooks and serving-layer mapping.

**Owner/work stage:** Both; 1,10.

**Final closure/re-audit evidence:** Staging cannot use production data/config or dispatch production messages; failed job/export/outage triggers verified routing; operator can follow runbooks; deployed version/schedule/usage ownership reconciled.

### F20 — Collection, privacy and disclosures

**Current result:** GAP / decisions and inventory. User-linked activity-hour analytics, push device/user-agent fields and injected Cloudflare analytics observed; complete processor/retention/native SDK/audience/operator inventory missing.

**Action:** Inventory actual collected data and processors/SDKs, purpose/retention/sharing and age/operator/territory decisions; align notices and store declarations with actual implementation.

**Owner/work stage:** Both; 4,5,9.

**Final closure/re-audit evidence:** Inventory matches actual data flows/SDKs and retention/deletion; public notices, consent where applicable and store Data safety/App Privacy declarations reflect the final worldwide-supported release.

## Final resolution and fresh re-audit

All residual rows remain in [SECURITY_AUDIT_CARRY_FORWARD.md](SECURITY_AUDIT_CARRY_FORWARD.md). At the end of the audit, resolve remaining failures/decisions and obtain missing evidence, then run a fresh full audit against the actual final versions/deployments/artifacts. Re-test unchanged areas/regressions as well as repaired controls. Real allowed/denied JWT/file/realtime cases, legitimate finance/scheduler/history, recovery, Auth purpose/identity, native/device/store evidence and factual notices must retain separate observed results. Final remediation/full re-audit is planned, not yet performed.

Relevant supporting records: [baseline evidence/definitions](SECURITY_STAGE_0_BASELINE.md), [owner sign-off](SECURITY_STAGE_0_SIGNOFF.md), [audit workflow](SECURITY_AUDIT_WORKFLOW.md), [Stage 1 plan](SECURITY_STAGE_1_FOUNDATIONS_PLAN.md), [active 1.1 checks](SECURITY_STAGE_1_1_ACCOUNT_CHECKS.md) and redacted `security-stage-0-evidence.json`. Historical evidence remains unchanged; Stage 0 closed does not turn its CANNOT VERIFY/REVIEW rows into PASS.

## Appendix — all 123 section results at baseline close

This is the dated coverage/evidence snapshot at Stage 0 close. Applicability/status strings identify actual limits and next checks; they are not a penetration-test score. Full source/owner evidence references are in the register and redacted JSON. Each row maps to its finding/stage/owner where applicable.


## Sections 1–25

| Section | Applies | Status / test result | Evidence and next verification | Finding | Stage | Owner |
|---|---|---|---|---|---|---|
| 1. PROJECT DISCOVERY | Yes | BASELINE CLOSED / STAGE 1.1 IN PROGRESS | E33 owner accepts collected baseline with known gaps and authorizes foundations. Actual account/recovery checks at 1.1 pending; no broader deployment/security clearance inferred. | F05,F20 | 0 | Both |
| 2. PRESERVE EXISTING ARCHITECTURE | Yes | VERIFIED PROCESS | Stage 0 additions preserve application and financial architecture; review every later diff. | — | All | Developer |
| 3. AUDIT CLASSIFICATION | Yes | VERIFIED PROCESS | This register separates local passes, gaps, decisions and unavailable evidence. | — | All | Developer |
| 4. EVIDENCE REQUIREMENT | Yes | VERIFIED PROCESS | E1–E33 retain chronology/scopes; owner mandates stage reports, message numbers and final residual resolution/full re-audit. Findings close only with observed recheck evidence. | — | All | Both |
| 5. NO FAKE DATA OR CLAIMS | Yes | VERIFIED PROCESS | No production data or invented claims used; fixture identities are explicitly synthetic. | — | All | Developer |
| 6. SECRETS AND CREDENTIALS | Yes | PARTIAL | E6 found no targeted secret signatures; full historical/artifact/provider scan outstanding. | F18 | 1 | Both |
| 7. PUBLIC ENVIRONMENT VARIABLE PREFIXES | Yes | CONDITIONAL | No VITE/NEXT-style build variables found; inspect actual native/web release assets and future tooling. | F18 | 1,5 | Developer |
| 8. FRONTEND BUNDLE SECRET AUDIT | Yes | PARTIAL | E6 tracked-text signatures only; inspect final web/native bundles and maps, not just source. | F18 | 1,5 | Developer |
| 9. DATABASE PUBLIC KEY VS ADMIN KEY | Yes | SOURCE PRESENT | config.js uses a publishable key; Edge secrets come from env. Verify actual builds and deployed credentials without exposing values. | F15,F18 | 1,3,5 | Both |
| 10. VERIFIED SERVER IDENTITY | Yes | SOURCE PRESENT | Invitation handlers use auth.getUser and protected RPCs; live edited-token/direct-call cases pending. | F15 | 3 | Developer |
| 11. JWT / TOKEN VERIFICATION | Yes | SOURCE PRESENT | Custom cron checks coexist with verify_jwt=false; prove absent/wrong bearer and cron headers fail in staging. | F15 | 3 | Developer |
| 12. AUTHENTICATION | Yes | NORMAL AUTH/INVITATION OWNER-PASS / WIDER CHECKS OPEN | E20/E21 confirm normal confirmation/Admin UI; E23 notification SQL 8/8 PASS. E27 adds merged revised Business UI owner-PASS; E28 SMTP correction owner-PASS. Hosted template/redirect evidence, source notices, recovery, social login, Admin step-up and wider authorization remain open. | F04,F08 | 3,6 | Both |
| 13. PASSWORD SECURITY | Yes | CONFIGURATION GAP / PARTIAL | E17 shows minimum length 6 and secure/current-password checks off. E20 confirms normal pre/post-confirmation sign-in outcomes. Coordinate password policy/invitation/recovery UI changes; separate reload, rates and broader failure cases remain unverified. | F08,F15 | 0,3 | Both |
| 14. SESSION STORAGE | Yes | NEEDS EVIDENCE | Browser sessions exist; E13 source reports allowBackup=true without supplied explicit backup rules. Inspect/test actual native token storage and cloud/device transfer exclusions. | F14 | 5 | Both |
| 15. AUTHORIZATION | Yes | LOCAL PASS / LIVE UNKNOWN | E3 role/scope tests pass; repeat permitted/denied RPC, row, export and object operations with real staging JWTs. | F15 | 3 | Developer |
| 16. PRIVILEGE ESCALATION | Yes | LOCAL PASS / LIVE UNKNOWN | E3 owner, override and assignment guards pass; verify direct field/role spoofing against deployed API. | F15 | 3 | Developer |
| 17. ROW LEVEL SECURITY | Yes | LIVE FLAGS AND GRANT RECHECK PASS | E9 confirms RLS on 79 expected tables and post-fix absence of the checked private-table anonymous SELECT grants. Staging identities still need to test policies. | F15 | 0,3 | Both |
| 18. MULTI-TENANT ISOLATION | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E5 test scopes/workspace isolation; verify Personal/Family/Business and former members directly. | F15 | 3 | Developer |
| 19. MASS ASSIGNMENT | Yes | SOURCE PRESENT | Protected RPCs/column grants narrow updates; E9 checks profile column grants. Test unexpected ownership/role fields. | F15 | 3 | Developer |
| 20. SQL AND QUERY INJECTION | Yes | NEEDS VERIFICATION | Client queries/RPC parameters exist; inspect all dynamic SQL and use controlled search/filter payloads in staging. | F15 | 3,9 | Developer |
| 21. OTHER INJECTION RISKS | Yes | NEEDS VERIFICATION | No shell/LLM backend found; review URL/formula/content sinks and later native callbacks. | F12,F13 | 2,4,9 | Developer |
| 22. CROSS-SITE SCRIPTING | Yes | PARTIAL | escapeHtml and DOM construction exist; no exploit established. Exercise stored/reflected inputs, URLs and exports plus tested CSP. | F07,F13 | 2,4,9 | Developer |
| 23. INPUT VALIDATION | Yes | PARTIAL | E2/E3–E5 exercise selected SQL validation; review every ingress and malformed upload/large payload case. | F09,F13,F15 | 2,3,4,9 | Developer |
| 24. EXCESSIVE DATA EXPOSURE | Yes | HELPER GRANT RECHECK PASS / FURTHER VERIFICATION | E12 reproduces the original helper gap in fixtures and confirms post-repair live EXECUTE metadata PASS. Check live workflows/historical integrity and other actual API/error/export/notification payloads; remaining anonymous inventory is 59. | F15,F20 | 3,8,9 | Developer |
| 25. RATE LIMITING | Yes | NEEDS WORK | Test-push cooldown and invite limits present; direct contact route lacks authoritative quotas/challenge evidence. | F09 | 2 | Developer |

## Sections 26–50

| Section | Applies | Status / test result | Evidence and next verification | Finding | Stage | Owner |
|---|---|---|---|---|---|---|
| 26. COST-BEARING ENDPOINT PROTECTION | Yes | NEEDS WORK | Invitation/push guard source exists; review email/upload/export/job cost budgets and direct bypasses. | F09,F12,F19 | 1,2 | Both |
| 27. BILLING CAPS AND COST ALERTS | Yes | CANNOT VERIFY | Provider spend limits, alert routes and monthly operating targets unavailable; owner evidence required. | F19 | 0,1 | Owner |
| 28. BOT PROTECTION | Yes | NEEDS WORK | Direct enquiries insertion has no server-verified challenge path in reviewed source; bypass testing required after fix. | F09 | 2 | Developer |
| 29. FILE UPLOAD SECURITY | Yes | NEEDS WORK | Private buckets/metadata limits present; actual file signature, quotas, malformed PDF/image and path cases pending. | F13 | 4 | Developer |
| 30. UPLOAD EXECUTION ISOLATION | Yes | NEEDS VERIFICATION | Uploads use Storage, not server code execution; test content types/download behavior on actual hosting/native viewers. | F13 | 4,9 | Developer |
| 31. PRIVATE FILE STORAGE | Yes | SOURCE PRESENT / LIVE UNKNOWN | Short-lived signed URLs/private bucket policies present; E9 checks configuration, then cross-tenant object tests required. | F13,F15 | 3,4 | Both |
| 32. SENSITIVE DATA ENCRYPTION | Yes | PARTIAL | E7 uses HTTPS; at-rest coverage, key management and native tokens require provider/artifact evidence. | F14,F16 | 1,5 | Both |
| 33. CSRF | Yes | NEEDS VERIFICATION | Bearer API rather than custom cookie backend is tracked; inspect actual OAuth state/PKCE, session and future callbacks. | F04,F15 | 3,6 | Developer |
| 34. SECURITY HEADERS | Yes | CONFIRMED GAP | E7 sample lacks seven security-header families; E17/source identify Workers assets from `.`. Introduce compatible asset headers and verify live in Stage 2. | F07 | 2 | Both |
| 35. CORS | Yes | CONDITIONAL GAP | Explicit APP_ORIGIN checks exist; standard native origins may differ. Test actual origins without relaxing authorization. | F10 | 5 | Both |
| 36. DATABASE INTEGRITY | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E5 exercise selected constraints/relations. Inspect effective constraints and invalid cross-workspace relationships. | F15 | 3,9 | Developer |
| 37. DATABASE PERFORMANCE | Yes | NEEDS VERIFICATION | Indexes/pagination exist in source; no production query-plan/load proof. Use synthetic staging sizes and safe plans. | F15 | 9 | Developer |
| 38. DATABASE TRANSACTIONS | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E5 verify selected atomic workflows and rollback; direct staged concurrent mutations still required. | F15 | 3,7,9 | Developer |
| 39. IDEMPOTENCY | Yes | LOCAL PASS / LIVE UNKNOWN | E4 billing/actuals duplicate cases pass; test network retries and future purchase webhook replay/idempotency. | F03 | 7,9 | Developer |
| 40. CONCURRENCY | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E4 stale versions/locks/seat guards tested; run simultaneous sessions for quotes, approval and membership. | F15 | 3,7,9 | Developer |
| 41. DATABASE MIGRATIONS | Yes | PARTIAL | 48 tracked migrations plus accumulated schema; manually run SQL may bypass CLI ledger. Reconcile actual deployed objects. | F15 | 0,1 | Both |
| 42. BACKUPS | Yes | NO EXTERNAL BACKUPS, OWNER-REPORTED | E30 Free/PITR upgrade screen; E31 owner reports no database/uploaded-file copies outside Supabase. Establish external database-plus-file protection and verify recovery in Stage 1. Provider-internal backups/restore history are not certified. | F16 | 1 | Owner |
| 43. DISASTER RECOVERY | Yes | RESTORE HISTORY UNKNOWN | E30 establishes plan/PITR prerequisite limits, not recoverability. Ask whether any isolated database-plus-files restore drill exists; agree recovery targets and execute a controlled drill in Stage 1. | F16,F19 | 1 | Both |
| 44. ENVIRONMENT SEPARATION | Yes | NO STAGING PROJECT, OWNER-REPORTED | E30 explicitly confirms no separate Supabase testing project. E17 public Worker versions and fixed backend source do not provide isolation. Stage 1 must establish a synthetic backend/preview/inbox boundary before risky negative tests. | F16,F19 | 0,1 | Both |
| 45. FORGOTTEN ENVIRONMENT EXPOSURE | Yes | PARTIAL OWNER INVENTORY | E17 shows public production/version-preview workers.dev URLs and main custom domain. Inventory actual versions/old domains and backend isolation; no data exposure established. | F18,F19 | 1 | Owner |
| 46. PRODUCTION EXPOSURE SCAN | Yes | PARTIAL | Pages allowlist and assetsignore exist; inspect final deployed files, redirects, maps and unintended development exposure. | F18 | 1,2,9 | Developer |
| 47. DEPENDENCIES | Yes | SCOPED NPM REPAIR PASS / FURTHER AUDIT | E13–E16 locked asset builds and actual CommonJS/bounds consumer checks pass locally, on owner Windows and in CI; UUID 7.0.3 alone becomes 11.1.1 under xcode 3.0.1, with Capacitor pins unchanged. npm audit reports zero known findings locally and on owner Windows. Original-project reconciliation and broader supply-chain/artifact assessment remain open. | F06,F18 | 0,1,5 | Both |
| 48. WEBHOOK SECURITY | Conditional | CONDITIONAL / NO CURRENT FLOW | No incoming payment-provider webhook integration found; apply signature/replay controls when native commerce is selected. | F03 | 7 | Developer |
| 49. RAW WEBHOOK BODY VERIFICATION | Conditional | CONDITIONAL / NO CURRENT FLOW | No tracked raw-body payment webhook receiver; verify vendor protocol during Stage 7, not an invented current pass. | F03 | 7 | Developer |
| 50. APIs | Yes | PARTIAL | RPC/Edge contracts present; live error/auth/filter/pagination abuse matrix and compatibility checks pending. | F15 | 2,3,9 | Developer |

## Sections 51–75

| Section | Applies | Status / test result | Evidence and next verification | Finding | Stage | Owner |
|---|---|---|---|---|---|---|
| 51. SERVER-AUTHORITATIVE PRICING AND ENTITLEMENTS | Yes | LOCAL PASS / FUTURE WORK | E4 tests server quotes/pricing/seat approval; store entitlements and cross-channel reconciliation absent. | F03 | 7 | Both |
| 52. PAYMENT SECURITY | Yes | LOCAL PASS / FUTURE WORK | Manual proof/review SQL tested; native purchases/verification/refunds/restore need approved mapping and sandbox evidence. | F03 | 7 | Both |
| 53. BACKGROUND JOBS / AUTOMATION | Yes | SOURCE PRESENT / LIVE UNKNOWN | Dedicated cron guards/outboxes exist; deployed schedules/secrets presence/attempts/overlap need redacted evidence. | F19 | 0,1,8 | Both |
| 54. ERROR HANDLING | Yes | PARTIAL | Generic Edge errors and app feedback exist; inspect actual failure paths for leaking tokens/private payloads. | F19 | 1,9 | Developer |
| 55. RELIABILITY | Yes | PARTIAL | E2 regressions and E3–E5 workflows pass; outages/retry/reconnect/provider failures need staged end-to-end tests. | F19 | 1,8,9 | Developer |
| 56. LOGGING | Yes | NEEDS VERIFICATION | Error handling present; review actual retention/access/redaction without exporting customer logs. | F19,F20 | 1 | Both |
| 57. MONITORING | Yes | NO CONFIGURED ALERTS, OWNER-REPORTED | E32 owner reports no automatic error/outage/spending alerts. Observability/analytics/build checks are not alert-delivery evidence. Stage 1 must establish feasible thresholds, recipients/response and actual test receipt. | F19 | 1,10 | Owner |
| 58. INFRASTRUCTURE ACCOUNT MFA | Yes | GITHUB TENTATIVE / OTHER MFA UNCONFIRMED | E31 owner thinks two-step is enabled only for GitHub. GitHub remains believed enabled/unverified; Cloudflare/Supabase/Zoho unconfirmed. Both store accounts absent. Stage 1 verifies security/recovery before later hardening; no codes requested. | F08,F18 | 0,1 | Owner |
| 59. AUDIT TRAILS | Yes | SOURCE PRESENT / LIVE UNKNOWN | Business and admin audit definitions exist; E3–E5 check selected events. Verify read restrictions/tamper behavior/retention. | F15,F20 | 3,9 | Developer |
| 60. FINANCIAL DATA | Yes | LOCAL PASS / LIVE UNKNOWN | E4 calculations/snapshots/linked exclusions pass; validate finance regression matrix with live synthetic roles/currencies. | F03,F15 | 3,7,9 | Developer |
| 61. FORMS | Yes | PARTIAL | E2 covers selected form flows; browser/device validation, double-submit and keyboard behavior still need acceptance. | F15 | 9 | Developer |
| 62. BUTTONS AND LINKS | Yes | PARTIAL / BUSINESS REVISED UI OWNER-PASS | E25 retains the old public code defect; E27 confirms merged 4.9.40 markers and owner working response/navigation UI. Individual acceptance/decline/replay/cancellation/unauthorized cases and the remaining route/button matrix need staged tests. | F15 | 9 | Developer |
| 63. USER FEEDBACK | Yes | PARTIAL | App feedback exists; verify slow/failure/success states and accessible announcements on PC/phone. | F19 | 8,9 | Developer |
| 64. DESTRUCTIVE ACTIONS | Yes | DECISION / NEEDS VERIFICATION | Existing removes/transfers remain; account deletion requires explicit shared-record behavior and reauthentication. | F02 | 4 | Both |
| 65. MOBILE RESPONSIVENESS | Yes | NEEDS VERIFICATION | Responsive CSS exists; current custom-role browser check could not launch Chromium. PC/phone evidence required. | F05 | 8,9 | Developer |
| 66. NAVIGATION | Yes | LOCAL PASS / DEVICE UNKNOWN | E2 covers last-workspace routing and precedence; PWA and actual native resume/expiry/notification routes pending. | F05,F10 | 5,8 | Both |
| 67. ACCESSIBILITY | Yes | NEEDS VERIFICATION | No complete keyboard/screen-reader/contrast/zoom audit performed; test all release-critical controls. | — | 8,9 | Developer |
| 68. PERFORMANCE | Yes | NEEDS VERIFICATION | Public/app assets available; no measured startup/load/profile baseline. Use actual device/network and synthetic scale. | — | 8,9 | Developer |
| 69. POOR CONNECTION / OFFLINE | Yes | PARTIAL | Safe offline shell and preference fixtures exist; actual update/offline/reconnect and stale-data behavior pending. | F05 | 8 | Developer |
| 70. SEARCH | Yes | PARTIAL | Search filters exist; special characters, scope, debounce, pagination and no-result behavior need staged tests. | F15 | 9 | Developer |
| 71. TABLES / LARGE DATA | Yes | PARTIAL | SQL/browser source pagination exists; measure real large-list performance and cross-scope row boundaries. | F15 | 9 | Developer |
| 72. SEO | Yes | NEEDS VERIFICATION | Public HTML exists; inspect metadata/indexing/canonical URLs and exclude authenticated/private routes. | — | 9 | Developer |
| 73. MARKETING / PUBLIC UX | Yes | NEEDS WORK | Public pages exist; factual policy/support/deletion links and final screenshots/claims missing evidence. | F01,F02 | 4,9 | Both |
| 74. ANALYTICS | Yes | SOURCE PRESENT / DISCLOSURE GAP | User-linked hourly analytics and injected Cloudflare script exist; verify actual configuration, purpose and retention. | F20 | 0,4 | Both |
| 75. PRIVACY AND DATA GOVERNANCE | Yes | WORLDWIDE INTENT / OPERATOR AND AGE DECISIONS OPEN | E32 worldwide intent and operator undecided; age audience not specified. Processor/retention/operator/audience facts and public notices require Stage 4 work, with actual territory/store rechecks before release. | F01,F20 | 0,4 | Both |

## Sections 76–100

| Section | Applies | Status / test result | Evidence and next verification | Finding | Stage | Owner |
|---|---|---|---|---|---|---|
| 76. TERMS / SUBSCRIPTIONS | Yes | NEEDS WORK / DECISION | Manual web subscriptions work in fixtures; terms, native channel model and plan/seat mapping outstanding. | F01,F03 | 4,7 | Both |
| 77. EMAIL | Yes | SMTP OWNER-PASS / TEMPLATES AND FLOW MATRIX OPEN | E20/E21 normal signup/Admin UI and E23 SQL 8/8 PASS retained. E27 confirms merged working Business UI; E28 records timeout then SMTP host correction owner-success. Hosted subject/body/current redirect evidence, recovery, sender/rates and APP_ORIGIN remain unverified. E29 defers full email architecture to Stage 6 with operations/event dependencies. | F04,F15,F19 | 0,6 | Both |
| 78. SMS / WHATSAPP / PUSH | Yes | PARTIAL / NATIVE UNKNOWN | Browser Web Push source and owner-reported tests exist; actual native transport/token/account-switch/privacy tests pending. | F11 | 8 | Both |
| 79. ADMIN PANEL | Yes | NEEDS WORK | Protected admin RPCs exist; server-enforced Admin MFA/recovery missing source evidence. | F08 | 3 | Both |
| 80. ROLE PERMISSION MATRIX | Yes | LOCAL PASS / LIVE UNKNOWN | E3 custom roles/overrides/scopes tested; real test-user allowed/denied matrix and browser editor acceptance pending. | F15 | 3,9 | Developer |
| 81. AI / LLM SECURITY | No | NOT APPLICABLE TO TRACKED APP | No runtime AI/LLM integrations found in JS/TS/SQL/JSON/TOML search. Reassess if introduced or present in unseen native code. | — | Reassess | Developer |
| 82. AI AGENTS | No | NOT APPLICABLE TO TRACKED APP | No runtime autonomous-agent/tool-execution feature found; development assistance is not an app agent. | — | Reassess | Developer |
| 83. BUSINESS LOGIC | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E5 cover selected creation/review/history/concurrency. Full role/workspace/event regression remains. | F15 | 3,9 | Developer |
| 84. STATUS TRANSITIONS | Yes | LOCAL PASS / LIVE UNKNOWN | Selected claims/bills/budgets/subscriptions transitions tested; actual invalid transitions and replay require staging. | F03,F15 | 3,7,9 | Developer |
| 85. MOBILE APPLICATION SECURITY | Yes | PARTIAL SOURCE / RELEASE UNKNOWN | E13 includes selected source SDK/Gradle/manifest values. Full/merged components, WebView/network/backup protection and signing/device behavior remain unverified. | F05,F14 | 0,5 | Both |
| 86. MOBILE BUNDLE SECRETS | Yes | CANNOT VERIFY | No final APK/AAB/iOS archive available; scan release assets and embedded configuration without exposing secrets. | F05,F18 | 5,9 | Developer |
| 87. MOBILE SECURE TOKEN STORAGE | Yes | CANNOT VERIFY | No tracked secure native session adapter; inspect actual refresh-token storage and backup/access behavior. | F14 | 5 | Both |
| 88. DEEP LINK SECURITY | Yes | PARTIAL / NATIVE UNKNOWN | Browser route precedence tested; native app links, scheme ownership, OAuth validation and revoked records require devices. | F10 | 5,6,8 | Developer |
| 89. MOBILE BIOMETRICS | Conditional | PRODUCT DECISION | No biometric flow tracked and not universally required. Decide if offered; test secure step-up/storage when implemented. | F14 | 5 | Both |
| 90. PRINT / PDF OUTPUT | Yes | LOCAL PASS / DEVICE UNKNOWN | E4 checks report exports/snapshots/CSV formula escaping; actual print layouts and native share/download permissions pending. | F13,F15 | 5,9 | Developer |
| 91. INTERNATIONALIZATION | Yes | PARTIAL | Currencies supported and fixtures cover mixed values; locale/number input/labels and timezone expectations need acceptance. | — | 9 | Developer |
| 92. DATE AND TIME | Yes | LOCAL PASS / LIVE UNKNOWN | E2/E4 cover timezone/date/proration cases; run DST/UTC/month-end/recurrent reminder checks in staging. | — | 8,9 | Developer |
| 93. DOMAIN AND INFRASTRUCTURE | Yes | MERGED BUILD CHECK PASS / CONFIGURATION PARTIAL | E17 identifies Workers/main/domain. E27 confirms merge, successful Workers/Pages/release checks and 6 October 4.9.40 public source evidence. Exact Cloudflare traffic/version mapping, TLS/redirect settings, secondary Pages role and administration remain unverified. | F07,F19 | 0,2 | Owner |
| 94. COOKIE / CONSENT | Conditional | DECISION / NEEDS EVIDENCE | Cloudflare analytics observed; actual tracking/cookie/territory behavior determines notices/consent/ATT requirements. | F20 | 4,9 | Both |
| 95. SESSION EXPIRY UX | Yes | PARTIAL | E2 includes session/route behavior; late expiry during edits, upload, approval and native resume needs direct tests. | F14 | 5,6,8 | Developer |
| 96. REALTIME | Yes | LOCAL PASS / LIVE UNKNOWN | E5 private signals/revocation pass; live subscribed-user removal, reconnect and stale-topic behavior still required. | F15 | 3,8,9 | Developer |
| 97. IMPORT / EXPORT SECURITY | Yes | LOCAL PASS / LIVE UNKNOWN | E4 tests report escaping/scope snapshots; direct export authorization, malformed imports if offered and native output pending. | F15 | 3,9 | Developer |
| 98. THIRD-PARTY SERVICES | Yes | NEEDS INVENTORY | Supabase, CDN, currency/email/push/hosting dependencies exist; complete processors, SDKs, settings and retention register. | F20 | 0,4,5 | Both |
| 99. ACCOUNT DELETION | Yes | CONFIRMED MISSING | No tracked user-account-deletion process or sampled public deletion resource. Shared ownership/retention decision required. | F02 | 4 | Both |
| 100. ARCHIVING | Yes | LOCAL PASS / LIVE UNKNOWN | Custom-role archive constraints tested; verify remaining archived records/relationships/history and removal access in staging. | F15 | 3,4,9 | Developer |

## Sections 101–123

| Section | Applies | Status / test result | Evidence and next verification | Finding | Stage | Owner |
|---|---|---|---|---|---|---|
| 101. TESTING | Yes | PARTIAL / MERGED CHECKS AND OWNER SMOKES | E2–E5/E22 automated and isolated SQL checks pass; E16 earlier PR CI and E27 merged deployment checks pass. Owner normal email/invitation/UI and metadata checks retain scope. API/storage/realtime/device/accessibility/restore matrix remains later work. | F05,F15,F16 | All | Developer |
| 102. ADVERSARIAL VERIFICATION PASS | Yes | NOT COMPLETE | Negative fixture cases passed; no full penetration test or staging adversarial sweep is claimed. | F15,F18 | 3,9 | Developer |
| 103. SECURITY REPORT HANDLING | Yes | VERIFIED PROCESS / CONTINUE | This report avoids secret values/customer rows and does not publish exploit claims; handle future actionable vulnerabilities carefully. | — | All | Both |
| 104. CLEANUP | Yes | VERIFIED PROCESS | Merged Stage 0 includes narrow grants, dependency/build tooling, Business notification SQL/runtime/tests and scoped evidence. This follow-up changes documentation only. Generated native assets/platforms/APKs remain outside the branch. | — | All | Developer |
| 105. DOCUMENTATION | Yes | STAGE 0 REPORT COMPLETE / WORKFLOW ACTIVE | Detailed Stage 0 report, per-finding action plan, carry-forward register and numbered stage workflow published for review. Stage-end reports mandatory; Stage 1.1 account/security inspection started with owner evidence pending. | F19 | All | Both |
| 106. DISTRIBUTION CHANNELS, APP CLASSIFICATION & DEVELOPER IDENTITY | Yes | NO STORE ACCOUNTS / WORLDWIDE INTENT / OPERATOR UNDECIDED | E31 absent Play/Apple accounts; E32 operator undecided, support@mushavobudget.com designated and worldwide launch intent. Age audience unanswered; actual identity, territories, enrollment type and support operation remain later decision/verification gates. | F05,F20 | 0,9 | Owner |
| 107. PUBLIC PRIVACY POLICY, TERMS, SUPPORT & USER NOTICES | Yes | CONFIRMED GAP | Source policy pages absent and sampled routes 404; factual operator/support/terms/notices needed. | F01 | 4 | Both |
| 108. DATA SAFETY, APP PRIVACY LABELS & PROCESSOR INVENTORY | Yes | PROCESSOR INVENTORY AND DECLARATIONS OUTSTANDING | E32 worldwide intent, operator undecided and age audience unspecified constrain later factual disclosures. Actual SDK/data/retention inventory and Data safety/App Privacy forms remain Stage 4/5/9 work, with no compliance certification. | F20 | 0,4,9 | Both |
| 109. GOOGLE OAUTH PRODUCTION CONFIGURATION | Yes | OWNER-REPORTED DISABLED / SOURCE MISSING | E19 reports Google disabled; integration is not tracked. Plan clients/branding/domains/callbacks and login-only scopes in Stage 6; the provider-status screenshot request is complete. | F04 | 0,6 | Both |
| 110. NATIVE AUTHORIZATION, CALLBACKS & ACCOUNT LINKING | Yes | SOURCE MISSING / NATIVE UNKNOWN | Native external authorization/PKCE or nonce/callback/account linking unimplemented or uninspected. | F04,F10 | 5,6 | Developer |
| 111. APPLE LOGIN OPTION & PRIVATE RELAY | Yes | DISABLED / SOURCE MISSING / DECISION | E18 shows Apple disabled; login/relay integration is not tracked. Select qualifying iOS identity flow and test authenticated linking/invitation collisions in Stage 6. | F04 | 6 | Both |
| 112. ACCOUNT DELETION, OWNERSHIP & RETENTION | Yes | CONFIRMED GAP / DECISION | Deletion, owner transfer/closure, per-table retention and provider revocation require explicit design. | F02 | 4 | Both |
| 113. STORE BILLING & SEPARATION FROM RECORDED PAYMENTS | Yes | SOURCE MISSING / DECISION | Recorded expenses are separate from digital plan purchase; store-supported commerce/product/seat rules need design. | F03 | 7 | Both |
| 114. NATIVE RELEASE BUILD & SECURITY CONFIGURATION | Yes | ASSET BUILD PASS / APK DEFERRED / IOS ACCESS UNAVAILABLE | E13–E16 asset/consumer and CI checks pass; E30 confirms no Mac/Xcode access. Native compile/merged-manifest/signing/device/backup controls remain pending Stage 5/9. No APK changed or produced. | F05,F06,F14 | 0,1,5 | Both |
| 115. APPLE PRIVACY MANIFESTS & THIRD-PARTY SDKS | Yes | DOCUMENTED / ARTIFACT UNKNOWN | Preferences privacy requirement documented; actual manifest/SDK signatures/Xcode archive report unavailable. | F17 | 5,9 | Both |
| 116. NATIVE PUSH & PRIVATE NOTIFICATION CONTENT | Yes | NATIVE UNKNOWN / DECISION | Tracked transport is Web Push; physical-device delivery, token cleanup and lock-screen detail need evidence/design. | F11 | 8 | Both |
| 117. BROWSER HEADERS, XSS & NATIVE ORIGIN COMPATIBILITY | Yes | CONFIRMED GAP / CONDITIONAL | E7 headers absent; native origins not known. Test headers/CSP/XSS and supported callbacks without breaking working routes. | F07,F10 | 2,5 | Both |
| 118. ABUSE CONTROL & OUTBOUND REQUESTS | Yes | CONFIRMED SOURCE GAP | Direct contact quotas/challenge and push endpoint destination validation absent in reviewed paths; no exploit asserted. | F09,F12 | 2 | Developer |
| 119. SUPABASE POLICY, PRIVILEGE & TENANT VERIFICATION | Yes | LOCAL PASS / LIVE UNKNOWN | E3–E5 tests plus E9 metadata diagnostic; direct staging tenant/removed-user/file/realtime cases remain. | F15 | 0,3,9 | Both |
| 120. UPLOAD CONTENT & DOWNLOAD VALIDATION | Yes | NEEDS IMPROVEMENT | Metadata size/MIME restrictions present; content mismatch, normalization, quotas, authorized downloads require implementation/test. | F13 | 4 | Developer |
| 121. BACKUPS, INCIDENT RESPONSE & SUPPLY CHAIN | Yes | KNOWN RECOVERY/ALERT GAPS / MFA PARTIAL | E30/E31 no external backups/staging, Free/PITR not enabled and tentative MFA; E32 no alerts, support selected but operation unverified. Stage 1 plan prioritizes account verification, backups/recovery, isolation, inventory/monitoring and response ownership. | F16,F18,F19 | 1 | Both |
| 122. STORE REVIEW QUALITY, METADATA & RELEASE GATES | Yes | NOT READY | Signed store artifacts, factual listings, reviewer accounts, required console tests and final quality evidence outstanding. | F05,F20 | 9,10 | Both |
| 123. DATED REQUIREMENTS & RECHECKING RULES | Yes | ONGOING GATE | Recheck actual store rules/toolchains for target account/territory/submission date; audit future dates are not current PASS evidence. | F05 | 5,7,9,10 | Both |
