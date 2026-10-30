# Recovery request received; dedicated recovery view next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE238.

The owner supplied two screenshots. The recovery page shows the expected generic acknowledgement and the same confirmed test email used earlier. The inbox shows a Supabase Auth reset email with a Reset password link. [Owner receipt](security-fr-2-batch-w-owner-recovery-request.json) credits the confirmed-account acknowledgement and email-receipt variant of AU04.01. The screenshot does not expose the full recipient header, request trace, loaded URL or private-browser state. Link use, password saving, unknown-account uniformity and rate behavior are not inferred. The images and recovery URL are not added to this repository.

The next existing case is **AU04.02 — Valid recovery opens dedicated new-password view**. [Exact handoff](security-fr-2-batch-w-recovery-link-handoff.json). Use the recovery email already received; do not request another email for this step.

Owner steps:

1. Open **Reset password once** in the same private browser window used to request recovery. If the link is already open, keep that result page and report it instead of opening it again.
2. Check that the page says **Choose a new password**, shows the intended account email, and has **New password** and **Repeat new password** fields.
3. After it finishes loading, check that the address ends with `auth.html?flow=recover` with no long code/token or fragment. Report that as yes/no; do not paste the email link or any token.
4. Return a screenshot of the resulting page or its heading and whether the email matches. **Stop before entering or saving a password.** Keep the result tab open; do not refresh, go back or reopen the email link. If an error or another identity appears, report the message without retrying or resending.

Opening consumes the one-use recovery link and creates an isolated recovery Auth session. The reviewed source sanitizes the URL before asynchronous work, remotely verifies the confirmed identity, then displays the dedicated password form. It does not change the password or adopt a normal application session until separate later actions. No app acceptance window, gateway code, SQL, settings change or upload is needed just to inspect this view. A clean-URL observation will cover only that part of AU04.06; full cross-tab/current-account isolation is a separate pending case.

Before a later password save, prepare exact controlled gateway-recipient readiness and bounded application-window readiness because a password reset invalidates prior approvals/proofs. No code-send, password-save or continuation step is authorized by this handoff. The background sign-in UX improvement remains deferred. Original local194/window11/public16 remain at their original pins; this receipt introduces no runtime change or new local test. Batch V Admin MFA remains on hold, full W/FR.2/Stage3/release and findings remain open, production/native unchanged, APK deferred.
