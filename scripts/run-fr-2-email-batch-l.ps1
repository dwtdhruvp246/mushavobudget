param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$PreflightOnly,
    [switch]$Install
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
                Write-Host 'BATCH L is still running staging checks/installation/readback; keep this window open. No write is automatically retried.'
                $NextNotice += 20000
            }
        }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.25_BATCH_L_QUARANTINED_ACCEPTANCE_CONTROL_UPGRADE_AND_READBACK' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 5) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH L STARTED: fresh staging precheck, one closed acceptance-control upgrade if absent, independent readback. Staging stays quarantined; no email is sent.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-batch-l-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.25_BATCH_L_QUARANTINED_ACCEPTANCE_CONTROL_UPGRADE_AND_READBACK' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 6) { throw 'SOURCE_MANIFEST_REQUIRED' }
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
    $Entry = Join-Path $SnapshotRoot 'scripts/install-fr-2-email-batch-l.mjs'
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.25_BATCH_L_QUARANTINED_ACCEPTANCE_CONTROL_UPGRADE_AND_READBACK","result":"WINDOWS_PRIVATE_PIPE_PREFLIGHT_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        return 0
    }
    if (-not $Install.IsPresent) { throw 'EXPLICIT_QUARANTINED_INSTALL_SWITCH_REQUIRED' }
    $Phase = 'PRIVATE_MANAGEMENT_TOKEN'
    $TokenSecure = Read-Host 'Paste the staging-only Management token: Project Settings Read + Database Read-write (hidden)' -AsSecureString
    $Payload = @{token=((Plain $TokenSecure).Trim());acknowledgement='INSTALL_BOUNDED_STAGING_CONTROLS_KEEP_QUARANTINED'} | ConvertTo-Json -Compress
    $Phase = 'CLOSED_CONTROL_UPGRADE'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Allowed = @('stage_step','batch','result','actual_hosted_requests','maximum_hosted_requests','target_before_verified','quarantined_precheck_verified','controls_already_installed_before_run','upgrade_write_attempts','upgrade_HTTP_accepted','write_response_problem_code','upgrade_write_outcome_uncertain','independent_readback_attempted','bounded_controls_verified','window_table_empty','quarantined_catalog_after_verified','target_after_verified','automatic_write_retry_performed','guarded_RPCs','restrictive_policies','backend_forced_RLS_tables','private_schema_API_denied','application_rows_read_or_written','application_access_opened','Auth_settings_secrets_schedules_or_deployments_changed','email_push_or_FX_dispatched','private_packets_accessed','token_saved_to_disk_arguments_or_environment','raw_provider_bodies_printed','committed_mode_change_requests','hosted_acceptance','live_activation_approved','production_or_native_changed','APK_update_deferred','findings_closed','samples','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH L RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 12)
    Write-Host 'END SAFE BATCH L RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'BATCH L COMPLETE: bounded controls independently observed closed and QUARANTINED. No acceptance window opened. Send the safe JSON and exit code.' }
    else { Write-Host 'BATCH L STOPPED FOR REVIEW: send the safe JSON; do not retry the upgrade blindly.' }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.25_BATCH_L_QUARANTINED_ACCEPTANCE_CONTROL_UPGRADE_AND_READBACK","result":"PRIVATE_BATCH_L_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED","hosted_write_outcome_requires_inspection":' + $(if ($Phase -eq 'CLOSED_CONTROL_UPGRADE') { 'true' } else { 'false' }) + ',"exit_code":1}')
    return 1
} finally {
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload = $null
    $Safe = $null
}
