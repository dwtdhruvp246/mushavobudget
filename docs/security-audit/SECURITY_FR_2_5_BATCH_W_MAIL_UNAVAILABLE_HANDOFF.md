# MAIL_UNAVAILABLE: inspect retained sender readiness

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner supplied canonical POST begin503 and the selected response **MAIL_UNAVAILABLE**. [Receipt](security-fr-2-batch-w-owner-mail-unavailable.json). This identifies the delivery branch. The code deliberately groups unlisted recipients, Zoho token/send errors and failure to mark the challenge READY. The screenshots do not identify which substep failed; a separate429 attempt is also visible. Avoid further code-send attempts while diagnosing.

A new diagnostic reuses the reviewed recipient validator and Zoho refresh/sender metadata checker with the existing encrypted gateway packet. It checks retained recipient membership, refresh-token health, enabled confirmed sender/outgoing state and retained account-ID equality. Maximum **2 provider requests**, no messages endpoint, new credential setup, email, SQL, account/settings change, packet write or deployment. It returns a fixed safe JSON projection. [Contract](security-fr-2-batch-w-mail-readiness-contract.json), [local17/17](security-fr-2-batch-w-mail-readiness-local-checks.json). Windows parse/DPAPI/provider execution is pending.

## Run once

The chat command selects the already provided pending three-recipient packet and latest privately supplied test mailbox. The public form below asks for that existing address/path locally. Use the pending three-recipient packet from the prior recipient-addition preparation, not an older two-recipient backup. The wrapper selects a single available packet or prompts for its existing path when ambiguous; do not paste the file contents.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '2f5fbff2b4e4e8fb1a7be1df1bc9b8e6b1860ca0'
    $EntryHash = 'd2c4a4d356da105c0d6b9159912ac7fde9a6e542babe5a4267937ea4eed83345'
    $TestEmail = (Read-Host 'Current sign-in email (address only)').Trim()
    $PacketFile = ''
    $OriginalLocation = Get-Location
    $BatchExit = 1

    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - mail readiness, no email sent.'

    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }

        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }

        $TaskRoot = Join-Path $env:TEMP ('mushavo-mail-check-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null

        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot

        $Entry = Join-Path $Snapshot 'scripts\run-fr-2-batch-w-mail-readiness.ps1'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) {
            throw 'SOURCE_IDENTITY_REQUIRED'
        }

        $ParseTokens = $null
        $ParseIssues = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile(
            $Entry, [ref]$ParseTokens, [ref]$ParseIssues
        )
        if ($ParseIssues -and $ParseIssues.Count -gt 0) { throw 'POWERSHELL_PARSE_REQUIRED' }

        if (-not (Test-Path -LiteralPath $PacketFile -PathType Leaf)) { $PacketFile = '' }
        $Result = & $Entry -SnapshotRoot $Snapshot -ExpectedSourceSHA256 $EntryHash -TestEmail $TestEmail -PacketFile $PacketFile
        if ($Result -ne 0) { throw 'MAIL_READINESS_REVIEW_REQUIRED' }
        $BatchExit = 0
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'MAIL_READINESS_CHECK_REVIEW_REQUIRED'
            real_email_requests = 0
            settings_SQL_or_account_writes = 0
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined mail-readiness check exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

Return the **safe JSON even when exit_code1**; problem_code and phase are the diagnostic outcome. No credentials or provider response bodies are printed.

## Interpret the result before changing configuration

- **RECIPIENT_NOT_IN_SELECTED_PACKET:** inspect selection and retained list; this alone does not prove the live recipient secret is wrong.
- **Refresh/token/scope failure:** identifies a retained provider-credential issue. Prepare only its reviewed repair after that evidence, without discarding existing mailboxes or broadening scopes.
- **Sender/account-state failure:** inspect the corresponding sender/account mismatch or outgoing block.
- **PASS_LIVE_DISPATCH_UNVERIFIED:** retained recipient/provider metadata is healthy. Next investigate deployed setting applicability, messages.CREATE response and READY acknowledgement with a targeted safe diagnostic; do not declare email delivery accepted or rotate working credentials blindly.

A pass does not compare secret values to Cloudflare or test messages.CREATE/inbox delivery. Earlier successful recovery/code scope remains preserved. Current source reference2f5fbff2b4e4e8fb1a7be1df1bc9b8e6b1860ca0 changes only diagnostic scripts/tests/manifest, not the app or deployed gateway. The separate signout/reload fix at522c883f50724efdd4daf967200bc4934eeb7a51 still needs its owner preparation/deployment evidence; it does not repair email delivery.

AU05.03 remains the owner's reported PASS and is not repeated. Frozen31 unchanged; V MFA ON HOLD, password-mismatch visibility deferred, full W/FR.2/Stage3/release/findings open, production/native unchanged, APK deferred.
