param([Parameter(Mandatory=$true)][string]$SnapshotRoot)
$ErrorActionPreference = 'Stop'
$Candidate = 'C:\Users\HP\Desktop\Mushavo-Limiter-Candidate-70be94e508cb49d1ad48413b76dbe4be\worker'
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
    $Entry = Join-Path $SnapshotRoot 'scripts/check-fr-2-cloudflare-account.mjs'
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
    if (-not $Child.WaitForExit(60000)) { $Child.Kill(); throw 'PRIVATE_CHILD_TIMEOUT' }
    $SafeText = $OutputTask.GetAwaiter().GetResult()
    $PrivateErrors = $ErrorTask.GetAwaiter().GetResult()
    if ($SafeText.Length -gt 8192 -or $PrivateErrors.Length -ne 0) { throw 'PRIVATE_CHILD_OUTPUT_REVIEW_REQUIRED' }
    $Safe = $SafeText | ConvertFrom-Json
    $Allowed = @('stage_step','result','requests_attempted','candidate_hashes_match','token_active','staging_Pages_project_in_selected_account','complete_Worker_inventory_received','target_Worker_absent','candidate_files_changed','Cloudflare_resources_or_bindings_changed','token_saved_to_disk_or_environment','account_identifiers_or_credentials_printed','Zoho_file_accessed','email_dispatched','deployed','hosted_acceptance','production_or_native_changed','findings_closed','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    if ($Safe.stage_step -ne 'FR.2.4.E3.4_CLOUDFLARE_ACCOUNT_CHECK' -or $Safe.exit_code -ne $Child.ExitCode) { throw 'INVALID_RECEIPT' }
    Write-Host 'BEGIN SAFE CLOUDFLARE RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 4)
    Write-Host 'END SAFE CLOUDFLARE RESULT'
    Write-Host ('Cloudflare account check exit code: ' + $Child.ExitCode)
} catch {
    Write-Host '{"stage_step":"FR.2.4.E3.4_CLOUDFLARE_ACCOUNT_CHECK","result":"PRIVATE_LOCAL_RUNNER_REVIEW_REQUIRED","problem_code":"PRIVATE_LOCAL_RUNNER_FAILED","deployed":false,"exit_code":1}'
    Write-Host 'Cloudflare account check exit code: 1'
} finally {
    if ($TokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer) }
    if ($PrivateToken) { $PrivateToken.Dispose() }
    $PlainToken = $null
    $PrivateInput = $null
    if ($Child) { if ($ChildStarted -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
}
