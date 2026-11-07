# Cross-tab signout — clarify the observed transition

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner reports: it goes back to the sign in page. [Receipt](security-fr-2-batch-w-owner-cross-tab-signin-return.json). Return to sign-in is the expected scoped UI outcome. The reply does not distinguish tab A versus B, automatic clearing before reload, or persistence after reload; those are not silently credited.

Ask one observation question: **Did original tab A switch to sign-in automatically before you refreshed it, or did you see sign-in only after refreshing?** Report what was already observed, or that the timing was not noticed. No repeat signout, sign-in, password change, reload, code, mail, SQL, ZIP, account or settings action is requested to answer.

This remains within frozen AU05.06, Account switch with in-flight/Business UI clearing. Do not mark the entire case, different-user or in-flight switching, Business state clearing, failure variants or server JWT revocation as accepted from a return-to-sign-in report. Earlier saved-session reload under AU05.01, new-password sign-in and AU05.03 owner PASS are preserved without repetition.

No runtime edits or tests: prior 119 local checks remain at e62f74494f4c828cdb4a748b2f175d6dfa431d67. Preserve all original 31 AU definitions and all earlier evidence. Password-only all-user policy stays unchanged; V stays on hold with policy reconciliation before future factor work and stronger-MFA findings remain unmet. UX_AUTH_PASSWORD_MISMATCH_VISIBILITY stays deferred. Full W/FR.2/Stage 3/re-audit/release/findings remain open; production/native unchanged, APK deferred.
