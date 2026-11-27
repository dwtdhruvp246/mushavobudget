param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [Parameter(Mandatory=$true)][string]$CandidateDirectory,
    [Parameter(Mandatory=$true)][string]$PacketFile
)
$ErrorActionPreference = 'Stop'
$Inputs = New-Object 'System.Collections.Generic.List[Security.SecureString]'
$Phase = 'SOURCE_IDENTITIES'
$SourceCount = 0
$Payload = $null
$Packet = $null
$Safe = $null
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
        if (-not $Child.WaitForExit(120000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS' -or
            $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
            $Answer.requests_attempted -lt 0 -or $Answer.requests_attempted -gt 7) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
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
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot `
        'docs/security-audit/security-fr-2-email-private-readiness-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Rows = @($Manifest.file_sha256.PSObject.Properties)
    if ($Manifest.stage_step -ne 'FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS' -or
        $Rows.Count -ne $Manifest.source_file_count -or $Rows.Count -lt 20) { throw 'SOURCE_MANIFEST_REQUIRED' }
    foreach ($Row in $Rows) {
        if ($Row.Name -notmatch '^[A-Za-z0-9_./-]+$' -or $Row.Name.Contains('..') -or
            [IO.Path]::IsPathRooted($Row.Name) -or $Row.Value -cnotmatch '^[a-f0-9]{64}$') { throw 'SOURCE_PATH_REQUIRED' }
        $File = Join-Path $SnapshotRoot $Row.Name
        Assert-Unlinked $File
        if ((Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Row.Value) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $SourceCount++
    }
    $Phase = 'PRIVATE_PIPE_PREFLIGHT'
    $RuntimeLines = @(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
    if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
    $Runtime = ($RuntimeLines -join '') | ConvertFrom-Json
    if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or
        $Runtime.execPath.Contains('"') -or [IO.Path]::GetExtension($Runtime.execPath) -ine '.exe') { throw 'NODE_RUNTIME_REQUIRED' }
    $Entry = Join-Path $SnapshotRoot 'scripts/check-fr-2-email-private-readiness.mjs'
    if ($Entry.Contains('"')) { throw 'PRIVATE_ENTRY_REQUIRED' }
    $Preflight = Private-Child $Runtime.execPath $Entry '{"preflight":true}'
    if ($Preflight.result -ne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Preflight.requests_attempted -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
    $Phase = 'LOCAL_MODERN_ZIP'
    $Zip = Join-Path $CandidateDirectory 'mushavo-email-modern-review.zip'
    Assert-Unlinked $Zip
    if ((Get-Item -LiteralPath $Zip).Length -gt 8388608 -or
        (Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -cne
        'cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24') { throw 'MODERN_ZIP_REQUIRED' }
    $Phase = 'PRIVATE_PACKET_DECRYPTION'
    Assert-Unlinked $PacketFile
    $PacketItem = Get-Item -LiteralPath $PacketFile
    if ($PacketItem.PSIsContainer -or $PacketItem.Length -lt 1 -or $PacketItem.Length -gt 262144) { throw 'PRIVATE_PACKET_REQUIRED' }
    $PacketHash = (Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash
    $PacketSecure = ConvertTo-SecureString ([IO.File]::ReadAllText($PacketFile, [Text.Encoding]::UTF8))
    $Inputs.Add($PacketSecure)
    $Packet = (Plain $PacketSecure) | ConvertFrom-Json
    if ($Packet.purpose -ne 'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY' -or
        $Packet.project -ne 'dczlddwbtgvfdujgcitb') { throw 'PRIVATE_PACKET_SCOPE_REQUIRED' }
    $Phase = 'PRIVATE_CLOUDFLARE_INPUT'
    $AccountSecure = Read-Host 'Paste the Cloudflare ACCOUNT ID used for mushavo-budget-staging (hidden; not the Supabase project reference)' -AsSecureString
    $Inputs.Add($AccountSecure)
    $TokenSecure = Read-Host 'Paste the Cloudflare API token used for the earlier successful read-only checks (hidden)' -AsSecureString
    $Inputs.Add($TokenSecure)
    $Payload = @{account=((Plain $AccountSecure).Trim().ToLowerInvariant());token=((Plain $TokenSecure).Trim());
        candidate=$CandidateDirectory;packet=$Packet} | ConvertTo-Json -Depth 8 -Compress
    $Phase = 'SEVEN_FIXED_READ_ONLY_REQUESTS'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    $Phase = 'PRIVATE_PACKET_UNCHANGED_READBACK'
    if ((Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash -cne $PacketHash) { throw 'PRIVATE_PACKET_CHANGED' }
    if ((Get-FileHash -LiteralPath $Zip -Algorithm SHA256).Hash.ToLowerInvariant() -cne
        'cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24') { throw 'MODERN_ZIP_CHANGED' }
    $Allowed = @('stage_step','result','requests_attempted','local_modern_ZIP_and_Windows_receipt_verified',
        'private_packet_scope_and_constructor_validated','retained_public_key_matches_packet','staging_Pages_project_in_selected_account',
        'limiter_Worker_SQLite_namespace_and_disabled_public_URLs_verified','both_channels_public_settings_match',
        'remaining13_gateway_variables_absent_in_both_channels','negative_API_key_control_rejected',
        'publishable_key_accepted_by_staging_Auth_settings','modern_secret_key_accepted_by_staging_Auth_settings',
        'API_key_acceptance_scope','service_role_DB_privileges_or_user_JWT_authorization_verified',
        'Zoho_refresh_or_email_delivery_verified','settings_values_rows_identifiers_credentials_or_hashes_printed',
        'credential_packet_changed','Cloudflare_secrets_SQL_Auth_accounts_or_settings_changed','Auth_sessions_created',
        'application_routines_invoked','email_dispatched','uploaded_or_deployed','live_activation_approved',
        'hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','channels','samples',
        'checkpoint','problem_code','exit_code','checked_UTC')
    if (@($Safe.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_REQUIRED' }
    $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue $SourceCount
    $Safe | Add-Member -NotePropertyName DPAPI_packet_and_modern_ZIP_compared_unchanged -NotePropertyValue $true
    Write-Host 'BEGIN SAFE PRIVATE READINESS RESULT'
    Write-Host ($Safe | ConvertTo-Json -Depth 8)
    Write-Host 'END SAFE PRIVATE READINESS RESULT'
    Write-Host ('Private read-only readiness exit code: ' + $Safe.exit_code)
    return [int]$Safe.exit_code
} catch {
    Write-Host ([ordered]@{
        stage_step = 'FR.2.4.E5.6_PRIVATE_READ_ONLY_READINESS'
        result = 'PRIVATE_LOCAL_READINESS_RUNNER_REVIEW_REQUIRED'
        local_checkpoint = $Phase
        source_hashes_verified = $SourceCount
        raw_errors_or_credentials_printed = $false
        settings_upload_or_SQL_write_attempted = $false
        email_dispatched = $false
        exit_code = 1
    } | ConvertTo-Json -Depth 4)
    return 1
} finally {
    foreach ($Value in $Inputs) { if ($Value) { $Value.Dispose() } }
    $Payload = $null; $Packet = $null; $Safe = $null
}
