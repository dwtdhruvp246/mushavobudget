# Password sign-in for all users, including Admin

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner explicitly selected removal for **all users**, including Admin accounts, and asked to continue after interruption. [Owner policy](security-fr-2-batch-w-password-signin-owner-policy.json). This supersedes the custom email-code/trusted-browser requirement and temporary application-proof window. Signup email confirmation, recovery links, active/current Auth sessions and all existing role/ownership/membership/entitlement permissions remain.

The source is published at **628fcbede4dacbcbc248128b93e550631fb20990**. [Contract](security-fr-2-batch-w-password-signin-contract.json), [122/122 selected local checks](security-fr-2-batch-w-password-signin-local-checks.json). It is **not yet deployed or installed**. No further approval of the already selected scope is required.

## Prepare the ZIP and SQL files once

Use the retained signout-entry ZIP from deployment 490ba810, SHA256 e7de4e1b90d46a1503be5cf77fe7974b32d650fd526cb473c39002fe8cf1675b. The command verifies the immutable snapshot, entry and manifest, checks 34 source identities, preserves the input, and creates a new Desktop folder. It reads no private gateway packet and requests no provider credentials, email/code, account change or secret installation.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '628fcbede4dacbcbc248128b93e550631fb20990'
    $EntryHash = '7d10bc81592d5fd18d96ed2b63b158af6f9a574015094532a3aa6a8a5238a642'
    $ManifestHash = '0cc8914bddd5c7e28b582def6166338960478eb116c997bddccd1694b9c17772'
    $RetainedZIP = 'C:\Users\HP\Desktop\Mushavo-W-RecipientAndSignOut-e694046e2119458787b1212e3f1aefdb\mushavo-signout-entry-staging.zip'
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - remove custom sign-in verification for all users.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-password-signin-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-password-signin.mjs'
        $Manifest = Join-Path $Snapshot 'docs\security-audit\security-fr-2-batch-w-password-signin-source-manifest.json'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }
        if ((Get-FileHash -LiteralPath $Manifest -Algorithm SHA256).Hash.ToLowerInvariant() -cne $ManifestHash) {
            throw 'MANIFEST_IDENTITY_REQUIRED'
        }

        if (-not (Test-Path -LiteralPath $RetainedZIP -PathType Leaf)) {
            $RetainedZIP = (Read-Host 'Full path to existing mushavo-signout-entry-staging.zip').Trim().Trim('"')
        }
        $RetainedZIP = (Resolve-Path -LiteralPath $RetainedZIP).ProviderPath
        $OutputFolder = Join-Path (Split-Path $Project -Parent) ('Mushavo-W-PasswordSignIn-' + [guid]::NewGuid().ToString('N'))
        New-Item -ItemType Directory -Path $OutputFolder | Out-Null

        & node $Entry $RetainedZIP $OutputFolder
        if ($LASTEXITCODE -ne 0) { throw 'PASSWORD_SIGNIN_PREPARATION_REQUIRED' }

        $SQLFile = Join-Path $OutputFolder 'mushavo-password-signin-staging.sql'
        Set-Clipboard -Value ([IO.File]::ReadAllText($SQLFile))
        $BatchExit = 0
        Write-Host ('Created folder: ' + $OutputFolder)
        Write-Host 'Install SQL is on the clipboard. Upload the ZIP first, then run the SQL in staging Supabase.'
        Invoke-Item -LiteralPath $OutputFolder -ErrorAction SilentlyContinue
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'PASSWORD_SIGNIN_PREPARATION_REVIEW_REQUIRED'
            frontend_uploaded = $false
            SQL_applied = $false
            actual_hosted_requests = 0
            real_email_requests = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined password-signin preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}

```

The folder contains:

- **mushavo-password-signin-staging.zip** — 42 public files, 10 changed, 2 retired modules removed, 32 preserved. Config/service worker/headers/routes retain their accepted bytes; the Pages Worker is intentionally replaced by static serving plus 410 responses for retired code/device routes.
- **mushavo-password-signin-staging.sql** — atomic all-role policy installation with current-catalog/known-source/privilege/role guards.
- **mushavo-password-signin-rollback.sql** — emergency rollback to the exact previous proof predicate with app access quarantined. Retain it with the old ZIP; do not run it as the normal install.

## Apply the prepared change

1. After combined preparation exit 0, upload **mushavo-password-signin-staging.zip** to **mushavo-budget-staging**.
2. In the **staging Supabase project dczlddwbtgvfdujgcitb → SQL Editor**, run **mushavo-password-signin-staging.sql** from the same folder. The command copies this reviewed SQL to the clipboard. If overwritten, open the saved SQL file and copy its complete contents; do not rerun preparation just to recover the text.
3. Wait for **PASSWORD_SIGNIN_ALL_USERS_ENABLED_STAGING**, with catalog_identity_matched true and preserved 148 RPC/82 policy counts. The fresh frontend intentionally fails closed until this server contract exists.
4. Open https://mushavo-budget-staging.pages.dev/app.html and sign in using the existing confirmed test account's email/password. Expect the authorized dashboard without a sign-in code/trust page. Then Sign out and reload; expect the sign-in form. Keep passwords private.
5. Return preparation JSON, deployment URL, install SQL JSON and the observed dashboard/signout-reload outcome. Stop at an unexpected install result and return that error rather than rerunning old email-window or account-repair scripts.

Complete reviewed SQL sources are [install](../../supabase/candidates/security_fr_2_5_password_signin_upgrade.sql) and [rollback](../../supabase/candidates/security_fr_2_5_password_signin_rollback.sql). Installation enables ordinary session-based access for all confirmed, active staging users under existing authorization. It changes neither Auth users/passwords/provider factors nor workspace/role assignments. It preserves 148 RPC guards and 82 restrictive policies, changes their common session predicate to valid Auth sessions, adds a self-only authenticated status RPC/private rollback ledger and retires 8 legacy dispatch service grants. Existing Edge helpers follow the preserved compatibility boolean RPC and retain their identity/role/job checks; no Edge redeployment is needed. Emergency quarantine remains effective.

The old custom proof/device data stays private for rollback/audit and has no authority under the new predicate. Runtime Pages code accesses no old mail/limiter/Zoho settings; existing unused secrets/bindings and local encrypted packets need no deletion or rotation for this change. Normal Supabase confirmation/recovery and any provider-required sensitive password-change reauthentication remain available.

## Acceptance and preserved audit scope

The original 31 AU definitions, all historical receipts and stronger-MFA finding definitions remain unchanged. Old supplemental custom-code/device/window directions are superseded, not credited as successful tests. Selected local coverage is 100 runtime/callback checks, 14 actual SQL-model checks and 8 package checks. The modeled 148/82 inventory is not a live re-audit of every product operation. Actual Windows package, hosted SQL, browser/Admin-role and tenant-isolation acceptance remain pending. No live latency/viewport claim is made.

The owner selected password-only Admin sign-in after discussing the stolen-password tradeoff. This does not satisfy original stronger-MFA criteria, fabricate aal2 or close any finding. V phone/factor work remains on hold and requires policy reconciliation before any future factor action; do not automatically reenroll/remove factors or reintroduce mandatory verification from an older handoff. Password-mismatch prominence stays deferred.

**Stage 3 / FR.2 / full W, the final re-audit and release gate remain open.** Production/native unchanged; APK deferred. Every progress update must retain the visible stage prefix.
