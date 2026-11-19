# Faster password sign-in dashboard startup

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner confirms direct email/password sign-in reaches the dashboard on [deployment 8317ea3c](https://8317ea3c.mushavo-budget-staging.pages.dev/), while the branded Signing in screen feels slow. [Owner receipt](security-fr-2-batch-w-owner-password-signin-dashboard-and-loading.json). This is a scoped ordinary-signin pass; signout/reload, Admin role behavior, older valid-password variant and whole W acceptance are not inferred.

The frontend-only change is published at **e62f74494f4c828cdb4a748b2f175d6dfa431d67**. [Contract](security-fr-2-batch-w-fast-signin-contract.json), [119 selected local passes](security-fr-2-batch-w-fast-signin-local-checks.json). Independent gates overlap after the unchanged first server session check; family selection and catalogue loading overlap; a single startup personal-plan check runs with subscription requests. All checks still gate protected startup/provisioning, and the dashboard waits for complete required data. Stale actor/token/ticket work refuses. No artificial minimum delay was found. Live elapsed time was not supplied or measured, so no millisecond or percentage promise is made.

## Prepare one frontend ZIP

Use the existing **mushavo-password-signin-staging.zip** from the current deployment. The command finds a unique matching Desktop preparation folder or asks for its path. It checks 27 pinned sources and all 42 input file identities, patches only app.js/app.html and preserves the other 40 entries plus the retained input. Config, Worker, service worker, headers/routes and installed database policy stay unchanged. No SQL, mail, credentials, secrets or provider requests are involved.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = 'e62f74494f4c828cdb4a748b2f175d6dfa431d67'
    $EntryHash = '61029d66d4948da906e2735a9f10590f18149a18ba0cb4b120bd2d87598f258e'
    $ManifestHash = '3cd55c1049687fdfcdc5372d3eeff2c6489f523c8a4efdcd0555bdb00ba4fe48'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - faster dashboard startup.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-fast-signin-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-fast-signin.mjs'
        $Manifest = Join-Path $Snapshot 'docs\security-audit\security-fr-2-batch-w-fast-signin-source-manifest.json'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) { throw 'SOURCE_IDENTITY_REQUIRED' }
        if ((Get-FileHash -LiteralPath $Manifest -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestHash) { throw 'MANIFEST_IDENTITY_REQUIRED' }

        $DesktopFolder = Split-Path $Project -Parent
        $Candidates = @(Get-ChildItem -LiteralPath $DesktopFolder -Directory -Filter 'Mushavo-W-PasswordSignIn-*' | ForEach-Object {
            $Candidate = Join-Path $_.FullName 'mushavo-password-signin-staging.zip'
            if (Test-Path -LiteralPath $Candidate -PathType Leaf) { $Candidate }
        })
        if ($Candidates.Count -eq 1) {
            $RetainedZIP = $Candidates[0]
        } else {
            $RetainedZIP = (Read-Host 'Full path to existing mushavo-password-signin-staging.zip').Trim().Trim('"')
        }
        $RetainedZIP = (Resolve-Path -LiteralPath $RetainedZIP).ProviderPath
        $OutputFolder = Join-Path $DesktopFolder ('Mushavo-W-FastSignIn-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null

        & node $Entry $RetainedZIP $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'FAST_SIGNIN_PREPARATION_REQUIRED' }
        $BatchExit = 0
        Write-Host ('Created ZIP folder: ' + $OutputFolder)
        Write-Host 'Upload mushavo-fast-signin-staging.zip to staging. No SQL update is needed.'
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'FAST_SIGNIN_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            SQL_rerun_required = $false
            actual_hosted_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined fast-signin preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

## Deploy and check

1. After combined preparation exit code 0, upload **mushavo-fast-signin-staging.zip** from the opened folder to **mushavo-budget-staging**. **No SQL rerun.**
2. Open [the staging app](https://mushavo-budget-staging.pages.dev/app.html), sign in with the same existing confirmed account and check that the dashboard opens with a shorter wait and no custom verification/trust page. Then Sign out and reload to the normal sign-in form.
3. Return the preparation output, new deployment URL and observed loading/signout outcome. If still slow, include the approximate loading duration; do not send passwords or tokens. The update's real speed remains pending that check.

The accepted predecessor input is verified per file because its full ZIP preparation result/hash was not supplied. Wrong/modified input refuses before any artifact is written. Old password-signin package scripts/source manifests are historical at their exact pins; use this dedicated patch snapshot. The positive actual Windows input package is owner-side; local package tests use canonical fixtures plus negative CLI/path checks. Browser rendering and live network latency are not simulated as acceptance.

Original 31 AU definitions and all prior results remain; this adds no public case. Backend installation remains owner PASS. V remains on hold with policy reconciliation before future factors, stronger-MFA findings are not closed, and mismatch visibility stays deferred. Full W/FR.2/Stage 3/re-audit/release remain open. Production/native unchanged, APK deferred. Keep the visible stage prefix on every update.
