# 3.5.3: owner-reported, read-only Auth dashboard summaries. No account secrets.
$ErrorActionPreference = 'Stop'
$ProjectRef = 'dczlddwbtgvfdujgcitb'
Write-Host '3.5.3 - READ-ONLY STAGING AUTH SETTINGS. Do not change settings or send email.'
Write-Host 'Inspect only dczlddwbtgvfdujgcitb. Production kttkospkblwvguuwnhjj is excluded.'
Start-Process "https://supabase.com/dashboard/project/$ProjectRef"
function Read-TriState([string]$Prompt) {
  do { $Answer = (Read-Host "$Prompt [Y/N/U=unknown or unavailable]").Trim().ToUpperInvariant() } while ($Answer -notin @('Y','N','U'))
  if ($Answer -eq 'Y') { return $true }; if ($Answer -eq 'N') { return $false }; return $null
}
$Selected = Read-TriState 'Confirm the selected dashboard project is STAGING dczlddwbtgvfdujgcitb'
if ($Selected -ne $true) { throw 'Stop: staging project selection has not been confirmed.' }
Write-Host 'Use Authentication settings for email/password sign-in and URL configuration. Read values; do not press Save.'
$ConfirmEmail = Read-TriState 'Email confirmation enabled'
$MinimumText = (Read-Host 'Current minimum password length (number, or U)').Trim()
$Minimum = $null
if ($MinimumText -ne 'U' -and $MinimumText -ne 'u') { $ParsedMinimum = 0; if ([int]::TryParse($MinimumText, [ref]$ParsedMinimum) -and $ParsedMinimum -gt 0) { $Minimum = $ParsedMinimum } }
$Characters = Read-Host 'Required password characters (setting label/value only; U if unknown)'
$SecureChange = Read-TriState 'Secure password change/recent-login verification enabled'
$CurrentPassword = Read-TriState 'Current-password requirement enabled (U if no such setting is visible)'
$Redirects = Read-TriState 'Existing allowed redirects include the staging auth.html callbacks for confirm, recover, business-new and business-existing (inspect only; U if unsure)'
$SiteUrl = Read-TriState 'Site URL is the staging site mushavo-budget-staging.pages.dev'
$Smtp = Read-TriState 'Staging email/SMTP delivery is already verified by prior evidence (do not send a new email)'
$Mailboxes = Read-TriState 'Separate owner-controlled test inboxes and isolated Auth test identities are available'
$Deployed = Read-TriState 'This Auth candidate is already deployed to staging from the exact source pin in the 3.5.2 handoff'
$Receipt = [ordered]@{
  stage_step='3.5.3'; scope='OWNER_READ_ONLY_DASHBOARD_SUMMARIES'; project=$ProjectRef; staging_selection_owner_confirmed=$Selected
  email_confirmation_enabled=$ConfirmEmail; minimum_password_length=$Minimum; required_password_characters=$Characters
  secure_password_change_enabled=$SecureChange; current_password_required=$CurrentPassword
  staging_callback_paths_present=$Redirects; site_url_is_staging=$SiteUrl; prior_staging_mail_delivery_verified=$Smtp
  isolated_controlled_Auth_test_identities_available=$Mailboxes; candidate_deployed_owner_reported=$Deployed
  hosted_acceptance=$false; hosted_Auth_checks_run=0; settings_changed=$false; email_dispatched=$false
  existing_synthetic_accounts_changed=$false; production_or_native_changed=$false
}
$SafeJson = $Receipt | ConvertTo-Json -Depth 4
$ReceiptPath = Join-Path ([System.IO.Path]::GetTempPath()) ('mushavo-auth-readiness-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '.json')
$SafeJson | Set-Content -LiteralPath $ReceiptPath -Encoding UTF8
Write-Host $SafeJson
Write-Host "Receipt saved to $ReceiptPath. Return only this summary, never passwords, tokens, full links, SMTP secrets or inbox contents."
