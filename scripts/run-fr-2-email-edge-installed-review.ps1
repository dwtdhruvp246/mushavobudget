param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$RunReadOnlyReview,
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
        if (-not $Child.WaitForExit(105000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.requests_attempted -lt 0 -or $Answer.requests_attempted -gt 7) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH C READ-ONLY REVIEW STARTED: seven fixed GETs; no installation or secret changes.'
try {
    if (-not $RunReadOnlyReview.IsPresent -and -not $PreflightOnly.IsPresent) { throw 'READ_ONLY_SWITCH_REQUIRED' }
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-edge-installed-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 6) { throw 'SOURCE_MANIFEST_REQUIRED' }
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
    $Entry = Join-Path $SnapshotRoot 'scripts/review-fr-2-email-edge-installed.mjs'
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.requests_attempted -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW","result":"WINDOWS_PRIVATE_PIPE_PREFLIGHT_PASS","requests_attempted":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        return 0
    }
    $Phase = 'PRIVATE_MANAGEMENT_TOKEN'
    $TokenSecure = Read-Host 'Paste the staging-only Management token used for Batch C (read-only review; hidden)' -AsSecureString
    $Payload = @{token=((Plain $TokenSecure).Trim())} | ConvertTo-Json -Compress
    $Phase = 'FIXED_READ_ONLY_CONTACT_SOURCE_PARITY'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Allowed = @('stage_step','result','requests_attempted','fixed_staging_project_metadata_matched','fixed_staging_database_host_matched','prior_metadata_fingerprint_matches','prior_function_ID_or_version_equality_independently_verified','metadata_change_cause_verified','selected_functions_absent_before_and_after','single_unrelated_function_matches_reviewed_contact_slug','detail_metadata_agreed_before_and_after','other_function_metadata_SHA256','downloaded_source_files','source_observation','source_comparison','exact_reviewed_contact_source_bytes_match','installed_configuration_names','all_six_names_listed','reviewed_contact_artifacts_match','source_review_basis','downloaded_source_normalized_for_acceptance','six_names_not_consumed_by_matched_source','shared_configuration_runtime_impact_verified','previous_deployable_artifact_retained','recovery_execution_verified','configuration_values_collected','secret_name_metadata_endpoint_used','application_rows_read','Edge_functions_invoked','SQL_endpoint_used','secret_write_attempted','downloaded_source_executed_or_saved','raw_source_provider_bodies_paths_or_unselected_identifiers_printed','token_saved_to_disk_or_environment','token_permission_scope_independently_inspected','metadata_snapshot_is_not_a_write_lock','settings_data_roles_grants_or_schedules_changed','email_push_or_FX_dispatched','readiness_approved','uploaded_or_deployed','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','samples','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH C READ-ONLY REVIEW RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 6)
    Write-Host 'END SAFE BATCH C READ-ONLY REVIEW RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'BATCH C READ-ONLY REVIEW COMPLETE: current artifacts and installed names match; metadata change cause remains unverified.' }
    else { Write-Host 'BATCH C READ-ONLY REVIEW REQUIRES INSPECTION: send the safe result.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.16R_READ_ONLY_POST_INSTALL_SOURCE_REVIEW","result":"PRIVATE_LOCAL_EDGE_IMPACT_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED","requests_attempted_unknown_if_child_started":true,"exit_code":1}')
    return 1
} finally {
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload = $null
    $Safe = $null
}
