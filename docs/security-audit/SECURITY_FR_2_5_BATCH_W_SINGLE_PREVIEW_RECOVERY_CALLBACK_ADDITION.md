# One exact preview recovery callback addition

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The [owner lookup receipt](security-fr-2-batch-w-owner-preview-recovery-callback-absent.json) reports that the exact f8c4b8d6 recovery callback is not listed. This is owner text evidence of the selected lookup, not an independent Auth-config read, current total count, settings save or demonstrated provider redirect failure. No prior custom sign-in verification failure is attributed to it.

## Concrete staging setting change

Target **Mushavo Budget Staging**, project reference **dczlddwbtgvfdujgcitb**. In **Authentication > URL Configuration > Redirect URLs**, add exactly one entry:

https://f8c4b8d6.mushavo-budget-staging.pages.dev/auth.html?flow=recover

Save that single addition. Keep the existing redirect entries and Site URL. Reload URL Configuration and check the exact entry remains listed. If it is already present at the time of action, use that readback rather than adding a duplicate. Return **saved and listed**, **already listed**, or the displayed error. The current total was not reported, so do not assume the list must now have nine entries.

This scoped addition allows the current fixed staging preview's recovery callback to be configured for the forthcoming existing AU04.06 same-origin real-link test. Current auth-security.js callbackUrl constructs auth.html?flow=recover on the request origin; auth-flows.js passes that result to resetPasswordForEmail. The earlier 26 October screenshot showed only eight canonical-origin callbacks. The selected preview is the owner-accepted source at e62f74494f4c828cdb4a748b2f175d6dfa431d67; no runtime patch, new ZIP or SQL install is needed for this setting.

Scope is one exact recovery redirect entry. No wildcard, unrelated preview/origin/flow entries, Site URL change, password/security toggle, account/factor/role change, production target or custom code/trusted-browser flow is part of it. Save/readback is a configuration prerequisite, not hosted recovery delivery/identity/password or full AU04.06 acceptance. Do not request a recovery email, code, password save or further login as part of this settings step. A bounded same-origin real-link/current-account test follows the confirmed readback.

No assistant-hosted Auth/settings write is performed by this handoff. The previous Auth-config API permission denial is preserved; no new token, broader permission or repeated denied GET. No runtime edits or new tests; retain prior 119 selected local passes at their exact pin. Original 31 AU cases and every earlier result stay intact, including AU05.03 and the recently passed cross-tab/account checks. V stays on hold with policy reconciliation before future factors; original stronger-MFA criteria remain unmet. Password-mismatch visibility stays deferred. Full W/FR.2/Stage 3/re-audit/release/findings remain open; production/native unchanged, APK deferred.
