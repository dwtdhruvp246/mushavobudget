param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [string]$AcceptedZIP = 'C:\Users\HP\AppData\Local\Temp\mushavo-email-modern-review-365a33690028462489520db3e85c4b90\mushavo-email-modern-review.zip',
    [switch]$GenerateStagingVAPID
)
$ErrorActionPreference = 'Stop'
$Stage = 'FR.2.4.E5.14_BATCH_A_LOCAL_EDGE_CONFIGURATION_PREPARATION'
$Inputs = New-Object 'System.Collections.Generic.List[Security.SecureString]'
$Phase = 'SOURCE_IDENTITIES'
$Payload = $null
$Answer = $null
$PrivateJson = $null
$OutputPath = $null
$CreatedThisRun = $false
$Saved = $false
$Stream = $null
$Safe = [pscustomobject]@{stage_step=$Stage;batch='A';result='LOCAL_BATCH_A_RUNNER_REVIEW_REQUIRED';actual_hosted_requests=0;exit_code=1}
$Local = [ordered]@{source_hashes_verified=0;retained_ZIP_identity_verified=$false;retained_Pages_Worker_identity_verified=$false;
    Windows_DPAPI_and_private_pipe_preflight_passed=$false;encrypted_packet_saved=$false;encrypted_packet_readback_verified=$false;
    existing_private_packets_overwritten=$false;plaintext_secret_file_written=$false;credentials_in_arguments_or_environment=$false;
    frontend_live_key_verified=$false;batch_run_finished=$false}
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
        if (-not $Child.WaitForExit(15000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.receipt.stage_step -ne 'FR.2.4.E5.14_BATCH_A_LOCAL_EDGE_CONFIGURATION_PREPARATION' -or
            $Answer.receipt.batch -ne 'A' -or $Answer.receipt.exit_code -notin @(0,1,2) -or
            $Child.ExitCode -ne $Answer.receipt.exit_code -or $Answer.receipt.actual_hosted_requests -ne 0 -or
            @($Answer.PSObject.Properties | Where-Object { $_.Name -notin @('receipt','private_configuration') }).Count -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $AllowedReceipt = @('stage_step','batch','result','batch_checks_complete','fresh_Edge_source_package_verified','package_files','package_SHA256','retained_ZIP_staging_configuration_validated','retained_frontend_VAPID_key_present','input_availability','VAPID_pair_mathematically_validated','VAPID_pair_generated_locally','VAPID_subject_syntax_validated','CurrencyAPI_input_syntax_validated','CurrencyAPI_provider_validity_verified','frontend_VAPID_relation','frontend_candidate_update_required','independent_staging_caller_secret_generated','configured_variable_count','existing_private_packets_accessed','existing_credentials_rotated','actual_hosted_requests','application_or_Edge_functions_invoked','email_push_or_FX_dispatched','frontend_ZIP_or_runtime_source_modified','uploaded_or_deployed','settings_or_schedules_changed','readiness_approved','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','input_issues','checkpoint','problem_code','exit_code')
        if (@($Answer.receipt.PSObject.Properties | Where-Object { $_.Name -notin $AllowedReceipt }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
function Read-Available([string]$Prompt) {
    $AnswerText = (Read-Host $Prompt).Trim().ToUpperInvariant()
    if ($AnswerText -eq 'Y') { return $true }
    if ($AnswerText -eq 'N') { return $false }
    throw 'AVAILABILITY_Y_OR_N_REQUIRED'
}
function Read-Hidden([string]$Prompt) {
    $Value = Read-Host $Prompt -AsSecureString
    $Inputs.Add($Value)
    return ((Plain $Value).Trim())
}
function Read-Entry($Entry,[int]$Limit) {
    if ($Entry.Length -lt 1 -or $Entry.Length -gt $Limit) { throw 'ZIP_ENTRY_REVIEW_REQUIRED' }
    $InputStream = $Entry.Open()
    $Memory = New-Object IO.MemoryStream
    try {
        $Buffer = New-Object byte[] 4096
        while (($Count = $InputStream.Read($Buffer,0,$Buffer.Length)) -gt 0) {
            if ($Memory.Length + $Count -gt $Limit) { throw 'ZIP_ENTRY_REVIEW_REQUIRED' }
            $Memory.Write($Buffer,0,$Count)
        }
        return ,($Memory.ToArray())
    } finally { $InputStream.Dispose(); $Memory.Dispose() }
}
Write-Host 'BATCH A STARTED: local ZIP/package checks, input availability, key validation and encrypted candidate preparation.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-edge-batch-a-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne $Stage -or $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 25) { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $Local.source_hashes_verified++
    }
    $Phase = 'PRIVATE_PIPE_AND_DPAPI_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or $Runtime.execPath.Contains('"')) { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/prepare-fr-2-email-edge-batch-a.mjs'
    if ($Entry.Contains('"')) { throw 'PRIVATE_ENTRY_REVIEW_REQUIRED' }
    $Probe = ConvertTo-SecureString 'mushavo-batch-a-dpapi-probe' -AsPlainText -Force
    $Inputs.Add($Probe)
    $ProbeBack = ConvertTo-SecureString (ConvertFrom-SecureString $Probe)
    $Inputs.Add($ProbeBack)
    if ((Plain $ProbeBack) -cne 'mushavo-batch-a-dpapi-probe') { throw 'DPAPI_PREFLIGHT_REQUIRED' }
    $ProbeAnswer = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($ProbeAnswer.receipt.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $null -ne $ProbeAnswer.private_configuration) { throw 'PRIVATE_PIPE_REQUIRED' }
    $Local.Windows_DPAPI_and_private_pipe_preflight_passed=$true
    $Phase = 'RETAINED_ACCEPTED_ZIP'
    Assert-Unlinked $AcceptedZIP
    $ZipItem = Get-Item -LiteralPath $AcceptedZIP
    if ($ZipItem.PSIsContainer -or $ZipItem.Length -gt 8388608 -or (Get-FileHash -LiteralPath $AcceptedZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24') { throw 'ACCEPTED_ZIP_IDENTITY_REQUIRED' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [IO.Compression.ZipFile]::OpenRead($AcceptedZIP)
    try {
        $Configs = @($Archive.Entries | Where-Object { $_.FullName -ceq 'config.js' })
        $Workers = @($Archive.Entries | Where-Object { $_.FullName -ceq '_worker.js' })
        if ($Archive.Entries.Count -ne 44 -or $Configs.Count -ne 1 -or $Workers.Count -ne 1) { throw 'ZIP_CONTENT_REVIEW_REQUIRED' }
        $Configuration = [Text.Encoding]::UTF8.GetString((Read-Entry $Configs[0] 16384))
        $WorkerBytes = Read-Entry $Workers[0] 2097152
        $Hasher = [Security.Cryptography.SHA256]::Create()
        try { $WorkerHash = [BitConverter]::ToString($Hasher.ComputeHash($WorkerBytes)).Replace('-','').ToLowerInvariant() } finally { $Hasher.Dispose() }
        if ($WorkerHash -cne 'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651') { throw 'WORKER_IDENTITY_REQUIRED' }
    } finally { $Archive.Dispose() }
    if ((Get-FileHash -LiteralPath $AcceptedZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24') { throw 'ACCEPTED_ZIP_CHANGED' }
    $Local.retained_ZIP_identity_verified=$true
    $Local.retained_Pages_Worker_identity_verified=$true
    $Phase = 'EDGE_PACKAGE_AND_FRONTEND_CONFIGURATION'
    $Payload = @{action='artifacts';configuration=$Configuration} | ConvertTo-Json -Compress
    $ArtifactAnswer = Private-Child $Runtime.execPath $Entry $Payload
    if ($ArtifactAnswer.receipt.exit_code -ne 0 -or $ArtifactAnswer.receipt.result -ne 'LOCAL_BATCH_A_PUBLIC_ARTIFACTS_CHECKED' -or $null -ne $ArtifactAnswer.private_configuration) { $Safe=$ArtifactAnswer.receipt; throw 'ARTIFACT_CHECK_REQUIRED' }
    $Phase = 'INPUT_AVAILABILITY'
    Write-Host 'Answer availability only first. No Management token is needed; no hosted service is contacted.'
    $VAPID = $null
    $CurrencyKey = $null
    if ($GenerateStagingVAPID) {
        Write-Host 'This mode generates the new staging push key pair locally after validating these two inputs.'
        Write-Host 'Prompt 1: an email inbox you monitor, such as admin@your-domain.com. No password is required.'
        Write-Host 'Prompt 2: your CurrencyAPI dashboard key for staging use. Both inputs are hidden.'
        $Phase = 'PRIVATE_CREDENTIAL_INPUT'
        $ContactEmail = Read-Hidden '1 of 2: monitored contact EMAIL ADDRESS only (hidden)'
        $CurrencyKey = Read-Hidden '2 of 2: CurrencyAPI dashboard key for staging (hidden)'
        $Payload = @{action='generate-candidate';configuration=$Configuration;subject=('mailto:' + $ContactEmail);currencyKey=$CurrencyKey} | ConvertTo-Json -Depth 5 -Compress
    } else {
        $HaveVAPID = Read-Available 'Do you already have a SEPARATE STAGING VAPID public/private key pair? Y/N'
        $HaveCurrency = Read-Available 'Do you have a CurrencyAPI key available for STAGING use? Y/N'
        if ($HaveVAPID -and $HaveCurrency) {
            $Phase = 'PRIVATE_CREDENTIAL_INPUT'
            Write-Host 'Enter existing staging values only at the hidden prompts. The frontend ZIP is checked but stays unchanged.'
            $VAPID = @{publicKey=(Read-Hidden 'Staging VAPID public key (hidden)');privateKey=(Read-Hidden 'Matching staging VAPID private key (hidden)');subject=(Read-Hidden 'VAPID contact subject: mailto:address or https: URI (hidden)')}
            $CurrencyKey = Read-Hidden 'CurrencyAPI key for staging (hidden)'
        }
        $Payload = @{action='candidate';configuration=$Configuration;availability=@{separate_staging_VAPID_pair=$HaveVAPID;CurrencyAPI_key=$HaveCurrency};vapid=$VAPID;currencyKey=$CurrencyKey} | ConvertTo-Json -Depth 5 -Compress
    }
    $Phase = 'BATCHED_LOCAL_VALIDATION'
    $Answer = Private-Child $Runtime.execPath $Entry $Payload
    $Safe = $Answer.receipt
    if ($Safe.exit_code -eq 2) {
        if ($null -ne $Answer.private_configuration) { throw 'UNEXPECTED_PRIVATE_PACKET' }
    } elseif ($Safe.exit_code -eq 0) {
        $Packet = $Answer.private_configuration
        $ExpectedNames = @('APP_ORIGIN','VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','VAPID_SUBJECT','CURRENCYAPI_API_KEY','CURRENCY_SYNC_SECRET')
        if ($Packet.purpose -ne 'MUSHAVO_STAGING_EDGE_CONFIGURATION_CANDIDATE_ONLY' -or $Packet.project -ne 'dczlddwbtgvfdujgcitb' -or $Packet.origin -ne 'https://mushavo-budget-staging.pages.dev' -or @($Packet.env.PSObject.Properties).Count -ne 6 -or @($Packet.env.PSObject.Properties | Where-Object { $_.Name -notin $ExpectedNames }).Count -ne 0 -or $Packet.hosted_write_approved -ne $false) { throw 'PRIVATE_CANDIDATE_REQUIRED' }
        $Phase = 'NEW_DPAPI_PACKET_AND_READBACK'
        $PrivateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
        Assert-Unlinked $PrivateRoot
        [IO.Directory]::CreateDirectory($PrivateRoot) | Out-Null
        Assert-Unlinked $PrivateRoot
        $OutputPath = Join-Path $PrivateRoot ('edge-configuration-batchA-' + [guid]::NewGuid().ToString('N') + '.dpapi')
        $PrivateJson = $Packet | ConvertTo-Json -Depth 6 -Compress
        $PacketSecure = ConvertTo-SecureString $PrivateJson -AsPlainText -Force
        $Inputs.Add($PacketSecure)
        $Cipher = ConvertFrom-SecureString $PacketSecure
        $CipherBytes = [Text.Encoding]::UTF8.GetBytes($Cipher)
        $Stream = [IO.File]::Open($OutputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
        $CreatedThisRun=$true
        $Stream.Write($CipherBytes,0,$CipherBytes.Length)
        $Stream.Flush($true)
        $Stream.Dispose();$Stream=$null
        $DiskSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($OutputPath,[Text.Encoding]::UTF8))
        $Inputs.Add($DiskSecure)
        if ((Plain $DiskSecure) -cne $PrivateJson) { throw 'ENCRYPTED_READBACK_REQUIRED' }
        $Saved=$true
        $Local.encrypted_packet_saved=$true
        $Local.encrypted_packet_readback_verified=$true
        $Safe.result='LOCAL_BATCH_A_COMPLETE_PRIVATE_CANDIDATE_SAVED_NOT_DEPLOYED'
        $Safe.checkpoint='COMPLETE'
    }
} catch {
    $Safe.exit_code=1
    $Safe.result='LOCAL_BATCH_A_RUNNER_REVIEW_REQUIRED'
    $Safe | Add-Member -NotePropertyName problem_code -NotePropertyValue $Phase -Force
} finally {
    if ($Stream) { $Stream.Dispose() }
    if ($CreatedThisRun -and -not $Saved -and $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue }
    foreach ($Value in $Inputs) { if ($Value) { $Value.Dispose() } }
    $Local.batch_run_finished=$true
    foreach ($Key in $Local.Keys) { $Safe | Add-Member -NotePropertyName $Key -NotePropertyValue $Local[$Key] -Force }
    $Payload=$null;$PrivateJson=$null;$Packet=$null;$Answer=$null;$VAPID=$null;$CurrencyKey=$null;$ContactEmail=$null;$Configuration=$null;$Cipher=$null
}
if ($Saved) { Write-Host ('New encrypted candidate saved locally: ' + $OutputPath) }
Write-Host 'BEGIN SAFE BATCH A RESULT'
Write-Host ($Safe | ConvertTo-Json -Depth 6)
Write-Host 'END SAFE BATCH A RESULT'
if ($Safe.exit_code -eq 0) { Write-Host 'BATCH A COMPLETE: local candidate prepared; hosted installation and activation remain pending.' }
elseif ($Safe.exit_code -eq 2) { Write-Host 'BATCH A CHECKS FINISHED: inputs are missing or need review; no private candidate saved.' }
else { Write-Host 'BATCH A STOPPED FOR LOCAL REVIEW: return the safe result; do not repeat unchanged.' }
Write-Host ('Batch A exit code: ' + $Safe.exit_code)
return [int]$Safe.exit_code
