# Controlled FR.2.2 staging-only deletion checks. Only new exact fixture IDs are deleted.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$DeletionPin = $env:MUSHAVO_FR2_DELETION_COMMIT
if ($DeletionPin -notmatch '^[0-9a-f]{40}$') {
    throw 'A pinned FR.2.2 deletion commit is required.'
}
$DeletionTempRoot = Join-Path $env:TEMP ('mushavo-fr2-deletion-' + [guid]::NewGuid().ToString('N'))
$OwnerSecurePassword = $null
$SecondSecurePassword = $null
$OwnerPtr = [IntPtr]::Zero
$SecondPtr = [IntPtr]::Zero
$DeletionExit = $null
$PreviousOwnerPassword = $env:MUSHAVO_FR2_OWNER_PASSWORD
$PreviousSecondPassword = $env:MUSHAVO_FR2_SECOND_PASSWORD
try {
    New-Item -ItemType Directory -Path $DeletionTempRoot | Out-Null
    foreach ($FileName in @('check-stage-3-personal-api.cjs', 'check-fr-2-personal-deletion.cjs')) {
        $Lines = git show ($DeletionPin + ':scripts/' + $FileName)
        if ($LASTEXITCODE -ne 0 -or -not $Lines) { throw 'Pinned checker input unavailable.' }
        [IO.File]::WriteAllText(
            (Join-Path $DeletionTempRoot $FileName),
            ($Lines -join [Environment]::NewLine),
            [Text.UTF8Encoding]::new($false)
        )
    }
    $DriverCode = @'
const { run } = require('./check-fr-2-personal-deletion.cjs');
run({ownerPassword:process.env.MUSHAVO_FR2_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_FR2_SECOND_PASSWORD})
.then(r=>{console.log(JSON.stringify(r,null,2));process.exitCode=r.result==='STAGING_PERSONAL_DELETION_AND_CONVERSION_CASCADE_SCOPED_PASS'?0:1;})
.catch(()=>{console.log(JSON.stringify({stage_step:'FR.2.2_DELETION',result:'LOCAL_DRIVER_REVIEW_NO_RAW_EXCEPTION'}));process.exitCode=1;});
'@
    $DeletionDriverPath = Join-Path $DeletionTempRoot 'driver.cjs'
    [IO.File]::WriteAllText($DeletionDriverPath, $DriverCode, [Text.UTF8Encoding]::new($false))
    Write-Host 'STAGING ONLY: creates and deletes four NEW inactive USD1 items, four paid records and their identity conversions. Existing rows and settings are preserved.'
    $OwnerSecurePassword = Read-Host 'Staging APP password for audit.owner@example.com' -AsSecureString
    $SecondSecurePassword = Read-Host 'Staging APP password for audit.outsider@example.com' -AsSecureString
    if ($OwnerSecurePassword.Length -eq 0 -or $SecondSecurePassword.Length -eq 0) {
        throw 'Both staging app passwords are required. No tests started.'
    }
    $OwnerPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OwnerSecurePassword)
    $SecondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecondSecurePassword)
    $env:MUSHAVO_FR2_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($OwnerPtr)
    $env:MUSHAVO_FR2_SECOND_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($SecondPtr)
    node $DeletionDriverPath
    $DeletionExit = $LASTEXITCODE
}
finally {
    if ($OwnerPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($OwnerPtr) }
    if ($SecondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($SecondPtr) }
    if ($null -ne $OwnerSecurePassword) { $OwnerSecurePassword.Dispose() }
    if ($null -ne $SecondSecurePassword) { $SecondSecurePassword.Dispose() }
    if ($null -eq $PreviousOwnerPassword) {
        Remove-Item Env:MUSHAVO_FR2_OWNER_PASSWORD -ErrorAction SilentlyContinue
    } else { $env:MUSHAVO_FR2_OWNER_PASSWORD = $PreviousOwnerPassword }
    if ($null -eq $PreviousSecondPassword) {
        Remove-Item Env:MUSHAVO_FR2_SECOND_PASSWORD -ErrorAction SilentlyContinue
    } else { $env:MUSHAVO_FR2_SECOND_PASSWORD = $PreviousSecondPassword }
    $PreviousOwnerPassword = $null
    $PreviousSecondPassword = $null
    if (Test-Path -LiteralPath $DeletionTempRoot) {
        Remove-Item -LiteralPath $DeletionTempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host ('FR.2.2 deletion batch exit code: ' + $DeletionExit)
Write-Host 'Return the JSON and exit code. Never return passwords or tokens.'
if ($DeletionExit -ne 0) { throw 'Review required. Stop before another run; new fixture effects may remain.' }
