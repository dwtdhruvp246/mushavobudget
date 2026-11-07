# Recovery verification opens the app automatically

Stage 3/10 | FR.2/8 | Batch W/Z — FRE251, 27 October 2026.

The owner reached the old recovery continuation screen after Verify and requested automatic sign-in. The ordinary recovery path now continues directly through the existing identity, saved-password, current proof and destination guards, adopts that same account and navigates automatically. Wrong codes remain on verification. No additional account checkbox or Continue to app action is needed. Business invitation and unfinished Admin invitation setup choices remain explicit; signup confirmation still returns to manual sign-in.

Source pin: 5fce41918705643b3c80219b421cdaf66b74a61d. Only auth-flows.js, auth-security.js (comment only) and auth.html change in the accepted 44-entry archive; the other 41 entries remain byte-identical, including Worker, service worker, configuration, headers and routes. Module cache versions are bumped. No SQL, secret, account or production/native changes are required.

[Contract](security-fr-2-batch-w-auto-entry-contract.json), [owner screen receipt](security-fr-2-batch-w-owner-recovery-continue-screen.json), [17 source identities](security-fr-2-batch-w-auto-entry-source-manifest.json), [64/64 targeted local checks](security-fr-2-batch-w-auto-entry-local-checks.json). These are local fixtures and package checks, not live acceptance. The actual accepted Windows ZIP is unavailable here; the command below verifies it and the prepared archive. Windows .NET readback is not claimed.

Run in Windows PowerShell from the existing project. It fetches without checking out or changing the working copy, reads the pinned source, preserves the old ZIP, and creates a new public ZIP in a new Desktop folder.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '5fce41918705643b3c80219b421cdaf66b74a61d'
    $EntryHash = '807ed23faa56cc0028ec9ff99856787a5746446115ab73d8efbc0d33e87c48f4'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - automatic recovery sign-in.'
    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-auto-signin-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot
        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-auto-entry.mjs'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }

        $Retained = 'C:\Users\HP\Desktop\Mushavo-W-Browser-Trust-6641fcf8c4a243078b7245b2c6bbe293\mushavo-trusted-browser-staging.zip'
        if (-not (Test-Path -LiteralPath $Retained -PathType Leaf)) {
            $Retained = (Read-Host 'Full path to existing mushavo-trusted-browser-staging.zip').Trim().Trim('"')
        }
        $Retained = (Resolve-Path -LiteralPath $Retained).ProviderPath
        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-AutoSignIn-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null
        & node $Entry $Retained $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'PUBLIC_ZIP_PREPARATION_REQUIRED' }
        $BatchExit = 0
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'AUTO_SIGNIN_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            actual_hosted_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined automatic-signin preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

On exit 0, upload the new mushavo-auto-signin-staging.zip to Cloudflare Pages project mushavo-budget-staging. Return its safe preparation JSON and new deployment URL. Do not upload the old trusted-browser ZIP again. No password/code/secret/SQL action is requested by this preparation step.

Keep the currently open recovery tab: it has the old JavaScript and deployment does not replace its running code. Do not refresh or reuse the consumed recovery link. To finish that already verified old-build attempt, its existing checkbox and Continue can still be used once. Updated automatic-entry acceptance needs a fresh callback from the updated staging build; do not request a new link or reset the password yet. The last reported application-window expiry is historical, not proof of a current window.

AU04.05 and full W/FR.2/Stage3/release/findings stay open. No new public acceptance cases are added (frozen31). The separate background-verification performance polish and password-mismatch highlighting remain deferred; this requested removal of the recovery continuation step is implemented now. Batch V Admin MFA remains on hold; APK update remains deferred.
