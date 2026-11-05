# Batch W — remaining work after stable recovery isolation

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** Updated 5 November 2026.

The owner reports all three requested AU04.06 observations passed: recovery identity matches, URL clean, original dashboard unchanged. [Exact receipt](security-fr-2-batch-w-owner-stable-recovery-isolation-pass.json). This is the recovery-link isolation observation before password saving; it is not an additional password change or session adoption. No repeat of that observation is requested.

W retains **31 original case groups**, including both normal and failure variants. It has no trustworthy completion percentage: positive observations and partial cases are not the same as fully closed cases. The recorded browser workflow successes must be reused where applicable. **All eight invitation case groups AU02.01–08 now have scoped PASS results. AU02.05's real blocked-completion retry succeeded without another password entry and opened the intended Free Personal workspace with one visible Personal workspace; its earlier server idempotence pass is retained. The exact failure message was not recorded and no internal provider outage is inferred. No invitation repeat is requested. AU01.01–05 now all have scoped PASS results: the private staging runner completed AU01.05's generic existing-email, real browser-blocked resend and local cooldown checks on 5 November. [Runner receipt](security-fr-2-batch-w-staging-runner-confirmation-pass.json). No unblocked resend or provider-quota test ran.** Other remaining work comprises confirmation/resend closure, older-password/server-boundary/reauthentication checks, recovery expiry/save/retry, and refresh/sign-out/account-switch failure handling. No cases are added by this summary.

| Area | Original cases | Remaining scope |
|---|---:|---|
| Signup/confirmation | 5 | All five original groups scoped PASS. AU01.05 now has hosted generic existing-email, browser-aborted resend, retained form and no-dispatch local-cooldown evidence. No repeat; provider 429/quota is not inferred. |
| Invitations | 8 | All eight groups scoped PASS: Admin setup/isolation, wrong-recipient and controlled unavailable-state denials, actual completion-network retry plus server idempotence; Business new/existing-recipient, accept/decline/replay. Preserve all recorded limits; no repeat. |
| Sign-in/passwords | 5 | Older valid password, direct server boundary, actual save failure/retry, applicable reauthentication behavior; normal sign-in/change passed. |
| Recovery/links | 6 | Remaining wrong-session/expiry, remaining provider failure/retry and generic-response variants; requested real-link isolation passed. |
| Sessions/failures | 7 | Actual refresh/invalid refresh, independent push cleanup failure, in-flight Business clearing and supported rate/stale-token behavior; reload/shared-tabs/network positives retained. |

## Recovery continuation accepted — 29 October 2026

W67 owner-reported scoped PASS: recovery save automatically opened the recovered account, the other normal app tab switched to that account, and sign-out/reload/new-password sign-in opened its dashboard successfully. Preserve these results; no repeat requested. Actual provider failure/retry remains unverified. See [accepted recovery sequence](SECURITY_FR_2_5_BATCH_W_STABLE_RECOVERY_SAVE_CHECK.md).

## Sign-out failure/retry accepted — 29 October 2026

AU05.05 scoped owner PASS after v123 correction and public 4/4 source verification: warning clears after connectivity restoration/retry, and reload remains signed out. Owner confirmed the retry action. Preserve this result and do not repeat. See [sign-out retry report](SECURITY_FR_2_5_BATCH_W_SIGNOUT_RETRY_FIX.md). Remaining session work is AU05.01/02/04/06/07 at the scopes listed below.


## Business new-recipient setup accepted — 29 October 2026

All four requested owner observations passed for AU02.06: invitation delivery, first-password setup, intended Business workspace and accepted membership on the owner Team page. [Receipt](security-fr-2-batch-w-owner-business-new-recipient-pass.json). Reuse the positive acceptance result for AU02.08; do not repeat this signup. AU02.07 existing-recipient password preservation and AU02.08 decline/replay are still open. The simplified seat editor is working by owner report; this does not close V.


## Business existing-recipient and accepted-link replay accepted — 29 October 2026

[Owner receipt](security-fr-2-batch-w-owner-business-existing-recipient-pass.json): no new-password setup, original password sign-in, correct workspace and one membership all pass. Latest owner replay result explicitly shows the safe unavailable-link message; earlier checkbox-only description is superseded. Do not repeat AU02.07 or accepted-link replay. Continue only AU02.08 decline and its unavailable/rejected state.


## Current checkpoint — all three Business invitation cases accepted

[Decline receipt](security-fr-2-batch-w-owner-business-decline-pass.json), image(20261029-193018).png, shows invitation Rejected with seat limit 10, active members 3, pending 0 and available 7. The prior screenshot had members 3/pending 1/available 6. This accepts decline, no added membership and reservation release through the existing signed-in notification flow. Together with the retained acceptance and accepted-link unavailable/no-duplicate observation, original AU02.08 scope passes. AU02.06/07/08 need no repeat or extra mail. No undelivered-email-link result or resolution of provider 429 is inferred.

Next preparation is the original five Admin invitation cases. Source review of Batch V contract/plan confirms they still describe the older MFA/AAL2/operator workflow. Reconcile applicability against the later owner-selected password-only policy and retain role/session/ordinary-user-denial requirements; do not run the historical factor-enrollment/recovery commands or claim V complete merely because the owner now has a working Super Admin account. The invitation delivery rate boundary remains unresolved; no new email, quota/SMTP change, SQL rerun or upload requested by this evidence update. Other W cases, V and X–Z remain open.


## Admin new-recipient and pre-adoption isolation accepted — 30 October 2026

[All five requested owner observations passed](security-fr-2-batch-w-owner-admin-new-recipient-isolation-pass.json) for AU02.01/02. Preserve them; no resend or repeat setup. The [bounded completed-invitation check](SECURITY_FR_2_5_BATCH_W_COMPLETED_ADMIN_INVITATION_CHECK.md) prepares real wrong-recipient API denial and repeated-completion observations with two local password sessions, at most fifteen requests and no mail. Local sixteen tests pass; the owner hosted result now passes at the completed-invitation scope. It does not close AU02.04 unavailable variants or AU02.05 actual provider-failure retry. The successful email receipt does not prove rate configuration changed or every rate window cleared.

## Fixed remaining case list

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
| AU03.01 | Ordinary valid sign-in including older valid password | Partly checked | Ordinary sign-in/dashboard passed; older valid-password compatibility remains. |
| AU03.02 | Invalid credentials | Invalid-credentials message observed | Known account/wrong-password UI result retained; reconcile original outcome criteria. |
| AU03.03 | Configured new-password boundary | Partly checked | Browser rejects seven and accepts eight at signup; direct server below-minimum rejection is unverified. |
| AU03.04 | Signed-in password change and retry | Partly checked; failure/retry deferred by owner | Change and new-password sign-in passed; failure/retry unverified and explicitly skipped at owner request. Do not automatically repeat. |
| AU03.05 | Required recent-login/reauthentication failure/success | Conditional: not required under last reviewed settings | 26 October owner screenshot/metadata show secure password change and current-password requirement disabled. Retain final configuration reconciliation; do not enable an optional requirement to manufacture this test or claim a required-reauthentication pass. |
| AU04.01 | Generic recovery request | Partly checked | Known-account generic acknowledgement and delivery passed; account-existence uniformity/rate variants remain. |
| AU04.02 | Valid recovery opens dedicated new-password view | Dedicated recovery view observed | Verified requested identity/password view observed earlier and supported by latest isolation result; no password save inferred. |
| AU04.03 | Wrong/no session | Partly checked | Missing-link/private-tab denial and signed-in account continuity observed; wrong-session variants remain. |
| AU04.04 | Expired/used link | Partly checked | Used-link denial observed; actual timeout expiry remains unverified. |
| AU04.05 | Password-save failure/retry | Partly checked | Mismatch and same-password refusal evidence retained; successful password save, automatic adoption, shared-tab switch and subsequent new-password sign-in now owner-confirmed; actual provider failure/retry remains unverified. |
| AU04.06 | Cross-tab/current-account isolation and sanitized URL | Latest requested isolation check passed | Owner confirms requested recovery identity, clean stable URL and unchanged original dashboard before saving. Do not repeat. |
| AU05.01 | Same-user access refresh | Partial: real refresh HTTP200 observed; clean login/reload/shared-tabs restored | Owner confirms same dashboard after fresh sign-in and reload, peer same account. Earlier expiry observation was interrupted by local-storage deletion; continuous same-user renewal/persistence remains for consolidated session acceptance. No repeat of restored login/reload or immediate hour-long wait. Historical U real refresh has prior-policy/memory-storage limits. |
| AU05.02 | Invalid refresh cleanup | Not yet accepted | Invalid-refresh cleanup. |
| AU05.03 | Transient network preservation/retry | Network retry observed | Earlier owner PASS retained; reconcile applicability without an automatic repeat. |
| AU05.04 | Sign-out with push cleanup failure | Not yet accepted | Sign-out outcome when protected push cleanup fails. |
| AU05.05 | Auth sign-out failure | Owner-reported scoped PASS, 29 October | v123 offline warning, restoration of No throttling, explicit retry, warning cleared without refresh, reload remained signed out. Owner action clarified by yes. No repeat requested; independent push failure remains AU05.04. |
| AU05.06 | Account switch with in-flight/Business UI clearing | Partly checked | Shared-tab sign-in/sign-out/re-sign-in passed; in-flight/Business clearing remains. |
| AU05.07 | Selected Auth rate errors and observed stale-token window | Current Auth provider 429 observed; full case pending | Business email dispatch stored provider 429; recipient exists and is linked. Edge wraps this as generic 502 and UI classification is not accepted. Exact reset boundary and stale-token behavior remain unverified; retired custom-code history is not current-policy acceptance. |

## Remaining lettered packages

The fixed endpoint remains Z. **V, W, X, Y and Z remain open**; V is on hold. After W the planned sequence is **X (Personal/Family/Business roles and finance), Y (backend caller permissions/database races/containment), Z (integrated authorization recheck and Stage 3 closeout)**, with V's blocking requirements still to resolve. This is the Stage 3 authorization sequence, not the whole launch programme. Do not describe W/Z as a percentage of work or promise a number of clicks/hours from these heterogeneous groups.

Keep all future owner URLs on **https://mushavo-budget-staging.pages.dev/**. Do not request another preview callback, deployment, SQL rerun, mail, password write or settings change merely to report status. Prepare the next affected check with its specific target/actions before execution; reuse earlier accepted results. The AU01.05 request-feedback correction and its existing-account browser handoff now have scoped acceptance. Continue the original remaining password/recovery/session variants using the private runner; no owner packaging, upload or command is required for the completed setup. No full W/FR.2/Stage3/finding/release acceptance; production/native unchanged and APK deferred.

## Decline check paused for invitation delivery — 29 October 2026

Owner screenshot image(20261029-191820).png shows Business Team seat limit 10, active members 3, pending invitations 1, available 6. The attempted invitation is marked failed and the page says “Edge Function returned a non-2xx status code.” This is not a decline or reservation-release PASS. Existing AU02.06/07 and accepted-link replay results remain accepted.

Current source can return several bounded mail/reservation/auth error codes, but business.js displays the SDK's generic non-2xx message without reading the JSON error response. No underlying provider failure/rate code is established by this screenshot. Obtain only the existing failed invite-business-member request's HTTP status and Response error/code/message fields; exclude headers, payload, tokens and invitation links. No resend, cancel, new invitation, deployment, SQL rerun or permission change requested while diagnosing.

## Failed delivery response received — 29 October 2026

Owner supplied HTTP502 response BUSINESS_INVITATION_EMAIL_FAILED for invitation 2cbc417b-930e-47b3-b7c3-ec0b551834d2. In the reviewed source this follows successful reservation and delivery-result recording; it does not establish the underlying provider cause. No rate/SMTP/account-specific diagnosis is asserted. The existing delivery_error_code stores the Auth provider HTTP status or a bounded fallback. Prepare one read-only lookup of this invitation and recipient account/profile linkage; no resend, cancellation, mail dispatch, settings write or grant change. See supabase/diagnostics/security_fr_2_5_business_invitation_delivery.sql. Decline acceptance remains pending; previous accepted results retained.

## Delivery rate limit identified; continue decline in-app — 29 October 2026

[Owner safe read-only result](security-fr-2-batch-w-owner-business-delivery-rate-limit.json) confirms pending/failed invitation, provider status 429, matching existing Auth/profile/linkage and no active membership. This establishes rate limiting of the Auth email operation, without establishing the exact configured quota, cooldown/reset time, or SMTP outage. Retain as narrow AU05.07 evidence; generic Edge 502/UI message handling and stale-token window remain open.

Reviewed source creates the recipient's in-app notification independently of email delivery. get_my_business_invitations selects pending invitations bound to the authenticated recipient; respond_business_invitation supports decline after session, recipient and active-subscription checks without a delivery_status requirement. app.js renders a Decline button in Notifications. Continue the existing AU02.08 decline through that signed-in UI, with no resend/new mail/settings change. Expected counts for the last screenshot's unchanged fixture: seat limit 10, active members 3, pending 0, available 7. These are expected, not observed outcomes. No declined-email-link replay is inferred because this attempt produced no delivered link; accepted-link replay already passed.

## Admin invitation source prerequisite reconciled — 29 October 2026

[Current V applicability](SECURITY_FR_2_4_BATCH_V_PASSWORD_POLICY_RECONCILIATION.md) records all sixteen original V requirements against the later owner-selected password-only policy without crediting stronger MFA criteria. V stays incomplete at role/session/recovery scope. The [first concrete Admin invitation sequence](SECURITY_FR_2_5_BATCH_W_ADMIN_INVITATION_CHECK.md) combines original AU02.01 new-recipient setup and AU02.02 same-browser Admin isolation before explicit recipient adoption. It requests at most one real test invitation and stops on rate/error; it does not claim the earlier provider429 boundary has reset. No new public case, runtime/SQL change, upload, factor setup or payment entry. Other Admin variants AU02.03–05 remain pending; no blanket Admin W acceptance.

## Completed Admin invitation server checks accepted — 30 October 2026

[Owner safe JSON](security-fr-2-batch-w-owner-completed-admin-invitation-pass.json): exit0, fifteen requests, zero email/settings/SQL writes, three completion RPC calls, two created sessions cleaned up. Expected wrong-recipient read/completion denials and repeated-completion original-workspace/no-extra-workspace behavior passed. Preserve the accepted AU02.01/02 and Business results; no rerun. The successful HTTP200 recipient profile preflight does not establish the cause of the earlier stop.

Continue AU02.04 with the [complete read-only existing-invitation inventory](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_CHECK.md). AU02.05 actual setup/provider-failure retry stays open. No new runtime/UI change, new public case or W/V/FR.2/Stage3/release closure.

## Unavailable Admin invitation inventory: no candidates — 30 October 2026

[Owner safe result](security-fr-2-batch-w-owner-unavailable-admin-invitation-inventory.json) reports zero expired/cancelled/replaced rows and zero eligible or confirmed-recipient candidates. No denial RPC, write, password sign-in or email was exercised by the inventory. This is a fixture gap, not a product defect or PASS; do not repeat the inventory or alter the completed invitation.

The [next complete controlled-fixture handoff](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_CHECK.md) prepares one temporary invitation, uses actual recipient/Admin password sessions, requires the specific three unavailable-state denials, and verifies fixture/session cleanup. Four whole SQL files, no editing, no new mail, dependency/API key, upload or timed expiry wait. Local17 PASS only; hosted acceptance remains pending. Actual AU02.05 setup/provider-failure retry and wider W/V scopes stay open.

## AU02.04 SQL trigger guard stop and existing-run repair — 30 October 2026

[Owner screenshot receipt](security-fr-2-batch-w-owner-unavailable-invitation-trigger-stop.json) shows FIXTURE_UNREVIEWED_INVITATION_TRIGGER before that block's fixture DML. The full source review found the canonical Business launch trigger omitted by the helper; local reproduction matches the stop. The [complete repair](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_TRIGGER_REPAIR.md) recognizes only the exact current handler/trigger shape and preserves the Business manual-grant rule, unknown-trigger rejection, original IDs and backups. Local21 PASS; no assistant hosted change. Repair only the four existing generated files, then follow the original terminal's currently requested phase using a fresh single-file SQL query. Current fixture/session cleanup state is unknown until the actual owner continuation result. Do not credit acceptance, restart another fixture, combine phases or repeat accepted flows.

## AU02.04 SQL results received; HTTP acceptance did not run — 30 October 2026

[Owner receipt](security-fr-2-batch-w-owner-unavailable-invitation-sql-ready-api-stop.json): four successful SQL preparation/cleanup results, but the original runtime stopped at EXACT_UNPROVISIONED_FIXTURE_NOT_VERIFIED after requesting only expired/cleanup. Fourteen HTTP requests, zero completion RPCs, no accepted variants, zero of two Auth logouts verified. The historical cleanup-required flag is not reconciled with the later SQL absence report. Ordering and HTTP/session failure cause remain unknown. No denial PASS is credited.

Continue with exactly one [read-only post-stop query](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_INVITATION_POST_STOP.md) to confirm current marker counts and inspect typed session counts. No new fixture, login, email, broad session revocation or repeated accepted workflow. Current helper opaque HTTP classification/manual flow needs review before another hosted run. Prior scoped passes and all31 definitions remain preserved.

## AU02.04 old fixture cleanup confirmed; checker workflow corrected — 30 October 2026

[Owner read-only result](security-fr-2-batch-w-owner-post-stop-state.json) shows zero marked fixture/audit rows. Each account has two session rows, one with node/undici agent, ages8221/8234seconds. These do not identify exact failed-run sessions or establish old HTTP error cause. Preserve fixture cleanup; do not repeat it or revoke other sessions to manufacture a pass.

The [new complete checker workflow](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_CHECK.md) supplies only the current SQL phase through verified clipboard copy, retains emergency cleanup, renews in-memory sessions with same-user/session and Auth getUser checks, and records safe HTTP/row/logout details. Current25 tests PASS; prior five SQL checks retained because SQL rules are unchanged. Owner fresh AU02.04 run pending; old Node cleanup and actual AU02.05 failure/retry remain open. No new public cases, policy/settings change, mail, upload, production/native or whole W acceptance.

## AU02.04 all three server-state denials and current-run cleanup accepted — 30 October 2026

[Owner terminal](security-fr-2-batch-w-owner-unavailable-admin-invitation-pass.json) passed with25 HTTP requests,3 completion denial calls,0 emails,0 refresh grants,4 acknowledged SQL steps,10 hashes and accepted ZIP verified. Expired/cancelled/stored-replaced reads and completions denied as expected; original profile/owned workspace set unchanged; fixture/audit HTTP200 zero rows; both new session logouts HTTP204. Twenty-five owner local tests pass and actual clipboard copy/readback worked. Do not repeat AU02.04 or credit a live refresh exercise. Older Node-session cleanup stays unverified.

Seven of eight original invitation groups now have scoped passes: AU02.01/02/03/04/06/07/08. AU02.05 retains successful setup/idempotence, with [one unfinished setup completion-network failure/retry](SECURITY_FR_2_5_BATCH_W_ADMIN_SETUP_COMPLETION_RETRY.md) remaining. The current owner step is one Free Personal invitation to a new controlled inbox and opening its verified setup form without submitting. The complete blocking/retry protocol is prepared. No new public case, runtime, SQL installation, frontend upload or stronger MFA requirement; other W/V/FR.2/Stage3 and release scopes remain open.

## AU02.05 actual completion-network retry accepted — 1 November 2026

[Owner browser receipt](security-fr-2-batch-w-owner-admin-setup-completion-retry-pass.json) confirms blocked:devtools, retained setup page, successful retry without another password entry, correct recipient Free Personal workspace and one visible Personal workspace. The failure text was not recorded; do not invent the message or repeat the accepted flow to collect it. Combine with retained server idempotence evidence. All eight original invitation groups now have scoped passes; exact copy/internal provider outage are outside this result. Remove the test rule if it remains.

Next: [AU01.04 ordinary signup confirmation and return to sign-in](SECURITY_FR_2_5_BATCH_W_ORDINARY_CONFIRMATION_CHECK.md), one fresh controlled signup/email and one manual sign-in. Earlier AU01.01–03 evidence is retained; the old confirmation link was consumed before the return-flow correction. No Admin invitation, resend, SQL, settings or upload. The dated entries above retain their as-of-date history; earlier seven-of-eight/pending AU02.05 statements are superseded by this result. Other W/V/FR.2/Stage3 and release scopes remain open, including unverified older Node-session cleanup.

## AU01.04 ordinary confirmation/manual sign-in accepted — 1 November 2026

[All owner results passed](security-fr-2-batch-w-owner-ordinary-confirmation-pass.json), with no error. Current AU01.01/02 positives and earlier AU01.03 denial are retained; no prior confirmation or invitation repeat. Four of five signup groups have scoped observations/passes, not an overall W percentage.

AU01.05 source review reproduced network/server failures being swallowed into inbox guidance. The correction retains privacy, safe messages and the 60-second cooldown; 13 local tests, four syntax checks and seven input identities pass. [Prepare/upload one two-file staging patch](SECURITY_FR_2_5_BATCH_W_CONFIRMATION_REQUEST_RETRY.md), verify served bytes, then use the confirmed account for duplicate-email/blocked-resend/local-cooldown checks. No new account/inbox, SQL or settings action. Confirmation success/password/adoption code remains unchanged; no repeat of the accepted flow. Earlier next-AU01.04 descriptions are historical.

## AU01.05 package and stable served bytes verified — 1 November 2026

[Owner package/deployment receipt](security-fr-2-batch-w-owner-confirmation-request-package-and-deployment.json):7 inputs,42 entries/two changed/40 preserved, portable readback true, retained ZIP unchanged and exit0. New output SHA2562006961ea38c6219a3a9b70f85cff7b683cae4d28879aa5df5ec722119feeaff; deployment c8977c16 supplied. Preparation's frontend_uploaded:false remains historical to that local step.

[Independent public readback](security-fr-2-batch-w-confirmation-request-public-readback.json) matches auth-flows.js?v=9 and auth.html via its same-origin auth alias. Four public fetch attempts include the first strict HTML error and the successful308/200 follow-up;0 Auth/email/SQL/settings/account requests. No new code/tests. Continue only the existing-account browser sequence; do not repackage/reupload or repeat confirmed flows. AU01.05 itself is not yet accepted; other W and older Node-session cleanup carries remain open.


## Private runner access and AU01.05 accepted — 5 November 2026

FRE297: all six secret names are present and the runtime privately verified the two ordinary accounts and existing Super Admin. The first run stopped before signup because the canonical signup pin omitted the accepted package's two staging DNS substitutions. A public comparison proved only those substitutions, the pin was corrected, and ten local guard checks passed. The failed receipt is retained.

[Successful live run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/41991579027): three confirmed active identities/expected roles; 18 direct API calls; one duplicate signup and one public currency read; one actually aborted browser resend; generic existing-email guidance, safe network feedback, form/address/button retention and no-dispatch local cooldown all passed. Three created sessions received local logout acknowledgement; the test context closed. Across both setup runs six sessions received local logout acknowledgement; read-only checks found no rows with either exact run tag. These results do not resolve the older unbound Node sessions.

All five original signup/confirmation groups now have scoped passes. Real provider429/quota and duplicate-signup email delivery were not measured. The isolated browser blocked service workers for reliable request interception, so no PWA acceptance is added. Existing invitation/recovery/password/sign-out passes and the owner-deferred AU03.04 retry remain retained. Next: direct server password-boundary evidence and the remaining applicable W password/recovery/session variants. V/X/Y/Z and wider FR/stage/release acceptance remain open.
