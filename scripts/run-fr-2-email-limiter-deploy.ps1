param([Parameter(Mandatory=$true)][string]$SnapshotRoot,
      [Parameter(Mandatory=$true)][string]$ToolsRoot,
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
    $Entry = Join-Path $SnapshotRoot 'scripts/deploy-fr-2-email-limiter.mjs'
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
    $PrivateInput = @{account=$Account;token=$PlainToken;candidate=$Candidate;tools=$ToolsRoot} | ConvertTo-Json -Compress
    $Child.StandardInput.WriteLine($PrivateInput)
    $Child.StandardInput.Close()
    $PlainToken = $null
    $PrivateInput = $null
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer)
    $TokenPointer = [IntPtr]::Zero
    if (-not $Child.WaitForExit(240000)) { $Child.Kill(); throw 'PRIVATE_CHILD_TIMEOUT' }
    $SafeText = $OutputTask.GetAwaiter().GetResult()
    $PrivateErrors = $ErrorTask.GetAwaiter().GetResult()
    if ($SafeText.Length -gt 8192 -or $PrivateErrors.Length -ne 0) { throw 'PRIVATE_CHILD_OUTPUT_REVIEW_REQUIRED' }
    $Safe = $SafeText | ConvertFrom-Json
    $Allowed = @('stage_step','result','fresh_account_and_absence_check_passed','tools_verified','upload_attempted','Wrangler_exit_code','Worker_deployed','remote_state_may_require_review','selected_SQLite_namespace_verified','workers_dev_and_preview_URLs_disabled_verified','candidate_unchanged_verified','local_deployment_scratch_removed','Cloudflare_token_in_child_process_environment_only','credential_file_or_command_argument_written','Pages_gateway_or_binding_changed','email_dispatched','Zoho_file_accessed','SQL_Auth_or_application_guards_changed','email_login_enabled','hosted_acceptance','production_or_native_changed','findings_closed','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    if ($Safe.stage_step -ne 'FR.2.4.E3.4_LIMITER_DEPLOYMENT' -or $Safe.exit_code -ne $Child.ExitCode) { throw 'INVALID_RECEIPT' }
    Write-Host 'BEGIN SAFE LIMITER DEPLOYMENT RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 4)
    Write-Host 'END SAFE LIMITER DEPLOYMENT RESULT'
    Write-Host ('Limiter deployment exit code: ' + $Child.ExitCode)
} catch {
    Write-Host '{"stage_step":"FR.2.4.E3.4_LIMITER_DEPLOYMENT","result":"PRIVATE_LOCAL_RUNNER_REVIEW_REQUIRED","problem_code":"PRIVATE_LOCAL_RUNNER_FAILED","remote_state_may_require_review":true,"exit_code":1}'
    Write-Host 'Limiter deployment exit code: 1'
} finally {
    if ($TokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer) }
    if ($PrivateToken) { $PrivateToken.Dispose() }
    $PlainToken = $null
    $PrivateInput = $null
    if ($Child) { if ($ChildStarted -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
}
