param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [string]$AcceptedZIP = 'C:\Users\HP\AppData\Local\Temp\mushavo-email-modern-review-365a33690028462489520db3e85c4b90\mushavo-email-modern-review.zip',
    [string]$PacketPath = ''
)
$ErrorActionPreference = 'Stop'
$Stage = 'FR.2.4.E5.15_BATCH_B_FRONTEND_AND_ROLLOUT_PREPARATION'
$Phase = 'SOURCE_IDENTITIES'
$PacketSecure = $null
$PacketText = $null
$Packet = $null
$Payload = $null
$Safe = [pscustomobject]@{stage_step=$Stage;batch='B';result='LOCAL_BATCH_B_RUNNER_REVIEW_REQUIRED';actual_hosted_requests=0;exit_code=1}
$Local = [ordered]@{source_hashes_verified=0;Batch_A_encrypted_packet_read_only=$false;
    Windows_dotNET_44_entry_readback_verified=$false;Windows_dotNET_43_other_files_identical=$false;
    Windows_dotNET_frontend_key_matches_private_candidate=$false;encrypted_packet_unchanged=$false;
    private_values_or_email_printed=$false;credentials_in_arguments_or_environment=$false;batch_run_finished=$false}
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
        if (-not $Child.WaitForExit(15000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Output = $ReadOutput.GetAwaiter().GetResult()
        $Errors = $ReadErrors.GetAwaiter().GetResult()
        if ($Output.Length -gt 131072 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Answer = $Output | ConvertFrom-Json
        if ($Answer.stage_step -ne 'FR.2.4.E5.15_BATCH_B_FRONTEND_AND_ROLLOUT_PREPARATION' -or
            $Answer.batch -ne 'B' -or $Answer.exit_code -notin @(0,1) -or
            $Child.ExitCode -ne $Answer.exit_code -or $Answer.actual_hosted_requests -ne 0) { throw 'PRIVATE_CHILD_REVIEW_REQUIRED' }
        $Allowed = @('stage_step','batch','result','Batch_A_private_candidate_validated','configured_variable_count','retained_ZIP_identity_verified','Edge_package_identity_verified','public_files','files_except_config_byte_identical','only_config_js_changed','Worker_identity_preserved','frontend_candidate_VAPID_matches_private_candidate','new_ZIP_SHA256','portable_ZIP_readback_verified','rollout_checklist_written','retained_ZIP_unchanged','private_credentials_written_to_public_artifacts','existing_credentials_rotated','CurrencyAPI_provider_validity_verified','actual_hosted_requests','application_or_Edge_functions_invoked','email_push_or_FX_dispatched','uploaded_or_deployed','settings_or_schedules_changed','frontend_live_key_verified','readiness_approved','live_activation_approved','hosted_acceptance','production_or_native_changed','APK_update_deferred','findings_closed','checkpoint','problem_code','exit_code')
        if (@($Answer.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0) { throw 'UNEXPECTED_RECEIPT_FIELDS' }
        return $Answer
    } finally {
        if ($Bytes) { [Array]::Clear($Bytes, 0, $Bytes.Length) }
        if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
        $Text = $null; $Output = $null; $Errors = $null; $Answer = $null
    }
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

Write-Host 'BATCH B STARTED: reuse encrypted Batch A configuration, add the public push key to a new ZIP, verify it and prepare the rollout checklist.'
try {
    if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
    Assert-Unlinked $SnapshotRoot
    $Manifest = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-fr-2-email-edge-batch-b-source-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
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
    $Entry = Join-Path $SnapshotRoot 'scripts/prepare-fr-2-email-edge-batch-b.mjs'
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
    $Payload = @{action='prepare';packet=$Packet;acceptedZIPPath=$AcceptedZIP} | ConvertTo-Json -Depth 8 -Compress
    $Phase = 'NEW_FRONTEND_CANDIDATE'
    $Safe = Private-Child $Runtime.execPath $Entry $Payload
    if ($Safe.exit_code -ne 0) { throw 'BATCH_B_LOCAL_PREPARATION_REQUIRED' }
    $Phase = 'INDEPENDENT_WINDOWS_ZIP_READBACK'
    $OutputZIP = Join-Path $SnapshotRoot 'batch-b-frontend/mushavo-email-push-review.zip'
    Assert-Unlinked $OutputZIP
    if ((Get-FileHash -LiteralPath $OutputZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Safe.new_ZIP_SHA256) { throw 'NEW_ZIP_IDENTITY_REQUIRED' }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $Old = [IO.Compression.ZipFile]::OpenRead($AcceptedZIP)
    $New = $null
    try {
        $New = [IO.Compression.ZipFile]::OpenRead($OutputZIP)
        if ($Old.Entries.Count -ne 44 -or $New.Entries.Count -ne 44) { throw 'PUBLIC_SET_REQUIRED' }
        $Seen = New-Object 'System.Collections.Generic.HashSet[string]'
        $Unchanged = 0
        foreach ($EntryNew in $New.Entries) {
            if (-not $Seen.Add($EntryNew.FullName)) { throw 'DUPLICATE_ZIP_ENTRY' }
            $Prior = @($Old.Entries | Where-Object { $_.FullName -ceq $EntryNew.FullName })
            if ($Prior.Count -ne 1) { throw 'ZIP_ENTRY_IDENTITY_REQUIRED' }
            $NewBytes = Read-Entry $EntryNew 2097152
            $OldBytes = Read-Entry $Prior[0] 2097152
            if ($EntryNew.FullName -ceq 'config.js') {
                $NewText = [Text.Encoding]::UTF8.GetString($NewBytes)
                $OldText = [Text.Encoding]::UTF8.GetString($OldBytes)
                $NewMatch = [regex]::Match($NewText,'^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$')
                $OldMatch = [regex]::Match($OldText,'^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$')
                if (-not $NewMatch.Success -or -not $OldMatch.Success) { throw 'PUBLIC_CONFIG_REQUIRED' }
                $NewConfig = $NewMatch.Groups[1].Value | ConvertFrom-Json
                $OldConfig = $OldMatch.Groups[1].Value | ConvertFrom-Json
                if (@($NewConfig.PSObject.Properties).Count -ne 3 -or $NewConfig.supabaseUrl -cne 'https://dczlddwbtgvfdujgcitb.supabase.co' -or
                    $NewConfig.supabaseUrl -cne $OldConfig.supabaseUrl -or $NewConfig.supabasePublishableKey -cne $OldConfig.supabasePublishableKey -or
                    $OldConfig.vapidPublicKey -cne '' -or $NewConfig.vapidPublicKey -cne $Packet.env.VAPID_PUBLIC_KEY) { throw 'FRONTEND_KEY_READBACK_REQUIRED' }
                $Local.Windows_dotNET_frontend_key_matches_private_candidate=$true
            } else {
                $Hasher = [Security.Cryptography.SHA256]::Create()
                try {
                    $NewHash = [BitConverter]::ToString($Hasher.ComputeHash($NewBytes))
                    $OldHash = [BitConverter]::ToString($Hasher.ComputeHash($OldBytes))
                } finally { $Hasher.Dispose() }
                if ($NewHash -cne $OldHash) { throw 'OTHER_PUBLIC_FILE_CHANGED' }
                $Unchanged++
            }
        }
        if ($Unchanged -ne 43 -or -not $Local.Windows_dotNET_frontend_key_matches_private_candidate) { throw 'INDEPENDENT_ZIP_READBACK_REQUIRED' }
        $Local.Windows_dotNET_43_other_files_identical=$true
        $Local.Windows_dotNET_44_entry_readback_verified=$true
    } finally { if ($New) { $New.Dispose() }; $Old.Dispose() }
    if ((Get-FileHash -LiteralPath $OutputZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Safe.new_ZIP_SHA256 -or
        (Get-FileHash -LiteralPath $AcceptedZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'cc9815bbd512400cbee3f3a227fdd62b697a19ee643e4458a0db924c24aaae24') { throw 'ZIP_CHANGED_DURING_READBACK' }
    if ((Get-FileHash -LiteralPath $PacketPath -Algorithm SHA256).Hash -cne $PacketHash) { throw 'ENCRYPTED_PACKET_CHANGED' }
    $Local.encrypted_packet_unchanged=$true
    $Safe.result='LOCAL_BATCH_B_COMPLETE_WINDOWS_FRONTEND_AND_ROLLOUT_CANDIDATE_NOT_DEPLOYED'
    $Safe.checkpoint='COMPLETE'
} catch {
    $Safe.exit_code=1
    $Safe.result='LOCAL_BATCH_B_RUNNER_REVIEW_REQUIRED'
    $Safe | Add-Member -NotePropertyName problem_code -NotePropertyValue $Phase -Force
} finally {
    if ($PacketSecure) { $PacketSecure.Dispose() }
    $Payload=$null;$PacketText=$null;$Packet=$null;$NewConfig=$null;$OldConfig=$null;$NewText=$null;$OldText=$null
    $Local.batch_run_finished=$true
    foreach ($Key in $Local.Keys) { $Safe | Add-Member -NotePropertyName $Key -NotePropertyValue $Local[$Key] -Force }
}
if ($Safe.exit_code -eq 0) { Write-Host ('New local frontend ZIP: ' + $OutputZIP) }
Write-Host 'BEGIN SAFE BATCH B RESULT'
Write-Host ($Safe | ConvertTo-Json -Depth 6)
Write-Host 'END SAFE BATCH B RESULT'
if ($Safe.exit_code -eq 0) { Write-Host 'BATCH B COMPLETE: frontend candidate and rollout checklist prepared; hosted installation and activation remain pending.' }
else { Write-Host 'BATCH B STOPPED FOR LOCAL REVIEW: return the safe result before retrying.' }
Write-Host ('Batch B exit code: ' + $Safe.exit_code)
return [int]$Safe.exit_code
