param(
 [Parameter(Mandatory=$true)][string]$SnapshotRoot,
 [Parameter(Mandatory=$true)][string]$ExpectedSourceSHA256,
 [Parameter(Mandatory=$true)][string]$TestEmail,
 [string]$PacketFile = '',
 [string]$RetainedZIP = ''
)
$ErrorActionPreference='Stop'
$Phase='WINDOWS_AND_SOURCE_IDENTITIES'
$Secure=$null; $Payload=$null; $PrivateJson=$null; $Safe=$null
$NewSecure=$null; $ReadbackSecure=$null; $Packet=$null; $Plan=$null; $Stream=$null
$CandidatePath=$null; $CreatedThisRun=$false; $Prepared=$false; $RecipientJSON=$null
function Assert-Unlinked([string]$Value) {
 $Probe=[IO.Path]::GetFullPath($Value)
 while ($Probe) {
  if (Test-Path -LiteralPath $Probe) {
   if (((Get-Item -LiteralPath $Probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'PRIVATE_PATH_REQUIRED' }
  }
  $Parent=[IO.Directory]::GetParent($Probe)
  if ($null -eq $Parent) { break }
  $Probe=$Parent.FullName
 }
}
function Plain([Security.SecureString]$Value) {
 $Pointer=[IntPtr]::Zero
 try { $Pointer=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($Value); return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Pointer) }
 finally { if ($Pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Pointer) } }
}
function Private-Child([string]$Node,[string]$Entry,[string]$Text) {
 $Child=$null; $Started=$false; $Bytes=$null
 try {
  $Start=New-Object Diagnostics.ProcessStartInfo
  $Start.FileName=$Node; $Start.Arguments='"'+$Entry+'" --private-parent-pipe'
  $Start.WorkingDirectory=$SnapshotRoot; $Start.UseShellExecute=$false; $Start.CreateNoWindow=$true
  $Start.RedirectStandardInput=$true; $Start.RedirectStandardOutput=$true; $Start.RedirectStandardError=$true
  $Encoding=New-Object Text.UTF8Encoding($false)
  $Start.StandardOutputEncoding=$Encoding; $Start.StandardErrorEncoding=$Encoding
  foreach ($Key in @($Start.EnvironmentVariables.Keys)) {
   if ($Key -match '^(NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_|SUPABASE_|ZOHO_|EMAIL_GATE_)') { $Start.EnvironmentVariables.Remove($Key) }
  }
  $Child=New-Object Diagnostics.Process; $Child.StartInfo=$Start
  if (-not $Child.Start()) { throw 'PRIVATE_CHILD_REQUIRED' }; $Started=$true
  $ReadOutput=$Child.StandardOutput.ReadToEndAsync(); $ReadErrors=$Child.StandardError.ReadToEndAsync()
  $Bytes=$Encoding.GetBytes($Text)
  $Child.StandardInput.BaseStream.Write($Bytes,0,$Bytes.Length); $Child.StandardInput.BaseStream.Flush(); $Child.StandardInput.BaseStream.Close()
  [Array]::Clear($Bytes,0,$Bytes.Length); $Bytes=$null
  if (-not $Child.WaitForExit(15000)) { $Child.Kill(); throw 'PRIVATE_CHILD_REQUIRED' }
  $Output=$ReadOutput.GetAwaiter().GetResult(); $Errors=$ReadErrors.GetAwaiter().GetResult()
  if ($Output.Length -gt 16384 -or $Errors.Length -ne 0) { throw 'PRIVATE_CHILD_REQUIRED' }
  $Envelope=$Output | ConvertFrom-Json
  if (@($Envelope.PSObject.Properties).Count -ne 2 -or @($Envelope.PSObject.Properties | Where-Object { $_.Name -notin @('receipt','recipient_json') }).Count -ne 0) { throw 'PRIVATE_CHILD_REQUIRED' }
  $Answer=$Envelope.receipt
  $Allowed=@('stage_step','progress_display','result','original_recipient_count','prepared_recipient_count','recipient_value_changed','actual_hosted_requests','real_email_requests','Cloudflare_settings_or_SQL_or_account_writes','password_save_requested','provider_credentials_or_private_hashes_printed','hosted_acceptance','production_or_native_changed','APK_update_deferred','problem_code','exit_code')
  if (@($Answer.PSObject.Properties).Count -ne $Allowed.Count -or
   @($Answer.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0 -or
   $Answer.stage_step -cne 'FR.2.5.W28_LOCAL_RECIPIENT_ADDITION_PREPARATION' -or
   $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
   $Answer.actual_hosted_requests -ne 0 -or $Answer.real_email_requests -ne 0 -or $Answer.Cloudflare_settings_or_SQL_or_account_writes -ne 0 -or
   $Answer.provider_credentials_or_private_hashes_printed -ne $false) { throw 'PRIVATE_CHILD_REQUIRED' }
  return $Envelope
 } finally {
  if ($Bytes) { [Array]::Clear($Bytes,0,$Bytes.Length) }
  if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
  $Text=$null; $Output=$null; $Errors=$null; $Answer=$null; $Envelope=$null
 }
}
try {
 if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
 Assert-Unlinked $SnapshotRoot
 if ($ExpectedSourceSHA256 -cnotmatch '^[a-f0-9]{64}$' -or
  (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedSourceSHA256) { throw 'SOURCE_IDENTITY_REQUIRED' }
 $Entry=Join-Path $SnapshotRoot 'scripts/plan-fr-2-batch-w-recipient-addition.mjs'
 Assert-Unlinked $Entry
 if ($Entry.Contains('"') -or (Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne '6fe04d5fa65c2d8abb6d912ecd83fa553e376faf9e6d424f6ae70e94c38d9d14') { throw 'SOURCE_IDENTITY_REQUIRED' }
 $Dependency=Join-Path $SnapshotRoot 'scripts/check-fr-2-batch-w-recovery-recipient.mjs'
 Assert-Unlinked $Dependency
 if ((Get-FileHash -LiteralPath $Dependency -Algorithm SHA256).Hash.ToLowerInvariant() -cne '22419d83009fa4ecd7aed6c0769412553daab1a014ef02c06ebd50f22136e817') { throw 'SOURCE_IDENTITY_REQUIRED' }
 $Phase='PRIVATE_PIPE_PREFLIGHT'
 $RuntimeLines=@(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
 if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
 $Runtime=($RuntimeLines -join '') | ConvertFrom-Json
 if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or $Runtime.execPath.Contains('"') -or [IO.Path]::GetExtension($Runtime.execPath) -ine '.exe') { throw 'NODE_RUNTIME_REQUIRED' }
 $Probe=Private-Child $Runtime.execPath $Entry '{"preflight":true}'
 if ($Probe.receipt.result -cne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Probe.receipt.exit_code -ne 0 -or $null -ne $Probe.recipient_json) { throw 'PRIVATE_PIPE_REQUIRED' }
 $Phase='EXACT_ACCEPTED_BROWSER_TRUST_ZIP'
 if ([string]::IsNullOrWhiteSpace($RetainedZIP) -or -not (Test-Path -LiteralPath $RetainedZIP -PathType Leaf)) { $RetainedZIP=(Read-Host 'Full path to the existing mushavo-trusted-browser-staging.zip').Trim().Trim('"') }
 Assert-Unlinked $RetainedZIP
 $ZipItem=Get-Item -LiteralPath $RetainedZIP
 if ($ZipItem.PSIsContainer -or $ZipItem.Length -gt 8388608 -or (Get-FileHash -LiteralPath $RetainedZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne '53437a8f2b452b387f75bcbca512b08e08f29a6b446f33de28660154a03301f5') { throw 'ACCEPTED_BROWSER_TRUST_ZIP_REQUIRED' }
 $Phase='EXISTING_PRIVATE_PACKET_SELECTION'
 $PrivateRoot=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MushavoBudget/PrivateStaging'
 Assert-Unlinked $PrivateRoot
 if ([string]::IsNullOrWhiteSpace($PacketFile)) {
  $Candidates=@(Get-ChildItem -LiteralPath $PrivateRoot -Filter 'email-gateway-*.dpapi' -File | Where-Object { $_.Name -cmatch '^email-gateway-[a-f0-9]{32}\.dpapi$' })
  if ($Candidates.Count -eq 1) { $PacketFile=$Candidates[0].FullName }
  else { $PacketFile=(Read-Host 'Full path to your existing email-gateway DPAPI packet (path only)').Trim().Trim('"') }
 }
 $PacketFile=[IO.Path]::GetFullPath($PacketFile)
 if (-not [String]::Equals([IO.Path]::GetDirectoryName($PacketFile),[IO.Path]::GetFullPath($PrivateRoot),[StringComparison]::OrdinalIgnoreCase) -or
  [IO.Path]::GetFileName($PacketFile) -cnotmatch '^email-gateway-[a-f0-9]{32}\.dpapi$') { throw 'PRIVATE_PACKET_PATH_REQUIRED' }
 Assert-Unlinked $PacketFile
 $Item=Get-Item -LiteralPath $PacketFile
 if ($Item.PSIsContainer -or $Item.Length -lt 1 -or $Item.Length -gt 262144) { throw 'PRIVATE_PACKET_REQUIRED' }
 $PacketHash=(Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash
 $Phase='CURRENT_USER_DPAPI_READ_ONLY'
 $Secure=ConvertTo-SecureString ([IO.File]::ReadAllText($PacketFile,[Text.Encoding]::UTF8))
 $PrivateJson=Plain $Secure
 $Payload=@{packet_json=$PrivateJson;recipient=$TestEmail} | ConvertTo-Json -Depth 3 -Compress
 $Phase='LOCAL_RECIPIENT_ADDITION_PLAN'
 $Plan=Private-Child $Runtime.execPath $Entry $Payload
 if ($Plan.receipt.exit_code -ne 0 -or $Plan.receipt.prepared_recipient_count -ne 3 -or $Plan.recipient_json -isnot [string]) { throw 'RECIPIENT_PLAN_REQUIRED' }
 $RecipientJSON=[string]$Plan.recipient_json
 $Packet=$PrivateJson | ConvertFrom-Json
 $CanonicalBefore=$Packet | ConvertTo-Json -Depth 8 -Compress
 $OriginalRecipientsJSON=[string]$Packet.env.ZOHO_TEST_RECIPIENTS_JSON
 $Packet.env.ZOHO_TEST_RECIPIENTS_JSON=$RecipientJSON
 $CandidateJson=$Packet | ConvertTo-Json -Depth 8 -Compress
 $Packet.env.ZOHO_TEST_RECIPIENTS_JSON=$OriginalRecipientsJSON
 if (($Packet | ConvertTo-Json -Depth 8 -Compress) -cne $CanonicalBefore) { throw 'ONLY_RECIPIENT_VALUE_CHANGE_REQUIRED' }
 $Phase='PENDING_ENCRYPTED_PACKET_READBACK'
 if ($Plan.receipt.recipient_value_changed -eq $true) {
  $CandidatePath=Join-Path $PrivateRoot ('email-gateway-'+[guid]::NewGuid().ToString('N')+'.dpapi')
  Assert-Unlinked $CandidatePath
  $NewSecure=ConvertTo-SecureString $CandidateJson -AsPlainText -Force
  $Cipher=ConvertFrom-SecureString $NewSecure
  $Encoding=New-Object Text.UTF8Encoding($false)
  $Stream=[IO.File]::Open($CandidatePath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  $CreatedThisRun=$true
  $CipherBytes=$Encoding.GetBytes($Cipher)
  $Stream.Write($CipherBytes,0,$CipherBytes.Length); $Stream.Flush($true); $Stream.Dispose(); $Stream=$null
  $ReadbackSecure=ConvertTo-SecureString ([IO.File]::ReadAllText($CandidatePath,$Encoding))
  if ((Plain $ReadbackSecure) -cne $CandidateJson) { throw 'PENDING_PACKET_READBACK_REQUIRED' }
 } else { $CandidatePath=$PacketFile }
 if ((Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash -cne $PacketHash) { throw 'ORIGINAL_PRIVATE_PACKET_CHANGED' }
 $Phase='RECIPIENT_ADDRESSES_ONLY_CLIPBOARD'
 Set-Clipboard -Value $RecipientJSON
 if (([string](Get-Clipboard -Raw)).Trim() -cne $RecipientJSON) { throw 'RECIPIENT_CLIPBOARD_READBACK_REQUIRED' }
 $Safe=$Plan.receipt
 $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue 3
 $Safe | Add-Member -NotePropertyName original_encrypted_packet_compared_unchanged -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName new_encrypted_packet_created -NotePropertyValue $CreatedThisRun
 $Safe | Add-Member -NotePropertyName pending_packet_readback_verified -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName Windows_DPAPI_current_user_read_completed -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName only_recipient_setting_value_changed_in_pending_packet -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName recipient_JSON_copied_to_clipboard -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName provider_credentials_copied_to_clipboard -NotePropertyValue $false
 $Safe | Add-Member -NotePropertyName accepted_browser_trust_ZIP_SHA256_verified -NotePropertyValue $true
 $Prepared=$true
 Write-Host ('Pending encrypted packet saved locally: '+$CandidatePath)
 Write-Host ('Existing accepted ZIP for the later staging upload: '+[IO.Path]::GetFullPath($RetainedZIP))
 Write-Host 'Clipboard now holds recipient-address JSON only. Paste it into the reviewed Cloudflare field before copying console output.'
 Write-Host ($Safe | ConvertTo-Json -Depth 4)
 return [int]$Safe.exit_code
} catch {
 Write-Host ([ordered]@{stage_step='FR.2.5.W28_LOCAL_RECIPIENT_ADDITION_PREPARATION';progress_display='Stage 3/10 | FR.2/8 | Batch W/Z';result='RECIPIENT_ADDITION_LOCAL_RUNNER_REVIEW_REQUIRED';local_checkpoint=$Phase;raw_private_values_or_hashes_printed=$false;actual_hosted_requests=0;real_email_requests=0;settings_SQL_or_account_writes=0;password_save_requested=$false;exit_code=1} | ConvertTo-Json)
 return 1
} finally {
 if ($Stream) { $Stream.Dispose() }
 if ($CreatedThisRun -and -not $Prepared -and $CandidatePath) { Remove-Item -LiteralPath $CandidatePath -Force -ErrorAction SilentlyContinue }
 foreach ($Value in @($Secure,$NewSecure,$ReadbackSecure)) { if ($Value) { $Value.Dispose() } }
 $PrivateJson=$null; $Payload=$null; $Safe=$null; $PacketHash=$null; $Packet=$null; $Plan=$null
 $RecipientJSON=$null; $CandidateJson=$null; $CanonicalBefore=$null; $Cipher=$null; $CipherBytes=$null
}
