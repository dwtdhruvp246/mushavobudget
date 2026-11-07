# Wrong-password message pass; one recovery request next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE237.

The owner reports `The email or password was not accepted. Check both and try again.` This matches the existing invalid_credentials mapping for the requested known-email/wrong-password attempt. [Owner receipt](security-fr-2-batch-w-owner-invalid-credentials.json) credits the message variant of AU03.02. The owner did not separately state dashboard absence or provide a network/session trace, so those observations and all other bad-credential/rate variants remain outside this receipt. No additional bad-password attempts are requested.

The next independent existing case is **AU04.01 — Generic recovery request**, initially the confirmed-account acknowledgement and email-receipt variant. [Exact scope](security-fr-2-batch-w-recovery-request-handoff.json). It uses the same recent owner-controlled test address; no new account/inbox or deletion is needed. One manual request can dispatch one Auth recovery email. It does not change the password, establish an application proof, open a window or test the reset-link/password-save stages yet.

Owner steps:

1. In a private/browser context that is signed out, open https://mushavo-budget-staging.pages.dev/auth.html?flow=request-recovery.
2. Enter the same confirmed test email that was used for the recent signup/sign-in, then click **Send link once**.
3. Return the displayed page message and whether the recovery/reset email arrived in that account's inbox. Check spam if needed; do not resend as part of this step. Keep passwords, codes and the link private.
4. Leave the new recovery link unopened and keep this request browser context open/available for the following isolated-link test. No new-password save or continuation is requested now.

Expected page acknowledgement: `If your account can receive this link, check your inbox for the newest email. Wait a minute before requesting another.` A generic acknowledgement alone does not prove provider delivery; report inbox receipt separately. A rate/network/error observation stops the step for review rather than repeated sending. The handler is existing auth-flows.js code using isolated.auth.resetPasswordForEmail and the recover callback. The gateway's exact Zoho code-recipient allowlist does not govern this Auth recovery request; do not alter that list to perform this step.

No application acceptance window or fresh SQL/mode/configuration/upload is needed for the recovery request. Later valid/used-link, isolated password-view, password-save and session-invalidation cases require their own concrete handoff before execution. Full unknown-account response uniformity and actual link behavior are not credited from this positive request.

Background/fast sign-in UI polish remains deferred as `UX_AUTH_BACKGROUND_VERIFICATION`; current presentation is accepted for continuation. The new-browser email-code case remains queued behind controlled recipient/window readiness. Original194/window11/public16 receipts retain their scope and pins; no new runtime code or local tests were introduced here. Batch V MFA stays on hold; full W/FR.2/Stage3/release and all findings remain open. Production/native unchanged, APK deferred.
