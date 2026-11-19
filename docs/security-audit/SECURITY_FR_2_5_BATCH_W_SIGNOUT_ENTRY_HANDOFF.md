# Sign-out and reload stay on sign-in

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner clarified that the recurring verification screen appeared after sign-out/reload before selecting Offline. That clarification supersedes the initial offline-trigger candidate in FRE257; the previous receipt remains historical.

The source ignored existing manual-entry URL intent and waited for push cleanup before signing out. A delayed-cleanup test reproduced a reload entering verification with the still-stored SDK session. The correction records sign-out intent first, clears private views and honors manual entry on reload. Failed Auth logout stays visible with an explicit retry; ordinary authenticated entry still requires server proof. The URL marker cannot authorize access or claim logout succeeded.

[Contract](security-fr-2-batch-w-signout-entry-contract.json); [local checks](security-fr-2-batch-w-signout-entry-local-checks.json); [owner clarification](security-fr-2-batch-w-owner-signout-reload-clarification.json). Runtime154/154 and package8/8 passed. These are synthetic source checks; live session storage/logout and the sole live cause have not been inspected.

## Prepare and upload

Use the existing accepted **mushavo-smooth-signin-staging.zip**, SHA256 e49c866aa56aa3d634ef78cf8ea37c77e5a19143e7a5e0a5e63f67e28c8cb05e, from the owner smoothing folder. The command archives source pin 522c883f50724efdd4daf967200bc4934eeb7a51 without changing the working copy, verifies the preparer and29 source identities, and creates a new **mushavo-signout-entry-staging.zip**. Only app.js/app.html change;42 other entries and the input are preserved. Raw HTML is transformed to staging origins as in the accepted exporter. No new password, recovery, SQL/window, email/code, secret or settings action is requested.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '522c883f50724efdd4daf967200bc4934eeb7a51'
    $EntryHash = 'd83a7cfa7a967f9c31a4a1139327b0c83f1d599c20e5050513d34f959edbf30d'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - sign-out and reload fix.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }

        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-signout-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null

        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-signout-entry.mjs'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }

        $Retained = 'C:\Users\HP\Desktop\Mushavo-W-SmoothSignIn-f0b6fdc702dd4342818afe78c9987440\mushavo-smooth-signin-staging.zip'
        if (-not (Test-Path -LiteralPath $Retained -PathType Leaf)) {
            $Retained = (Read-Host 'Full path to existing mushavo-smooth-signin-staging.zip').Trim().Trim('"')
        }
        $Retained = (Resolve-Path -LiteralPath $Retained).ProviderPath
        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-SignOut-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null

        & node $Entry $Retained $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'SIGNOUT_PACKAGE_REQUIRED' }

        $BatchExit = 0
        Write-Host ('Created ZIP folder: ' + $OutputFolder)
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'SIGNOUT_ENTRY_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            actual_hosted_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined sign-out package exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

After combined exit0, upload the newly created ZIP to **mushavo-budget-staging**. Return the safe JSON and new deployment URL. The new package is not yet owner-prepared or deployed.

## Scoped browser check after deployment

Open the fresh canonical [app](https://mushavo-budget-staging.pages.dev/app.html), use **Sign out**, then reload once. Expect the sign-in form; **Verify your sign-in** must not open automatically. If logout failed, the sign-in form must show the persistent warning and **Retry sign-out**. Preserve cookies/storage and the account; do not replay a consumed confirmation/recovery callback. Return the visible page/message and whether this happened before any new password login. No mail or password cycle is required to prove the logged-out entry.

A real SDK logout failure is not converted to success. The retry keeps the actual SDK session available for explicit cleanup; private views remain cleared. A later fresh authenticated sign-in can still be denied by the existing closed staging window. That fence does not justify opening verification on explicit manual/signed-out UI.

The pending AU05.03 network exercise is paused because the reported trigger preceded selecting Offline. Related existing AU05.04/AU05.05/AU05.06 variants remain open until their actual scoped hosted evidence is supplied; this check adds no new acceptance case to the frozen31. Prior successful normal sign-in/recovery scope is preserved. Password-mismatch prominence remains deferred; V Admin MFA stays ON HOLD for the owner phone transfer. Full W/FR.2/Stage3/release/findings remain open, production/native unchanged, APK deferred.
