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
