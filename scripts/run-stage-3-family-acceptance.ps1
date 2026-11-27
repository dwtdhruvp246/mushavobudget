# 3.2.2: run only after the STAGING Family fixture SQL returned its four rows.
$ErrorActionPreference = "Stop"
$mushavoFamilyCommit = $env:MUSHAVO_STAGE3_FAMILY_COMMIT
if ($mushavoFamilyCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned Family acceptance commit is required." }
$mushavoFamilyCode = git show `
    "${mushavoFamilyCommit}:scripts/check-stage-3-family-api.cjs" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoFamilyCode)) { throw "Family API checker could not be read." }
$mushavoFamilyOwnerPassword = $null
$mushavoFamilyMemberPassword = $null
$mushavoFamilyOwnerBstr = [IntPtr]::Zero
$mushavoFamilyMemberBstr = [IntPtr]::Zero
try {
    $mushavoFamilyOwnerPassword = Read-Host "STAGING APP password for audit.owner@example.com (not the database password)" -AsSecureString
    $mushavoFamilyMemberPassword = Read-Host "STAGING APP password for audit.outsider@example.com (not the database password)" -AsSecureString
    if ($mushavoFamilyOwnerPassword.Length -eq 0 -or $mushavoFamilyMemberPassword.Length -eq 0) { throw "Both staging app passwords are required. No test started." }
    $mushavoFamilyOwnerBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoFamilyOwnerPassword)
    $mushavoFamilyMemberBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoFamilyMemberPassword)
    $env:MUSHAVO_FAMILY_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoFamilyOwnerBstr)
    $env:MUSHAVO_FAMILY_MEMBER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoFamilyMemberBstr)
    $env:MUSHAVO_FAMILY_AUDIT_CODE = $mushavoFamilyCode
    node -e 'eval(process.env.MUSHAVO_FAMILY_AUDIT_CODE); module.exports.run({ownerPassword:process.env.MUSHAVO_FAMILY_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_FAMILY_MEMBER_PASSWORD}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result!==''STAGING_FAMILY_API_SCOPED_PASS'')process.exitCode=1;}).catch(()=>{console.log(''3.2.2: Local Family test error; send this message only.'');process.exitCode=1;});'
    $mushavoFamilyExit = $LASTEXITCODE
}
finally {
    if ($mushavoFamilyOwnerBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoFamilyOwnerBstr) }
    if ($mushavoFamilyMemberBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoFamilyMemberBstr) }
    if ($null -ne $mushavoFamilyOwnerPassword) { $mushavoFamilyOwnerPassword.Dispose() }
    if ($null -ne $mushavoFamilyMemberPassword) { $mushavoFamilyMemberPassword.Dispose() }
    Remove-Item Env:MUSHAVO_FAMILY_OWNER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_FAMILY_MEMBER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_FAMILY_AUDIT_CODE -ErrorAction SilentlyContinue
}
Write-Output "3.2.2: Family API batch completed with exit code $mushavoFamilyExit."
Write-Output "Send the JSON summary and redacted errors only; retain the fixture families and invitation history."
if ($mushavoFamilyExit -ne 0) { throw "Review required. Stop here and send the JSON summary. Incomplete staging fixtures remain." }
