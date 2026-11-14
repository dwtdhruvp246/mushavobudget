param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [switch]$Install,
    [string]$CandidateZIP = 'C:\Users\HP\AppData\Local\Temp\mushavo-batch-b-27ecd840ce3a42fb9a5c9bd008f3d9e4\batch-b-frontend\mushavo-email-push-review.zip',
    [string]$PacketPath = ''
)
$ErrorActionPreference = 'Stop'
$Stage = 'FR.2.4.E5.16_BATCH_C_STAGING_EDGE_CONFIGURATION_INSTALLATION'
$Phase = 'SOURCE_IDENTITIES_AND_INSTALL_SWITCH'
$PacketSecure = $null
$TokenSecure = $null
$InstallStarted = $false
$InstallReceiptReceived = $false
$PacketText = $null
$Packet = $null
$Payload = $null
$Safe = [pscustomobject]@{stage_step=$Stage;batch='C';result='STAGING_BATCH_C_RUNNER_REVIEW_REQUIRED';actual_hosted_requests=0;exit_code=1}
$Local = [ordered]@{source_hashes_verified=0;Batch_A_encrypted_packet_read_only=$false;encrypted_packet_unchanged=$false;
    installation_result_received=$false;hosted_write_outcome_requires_inspection=$false;token_saved_to_disk_or_environment=$false;private_values_or_email_printed=$false;credentials_in_arguments_or_environment=$false;batch_run_finished=$false}
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
            if ($Key -match '^(NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_|SUPABASE_|ZOHO_|EMAIL_GATE_|VAPID_|CURRENCY_|MUSHAVO_)') {
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
        if (-not $Child.WaitForExit(210000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.16_BATCH_C_STAGING_EDGE_CONFIGURATION_INSTALLATION' -or
            $Answer.batch -ne 'C' -or $Answer.exit_code -notin @(0,1) -or
            $Child.ExitCode -ne $Answer.exit_code -or $Answer.actual_hosted_requests -lt 0 -or $Answer.actual_hosted_requests -gt 16) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Allowed = @('stage_step','batch','result','local_candidate_and_private_pair_verified','fresh_source_target_precheck_passed','source_target_precheck_problem','six_configuration_names_absent_before','CurrencyAPI_status_HTTP_accepted','CurrencyAPI_quota_available','CurrencyAPI_FX_endpoint_access_verified','pre_install_checks_passed','secret_write_attempted','secret_write_HTTP_accepted','independent_configuration_name_readback_received','six_configuration_names_listed_after','other_configuration_names_unchanged','post_install_source_target_check_passed','installed_variable_count','settings_may_have_changed','write_outcome_uncertain','secret_value_equality_or_runtime_access_verified','shared_configuration_runtime_impact_verified','metadata_snapshot_is_not_a_write_lock','token_permission_scope_independently_inspected','actual_hosted_requests','secret_POST_requests','application_or_Edge_functions_invoked','SQL_or_Auth_or_deployment_endpoint_used','downloaded_source_executed_or_saved','raw_provider_bodies_paths_or_private_values_printed','email_push_or_FX_dispatched','uploaded_or_deployed','readiness_approved','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','samples','checked_UTC','checkpoint','problem_code','exit_code')
        if (@($Answer.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
Write-Host 'BATCH C STARTED: local artifact check, fresh staging source/target checks, CurrencyAPI status, one six-value installation and independent readback.'
try {
    if (-not $Install) { throw 'EXPLICIT_INSTALL_SWITCH_REQUIRED' }
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-edge-batch-c-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne $Stage -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 30) { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $Local.source_hashes_verified++
    }
    $Phase = 'PRIVATE_PIPE_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or $Runtime.execPath.Contains('"')) { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/install-fr-2-email-edge-batch-c.mjs'
    if ($Entry.Contains('"')) { throw 'PRIVATE_ENTRY_REVIEW_REQUIRED' }
    $Probe = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Probe.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS') { throw 'PRIVATE_PIPE_REQUIRED' }
    $Phase = 'EXISTING_BATCH_A_PACKET_SELECTION'
    if ([string]::IsNullOrWhiteSpace($PacketPath)) {
        $PrivateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
        Assert-Unlinked $PrivateRoot
        $Candidates = @()
        if (Test-Path -LiteralPath $PrivateRoot -PathType Container) {
            $Candidates = @(Get-ChildItem -LiteralPath $PrivateRoot -File -Filter 'edge-configuration-batchA-*.dpapi' |
                Where-Object { $_.Name -cmatch '^edge-configuration-batchA-[a-f0-9]{32}\.dpapi$' })
        }
        if ($Candidates.Count -eq 1) {
            $PacketPath = $Candidates[0].FullName
            Write-Host 'Using the single encrypted Batch A candidate in the expected folder. No new credentials are needed.'
        } else {
            Write-Host 'The Batch A file could not be selected uniquely. No files have been decrypted.'
            Write-Host ('Expected folder: ' + $PrivateRoot)
            foreach ($Candidate in $Candidates) { Write-Host $Candidate.FullName }
            $PacketPath = (Read-Host 'Paste the FULL PATH printed after your successful Batch A run; no file contents or passwords').Trim().Trim('"')
        }
    }
    if (-not [IO.Path]::IsPathRooted($PacketPath) -or [IO.Path]::GetFileName($PacketPath) -cnotmatch '^edge-configuration-batchA-[a-f0-9]{32}\.dpapi$') { throw 'BATCH_A_PACKET_PATH_REQUIRED' }
    Assert-Unlinked $PacketPath
    $Item = Get-Item -LiteralPath $PacketPath
    if ($Item.PSIsContainer -or $Item.Length -lt 1 -or $Item.Length -gt 131072) { throw 'BATCH_A_PACKET_FILE_REQUIRED' }
    $PacketHash = (Get-FileHash -LiteralPath $PacketPath -Algorithm SHA256).Hash
    $Phase = 'PRIVATE_BATCH_A_DECRYPTION'
    $PacketSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($PacketPath,[Text.Encoding]::UTF8))
    $PacketText = Plain $PacketSecure
    $Packet = $PacketText | ConvertFrom-Json
    $Local.Batch_A_encrypted_packet_read_only=$true
    $Payload = @{action='local';packet=$Packet;candidateZIPPath=$CandidateZIP} | ConvertTo-Json -Depth 8 -Compress

    $Phase = 'LOCAL_CANDIDATE_CHECK_BEFORE_TOKEN'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    if ($Safe.exit_code -ne 0 -or $Safe.result -ne 'LOCAL_BATCH_C_ARTIFACTS_VALIDATED') { throw 'LOCAL_CANDIDATE_REQUIRED' }
    Write-Host 'Install scope: six configuration values in staging project dczlddwbtgvfdujgcitb. No function deployment, SQL, Auth changes or message dispatch.'
    Write-Host 'Required token: fine-grained Supabase access token with project_admin_read, edge_functions_read, edge_functions_secrets_read and edge_functions_secrets_write.'
    Write-Host 'Token source: https://supabase.com/dashboard/account/tokens. Enter it only at the hidden prompt.'
    $Phase = 'PRIVATE_MANAGEMENT_TOKEN'
    $TokenSecure = Read-Host 'Supabase FINE-GRAINED access token for staging Edge secret installation (hidden)' -AsSecureString
    $Payload = @{action='install';packet=$Packet;candidateZIPPath=$CandidateZIP;token=((Plain $TokenSecure).Trim());acknowledgement='INSTALL_SIX_STAGING_EDGE_CONFIGURATION_VALUES_ONLY'} | ConvertTo-Json -Depth 8 -Compress
    $Phase = 'GUARDED_STAGING_CONFIGURATION_INSTALL_AND_READBACK'
    $InstallStarted=$true
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $InstallReceiptReceived=$true
    $Local.installation_result_received=$true
    $Local.hosted_write_outcome_requires_inspection=$Safe.write_outcome_uncertain
    if ((Get-FileHash -LiteralPath $PacketPath -Algorithm SHA256).Hash -cne $PacketHash) { throw 'ENCRYPTED_PACKET_CHANGED' }
    $Local.encrypted_packet_unchanged=$true
} catch {
    if ($InstallStarted -and -not $InstallReceiptReceived) { $Local.hosted_write_outcome_requires_inspection=$true }
    $Safe.exit_code=1
    $Safe.result='STAGING_BATCH_C_RUNNER_REVIEW_REQUIRED'
    $Safe | Add-Member -NotePropertyName problem_code -NotePropertyValue $Phase -Force
} finally {
    if ($PacketSecure) { $PacketSecure.Dispose() }
    if ($TokenSecure) { $TokenSecure.Dispose() }
    $Payload=$null;$PacketText=$null;$Packet=$null
    $Local.batch_run_finished=$true
    foreach ($Key in $Local.Keys) { $Safe | Add-Member -NotePropertyName $Key -NotePropertyValue $Local[$Key] -Force }
}
Write-Host 'BEGIN SAFE BATCH C RESULT'
Write-Host ($Safe | ConvertTo-Json -Depth 6)
Write-Host 'END SAFE BATCH C RESULT'
if ($Safe.exit_code -eq 0) { Write-Host 'BATCH C COMPLETE: six staging configuration names installed and read back; function/frontend deployment and activation remain pending.' }
else { Write-Host 'BATCH C STOPPED FOR REVIEW: return the safe result before any retry. An attempted write must not be repeated blindly.' }
Write-Host ('Batch C exit code: ' + $Safe.exit_code)
return [int]$Safe.exit_code
