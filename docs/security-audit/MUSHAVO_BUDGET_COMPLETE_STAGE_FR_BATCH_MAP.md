# Mushavo Budget — complete stages, FR groups and batches
As of 5 November 2026 • Full remaining-to-launch hierarchy • Version 1.7

## Read this structure correctly

**Current implementation location: Launch deliverable 1 → Main Stage 3 → FR.2 → FR.2.5 → Batch W.** All five signup/confirmation groups and eight invitation groups retain scoped passes. FRE298/299 add the server password boundary, automatic refresh, invalid cleanup, browser push-failure logout, actual in-flight Business clearing and stale-session denial. FRE300 adds generic absent-recipient recovery feedback, blocked-request retry/local cooldown and controlled Auth429 UI classification, with3/3 runner sessions cleaned. Remaining: older short-password fixture, three recovery fixture variants, Business Edge502 UI classification and exact historical Node-session cleanup. FRE301's disposable recovery attempt confirmed two new accounts, then stopped on actual Auth429 over_email_send_rate_limit before any recovery password update. FRE302 now confirms owner-approved exact cleanup: both disposable accounts/workspaces are removed, independent absence readback passed, and the original selected profiles/workspaces remain. Saved account passwords are unchanged. FRE303 adds six controlled passes for the Business invitation error candidate and identifies both October 30 sessions from matching request logs. The revocation request was cancelled and the two sessions remain. Hosted candidate verification and the remaining recovery runs are pending. AU03.04 failure/retry stays owner-deferred and optional reauthentication requirements are currently disabled. V remains open/on hold; W and launch remain incomplete.

There are three overlapping views of the SAME project:
- **Main Stages 0–10** describe the product/security areas.
- **FR.1–FR.8** are the final-remediation work groups that finish gaps identified across those stages. They do not add eight unrelated stages after ten new stage implementations.
- **Lettered A–Z batches** are the subdivision of the current Stage 3 / FR.2 authorization stream. There is not an unannounced A–Z sequence for every later FR.

A review reported “closed with carry-forward” means its review/report finished while identified work remained. It does not mean that area is implemented, accepted and launch-ready. Some old summary fields still named earlier checkpoints; this version uses the later specific evidence and corrects the active FR.2 pointers. Historical stage review objects remain intact.

The previous seven-deliverable time plan grouped this work for estimation. It was not a replacement for the stage/FR/batch hierarchy. This document supplies that hierarchy.

## A. Every main stage — what remains

| Main stage | Area | Actual position | Work left to launch | Completed through |
|---|---|---|---|---|
| 0 | Baseline and inventory | Baseline review closed | Retain inventory/findings; check the final release against them. | FR.8 |
| 1 | Foundations: access, staging and recovery | Scoped setup/review completed; launch gaps remain | Finish required database/file/offsite recovery, accountable operators, monitoring and rollback. | FR.4, FR.8 |
| 2 | Web hardening | Scoped checks/candidates completed; final acceptance remains | Final HTTPS/security headers, Contact abuse control and Web Push destination enforcement on the release setup. | FR.4, FR.7, FR.8 |
| 3 | Authorization and Auth | CURRENT implementation work | Finish remaining V/W/X/Y/Z, including actual roles/tenant access, invitation/password/session behavior and authorization closeout. | FR.2 |
| 4 | Data lifecycle, uploads and privacy | Review/candidates done; implementation/hosted acceptance remains | Deletion and shared ownership, retention, trusted files/downloads and factual policies/disclosures. | FR.3 |
| 5 | Native security and compatibility | Review/preparation done; actual native acceptance remains | Final Android/iOS project/signing/builds, secure sessions/device backup, native origins/callbacks and SDK/privacy evidence. | FR.7; dependencies FR.5/FR.6 |
| 6 | Identity and email | Review/candidates done; launch acceptance remains | Agreed Google/Apple integration, account linking/collisions, confirmation/recovery/invitation callbacks and actual email rendering/delivery. | FR.5 |
| 7 | Subscription commerce | Review/models done; real payment/store lifecycle acceptance remains | Catalogue/channel/seat mapping, authoritative verification/ledger/entitlements, purchases, restore/refund/expiry/replay and sandbox outcomes. | FR.6 |
| 8 | Notifications and device behavior | Review/candidates done; actual delivery/device acceptance remains | Backend queues/schedulers, push transport/token/account lifecycle, notification privacy, device permission/deep-link/background behavior. | FR.4 backend; FR.7 device |
| 9 | Broad regression and release evidence | Earlier offline regression done; final release checks remain | Fresh final web/native/finance/security/privacy regression, representative-device/accessibility/performance and artifact evidence. | FR.7, FR.8 |
| 10 | Release and operations | Readiness review done; public release remains | Proven monitoring/support/recovery/rollback, release decision, exact deployment/artifact mapping, channel publication and post-release checks. | FR.4, FR.8 |

Stages 0–2 have substantial earlier setup/review work. Stage 3 is the current main implementation area. Stages 4–10 have earlier reviews/source candidates and some local tests; their required launch implementation and real acceptance remain. Later fixes may also close earlier Stage 1–2 gaps. Do not count these overlapping gaps twice.

## B. Every FR group — status, remaining batches and effort

| Group | Status | Remaining scope / work packs | Relevant stages | Preliminary base effort |
|---|---|---|---|---|
| FR.1 — accepted source/static serving | Scoped serving correction complete; wider release mapping carried forward | Reuse accepted staging serving work. Final production headers/contact/serving/artifact mapping is accounted for in FR.4/FR.7/FR.8, not a repeated FR.1 campaign. | 1–2, 9–10 | Included later; no separate double count |
| FR.2 — permissions/Auth/finance | IN PROGRESS | Finish V policy/privileged scope, W, X, Y and Z. Existing FR.2.1–.3 scoped passes retained. | 3 | 6–10 working days |
| FR.3 — data/files/deletion/privacy | Required implementation/acceptance remains | FR.3.1–.5 below | 4 | 4–7 days |
| FR.4 — jobs/operations/recovery | Required implementation/acceptance remains | FR.4.1–.5 below | 1–2, 8, 10 | 3–5 days |
| FR.5 — identity/email/providers | Required implementation/acceptance remains | FR.5.1–.4 below | 6; dependencies 3/5 | Web 2–3; full provider scope 5–8 days |
| FR.6 — commerce/entitlements | Required implementation/acceptance remains | FR.6.1–.5 below | 7 | Web 3–5; full native scope 8–13 days |
| FR.7 — native/device/PWA/store readiness | Required implementation/acceptance remains | FR.7.1–.5 below | 5, 8–9; remaining web delivery | Web 2–3; full native/store package 12–19 days |
| FR.8 — final audit/release | NOT PERFORMED | FR.8.1–.5 below | 9–10 and all original exit criteria | 3–5 days |

**Important:** the FR.3.1–FR.8.5 identifiers below are a **new proposed execution breakdown of already-existing scope**, introduced here because later FR groups did not have this detail. They are not claims that these packs already existed, ran, or added new product requirements. The original finding/case definitions remain authoritative. Dates are estimates, not evidence.

## C. Inside the current FR.2

| Existing substep | Work | Actual position / remaining obligation |
|---|---|---|
| FR.2.1 | Source and controlled staging readiness | Scoped metadata checkpoint completed; recheck affected installation/actor prerequisites when needed. |
| FR.2.2 | Personal binding and legitimate finance | Scoped repairs/live passes completed; remaining applicable role/currency/data boundaries flow into X/Y/Z; wider retention/deletion belongs to FR.3. |
| FR.2.3 | Business roles/scopes and fixtures | Scoped live work completed with remaining groups; finish outstanding role/claim/owner/removed/suspension/expiry behavior under X and relevant invitations under W. |
| FR.2.4 | Admin/privileged access, recovery and rollout | Historical A–U preparation/install/checks retained; V is still open. Reconcile privileged acceptance with current password-only policy. |
| FR.2.5 | Auth/finance/session workflows | CURRENT: W. Signup/password/recovery/session partial results exist; finish original scenarios and relevant X legitimate-workflow evidence. |
| FR.2.6 | Affected backend recheck and completion | Y/Z finish caller/race/containment and integrated authorization closeout. Stage 3 is not complete until required exits are met. |

### All lettered batches, A–Z

Historical preparation/local pass is not relabelled as current full security acceptance. Custom code/trusted-device observations remain history following the owner's later password-only decision.

| Batch | Scope | Status / what remains |
|---|---|---|
| A | Local Edge/configuration preparation | Historical preparation; subsequent rollout evidence supersedes this checkpoint. |
| B | Frontend and rollout preparation | Historical preparation; later packages own actual acceptance. |
| C | Staging Edge configuration installation | Historical installed configuration/readback. |
| D | Staging Edge function deployment | Scoped deployment completed. |
| E | Canonical database registration integration | Source integration and owner local checks completed. |
| F | Dormant staging database registration | Scoped installed-state readback completed. |
| G | Frontend gateway rollout | Historical frontend deployment/public-serving check. |
| H | Quarantined database installation | Scoped installation/readback completed. |
| I | Email proof and rolled-back recovery | Historical scoped pass for the previous custom verification policy. |
| J | Remembered-device/account binding | Historical scoped pass for the previous trust policy. |
| K | Bounded acceptance-window controls | Preparation completed; installed follow-through belongs to L/M. |
| L | Acceptance-control upgrade/readback | Scoped upgrade/readback completed. |
| M | Bounded HTTP acceptance and containment | Scoped pass and cleanup; historical policy/source limits retained. |
| N | Local browser/cookie/DOM/service-worker checks | Scoped local browser checks completed. |
| O | Hosted public browser/TLS/service worker | Original gap followed through by P/Q/R; do not restart its old failing handoff. |
| P | Redirect-safe offline correction/package | Local correction/preparation completed; public acceptance followed in Q. |
| Q | Reviewed service-worker upload/public readback | Scoped hosted public-browser checks completed. |
| R | Canonical source alignment/regression | Scoped source alignment and local regression completed. |
| S | Browser transition/failure containment preparation | Local preparation completed; hosted follow-through in T/U. |
| T | Hosted shared-browser/recovery exercise | Scoped hosted pass; not equivalent to full application or launch acceptance. |
| U | Full-app startup/cache/session lifecycle | Recorded COMPLETE at its accepted scope; reuse applicable evidence. |
| V | Privileged access, recoverable operators and original MFA scope | OPEN/ON HOLD; sixteen-case password-only applicability reconciliation is documented, stronger historical MFA criteria remain unmet, and remaining privilege/session/recovery acceptance is open. |
| W | Auth/password/account/email workflows | IN PROGRESS;31 original groups. Five signup and eight invitation groups have scoped passes; password/session/recovery feedback evidence is accepted at recorded scopes. Three recovery fixture variants, legacy fixture, Business error UI and exact historical session cleanup remain; signed-in password retry stays deferred. |
| X | Personal/Family/Business permissions and legitimate finance | PLANNED; finish remaining role/scope/finance checks using retained actors/fixtures and applicable earlier passes. |
| Y | Backend caller permissions, real database races and containment | PLANNED; finite caller matrix, real concurrency, legitimate service/job access and safe failure readback/cleanup. |
| Z | Integrated authorization recheck and Stage 3 closeout | PLANNED; reconcile U–Y and original authorization exits, integrated affected recheck and final Stage 3 handoff. |

**Five lettered packages remain open: V, W, X, Y, Z.** W is active; V was deferred. There is no approved silent extension beyond Z. Z completes this authorization stream, not FR.3–FR.8 or the whole launch.

### Work left inside V/X/Y/Z

- **V:** controlled privileged identities and independent recovery; current installed role/grant behavior; ordinary/wrong-role denials; revocation/recovery continuity. The old V contract has 16 cases tied partly to stronger MFA; their [current password-only applicability reconciliation](SECURITY_FR_2_4_BATCH_V_PASSWORD_POLICY_RECONCILIATION.md) is documented and remaining acceptance is open. Do not silently reinstate custom codes/trust/MFA, falsely mark old stronger-assurance checks passed, or automatically reenroll/delete factors.
- **X:** reconcile earlier Personal/Family/Business passes; execute missing own/foreign/removed/assigned/team/Owner/escalation and invite/removal effects; verify legitimate finance/currency/entitlements; prove exact fixture cleanup and retained-record preservation.
- **Y:** freeze the installed routine/caller matrix; test applicable anonymous/authenticated/human/service/job permissions; real PostgreSQL concurrency/replay/expiry/revocation or current-policy authorization-change races; verify independent failure readback, containment and cleanup. Retired proof/device mechanisms do not automatically require new tests.
- **Z:** reconcile required authorization outcomes and current exact installations; run justified integrated/affected regressions; check preservation/cleanup/containment and issue the Stage 3 completion decision/handoff. Unresolved required blockers keep it open.

X/Y/Z had named scope and exits but no fully enumerated final execution-case counts. That planning gap is explicit. Freeze their exact case lists from existing coverage before running each pack; do not invent a test count or expand with speculative cases mid-pack.

### All W groups and the remaining work

| Group | Original scenarios | Recorded progress | Remaining obligation |
|---|---:|---|---|
| AU01 — signup/confirmation | 5 | All five original groups now have scoped passes, including AU01.05 private-runner hosted result on 5 November | Reuse the recorded scoped passes; no signup/confirmation repeat. Actual provider429/quota is not inferred from the local cooldown test |
| AU02 — invitations | 8 | All eight original groups have scoped PASS results: Admin setup/isolation/denials/network retry/idempotence and Business new/existing/accept/decline/replay | No invitation repeat. Exact unrecorded retry wording/internal provider outage were not exercised; older failed-run Node-session cleanup stays under session closure |
| AU03 — sign-in/passwords | 5 | Current sign-in/change observations and AU03.03 direct server minimum-eight rejection scoped PASS | Older valid-password compatibility remains; current recent-login/current-password requirements independently read disabled. AU03.04 actual failure/retry remains owner-deferred, not passed or automatically repeated |
| AU04 — recovery/links | 6 | Dedicated view, generic known/absent acknowledgement, request failure/cooldown, missing/used-link denial, real-link isolation and successful recovery save/adoption/sign-in retained | Wrong-session, controlled expiry and recovery password-save network failure/retry; disposable run stopped on Auth429; its two exact test accounts/workspaces are now fully cleaned |
| AU05 — sessions/failures | 7 | Earlier network/Auth-signout passes; refresh, invalid cleanup, browser push-failure logout, Business in-flight clearing, stale-session denial and controlled Auth429 UI scoped evidence retained | Business Edge502 UI classification and exact historical unbound Node-session cleanup; no real provider quota/reset, natural hour wait or push transport failure inferred |

Total remains **31 original scenarios**, many with multiple variants. Partial observations are not whole-case completion. All five signup/confirmation groups and all eight invitation groups have scoped passes, and recovery-save success is accepted; no trustworthy overall W percentage follows from these heterogeneous cases. [The current checklist](SECURITY_FR_2_5_BATCH_W_REMAINING_CHECKS.md) retains every original case and its exact evidence limits.

Group execution into W1 passwords/recovery, W2 confirmation/email, W3 invitations, W4 session failures/closure. W2 signup/confirmation and W3 invitations have scoped completion. W1 recovery/legacy fixtures and W4 selected Business error/exact-session closure retain the obligations above. These are scheduling packs inside W, not new AU requirements. The original 28 October W allowance was 3–6 active engineering days within FR.2's total; it is a baseline, not a newly measured remaining-time quote.

## D. Detailed work packs for every later FR

Each row states a concrete finishing outcome. Status for all rows below: **planned breakdown; launch acceptance outstanding**. Existing usable source/candidates/results should be reused.

| Proposed work pack | Deliverable | Work and completion outcome |
|---|---|---|
| FR.3.1 | Approve data/retention/shared-ownership facts | Adopt actual operator/contact/audience, category retention and transfer-or-closure decisions; identify processor/backup treatment. |
| FR.3.2 | Implement trusted files and downloads | Validate actual allowed content/size/quota and authoritative ownership/object binding; demonstrate allowed and foreign/forged/oversized denials. |
| FR.3.3 | Implement account deletion and shared-data handling | Authenticated request/status, persistent retry/idempotency, dependency-aware transfer/closure, authoritative file cleanup and appropriate session/provider cleanup. |
| FR.3.4 | Publish factual privacy/terms/support/deletion resources | Working public/app links and monitored contact; copy matches actual collection, retention and implemented deletion. |
| FR.3.5 | Accept data lifecycle/files/privacy | Run bounded disposable-account/file positive, denial and failure/retry checks; prove other users/shared financial data preserved and reconcile cleanup. |
| FR.4.1 | Reconcile installed jobs and caller configuration | Inventory relevant scheduler/Edge/job routes, credentials/bindings and required permitted/denied callers; reuse Y's authorization evidence. |
| FR.4.2 | Accept jobs, queues, FX/reminders and push delivery | Controlled real success/failure/retry, correct recipients/destinations, concurrency/history integrity and safe egress. |
| FR.4.3 | Establish monitoring and support operation | Assigned owner, useful metrics/budgets, actual alert/support receipt and private incident handling. |
| FR.4.4 | Complete backup and isolated restore | Protect required database/files/configuration/key components, independent/offsite coverage and realistic restore with accepted recovery objectives. |
| FR.4.5 | Prove stop/resume/rollback and recovery ownership | Compatible containment/rollback and safe readback, documented operator procedures and responsible owner. |
| FR.5.1 | Freeze identity/channel configuration | Confirm retained Google/Apple scope and web/PWA/native callback clients/domains; preserve existing account access. |
| FR.5.2 | Implement provider login and account linking | Actual login/cancel/error/revocation and existing-identity/invitation collision/linking controls for retained providers. |
| FR.5.3 | Complete callbacks and email integration | Trusted origins/metadata, actual templates/contextual escaping, purpose-aware confirmation/invitation/recovery delivery and supported callback routes. |
| FR.5.4 | Accept real identity and inbox outcomes | Controlled real provider/inbox/callback/expiry/replay/wrong-identity results across retained channels; reuse applicable W evidence. |
| FR.6.1 | Freeze catalogue, payment channels and ownership rules | Actual plans/products/prices/seats, account binding, manual/web/store channel policy and sandbox readiness. |
| FR.6.2 | Implement authoritative payment verification and ledger | Real provider verification/signature/webhook handling as applicable; durable idempotency, ownership/concurrency and authoritative entitlement decisions. |
| FR.6.3 | Complete entitlement lifecycle | Renewal, expiry, cancellation, refund, restore and cross-channel/household/Business-seat consistency; existing legitimate finance preserved. |
| FR.6.4 | Integrate retained native purchase channels | Applicable Android/iOS purchase/restore clients and server linkage, using actual sandbox identities/products. |
| FR.6.5 | Accept commerce end to end | Controlled purchase/verification/replay/concurrent ownership/restore/refund/expiry outcomes; no real charges or publication assumed by planning. |
| FR.7.1 | Reconcile and build final native artifacts | Preserve existing Android/iOS project/signing identity; verify tools/dependencies and produce reviewable final artifacts. |
| FR.7.2 | Accept native security and callbacks | Secure session storage, device/cloud backup treatment, logout/account switching and provider/invitation/recovery deep links on actual devices. |
| FR.7.3 | Accept native notifications and device lifecycle | Registration/rotation/removal, account binding, foreground/background/terminated behavior, permissions, delivery and private notification content. |
| FR.7.4 | Finish web/PWA/browser/device quality | Install/update/offline/cache/account isolation; core accessibility/usability/performance; final web headers/routes/contact delivery. Includes release-relevant UI fixes. |
| FR.7.5 | Prepare factual publisher/store release evidence | Inspect final SDK/permissions/privacy manifests; prepare accurate listings/declarations, reviewer access and account-specific testing/prerequisites. |
| FR.8.1 | Freeze exact release candidate | Pin source, installations, configuration, artifacts and accepted scope; reconcile all original findings/coverage/actions. |
| FR.8.2 | Run fresh full applicable final audit | Current appropriate suites and actual hosted/provider/device/recovery requirements, including unchanged areas; reuse history as context, not as a fresh run. |
| FR.8.3 | Resolve blockers and verify fixes | Fix demonstrated release blockers; rerun affected checks; record residual decisions with actual scope and ownership. |
| FR.8.4 | Prepare release/rollback decision package | Accepted artifacts, production/channel mapping, support/monitoring, recovery/rollback and accountable owner release decision. |
| FR.8.5 | Execute authorized rollout and post-release checks | Publish only the approved channels/artifacts after concrete authorization, verify real release workflows and health, retain rollback capability. |

### Dependencies and order

1. Continue current FR.2 to its required Stage 3 exits. Settle the V policy conflict early so W invitation work is not blocked by an obsolete assumption.
2. Prepare FR.3 decisions/inventory, FR.4 recovery/operations prerequisites and publisher/payment/provider account readiness early while progressing the current authorized work. This does not assume extra staff or automatic external operations.
3. Implement FR.3/FR.4 and retained FR.5/FR.6 with their dependencies. Native/client-specific FR.7 preparation should start early enough to expose build/device/account blockers.
4. Complete actual FR.7 device/PWA/store-readiness evidence against the final integrated behavior.
5. Finish FR.8 fresh audit, accepted release package, authorized rollout and post-release verification.

These are dependencies across the existing stages, not a demand to repeat Stages 0–10 from scratch and then do FR.1–FR.8 again.

## E. Time for the complete remaining scope

The earlier estimate is retained and now mapped to FR groups above. It is a low-confidence engineering planning allowance, assuming one effective six-productive-hour/day workstream, five days/week, reusable current code/results and prompt owner feedback.

- **Web/PWA-first scenario:** 23–38 base working days + approximately 25% repair/retest reserve = **29–48 working days (about 6–10 weeks)**.
- **Full listed web + Android + iOS/provider roadmap:** 41–67 base working days + reserve = **52–84 working days (about 10–17 weeks)**, plus currently unknown account/testing/store/provider waits.
- At a hypothetical start of 29 October 2026, excluding public holidays and external waits: web engineering completion **8 December 2026–4 January 2027**; full-roadmap engineering completion **8 January–23 February 2027**. These are scenario calculations, not committed publication dates.
- No first-release channel decision or daily capacity is confirmed. Web-first remains a recommendation, not a change imposed on the project. The full retained roadmap remains visible above.
- Re-estimate after two grouped work sessions using observed effort and prerequisite readiness. If a work pack overruns, report its cause and forecast change instead of quietly extending it.

No duration is allocated by adding historical test counts or overlapping findings together. Every later implementation/acceptance item is charged to its primary FR; overlapping stage mappings do not multiply the budget.

## F. What “finished” must mean from now on

Use four clearly distinguished states: **review/preparation done; implementation ready; actual acceptance passed at stated scope; release accepted**. “Closed with carry-forward” is historical audit terminology and cannot replace those current delivery states.

Every owner-facing progress report should state:
1. Main stage + FR + current batch/work pack.
2. What was completed at its actual scope.
3. The named items still open in that pack.
4. Dependency/owner action required and changed effort forecast.
5. Where the next pack sits in this complete map.

Use the stable staging origin. Reuse applicable accepted work. Group related checks and deployments when safe; do not repeat configuration or ask for one-line results across many turns when one coherent checklist is sufficient.

This document records the requested complete plan. It does not execute pending password operations, new tests, deployments, provider/account actions, store publication or scope exclusions.

## Appendix — all 31 original W cases

“Observed” and “partly checked” describe evidence scope; they do not claim full-case closure or require an automatic repeat. Historical evidence is retained with its source limitations. The contract and original AU definitions remain unchanged.

| Case | Existing title | Evidence state | Remaining evidence / limit |
|---|---|---|---|
| AU01.01 | Valid ordinary signup | Owner current scoped PASS, 1 November | Fresh ordinary signup received confirmation email and reached its correct Free Personal workspace after explicit confirmation/manual password sign-in. Retain account for AU01.05; no repeat. |
| AU01.02 | Confirmation-pending guidance | Owner current scoped PASS, 1 November | Owner confirms pending guidance appeared in the current ordinary signup sequence. No repeat. |
| AU01.03 | Unconfirmed sign-in denial | Earlier owner denial scoped PASS retained | Preserve earlier unconfirmed sign-in denial; the request-feedback patch does not alter password sign-in or confirmation requirements. No new negative result or repeat inferred. |
| AU01.04 | Correct confirmation destination | Owner current scoped PASS, 1 November | Intended confirmed recipient, clean URL, Go to sign in showed the form, and password sign-in opened the correct Free Personal workspace, with no error. [Receipt](security-fr-2-batch-w-owner-ordinary-confirmation-pass.json). No repeat. |
| AU01.05 | Generic existing-email/resend failure and rate response | Private runner hosted scoped PASS, 5 November | One duplicate signup returned generic pending guidance; one actual browser resend was blocked; error/form/button and local cooldown without another dispatch passed. Context closed and three new sessions locally logged out. [Receipt](security-fr-2-batch-w-staging-runner-confirmation-pass.json). No provider 429/quota claim. |
| AU02.01 | Admin new-recipient setup | Owner-reported scoped PASS, 30 October | Email received, correct recipient, password and Complete setup succeeded, intended Free Personal workspace opened. No repeat. |
| AU02.02 | Admin-tab isolation | Owner-reported scoped PASS, 30 October | Original Admin tab remained unchanged before explicit recipient setup/adoption. No claim that Admin remains selected after the acknowledged account choice; no repeat. |
| AU02.03 | Wrong-recipient denial | Owner server scoped PASS, 30 October | A separately verified valid identity was denied invitation read and completion for the completed recipient invitation. Two created sessions cleaned up. No repeat. |
| AU02.04 | Expired/cancelled/replaced invitation denial | Owner server controlled-state scoped PASS,30 October | All three exact recipient-bound states denied read and completion. Original profile/workspace set preserved, fixture/audit absent and both new sessions logged out HTTP204. No repeat. Replacement sender flow and Auth email TTL were not exercised. |
| AU02.05 | Completion retry/idempotence | Owner browser network-retry and server idempotence scoped PASS, 1 November | Completion showed blocked:devtools, setup page remained, retry needed no password re-entry, correct Free Personal workspace opened and one Personal workspace appeared. Retain earlier two original-workspace returns/unchanged owned set. Error wording unrecorded; no internal provider outage or repeat required. |
| AU02.06 | Business new-recipient first password | Owner-reported scoped PASS, 29 October | Email received, first password set, intended Business workspace opened and accepted membership shown on owner Team page. Preserve; no repeat. |
| AU02.07 | Existing Business recipient without password overwrite | Owner-reported scoped PASS, 29 October | Joined without a password setup, original password still signs in, intended Business workspace opens and only one membership remains. No repeat. |
| AU02.08 | Business accept/decline/replay | Owner-reported/screenshot scoped PASS, 29 October | Acceptance and accepted-link unavailable/no duplicate passed earlier. In-app decline now shows Rejected, members unchanged at 3, pending 0, available 7 of 10 seats. No repeat. The failed mail attempt's provider 429 remains separate AU05.07 evidence. |
| AU03.01 | Ordinary valid sign-in including older valid password | Ordinary sign-in PASS; older short-password fixture unavailable | All saved ordinary credentials pass sign-in but none is shorter than eight characters, privately classified by the runner without exporting values or exact lengths. Do not weaken the new-password policy or manufacture historical account age to claim this variant. |
| AU03.02 | Invalid credentials | Owner known-email/wrong-password message scoped PASS retained, 27 October | [FRE237 receipt](security-fr-2-batch-w-owner-invalid-credentials.json) matches the original invalid-credentials scenario's observed UI-message scope. No new bad-password attempts are requested. Independent HTTP/session inspection and explicit dashboard absence were not recorded; these limits remain. |
| AU03.03 | Configured new-password boundary | Scoped PASS, 5 November | Direct server rejects seven characters with HTTP422 weak_password and minimum eight; no session returned or password update. Earlier browser seven/eight boundary retained. [Receipt](security-fr-2-batch-w-password-session-pass.json). |
| AU03.04 | Signed-in password change and retry | Partly checked; failure/retry deferred by owner | Change and new-password sign-in passed; failure/retry unverified and explicitly skipped at owner request. Do not automatically repeat. |
| AU03.05 | Required recent-login/reauthentication failure/success | Not required under current configuration, independently read 5 November | Staging Email settings show Secure password change OFF and Require current password when updating OFF. No setting was saved. Required-condition failure/success is not claimed; recheck if release configuration changes. [Readback](security-fr-2-batch-w-current-password-config-readback.json). |
| AU04.01 | Generic recovery request | Scoped PASS: owner known-account acknowledgement retained plus private runner feedback, 5 November | Actual absent-account HTTP200 gives the same generic acknowledgement. Browser-aborted recovery request preserves address/form/button and shows retry guidance. Local cooldown prevents repeat dispatch in all three contexts. Controlled HTTP429 warning also displayed; provider quota/reset and delivery are not inferred. [Receipt](security-fr-2-batch-w-recovery-feedback-pass.json). |
| AU04.02 | Valid recovery opens dedicated new-password view | Dedicated recovery view observed | Verified requested identity/password view observed earlier and supported by latest isolation result; no password save inferred. |
| AU04.03 | Wrong/no session | Partly checked; disposable run stopped before this variant | Missing-link/private-tab denial remains accepted. The actual recovery request returned Auth429 before wrong-session testing. Both new sessions logged out and the two disposable accounts/workspaces are now cleaned with independent absence readback. |
| AU04.04 | Expired/used link | Partly checked; disposable run stopped before this variant | Used-link denial remains accepted. Controlled fixture expiry was not executed because the first recovery request returned Auth429. No global policy changed or natural hour-long expiry claimed. |
| AU04.05 | Password-save failure/retry | Partly checked; disposable run stopped before any password update | Accepted recovery save/adoption/sign-in remains retained. The disposable run stopped at Auth429 before testing a failed save/retry. No saved account password or fixture password update occurred. |
| AU04.06 | Cross-tab/current-account isolation and sanitized URL | Latest requested isolation check passed | Owner confirms requested recovery identity, clean stable URL and unchanged original dashboard before saving. Do not repeat. |
| AU05.01 | Same-user access refresh | Scoped PASS, 5 November | Existing app timer performs real HTTP200 token rotation for the same verified user/session after only isolated cached expiry metadata is shortened. Dashboard avoids sign-in and refreshed session persists through reload. Server clock/JWT expiry unchanged; natural hour-long expiry not observed. No repeat hour wait. [Receipt](security-fr-2-batch-w-password-session-pass.json). |
| AU05.02 | Invalid refresh cleanup | Scoped PASS, 5 November | Only new runner session revoked; actual HTTP400 refresh_token_not_found; project session cleared, unrelated test storage retained, protected views hidden and reload stays signed out without a refresh loop. [Receipt](security-fr-2-batch-w-password-session-pass.json). |
| AU05.03 | Transient network preservation/retry | Network retry observed | Earlier owner PASS retained; reconcile applicability without an automatic repeat. |
| AU05.04 | Sign-out with push cleanup failure | Browser-component failure scoped PASS, 5 November | Injected browser registration lookup NetworkError does not prevent actual local Auth logout HTTP204; accurate residual-push warning, storage clearing and signed-out reload pass. No real push subscription/provider or protected push-row DELETE failure exercised. [Receipt](security-fr-2-batch-w-password-session-pass.json). |
| AU05.05 | Auth sign-out failure | Owner-reported scoped PASS, 29 October | v123 offline warning, restoration of No throttling, explicit retry, warning cleared without refresh, reload remained signed out. Owner action clarified by yes. No repeat requested; independent push failure remains AU05.04. |
| AU05.06 | Account switch with in-flight/Business UI clearing | Hosted scoped PASS, 5 November | Existing Business staff view opened; actual old-actor HTTP200 response held unchanged; real distinct session adopted/broadcast; branding/activity/dialogs cleared before release; late response did not reopen Business; replacement Personal dashboard persisted through reload. [Receipt](security-fr-2-batch-w-account-switch-stale-session-pass.json). |
| AU05.07 | Selected Auth rate errors and observed stale-token window | Stale-session and controlled Auth429 scoped passes retained. Business error candidate passes six controlled checks | The candidate reads the Edge502 saved-invitation failure and the function429 resend cooldown from the response body. It refreshes the pending list for a known saved delivery failure. Hosted verification of the updated candidate remains pending. [Candidate receipt](security-fr-2-batch-w-business-error-and-historical-session-binding.json). |

## Sources

- [Main stage roadmap](AUDIT_PLAN.md) and [audit checkpoint history](SECURITY_AUDIT_PROGRESS.json).
- [Current remediation progress](SECURITY_FINAL_REMEDIATION_PROGRESS.json) and [original FR.1–FR.8 requirements](SECURITY_FINAL_REMEDIATION_HANDOFF.md).
- [Fixed lettered baseline](security-stage-3-lettered-batch-baseline.json). Its older next-action pointers are historical; current W evidence takes precedence.
- [Current W remaining ledger](SECURITY_FR_2_5_BATCH_W_REMAINING_CHECKS.md) and [pending recovery-save handoff](SECURITY_FR_2_5_BATCH_W_STABLE_RECOVERY_SAVE_CHECK.md).
- [Time assumptions and delivery rules](MUSHAVO_BUDGET_LAUNCH_DELIVERY_PLAN.md).

Snapshot reviewed at bc68626e093bb56f31210cb19c411e4a77d332e4. The proposed later-FR work-pack identifiers and engineering estimates are planning judgments, not recorded test results.


FRE303 records the Business invitation error candidate and the matching historical session evidence. The exact two-session revocation is paused after cancellation. The recovery runner requires a usable private execution environment. [Safe receipt](security-fr-2-batch-w-business-error-and-historical-session-binding.json).


FRE304 resolves the October 30 test session cleanup. Both identified sessions and their two refresh tokens were revoked in staging and verified absent. The existing case list still governs recovery and Business invitation verification. [Cleanup receipt](security-fr-2-batch-w-historical-invitation-session-cleanup-pass.json).
