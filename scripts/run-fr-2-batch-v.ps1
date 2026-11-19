param([Parameter(Mandatory=$true)][string]$SnapshotRoot)
$ErrorActionPreference = 'Stop'
$RequestLimit = 5
$Phase = 'SOURCE_IDENTITIES'
$SourceCount = 0
$TokenSecure = $null
$PrimarySecure = $null
$RecoverySecure = $null
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
                    Write-Host 'BATCH V is still running controlled staging checks; keep this window open. No email is automatically resent.'
                    $NextNotice += 20000
                }
            }
            $Line = $NextLine.GetAwaiter().GetResult()
            if ($null -eq $Line -or $Line.Length -gt 65536) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Frames++
            if ($Frames -gt 2) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Message = $Line | ConvertFrom-Json
            if ($Message.protocol -eq 'BATCH_V_CODE_REQUIRED') {
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
            if ($Message.protocol -ne 'BATCH_V_RESULT' -or @($Message.PSObject.Properties).Count -ne 2 -or $null -eq $Message.receipt) { throw 'PRIVATE_PROTOCOL_REVIEW_REQUIRED' }
            $Answer = $Message.receipt
            $Child.StandardInput.BaseStream.Close()
            if (-not $Child.WaitForExit(10000)) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
            $Extra = $Child.StandardOutput.ReadToEnd()
            $Errors = $ReadErrors.GetAwaiter().GetResult()
            if ($Extra.Length -ne 0 -or $Errors.Length -ne 0 -or
                $Answer.stage_step -ne 'FR.2.4.E5.35_BATCH_V_ADMIN_MFA_OPERATOR_FACTOR_AND_CATALOG_REVIEW' -or
                $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
                $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt $RequestLimit) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
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

Write-Host 'Stage 3/10 | FR.2/8 | Batch V/Z - STARTED: combined READ ONLY Admin source/grant, operator and pending-factor review. No Auth login, role/factor change or email.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-batch-v-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Rows.Count -ne $Manifest.source_file_count -or $Manifest.stage_step -ne 'FR.2.4.E5.35_BATCH_V_ADMIN_MFA_OPERATOR_FACTOR_AND_CATALOG_REVIEW') { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $SourceCount++
    }
    $Phase = 'PRIVATE_READ_ONLY_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath)) { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/check-fr-2-batch-v.mjs'
    $Preflight = Private-Dialogue $Runtime.execPath $Entry '{"preflight":true}' $false
    if ($Preflight.result -ne 'PRIVATE_READ_ONLY_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_DIALOGUE_REQUIRED' }
    $Phase = 'EXISTING_TOKEN_AND_OPERATOR_EMAILS'
    $TokenSecure = Read-Host 'Paste the same staging Management token: Project Settings Read + Database Read-write (hidden)' -AsSecureString
    $PrimarySecure = Read-Host 'Existing PRIMARY staging operator email from the earlier MFA setup (hidden)' -AsSecureString
    $RecoverySecure = Read-Host 'Existing separate RECOVERY staging operator email (hidden)' -AsSecureString
    $Payload = @{managementToken=((Plain $TokenSecure).Trim());primaryEmail=((Plain $PrimarySecure).Trim());recoveryEmail=((Plain $RecoverySecure).Trim())} | ConvertTo-Json -Compress
    $Phase = 'READ_ONLY_ADMIN_OPERATOR_AND_FACTOR_REVIEW'
    $Safe = Private-Dialogue $Runtime.execPath $Entry $Payload $false
    $Allowed = @('stage_step','progress_display','result','actual_hosted_requests','maximum_direct_HTTP_requests','target_before_and_after_verified','quarantined_catalog_before_verified','quarantined_catalog_after_verified','review','Auth_requests','real_email_requests','accounts_roles_factors_or_application_rows_changed','committed_mode_change_requests','credentials_addresses_IDs_factor_secrets_or_provider_bodies_in_safe_result','factor_metadata_does_not_authorize_cleanup','independent_operator_control_or_recovery_verified','genuine_AAL2_cases_run','factor_secrets_or_secret_hashes_read','hosted_Admin_MFA_acceptance','hosted_acceptance','live_activation_approved','production_or_native_changed','APK_update_deferred','findings_closed','checkpoint','problem_code','final_state_problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_SAFE_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH V READ ONLY RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 12)
    Write-Host 'END SAFE BATCH V READ ONLY RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'Stage 3/10 | FR.2/8 | Batch V/Z - READ ONLY REVIEW COMPLETE. Admin MFA acceptance remains pending. Send the safe JSON and exit code.' }
    else { Write-Host 'Stage 3/10 | FR.2/8 | Batch V/Z - STOPPED FOR REVIEW. No factor reset, enrollment or role change requested.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.35_BATCH_V_ADMIN_MFA_OPERATOR_FACTOR_AND_CATALOG_REVIEW","progress_display":"Stage 3/10 | FR.2/8 | Batch V/Z - STOPPED FOR REVIEW","result":"PRIVATE_BATCH_V_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_OR_READ_ONLY_REVIEW_REQUIRED","Auth_requests":0,"real_email_requests":0,"accounts_roles_factors_or_application_rows_changed":false,"committed_mode_change_requests":0,"exit_code":1}')
    return 1
} finally {
    foreach ($Secret in @($TokenSecure,$PrimarySecure,$RecoverySecure)) { if ($Secret) { $Secret.Dispose() } }
    $TokenSecure = $null
    $PrimarySecure = $null
    $RecoverySecure = $null
    $Payload = $null
    $Safe = $null
}
