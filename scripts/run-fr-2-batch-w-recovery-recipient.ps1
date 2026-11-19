param(
 [Parameter(Mandatory=$true)][string]$SnapshotRoot,
 [Parameter(Mandatory=$true)][string]$ExpectedSourceSHA256,
 [Parameter(Mandatory=$true)][string]$TestEmail,
 [string]$PacketFile = ''
)
$ErrorActionPreference='Stop'
$Phase='WINDOWS_AND_SOURCE_IDENTITIES'
$Secure=$null; $Payload=$null; $PrivateJson=$null; $Safe=$null
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
  $Answer=$Output | ConvertFrom-Json
  $Allowed=@('stage_step','progress_display','result','retained_packet_recipient_allowed','retained_packet_recipient_count','live_Cloudflare_secret_value_readback','live_email_delivery_verified','actual_hosted_requests','real_email_requests','settings_SQL_or_account_writes','password_save_requested','raw_private_values_or_hashes_printed','hosted_acceptance','production_or_native_changed','APK_update_deferred','problem_code','exit_code')
  if (@($Answer.PSObject.Properties).Count -ne $Allowed.Count -or
   @($Answer.PSObject.Properties | Where-Object { $_.Name -notin $Allowed }).Count -ne 0 -or
   $Answer.stage_step -cne 'FR.2.5.W27_RECOVERY_RECIPIENT_LOCAL_READ_ONLY' -or
   $Answer.exit_code -notin @(0,1) -or $Answer.exit_code -ne $Child.ExitCode -or
   $Answer.actual_hosted_requests -ne 0 -or $Answer.real_email_requests -ne 0 -or $Answer.settings_SQL_or_account_writes -ne 0 -or
   $Answer.raw_private_values_or_hashes_printed -ne $false) { throw 'PRIVATE_CHILD_REQUIRED' }
  return $Answer
 } finally {
  if ($Bytes) { [Array]::Clear($Bytes,0,$Bytes.Length) }
  if ($Child) { if ($Started -and -not $Child.HasExited) { $Child.Kill() }; $Child.Dispose() }
  $Text=$null; $Output=$null; $Errors=$null; $Answer=$null
 }
}
try {
 if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw 'WINDOWS_REQUIRED' }
 Assert-Unlinked $SnapshotRoot
 if ($ExpectedSourceSHA256 -cnotmatch '^[a-f0-9]{64}$' -or
  (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ExpectedSourceSHA256) { throw 'SOURCE_IDENTITY_REQUIRED' }
 $Entry=Join-Path $SnapshotRoot 'scripts/check-fr-2-batch-w-recovery-recipient.mjs'
 Assert-Unlinked $Entry
 if ($Entry.Contains('"') -or (Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne '22419d83009fa4ecd7aed6c0769412553daab1a014ef02c06ebd50f22136e817') { throw 'SOURCE_IDENTITY_REQUIRED' }
 $Phase='PRIVATE_PIPE_PREFLIGHT'
 $RuntimeLines=@(& node -p 'JSON.stringify({execPath:process.execPath})' 2>$null)
 if ($LASTEXITCODE -ne 0 -or $RuntimeLines.Count -ne 1) { throw 'NODE_RUNTIME_REQUIRED' }
 $Runtime=($RuntimeLines -join '') | ConvertFrom-Json
 if (-not [IO.Path]::IsPathRooted($Runtime.execPath) -or -not [IO.File]::Exists($Runtime.execPath) -or $Runtime.execPath.Contains('"') -or [IO.Path]::GetExtension($Runtime.execPath) -ine '.exe') { throw 'NODE_RUNTIME_REQUIRED' }
 $Probe=Private-Child $Runtime.execPath $Entry '{"preflight":true}'
 if ($Probe.result -cne 'PRIVATE_PIPE_PREFLIGHT_PASS' -or $Probe.exit_code -ne 0) { throw 'PRIVATE_PIPE_REQUIRED' }
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
 $Phase='LOCAL_RECIPIENT_MEMBERSHIP'
 $Safe=Private-Child $Runtime.execPath $Entry $Payload
 if ($Safe.result -ceq 'PRIVATE_PIPE_PREFLIGHT_PASS') { throw 'PRIVATE_PACKET_RESULT_REQUIRED' }
 if ((Get-FileHash -LiteralPath $PacketFile -Algorithm SHA256).Hash -cne $PacketHash) { throw 'PRIVATE_PACKET_CHANGED' }
 $Safe | Add-Member -NotePropertyName source_hashes_verified -NotePropertyValue 2
 $Safe | Add-Member -NotePropertyName encrypted_packet_compared_unchanged -NotePropertyValue $true
 $Safe | Add-Member -NotePropertyName Windows_DPAPI_current_user_read_completed -NotePropertyValue $true
 Write-Host ($Safe | ConvertTo-Json -Depth 4)
 return [int]$Safe.exit_code
} catch {
 Write-Host ([ordered]@{stage_step='FR.2.5.W27_RECOVERY_RECIPIENT_LOCAL_READ_ONLY';progress_display='Stage 3/10 | FR.2/8 | Batch W/Z';result='RECOVERY_RECIPIENT_LOCAL_RUNNER_REVIEW_REQUIRED';local_checkpoint=$Phase;raw_private_values_or_hashes_printed=$false;actual_hosted_requests=0;real_email_requests=0;settings_SQL_or_account_writes=0;password_save_requested=$false;exit_code=1} | ConvertTo-Json)
 return 1
} finally {
 if ($Secure) { $Secure.Dispose() }
 $PrivateJson=$null; $Payload=$null; $Safe=$null; $PacketHash=$null
}
