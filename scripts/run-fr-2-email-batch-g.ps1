param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [string]$FrontendZIP = 'C:\Users\HP\AppData\Local\Temp\mushavo-batch-b-27ecd840ce3a42fb9a5c9bd008f3d9e4\batch-b-frontend\mushavo-email-push-review.zip',
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
                Write-Host 'BATCH G is still running read-only staging checks; keep this window open. Only fixed Cloudflare GET requests are used.'
                $NextNotice += 20000
            }
        }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 5) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH G STARTED: verify the retained frontend ZIP and fresh Pages, limiter, binding and secret-name metadata.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-batch-g-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION' -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 6) { throw 'SOURCE_MANIFEST_REQUIRED' }
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
    $Entry = Join-Path $SnapshotRoot 'scripts/check-fr-2-email-batch-g.mjs'
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.actual_hosted_requests -ne 0 -or $Preflight.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    if ($PreflightOnly.IsPresent) {
        Write-Host ('{"stage_step":"FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION","result":"WINDOWS_PRIVATE_PIPE_PREFLIGHT_PASS","actual_hosted_requests":0,"source_hashes_verified":' + $SourceCount + ',"exit_code":0}')
        return 0
    }
    $Phase = 'PRIVATE_CLOUDFLARE_INPUTS'
    if (-not (Test-Path -LiteralPath $FrontendZIP -PathType Leaf)) {
        $FrontendZIP = (Read-Host 'The retained Batch B ZIP was not found. Paste its full mushavo-email-push-review.zip path').Trim().Trim('"')
    }
    Assert-Unlinked $FrontendZIP
    if ((Get-FileHash -LiteralPath $FrontendZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne '867296b5e71747a15d46c7ed8937484558ea9fcac97cd96c66ddf5dc00c8b9da') { throw 'RETAINED_BATCH_B_ZIP_REQUIRED' }
    $Account = (Read-Host '1 of 2: Cloudflare ACCOUNT ID for the account containing mushavo-budget-staging').Trim().ToLowerInvariant()
    if ($Account -notmatch '^[a-f0-9]{32}$') { throw 'CLOUDFLARE_ACCOUNT_REQUIRED' }
    $TokenSecure = Read-Host '2 of 2: Cloudflare API token used for the earlier Pages/limiter read checks (hidden)' -AsSecureString
    $Payload = @{account=$Account;token=((Plain $TokenSecure).Trim());zip=[IO.Path]::GetFullPath($FrontendZIP)} | ConvertTo-Json -Compress
    $Phase = 'FRONTEND_AND_PAGES_ROLLOUT_PREFLIGHT'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Allowed = @('stage_step','batch','result','actual_hosted_requests','retained_Batch_B_ZIP_identity_verified','public_files','ZIP_SHA256','Worker_SHA256','frontend_staging_configuration_and_public_push_key_present','fresh_Pages_limiter_and_namespace_baseline_passed','static_unmanaged_staging_project_verified','both_channels_fixed_date_fail_closed_markers_and_binding_verified','both_channels_13_secret_text_names_present','selected_project_deployment_and_channel_metadata_stable','previous_static_deployment_identity_SHA256','manual_staging_frontend_upload_preflight_passed','channels','samples','secret_values_read_or_verified','shared_configuration_runtime_impact_verified','full_scheduler_or_external_caller_graph_verified','automatic_upload_or_settings_write_attempted','SQL_Auth_or_Edge_endpoint_used','application_rows_accessed','email_push_or_FX_dispatched','raw_provider_bodies_credentials_or_account_namespace_deployment_IDs_printed','token_saved_to_disk_or_environment','DPAPI_or_saved_private_credentials_accessed','metadata_snapshot_is_not_a_write_lock','frontend_live_source_or_gateway_runtime_verified','application_guard_activation_approved','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    Write-Host 'BEGIN SAFE BATCH G RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 12)
    Write-Host 'END SAFE BATCH G RESULT'
    if ($Safe.exit_code -eq 0) { Write-Host 'BATCH G COMPLETE: preflight passed. Use the verified ZIP for the staging-only dashboard upload described in the handoff. No upload or database activation was performed by this command.' }
    else { Write-Host 'BATCH G STOPPED FOR REVIEW: send the safe result before any upload.' }
    if ($Safe.exit_code -eq 0) { Write-Host ('VERIFIED FRONTEND ZIP: ' + [IO.Path]::GetFullPath($FrontendZIP)) }
    return [int]$Safe.exit_code
} catch {
    Write-Host ('{"stage_step":"FR.2.4.E5.20_BATCH_G_FRONTEND_GATEWAY_ROLLOUT_PREPARATION","result":"PRIVATE_BATCH_G_RUNNER_REVIEW_REQUIRED","checkpoint":"' + $Phase + '","problem_code":"LOCAL_PRIVATE_RUNNER_REVIEW_REQUIRED","upload_or_activation_attempted_by_this_runner":false,"exit_code":1}')
    return 1
} finally {
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload = $null
    $Safe = $null
}
