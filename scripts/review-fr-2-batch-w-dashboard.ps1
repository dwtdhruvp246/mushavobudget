# Owner-reported read-only dashboard summaries. No credential or arbitrary-string inputs.
$ErrorActionPreference = 'Stop'
$BatchExit = 1
$Step = 'OPEN_STAGING_DASHBOARD'
$Display = 'Stage 3/10 | FR.2/8 | Batch W/Z'

function Read-WTriState([string]$Prompt) {
    do {
        $Answer = (Read-Host ($Prompt + ' [Y/N/U=unknown or unavailable]')).Trim().ToUpperInvariant()
    } while ($Answer -notin @('Y', 'N', 'U'))
    if ($Answer -eq 'Y') { return $true }
    if ($Answer -eq 'N') { return $false }
    return $null
}

function Read-WMinimum {
    do {
        $Answer = (Read-Host '5. Current minimum password LENGTH only [0-1024 or U]')
        $Answer = $Answer.Trim().ToUpperInvariant()
        if ($Answer -eq 'U') { return $null }
        $Parsed = 0
        $Valid = [int]::TryParse($Answer, [ref]$Parsed) -and $Parsed -ge 0 -and $Parsed -le 1024
    } while (-not $Valid)
    return $Parsed
}

function Read-WCharacterClass {
    Write-Host '0=None; 1=Letters and digits; 2=Lowercase, uppercase and digits; 3=Lowercase, uppercase, digits and symbols; 4=Other/custom; U=unknown.'
    do {
        $Answer = (Read-Host '6. Required-character option NUMBER only [0/1/2/3/4/U]').Trim().ToUpperInvariant()
    } while ($Answer -notin @('0', '1', '2', '3', '4', 'U'))
    switch ($Answer) {
        '0' { return 'NONE' }
        '1' { return 'LETTERS_AND_DIGITS' }
        '2' { return 'LOWER_UPPER_AND_DIGITS' }
        '3' { return 'LOWER_UPPER_DIGITS_AND_SYMBOLS' }
        '4' { return 'OTHER_OR_CUSTOM' }
        'U' { return 'UNKNOWN' }
    }
}

function Read-WRedirectClass {
    Write-Host 'Inspect existing Redirect URLs. Do not paste their contents into this terminal.'
    Write-Host 'The four literal callback URLs are:'
    foreach ($Flow in @('confirm', 'recover', 'business-new', 'business-existing')) {
        Write-Host ('  https://mushavo-budget-staging.pages.dev/auth.html?flow=' + $Flow)
    }
    Write-Host 'The exact staging wildcard discussed here is: https://mushavo-budget-staging.pages.dev/**'
    Write-Host 'E=All four literal entries present; W=That staging wildcard present but not all four literals; B=Both; N=Empty list; O=Other/partial patterns; U=unknown.'
    Write-Host 'E/W/B describe presence only; other entries may also exist. They do not prove the full allowlist is safe or that provider redirects work.'
    do {
        $Answer = (Read-Host '11. Redirect-list category LETTER only [E/W/B/N/O/U]').Trim().ToUpperInvariant()
    } while ($Answer -notin @('E', 'W', 'B', 'N', 'O', 'U'))
    switch ($Answer) {
        'E' { return 'FOUR_LITERAL_ENTRIES_PRESENT_OTHER_ENTRIES_UNMEASURED' }
        'W' { return 'CANONICAL_STAGING_DOUBLE_STAR_PRESENT_FOUR_LITERALS_NOT_ALL_PRESENT' }
        'B' { return 'FOUR_LITERALS_AND_CANONICAL_STAGING_DOUBLE_STAR_PRESENT' }
        'N' { return 'EMPTY_LIST_OWNER_REPORTED' }
        'O' { return 'OTHER_OR_PARTIAL_PATTERNS' }
        'U' { return 'UNKNOWN' }
    }
}

Write-Host ('STARTED: ' + $Display + ' - dashboard read-only settings summary. V MFA remains ON HOLD.')
Write-Host 'Enter only the requested non-secret choices/numbers. Use U for any hidden, unavailable or uncertain setting.'
Write-Host 'View existing settings only. Do not toggle, Save, reset, invite, send mail, enroll MFA or change token permissions.'

try {
    Start-Process 'https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/providers?provider=Email' | Out-Null
    Start-Process 'https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/url-configuration' | Out-Null
    Start-Process 'https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/auth/sessions' | Out-Null

    $Selected = Read-WTriState '1. Confirm the dashboard project is STAGING dczlddwbtgvfdujgcitb'
    if ($Selected -ne $true) { throw 'STAGING_SELECTION_REQUIRED' }

    $Step = 'OWNER_VISIBLE_EMAIL_SETTINGS'
    Write-Host 'Prompts2-9: Authentication > Sign In / Providers > Email. General Allow new users to sign up may be on the providers page behind the Email panel.'
    $EmailEnabled = Read-WTriState '2. Email sign-in provider enabled'
    $SignupEnabled = Read-WTriState '3. Allow new users to sign up enabled'
    $ConfirmEmail = Read-WTriState '4. Confirm email enabled'
    $Minimum = Read-WMinimum
    $Characters = Read-WCharacterClass
    $Reauthentication = Read-WTriState '7. Require reauthentication when changing password / Secure password change enabled'
    $CurrentPassword = Read-WTriState '8. Require current password when changing password enabled'
    $SecureEmailChange = Read-WTriState '9. Secure email change enabled'

    $Step = 'OWNER_VISIBLE_URL_SETTINGS'
    Write-Host 'Prompts10-11: Authentication > URL Configuration. Read existing values; do not edit.'
    $SiteUrl = Read-WTriState '10. Site URL equals https://mushavo-budget-staging.pages.dev (optional final slash only)'
    $Redirects = Read-WRedirectClass

    $Step = 'OWNER_VISIBLE_SESSION_SETTINGS'
    Write-Host 'Prompts12-14: Authentication > Sessions. Use U for unavailable/plan-gated settings; do not infer a value from a disabled upgrade control.'
    $SingleSession = Read-WTriState '12. Single session per user enabled'
    $Timebox = Read-WTriState '13. Time-box user sessions enabled with a nonzero duration'
    $Inactivity = Read-WTriState '14. Inactivity timeout enabled with a nonzero duration'
    $NoChanges = Read-WTriState '15. Confirm you only viewed settings and did not save any change'
    $Success = $NoChanges -eq $true
    if ($Success) { $BatchExit = 0 }

    $Receipt = [ordered]@{
        stage_step = 'FR.2.5.W2_OWNER_READ_ONLY_DASHBOARD_AUTH_SUMMARY'
        progress_display = $Display
        result = $(if ($Success) { 'BATCH_W_OWNER_REPORTED_DASHBOARD_SUMMARY_COMPLETE' } else { 'BATCH_W_OWNER_DASHBOARD_CHANGES_REQUIRE_REVIEW' })
        evidence_scope = 'OWNER_REPORTED_VISIBLE_DASHBOARD_VALUES_NOT_INDEPENDENT_API_READBACK'
        target_project = 'dczlddwbtgvfdujgcitb'
        staging_selection_owner_confirmed = $Selected
        settings = [ordered]@{
            email_signin_enabled = $EmailEnabled
            signup_enabled = $SignupEnabled
            email_confirmation_enabled = $ConfirmEmail
            minimum_password_length = $Minimum
            required_character_class = $Characters
            require_reauthentication_on_password_change = $Reauthentication
            require_current_password_on_change = $CurrentPassword
            secure_email_change_enabled = $SecureEmailChange
            site_URL_is_exact_canonical_staging_root = $SiteUrl
            redirect_entry_category = $Redirects
            single_session_per_user = $SingleSession
            session_timebox_nonzero_enabled = $Timebox
            inactivity_timeout_nonzero_enabled = $Inactivity
        }
        owner_reports_no_settings_changes = $NoChanges
        fields_unknown_remain_unknown = $true
        raw_redirects_passwords_tokens_or_private_configuration_collected = $false
        settings_values_saved_to_disk = $false
        Management_API_requests_made_by_script = 0
        Auth_API_requests_made_by_script = 0
        dashboard_browser_requests_independently_counted = $false
        API_403_request_retried = $false
        token_permissions_or_credentials_changed_by_script = $false
        settings_factors_roles_accounts_or_mode_changed_by_script = $false
        committed_mode_change_requests = 0
        email_dispatch_requested_by_script = $false
        quarantine_remeasured_by_this_dashboard_summary = $false
        last_quarantine_receipt_checked_UTC = '2026-10-26T07:21:25.371Z'
        last_quarantine_receipt_mode = 'QUARANTINED'
        prior_owner_offline20_pass_reused_not_repeated = $true
        pending_batch_V_MFA_deferred_by_owner = $true
        actual_hosted_AU_cases_run = 0
        full_lettered_batch_W_complete = $false
        hosted_acceptance = $false
        production_or_native_changed = $false
        APK_update_deferred = $true
        findings_closed = @()
        checkpoint = $(if ($Success) { 'COMPLETE' } else { 'OWNER_NO_CHANGES_CONFIRMATION' })
        problem_code = $(if ($Success) { $null } else { 'OWNER_SETTINGS_CHANGE_STATE_REQUIRES_REVIEW' })
        exit_code = $BatchExit
        checked_UTC = [DateTime]::UtcNow.ToString('o')
    }
    Write-Host 'BEGIN SAFE BATCH W DASHBOARD RESULT'
    Write-Host ($Receipt | ConvertTo-Json -Depth 6)
    Write-Host 'END SAFE BATCH W DASHBOARD RESULT'
} catch {
    [ordered]@{
        stage_step = 'FR.2.5.W2_OWNER_READ_ONLY_DASHBOARD_AUTH_SUMMARY'
        progress_display = $Display
        result = 'BATCH_W_OWNER_DASHBOARD_SUMMARY_REVIEW_REQUIRED'
        checkpoint = $Step
        problem_code = 'DASHBOARD_ACCESS_OR_STAGING_CONFIRMATION_OR_LOCAL_INPUT_REQUIRED'
        Management_API_requests_made_by_script = 0
        Auth_API_requests_made_by_script = 0
        settings_factors_roles_accounts_or_mode_changed_by_script = $false
        pending_batch_V_MFA_deferred_by_owner = $true
        hosted_acceptance = $false
        production_or_native_changed = $false
        exit_code = 1
    } | ConvertTo-Json | Write-Host
} finally {
    if ($BatchExit -eq 0) {
        Write-Host ('COMPLETE: ' + $Display + ' - owner dashboard summary only; V MFA and W workflow acceptance remain pending.')
    } else {
        Write-Host ('STOPPED FOR REVIEW: ' + $Display + ' - return the safe result; do not change settings to complete this summary.')
    }
}

return [int]$BatchExit
