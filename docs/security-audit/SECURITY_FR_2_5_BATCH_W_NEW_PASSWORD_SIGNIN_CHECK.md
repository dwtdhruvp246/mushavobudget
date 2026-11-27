# Password change succeeded — confirm the new password signs in

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner confirms the password changed after correcting the earlier input mistake, with no verification code required for this attempt. [Exact owner receipt](security-fr-2-batch-w-owner-password-change-success.json). Record the positive save under existing AU03.04. Do not save again or request a code to repeat this successful step.

## One sign-in check on the same deployment

Use the same owner-controlled staging test account and the same preview origin [f8c4b8d6](https://f8c4b8d6.mushavo-budget-staging.pages.dev/app.html). Keep the new password private and available for subsequent tests.

1. Return to the app. If still signed in, choose **Sign out**.
2. Reload and expect the ordinary sign-in form.
3. Sign in once with the same account's email and the **new password**. Expect its authorized dashboard without the retired custom sign-in verification/trust screen.
4. Report whether the form and dashboard appeared as expected; if not, report only the displayed error. No password, token, code, SQL run, upload, new password save or mail request is needed.

Successful credential use and the signout/reload outcome remain pending this check. The earlier mismatch rejection is client validation, not an observed hosted Auth-provider failure/retry. No code needed on this successful attempt does not prove that secure password-change reauthentication is globally disabled or satisfy the required-condition failure/success variants of AU03.05. No artificial failure, old-password rate test or code dispatch is requested.

This handoff adds no public AU case or runtime change. Keep original 31 AU definitions and all historical results. Earlier 119 local checks retain source e62f74494f4c828cdb4a748b2f175d6dfa431d67; no new tests were run for this owner receipt. Accepted direct sign-in/faster loading and the backend password-only policy remain. UX_AUTH_PASSWORD_MISMATCH_VISIBILITY stays deferred by the owner. V remains on hold with policy reconciliation before future factor work; stronger-MFA findings remain open. Full W/FR.2/Stage 3/re-audit/release are not complete; production/native unchanged, APK deferred. Keep the stage prefix visible.
