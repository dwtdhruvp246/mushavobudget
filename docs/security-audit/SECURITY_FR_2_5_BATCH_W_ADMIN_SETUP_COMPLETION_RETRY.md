# AU02.05 — completion failure and retry after the first password is saved

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: a169e996ed8dccfac899c727ac0513caba26eea8.

## Original case and accepted starting evidence

Original acceptance source: SECURITY_STAGE_3_5_AUTH_FLOWS.md, AU02 invited-setup case5 completion retry/idempotence, password-before-completion sequencing and no normal session/workspace adoption before verified completion.

AU02.01/02 initial setup and Admin-tab isolation already passed. Repeated completed-invitation calls returned the original workspace with an unchanged owned-workspace set in [the accepted idempotence receipt](security-fr-2-batch-w-owner-completed-admin-invitation-pass.json). AU02.03 and [AU02.04](security-fr-2-batch-w-owner-unavailable-admin-invitation-pass.json) now have scoped server passes. Business AU02.06–08 are accepted.

The remaining AU02.05 observation is a genuine browser completion-network failure after password save, followed by successful retry of the same unfinished setup. This protocol combines that result with retained idempotence evidence; it adds no requirement to force an Auth-provider outage or new public AU case. No code, SQL installation, frontend upload or settings change is needed.

## Bounded recipient preparation — current owner step

Use the stable staging app https://mushavo-budget-staging.pages.dev/app.html and the existing staging Super Admin. Users > Manual user settings > Invite a new user.

| Field | Test value |
|---|---|
| Full name | Batch W Setup Retry |
| Email | An unused inbox controlled by the owner, entered privately in the app |
| Plan/workspace | Free / Personal |
| Billing and currencies | Monthly; subscription USD; workspace USD/default USD |
| Free plan dates | Start today; no paid expiry required |
| Family/member/payment fields | Families0; member option off; Payment received unchecked |

Send exactly once. If delivery/rate/error occurs, retain the safe message and stop without resend or another recipient attempt. No configured quota/reset time is assumed. Open the received link in a new normal tab on stable staging, verify the displayed recipient and leave Complete setup unclicked. Return only: email received; intended recipient displayed; unfinished setup form open before any Complete setup submission. No address/password/link/token is needed in chat.

A fresh unfinished recipient is needed because the previous completed invitation returns its committed workspace and cannot demonstrate first-completion UI retry. This is one controlled ordinary customer account, not another platform Admin.

## Completion-block and retry protocol — prepare before the first submission

Keep the recipient setup tab open. Use Chrome DevTools in THAT recipient tab. The current feature is Request conditions (formerly Network request blocking). Official reference: https://developer.chrome.com/docs/devtools/request-conditions ; Chrome145 naming/default availability: https://developer.chrome.com/blog/new-in-devtools-145 .

1. Open DevTools (F12 or Ctrl+Shift+I), focus it and press Ctrl+Shift+P. Select Show Request conditions.
2. Add and enable one BLOCK condition for this exact staging URL:
   https://dczlddwbtgvfdujgcitb.supabase.co/rest/v1/rpc/complete_admin_user_invitation
   Use a blocking condition, with the general Network throttle remaining No throttling. Keep DevTools open; closing it disables request blocking.
3. In the recipient form enter the private first password/confirmation of at least8 characters, keep USD, and tick Open this verified account in Mushavo Budget after setup.
4. Click Complete setup once. The password-save request is allowed, but the completion endpoint must show (blocked:devtools) in Network. The expected UI is a connection/retry error, the setup form retained and no dashboard adoption. Current source message: The request could not finish. Check your connection and try again. Password fields are expected to become hidden because passwordSaved is retained.
5. If the dashboard opens or the completion request was not blocked, stop and report. Do not treat a successful first submission as failure/retry acceptance or issue another email automatically.
6. Remove only the condition added for this test. Keep the same setup page and values; no reload or password change is needed. Click Complete setup once more. Source should skip an already-saved password, complete the same invitation and open the correct Free Personal workspace after the existing acknowledgement.
7. Confirm one Personal workspace for that recipient and report the requested observations. Ensure the added block condition is removed after the test, including when stopping.

Expected owner observations: completion request actually showed (blocked:devtools); a retryable setup message/form remained; password was not requested again for retry; retry opened the correct recipient/Free Personal workspace; one Personal workspace exists. Return the short safe failure message as well. Do not copy Network headers, request bodies, Auth tokens, invitation URLs or exported HAR.

## Source basis and limits

Current signup.html submit handler calculates needsPassword from invitationController.passwordSaved/completed, calls savePassword first, clears password fields, then calls complete. On a completion-network error it retains the controller, shows a safe message and re-enables the form. showInvitedForm hides password fields when passwordSaved is true.

auth-security.js createInvitationSignupController sets saved only after a successful password update (or the existing same_password retry allowance), validates the real user/session/invitation again, and latches completed only after a UUID completion response. Adoption occurs only after completion. Existing tests/admin-invitation-setup-retry.test.mjs documents password retry/session checks; it was reviewed without another local-suite run in this evidence-only update. These source statements are not hosted retry evidence.

Planned owner limits: one invitation send, one intended first-password update, one blocked completion submission and one unblocked retry; browser HTTP traffic is unmeasured. Blocking a client request does not exercise an internal provider500 response or actual email-link timeout. The stored replacement-state AU02.04 result is not re-run. The older Node-session cleanup carry-forward remains separately unverified and no global/others signout or Auth-table deletion is requested.

All seven currently accepted invitation groups retain their exact scopes. AU02.05 remains partial until the actual retry result is supplied. Full W/V/FR.2/Stage3/release acceptance is not claimed. Production/native unchanged, APK deferred. No new tests/runtime or assistant hosted/email action.
