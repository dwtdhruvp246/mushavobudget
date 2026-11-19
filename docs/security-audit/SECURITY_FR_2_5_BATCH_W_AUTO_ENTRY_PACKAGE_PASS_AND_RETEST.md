# Auto-entry ZIP passed; refresh readiness for one live recovery retry

Stage 3/10 | FR.2/8 | Batch W/Z — FRE252, 27 October 2026.

[Owner receipt](security-fr-2-batch-w-owner-auto-entry-package-and-deployment.json) reports pinned source17/17, all44 public entries, only the intended3 changed, the other41 and original accepted ZIP preserved, portable archive readback and combined exit0. New archive SHA256: 1696a99a4fd5fde38210818ada25a983a352a5cb0b547294383b007aaa45865b. The preparer did not deploy; the owner then supplied [new staging deployment](https://5b278cbc.mushavo-budget-staging.pages.dev/). The deployment URL is owner-reported upload evidence, not independent provider-success or source-byte evidence. No need to rebuild or upload again.

[Public readback](security-fr-2-batch-w-auto-entry-public-readback.json) could not confirm serving bytes: two reader URLs were inaccessible and one diagnostic GET returned HTTP403/Cloudflare1010. This does not show an owner-browser outage or code mismatch. The prior64/64 targeted checks remain valid at source 5fce41918705643b3c80219b421cdaf66b74a61d; no runtime edits or tests rerun for this receipt.

The last reported one-account window expired at27October2026 17:21:26UTC /19:21:26 Africa/Johannesburg. Current live state is not independently known. Reuse the exact earlier controller query; it preserves an unexpired exact same-account deadline, refuses another active actor and atomically reopens only an expired window for at most one account/1800seconds. It creates no proof, resets no password, repairs no profile and changes no Auth/security predicate. [Reviewed candidate](../../supabase/candidates/security_fr_2_5_recovery_test_window.sql), [prior window contract](security-fr-2-batch-w-recovery-window-contract.json), source2c2befd448de7b0737fe651f7f457c913144e0ea, SHA256600082e01d6eef21a1a36f1c7b57e9ee853c0dab1552bf7e957773bae97a2d2c. Do not run the already completed profile repair again.

The following PowerShell only copies that pinned SQL template to the clipboard. It neither runs SQL nor opens a window. In the staging SQL Editor replace OWNER_CONTROLLED_RECOVERY_EMAIL with the same established recovery inbox privately; no alias/new user is needed.

```powershell
Set-Location -LiteralPath 'C:\Users\HP\Desktop\Mushavo Budget'
$RecoveryWindowSQL = @(git show '2c2befd448de7b0737fe651f7f457c913144e0ea:supabase/candidates/security_fr_2_5_recovery_test_window.sql')
if ($LASTEXITCODE -ne 0) { throw 'RECOVERY_WINDOW_SOURCE_REQUIRED' }
($RecoveryWindowSQL -join "`n") | Set-Clipboard
Write-Host 'Recovery-window SQL copied. Replace its email placeholder with the same recovery account before running in staging.'
```

Owner sequence:

1. Independently select Supabase staging project dczlddwbtgvfdujgcitb. Paste the copied query, replace only the email placeholder, and run once. Require RECOVERY_SINGLE_ACCOUNT_WINDOW_READY, allowed_actor_count1, maximum_seconds1800 and a current expiry. On any different result stop and return it; do not alter guards or create another account.
2. After that ready result, use a fresh tab at [canonical staging sign-in](https://mushavo-budget-staging.pages.dev/app.html?auth=manual). The latest direct upload should serve through this stable origin, preserving the existing Auth callback allowlist and gateway origin. Select Forgot password for the same recovery account once. The already loaded old tab and consumed link cannot exercise the updated JavaScript; keep that tab intact. The existing both-environment recipient setup condition remains local and does not require another installation or confirmation exchange if already satisfied.
3. Open only the newest recovery email in the same browser. Confirm the intended account, choose a private password of at least8characters different from the current password and save once. Request a gateway email code once if the verification form requires it, enter the newest code only on the website and select Verify once. Do not share the password, code or token-bearing link.
4. Expected updated-build result: after correct verification, Signing in… then the intended account's dashboard automatically, with no recovery account checkbox/Continue to app screen. Wrong-code/proof/identity/expiry failures stay blocked; do not intentionally add a wrong-code attempt to this single positive retry. Return the safe window result, actual save/verification outcome and whether dashboard opened directly. On missing mail or an unexpected account/error/screen stop without another save/send: password may already have changed.

This is the existing AU04.05 positive retry/automatic-entry variant, not a new public case. Bounded window does not prove provider-session freshness. Live source parity, actual auto-adoption/dashboard/cross-tab/security outcome and full acceptance remain pending. Both separate deferred UI items stay deferred; V Admin MFA remains on hold; full W/FR.2/Stage3/release/findings open, production/native unchanged, APK deferred.
