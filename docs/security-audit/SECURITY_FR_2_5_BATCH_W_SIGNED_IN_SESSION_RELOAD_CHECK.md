# Signed-in session reload — initial AU05.01 variant

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner confirms the new password signs in and opens the dashboard in response to the requested signout/reload/new-password check. [Receipt](security-fr-2-batch-w-owner-new-password-signin-pass.json). The password-change/core new-credential path is owner PASS. Provider-save failure/retry, older-password and required recent-login variants are not inferred. Do not repeat password saving, signout/new-password entry, ZIP or SQL steps that have already passed.

## One normal reload while signed in

Stay signed in on the same account and [staging deployment](https://f8c4b8d6.mushavo-budget-staging.pages.dev/app.html). Refresh/reload the browser page once **without signing out first**. Expect the same account's dashboard to reopen without entering the password again or seeing the retired sign-in verification/trust page. Report whether it stays signed in; if not, report only the displayed message. No credentials, private values, console commands, settings, SQL, email/code request or deployment change is needed.

This is an initial saved-session restoration variant within the existing frozen **AU05.01 — Same-user access refresh**. A normal reload of a fresh token may not invoke the Auth refresh grant. Do not credit actual access-token rotation, expiry recovery, transient/invalid refresh, revocation or whole AU05.01 from this step alone. Those retain their existing source evidence and pending hosted scope. No fake expiry, token manipulation, provider failure or rate hammering is requested.

Current source calls SDK getSession on startup, validates the server application session and binds startup work to the same actor/token. The prior 119 local checks, including session refresh/cleanup and signout regressions, retain their exact source pin e62f74494f4c828cdb4a748b2f175d6dfa431d67. No runtime edits or test reruns are needed for this receipt and handoff.

Preserve all original 31 AU definitions and all prior evidence. AU05.03 owner PASS is retained, password-mismatch prominence stays deferred, and the accepted password-only all-role policy remains unchanged. V stays on hold with policy reconciliation before future factors; stronger-MFA findings are not closed. Full W/FR.2/Stage 3/re-audit/release remain open; production/native unchanged and APK deferred. Keep the stage prefix visible.
