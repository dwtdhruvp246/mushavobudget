# Read-only preview recovery callback readiness

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** [Owner receipt](security-fr-2-batch-w-owner-signed-in-recovery-denial-pass.json) reports the exact expected unavailable-link/session message in C and B remaining unchanged. This credits the message-denial and normal-account continuity observations for the signed-in/no-link AU04.03 variant. The reply did not explicitly report password-form absence; do not infer that detail or full AU04.03/AU04.06. No repeat of the passed route/account observations is requested.

## One read-only setting lookup

In **Mushavo Budget Staging**, verify project reference **dczlddwbtgvfdujgcitb**. Open **Authentication > URL Configuration** and inspect **Redirect URLs**. Check whether this exact entry is currently listed:

https://f8c4b8d6.mushavo-budget-staging.pages.dev/auth.html?flow=recover

Report **listed**, **not listed**, or **cannot inspect**. Do not add, edit or delete any entry, change Site URL, or select Save. No token, password, screenshot of private fields, Management API credential or permission expansion is needed. Do not request a real recovery email until callback readiness and the same-origin test setup have been resolved.

## Why this is the next prerequisite

The retained [26 October settings screenshots receipt](security-fr-2-batch-w-owner-settings-screenshots.json) shows eight exact redirects, all on https://mushavo-budget-staging.pages.dev, and no wildcard. It includes canonical auth.html?flow=recover but not the f8c4b8d6 preview origin currently used by these owner checks. This dated receipt does not prove current settings are unchanged or a live redirect failure.

Current auth-security.js callbackUrl derives auth.html?flow=recover from the request page origin. A valid-link account-isolation test therefore needs verified callback readiness for that origin. Opening a clean route with no callback material does not test provider redirects. Do not assume the preview callback is allowed from ordinary password sign-in or the no-link denial result, silently add a wildcard, request email speculatively, or use a cross-origin canonical callback and credit same-origin isolation.

The next actual Auth case remains frozen **AU04.06 — Cross-tab/current-account isolation and sanitized URL**; this lookup is readiness work inside its existing scope, not an extra public AU case or a passing link test. It does not authorize a setting write, real mail, password update, account switch, SQL or deployment. After the lookup, prepare the concrete same-origin real-link check against the reviewed current source. Preserve the earlier Auth-config API denial; no new token, broader scope or repeated denied GET is requested.

Prior 119 selected local checks remain at e62f74494f4c828cdb4a748b2f175d6dfa431d67; no runtime changes or new tests. Preserve all 31 original AU definitions, earlier evidence, automatic cross-tab signout/different-account owner passes and AU05.03 owner PASS. Password-only all-user sign-in policy remains unchanged; V stays on hold with policy reconciliation before future factors and stronger-MFA criteria stay unmet. Password-mismatch visibility stays deferred. Full W/FR.2/Stage 3/re-audit/release/findings remain open; production/native unchanged, APK deferred.
