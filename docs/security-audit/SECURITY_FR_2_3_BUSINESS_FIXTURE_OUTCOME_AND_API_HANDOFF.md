# FR.2.3 — two Business fixtures committed; genuine API batch ready

14 October 2026, FRE31. [Full owner fixture receipt](security-fr-2-business-fixture-owner-result.json), [API handoff contract](security-fr-2-business-api-handoff-contract.json), [prior26 local actual fixture/checker cases](security-fr-2-business-fixture-local-checks.json).

## Owner preparation result

Owner staging SQL at **18:40:25.47337 UTC** reports TWO_CONTROLLED_BUSINESS_FIXTURES_COMMITTED_NOT_API_ACCEPTANCE: **2 Business workspaces,4 approved audit USD1 claims,4 team dimensions**,7-day synthetic entitlement/4 seats each, reminders and automatic conversions disabled. Catalog guard passed; preexisting rows/Auth identity and factor metadata/public functions/triggers/policies/grants/RLS compared unchanged under setup assertions. Existing **5 payment records/7 payment_record conversions** remeasured. Product launch switch/production/native unchanged, no provider/email/job/charge step invoked. Normal reviewed trigger callbacks seeded fixture rows using local claims; these are not genuine Auth authorization acceptance.

This supersedes fixture-pending text in FRE30 while preserving its contract,26 local checks/source comparison and original owner metadata as history. Business fixture preparation has now been owner-reported successful; genuine Business API acceptance remains pending. Previous Personal/Family/manual/orphan conversion data was preserved under full private row comparison. This receipt does not independently remeasure the manual checksum or full constraint/concurrent lifecycle acceptance.

## Pinned API batch

Use unchanged existing **check-stage-3-business-api.cjs** and **run-stage-3-business-acceptance.ps1** from exact pin **70bc6676ee330162945ab3f3f04bbe97d532413f**. Current branch blob identities verified: checker f378118286b734cb31d14b15d161f47710556995/SHA256271de44135180253d90b87d88db6b71a1662ae41e6040134be9ed0f829886082, runner21de60016e542091ca6442a6b4e7b087fd956abd/SHA2563c8d8dc0e777562889f758c24d36511c0172d48f1ae3de5e175de7b1dfbe5dc3. Both ASCII-only, so the existing runner's stdin text transport does not introduce the prior Unicode SQL separator problem. No checker implementation change or repeated local database suite introduced here.

Current handoff pasted in chat: fetch audit branch, verify pin, Node reads immutable git-object bytes and checks BOTH exact SHA256/ASCII contracts plus checker syntax **before passwords/network**. Then load the known ASCII runner as an inline PowerShell scriptblock. No execution-policy weakening or source/native project edit. New outer wrapper restores any preexisting process environment values for Business code pin/password variables; existing runner securely prompts staging APP passwords, releases SecureString/BSTR buffers, clears transient environment values and reports safe JSON/exit code. Never enter a database password or paste credentials in chat. New Node integrity snippet syntax checked locally; native Windows PowerShell execution is not claimed until the owner runs it.

The unchanged API checker was exercised against54 ordered migrations in FRE30 using actual PostgreSQL functions/triggers/RLS and synthetic Auth/HTTP/Storage ports. Positive lifecycle **24 PASS scoped checks/5 unavailable prerequisite groups/484 modeled requests**; five fault regressions detect missing/false denial/hidden write/foreign read/logout failure. Total26 prior fixture/checker model cases PASS/exit0. These previous local counts are not hosted results. Current implementation identities were reverified rather than redundantly rerunning an unchanged suite.

## Expected hosted effects and boundaries

Two genuine password sign-ins, identity readbacks, ordinary-active account controls and exact current fixture prerequisites before mutations. Staging frontend config must target dczlddwbtgvfdujgcitb with push disabled. Two distinct workspaces, active4-seat synthetic entitlement, six pristine built-in roles/no overrides, exactUSD1 claims/dimensions/settings required. Bounded1400 requests/20-second per-request timeout; redirects rejected. No new Auth account/factor/platform-admin/launch change, Edge mailer/dispatch job/provider/charge/native step requested.

Selected role/permission/claim/report/scope/invitation/escalation/removal checks operate on these fixtures. Expected legitimate mutations include custom role create/edit/archive, invitation create/edit/cancel/accept, six built-in role transitions/scopes/overrides, synthetic claim/budget/report-export/audit records, and removal of only the member joining the primary test Business. Synthetic state is intentionally retained for exact follow-up, not broadly deleted. Denials require appropriate authorization error or zero-row effect plus protected owner readbacks, not arbitrary500/FK/function-not-found. Final checks compare selected second Business state and preexisting Personal/Family/payment/conversion/settings data against private baseline. Only newly created two test sessions get scope=local logout. Failure reports residual effects and stops; do not rerun/clean until reviewed.

Five prerequisites stay separately BLOCKED: valid private-receipt submit/review/replay; private original/download authorization; bill/spending-request lifecycle not selected for this two-account batch; nonowner manager removing a third ordinary member; isolated suspended/expired entitlement cases. Full role-operation matrix/private-file/provider/concurrent lifecycle/fullF15 acceptance remains pending even if24 selected checks pass.

## Owner handoff

Run the complete PowerShell below from C:\Users\HP\Desktop\Mushavo Budget. Enter only the two existing staging APP passwords when prompted, hidden locally. Return complete JSON and the printed Business API exit code. A successful scoped batch should return STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD; five unavailable groups remain separate. No additional SQL before this batch. Next is owner result review and scoped post-batch preservation/remaining-prerequisite planning.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }

$BusinessApiCommit = '70bc6676ee330162945ab3f3f04bbe97d532413f'
git cat-file -e ($BusinessApiCommit + '^{commit}')
if ($LASTEXITCODE -ne 0) { throw 'Pinned Business candidate unavailable.' }

$BusinessIntegrityCode = @'
const {execFileSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const {Script}=require('node:vm');
const pin=process.argv[1];
const expected={
 'scripts/check-stage-3-business-api.cjs':'271de44135180253d90b87d88db6b71a1662ae41e6040134be9ed0f829886082',
 'scripts/run-stage-3-business-acceptance.ps1':'3c8d8dc0e777562889f758c24d36511c0172d48f1ae3de5e175de7b1dfbe5dc3'
};
try {
 for(const [path,hash] of Object.entries(expected)) {
  const bytes=execFileSync('git',['show',pin+':'+path],{stdio:['ignore','pipe','pipe']});
  if(bytes.some(x=>x>127)||createHash('sha256').update(bytes).digest('hex')!==hash) throw new Error();
  if(path.endsWith('.cjs')) new Script(bytes.toString('utf8'));
 }
 console.log('Pinned Business checker and runner integrity passed.');
} catch {
 console.log('Pinned Business integrity check failed. No API batch started.');
 process.exitCode=1;
}
'@
node -e $BusinessIntegrityCode $BusinessApiCommit
if ($LASTEXITCODE -ne 0) { throw 'Business integrity verification failed.' }

$BusinessRunnerLines = git show (
    $BusinessApiCommit + ':scripts/run-stage-3-business-acceptance.ps1'
)
if ($LASTEXITCODE -ne 0 -or -not $BusinessRunnerLines) {
    throw 'Pinned Business runner unavailable.'
}
$BusinessRunnerCode = $BusinessRunnerLines -join [Environment]::NewLine

$BusinessPreviousEnvironment = @{}
foreach ($BusinessEnvName in @(
    'MUSHAVO_STAGE3_BUSINESS_COMMIT',
    'MUSHAVO_BUSINESS_OWNER_PASSWORD',
    'MUSHAVO_BUSINESS_MEMBER_PASSWORD'
)) {
    $BusinessPreviousEnvironment[$BusinessEnvName] =
        [Environment]::GetEnvironmentVariable($BusinessEnvName, 'Process')
}

try {
    $env:MUSHAVO_STAGE3_BUSINESS_COMMIT = $BusinessApiCommit
    & ([scriptblock]::Create($BusinessRunnerCode))
}
finally {
    foreach ($BusinessEnvName in $BusinessPreviousEnvironment.Keys) {
        [Environment]::SetEnvironmentVariable(
            $BusinessEnvName,
            $BusinessPreviousEnvironment[$BusinessEnvName],
            'Process'
        )
    }
    $BusinessPreviousEnvironment.Clear()
}
```

## Carry-forward

All original Stage0–10 objects/123 coverage rows/20 finding definitions/FRE01–30 receipts/events/actions/decisions and FR.2.2 completion/history retained. Existing two old orphan conversions and two locked manual Family USD1 conversions/checksum carry forward; no cleanup authorized by shape/correlation. Full gate OPEN_PENDING_REQUIRED_EVIDENCE; final audit PLANNED_NOT_PERFORMED, full hosted/native/store acceptance false, APK deferred. No finding is closed by fixture preparation.

## Superseding first owner API outcome and paused rerun — FRE32

[Owner result](security-fr-2-business-api-first-owner-result.json),18:50:25.365 UTC:5 PASS/1 REVIEW,118 requests,exit1 POSITIVE_ARCHIVE_BUSINESS_ROLE_FAILED; both sessions logged out. The prior checker/model assumed200 for void RPCs, although PostgREST documents204. [Corrected harness and read-only role state handoff](SECURITY_FR_2_3_BUSINESS_VOID_RPC_CORRECTION_AND_ROLE_STATE_HANDOFF.md) has50 local tests PASS and separately reproduces the same118-request stop with modeled role archived/version3. Actual hosted status/state pending. Previous pinned70bc terminal block above is retained as history and must not be rerun now; current terminal artifact is paused, use read-only SQL only. No archived role/audit cleanup or backend function replacement authorized by this result.
