# Deferred Auth UI improvements

Stage 3/10 | FR.2/8 | Batch W/Z. Updated 27 October 2026, FRE242.

These items are explicitly deferred by the owner. They do not change the current Auth implementation or acceptance gates.

## UX_AUTH_PASSWORD_MISMATCH_VISIBILITY

Status: **DEFERRED_BY_OWNER**. Recorded 27 October 2026 from [the mismatch screenshot and owner request](security-fr-2-batch-w-owner-recovery-mismatch-and-ux-deferral.json).

Owner request: “the Passwords do not match needs to be highlighted as someone can miss it. record it for later”. The current message appears as ordinary body text, making it easy to overlook despite correct mismatch validation.

Future behavior and acceptance:

- Make **Passwords do not match.** visibly distinct from ordinary page text, using a prominent error callout/emphasis near the password fields.
- Keep the message readable and noticeable on desktop and mobile; color must not be the only cue. Associate the error with the relevant fields and announce it accessibly.
- Preserve the existing mismatch rejection before any Auth password write.

No UI implementation is requested in this checkpoint. The screenshot credits only the mismatch-message/retained-form variant of AU04.05. Provider-save failure, successful retry, actual password mutation and session/security outcomes remain pending.

## UX_AUTH_BACKGROUND_VERIFICATION

Status: **DEFERRED_BY_OWNER**, retained from [the earlier owner decision](security-fr-2-batch-w-owner-ux-deferral-and-next-auth-case.json) and the existing progress record.

Trusted-browser checks should run behind a minimal **Signing in…** indicator and open the dashboard after successful proof. Show the email-code form only when user action is required. Reduce perceived and measured sign-in delay; measure before setting a timing target.

Keep protected views/data closed until server proof succeeds. Preserve actor/token binding, failure handling, revocation, new-browser code verification and separate Admin MFA. This item remains deferred; the new mismatch-visibility item does not replace it.
