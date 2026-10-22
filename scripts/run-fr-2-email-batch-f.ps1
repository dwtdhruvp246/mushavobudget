param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$Register,
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
                Write-Host 'BATCH F is still running staging database checks/registration; keep this window open. The final safe receipt will report the single registration attempt.'
                $NextNotice += 20000
            }
        }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.19_BATCH_F_DORMANT_STAGING_DATABASE_REGISTRATION' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 6) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH F STARTED: check the staging SQL context, register dormant private controls and independently read them back.'
try {
    if (-not $Register.IsPresent -and -not $PreflightOnly.IsPresent) { throw 'REGISTER_SWITCH_REQUIRED' }
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-batch-f-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.19_BATCH_F_DORMANT_STAGING_DATABASE_REGISTRATION' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 6) { throw 'SOURCE_MANIFEST_REQUIRED' }
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
    $Entry = Join-Path $SnapshotRoot 'scripts/register-fr-2-email-batch-f.mjs'
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.19_BATCH_F_DORMANT_STAGING_DATABASE_REGISTRATION","result":"WINDOWS_PRIVATE_PIPE_PREFLIGHT_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        return 0
    }
    $Phase = 'PRIVATE_MANAGEMENT_TOKEN'
    $TokenSecure = Read-Host 'Paste a staging-only scoped Management token: Project Settings Read + Database Read-write (hidden)' -AsSecureString
    $Payload = @{token=((Plain $TokenSecure).Trim()); acknowledgement='REGISTER_DORMANT_STAGING_EMAIL_ONLY'} | ConvertTo-Json -Compress
    $Phase = 'DORMANT_STAGING_REGISTRATION_AND_READBACK'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Allowed = @('stage_step','batch','result','actual_hosted_requests','fixed_staging_project_and_host_verified','privileged_origin_and_read_only_preflight_verified','selected_nine_baseline_checks_passed','registration_POST_requests','registration_HTTP_accepted','registration_write_outcome_uncertain','private_catalog_exact_readback','registered_control_readback','post_registration_eight_baseline_checks_passed','post_target_metadata_matched','registration_committed_state_observed','application_guards_absent_observed','checks','samples','independent_readback_attempted','readback_problem_code','arbitrary_SQL_or_user_selected_URL_accepted','general_write_capable_SQL_endpoint_used','catalog_transactions_explicitly_read_only','application_rows_explicitly_read_or_written','private_control_rows_aggregated','activation_or_resume_or_quarantine_invoked','application_or_Edge_functions_explicitly_invoked','reviewed_DDL_hooks_may_have_run','private_schema_functions_table_and_ACLs_may_have_changed','automatic_write_retry_or_delete_performed','raw_provider_bodies_SQL_sources_or_credentials_printed','token_saved_to_disk_or_environment','ZIP_DPAPI_or_saved_credentials_accessed','Auth_settings_secrets_schedules_or_deployments_changed','email_push_or_FX_explicitly_dispatched','metadata_observation_is_not_a_write_lock','target_GUC_is_acknowledgement_not_independent_attestation','token_scope_independently_inspected','actual_PostgreSQL_concurrency_verified','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH F RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 6)
    Write-Host 'END SAFE BATCH F RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'BATCH F COMPLETE: private staging installer registered and read back; application guards remain inactive. Activation and hosted acceptance remain pending.' }
    else { Write-Host 'BATCH F STOPPED FOR REVIEW: send the safe result; do not repeat registration blindly.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.19_BATCH_F_DORMANT_STAGING_DATABASE_REGISTRATION","result":"PRIVATE_BATCH_F_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED","hosted_registration_outcome_requires_inspection_if_child_started":true,"exit_code":1}')
    return 1
} finally {
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload = $null
    $Safe = $null
}
