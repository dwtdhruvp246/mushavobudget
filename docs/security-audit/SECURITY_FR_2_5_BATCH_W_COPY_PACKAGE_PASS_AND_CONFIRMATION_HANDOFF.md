# Batch W — Windows copy ZIP pass and confirmation-link browser handoff

**Stage 3/10 | FR.2/8 | Batch W/Z — Windows ZIP preparation COMPLETE; deployment URL received; served copy and confirmation-link checks pending. V MFA ON HOLD.**

## Accepted preparation

The owner ran source commit1abc6f40fdda488706a5cc0c85a758880e49199e and supplied the safe preparation result twice, followed by the new deployment URL. These are one preparation receipt, counted once:15 source hashes verified,44 entries,2 changed and42 preserved, exact retained ZIP unchanged, portable ZIP readback PASS and process/combined exit0. Windows .NET ZIP readback remains false; no additional tests are inferred.

New ZIP SHA256:a6c5a3a3111b0a78af375a0ccf86f1bc7387e78b4a4b57adbada1efe04d8879d. The command's frontend_uploaded:false describes local preparation. Subsequent URL supplied: https://df776a63.mushavo-budget-staging.pages.dev/. Provider success status was not separately supplied. [Complete safe receipt](security-fr-2-batch-w-owner-copy-package-and-deployment.json).

## Public-readback limit

Four bounded public GET attempts for app.js/auth-security.js at the deployment and canonical staging origins each returned HTTP403 from the assistant environment. No source byte, MIME or served-copy PASS is claimed. The cause (environment, intermediary or provider) was not established. No automatic retry, Auth/email/settings request, new upload or provider setting change follows from these responses.

A small owner browser display check is the next useful acceptance evidence; this does not pretend to be independent two-origin SHA256 readback. That exact-source readback remains unverified. Do not rerun the historical public18 reader against the changed source hashes.

## Concrete owner actions

Use the same private browser window used for the dedicated ordinary test account. No new terminal command, signup, deployment, Supabase Save, factor or acceptance-mode action is required.

1. Open https://mushavo-budget-staging.pages.dev/app.html?auth=manual&signup=pending. This displays existing pending-signup feedback without submitting a signup or sending mail. Expected text: **Check your inbox to confirm your email, then sign in.**
2. Sign in once using the existing unconfirmed dedicated test account and its retained password. Expected text: **Confirm your email before signing in.** If either changed message is absent or the account opens, report the observation before continuing; do not submit another signup or upload.
3. Open the original received confirmation link once in this same private window. Copy it into that window locally if the mail application would open a different browser. This intentionally confirms only the dedicated test account's email and may create its isolated Auth-link session. It does not change the password, other accounts, factors or provider settings.
4. Expected: **Email confirmed**, **Your email link has been verified.**, and **Verified account:** showing the supplied test email. The page should remain on the canonical staging account-security route (auth or auth.html with flow=confirm), with sensitive query/fragment material removed, and should not open the dashboard automatically.
5. Leave **Open the verified account shown above** unchecked and do not press **Continue to app** or request an email code. Opening the confirmation view itself does not request an application email code in the reviewed source. If the link is expired/unavailable, report its displayed message; no resend or repeated use is requested.

Return the two message observations, confirmation title/message, whether the verified email matches, whether the dashboard opened automatically and whether sensitive URL fields remain. Report only the clean host/path/flow; never paste the original Auth link, tokens, password or code. Manual browser actions have exit_code:null. Keep the confirmation page open for the next bounded step; preserve the dedicated test account and existing operator sessions.

## Scope

This continues existing AU01.04 confirmation-destination/identity and isolated-link behavior. It does not grant protected application access, satisfy all AU04/AU05 recovery/session cases or open an acceptance window. Prior owner AU01.01–03 scoped results, partial AU03.03, assistant local44, owner Windows74 and historical public18 retain their dated original scopes. Full W/FR.2/Stage3/release remain open; V MFA stays on hold; production/native unchanged and APK deferred.
