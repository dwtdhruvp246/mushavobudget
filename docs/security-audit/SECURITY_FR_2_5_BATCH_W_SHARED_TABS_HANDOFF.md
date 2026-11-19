# Normal tabs share sign-in and sign-out

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The [owner clarifies](security-fr-2-batch-w-owner-shared-normal-tab-policy.json) that all normal app tabs in the same browser/profile and origin should follow the same sign-in, current account and sign-out. The previous per-tab stay-at-sign-in expectation was an implementation/UX rule, not a frozen security requirement. Earlier owner observations remain historically accurate but that expectation is superseded. Recovery/invitation setup continues to use its existing isolated client until verified intended adoption; no real recovery email is requested while this correction is being prepared.

## Fix ready, not deployed

Source **7005e81825049510aa8b45c08d21c42031328794** changes only public **app.js and app.html**, app version **122**. [Contract](security-fr-2-batch-w-shared-tabs-contract.json), [129/129 selected local checks](security-fr-2-batch-w-shared-tabs-local-checks.json), [28 verified source inputs](security-fr-2-batch-w-shared-tabs-source-manifest.json).

A signed-out app tab now resumes a genuinely new shared SDK sign-in, including a new login by the same account. Repeated events/refresh for the session involved in a failed sign-out keep the explicit retry outcome. Session claims are an in-memory navigation hint; every resumed private load still requires the normal server session/role/tenant checks. Queued loads bind actor/token/epoch, old private state is reset, and a delayed cleanup does not sign out a replacement account or same-account new session. Auth callbacks defer SDK work until after callback return. No additional persistent value, channel, code/trusted-device gate, Auth setting, SQL, Worker or service-worker change.

The local run has **122 runtime/callback/password/recovery/invitation/startup tests plus 7 package checks**, zero failures. These use synthetic Auth transports and do not prove actual hosted browser broadcasting, live timing or full Business/in-flight scope. PowerShell below follows the prior working owner template and is manually reviewed, not executed on Windows by the assistant.

## Prepare the one staging ZIP

Run this complete command in the owner's normal PowerShell session. It archives the frozen published source without modifying the working checkout, verifies the helper/manifest hashes, finds the existing accepted **mushavo-fast-signin-staging.zip** under Desktop/Mushavo-W-FastSignIn-* (or asks for its path), checks all 42 predecessor entry hashes, and writes **mushavo-shared-tabs-staging.zip** into a new Desktop/Mushavo-W-SharedTabs-* folder. Forty entries, configuration, public push settings, Worker, service worker, headers/routes and the original ZIP remain byte-preserved. No new installation, private packet, token or password prompt.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '7005e81825049510aa8b45c08d21c42031328794'
    $EntryHash = '11f04d459e23564694e382c590f56da2a934b77a7b172c50ccffa4d225a842e4'
    $ManifestHash = '5a62343e99d8e634cd02bcd46cb1d9ab899c6392f1ec637f68681c6ed4893326'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - shared sign-in and sign-out across normal tabs.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-shared-tabs-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-shared-tabs.mjs'
        $Manifest = Join-Path $Snapshot 'docs\security-audit\security-fr-2-batch-w-shared-tabs-source-manifest.json'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) { throw 'SOURCE_IDENTITY_REQUIRED' }
        if ((Get-FileHash -LiteralPath $Manifest -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestHash) { throw 'MANIFEST_IDENTITY_REQUIRED' }

        $DesktopFolder = Split-Path $Project -Parent
        $Candidates = @(Get-ChildItem -LiteralPath $DesktopFolder -Directory -Filter 'Mushavo-W-FastSignIn-*' | ForEach-Object {
            $Candidate = Join-Path $_.FullName 'mushavo-fast-signin-staging.zip'
            if (Test-Path -LiteralPath $Candidate -PathType Leaf) { $Candidate }
        })
        if ($Candidates.Count -eq 1) {
            $RetainedZIP = $Candidates[0]
        } else {
            $RetainedZIP = (Read-Host 'Full path to existing mushavo-fast-signin-staging.zip').Trim().Trim('"')
        }
        $RetainedZIP = (Resolve-Path -LiteralPath $RetainedZIP).ProviderPath
        $OutputFolder = Join-Path $DesktopFolder ('Mushavo-W-SharedTabs-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null

        & node $Entry $RetainedZIP $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'SHARED_TABS_PREPARATION_REQUIRED' }
        $BatchExit = 0
        Write-Host ('Created ZIP folder: ' + $OutputFolder)
        Write-Host 'Upload mushavo-shared-tabs-staging.zip to the same staging project. No SQL update is needed.'
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'SHARED_TABS_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            SQL_rerun_required = $false
            actual_hosted_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined shared-tabs preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

## Upload and bounded two-tab acceptance

After preparation exit 0, upload **mushavo-shared-tabs-staging.zip** to the same **mushavo-budget-staging** Pages project. Return its deployment URL and preparation result. No SQL or settings update is needed. Actual hosted acceptance is still pending; do not credit the old f8c4b8d6 deployment with new behavior.

Open the **same new deployment URL** in two normal tabs of the same browser/profile. Different preview origins/private profiles do not share Auth storage. Sign in once if needed, sign out once in one tab and expect both to show sign-in, then sign in once more in either tab and expect both to open the same authorized account dashboard without refreshing. A second password sign-in after signout exercises the corrected guard. Stop and report a displayed error/unexpected old-account content rather than repeat attempts. Maximum two manual password sign-ins and one signout for this retest, no code/email request.

The previously prepared AU04.06 real-link test is paused. Do not reuse or request a recovery email for it now. Once this frontend is accepted, resolve the actual test origin/callback readiness before continuing the existing recovery case. The saved exact f8c4b8d6 callback remains owner-reported configuration evidence, not a callback allowance for any later preview.

Original 31 AU definitions and every prior event/pass/failure scope remain intact. This is a product-behavior clarification and correction inside AU05.06, not an added public case or full-case completion. AU05.03 owner PASS and password-mismatch prominence deferral remain. Password-only sign-in for all roles remains; no signup-confirmation, role/ownership/tenant permission or secure-password-change control is removed. V stays on hold with policy reconciliation before future factors; stronger-MFA criteria remain unmet. Full W/FR.2/Stage 3/re-audit/release/findings stay open; production/native unchanged, APK deferred.

Primary design references: [Supabase Auth notifications](https://supabase.com/docs/reference/javascript/auth-onauthstatechange) and [session identity](https://supabase.com/docs/guides/auth/sessions). The installed server session contract remains the authority; an unsigned decoded session hint never replaces it.
