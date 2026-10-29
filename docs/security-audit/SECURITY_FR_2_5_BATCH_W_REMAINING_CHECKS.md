# Batch W — remaining work after stable recovery isolation

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** Updated 29 October 2026.

The owner reports all three requested AU04.06 observations passed: recovery identity matches, URL clean, original dashboard unchanged. [Exact receipt](security-fr-2-batch-w-owner-stable-recovery-isolation-pass.json). This is the recovery-link isolation observation before password saving; it is not an additional password change or session adoption. No repeat of that observation is requested.

W retains **31 original case groups**, including both normal and failure variants. It has no trustworthy completion percentage: positive observations and partial cases are not the same as fully closed cases. The recorded browser workflow successes must be reused where applicable. AU02.06 and AU02.07 now have owner-confirmed setup/password-preservation PASS results. **Six invitation case groups remain without full W acceptance: five Admin cases await V/policy reconciliation, and AU02.08 retains decline/declined-invitation handling.** Positive acceptance and accepted-link replay denial have passed. Other remaining work comprises confirmation/resend closure, older-password/server-boundary/reauthentication checks, recovery expiry/save/retry, and refresh/sign-out/account-switch failure handling. No cases are added by this summary.

| Area | Original cases | Remaining scope |
|---|---:|---|
| Signup/confirmation | 5 | Final confirmation destination and resend/existing-email/rate results; reconcile earlier signup/pending/denial passes. |
| Invitations | 8 | New and existing Business recipient setup passed; existing password preserved and accepted-link replay denied. Five Admin cases await V/policy reconciliation; decline/declined-link handling remains. |
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

## Fixed remaining case list

“Observed” and “partly checked” describe evidence scope; they do not claim full-case closure or require an automatic repeat. Historical evidence is retained with its source limitations. The contract and original AU definitions remain unchanged.

| Case | Existing title | Evidence state | Remaining evidence / limit |
|---|---|---|---|
| AU01.01 | Valid ordinary signup | Positive signup observed | Earlier ordinary signup/email receipt retained; reconcile final source and test-account cleanup. |
| AU01.02 | Confirmation-pending guidance | Pending guidance observed | Earlier guidance observed; subsequent copy changes require final applicability reconciliation. |
| AU01.03 | Unconfirmed sign-in denial | Unconfirmed denial observed | Earlier denial observed; preserve signup-confirmation requirement and final applicability review. |
| AU01.04 | Correct confirmation destination | Not yet accepted | Correct confirmation destination and intended identity after current callback flow. |
| AU01.05 | Generic existing-email/resend failure and rate response | Not yet accepted | Generic existing-email/resend failure and rate behavior. |
| AU02.01 | Admin new-recipient setup | Blocked by paused V | Admin invitation setup/isolation/denial/retry scope depends on V and policy reconciliation. |
| AU02.02 | Admin-tab isolation | Blocked by paused V | Admin invitation setup/isolation/denial/retry scope depends on V and policy reconciliation. |
| AU02.03 | Wrong-recipient denial | Blocked by paused V | Admin invitation setup/isolation/denial/retry scope depends on V and policy reconciliation. |
| AU02.04 | Expired/cancelled/replaced invitation denial | Blocked by paused V | Admin invitation setup/isolation/denial/retry scope depends on V and policy reconciliation. |
| AU02.05 | Completion retry/idempotence | Blocked by paused V | Admin invitation setup/isolation/denial/retry scope depends on V and policy reconciliation. |
| AU02.06 | Business new-recipient first password | Owner-reported scoped PASS, 29 October | Email received, first password set, intended Business workspace opened and accepted membership shown on owner Team page. Preserve; no repeat. |
| AU02.07 | Existing Business recipient without password overwrite | Owner-reported scoped PASS, 29 October | Joined without a password setup, original password still signs in, intended Business workspace opens and only one membership remains. No repeat. |
| AU02.08 | Business accept/decline/replay | Partly checked: acceptance and accepted-link replay PASS | Positive membership accepted. Latest owner result confirms used-link unavailable message and one membership; this supersedes the earlier checkbox-only description. Decline/no membership/reservation release and declined-link handling remain. |
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
| AU05.07 | Selected Auth rate errors and observed stale-token window | Historical review; current outcome pending | Earlier retired custom-code rate message is historical; remaining supported Auth rate and stale-token-window evidence must match the current password-only policy. |

## Remaining lettered packages

The fixed endpoint remains Z. **V, W, X, Y and Z remain open**; V is on hold. After W the planned sequence is **X (Personal/Family/Business roles and finance), Y (backend caller permissions/database races/containment), Z (integrated authorization recheck and Stage 3 closeout)**, with V's blocking requirements still to resolve. This is the Stage 3 authorization sequence, not the whole launch programme. Do not describe W/Z as a percentage of work or promise a number of clicks/hours from these heterogeneous groups.

Keep all future owner URLs on **https://mushavo-budget-staging.pages.dev/**. Do not request another preview callback, deployment, SQL rerun, mail, password write or settings change merely to report status. Prepare the next affected check with its specific target/actions before execution; reuse earlier accepted results. No new runtime change or tests are warranted for this evidence-only update. No full W/FR.2/Stage3/finding/release acceptance; production/native unchanged and APK deferred.

## Decline check paused for invitation delivery — 29 October 2026

Owner screenshot image(20261029-191820).png shows Business Team seat limit 10, active members 3, pending invitations 1, available 6. The attempted invitation is marked failed and the page says “Edge Function returned a non-2xx status code.” This is not a decline or reservation-release PASS. Existing AU02.06/07 and accepted-link replay results remain accepted.

Current source can return several bounded mail/reservation/auth error codes, but business.js displays the SDK's generic non-2xx message without reading the JSON error response. No underlying provider failure/rate code is established by this screenshot. Obtain only the existing failed invite-business-member request's HTTP status and Response error/code/message fields; exclude headers, payload, tokens and invitation links. No resend, cancel, new invitation, deployment, SQL rerun or permission change requested while diagnosing.

## Failed delivery response received — 29 October 2026

Owner supplied HTTP502 response BUSINESS_INVITATION_EMAIL_FAILED for invitation 2cbc417b-930e-47b3-b7c3-ec0b551834d2. In the reviewed source this follows successful reservation and delivery-result recording; it does not establish the underlying provider cause. No rate/SMTP/account-specific diagnosis is asserted. The existing delivery_error_code stores the Auth provider HTTP status or a bounded fallback. Prepare one read-only lookup of this invitation and recipient account/profile linkage; no resend, cancellation, mail dispatch, settings write or grant change. See supabase/diagnostics/security_fr_2_5_business_invitation_delivery.sql. Decline acceptance remains pending; previous accepted results retained.
