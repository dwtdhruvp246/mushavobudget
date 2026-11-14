# Corrected password sign-in SQL retry

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner supplied a staging SQL Editor screenshot with `PASSWORD_SIGNIN_NEW_AUTHORITY_REQUIRED`, SQLSTATE P0001, DO line 207. The new policy did not reach its success/commit. [Failure/reproduction](security-fr-2-batch-w-password-signin-sql-failure.json).

The old pinned script reproduces exactly that error and line when the clipboard converts LF to Windows CRLF. Its raw source-hash comparison rejected the same function with different newlines. The corrected installer canonicalizes only CRLF inside the fixed reviewed component before execution; all exact digest, ACL, role/session, 148 RPC, 82 policy and catalogue guards remain. The live pasted bytes were not provided, so the reproduction is not a separate readback of the live error's individual boolean clause.

**The frontend and Worker are unchanged.** If the password-signin ZIP is already uploaded, keep that deployment. If it has only been prepared, upload that existing ZIP once before testing; do not rebuild it for this SQL correction. The owner has not supplied a new ZIP receipt/deployment URL here. No old mail/recipient/code/rate/window action is required. All-user scope includes Admin and stays authorized.

[17 database + 8 package checks pass](security-fr-2-batch-w-password-signin-sql-line-endings-checks.json), including CRLF/mixed-newline install and exact quarantined rollback, and denial of changed semantics or extra authority. The previous 100 runtime checks remain at their unchanged source pin; they were not rerun for this SQL-only correction. Source pin **0073292982cfa4b644d7cfaf5efa88e10f740af7**.

## Prepare the corrected SQL files

This pinned PowerShell command exports exactly the install/rollback sources, checks both SHA256 identities, saves a new Desktop folder and copies the complete install SQL to the clipboard. It sends no email and applies no SQL or hosted settings.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '0073292982cfa4b644d7cfaf5efa88e10f740af7'
    $InstallHash = '14637a243fb514b32bab8de8d877181060d7bbb2dee9eb8ec638e35e4bc1e4ad'
    $RollbackHash = '3ebcb1b32336364287d7a049115454456bed7b20af9dafd917e63d52d3f30376'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - corrected SQL only.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-signin-sql-' + [guid]::NewGuid().ToString('N'))
        $Archive = Join-Path $TaskRoot 'source.zip'
        $Snapshot = Join-Path $TaskRoot 'source'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        $Paths = @('supabase/candidates/security_fr_2_5_password_signin_upgrade.sql', 'supabase/candidates/security_fr_2_5_password_signin_rollback.sql')
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit $Paths
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $InstallSource = Join-Path $Snapshot 'supabase\candidates\security_fr_2_5_password_signin_upgrade.sql'
        $RollbackSource = Join-Path $Snapshot 'supabase\candidates\security_fr_2_5_password_signin_rollback.sql'
        if ((Get-FileHash -LiteralPath $InstallSource -Algorithm SHA256).Hash.ToLowerInvariant() -cne $InstallHash) { throw 'INSTALL_SOURCE_REQUIRED' }
        if ((Get-FileHash -LiteralPath $RollbackSource -Algorithm SHA256).Hash.ToLowerInvariant() -cne $RollbackHash) { throw 'ROLLBACK_SOURCE_REQUIRED' }

        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-SQLFix-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null
        $InstallSQL = Join-Path $OutputFolder 'mushavo-password-signin-staging.sql'
        $RollbackSQL = Join-Path $OutputFolder 'mushavo-password-signin-rollback.sql'
        Copy-Item -LiteralPath $InstallSource -Destination $InstallSQL
        Copy-Item -LiteralPath $RollbackSource -Destination $RollbackSQL
        Set-Clipboard -Value ([IO.File]::ReadAllText($InstallSQL))

        $BatchExit = 0
        Write-Host ('Created SQL folder: ' + $OutputFolder)
        Write-Host 'Corrected install SQL is on the clipboard. Run it in staging Supabase.'
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'CORRECTED_SQL_PREPARATION_REVIEW_REQUIRED'
            SQL_applied = $false
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined corrected-SQL preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

## Apply and continue

1. After preparation exit code 0, in staging Supabase **dczlddwbtgvfdujgcitb → SQL Editor**, replace the failed query with the complete corrected **mushavo-password-signin-staging.sql** and Run. The install text is on the clipboard; if overwritten, open that saved file and copy it. The separate rollback file is retained for an emergency; it is not the normal install.
2. Expect **PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING** and catalog_identity_matched true. The statement is still atomic and refuses unexpected source/authority/catalogue conditions.
3. Once the existing password-signin frontend is uploaded and this SQL succeeds, open https://mushavo-budget-staging.pages.dev/app.html. Sign in with the existing confirmed account and expect the authorized dashboard without a custom email-code/trust page; Sign out and reload to the normal sign-in form.
4. Return the SQL result and observed sign-in/signout outcome, plus deployment URL if not yet supplied. Do not rerun old verification-window, recipient, recovery-account repair or rate-limit scripts.

Complete corrected [install SQL](../../supabase/candidates/security_fr_2_5_password_signin_upgrade.sql), unchanged [rollback SQL](../../supabase/candidates/security_fr_2_5_password_signin_rollback.sql). Signup confirmation/recovery and existing role permissions remain. Stronger-MFA findings are not satisfied; V stays on hold with policy reconciliation before future factor work. Frozen 31 AU cases and original findings/evidence remain intact, password-mismatch prominence is deferred. Full W/FR.2/Stage 3/re-audit/release remain open; production/native unchanged, APK deferred.
