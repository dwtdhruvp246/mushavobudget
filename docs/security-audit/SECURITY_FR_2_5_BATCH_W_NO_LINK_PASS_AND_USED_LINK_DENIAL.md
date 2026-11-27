# No-link denial passed; used-link denial next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE240.

The owner screenshot shows **Checking your account**, the exact expected unavailable-link/session message, no verified identity or password fields, and Back to sign in. [Owner result](security-fr-2-batch-w-owner-recovery-no-link.json) credits the flag-only/no-usable-link variant of AU04.03 at this UI scope. No HTTP/session trace, private-browser address bar, original-tab retention or wrong-identity variant is inferred. The original recovery email has already opened the intended account's dedicated new-password view under AU04.02; no password save has been reported.

The next existing case is **AU04.04 — Expired/used link**, starting with the already-used-link variant. [Exact handoff](security-fr-2-batch-w-recovery-used-link-handoff.json). This is a deliberate single replay of the original email link, not another visit to the sanitized public address, and does not request a new email.

Owner steps:

1. Leave the original verified **Choose a new password** tab open and unchanged. The separate no-link denial tab can be closed.
2. In the **same recovery email already used**, open **Reset password once in a separate private tab**. If needed, copy the email link and paste it privately into that separate tab. Keep the link private; do not replace, refresh or duplicate the original verified tab.
3. Expect `This link or session is unavailable. Open the newest email or request another link.` with no password fields. Return the displayed message or a screenshot and whether password fields are absent.
4. If password fields or a verified identity appear, stop and report them without entering/saving anything. If another error appears, report it without retrying. Do not request another email or code during this check. After reporting, close only the replay/error tab and retain the original verified recovery form.

The reviewed source handles callback errors and otp_expired without falling back to an existing session; password fields stay hidden until actual link verification succeeds. Existing local controller cases cover these paths. The provider's real replay outcome, HTTP count and effect on the original isolated session remain to be observed, not assumed. This step can credit only used-link behavior, not actual timeout expiry or unrelated-account isolation. No new test suite is run for this evidence-only update.

No password entry/save, email dispatch, SQL/window, settings, upload or account action is requested. Before a later real password save/continuation, confirm controlled gateway-code recipient and bounded application-window readiness because resetting a password invalidates prior approvals/proofs. Background sign-in UX polish remains deferred. Original194/window11/public16 stay at their source pins. V Admin MFA stays on hold; full W/FR.2/Stage3/release and findings remain open. Production/native unchanged; APK deferred.
