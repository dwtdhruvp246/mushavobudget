# 3.2.1: two existing synthetic staging APP accounts, not database passwords.
$ErrorActionPreference = "Stop"
$mushavoPersonalCommit = $env:MUSHAVO_STAGE3_PERSONAL_COMMIT
if ($mushavoPersonalCommit -notmatch '^[0-9a-f]{40}$') {
    throw "A pinned Stage 3 Personal acceptance commit is required."
}
$mushavoPersonalCode = git show `
    "${mushavoPersonalCommit}:scripts/check-stage-3-personal-api.cjs" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoPersonalCode)) {
    throw "Personal API checker could not be read."
}
$mushavoOwnerPassword = $null
$mushavoOutsiderPassword = $null
$mushavoOwnerBstr = [IntPtr]::Zero
$mushavoOutsiderBstr = [IntPtr]::Zero
try {
    $mushavoOwnerPassword = Read-Host `
        "STAGING APP password for audit.owner@example.com (not the database password)" `
        -AsSecureString
    $mushavoOutsiderPassword = Read-Host `
        "STAGING APP password for audit.outsider@example.com (not the database password)" `
        -AsSecureString
    if ($mushavoOwnerPassword.Length -eq 0 -or $mushavoOutsiderPassword.Length -eq 0) {
        throw "Both staging app passwords are required. No tests started."
    }
    $mushavoOwnerBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoOwnerPassword)
    $mushavoOutsiderBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoOutsiderPassword)
    $env:MUSHAVO_PERSONAL_TEST_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoOwnerBstr)
    $env:MUSHAVO_PERSONAL_TEST_OUTSIDER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoOutsiderBstr)
    $env:MUSHAVO_PERSONAL_AUDIT_CODE = $mushavoPersonalCode
    node -e 'eval(process.env.MUSHAVO_PERSONAL_AUDIT_CODE); module.exports.run({ownerPassword:process.env.MUSHAVO_PERSONAL_TEST_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_PERSONAL_TEST_OUTSIDER_PASSWORD}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result!==''STAGING_PERSONAL_CRUD_SCOPED_PASS'')process.exitCode=1;}).catch(()=>{console.log(''3.2.1: Local test error; send this message only.'');process.exitCode=1;});'
    $mushavoPersonalExit = $LASTEXITCODE
}
finally {
    if ($mushavoOwnerBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoOwnerBstr) }
    if ($mushavoOutsiderBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoOutsiderBstr) }
    if ($null -ne $mushavoOwnerPassword) { $mushavoOwnerPassword.Dispose() }
    if ($null -ne $mushavoOutsiderPassword) { $mushavoOutsiderPassword.Dispose() }
    Remove-Item Env:MUSHAVO_PERSONAL_TEST_OWNER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_PERSONAL_TEST_OUTSIDER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_PERSONAL_AUDIT_CODE -ErrorAction SilentlyContinue
}
Write-Output "3.2.1: Personal API batch completed with exit code $mushavoPersonalExit."
Write-Output "Send the JSON summary and redacted errors only. Do not send passwords."
if ($mushavoPersonalExit -ne 0) {
    throw "Review required. Stop here; incomplete test fixtures remain in staging. Send the JSON summary."
}
