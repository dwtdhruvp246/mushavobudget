param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$PreflightOnly
)
$ErrorActionPreference = 'Stop'
$Phase = 'SOURCE_IDENTITIES'
$SourceCount = 0
$TokenSecure = $null
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
function Plain([Security.SecureString]$Value) {
    $Pointer = [IntPtr]::Zero
    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    } finally {
        if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) }
    }
}
function Private-Child([string]$Node, [string]$Entry, [string]$Text) {
    $Child = $null
    $Started = $false
    $Bytes = $null
    try {
        $Start = New-Object Diagnostics.ProcessStartInfo
        $Start.FileName = $Node
        $Start.Arguments = '"' + $Entry + '" --private-parent-pipe'
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
        $ReadOutput = $Child.StandardOutput.ReadToEndAsync()
        $ReadErrors = $Child.StandardError.ReadToEndAsync()
        $Bytes = $Encoding.GetBytes($Text)
        $Child.StandardInput.BaseStream.Write($Bytes, 0, $Bytes.Length)
        $Child.StandardInput.BaseStream.Flush()
        $Child.StandardInput.BaseStream.Close()
        [Array]::Clear($Bytes, 0, $Bytes.Length)
        $Bytes = $null
        $Clock = [Diagnostics.Stopwatch]::StartNew()
        $NextNotice = 20000
        while (-not $Child.WaitForExit(1000)) {
            if ($Clock.ElapsedMilliseconds -ge 300000) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
            if ($Clock.ElapsedMilliseconds -ge $NextNotice) {
                Write-Host 'BATCH F READ-ONLY REVIEW is still running read-only staging checks; keep this window open. No registration will be repeated.'
                $NextNotice += 20000
            }
        }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.19R_READ_ONLY_DORMANT_REGISTRATION_REVIEW' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 5) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH F READ-ONLY REVIEW STARTED: inspect PostgreSQL version, compare the private catalog and read dormant control state. No writes or activation.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-batch-f-review-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.19R_READ_ONLY_DORMANT_REGISTRATION_REVIEW' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 6) { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $SourceCount++
    }
    $Phase = 'PRIVATE_PIPE_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath)) { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/review-fr-2-email-batch-f.mjs'
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.19R_READ_ONLY_DORMANT_REGISTRATION_REVIEW","result":"WINDOWS_PRIVATE_PIPE_PREFLIGHT_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        return 0
    }
    $Phase = 'PRIVATE_MANAGEMENT_TOKEN'
    $TokenSecure = Read-Host 'Paste a staging-only scoped Management token: Project Settings Read + Database Read-write, used only for READ ONLY SQL (hidden)' -AsSecureString
    $Payload = @{token=((Plain $TokenSecure).Trim())} | ConvertTo-Json -Compress
    $Phase = 'READ_ONLY_VERSION_AND_CATALOG_REVIEW'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Allowed = @('stage_step','result','actual_hosted_requests','fixed_staging_target_before_and_after_verified','privileged_read_only_context_verified','selected_eight_baseline_checks_passed','server_version_num','server_major','reference_basis','reference_adjustments','original_reference_exact','version_reference_exact','catalog_comparison','catalog_observations_agreed','checks','application_guards_absent_observed','private_control_rows_aggregated','registered_control_verified','current_dormant_registration_state_verified','historical_registration_receipt_remains_unchanged','registration_write_attempts','activation_or_resume_or_quarantine_invoked','general_SQL_endpoint_used','all_SQL_transactions_explicitly_READ_ONLY','application_rows_read_or_written','application_or_Edge_functions_explicitly_invoked','settings_roles_grants_data_secrets_or_deployments_changed','raw_provider_bodies_SQL_sources_or_unselected_identifiers_printed','token_saved_to_disk_or_environment','ZIP_DPAPI_or_saved_credentials_accessed','email_push_or_FX_dispatched','metadata_observation_is_not_a_write_lock','all_catalog_fields_or_real_PostgreSQL_concurrency_verified','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','samples','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH F READ-ONLY REVIEW RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 12)
    Write-Host 'END SAFE BATCH F READ-ONLY REVIEW RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'BATCH F READ-ONLY REVIEW COMPLETE: current dormant registration matches the version-specific catalog and REGISTERED state. No writes or activation were performed.' }
    else { Write-Host 'BATCH F READ-ONLY REVIEW STOPPED FOR REVIEW: send the safe comparison JSON; do not rerun registration.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.19R_READ_ONLY_DORMANT_REGISTRATION_REVIEW","result":"PRIVATE_BATCH_F_READ_ONLY_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED","registration_or_activation_attempted_by_this_review":false,"exit_code":1}')
    return 1
} finally {
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload = $null
    $Safe = $null
}
