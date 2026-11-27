# FR.2.3: guarded corrected recheck; retain the exact previously archived role and audit history.
$ErrorActionPreference = "Stop"
$mushavoBusinessCommit = $env:MUSHAVO_STAGE3_BUSINESS_COMMIT
if ($mushavoBusinessCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned Business acceptance commit is required." }
$mushavoBusinessLines = git show `
    "${mushavoBusinessCommit}:scripts/check-stage-3-business-api.cjs"
$mushavoBusinessReadExit = $LASTEXITCODE
$mushavoBusinessCode = ($mushavoBusinessLines -join "`n") + "`n"
if ($mushavoBusinessReadExit -ne 0 -or -not $mushavoBusinessLines) { throw "Business API checker could not be read." }

if ($mushavoBusinessCode -match '[^\x00-\x7f]') { throw 'Checker must be ASCII; no test started.' }
$mushavoBusinessHasher = [Security.Cryptography.SHA256]::Create()
try {
    $mushavoBusinessHash = [BitConverter]::ToString($mushavoBusinessHasher.ComputeHash([Text.Encoding]::ASCII.GetBytes($mushavoBusinessCode))).Replace('-', '').ToLowerInvariant()
} finally { $mushavoBusinessHasher.Dispose() }
if ($mushavoBusinessHash -ne 'd2abf83bd303b03abe517a1f4dfca3b09a44f251ce33d25a0d506164e0aff8af') { throw 'Pinned continuation checker hash mismatch; no test started.' }
Write-Host 'STAGING ONLY: repeat selected Business API controls. Existing archived role and all three fingerprints must match before test writes.'
Write-Host 'The batch creates additional synthetic Business roles, invitations, claims and a budget; fixtures and audit history remain for exact later review.'
$mushavoBusinessPreviousOwnerEnv = $env:MUSHAVO_BUSINESS_OWNER_PASSWORD
$mushavoBusinessPreviousMemberEnv = $env:MUSHAVO_BUSINESS_MEMBER_PASSWORD
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
    $mushavoBusinessCode | node -e 'eval(require(''node:fs'').readFileSync(0,''utf8'')); module.exports.run({ownerPassword:process.env.MUSHAVO_BUSINESS_OWNER_PASSWORD,outsiderPassword:process.env.MUSHAVO_BUSINESS_MEMBER_PASSWORD,retainedArchive:{role_sha256:''24ccbd63efe40da23303d3a9c9e866fbcfe83452fa2331cb8ea9444f361a900f'',permissions_sha256:''fb1812e78849d04b443c3f1de4792873730a5e1199826dddd46c438ef61d9f65'',audit_sha256:''74cbb242ff9a95d17858459699e5eeb57672b1bec870b33b251539dcee3ce6a2''}}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result!==''STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD'')process.exitCode=1;}).catch(()=>{console.log(''3.3.3: Local Business test error; send this message only.'');process.exitCode=1;});'
    $mushavoBusinessExit = $LASTEXITCODE
}
finally {
    if ($mushavoBusinessOwnerBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoBusinessOwnerBstr) }
    if ($mushavoBusinessMemberBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoBusinessMemberBstr) }
    if ($null -ne $mushavoBusinessOwnerPassword) { $mushavoBusinessOwnerPassword.Dispose() }
    if ($null -ne $mushavoBusinessMemberPassword) { $mushavoBusinessMemberPassword.Dispose() }
    if ($null -eq $mushavoBusinessPreviousOwnerEnv) { Remove-Item Env:MUSHAVO_BUSINESS_OWNER_PASSWORD -ErrorAction SilentlyContinue }
    else { $env:MUSHAVO_BUSINESS_OWNER_PASSWORD = $mushavoBusinessPreviousOwnerEnv }
    if ($null -eq $mushavoBusinessPreviousMemberEnv) { Remove-Item Env:MUSHAVO_BUSINESS_MEMBER_PASSWORD -ErrorAction SilentlyContinue }
    else { $env:MUSHAVO_BUSINESS_MEMBER_PASSWORD = $mushavoBusinessPreviousMemberEnv }
}
Write-Output "FR.2.3: Corrected Business API recheck completed with exit code $mushavoBusinessExit."
Write-Output "Send the complete JSON result and exit code; never passwords or tokens. Retain the Business fixtures and previous Personal/Family/conversion fixtures."
if ($mushavoBusinessExit -ne 0) { throw "Review required. Stop here and send the JSON summary. Incomplete staging fixtures remain." }

