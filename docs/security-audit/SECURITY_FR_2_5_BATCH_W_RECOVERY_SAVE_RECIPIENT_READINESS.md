# Recovery password-save readiness: existing recipient check

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE243.

The mismatch-message check passed. The owner explicitly deferred its visual emphasis and the earlier background sign-in polish; both remain in [the deferred UI backlog](SECURITY_FR_2_5_AUTH_UI_DEFERRED_IMPROVEMENTS.md). The next functional action is a real matching-password save/retry and session outcome. A password reset invalidates remembered approvals, so first review exact staging code-recipient readiness, then the bounded application window for the same account.

This handoff requests only a local read-only check of the existing CurrentUser DPAPI encrypted gateway packet. It sends no email, makes no hosted request, changes no setting or account, and does not save a password. It asks for no keys, tokens, inbox password or new address. The original verified recovery tab stays open and unchanged.

[Contract](security-fr-2-batch-w-recovery-recipient-contract.json), [nine-source manifest](security-fr-2-batch-w-recovery-recipient-source-manifest.json), [local 16/16 receipt](security-fr-2-batch-w-recovery-recipient-local-checks.json). Actual local Node children enforce bounded input and safe output with networking disabled. Windows PowerShell parsing and real CurrentUser DPAPI reading cannot run in this assistant environment; the owner command parses the pinned script before any private file is read. No new dependencies or repeated194/window11/public16 suite is requested.

Pinned tool source: `2c77f19528925d0f615ac919e218010f7f06c974`. Runner SHA256 `6fda50a4991a5eb10508242352bccec52b806f5715d97dc986af865b53b85572`; core SHA256 `22419d83009fa4ecd7aed6c0769412553daab1a014ef02c06ebd50f22136e817`. Export only those two scripts from the immutable pin into a new temporary folder. The runner verifies both source identities, uses only private process memory and a parent-child stdin pipe, and compares the existing encrypted packet unchanged. A single matching saved email-gateway packet is found under LocalApplicationData/MushavoBudget/PrivateStaging. If several/no matching packets are found, supply only the path of the original packet used for staging secret installation. All private values and private file hashes stay off stdout and disk. Managed process strings cannot be promised to be securely erased.

The result proves only membership in that retained staging packet. It cannot read the live Cloudflare secret value or prove remote equality/current provider credentials/inbox delivery. Matching is exact after ordinary case normalization; a base Gmail address does not silently allow its plus alias. The final owner command uses the same intended recovery account already visible in the screenshots; the placeholder below avoids republishing it here.

Owner steps:

1. Keep the genuine verified Choose a new password tab open; do not refresh it, submit matching values or request another link/code yet.
2. In Windows PowerShell, run the pinned block supplied in chat. If using this public copy, replace only YOUR_VERIFIED_RECOVERY_EMAIL with the same email shown on the original verified recovery form.
3. Return only the safe JSON and combined exit code. Expected ready result: RECOVERY_RECIPIENT_IN_RETAINED_STAGING_PACKET, retained_packet_recipient_allowed true, source_hashes_verified2, encrypted_packet_compared_unchanged true, exit0.
4. A not-listed/local error result is review-required, not permission to modify secrets or retry mail. After a ready result, prepare a separate existing-controller bounded window and real save/verification/session-outcome handoff. No application window is opened by this command.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '2c77f19528925d0f615ac919e218010f7f06c974'
    $EntryHash = '6fda50a4991a5eb10508242352bccec52b806f5715d97dc986af865b53b85572'
    $TestEmail = 'YOUR_VERIFIED_RECOVERY_EMAIL'
    $OriginalLocation = Get-Location
    $BatchExit = 1
    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - read-only recovery recipient check.'
    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }
        $TaskRoot = Join-Path $env:TEMP ('mushavo-recovery-recipient-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit scripts/check-fr-2-batch-w-recovery-recipient.mjs scripts/run-fr-2-batch-w-recovery-recipient.ps1
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot
        $Entry = Join-Path $Snapshot 'scripts\run-fr-2-batch-w-recovery-recipient.ps1'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $ParseTokens = $null
        $ParseIssues = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($Entry, [ref]$ParseTokens, [ref]$ParseIssues)
        if ($ParseIssues -and $ParseIssues.Count -gt 0) { throw 'POWERSHELL_PARSE_REQUIRED' }
        $Result = & $Entry -SnapshotRoot $Snapshot -ExpectedSourceSHA256 $EntryHash -TestEmail $TestEmail
        if ($Result -ne 0) { throw 'RECIPIENT_READINESS_REVIEW_REQUIRED' }
        $BatchExit = 0
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'RECOVERY_RECIPIENT_CHECK_REVIEW_REQUIRED'
            actual_hosted_requests = 0
            password_save_requested = $false
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined recovery-recipient check exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

This local readiness metadata is not an additional AU case or hosted AU04.05 acceptance. Provider save failure/retry, actual password change, invalidation and session isolation remain pending. V Admin MFA remains on hold; full W/FR.2/Stage3/release and findings stay open. Production/native unchanged; APK deferred.
