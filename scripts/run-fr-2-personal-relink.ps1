# Controlled FR.2.2 staging-only relink checks. New inactive fixtures are retained.
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$RelinkPin = $env:MUSHAVO_FR2_RELINK_COMMIT
if ($RelinkPin -notmatch '^[0-9a-f]{40}$') {
    throw 'A pinned FR.2.2 relink commit is required.'
}
$RelinkTempRoot = Join-Path $env:TEMP ('mushavo-fr2-relink-' + [guid]::NewGuid().ToString('N'))
$OwnerSecurePassword = $null
$SecondSecurePassword = $null
$OwnerPtr = [IntPtr]::Zero
$SecondPtr = [IntPtr]::Zero
$RelinkExit = $null
try {
    New-Item -ItemType Directory -Path $RelinkTempRoot | Out-Null
    foreach ($FileName in @('check-stage-3-personal-api.cjs', 'check-fr-2-personal-relink.cjs')) {
        $Lines = git show ($RelinkPin + ':scripts/' + $FileName)
        if ($LASTEXITCODE -ne 0 -or -not $Lines) { throw 'Pinned checker input unavailable.' }
        [IO.File]::WriteAllText(
            (Join-Path $RelinkTempRoot $FileName),
            ($Lines -join [Environment]::NewLine),
            [Text.UTF8Encoding]::new($false)
        )
    }
    $DriverCode = @'
const { run } = require('./check-fr-2-personal-relink.cjs');
run({ownerPassword:process.env.MUSHAVO_FR2_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_FR2_SECOND_PASSWORD})
.then(r=>{console.log(JSON.stringify(r,null,2));process.exitCode=r.result==='STAGING_PERSONAL_RELINK_SCOPED_PASS'?0:1;})
.catch(()=>{console.log(JSON.stringify({stage_step:'FR.2.2_RELINK',result:'LOCAL_DRIVER_REVIEW_NO_RAW_EXCEPTION'}));process.exitCode=1;});
'@
    $RelinkDriverPath = Join-Path $RelinkTempRoot 'driver.cjs'
    [IO.File]::WriteAllText($RelinkDriverPath, $DriverCode, [Text.UTF8Encoding]::new($false))
    Write-Host 'STAGING ONLY: four new inactive items and two paid records will be retained for exact cleanup.'
    $OwnerSecurePassword = Read-Host 'Staging APP password for audit.owner@example.com' -AsSecureString
    $SecondSecurePassword = Read-Host 'Staging APP password for audit.outsider@example.com' -AsSecureString
    if ($OwnerSecurePassword.Length -eq 0 -or $SecondSecurePassword.Length -eq 0) {
        throw 'Both staging app passwords are required. No tests started.'
    }
    $OwnerPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($OwnerSecurePassword)
    $SecondPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecondSecurePassword)
    $env:MUSHAVO_FR2_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($OwnerPtr)
    $env:MUSHAVO_FR2_SECOND_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($SecondPtr)
    node $RelinkDriverPath
    $RelinkExit = $LASTEXITCODE
}
finally {
    if ($OwnerPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($OwnerPtr) }
    if ($SecondPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($SecondPtr) }
    if ($null -ne $OwnerSecurePassword) { $OwnerSecurePassword.Dispose() }
    if ($null -ne $SecondSecurePassword) { $SecondSecurePassword.Dispose() }
    Remove-Item Env:MUSHAVO_FR2_OWNER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_FR2_SECOND_PASSWORD -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $RelinkTempRoot) {
        Remove-Item -LiteralPath $RelinkTempRoot -Recurse -Force -ErrorAction SilentlyContinue
    }
}
Write-Host ('FR.2.2 relink batch exit code: ' + $RelinkExit)
Write-Host 'Return the JSON and exit code. Never return passwords or tokens.'
if ($RelinkExit -ne 0) { throw 'Review required. Stop before another run; new fixture effects may remain.' }
