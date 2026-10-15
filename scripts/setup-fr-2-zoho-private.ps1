param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [Parameter(Mandatory=$true)][string]$ExpectedSender
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$ProgressPreference = 'SilentlyContinue'

# Windows DPAPI current-user encryption; never place credentials in this source tree.
function Convert-PrivateSecureToText([Security.SecureString]$Value) {
    $Pointer = [IntPtr]::Zero
    try {
        $Pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value)
        return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer)
    } finally {
        if ($Pointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer)
        }
    }
}
function Assert-PrivateUnlinkedPath([string]$Value) {
    $Probe = [IO.Path]::GetFullPath($Value)
    while ($Probe) {
        if (Test-Path -LiteralPath $Probe) {
            if (((Get-Item -LiteralPath $Probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'PRIVATE_PATH_LINKED'
            }
        }
        $Parent = [IO.Directory]::GetParent($Probe)
        if ($null -eq $Parent) { break }
        $Probe = $Parent.FullName
    }
}

function Invoke-PrivateZohoChild([string]$Node, [string]$Entry, [string]$Payload) {
    $Child = $null
    try {
        $Start = New-Object Diagnostics.ProcessStartInfo
        $Start.FileName = $Node
        if ($Entry.Contains('"')) { throw 'PRIVATE_ENTRY_PATH_INVALID' }
        $Start.Arguments = '"' + $Entry + '" --private-parent-pipe'
        $Start.WorkingDirectory = [IO.Path]::GetDirectoryName($Entry)
        $Start.UseShellExecute = $false
        $Start.CreateNoWindow = $true
        $Start.RedirectStandardInput = $true
        $Start.RedirectStandardOutput = $true
        $Start.RedirectStandardError = $true
        $Encoding = New-Object Text.UTF8Encoding($false)
        $Start.StandardOutputEncoding = $Encoding
        $Start.StandardErrorEncoding = $Encoding
        foreach ($Variable in @('NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','SSLKEYLOGFILE')) {
            $Start.EnvironmentVariables.Remove($Variable)
        }
        $Child = New-Object Diagnostics.Process
        $Child.StartInfo = $Start
        if (-not $Child.Start()) { throw 'PRIVATE_PROCESS_FAILED_OR_TIMED_OUT' }
        $ReadOutput = $Child.StandardOutput.ReadToEndAsync()
        $ReadErrors = $Child.StandardError.ReadToEndAsync()
        # BaseStream supports UTF-8 on Windows PowerShell 5.1 without the newer
        # ProcessStartInfo.StandardInputEncoding property.
        $InputBytes = $Encoding.GetBytes($Payload)
        try {
            $Child.StandardInput.BaseStream.Write($InputBytes, 0, $InputBytes.Length)
            $Child.StandardInput.BaseStream.Flush()
            $Child.StandardInput.BaseStream.Close()
        } finally { [Array]::Clear($InputBytes, 0, $InputBytes.Length) }
        if (-not $Child.WaitForExit(45000)) { $Child.Kill(); throw 'PRIVATE_PROCESS_FAILED_OR_TIMED_OUT' }
        $NodeText = $ReadOutput.GetAwaiter().GetResult()
        $NodeErrorText = $ReadErrors.GetAwaiter().GetResult()
        if ($NodeText.Length -gt 65536) { throw 'PRIVATE_PIPE_RESPONSE_INVALID' }
        $Answer = $NodeText | ConvertFrom-Json
        return [pscustomobject]@{child_exit_code=$Child.ExitCode;answer=$Answer}
    } finally {
        if ($null -ne $Child) {
            try { if (-not $Child.HasExited) { $Child.Kill() } } catch {}
            $Child.Dispose()
        }
        $Payload = $null; $NodeText = $null; $NodeErrorText = $null; $Answer = $null
    }
}

$Safe = [ordered]@{
    stage_step='FR.2.4.E3.3_PRIVATE_ZOHO_SETUP'
    result='LOCAL_PRIVATE_SETUP_REVIEW_REQUIRED'
    source_hashes_verified=0
    Windows_DPAPI_and_private_pipe_preflight_passed=$false
    requests_attempted=0
    authorization_code_exchange_attempted=$false
    new_refresh_token_received=$false
    refresh_token_check_passed=$false
    token_reported_exact_scopes=$false
    sender_account_and_outgoing_state_matched=$false
    send_mail_scope_or_delivery_verified=$false
    encrypted_credentials_saved=$false
    encryption='WINDOWS_DPAPI_CURRENT_USER'
    plaintext_secret_file_written=$false
    credentials_in_command_arguments_or_environment=$false
    email_dispatched=$false
    hosted_SQL_Auth_roles_or_Cloudflare_changed=$false
    hosted_acceptance=$false
    production_or_native_changed=$false
    findings_closed=@()
    provider_grant_may_exist_after_attempt=$false
    private_child_started=$false
    private_child_completed=$false
    problem_code=$null
    exit_code=1
}
$Child = $null; $VaultStream = $null; $VaultPath = $null
$VaultReady = $false; $Phase = 'LOCAL_PREFLIGHT_FAILED'
$ClientSecure = $null; $SecretSecure = $null; $CodeSecure = $null
$PrivateInput = $null; $PrivateAnswer = $null; $PrivateJson = $null
$Cipher = $null; $NodeText = $null; $NodeErrorText = $null
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    $SnapshotRoot = [IO.Path]::GetFullPath($SnapshotRoot)
    Assert-PrivateUnlinkedPath $SnapshotRoot
    $ManifestPath = Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-zoho-private-setup-source-manifest.json'
    $Manifest = Get-Content -LiteralPath $ManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($Manifest.stage_step -ne 'FR.2.4.E3.3_PRIVATE_ZOHO_SETUP') { throw 'MANIFEST_INVALID' }
    $Properties = @($Manifest.file_sha256.PSObject.Properties)
    if ($Properties.Count -ne 8) { throw 'MANIFEST_INVALID' }
    foreach ($Property in $Properties) {
        if ($Property.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Property.Name.Contains('..')) { throw 'MANIFEST_INVALID' }
        $SelectedPath = Join-Path $SnapshotRoot $Property.Name
        Assert-PrivateUnlinkedPath $SelectedPath
        if ((Get-FileHash -LiteralPath $SelectedPath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Property.Value) {
            throw 'SOURCE_HASH_MISMATCH'
        }
        $Safe.source_hashes_verified++
    }
    $Node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    $PrivateRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
    Assert-PrivateUnlinkedPath $PrivateRoot
    [IO.Directory]::CreateDirectory($PrivateRoot) | Out-Null
    Assert-PrivateUnlinkedPath $PrivateRoot
    $VaultPath = Join-Path $PrivateRoot ('zoho-sender-' + [guid]::NewGuid().ToString('N') + '.dpapi')
    $VaultStream = [IO.File]::Open($VaultPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
    $Probe = ConvertTo-SecureString 'mushavo-dpapi-preflight' -AsPlainText -Force
    try {
        $ProbeCipher = ConvertFrom-SecureString $Probe
        $ProbeBack = ConvertTo-SecureString $ProbeCipher
        try {
            if ((Convert-PrivateSecureToText $ProbeBack) -ne 'mushavo-dpapi-preflight') { throw 'ENCRYPTION_PREFLIGHT_FAILED' }
        } finally { $ProbeBack.Dispose() }
    } finally { $Probe.Dispose() }

    $Encoding = New-Object Text.UTF8Encoding($false)
    $Entry = Join-Path $SnapshotRoot 'scripts/fr-2-zoho-private-setup.mjs'
    $LocalProbe = Invoke-PrivateZohoChild $Node $Entry '{"mode":"offline-preflight"}'
    if ($LocalProbe.child_exit_code -ne 1 -or $LocalProbe.answer.receipt.problem_code -ne 'LOCAL_INPUT_INVALID' -or
        $LocalProbe.answer.receipt.requests_attempted -ne 0 -or $null -ne $LocalProbe.answer.private_configuration) {
        throw 'PRIVATE_PIPE_PREFLIGHT_FAILED'
    }
    $Safe.Windows_DPAPI_and_private_pipe_preflight_passed = $true
    Write-Host 'STAGING sender preparation only. No email, SQL or Cloudflare changes.'
    Write-Host 'Use the newly created Self Client for the notification sender Zoho account.'
    $ExpectedSender = $ExpectedSender.Trim().ToLowerInvariant()
    $ConfirmedSender = (Read-Host 'Confirm the intended sender mailbox address').Trim().ToLowerInvariant()
    if ($ConfirmedSender -ne $ExpectedSender -or $ExpectedSender -notmatch '^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$') {
        throw 'SENDER_CONFIRMATION_REQUIRED'
    }
    $ClientSecure = Read-Host 'Paste Client ID privately' -AsSecureString
    $SecretSecure = Read-Host 'Paste Client Secret privately' -AsSecureString
    Write-Host 'Now open Self Client > Generate Code in the API console.'
    Write-Host 'Scope: ZohoMail.accounts.READ,ZohoMail.messages.CREATE'
    Write-Host 'Description: Mushavo staging sender setup. Use a displayed code validity long enough to paste it immediately.'
    Write-Host 'Generate the authorization code now, then paste it at the hidden prompt below.'
    $CodeSecure = Read-Host 'Fresh Zoho authorization code (hidden; never paste it in chat)' -AsSecureString
    $PrivateInput = [ordered]@{mode='authorization_code';sender=$ExpectedSender
        clientId=(Convert-PrivateSecureToText $ClientSecure)
        clientSecret=(Convert-PrivateSecureToText $SecretSecure)
        code=(Convert-PrivateSecureToText $CodeSecure)} | ConvertTo-Json -Compress
    $Phase = 'PRIVATE_PROCESS_FAILED_OR_TIMED_OUT'
    $Safe.private_child_started = $true
    # Conservatively true if interrupted before the child's own receipt returns.
    $Safe.provider_grant_may_exist_after_attempt = $true
    $ChildResult = Invoke-PrivateZohoChild $Node $Entry $PrivateInput
    $PrivateInput = $null
    $PrivateAnswer = $ChildResult.answer
    $Safe.private_child_completed = $true
    if ($PrivateAnswer.receipt.stage_step -ne $Safe.stage_step) { throw 'PRIVATE_PIPE_RESPONSE_INVALID' }
    $Safe.requests_attempted = [int]$PrivateAnswer.receipt.requests_attempted
    if ($Safe.requests_attempted -lt 0 -or $Safe.requests_attempted -gt 3) { throw 'PRIVATE_PIPE_RESPONSE_INVALID' }
    foreach ($Flag in @('authorization_code_exchange_attempted','new_refresh_token_received',
        'refresh_token_check_passed','token_reported_exact_scopes','sender_account_and_outgoing_state_matched',
        'provider_grant_may_exist_after_attempt')) {
        $Safe[$Flag] = ($PrivateAnswer.receipt.$Flag -eq $true)
    }
    $Phase = 'ENCRYPTED_CREDENTIAL_SAVE_FAILED'
    if ($null -ne $PrivateAnswer.private_configuration) {
        $PrivateJson = $PrivateAnswer.private_configuration | ConvertTo-Json -Depth 5 -Compress
        $BundleSecure = ConvertTo-SecureString $PrivateJson -AsPlainText -Force
        try { $Cipher = ConvertFrom-SecureString $BundleSecure } finally { $BundleSecure.Dispose() }
        $VerifySecure = ConvertTo-SecureString $Cipher
        try {
            if ((Convert-PrivateSecureToText $VerifySecure) -cne $PrivateJson) { throw 'ENCRYPTED_CREDENTIAL_SAVE_FAILED' }
        } finally { $VerifySecure.Dispose() }
        $CipherBytes = $Encoding.GetBytes($Cipher)
        $VaultStream.Write($CipherBytes, 0, $CipherBytes.Length)
        $VaultStream.Flush($true)
        $VaultStream.Dispose(); $VaultStream = $null
        $DiskSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($VaultPath, $Encoding))
        try {
            if ((Convert-PrivateSecureToText $DiskSecure) -cne $PrivateJson) { throw 'ENCRYPTED_CREDENTIAL_SAVE_FAILED' }
        } finally { $DiskSecure.Dispose() }
        $VaultReady = $true
        $Safe.encrypted_credentials_saved = $true
    }
    $Phase = 'PROVIDER_RESPONSE_REVIEW_REQUIRED'
    $Allowed = @('LOCAL_INPUT_INVALID','REFRESH_TOKEN_NOT_RETURNED','OAUTH_SCOPE_REVIEW_REQUIRED',
        'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED','OAUTH_REGION_REVIEW_REQUIRED',
        'OAUTH_CODE_EXCHANGE_REJECTED_OR_UNAVAILABLE','REFRESH_CHECK_REJECTED_OR_UNAVAILABLE',
        'ACCOUNT_READ_REJECTED_OR_UNAVAILABLE','ACCOUNT_RESPONSE_REVIEW_REQUIRED',
        'SENDER_MAILBOX_NOT_MATCHED','SENDER_MAILBOX_STATE_REVIEW_REQUIRED','PRIVATE_INPUT_OR_PIPE_INVALID')
    if ($PrivateAnswer.receipt.exit_code -eq 0 -and $ChildResult.child_exit_code -eq 0 -and $VaultReady -and
        $Safe.refresh_token_check_passed -and $Safe.sender_account_and_outgoing_state_matched) {
        $Safe.result = 'ENCRYPTED_ZOHO_REFRESH_AND_SENDER_METADATA_SCOPED_PASS_NOT_DELIVERY'
        $Safe.exit_code = 0
    } elseif ($PrivateAnswer.receipt.problem_code -in $Allowed) {
        $Safe.problem_code = [string]$PrivateAnswer.receipt.problem_code
    } else { $Safe.problem_code = $Phase }
} catch {
    # Do not echo exception messages, stderr, provider bodies or private objects.
    if ($Phase -eq 'LOCAL_PREFLIGHT_FAILED' -and $_.Exception.Message -in @('WINDOWS_REQUIRED',
        'PRIVATE_PATH_LINKED','MANIFEST_INVALID','SOURCE_HASH_MISMATCH','ENCRYPTION_PREFLIGHT_FAILED',
        'SENDER_CONFIRMATION_REQUIRED','PRIVATE_PIPE_PREFLIGHT_FAILED')) { $Safe.problem_code = $_.Exception.Message }
    else { $Safe.problem_code = $Phase }
} finally {
    if ($null -ne $Child) {
        try { if (-not $Child.HasExited) { $Child.Kill() } } catch {}
        $Child.Dispose()
    }
    if ($null -ne $VaultStream) { $VaultStream.Dispose() }
    if (-not $VaultReady -and $VaultPath -and (Test-Path -LiteralPath $VaultPath)) {
        # No plaintext was written; remove only our own incomplete encrypted output.
        Remove-Item -LiteralPath $VaultPath -Force -ErrorAction SilentlyContinue
    }
    foreach ($Value in @($ClientSecure, $SecretSecure, $CodeSecure)) {
        if ($null -ne $Value) { $Value.Dispose() }
    }
    $PrivateInput = $null; $PrivateAnswer = $null; $PrivateJson = $null; $ChildResult = $null
    $Cipher = $null; $NodeText = $null; $NodeErrorText = $null
}
if ($VaultReady) { Write-Host ('Encrypted credentials saved locally: ' + $VaultPath) }
Write-Host 'BEGIN SAFE ZOHO RESULT'
Write-Host ($Safe | ConvertTo-Json -Depth 5)
Write-Host 'END SAFE ZOHO RESULT'
Write-Host ('Private Zoho setup exit code: ' + $Safe.exit_code)
Write-Host 'Return only the safe JSON and exit code. Keep the encrypted credential file private.'
return [int]$Safe.exit_code
