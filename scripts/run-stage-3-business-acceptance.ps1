# 3.3.3: prepared STAGING Business fixtures from the matching pinned SQL; no new accounts.
$ErrorActionPreference = "Stop"
$mushavoBusinessCommit = $env:MUSHAVO_STAGE3_BUSINESS_COMMIT
if ($mushavoBusinessCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned Business acceptance commit is required." }
$mushavoBusinessCode = git show `
    "${mushavoBusinessCommit}:scripts/check-stage-3-business-api.cjs" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoBusinessCode)) { throw "Business API checker could not be read." }
$mushavoBusinessOwnerPassword = $null
$mushavoBusinessMemberPassword = $null
$mushavoBusinessOwnerBstr = [IntPtr]::Zero
$mushavoBusinessMemberBstr = [IntPtr]::Zero
try {
    $mushavoBusinessOwnerPassword = Read-Host "STAGING APP password for audit.owner@example.com (not the database password)" -AsSecureString
    $mushavoBusinessMemberPassword = Read-Host "STAGING APP password for audit.outsider@example.com (not the database password)" -AsSecureString
    if ($mushavoBusinessOwnerPassword.Length -eq 0 -or $mushavoBusinessMemberPassword.Length -eq 0) { throw "Both staging app passwords are required. No test started." }
    $mushavoBusinessOwnerBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoBusinessOwnerPassword)
    $mushavoBusinessMemberBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoBusinessMemberPassword)
    $env:MUSHAVO_BUSINESS_OWNER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoBusinessOwnerBstr)
    $env:MUSHAVO_BUSINESS_MEMBER_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoBusinessMemberBstr)
    # Pipe ASCII checker text through stdin; it exceeds Windows' single-env-value limit.
    $mushavoBusinessCode | node -e 'eval(require(''node:fs'').readFileSync(0,''utf8'')); module.exports.run({ownerPassword:process.env.MUSHAVO_BUSINESS_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_BUSINESS_MEMBER_PASSWORD}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result!==''STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD'')process.exitCode=1;}).catch(()=>{console.log(''3.3.3: Local Business test error; send this message only.'');process.exitCode=1;});'
    $mushavoBusinessExit = $LASTEXITCODE
}
finally {
    if ($mushavoBusinessOwnerBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoBusinessOwnerBstr) }
    if ($mushavoBusinessMemberBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoBusinessMemberBstr) }
    if ($null -ne $mushavoBusinessOwnerPassword) { $mushavoBusinessOwnerPassword.Dispose() }
    if ($null -ne $mushavoBusinessMemberPassword) { $mushavoBusinessMemberPassword.Dispose() }
    Remove-Item Env:MUSHAVO_BUSINESS_OWNER_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_BUSINESS_MEMBER_PASSWORD -ErrorAction SilentlyContinue
}
Write-Output "3.3.3: Business API batch completed with exit code $mushavoBusinessExit."
Write-Output "Send the JSON summary and redacted errors only; retain the Business fixtures and previous Personal/Family/conversion fixtures."
if ($mushavoBusinessExit -ne 0) { throw "Review required. Stop here and send the JSON summary. Incomplete staging fixtures remain." }

