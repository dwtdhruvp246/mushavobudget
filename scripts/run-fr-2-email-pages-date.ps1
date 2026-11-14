param([Parameter(Mandatory=$true)][string]$SnapshotRoot,
      [string]$CandidateDirectory = 'C:\Users\HP\AppData\Local\Temp\mushavo-email-staging-review-3e602d4d6b8e4c1d8f870057905f5269')
$ErrorActionPreference = 'Stop'
$Candidate = $CandidateDirectory
$Child = $null
$ChildStarted = $false
$PrivateToken = $null
$PlainToken = $null
$PrivateInput = $null
$TokenPointer = [IntPtr]::Zero
$LocalCheckpoint = 'SOURCE_HASHES'
$SourceHashes = 0
try {
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot `
        'docs/security-audit/security-fr-2-email-pages-date-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.3_EXACT_PAGES_DATE' -or $Rows.Count -ne 7) {
        throw 'SOURCE_MANIFEST_REVIEW_REQUIRED'
    }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or
            [IO.Path]::IsPathRooted($Row.Name) -or
            $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REVIEW_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        $Item = Get-Item -LiteralPath $File -Force
        if ($Item.PSIsContainer -or ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) {
            throw 'SOURCE_HASH_REVIEW_REQUIRED'
        }
        $SourceHashes++
    }
    $LocalCheckpoint = 'LOCAL_REVIEW_ZIP'
    $ZipPath = Join-Path $Candidate 'mushavo-email-staging-review.zip'
    $ZipItem = Get-Item -LiteralPath $ZipPath -Force
    if ($ZipItem.PSIsContainer -or $ZipItem.Length -gt 8388608 -or
        ($ZipItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne
            '33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1') {
        throw 'LOCAL_REVIEW_ZIP_IDENTITY_REQUIRED'
    }
    $LocalCheckpoint = 'NODE_RUNTIME'

    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_UNAVAILABLE' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath)) { throw 'NODE_RUNTIME_UNAVAILABLE' }
    $Entry = Join-Path $SnapshotRoot 'scripts/set-fr-2-email-pages-date.mjs'
    if (-not [IO.File]::Exists($Entry) -or -not [IO.Directory]::Exists($Candidate)) { throw 'LOCAL_INPUT_UNAVAILABLE' }
    $LocalCheckpoint = 'PRIVATE_CLOUDFLARE_INPUT'
    $Account = (Read-Host 'Paste the Cloudflare ACCOUNT ID for the account containing mushavo-budget-staging').Trim().ToLowerInvariant()
    if ($Account -notmatch '^[a-f0-9]{32}$') { throw 'INVALID_ACCOUNT_ID' }
    $PrivateToken = Read-Host 'Paste your staging Cloudflare token with Pages Edit and Workers Scripts Read here only (hidden)' -AsSecureString
    $LocalCheckpoint = 'PRIVATE_CHILD_START'
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
        if ($Key -match '^(NODE_OPTIONS|NODE_DEBUG|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_)') { $Start.EnvironmentVariables.Remove($Key) }
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
    $LocalCheckpoint = 'READ_ONLY_METADATA_AND_SAFE_RESULT'
    if (-not $Child.WaitForExit(120000)) { $Child.Kill(); throw 'PRIVATE_CHILD_TIMEOUT' }
    $SafeText = $OutputTask.GetAwaiter().GetResult()
    $PrivateErrors = $ErrorTask.GetAwaiter().GetResult()
    if ($SafeText.Length -gt 32768 -or $PrivateErrors.Length -ne 0) { throw 'PRIVATE_CHILD_OUTPUT_REVIEW_REQUIRED' }
    $Safe = $SafeText | ConvertFrom-Json
    $Allowed = @('stage_step', 'result', 'requests_attempted', 'local_44_file_review_artifact_unchanged', 'fresh_four_endpoint_baseline_passed', 'public_settings_prerequisites_passed', 'date_only_payload_verified', 'date_patch_attempted', 'date_patch_HTTP_accepted', 'fresh_channel_readback_verified', 'all_observed_channel_settings_except_date_compared_unchanged', 'selected_project_source_build_and_deployment_metadata_compared_unchanged', 'both_reviewed_dates_verified', 'no_write_needed', 'remote_state_may_require_review', 'reviewed_compatibility_date', 'channels', 'samples', 'concurrent_configuration_changes_excluded', 'raw_responses_values_hashes_identifiers_or_credentials_printed', 'token_saved_to_disk_or_environment', 'Zoho_file_accessed', 'email_or_provider_dispatch_attempted', 'upload_or_redeployment_attempted', 'SQL_or_Auth_requests', 'gateway_configuration_ready_verified', 'live_activation_approved', 'hosted_acceptance', 'findings_closed', 'production_or_native_changed', 'APK_update_deferred', 'checkpoint', 'problem_code', 'exit_code', 'checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
    if ($Safe.stage_step -ne 'FR.2.4.E5.3_EXACT_PAGES_DATE' -or $Safe.exit_code -ne $Child.ExitCode) { throw 'INVALID_RECEIPT' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceHashes
    Write-Host 'BEGIN SAFE PAGES DATE RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 8)
    Write-Host 'END SAFE PAGES DATE RESULT'
    Write-Host ('Exact Pages date exit code: ' + $Child.ExitCode)
    return [int]$Child.ExitCode
 } catch {
    Write-Host ([ordered]@{
        stage_step = 'FR.2.4.E5.3_EXACT_PAGES_DATE'
        result = 'PRIVATE_LOCAL_RUNNER_REVIEW_REQUIRED'
        checkpoint = $LocalCheckpoint
        source_hashes_verified = $SourceHashes
        problem_code = 'PRIVATE_LOCAL_RUNNER_FAILED'
        private_child_started = $ChildStarted
        date_patch_attempted = $null
        remote_state_may_require_review = $ChildStarted
        upload_or_redeployment_attempted = $false
        raw_errors_or_credentials_printed = $false
        exit_code = 1
    } | ConvertTo-Json -Depth 4)
    Write-Host 'Exact Pages date exit code: 1'
    return 1
} finally {
    if ($TokenPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($TokenPointer) }
    if ($PrivateToken) { $PrivateToken.Dispose() }
    $PlainToken = $null
    $PrivateInput = $null
    if ($Child) { if ($ChildStarted -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
}
