param([Parameter(Mandatory=$true)][string]$SnapshotRoot,
      [Parameter(Mandatory=$true)][string]$CandidateDirectory)
$ErrorActionPreference = 'Stop'
$Candidate = $CandidateDirectory
$Child = $null
$ChildStarted = $false
$PrivateToken = $null
$PlainToken = $null
$PrivateInput = $null
$TokenPointer = [IntPtr]::Zero
try {
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_UNAVAILABLE' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath)) { throw 'NODE_RUNTIME_UNAVAILABLE' }
    $Entry = Join-Path $SnapshotRoot 'scripts/inspect-fr-2-email-limiter.mjs'
    if (-not [IO.File]::Exists($Entry) -or -not [IO.Directory]::Exists($Candidate)) { throw 'LOCAL_INPUT_UNAVAILABLE' }
    $Account = (Read-Host 'Paste the Cloudflare ACCOUNT ID for the account containing mushavo-budget-staging').Trim().ToLowerInvariant()
    if ($Account -notmatch '^[a-f0-9]{32}$') { throw 'INVALID_ACCOUNT_ID' }
    $PrivateToken = Read-Host 'Paste your Cloudflare API token here only (hidden)' -AsSecureString
    $Start = New-Object System.Diagnostics.ProcessStartInfo
    $Start.FileName = $Runtime.execPath
    $Start.Arguments = '"' + $Entry + '"'
    $Start.WorkingDirectory = $SnapshotRoot
    $Start.UseShellExecute = $false
    $Start.CreateNoWindow = $true
    $Start.RedirectStandardInput = $true
    $Start.RedirectStandardOutput = $true
    $Start.RedirectStandardError = $true
    foreach ($Key in @($Start.EnvironmentVariables.Keys)) {
        if ($Key -match '^(NODE_OPTIONS|NODE_DEBUG|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_)') { $Start.EnvironmentVariables.Remove($Key) }
    }
    $Child = New-Object System.Diagnostics.Process
    $Child.StartInfo = $Start
    if (-not $Child.Start()) { throw 'PRIVATE_CHILD_START_FAILED' }
    $ChildStarted = $true
    $OutputTask = $Child.StandardOutput.ReadToEndAsync()
    $ErrorTask = $Child.StandardError.ReadToEndAsync()
    $TokenPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($PrivateToken)
    $PlainToken = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($TokenPointer)
    $PrivateInput = @{account=$Account;token=$PlainToken;candidate=$Candidate} | ConvertTo-Json -Compress
    $Child.StandardInput.WriteLine($PrivateInput)
    $Child.StandardInput.Close()
    $PlainToken = $null
    $PrivateInput = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer)
    $TokenPointer = [IntPtr]::Zero
    if (-not $Child.WaitForExit(90000)) { $Child.Kill(); throw 'PRIVATE_CHILD_TIMEOUT' }
    $SafeText = $OutputTask.GetAwaiter().GetResult()
    $PrivateErrors = $ErrorTask.GetAwaiter().GetResult()
    if ($SafeText.Length -gt 16384 -or $PrivateErrors.Length -ne 0) { throw 'PRIVATE_CHILD_OUTPUT_REVIEW_REQUIRED' }
    $Safe = $SafeText | ConvertFrom-Json
    $Allowed = @('stage_step','result','requests_attempted','candidate_hashes_match','staging_Pages_project_verified','target_Worker_present_verified','selected_SQLite_namespace_verified','namespace_inventory_complete','workers_dev_and_preview_URLs_disabled_verified','legacy_namespace_predicate_rejects_current_success_response','samples','upload_deletion_or_settings_write_attempted','token_saved_to_disk_or_environment','account_identifiers_credentials_namespace_IDs_or_response_bodies_printed','Zoho_file_accessed','email_dispatched','hosted_acceptance','production_or_native_changed','findings_closed','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    if ($Safe.stage_step -ne 'FR.2.4.E3.4_LIMITER_READ_ONLY_REVIEW' -or $Safe.exit_code -ne $Child.ExitCode) { throw 'INVALID_RECEIPT' }
    Write-Host 'BEGIN SAFE LIMITER READ-ONLY RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 6)
    Write-Host 'END SAFE LIMITER READ-ONLY RESULT'
    Write-Host ('Limiter read-only review exit code: ' + $Child.ExitCode)
} catch {
    Write-Host '{"stage_step":"FR.2.4.E3.4_LIMITER_READ_ONLY_REVIEW","result":"PRIVATE_LOCAL_RUNNER_REVIEW_REQUIRED","problem_code":"PRIVATE_LOCAL_RUNNER_FAILED","upload_deletion_or_settings_write_attempted":false,"exit_code":1}'
    Write-Host 'Limiter read-only review exit code: 1'
} finally {
    if ($TokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer) }
    if ($PrivateToken) { $PrivateToken.Dispose() }
    $PlainToken = $null
    $PrivateInput = $null
    if ($Child) { if ($ChildStarted -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
}
