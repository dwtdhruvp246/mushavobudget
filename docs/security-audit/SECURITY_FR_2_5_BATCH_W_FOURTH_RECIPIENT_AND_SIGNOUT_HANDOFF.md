# Add the current test recipient and deploy the signout correction

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner ran the mail readiness diagnostic with the newly clarified test mailbox. The selected three-recipient packet excludes that mailbox: RECIPIENT_NOT_IN_SELECTED_PACKET, source hashes6, CurrentUser DPAPI read completed, packet unchanged, provider/email requests0, combined exit1. [Receipt](security-fr-2-batch-w-owner-current-recipient-absent.json). Provider refresh/sender flags are **not run**, not failed. The absent retained recipient is consistent with canonical begin503 MAIL_UNAVAILABLE, but live Cloudflare secret equality and the sole live failure cause are not established.

The new updater preserves all three stored addresses and adds the current private test mailbox as number4. It rejects unexpected counts, duplicate stored entries and foreign scope. It writes a new encrypted pending packet with readback, preserves the original and copies **recipient JSON only** to clipboard. No provider credential is copied. [Contract](security-fr-2-batch-w-fourth-recipient-contract.json), [local15/15](security-fr-2-batch-w-fourth-recipient-local-checks.json). Windows new write/clipboard execution is pending.

## Prepare once

The chat command uses the exact previously reported three-address packet and current controlled test mailbox. Public form below asks for those private selections locally. Use that three-recipient packet, or its explicitly selected already-prepared four-recipient successor for idempotent recopy. Keep the earlier two-recipient and three-recipient backups.

The same command uses the exact accepted smooth-signin ZIP to build the already published signout/reload correction; it verifies29 package inputs and changes app.js/app.html only, preserving42 public entries and the input ZIP. This combines the pending signout fix and recipient setting into one upcoming staging upload. Preparation itself makes **0 hosted/email/settings/SQL/account writes** and changes no live deployment.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '851c0fcba7cc324d8be6589d4ffdd804456ae5e3'
    $EntryHash = '42c4e8f110157eca59e8e6c9929bcf908df068d2ab561dcc7207f5e483a876aa'
    $PackageHash = 'd83a7cfa7a967f9c31a4a1139327b0c83f1d599c20e5050513d34f959edbf30d'
    $TestEmail = (Read-Host 'Current controlled sign-in mailbox (address only)').Trim()
    $PacketFile = ''
    $RetainedZIP = 'C:\Users\HP\Desktop\Mushavo-W-SmoothSignIn-f0b6fdc702dd4342818afe78c9987440\mushavo-smooth-signin-staging.zip'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - prepare fourth recipient and sign-out ZIP.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-fourth-recipient-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-fourth-recipient.ps1'
        $Packager = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-signout-entry.mjs'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }
        if ((Get-FileHash -LiteralPath $Packager -Algorithm SHA256).Hash.ToLowerInvariant() -cne $PackageHash) {
            throw 'PACKAGE_SOURCE_IDENTITY_REQUIRED'
        }

        $ParseTokens = $null
        $ParseIssues = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile(
            $Entry, [ref]$ParseTokens, [ref]$ParseIssues
        )
        if ($ParseIssues -and $ParseIssues.Count -gt 0) { throw 'POWERSHELL_PARSE_REQUIRED' }

        if (-not (Test-Path -LiteralPath $RetainedZIP -PathType Leaf)) {
            $RetainedZIP = (Read-Host 'Full path to existing mushavo-smooth-signin-staging.zip').Trim().Trim('"')
        }
        $RetainedZIP = (Resolve-Path -LiteralPath $RetainedZIP).ProviderPath
        if (-not (Test-Path -LiteralPath $PacketFile -PathType Leaf)) { $PacketFile = '' }

        $Result = & $Entry -SnapshotRoot $Snapshot -ExpectedSourceSHA256 $EntryHash -TestEmail $TestEmail -PacketFile $PacketFile -RetainedZIP $RetainedZIP
        if ($Result -ne 0) { throw 'RECIPIENT_PREPARATION_REQUIRED' }

        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-RecipientAndSignOut-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null
        & node $Packager $RetainedZIP $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'SIGNOUT_PACKAGE_REQUIRED' }

        $BatchExit = 0
        Write-Host ('Created ZIP folder: ' + $OutputFolder)
        Write-Host 'Paste the recipient JSON into Cloudflare before copying console output.'
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'FOURTH_RECIPIENT_AND_SIGNOUT_PREPARATION_REVIEW_REQUIRED'
            actual_hosted_requests = 0
            real_email_requests = 0
            frontend_uploaded = $false
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined recipient and sign-out preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}

```

## Apply only after combined exit0

1. In Cloudflare **Workers & Pages → mushavo-budget-staging → Settings → Variables and Secrets**, update **ZOHO_TEST_RECIPIENTS_JSON** as secret text with the prepared recipient JSON. Review that all existing approved recipients are included. Use only the **Production and Preview environments of this staging project**; the production website/project is outside scope.
2. Paste the clipboard value before copying console output. Save the one recipient setting in both staging-project environments; no provider keys, other settings or SQL change.
3. Upload the newly created **mushavo-signout-entry-staging.zip**, shown in the opened Desktop folder. This ZIP includes the earlier published signout/reload fix, not the old trusted-browser UI. The recipient secret is runtime environment configuration and is not embedded in the ZIP.
4. Return safe preparation JSON, new deployment URL, and whether this setting was saved in both staging environments. No additional code-send retry is requested until setting save/deployment is confirmed. Do not paste the recipient JSON, encrypted file, provider values or private hashes in the public receipt.

No provider token rotation or new password/account/delete-user/recovery/window operation is justified by this membership result. Actual provider health and live dispatch remain untested. Earlier code/recovery scope is preserved for its original mailbox; it does not authorize another actor's application window. The current mailbox's code delivery, authenticated proof and dashboard outcome remain pending scoped evidence. The staging proof/window gate is not weakened.

AU05.03 remains owner PASS and is not repeated. Frozen31 unchanged; V Admin MFA ON HOLD, mismatch prominence deferred, full W/FR.2/Stage3/release/findings open, production/native unchanged, APK deferred.
