> FRE254, 27 October2026: The previous preparation stopped before creating a ZIP because my app/Business HTML baseline used repository URLs instead of the recorded staging-export URLs. This handoff now uses corrected source 6be81d6534549e657d57444a841e27aa9f400527, preparer SHA256 2414be1ac6a9f092ad410d6a986ca6bd212b89e92e5daef76c258585cc28ce26, source30 and package9/9 PASS. Whole input archive identity and all per-file checks remain enforced. Updated HTML is transformed to staging before output; no production project reference is reintroduced. Reuse the same accepted auto-signin ZIP. On successful preparation the command prints and opens its new output folder. [Owner refusal](security-fr-2-batch-w-owner-smooth-signin-preparation-refusal.json), [correction checks](security-fr-2-batch-w-smooth-signin-baseline-fix-local-checks.json). No smooth-signin archive has yet been prepared/uploaded by the owner.

# Smooth background checking and verified sign-in

Stage 3/10 | FR.2/8 | Batch W/Z — FRE253, 27 October2026.

The owner reports that automatic recovery sign-in did what was expected at deployment5b278cbc, while criticizing glitches and the visible Verify your sign-in page. Record the functional result as owner-reported scoped UI PASS, not full AU04.05 or live security/timing acceptance. The owner has now requested the previously deferred background verification polish.

Source 6be81d6534549e657d57444a841e27aa9f400527 keeps approved-session checks in the existing app/Business loading view and makes callback checking a compact Signing in status. The full verification form appears when server state requires a code or an actionable error. Post-code completion stays on loading through automatic dashboard entry. Current actor/token tickets avoid one duplicate preparation request, while the independent remote user/server-proof checks still run. Successful password save and independent proof denial clear a prior ticket. No client flag grants app access; protected reads and navigation still require current proof. Invitation choices, unfinished Admin setup, signup confirmation/manual sign-in and separate Admin MFA are preserved.

[Contract](security-fr-2-batch-w-smooth-signin-contract.json), [owner receipt](security-fr-2-batch-w-owner-auto-entry-pass-and-smoothing-request.json), [local checks](security-fr-2-batch-w-smooth-signin-local-checks.json), [30 source identities](security-fr-2-batch-w-smooth-signin-source-manifest.json). Runtime140 retained and corrected package9 checks pass; prior runtime syntax11 and current packaging syntax2 pass. The same recovery fixture makes4 proof RPCs versus5 before. This does not establish live latency. Local browser rendering was unavailable because Chromium is not installed; no viewport/screenshot pass is claimed.

The preparer reads the accepted auto-signin ZIP SHA2561696a99a4fd5fde38210818ada25a983a352a5cb0b547294383b007aaa45865b, changes10 public files and preserves the remaining34 of44 plus the input archive. Worker/SW/configuration/headers/routes/SQL/Auth settings are untouched. Shared helper/CSS/page cache versions are updated. It performs no deployment, password/email, SQL, setting or account action. Actual owner archive readback remains pending.

Run in PowerShell:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '6be81d6534549e657d57444a841e27aa9f400527'
    $EntryHash = '2414be1ac6a9f092ad410d6a986ca6bd212b89e92e5daef76c258585cc28ce26'
    $OriginalLocation = Get-Location
    $BatchExit = 1
    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - smoother background sign-in.'
    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }
        $TaskRoot = Join-Path $env:TEMP ('mushavo-smooth-signin-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot
        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-smooth-signin.mjs'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }
        $Retained = 'C:\Users\HP\Desktop\Mushavo-W-AutoSignIn-36f5c85157f14f2986f57d8406c2aee1\mushavo-auto-signin-staging.zip'
        if (-not (Test-Path -LiteralPath $Retained -PathType Leaf)) {
            $Retained = (Read-Host 'Full path to existing mushavo-auto-signin-staging.zip').Trim().Trim('"')
        }
        $Retained = (Resolve-Path -LiteralPath $Retained).ProviderPath
        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-SmoothSignIn-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null
        & node $Entry $Retained $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'PUBLIC_ZIP_PREPARATION_REQUIRED' }
        $BatchExit = 0
        Write-Host ('Created ZIP folder: ' + $OutputFolder)
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'SMOOTH_SIGNIN_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            actual_hosted_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined smooth-signin preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

On exit0 upload the new mushavo-smooth-signin-staging.zip to Cloudflare Pages project mushavo-budget-staging, then return the safe preparation JSON and new deployment URL. No recovery/password/code or timed SQL action is requested during packaging. An already loaded tab keeps its old JavaScript; do not refresh or reuse a consumed email link. After deployment, inspect a fresh canonical staging load and the existing trusted-browser/post-code paths with current bounded readiness for any later recovery retry. Do not infer every unspecified glitch is solved or a speed target achieved until observed.

Background-polish status is now implemented locally/pending hosted UX and timing review. Password mismatch prominence stays separately deferred. No new public AU cases (frozen31). V MFA remains on hold; full W/FR.2/Stage3/release/findings open; production/native untouched and APK deferred.
