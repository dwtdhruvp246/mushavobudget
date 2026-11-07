# Clean recovery route while the normal app is signed in

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** [Owner receipt](security-fr-2-batch-w-owner-different-account-tab-pass.json) confirms B showed the different intended account dashboard without previous-account data. The prior receipt confirms A stayed on sign-in. This different-account/manual-tab variant of AU05.06 is owner PASS. Keep in-flight, Business and failure variants separate; full AU05.06 is not credited. Do not repeat passed signout, login, password change or reload checks.

## One route-only check — AU04.03

1. Keep the currently signed-in dashboard in B. Open [this exact clean recovery route](https://f8c4b8d6.mushavo-budget-staging.pages.dev/auth.html?flow=recover) in a **new normal tab C in the same browser profile**. Use this URL as supplied, without any email link, token, fragment or additional query. A recovery intent flag alone must not authorize password reset, even when the normal app already has an active session.
2. Expect **This link or session is unavailable. Open the newest email or request another link.** The new-password, repeat-password and Save password form must be absent. Do not click a security button or enter/submit anything, even if unexpected controls appear; report that state.
3. Return to the existing B dashboard without signing out or changing accounts. Check it still belongs to the same currently signed-in account and has not switched into recovery or adopted another identity. C can be closed after observing it.

Report the message/form visibility in C and whether B stayed on the same account. This needs no real recovery email, verification code, password save, new sign-in, SQL, settings, deployment, token manipulation or private values.

This is the signed-in-normal-client/no-recovery-link variant of frozen **AU04.03 — Wrong/no session**, with a scoped current-account continuity observation relevant to **AU04.06**. The earlier separate private-tab/no-session result is retained, not repeated. Do not infer real-link exchange, successful recovery, same/different-user valid-link isolation, full URL token sanitization, password writes or whole AU04.03/AU04.06 from a clean route with no material. No new public AU case is added.

At source e62f74494f4c828cdb4a748b2f175d6dfa431d67, createLinkController.verify rejects missing callback material before consulting any saved isolated or normal Auth session. auth-flows creates an isolated client, hides all forms, and reveals the password form only after successful controller verification. Existing tests cover flag-only/expired links, no stored-session fallback and no premature adoption. The prior 119 selected local checks retain their exact pin; no new tests or runtime changes are needed for this receipt/handoff.

Preserve original 31 AU definitions, all earlier evidence and AU05.03 owner PASS. The all-user password-only sign-in policy, signup confirmation and server session/role/tenant controls stay unchanged. V remains on hold with policy reconciliation before future factors; stronger-MFA criteria stay unmet. UX_AUTH_PASSWORD_MISMATCH_VISIBILITY stays deferred. Full W/FR.2/Stage 3/re-audit/release/findings remain open; production/native unchanged, APK deferred.
