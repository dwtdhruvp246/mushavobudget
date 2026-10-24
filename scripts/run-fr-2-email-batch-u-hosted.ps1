param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$PreflightOnly,
    [switch]$ExerciseFullAppWindow,
    [switch]$InspectPacketOnly,
    [string]$PacketFile = '',
    [string]$BrowserExecutable = ''
)
$ErrorActionPreference = 'Stop'
$Phase = 'SOURCE_IDENTITIES'
$Problem = 'LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED'
$SourceCount = 0
$TokenSecure = $null
$PasswordSecure = $null
$OtherPasswordSecure = $null
$PacketSecure = $null
$Packet = $null
$ProbeStarted = $false
$Payload = $null
function Assert-Unlinked([string]$Value) {
    $Probe = [IO.Path]::GetFullPath($Value)
    while ($Probe) {
        if (Test-Path -LiteralPath $Probe) {
            if (((Get-Item -LiteralPath $Probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'PRIVATE_PATH_REVIEW_REQUIRED'
            }
        }
        $Parent = [IO.Directory]::GetParent($Probe)
        if ($null -eq $Parent) { break }
        $Probe = $Parent.FullName
    }
}
# These helpers are kept in the Windows parent: no privileged packet field reaches Node.
function Select-RetainedGatewayPacket([string]$PrivateRoot, [string]$RequestedFile) {
    $script:Phase = 'RETAINED_GATEWAY_PACKET_DISCOVERY'
    $script:Problem = 'PRIVATE_PACKET_DISCOVERY_REVIEW_REQUIRED'
    if ([string]::IsNullOrWhiteSpace($RequestedFile)) {
        Assert-Unlinked $PrivateRoot
        $Packets = @()
        # A missing default directory must reach the documented full-path prompt.
        if (Test-Path -LiteralPath $PrivateRoot) {
            if (-not (Test-Path -LiteralPath $PrivateRoot -PathType Container)) { throw 'PRIVATE_DIRECTORY_REQUIRED' }
            $Packets = @(Get-ChildItem -LiteralPath $PrivateRoot -Filter 'email-gateway-*.dpapi' -File | Sort-Object Name)
        }
        if ($Packets.Count -eq 1) { $RequestedFile = $Packets[0].FullName }
        elseif ($Packets.Count -gt 1) {
            $script:Phase = 'RETAINED_GATEWAY_PACKET_CHOICE'
            $script:Problem = 'PRIVATE_PACKET_SELECTION_REQUIRED'
            Write-Host 'Choose the encrypted email-gateway packet used for the installed staging Pages gateway:'
            for ($Index = 0; $Index -lt $Packets.Count; $Index++) { Write-Host (($Index + 1).ToString() + ': ' + $Packets[$Index].Name) }
            $PacketChoice = Read-Host 'Enter its number'
            $Number = 0
            if ($PacketChoice -notmatch '^[1-9][0-9]*$' -or -not [int]::TryParse($PacketChoice, [ref]$Number) -or $Number -gt $Packets.Count) { throw 'PRIVATE_PACKET_SELECTION_REQUIRED' }
            $RequestedFile = $Packets[$Number - 1].FullName
        } else {
            $script:Phase = 'RETAINED_GATEWAY_PACKET_PATH_INPUT'
            $script:Problem = 'PRIVATE_PACKET_PATH_REQUIRED'
            $RequestedFile = Read-Host 'Enter the full path to your EXISTING retained email-gateway-*.dpapi file (do not create a new packet)'
        }
    }
    $script:Phase = 'RETAINED_GATEWAY_PACKET_PATH_VALIDATION'
    $script:Problem = 'PRIVATE_PACKET_PATH_REVIEW_REQUIRED'
    $RequestedFile = $RequestedFile.Trim().Trim('"')
    if ([string]::IsNullOrWhiteSpace($RequestedFile) -or -not [IO.Path]::IsPathRooted($RequestedFile)) { throw 'PRIVATE_PACKET_PATH_REQUIRED' }
    Assert-Unlinked $RequestedFile
    return $RequestedFile
}
function Get-RetainedGatewayPublicInputs([object]$Configuration) {
    $script:Phase = 'RETAINED_GATEWAY_PACKET_SCOPE_VALIDATION'
    $script:Problem = 'PRIVATE_PACKET_SCOPE_REQUIRED'
    if ($null -eq $Configuration -or $Configuration -is [Array] -or
        $Configuration.schema_version -ne 1 -or $Configuration.purpose -cne 'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY' -or
        $Configuration.project -cne 'dczlddwbtgvfdujgcitb' -or $Configuration.origin -cne 'https://mushavo-budget-staging.pages.dev' -or
        $Configuration.expected_modern_Pages_Worker_SHA256 -cne 'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651' -or
        $null -eq $Configuration.env -or $Configuration.env -is [Array] -or
        $Configuration.env.EMAIL_GATE_MODE -cne 'STAGING_CONTROLLED_ONLY' -or $Configuration.env.EMAIL_GATE_PROJECT -cne 'dczlddwbtgvfdujgcitb' -or
        $Configuration.env.EMAIL_GATE_ORIGIN -cne 'https://mushavo-budget-staging.pages.dev' -or
        $Configuration.env.SUPABASE_PUBLISHABLE_KEY -isnot [string] -or
        $Configuration.env.SUPABASE_PUBLISHABLE_KEY -cnotmatch '^sb_publishable_[A-Za-z0-9_-]{1,512}$') { throw 'PRIVATE_PACKET_SCOPE_REQUIRED' }
    $script:Phase = 'RETAINED_GATEWAY_RECIPIENT_JSON'
    $script:Problem = 'PRIVATE_RECIPIENT_JSON_REQUIRED'
    $Json = $Configuration.env.ZOHO_TEST_RECIPIENTS_JSON
    if ($Json -isnot [string] -or $Json.Length -gt 8192) { throw 'PRIVATE_RECIPIENT_JSON_REQUIRED' }
    # Windows PowerShell 5.1 emits a top-level JSON array as ONE pipeline object.
    # Read a property of an object instead; array identity survives in both 5.1 and 7.
    $Document = ConvertFrom-Json -InputObject ('{"items":' + $Json + '}')
    $script:Phase = 'RETAINED_GATEWAY_RECIPIENT_VALIDATION'
    $script:Problem = 'PRIVATE_RECIPIENT_LIST_REQUIRED'
    $Emails = $Document.items
    if (@($Document.PSObject.Properties).Count -ne 1 -or $Emails -isnot [Array] -or
        $Emails.Count -lt 1 -or $Emails.Count -gt 10) { throw 'PRIVATE_RECIPIENT_LIST_REQUIRED' }
    foreach ($Email in $Emails) {
        if ($Email -isnot [string] -or $Email.Length -gt 254 -or $Email -notmatch '^[^\s@\x00-\x1f]+@[^\s@\x00-\x1f]+\.[A-Za-z]{2,63}$') { throw 'PRIVATE_RECIPIENT_LIST_REQUIRED' }
    }
    if (@($Emails | ForEach-Object { $_.ToLowerInvariant() } | Select-Object -Unique).Count -ne $Emails.Count) { throw 'PRIVATE_RECIPIENT_LIST_REQUIRED' }
    return [pscustomobject]@{publishableKey=$Configuration.env.SUPABASE_PUBLISHABLE_KEY;recipients=$Emails}
}
function Plain([Security.SecureString]$Value) {
    $Pointer = [IntPtr]::Zero
    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    } finally {
        if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
    }
}
function Write-PrivateLine([Diagnostics.Process]$Child, [string]$Text) {
    $Bytes = $null
    try {
        $Encoding = New-Object Text.UTF8Encoding($false)
        $Bytes = $Encoding.GetBytes($Text + [char]10)
        $Child.StandardInput.BaseStream.Write($Bytes, 0, $Bytes.Length)
        $Child.StandardInput.BaseStream.Flush()
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
    }
}
function Private-Dialogue([string]$Node, [string]$Entry, [string]$Text, [bool]$AllowCode) {
    $Child = $null
    $Started = $false
    $CodeRequested = $false
    $CodeSecure = $null
    $CodePayload = $null
    try {
        $Start = New-Object Diagnostics.ProcessStartInfo
        $Start.FileName = $Node
        $Start.Arguments = '"' + $Entry + '" --private-dialogue'
        $Start.WorkingDirectory = $SnapshotRoot
        $Start.UseShellExecute = $false
        $Start.CreateNoWindow = $true
        $Start.RedirectStandardInput = $true
        $Start.RedirectStandardOutput = $true
        $Start.RedirectStandardError = $true
        $Encoding = New-Object Text.UTF8Encoding($false)
        $Start.StandardOutputEncoding = $Encoding
        $Start.StandardErrorEncoding = $Encoding
        foreach ($Key in @($Start.EnvironmentVariables.Keys)) {
            if ($Key -match '^(NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_|SUPABASE_|ZOHO_|EMAIL_GATE_)') {
                $Start.EnvironmentVariables.Remove($Key)
            }
        }
        $Child = New-Object Diagnostics.Process
        $Child.StartInfo = $Start
        if (-not $Child.Start()) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Started = $true
        $ReadErrors = $Child.StandardError.ReadToEndAsync()
        Write-PrivateLine $Child $Text
        $Clock = [Diagnostics.Stopwatch]::StartNew()
        $NextNotice = 20000
        $Frames = 0
        while ($true) {
            $NextLine = $Child.StandardOutput.ReadLineAsync()
            while (-not $NextLine.Wait(1000)) {
                if ($Clock.ElapsedMilliseconds -ge 3600000) { throw 'PRIVATE_CHILD_TIMEOUT_REVIEW_REQUIRED' }
                if ($Clock.ElapsedMilliseconds -ge $NextNotice) {
                    Write-Host 'BATCH U is still running controlled staging checks; keep this window open. No email is automatically resent.'
                    $NextNotice += 20000
                }
            }
            $Line = $NextLine.GetAwaiter().GetResult()
            if ($null -eq $Line -or $Line.Length -gt 65536) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Frames++
            if ($Frames -gt 2) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Message = $Line | ConvertFrom-Json
            if ($Message.protocol -eq 'BATCH_U_CODE_REQUIRED') {
                if (-not $AllowCode -or $CodeRequested -or @($Message.PSObject.Properties).Count -ne 1) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
                $CodeRequested = $true
                Write-Host 'ONE CODE EMAIL ACCEPTED: open the selected test inbox now. The six-digit code expires in 10 minutes.'
                $CodeSecure = Read-Host 'Enter that six-digit Mushavo sign-in code here (hidden; never send the code to chat)' -AsSecureString
                $CodePayload = @{code=((Plain $CodeSecure).Trim())} | ConvertTo-Json -Compress
                Write-PrivateLine $Child $CodePayload
                $CodeSecure.Dispose()
                $CodeSecure = $null
                $CodePayload = $null
                $NextNotice = $Clock.ElapsedMilliseconds + 20000
                continue
            }
            if ($Message.protocol -ne 'BATCH_U_RESULT' -or @($Message.PSObject.Properties).Count -ne 2 -or $null -eq $Message.receipt) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Answer = $Message.receipt
            $Child.StandardInput.BaseStream.Close()
            if (-not $Child.WaitForExit(10000)) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
            $Extra = $Child.StandardOutput.ReadToEnd()
            $Errors = $ReadErrors.GetAwaiter().GetResult()
            if ($Extra.Length -ne 0 -or $Errors.Length -ne 0 -or
                $Answer.stage_step -ne 'FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE' -or
                $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
                $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 32) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
            return $Answer
        }
    } finally {
        if ($CodeSecure) { $CodeSecure.Dispose() }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null
        $CodePayload = $null
        $Line = $null
        $Message = $null
        $Answer = $null
        $Errors = $null
    }
}
if ($InspectPacketOnly.IsPresent -or $PreflightOnly.IsPresent) { Write-Host 'BATCH U STARTED: local inspection only; no hosted login or email request.' }
else { Write-Host 'Stage 3/10 | FR.2/8 | Batch U/Z - STARTED: actual FULL APP browser checks with two ordinary staging accounts, ONE code email, a FIRST-account-only FIVE-MINUTE window, then explicit quarantine and exact cleanup. No public launch.' }
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 105) { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $SourceCount++
    }
    $Phase = 'PRIVATE_DIALOGUE_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath)) { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/check-fr-2-email-batch-u-hosted.mjs'
    $Preflight = Private-Dialogue $Runtime.execPath $Entry '{"preflight":true}' $false
    if ($Preflight.result -ne 'PRIVATE_DIALOGUE_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_DIALOGUE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE","result":"WINDOWS_PRIVATE_DIALOGUE_PREFLIGHT_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        Write-Host 'BATCH U LOCAL PREFLIGHT COMPLETE: hosted acceptance remains pending.'
        return 0
    }
    if (-not $ExerciseFullAppWindow.IsPresent -and -not $InspectPacketOnly.IsPresent) { throw 'EXPLICIT_ONE_EMAIL_SWITCH_REQUIRED' }
    $Phase = 'EXISTING_BROWSER_VALIDATION'
    $BrowserExecutable = $BrowserExecutable.Trim().Trim('"')
    if (-not [IO.Path]::IsPathRooted($BrowserExecutable) -or -not (Test-Path -LiteralPath $BrowserExecutable -PathType Leaf) -or
        (Split-Path $BrowserExecutable -Leaf) -notin @('msedge.exe','chrome.exe')) { throw 'EXISTING_BROWSER_REQUIRED' }
    Assert-Unlinked $BrowserExecutable
    $PrivateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
    $PacketFile = Select-RetainedGatewayPacket $PrivateRoot $PacketFile
    $Phase = 'RETAINED_GATEWAY_PACKET_FILE_READ'
    $Problem = 'PRIVATE_PACKET_FILE_READ_REQUIRED'
    $PacketItem = Get-Item -LiteralPath $PacketFile
    if ($PacketItem.PSIsContainer -or $PacketItem.Length -lt 1 -or $PacketItem.Length -gt 262144) { throw 'PRIVATE_PACKET_REQUIRED' }
    $PacketHash = (Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash
    $Cipher = [IO.File]::ReadAllText($PacketFile, [Text.Encoding]::UTF8)
    $Phase = 'RETAINED_GATEWAY_PACKET_DPAPI_DECRYPTION'
    $Problem = 'PRIVATE_PACKET_DPAPI_DECRYPTION_REQUIRED'
    $PacketSecure = ConvertTo-SecureString $Cipher
    $Cipher = $null
    $Phase = 'RETAINED_GATEWAY_PACKET_JSON'
    $Problem = 'PRIVATE_PACKET_JSON_REQUIRED'
    $Packet = (Plain $PacketSecure) | ConvertFrom-Json
    $PublicInputs = Get-RetainedGatewayPublicInputs $Packet
    $RecipientEmails = $PublicInputs.recipients
    $PublicKey = $PublicInputs.publishableKey
    $Phase = 'RETAINED_GATEWAY_PACKET_LOCAL_READBACK'
    $Problem = 'PRIVATE_PACKET_CHANGED'
    Assert-Unlinked $PacketFile
    if ((Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash -cne $PacketHash) { throw 'PRIVATE_PACKET_CHANGED' }
    if ($InspectPacketOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE","result":"LOCAL_RETAINED_GATEWAY_PACKET_INSPECTION_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"retained_gateway_packet_unchanged":true,"exit_code":0}')
        Write-Host 'BATCH U LOCAL PACKET INSPECTION COMPLETE: hosted email acceptance remains pending.'
        return 0
    }
    $Phase = 'RETAINED_GATEWAY_TEST_INBOX_CHOICE'
    $Problem = 'PRIVATE_RECIPIENT_SELECTION_REQUIRED'
    $Problem = 'TWO_CONFIGURED_ORDINARY_ACCOUNTS_REQUIRED'
    if ($RecipientEmails.Count -lt 2) { throw 'TWO_CONFIGURED_ACCOUNTS_REQUIRED' }
    $Problem = 'PRIVATE_RECIPIENT_SELECTION_REQUIRED'
    Write-Host 'Choose two DIFFERENT ordinary existing staging accounts whose APP passwords and inboxes you control. Only the first receives one code email:'
    for ($Index = 0; $Index -lt $RecipientEmails.Count; $Index++) { Write-Host (($Index + 1).ToString() + ': ' + $RecipientEmails[$Index]) }
    $Choice = Read-Host 'Choose the FIRST test inbox number (receives the one email)'
    $Number = 0
    if ($Choice -notmatch '^[1-9][0-9]*$' -or -not [int]::TryParse($Choice,[ref]$Number) -or $Number -gt $RecipientEmails.Count) { throw 'PRIVATE_RECIPIENT_SELECTION_REQUIRED' }
    $SelectedEmail = $RecipientEmails[$Number - 1]
    $OtherChoice = Read-Host 'Choose the SECOND, DIFFERENT test inbox number (no email sent to it)'
    $OtherNumber = 0
    if ($OtherChoice -notmatch '^[1-9][0-9]*$' -or -not [int]::TryParse($OtherChoice,[ref]$OtherNumber) -or $OtherNumber -gt $RecipientEmails.Count -or $OtherNumber -eq $Number) { throw 'PRIVATE_RECIPIENT_SELECTION_REQUIRED' }
    $OtherEmail = $RecipientEmails[$OtherNumber - 1]
    $Problem = 'LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED'
    Write-Host 'Full app startup: only existing profiles/workspaces are accepted. Finance/profile table writes are blocked; normal activity RPC timestamps may update. The first account must already have a visible active Personal payment with a name at least four characters long.'
    Write-Host 'A verified pre-init memory Web Storage shim is used. This does not establish installed PWA/native OS storage acceptance.'
    $Phase = 'PRIVATE_TOKEN_AND_TWO_STAGING_APP_PASSWORDS'
    $TokenSecure = Read-Host 'Paste the same staging Management token: Project Settings Read + Database Read-write (hidden)' -AsSecureString
    $PasswordSecure = Read-Host ('Enter the FIRST STAGING APP password for ' + $SelectedEmail + ' (hidden; not a mailbox or database password)') -AsSecureString
    $OtherPasswordSecure = Read-Host ('Enter the SECOND STAGING APP password for ' + $OtherEmail + ' (hidden; not a mailbox or database password)') -AsSecureString
    $Accounts = @(@{email=$SelectedEmail;password=(Plain $PasswordSecure)},@{email=$OtherEmail;password=(Plain $OtherPasswordSecure)})
    $Payload = @{managementToken=((Plain $TokenSecure).Trim());accounts=$Accounts;publishableKey=$PublicKey;allowedRecipients=$RecipientEmails;
        browserExecutable=$BrowserExecutable;acknowledgement='FULL_APP_ONE_EMAIL_FIRST_ACCOUNT_FIVE_MINUTES_THEN_QUARANTINE'} | ConvertTo-Json -Depth 5 -Compress
    $Phase = 'CONTROLLED_PROVIDER_PROBE'
    $ProbeStarted = $true
    $Safe = Private-Dialogue $Runtime.execPath $Entry $Payload $true
    if ((Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash -cne $PacketHash) { throw 'PRIVATE_PACKET_CHANGED' }
    $Allowed = @('stage_step','batch','result','actual_hosted_requests','maximum_direct_HTTP_requests','gateway_internal_provider_requests_not_counted','fixed_target_before_and_after_verified','quarantined_catalog_before_verified','live_public_key_matches_private_snapshot','management_multiple_SELECT_result_shape','active_window_readback_rows','active_window_readback_shape_matched','active_window_lease_matched','active_window_remaining_seconds','four_ordinary_sessions_verified','quarantined_password_only_HTTP_denied','email_request_attempts','email_provider_acceptance_observed','email_dispatch_outcome_uncertain','email_code_verified','verification_outcome_uncertain','secure_fixed_deadline_remember_cookie_observed','foreign_account_renamed_cookie_restore_denied','missing_cookie_restore_requires_code','same_account_new_session_restore_approved','repeated_restore_emits_no_cookie','independent_device_and_proof_binding_aggregates_verified','bounded_window_seconds','allowed_window_accounts','bounded_open_write_attempts','open_write_outcome_uncertain','independent_active_window_verified','verified_email_and_restored_session_HTTP_access_passed','same_account_password_only_HTTP_denied','other_account_password_only_HTTP_denied','verified_sessions_foreign_profile_HTTP_denied','pre_quarantine_state_inspected','quarantine_write_attempts','quarantine_write_outcome_uncertain','quarantine_response_problem_code','explicit_quarantine_and_stale_open_fence_verified','post_window_quarantined_HTTP_denied','committed_mode_change_requests','exact_generated_device_cleanup_write_attempts','device_cleanup_write_outcome_uncertain','selected_generated_device_absent','Auth_password_signin_attempts','Auth_local_logout_attempts','Auth_session_cleanup_outcome_uncertain','selected_sessions_proofs_and_challenges_absent','quarantined_catalog_after_verified','application_rows_explicitly_written','automatic_activity_RPC_write_attempts','finance_or_profile_table_writes_allowed','existing_session_device_and_finance_state_preserved','full_app_fixture_prerequisites_verified','full_app_fixture_checks','progress_display','private_rate_and_send_audit_retained','other_devices_or_Auth_sessions_explicitly_deleted','browser_cookie_cache_or_device_restore_verified','full_cross_account_and_role_acceptance_verified','real_PostgreSQL_concurrency_verified','full_scheduler_or_external_caller_graph_verified','credentials_codes_cookies_or_raw_provider_bodies_in_safe_result','credentials_or_cookies_saved_to_disk_arguments_or_environment','Auth_settings_secrets_schedules_or_deployments_changed','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','browser','samples','cleanup_problem_code','final_state_problem_code','failure_checkpoint','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_SAFE_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    $Safe | Add-Member -NotePropertyName retained_gateway_DPAPI_packet_read_only -NotePropertyValue $true
    $Safe | Add-Member -NotePropertyName retained_gateway_packet_unchanged -NotePropertyValue $true
    $Safe | Add-Member -NotePropertyName configured_test_inbox_list_shown_locally -NotePropertyValue $true
    $Safe | Add-Member -NotePropertyName privileged_gateway_secret_values_passed_to_child -NotePropertyValue $false
    Write-Host 'BEGIN SAFE BATCH U RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 10)
    Write-Host 'END SAFE BATCH U RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'Stage 3/10 | FR.2/8 | Batch U/Z - SCOPED COMPLETE: actual full app/SDK/memory-storage/cache/session checks passed, explicit quarantine independently verified, exact generated device/four sessions removed, preexisting sessions/devices and payment rows unchanged and disposable browser cleaned up. Send the safe JSON and exit code.' }
    else { Write-Host 'BATCH U STOPPED FOR REVIEW: send the safe JSON; do not resend email or repeat the probe blindly.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE","result":"PRIVATE_BATCH_U_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"' + $Problem + '","email_or_Auth_session_outcome_requires_inspection":' + $(if ($ProbeStarted) { 'true' } else { 'false' }) + ',"committed_mode_change_may_require_inspection":' + $(if ($ProbeStarted) { 'true' } else { 'false' }) + ',"exit_code":1}')
    Write-Host 'BATCH U STOPPED FOR REVIEW: send only the safe JSON and exit code; inspect the checkpoint before retrying.'
    return 1
} finally {
    foreach ($Secret in @($TokenSecure,$PasswordSecure,$OtherPasswordSecure,$PacketSecure)) { if ($Secret) { $Secret.Dispose() } }
    $Packet = $null
    $Cipher = $null
    $PublicInputs = $null
    $RecipientEmails = $null
    $SelectedEmail = $null
    $OtherEmail = $null
    $Accounts = $null
    $PublicKey = $null
    $Payload = $null
    $Safe = $null
}
