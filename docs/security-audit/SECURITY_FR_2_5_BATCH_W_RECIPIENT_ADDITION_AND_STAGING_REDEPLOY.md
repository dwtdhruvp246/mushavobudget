# Two saved recipients preserved; one recovery inbox added for staging

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE244.

The [owner result](security-fr-2-batch-w-owner-recovery-recipient-not-listed.json) proves the Windows reader/source checks and CurrentUser DPAPI read completed. The saved packet has two recipients and excludes the current recovery inbox; exit1 is the intended not-ready result. No hosted request, email, setting, password or SQL action happened. This does not independently read the live Cloudflare secret value or prove delivery.

[Contract](security-fr-2-batch-w-recipient-addition-contract.json), [eight-source manifest](security-fr-2-batch-w-recipient-addition-source-manifest.json), [12/12 local checks](security-fr-2-batch-w-recipient-addition-local-checks.json). Pinned tool source `7ab69cf19a04f04a3c0ba205a00a796e56f4fa47`, preparer SHA256 `f33e04c2583385d00c07f09a4c8ab344dbde0af3791d3e1b94b50857dc817175`. The Node cases exercise the real private child with networking disabled, exact two-to-three addition, retained order/case, safe output, malformed/wrong-scope refusal and recopying an already prepared three-address packet. New Windows packet creation/DPAPI readback/clipboard execution remain owner-pending. The earlier Windows reader/16 tests and original194/window11/public16 retain their own pins; no full suite rerun is requested.

The local preparer verifies three execution sources and the exact accepted trusted-browser ZIP. It reads the existing encrypted packet, preserves both recipients, appends the current verified recovery email, and creates a new exclusive encrypted pending packet with only ZOHO_TEST_RECIPIENTS_JSON changed. Other gateway values and the original encrypted packet remain intact. It copies **recipient-address JSON only** to the clipboard; provider keys and the full packet are never copied or printed. No plaintext full-packet file is written. The prepared private file is a pending configuration snapshot, not proof it was installed. An explicitly selected already prepared three-address packet can restore the clipboard without a further file creation. Managed process strings are not guaranteed to be securely erased.

The planned external action changes only ZOHO_TEST_RECIPIENTS_JSON, kept as an encrypted secret, in the production and preview deployment environments **inside mushavo-budget-staging**. Both saved addresses remain in the proposed value. Live secrets cannot be viewed after setting, per [Cloudflare Pages secrets documentation](https://developers.cloudflare.com/pages/functions/bindings/#secrets); this preparation does not exclude unrecorded later recipient edits. Review any separately retained later changes before replacing the live value. All other settings, keys, peppers, mode, bindings and SQL stay unchanged.

Cloudflare requires secrets to be set before a deployment that uses them. After the single-setting edit, upload the existing accepted ZIP again. This is the same44-entry trusted-browser archive, SHA256 `53437a8f2b452b387f75bcbca512b08e08f29a6b446f33de28660154a03301f5`; no rebuild or SQL upgrade is requested. A new deployment URL and subsequent bounded-window/real-code test are still needed before crediting runtime delivery.

Owner steps:

1. Keep the original verified password form open and unchanged. Run the pinned preparation command supplied in chat. It uses the existing packet automatically if exactly one exists; otherwise give only the original packet path. It also locates/verifies the existing trusted-browser ZIP, prompting for its path only if the known copy is unavailable.
2. Continue only after exit0 with prepared_recipient_count3, source_hashes_verified3, original_encrypted_packet_compared_unchanged true, pending_packet_readback_verified true, recipient_JSON_copied_to_clipboard true and accepted_browser_trust_ZIP_SHA256_verified true. A failure means report the safe result and stop before editing settings.
3. Before copying console output (which would replace the clipboard), open Cloudflare Workers & Pages > **mushavo-budget-staging** > Settings > Variables and Secrets. Edit the existing **ZOHO_TEST_RECIPIENTS_JSON** secret. Paste the prepared three-address JSON, review the two retained addresses plus the current recovery inbox, keep it encrypted, then save. Apply this same value to the production and preview environments of this staging project. No other field is part of this handoff.
4. Create a new deployment in that same staging project using the existing verified **mushavo-trusted-browser-staging.zip** printed by the command. Do not run the SQL sidecar again. Copying or using the new encrypted packet does not itself update Cloudflare.
5. Return the safe preparation JSON/combined exit code, whether the one secret was saved in both staging environments, and the new deployment URL. Keep the encrypted packet and clipboard recipient list private. Stop before submitting matching passwords or requesting an email code; prepare the exact one-account bounded application window next.

Public template (the private test address is supplied in chat):

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = '7ab69cf19a04f04a3c0ba205a00a796e56f4fa47'
    $EntryHash = 'f33e04c2583385d00c07f09a4c8ab344dbde0af3791d3e1b94b50857dc817175'
    $TestEmail = 'YOUR_VERIFIED_RECOVERY_EMAIL'
    $RetainedZIP = 'C:\Users\HP\Desktop\Mushavo-W-Browser-Trust-6641fcf8c4a243078b7245b2c6bbe293\mushavo-trusted-browser-staging.zip'
    $OriginalLocation = Get-Location
    $BatchExit = 1
    Write-Host 'STARTED: Stage 3/10 | FR.2/8 | Batch W/Z - prepare one recipient addition.'
    try {
        Set-Location -LiteralPath $Project
        git -c credential.interactive=false fetch origin security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'FETCH_REQUIRED' }
        git merge-base --is-ancestor $Commit origin/security/stage-3-authorization
        if ($LASTEXITCODE -ne 0) { throw 'PUBLISHED_PIN_REQUIRED' }
        $TaskRoot = Join-Path $env:TEMP ('mushavo-recipient-addition-' + [guid]::NewGuid().ToString('N'))
        $Snapshot = Join-Path $TaskRoot 'source'
        $Archive = Join-Path $TaskRoot 'source.zip'
        New-Item -ItemType Directory -Path $TaskRoot | Out-Null
        git -c core.autocrlf=false -c core.eol=lf archive --format=zip --output=$Archive $Commit scripts/prepare-fr-2-batch-w-recipient-addition.ps1 scripts/plan-fr-2-batch-w-recipient-addition.mjs scripts/check-fr-2-batch-w-recovery-recipient.mjs
        if ($LASTEXITCODE -ne 0) { throw 'ARCHIVE_REQUIRED' }
        Expand-Archive -LiteralPath $Archive -DestinationPath $Snapshot
        $Entry = Join-Path $Snapshot 'scripts\prepare-fr-2-batch-w-recipient-addition.ps1'
        if ((Get-FileHash -LiteralPath $Entry -Algorithm SHA256).Hash.ToLowerInvariant() -cne $EntryHash) { throw 'SOURCE_IDENTITY_REQUIRED' }
        $ParseTokens = $null
        $ParseIssues = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile($Entry, [ref]$ParseTokens, [ref]$ParseIssues)
        if ($ParseIssues -and $ParseIssues.Count -gt 0) { throw 'POWERSHELL_PARSE_REQUIRED' }
        $Result = & $Entry -SnapshotRoot $Snapshot -ExpectedSourceSHA256 $EntryHash -TestEmail $TestEmail -RetainedZIP $RetainedZIP
        if ($Result -ne 0) { throw 'LOCAL_RECIPIENT_PREPARATION_REVIEW_REQUIRED' }
        $BatchExit = 0
    } catch {
        Write-Host ([ordered]@{
            progress_display = 'Stage 3/10 | FR.2/8 | Batch W/Z'
            result = 'RECIPIENT_ADDITION_PREPARATION_REVIEW_REQUIRED'
            actual_hosted_requests = 0
            password_save_requested = $false
            exit_code = 1
        } | ConvertTo-Json)
    } finally {
        Set-Location -LiteralPath $OriginalLocation.Path
        Write-Host ('Combined recipient-addition preparation exit code: ' + $BatchExit)
        $global:LASTEXITCODE = $BatchExit
    }
}
```

Both deferred UI items remain deferred. Batch V Admin MFA stays on hold. This fixture-setting correction adds no AU case and does not accept password-save/retry, code delivery or session outcomes. Full W/FR.2/Stage3/release and all findings remain open; production app/native unchanged, APK deferred.
