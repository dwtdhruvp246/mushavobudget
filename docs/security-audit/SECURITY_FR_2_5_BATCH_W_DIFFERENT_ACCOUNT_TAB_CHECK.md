> Current observation, FRE275, 28 October 2026: **Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** [Owner receipt](security-fr-2-batch-w-owner-tab-a-stayed-signin.json) confirms A stayed on sign-in. Clarify only the already-observed B result: did the different account successfully open its correct dashboard without previous-account name/data, or was there an error/no second account? No repeat browser action is requested to answer; the procedure below is the original handoff, not a request to repeat it. A is recorded, B identity/data scope and full AU05.06 remain unconfirmed.

# Different-account sign-in with another tab kept signed out

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner explicitly confirms original tab A returned to sign-in automatically before refresh after signout in tab B. [Owner receipt](security-fr-2-batch-w-owner-automatic-cross-tab-signout-pass.json). Automatic cross-tab signout/old-dashboard removal is owner PASS within AU05.06. No repeat signout or reload is requested. Persistence after reload was not separately reported; do not silently credit it or force a repeat now.

## One different-account sign-in

Use the same normal browser profile and exact [accepted staging app origin](https://f8c4b8d6.mushavo-budget-staging.pages.dev/app.html). Keep tab A at sign-in.

1. In tab B, sign in once with a **different existing, confirmed staging test account you control**. Use that account's private credentials only in the browser. If you no longer have a second account, report that blocker instead of creating one or requesting mail.
2. Check B shows that account's dashboard, without the previous account's name or data. If the accounts contain indistinguishable empty data, report only what can actually be identified; do not infer financial-data isolation from an empty screen.
3. Return to A without refreshing it or submitting sign-in. A should remain on sign-in. A deliberate signout records manual sign-in intent, so a different tab's sign-in event must not automatically reopen A's protected views.

Report whether B shows the intended account and A stays on sign-in, or the visible error/unexpected old-account content. Do not post credentials, tokens, codes, private financial data or raw provider responses. No password change, signup/recovery/confirmation message, verification code, SQL, settings, ZIP/upload, forced throttling or token editing is requested.

This is another bounded variant of original **AU05.06 — Account switch with in-flight/Business UI clearing**, not a new AU case. Different-account sign-in and manual-tab isolation are observed separately from an in-flight race, Business workspace clearing, failed push/Auth cleanup or server JWT revocation. Do not mark the entire case complete from this variant.

At source e62f74494f4c828cdb4a748b2f175d6dfa431d67, app.js keeps a manual-sign-in tab protected from non-null cross-tab Auth events; the existing signout-entry regression covers this behavior and explicit password authentication is required to resume. Retain the prior 119 local checks; no runtime edits or new tests are needed for this owner receipt/handoff.

Preserve original 31 AU definitions, all earlier evidence and AU05.03 owner PASS. Password-only all-user policy stays in effect; signup confirmation and server session/role/tenant controls stay intact. V remains on hold with policy reconciliation before future factors; stronger-MFA findings remain unmet. UX_AUTH_PASSWORD_MISMATCH_VISIBILITY stays deferred. Full W/FR.2/Stage 3/re-audit/release/findings remain open; production/native unchanged, APK deferred.
