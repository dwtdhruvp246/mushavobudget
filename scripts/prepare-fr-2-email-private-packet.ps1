param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [string]$CandidateDirectory = 'C:\Users\HP\AppData\Local\Temp\mushavo-email-staging-review-3e602d4d6b8e4c1d8f870057905f5269',
    [string]$ZohoFile = 'C:\Users\HP\AppData\Local\MushavoBudget\PrivateStaging\zoho-sender-8abf4c376d8d4715aaa9387c066fde4c.dpapi'
)
$ErrorActionPreference = 'Stop'
$ExpectedSourceCount = 91
$Inputs = New-Object 'System.Collections.Generic.List[Security.SecureString]'
$OutputPath = $null
$CreatedThisRun = $false
$Saved = $false
$Stream = $null
$PrivateAnswer = $null
$Payload = $null
$PrivateJson = $null
$Packet = $null
$Zoho = $null
$Phase = 'SOURCE_VALIDATION'
$PrivateProblemCodes = @('LOCAL_PRIVATE_INPUT_REVIEW_REQUIRED','PUBLISHABLE_KEY_FORMAT_REQUIRED',
    'MODERN_SECRET_KEY_FORMAT_REQUIRED','RETAINED_PUBLIC_KEY_MISMATCH')
$Safe = [ordered]@{
    stage_step = 'FR.2.4.E5.4_PRIVATE_CREDENTIAL_PACKET'
    result = 'LOCAL_PRIVATE_PACKET_REVIEW_REQUIRED'
    source_hashes_verified = 0
    Windows_DPAPI_and_private_pipe_preflight_passed = $false
    retained_ZIP_identity_verified = $false
    retained_Zoho_DPAPI_decryption_passed = $false
    retained_public_key_matches_input = $false
    modern_key_formats_validated = $false
    retained_Zoho_snapshot_metadata_validated = $false
    independent_code_and_rate_peppers_generated = $false
    actual_gateway_constructor_validated = $false
    configured_variable_count = 0
    test_recipient_count = 0
    encrypted_packet_saved = $false
    encrypted_packet_readback_verified = $false
    existing_Zoho_file_compared_unchanged = $false
    existing_private_packets_overwritten = $false
    plaintext_secret_file_written = $false
    credentials_in_command_arguments_or_environment = $false
    Supabase_key_ownership_independently_verified = $false
    live_provider_credentials_or_delivery_verified = $false
    actual_hosted_requests = 0
    email_dispatched = $false
    Cloudflare_secrets_or_settings_changed = $false
    SQL_or_Auth_writes_performed = $false
    retained_ZIP_is_configuration_source_only = $true
    new_reviewed_Worker_upload_required = $true
    deployed = $false
    hosted_acceptance = $false
    live_activation_approved = $false
    production_or_native_changed = $false
    APK_update_deferred = $true
    findings_closed = @()
    problem_code = $null
    exit_code = 1
}
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
        if ($Child.ExitCode -ne 0 -and $Answer.receipt.problem_code -in $PrivateProblemCodes) {
            throw ([string]$Answer.receipt.problem_code)
        }
        if ($Child.ExitCode -ne 0 -or $Answer.receipt.exit_code -ne 0 -or
            $Answer.receipt.stage_step -ne 'FR.2.4.E5.4_PRIVATE_CREDENTIAL_PACKET') { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
}
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-modern-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.4_MODERN_KEYS_AND_PRIVATE_PREPARATION' -or
        $Rows.Count -ne $ExpectedSourceCount -or $Rows.Count -ne $Manifest.source_file_count) { throw 'SOURCE_MANIFEST_REVIEW_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or
            [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_MANIFEST_REVIEW_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_HASH_REVIEW_REQUIRED' }
        $Safe.source_hashes_verified++
    }
    $Phase = 'LOCAL_RUNTIME_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REVIEW_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or
        $Runtime.execPath.Contains('"') -or [IO.Path]::GetExtension($Runtime.execPath) -ine '.exe') { throw 'NODE_RUNTIME_REVIEW_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/fr-2-email-private-packet.mjs'
    if ($Entry.Contains('"')) { throw 'PRIVATE_ENTRY_REVIEW_REQUIRED' }
    $Probe = ConvertTo-SecureString 'mushavo-email-dpapi-preflight' -AsPlainText -Force
    $Inputs.Add($Probe)
    $ProbeCipher = ConvertFrom-SecureString $Probe
    $ProbeBack = ConvertTo-SecureString $ProbeCipher
    $Inputs.Add($ProbeBack)
    if ((Plain $ProbeBack) -cne 'mushavo-email-dpapi-preflight') { throw 'DPAPI_PREFLIGHT_REVIEW_REQUIRED' }
    $PipeProbe = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($PipeProbe.receipt.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $PipeProbe.receipt.actual_hosted_requests -ne 0 -or
        $null -ne $PipeProbe.private_configuration) { throw 'PRIVATE_PIPE_REVIEW_REQUIRED' }
    $Safe.Windows_DPAPI_and_private_pipe_preflight_passed = $true
    $Phase = 'RETAINED_ZIP_CONFIGURATION'
    $ZipPath = Join-Path $CandidateDirectory 'mushavo-email-staging-review.zip'
    Assert-Unlinked $ZipPath
    $ZipItem = Get-Item -LiteralPath $ZipPath
    if ($ZipItem.PSIsContainer -or $ZipItem.Length -gt 8388608 -or
        (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne
            '33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1') { throw 'RETAINED_ZIP_REVIEW_REQUIRED' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
    try {
        $ConfigEntries = @($Archive.Entries | Where-Object { $_.FullName -ceq 'config.js' })
        if ($Archive.Entries.Count -ne 44 -or $ConfigEntries.Count -ne 1 -or $ConfigEntries[0].Length -gt 16384) { throw 'ZIP_CONFIGURATION_REVIEW_REQUIRED' }
        $Reader = New-Object IO.StreamReader($ConfigEntries[0].Open(), [Text.Encoding]::UTF8)
        try { $Configuration = $Reader.ReadToEnd() } finally { $Reader.Dispose() }
    } finally { $Archive.Dispose() }
    $Safe.retained_ZIP_identity_verified = $true
    $Phase = 'RETAINED_ZOHO_CONFIGURATION'
    Assert-Unlinked $ZohoFile
    $ZohoItem = Get-Item -LiteralPath $ZohoFile
    if ($ZohoItem.PSIsContainer -or $ZohoItem.Length -lt 1 -or $ZohoItem.Length -gt 262144) { throw 'ZOHO_FILE_REVIEW_REQUIRED' }
    $ZohoHash = (Get-FileHash -LiteralPath $ZohoFile -Algorithm SHA256).Hash
    $ZohoSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($ZohoFile, [Text.Encoding]::UTF8))
    $Inputs.Add($ZohoSecure)
    $Zoho = (Plain $ZohoSecure) | ConvertFrom-Json
    $Safe.retained_Zoho_DPAPI_decryption_passed = $true
    $Phase = 'PRIVATE_KEY_INPUT'
    Write-Host 'Use existing keys from STAGING dczlddwbtgvfdujgcitb. Values stay in this private process.'
    $PublicSecure = Read-Host 'Paste the staging Publishable key (hidden)' -AsSecureString
    $Inputs.Add($PublicSecure)
    $ServiceSecure = Read-Host 'Paste the staging modern Secret key beginning sb_secret_ (hidden)' -AsSecureString
    $Inputs.Add($ServiceSecure)
    $RecipientsSecure = Read-Host 'Enter 1-10 existing staging account emails whose inboxes you control, comma-separated (hidden; no mail sent)' -AsSecureString
    $Inputs.Add($RecipientsSecure)
    $Recipients = @(((Plain $RecipientsSecure) -split ',') | ForEach-Object { $_.Trim().ToLowerInvariant() })
    $Payload = @{publishableKey=(Plain $PublicSecure);secretKey=(Plain $ServiceSecure);zoho=$Zoho;
        recipients=$Recipients;configuration=$Configuration;expectedWorkerSHA=$Manifest.expected_bundle_sha256.pages} | ConvertTo-Json -Depth 8 -Compress
    $Phase = 'PRIVATE_PACKET_VALIDATION'
    $PrivateAnswer = Private-Child $Runtime.execPath $Entry $Payload
    $Packet = $PrivateAnswer.private_configuration
    if ($PrivateAnswer.receipt.result -ne 'PRIVATE_PACKET_VALUES_VALIDATED_FOR_PARENT_ENCRYPTION_ONLY' -or
        $Packet.purpose -ne 'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY' -or $Packet.project -ne 'dczlddwbtgvfdujgcitb' -or
        @($Packet.env.PSObject.Properties).Count -ne 16) { throw 'PRIVATE_PACKET_REVIEW_REQUIRED' }
    foreach ($Flag in @('retained_public_key_matches_input','modern_key_formats_validated','retained_Zoho_snapshot_metadata_validated',
        'independent_code_and_rate_peppers_generated','actual_gateway_constructor_validated')) {
        if ($PrivateAnswer.receipt.$Flag -ne $true) { throw 'PRIVATE_PACKET_REVIEW_REQUIRED' }
        $Safe[$Flag] = $true
    }
    $Safe.configured_variable_count = [int]$PrivateAnswer.receipt.configured_variable_count
    $Safe.test_recipient_count = [int]$PrivateAnswer.receipt.test_recipient_count
    $Phase = 'ENCRYPTED_PACKET_SAVE'
    $PrivateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
    Assert-Unlinked $PrivateRoot
    [IO.Directory]::CreateDirectory($PrivateRoot) | Out-Null
    Assert-Unlinked $PrivateRoot
    $OutputPath = Join-Path $PrivateRoot ('email-gateway-' + [guid]::NewGuid().ToString('N') + '.dpapi')
    $PrivateJson = $Packet | ConvertTo-Json -Depth 8 -Compress
    $PacketSecure = ConvertTo-SecureString $PrivateJson -AsPlainText -Force
    $Inputs.Add($PacketSecure)
    $Cipher = ConvertFrom-SecureString $PacketSecure
    $Stream = [IO.File]::Open($OutputPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $CreatedThisRun = $true
    $Encoding = New-Object Text.UTF8Encoding($false)
    $CipherBytes = $Encoding.GetBytes($Cipher)
    $Stream.Write($CipherBytes, 0, $CipherBytes.Length)
    $Stream.Flush($true)
    $Stream.Dispose(); $Stream = $null
    $DiskSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($OutputPath, $Encoding))
    $Inputs.Add($DiskSecure)
    if ((Plain $DiskSecure) -cne $PrivateJson) { throw 'ENCRYPTED_PACKET_READBACK_REQUIRED' }
    if ((Get-FileHash -LiteralPath $ZohoFile -Algorithm SHA256).Hash -cne $ZohoHash) { throw 'ZOHO_FILE_CHANGED_REVIEW_REQUIRED' }
    $Safe.existing_Zoho_file_compared_unchanged = $true
    $Safe.encrypted_packet_saved = $true
    $Safe.encrypted_packet_readback_verified = $true
    $Safe.result = 'LOCAL_DPAPI_MODERN_KEY_PACKET_PREPARED_NOT_PROVIDER_OR_DEPLOYMENT_ACCEPTANCE'
    $Safe.exit_code = 0
    $Saved = $true
} catch {
    if ($_.Exception.Message -in $PrivateProblemCodes) { $Safe.problem_code = [string]$_.Exception.Message }
    else { $Safe.problem_code = $Phase }
} finally {
    if ($Stream) { $Stream.Dispose() }
    if ($CreatedThisRun -and -not $Saved -and $OutputPath) { Remove-Item -LiteralPath $OutputPath -Force -ErrorAction SilentlyContinue }
    foreach ($Value in $Inputs) { if ($Value) { $Value.Dispose() } }
    $Payload = $null; $PrivateJson = $null; $PrivateAnswer = $null; $Packet = $null; $Zoho = $null
    $Recipients = $null; $Configuration = $null; $Cipher = $null
}
if ($Saved) { Write-Host ('Encrypted credential packet saved locally: ' + $OutputPath) }
Write-Host 'BEGIN SAFE PRIVATE PACKET RESULT'
Write-Host ($Safe | ConvertTo-Json -Depth 5)
Write-Host 'END SAFE PRIVATE PACKET RESULT'
Write-Host ('Private credential packet exit code: ' + $Safe.exit_code)
Write-Host 'Return only safe result JSON and exit code. Keep the encrypted file and all keys private.'
return [int]$Safe.exit_code
