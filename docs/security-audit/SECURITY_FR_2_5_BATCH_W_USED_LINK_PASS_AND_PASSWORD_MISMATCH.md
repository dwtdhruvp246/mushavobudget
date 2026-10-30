# Used-link denial passed; mismatched password validation next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE241.

The owner screenshot returned for the single used-recovery-link replay shows the expected unavailable-link/session message, no password fields or verified identity, and Back to sign in. [Owner receipt](security-fr-2-batch-w-owner-recovery-used-link.json) credits the used-link denial UI variant of AU04.04. The provider error code, exact replay-versus-timeout reason, entire URL/private context and preservation of the original recovery session were not independently inspected. Actual timeout expiry and all other variants remain pending; no password save or application transfer is inferred.

The next existing case is **AU04.05 — Password-save failure/retry**, starting with the local mismatched-confirmation variant. [Exact handoff](security-fr-2-batch-w-recovery-mismatch-handoff.json). This is one deliberately mismatched submission on the existing verified recovery form. It is not the later matching-password save, provider-failure or successful-retry acceptance.

Owner steps:

1. Return to the original **Choose a new password** tab for the same intended account. Keep it open without refreshing or reopening the email link. If that original form is unavailable, report it instead of requesting another email.
2. Enter **two different private test values**, each **at least eight characters**, into New password and Repeat new password. Do not share the values.
3. Click **Save password once**. Expect **Passwords do not match.** The form should stay visible. Return the displayed message or a screenshot of the page.
4. Leave the values mismatched and stop after reporting. Do not correct and submit matching values yet. If saving succeeds or a verification screen appears unexpectedly, report that result without requesting a code or continuing. Keep the original tab available; separate replay/error tabs can be closed.

The reviewed HTML requires eight characters in both fields. The controller validates the mismatch before any getUser or updateUser call. The page catches and displays the safe message; form reset/hide and password-flow continuation run only after save succeeds. This source review supports the bounded attempt, while the actual hosted UI outcome remains pending. No new local test suite is needed for an evidence-only update.

This mismatch check needs no email, gateway code, application window, SQL, setting, upload or account creation. Before the later real matching-password save/verification/continuation, confirm the exact controlled gateway-code recipient and bounded application-window readiness because a reset invalidates prior approvals/proofs. Full provider failure/retry, password mutation and session outcome are not credited from a validation message. Background sign-in UX polish remains deferred. Original194/window11/public16 retain their pins. V Admin MFA remains on hold; full W/FR.2/Stage3/release and findings remain open. Production/native unchanged; APK deferred.
