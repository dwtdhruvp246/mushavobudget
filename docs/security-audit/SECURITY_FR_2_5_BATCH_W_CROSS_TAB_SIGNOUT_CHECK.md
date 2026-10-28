# Cross-tab signout — initial AU05.06 variant

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner reports that the normal page reload stayed signed in. [Receipt](security-fr-2-batch-w-owner-saved-session-reload-pass.json). Initial saved-session restoration is owner PASS. A fresh saved token may not use an Auth refresh grant, so actual rotation, expiry recovery, invalid-refresh cleanup and full AU05.01 remain unverified. Do not repeat the passed reload or password-change/new-password sign-in steps.

## Two normal tabs, one signout

1. Keep the signed-in dashboard open in tab A. Open [the same staging app](https://f8c4b8d6.mushavo-budget-staging.pages.dev/app.html) in a second **normal tab B, in the same browser profile**. It must show the same account. If it does not, stop and report that state; do not sign into another identity.
2. Click **Sign out once in B**. Switch back to A without reloading. Its old dashboard should clear and the sign-in form should appear when the tab resumes.
3. Reload A once. It should stay signed out. Report whether both tabs show sign-in and whether A's old dashboard cleared before that reload, or the exact displayed error. Do not submit another sign-in, password change, mail/code or account request.

This is the ordinary signout/old-render clearing variant of the frozen **AU05.06 — Account switch with in-flight/Business UI clearing**. It does not satisfy a different-user switch, an in-flight race, Business clearing, failed push cleanup, failed Auth signout, invalid refresh or server JWT revocation. Observe those only under their existing scoped requirements. No new public AU case is added.

Current reviewed app.js Auth callbacks reset state and show the authentication view on a null session; handleSignedOut records explicit manual sign-in intent. The source contract remains password-only for every role, with signup confirmation and server session/role/tenant controls intact. Retain the 119 prior local checks at e62f74494f4c828cdb4a748b2f175d6dfa431d67. No runtime edits or new tests are needed for this documentation handoff.

No ZIP, SQL, settings, token editing, API console work or provider dispatch is requested. Preserve all original 31 AU definitions, all earlier evidence, AU05.03 owner PASS and deferred UX_AUTH_PASSWORD_MISMATCH_VISIBILITY. V stays on hold with policy reconciliation required before future factors; stronger-MFA criteria stay unmet. Full W/FR.2/Stage 3/re-audit/release/findings remain open. Production/native unchanged; APK deferred.
