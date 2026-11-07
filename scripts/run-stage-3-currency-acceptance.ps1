# 3.2.3: existing completed STAGING Family fixtures; no SQL or new accounts required.
$ErrorActionPreference = "Stop"
$mushavoCurrencyCommit = $env:MUSHAVO_STAGE3_CURRENCY_COMMIT
if ($mushavoCurrencyCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned Currency acceptance commit is required." }
$mushavoCurrencyCode = git show `
    "${mushavoCurrencyCommit}:scripts/check-stage-3-currency-api.cjs" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCurrencyCode)) { throw "Currency API checker could not be read." }
$mushavoCurrencyOwnerPassword = $null
$mushavoCurrencyMemberPassword = $null
$mushavoCurrencyOwnerBstr = [IntPtr]::Zero
$mushavoCurrencyMemberBstr = [IntPtr]::Zero
try {
    $mushavoCurrencyOwnerPassword = Read-Host "STAGING APP password for audit.owner@example.com (not the database password)" -AsSecureString
    $mushavoCurrencyMemberPassword = Read-Host "STAGING APP password for audit.outsider@example.com (not the database password)" -AsSecureString
    if ($mushavoCurrencyOwnerPassword.Length -eq 0 -or $mushavoCurrencyMemberPassword.Length -eq 0) { throw "Both staging app passwords are required. No test started." }
    $mushavoCurrencyOwnerBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoCurrencyOwnerPassword)
    $mushavoCurrencyMemberBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoCurrencyMemberPassword)
    $env:MUSHAVO_CURRENCY_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoCurrencyOwnerBstr)
    $env:MUSHAVO_CURRENCY_MEMBER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoCurrencyMemberBstr)
    $env:MUSHAVO_CURRENCY_AUDIT_CODE = $mushavoCurrencyCode
    node -e 'eval(process.env.MUSHAVO_CURRENCY_AUDIT_CODE); module.exports.run({ownerPassword:process.env.MUSHAVO_CURRENCY_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_CURRENCY_MEMBER_PASSWORD}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result!==''STAGING_CURRENCY_API_SCOPED_PASS'')process.exitCode=1;}).catch(()=>{console.log(''3.2.3: Local Currency test error; send this message only.'');process.exitCode=1;});'
    $mushavoCurrencyExit = $LASTEXITCODE
}
finally {
    if ($mushavoCurrencyOwnerBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoCurrencyOwnerBstr) }
    if ($mushavoCurrencyMemberBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoCurrencyMemberBstr) }
    if ($null -ne $mushavoCurrencyOwnerPassword) { $mushavoCurrencyOwnerPassword.Dispose() }
    if ($null -ne $mushavoCurrencyMemberPassword) { $mushavoCurrencyMemberPassword.Dispose() }
    Remove-Item Env:MUSHAVO_CURRENCY_OWNER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_CURRENCY_MEMBER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_CURRENCY_AUDIT_CODE -ErrorAction SilentlyContinue
}
Write-Output "3.2.3: Currency API batch completed with exit code $mushavoCurrencyExit."
Write-Output "Send the JSON summary and redacted errors only; retain the synthetic conversion rows and existing Family fixtures."
if ($mushavoCurrencyExit -ne 0) { throw "Review required. Stop here and send the JSON summary. Incomplete staging fixtures remain." }
