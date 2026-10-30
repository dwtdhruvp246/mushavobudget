# AU02.04 — one SQL step at a time with session renewal

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: ac6e92b25019290b79a38652c8ded9fd0cc9a5b5.

## Owner scoped PASS — 30 October 2026

[Final owner terminal receipt](security-fr-2-batch-w-owner-unavailable-admin-invitation-pass.json) reports exit0,25 hosted requests,3 denied completion RPCs and all three expired/cancelled/stored-replaced read/completion denials. The original profile/owned-workspace set was preserved; fixture and audit reads returned HTTP200/zero rows; both newly created sessions returned logout HTTP204. Ten source hashes and the accepted staging ZIP were verified, and25 owner local tests passed. All four clipboard copy/readback steps were exercised on Windows. No repeat of AU02.04 is requested.

Refresh grants were0. The session-renewals-verified flag records no failed attempted renewal, not a live refresh exercise. AU05.01 native browser continuity gets no new acceptance. Older failed-run Node-session cleanup remains unverified and was not remeasured. The stored replacement-state fixture did not send a replacement email or invoke the reservation workflow.

Next original invitation work is [AU02.05 incomplete completion failure/retry](SECURITY_FR_2_5_BATCH_W_ADMIN_SETUP_COMPLETION_RETRY.md). The complete protocol below is historical for the passed AU02.04 run; do not rerun it.

## Prior starting checkpoint

[Owner read-only state](security-fr-2-batch-w-owner-post-stop-state.json) confirms zero marked fixture rows and zero marked fixture audit rows. Do not repeat cleanup for the old fixture.

Each selected account has two Auth session rows, including one exact node/undici-agent row. Recorded ages were 8221 seconds for Super Admin and 8234 for the ordinary test user. These ages and labels do not identify the original session IDs or establish the prior HTTP failure cause. Original terminal logouts remain unverified. The older rows are a separate cleanup carry-forward, not an invitation denial PASS.

The prior checker requested only expired/cleanup, returned no accepted variants and made zero completion RPCs. All four SQL result messages alone did not test API denial. AU02.04 was pending at that starting checkpoint and is now accepted at the owner scope above. Preserve AU02.01/02, AU02.03 completed-invitation wrong-recipient denial, AU02.05 completed-invitation idempotence and Business AU02.06–08 without repeats. Actual incomplete-setup/provider-failure retry in AU02.05 stays open.

## Complete owner workflow

Entry: scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs.
Core: scripts/lib/unavailable-admin-invitation-check.mjs.
Single-step/clipboard helper: scripts/lib/unavailable-admin-invitation-workflow.mjs.
Manifest: scripts/unavailable-admin-invitation-manifest.json, ten runtime sources.
Reuse accepted v125 staging ZIP SHA256 9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b.

Run the complete newly pinned PowerShell block in one fresh terminal. It checks twenty-five dependency-free tests, verifies the existing ZIP/public staging configuration and requests masked passwords for the OTHER ordinary test account used previously, followed by the existing staging Super Admin. No new API/Management/service key, install, frontend upload or email is needed.

After the two real identities, current Super Admin role and table-read access are verified, the checker creates an output directory with complete emergency cleanup SQL. It does not create later phase files in advance.

For each requested step, it writes and verifies the current complete SQL file and copies that SQL directly to the Windows clipboard. SQL is passed through stdin into a fixed PowerShell string variable, never interpolated into command code. Clipboard content is read back for equality. If the clipboard is unavailable, the helper opens only the current file in Notepad and gives its path.

The owner action is identical each time:
1. Open a NEW BLANK query in staging Supabase project dczlddwbtgvfdujgcitb.
2. Press Ctrl+V and Run once.
3. Check the expected result shown by the terminal, then return there and type DONE.
4. Wait for actual server checks to finish and the next step to be supplied. Do not select future files or execute phases ahead of the terminal.

| Step | Expected SQL result | Actual server check before the next phase |
|---|---|---|
| 1 — expired | EXPIRED_FIXTURE_READY | Exact recipient-bound sent/past-expiry fixture; read unavailable and completion ADMIN_INVITATION_EXPIRED. |
| 2 — cancelled | CANCELLED_FIXTURE_READY | Same cancelled fixture with future expiry; read and completion ADMIN_INVITATION_NOT_AVAILABLE. |
| 3 — replaced state | REPLACED_STATE_FIXTURE_READY | Same cancelled fixture and exact replacement-reason audit; read/completion unavailable. This is a stored-state fixture, not a resend/reservation-flow test. |
| 4 — cleanup | TEMPORARY_INVITATION_FIXTURE_ABSENT | Exact fixture and audit absent; locally sign out only the two sessions created by this run. |

Escape cancels a failed SQL handoff and still offers cleanup. If the terminal closes, its prepared 04-cleanup.sql remains available. Do not start another fixture while its cleanup is unresolved. The generated SQL guard rules are unchanged from the reviewed Business-trigger correction: one marked Free Personal fixture, no payment, exact identity/current registered staging catalogue, no existing recipient invitation, no profile/workspace/role/settings or schema change.

## Test-session lifetime and diagnostics

The previous helper retained the original access tokens through manual pauses. The revised helper keeps its own refresh tokens in memory, schedules renewal from expires_in using a monotonic clock, and does not depend on the computer's wall clock. It renews only when needed, before protected reads/RPCs and local cleanup.

Each renewed access token must retain both the original Auth user ID and original session_id. Auth getUser must also confirm the same verified identity before protected actions continue. Signature/authorization verification remains with Auth; locally decoded claims are binding hints checked against the Auth response, not a replacement for getUser. Wrong-user/session, invalid refresh, failed getUser or unsuccessful renewal during final logout prevents COMPLETE. Failed grants are not retried automatically.

Only /auth/v1/logout?scope=local is used for the new sessions. No global/others signout, Auth-table deletion or alteration of the two older Node-labelled rows is requested. No access/refresh token, password, email or identity UUID is printed in safe JSON or saved to files.

The report now includes safe per-phase HTTP status, array/count, allowlisted error code and identity-match booleans; fixture cleanup response shapes; per-slot logout status/code; and same-session renewal verification. Missing-row HTTP200, JWT/session errors and wrong fixture identity no longer share an unexplained combined error alone.

Typical success uses 25 direct HTTP requests; a synthetic two-hour pause at every SQL step uses 41. Maximum50 direct requests, at most8 refresh grants,25-second request timeouts, no completion/write retries. Dashboard SQL traffic is unmeasured. Refresh can still be refused by the project's existing Auth policy; the checker reports that instead of changing settings or accepting an authentication failure as invitation denial.

## Validation and limits

[Current checks](security-fr-2-batch-w-unavailable-invitation-session-workflow-checks.json):25 transport/package tests PASS, ten hashes. They cover two-hour pauses, rotation, same-session binding, actual getUser verification, final-cleanup renewal failures, safe diagnostics, staged SQL publication, clipboard stdin/readback protocol, source tamper refusal and existing-pack repair. Five prior real local SQL checks are retained; the generator/guards have not changed. The owner exercised all four clipboard copy/readback steps; Notepad fallback was not exercised.

The [prior Business-trigger repair](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_TRIGGER_REPAIR.md) is historical for the already-ended original run. Do not resume that run or repeat the post-stop query for this retry.

No assistant hosted Auth, SQL, email or browser action was executed in this revision. This CLI does not close AU05.01 continuous native-browser refresh/persistence, AU02.05 actual setup-failure retry, the old Node-session cleanup carry-forward or whole W/V/FR.2/Stage3/release acceptance. There are no new public AU cases, product policy changes or production/native updates.
