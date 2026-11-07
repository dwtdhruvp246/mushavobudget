# FR.2.2 — controlled Personal API recheck

14 October 2026. [Installed metadata checkpoint](SECURITY_FR_2_2_INSTALLATION_CHECKPOINT.md); [source/effect contract](security-fr-2-personal-api-recheck-contract.json).

Run this complete PowerShell in C:\Users\HP\Desktop\Mushavo Budget. It reads the immutable reviewed runner without changing the working checkout or execution policy. Enter only the two existing synthetic staging APP passwords when prompted. The runner fetches the checker from the same pin. No separate SQL/frontend upload is needed for this bounded batch.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }

$PersonalRecheckCommit = 'aef5ff503737972b5148a3a32828ff7cdc9c1652'
git cat-file -e ($PersonalRecheckCommit + '^{commit}')
if ($LASTEXITCODE -ne 0) { throw 'Pinned recheck commit unavailable.' }

$PersonalRunnerLines = git show (
    $PersonalRecheckCommit + ':scripts/run-stage-3-personal-acceptance.ps1'
)
if ($LASTEXITCODE -ne 0 -or -not $PersonalRunnerLines) {
    throw 'Pinned Personal runner unavailable.'
}
$PersonalRunnerCode = $PersonalRunnerLines -join [Environment]::NewLine

$PreviousPersonalPin = $env:MUSHAVO_STAGE3_PERSONAL_COMMIT
try {
    $env:MUSHAVO_STAGE3_PERSONAL_COMMIT = $PersonalRecheckCommit
    & ([scriptblock]::Create($PersonalRunnerCode))
}
finally {
    if ($null -eq $PreviousPersonalPin) {
        Remove-Item Env:MUSHAVO_STAGE3_PERSONAL_COMMIT -ErrorAction SilentlyContinue
    } else {
        $env:MUSHAVO_STAGE3_PERSONAL_COMMIT = $PreviousPersonalPin
    }
}
```

Send the complete safe JSON and exit/result line after it finishes. Expected successful scope: 33 PASS, result STAGING_PERSONAL_CRUD_SCOPED_PASS, exact new fixture rows removed and test sessions logged out. The JSON keeps stage_step 3.2.1 because the reviewed checker is unchanged; record its new execution under FR.2.2. If there is a REVIEW/error, return it and stop before another run. Do not send passwords/tokens or manually remove retained fixtures. No valid-own-relink, historical repair, derived conversion cleanup, complete acceptance or finding closure is implied.
