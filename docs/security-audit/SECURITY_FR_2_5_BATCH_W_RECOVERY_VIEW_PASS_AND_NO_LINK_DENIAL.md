# Verified recovery view passed; no-link denial next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE239.

The owner screenshots show **Choose a new password**, **Your email link has been verified**, the same intended recovery account, and empty New password / Repeat new password fields. The owner then corrects the loaded-address suffix to `auth?flow=recover`. [Owner receipt](security-fr-2-batch-w-owner-recovery-link-view.json) credits AU04.02 at this UI/identity scope. The extensionless route is acceptable. The earlier `auth.html%3Fflow%3Drecover` report is superseded; no redirect defect, runtime patch or new upload is established. A source-only synthetic URL demonstration also shows that this percent encoding is normal inside a nested redirect query, while the callback constructor produces a real flow query. It does not establish the actual provider's redirect trace.

The address bar is outside both images. The clean suffix is an owner-reported partial AU04.06 observation, not independent inspection of the entire URL or cross-tab/session isolation. No password-save, used-link, wrong-account, app-adoption or whole-batch acceptance is inferred. Keep the existing verified password-form tab open without refreshing.

The next existing case is **AU04.03 — Wrong/no session**, scoped first to a separate tab with no usable recovery-link material/session. [Exact handoff](security-fr-2-batch-w-recovery-no-link-handoff.json). This checks that a public recovery intent URL cannot grant access to reset a password.

Owner steps:

1. Leave the original **Choose a new password** tab open and unchanged.
2. Manually open a **separate new tab in the private window** and paste this public address: https://mushavo-budget-staging.pages.dev/auth?flow=recover. Do not duplicate, replace or refresh the genuine recovery tab, and do not reopen the email link.
3. Expect `This link or session is unavailable. Open the newest email or request another link.` The password fields should be absent and the app should not open. Return that message or a screenshot, plus whether the password fields are absent. If fields appear, do not enter or save anything; report it.
4. Do not follow the generic message's request-another-link suggestion during this check. After reporting, the separate denial tab can be closed; keep the genuine verified recovery tab available.

The reviewed controller rejects missing link material without using an existing session. The form stays hidden until actual link verification succeeds. Existing local cases cover both the controller and actual page module; no test suite is rerun for this evidence-only update. A new tab has separate sessionStorage; manually opening this public address avoids using the original tab's link material or storage. No new email, password save, code, SQL/window, setting, upload or account action is requested.

Wrong-identity/current-account isolation, used/expired-link behavior and password-save retry remain pending. Before a later real save/continuation, prepare the controlled gateway-code recipient and bounded application-window readiness because a reset invalidates prior approvals/proofs. Background sign-in UX polish remains deferred. Original194/window11/public16 stay at their existing pins. V Admin MFA stays on hold; full W/FR.2/Stage3/release and findings remain open. Production/native unchanged; APK deferred.
