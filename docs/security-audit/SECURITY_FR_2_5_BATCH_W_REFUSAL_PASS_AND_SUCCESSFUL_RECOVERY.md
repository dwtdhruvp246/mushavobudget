# Rejected save passed; controlled successful retry next

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE250.

[Owner screenshot receipt](security-fr-2-batch-w-owner-recovery-current-password-refusal.json) shows **Choose a new password**, **Choose a password different from your current password.**, the intended verified account, masked populated password fields and the retained Save password form. This is a scoped UI pass for the initial provider-refusal variant of AU04.05. The reviewed mapping is consistent with same_password; no independent provider request/status, private field equality or backend password-state snapshot was supplied. Successful retry/security/session outcomes and full AU04.05 remain pending.

[Next conditional handoff](security-fr-2-batch-w-recovery-positive-retry-handoff.json) completes the natural UI retry using the same account/form and one new password save, one manually requested gateway code, one verification and deliberate app continuation. It is conditional on the owner having saved the prepared recipient secret in both staging environments before redeploying, and on a current bounded application window. That secret-save fact is still not explicitly reported; the owner can satisfy/check the condition locally and proceed without another permission exchange. If it was not done or is unknown, stop and report before changing the password. No live secret equality or delivery is credited yet.

The recorded window expires **27 October2026 17:21:26UTC /19:21:26 Africa/Johannesburg**. If time has passed, rerun only the unchanged earlier one-account window SQL and use its ready result; no profile repair, global resume or automatic unexpired-window extension. The application window does not establish provider recovery-session freshness. Current actor/session checks stay inside the existing controller.

Owner steps after those conditions hold:

1. In the same original recovery form choose a **different** private password of at least eight characters, put it in both fields and select **Save password once**.
2. Expect the form to close and **Password saved. Verify this account before continuing.** / **Verify your sign-in**. If a code is needed, select **Send email code once**. Enter the newest code only on the website and verify it once.
3. After **Sign-in verified.**, confirm the verified account is the intended recovery account. Tick **Open the verified account shown above**, then select **Continue to app once**. This is the existing explicit account-adoption acknowledgment; it may replace the account in app tabs, as the page states. If another identity is displayed, stop before adopting it.
4. Report the actual password-save/verification messages, whether the code email arrived, whether that account's dashboard opened, and whether the recipient secret was saved in both staging environments. Return no password, code, token or recovery URL. On any different message or missing email, stop without more password submissions/code sends; the password may already have changed if a later verification step failed.

No code/settings/deployment change, new inbox/account, repeated tests or additional SQL is requested now. There is only the existing expired-window contingency. Runtime pin a1feb46df4a8c118a7e7a7d2255d4dd4e82448b4 is unchanged; app source explicitly preserves actor binding, post-save proof requirement and acknowledged adoption before navigating to app.html. Direct old-session/device invalidation and cross-tab variants are not inferred from a dashboard screenshot and remain separate evidence items.

Both UI improvements remain deferred; V Admin MFA on hold; full W/FR.2/Stage3/release/findings open, production/native unchanged and APK deferred. No new AU acceptance cases added.
