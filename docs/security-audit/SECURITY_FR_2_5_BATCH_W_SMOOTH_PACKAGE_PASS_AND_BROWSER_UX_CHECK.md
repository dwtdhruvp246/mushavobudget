# Corrected archive passed; normal sign-in background UX check

Stage 3/10 | FR.2/8 | Batch W/Z — FRE255, 27 October2026.

[Owner receipt](security-fr-2-batch-w-owner-smooth-signin-package-and-deployment.json) reports source30, the exact accepted1696a99a archive, all44 public entries, only10 changes,34 preserved, staging references retained, recorded entry chain matched, portable archive readback and combined exit0. The corrected archive is mushavo-smooth-signin-staging.zip, SHA256e49c866aa56aa3d634ef78cf8ea37c77e5a19143e7a5e0a5e63f67e28c8cb05e. This resolves the previous package-baseline refusal at the owner preparation scope. The original input is unchanged. Windows .NET readback is not claimed. Source 6be81d6534549e657d57444a841e27aa9f400527.

The preparer made no hosted request/upload. The owner then supplied [new deployment](https://082009fe.mushavo-budget-staging.pages.dev/), which is owner-reported upload evidence. [Automated readback](security-fr-2-batch-w-smooth-signin-public-readback.json) remains blocked: two reader URLs inaccessible, one direct GET403/Cloudflare1010. No independent provider-success/source parity or owner-browser outage is inferred. Do not rebuild or upload the same corrected archive again.

Next test uses the current account/password and remembered browser. A new recovery request/password save is not needed for this ordinary sign-in check. The last reported30-minute application window expired at27October2026 17:21:26UTC/19:21:26 Africa/Johannesburg; newer ready output has not been supplied. Run the unchanged exact-one-account window query to recheck readiness. It reuses an unexpired matching deadline, refuses another active actor and reopens an expired matching window through the installed controllers for at most1800seconds. This does not grant proof, alter Auth settings, repair profiles or send mail. [Candidate](../../supabase/candidates/security_fr_2_5_recovery_test_window.sql), source2c2befd448de7b0737fe651f7f457c913144e0ea, SHA256600082e01d6eef21a1a36f1c7b57e9ee853c0dab1552bf7e957773bae97a2d2c.

Copy the pinned query with PowerShell, select Supabase staging project dczlddwbtgvfdujgcitb independently, replace only its inbox placeholder privately, and run it once:

```powershell
Set-Location -LiteralPath 'C:\Users\HP\Desktop\Mushavo Budget'
$RecoveryWindowSQL = @(git show '2c2befd448de7b0737fe651f7f457c913144e0ea:supabase/candidates/security_fr_2_5_recovery_test_window.sql')
if ($LASTEXITCODE -ne 0) { throw 'RECOVERY_WINDOW_SOURCE_REQUIRED' }
($RecoveryWindowSQL -join "`n") | Set-Clipboard
Write-Host 'Window query copied. Replace OWNER_CONTROLLED_RECOVERY_EMAIL with the same established test inbox before running in staging.'
```

After RECOVERY_SINGLE_ACCOUNT_WINDOW_READY with allowed_actor_count1, maximum_seconds1800 and a current expiry:

1. In the same normal browser/profile used for the successful verification, open a fresh tab at [canonical staging sign-in](https://mushavo-budget-staging.pages.dev/app.html?auth=manual). Use the established account and current password once. The stable origin preserves the existing callback/gateway allowlist and remembered-cookie origin; changing to a new preview hostname does not transfer its cookie.
2. Observe whether startup stays on a brief Signing in/loading indicator and opens the correct dashboard, without flashing the full Verify your sign-in form during approved background checks. Note approximate seconds from selecting Sign in to dashboard and any specific flicker/error.
3. Return the safe window result and actual screen/timing outcome. If the code form appears, report its message before requesting another code. A genuinely code-required server state is still allowed to show the form; there is no browser-side bypass. Do not create another account, reset the password or reuse a consumed recovery link for this check.

This checks the existing approved/remembered ordinary sign-in path and owner-requested UX, not a new public AU case. Original automatic recovery functional UI PASS is retained; updated post-code recovery smoothness, precise performance, wrong-code/security/cross-tab variants and full AU04.05 stay open. Source UI140 and corrected packaging9 remain at their existing pins without rerun; no runtime or test source changes for this receipt. Background-polish status is deployed by owner report/pending browser UX and timing; mismatch prominence stays deferred. V MFA ON HOLD; full W/FR.2/Stage3/release/findings open, production/native unchanged and APK deferred.
