# Verification unavailable: restore connectivity and recheck bounded staging readiness

Stage 3/10 | FR.2/8 | Batch W/Z — FRE257, 28 October2026.

[Owner screenshot review](security-fr-2-batch-w-owner-unavailable-screen-review.json) shows Verification is unavailable. Try again. under the generic Verify your sign-in heading, with Trust this browser checked and Send email code/Check again/Sign out buttons. There is no code input or code-rejection message, no address bar and no Network setting. Repeated email verification, lost remembered approval or a failed reconnect is not established by this image. The owner reports a recurring problem; reopen the current UX/access result for review while preserving the earlier limited positive report historically.

The previous controlled case intentionally set this app tab Offline. Its return to Online and successful reconnect have not been confirmed. Independently, staging uses an exact-actor application window bounded to30minutes; the last explicitly supplied deadline27October17:21:26UTC/19:21:26 Africa/Johannesburg is now past. A newer window may have been opened without a returned receipt; do not claim the actual current database state is known.

Source-reviewed mechanism: the public no-argument email proof RPC delegates to the canonical session_valid predicate, which requires current identity/session/account proof, ACTIVE rollout and a current allowed-actor window. The client checks proof, attempts remembered-cookie restore if needed, then rechecks proof after APPROVED/VERIFIED. False proof after an approved restore raises UNAVAILABLE. A new code cannot bypass the same bounded predicate. Network/RPC/response failures also use that message, so the screenshot alone cannot identify the live cause. This review changes no proof, cookie, window, SQL, Worker or runtime source.

Owner sequence, before another mail request:

1. In the affected staging tab, open F12 → Network and restore No throttling/Online. Keep Disable cache unchecked and existing cookies/site data intact. Use the same browser/profile at https://mushavo-budget-staging.pages.dev/app.html. The gateway allows the canonical staging origin; a unique deployment preview hostname is not interchangeable for its protected routes. Select Check again once. If that opens the correct dashboard, report that result; no window query or more verification is required for this availability check.
2. If still unavailable, copy the unchanged exact-one-account window query below. Independently select Supabase staging project dczlddwbtgvfdujgcitb, replace only its inbox placeholder privately with the established current test inbox, and run once. Require RECOVERY_SINGLE_ACCOUNT_WINDOW_READY, allowed_actor_count1, maximum_seconds1800 and a current expiry. The original query reuses an unexpired matching deadline, refuses another active actor and atomically reopens an expired window using the installed controllers. No catalog bypass, global resume, profile repair, account/password change, mail or fabricated proof.
3. After READY, return to that same Online tab and select Check again once. Return the safe SQL result and whether the dashboard opens. On a different SQL result stop and report it. If the screen persists after both verified conditions, return the current message; further diagnosis should capture only the failed request's endpoint class/status/fixed result, never raw credentials or response bodies. Do not repeatedly select Send email code, sign out, recreate the account or reset the password to diagnose this state.

Pinned query source2c2befd448de7b0737fe651f7f457c913144e0ea; SHA256600082e01d6eef21a1a36f1c7b57e9ee853c0dab1552bf7e957773bae97a2d2c. [Existing candidate](../../supabase/candidates/security_fr_2_5_recovery_test_window.sql), [original contract](security-fr-2-batch-w-recovery-window-contract.json), original12-case local receipt retained without rerun. The following only copies the template; it does not execute SQL:

```powershell
Set-Location -LiteralPath 'C:\Users\HP\Desktop\Mushavo Budget'
$RecoveryWindowSQL = @(git show '2c2befd448de7b0737fe651f7f457c913144e0ea:supabase/candidates/security_fr_2_5_recovery_test_window.sql')
if ($LASTEXITCODE -ne 0) { throw 'RECOVERY_WINDOW_SOURCE_REQUIRED' }
($RecoveryWindowSQL -join "`n") | Set-Clipboard
Write-Host 'Window query copied. Replace OWNER_CONTROLLED_RECOVERY_EMAIL privately with the established recovery/test inbox before staging execution.'
```

AU05.03 is REVIEW/incomplete: the unavailable-screen observation is received, but actual Online return, session retention and dashboard recovery are not yet shown. The misleading generic heading/send-code controls on an unavailable state are recorded as a UX concern; do not claim a cosmetic change would restore backend access. Runtime UI remains at a9a8a195c4950f33b433c15fb2699507b1d7e84f, corrected package source6be81d6534549e657d57444a841e27aa9f400527/deployment082009fe. No new ZIP/upload, runtime fix or test suite is requested during readiness diagnosis. UI140/package9 stay at their existing pins. Mismatch prominence stays deferred, V MFA ON HOLD; full W/FR.2/Stage3/release/findings open, production/native untouched, APK deferred. No new public AU cases (frozen31).
