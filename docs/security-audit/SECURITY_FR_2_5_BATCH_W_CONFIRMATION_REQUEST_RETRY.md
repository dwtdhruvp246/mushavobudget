# AU01.05 — existing-email and confirmation-request failure/rate behavior

Stage 3/10 | FR.2/8 | Batch W/Z. 1 November 2026.
Pinned package code: cc2251174b75867b96798acfa833621031826fb5. Source parent: e05929414a3e49229d6cacbe608182159bd1fa3a. Evidence FRE295.

## Accepted starting point

[AU01.04 owner receipt](security-fr-2-batch-w-owner-ordinary-confirmation-pass.json) confirms current pending guidance, email delivery, intended identity/clean confirmation route, Go to sign in and successful password sign-in to the correct Free Personal workspace, with no error. The current observations also support AU01.01/02; the earlier AU01.03 unconfirmed-denial receipt is retained. No confirmation-link or invitation repeat and no new inbox are needed.

Original AU01.05 remains the fixed scope: generic existing-email/resend failure and rate response. Source inspection found that SDK network/server errors were swallowed into inbox guidance. The correction throws only operational network/retryable/5xx errors through existing safeAuthMessage, keeps generic account-state 400/422 responses, preserves the rate message and existing 60-second UI cooldown, and does not alter confirmation success/password/session-adoption code. The shared recovery-request operational error branch benefits from the same correction; normal recovery success is preserved.

[Local receipt](security-fr-2-batch-w-confirmation-request-feedback-local-checks.json): 13/13 PASS, 4 syntax checks, 7 package identities. Nine real submit-handler/operation VM checks use synthetic SDK-shaped results; four package checks cover real portable 42-entry ZIP readback, 40 untouched entries, old-source/tamper rejection and safe CLI refusal. No real Auth/SMTP/SQL or provider rate test ran. The owner's accepted retained ZIP is not present here; actual owner packaging, upload and hosted checks remain pending.

Only public auth-flows.js and auth.html change (module version 8 to 9). Config, Worker, service worker, headers, routes, existing app.js/app.html including the seat editor and server Auth policy remain byte-preserved. No SQL, settings or native change.

## Current owner action — prepare and upload one ZIP

This step prompts for no password, email, token or SQL. It reads the exact accepted SimpleSeats archive, verifies sources and original auth-file hashes, creates a new output directory and leaves the retained ZIP untouched. No duplicate owner test-suite run is requested.

Run the WHOLE PowerShell block:

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $Project = 'C:\Users\HP\Desktop\Mushavo Budget'
    $Commit = 'cc2251174b75867b96798acfa833621031826fb5'
    $Previous = 'C:\Users\HP\Desktop\Mushavo-W-SimpleSeats-1260828c31754035a743bd71cd55ee19\output\mushavo-business-seats-simple-staging.zip'

    Write-Host 'STARTED: Prepare Batch W confirmation-request retry fix'

    if (!(Test-Path -LiteralPath $Previous)) {
        throw 'Accepted SimpleSeats ZIP not found. Stop and report this message.'
    }

    $Work = Join-Path ([Environment]::GetFolderPath('Desktop')) (
        'Mushavo-W-ConfirmationRetry-' + [guid]::NewGuid().ToString('N')
    )
    $Source = Join-Path $Work 'source'
    $Output = Join-Path $Work 'output'
    New-Item -ItemType Directory -Path $Source, $Output | Out-Null

    git -C $Project fetch origin security/stage-3-authorization
    if ($LASTEXITCODE -ne 0) {
        throw 'Git fetch failed.'
    }

    $Archive = Join-Path $Work 'source.tar'
    git -C $Project archive --format=tar --output=$Archive $Commit
    if ($LASTEXITCODE -ne 0) {
        throw 'Source archive failed.'
    }

    tar -xf $Archive -C $Source
    if ($LASTEXITCODE -ne 0) {
        throw 'Source extraction failed.'
    }

    node (Join-Path $Source 'scripts\prepare-confirmation-request-retry.mjs') $Previous $Output
    if ($LASTEXITCODE -ne 0) {
        throw 'Package verification failed. Stop and report the safe JSON.'
    }

    Write-Host 'COMPLETE: Staging ZIP prepared. Upload is the next step.'
    explorer.exe $Output
}
```

Expected safe JSON: CONFIRMATION_REQUEST_RETRY_FRONTEND_PREPARED_NOT_DEPLOYED,7 hashes,42 public entries, changed auth-flows.js/auth.html,40 preserved, portable readback true, exit0. On any error stop and return the safe JSON.

Upload **mushavo-confirmation-request-retry-staging.zip** from the opened output folder to the existing **Cloudflare Pages mushavo-budget-staging** project. No Supabase upload or SQL action. Return safe JSON, exit code and new deployment URL. All later owner browser checks use https://mushavo-budget-staging.pages.dev/; no preview callbacks are added.

## Post-upload public readback — next gate, not run yet

After upload, verify these two public stable-origin files with at most 2 GETs, no Auth/cookies:
- /auth-flows.js?v=9 — SHA256 1bded7699dbc6e2c2e790465e13b0c0f73a40c5a4f28dd5244caf791dd6d3949
- /auth.html — SHA256 29e216592f62950ba0725db2adac7bb4f57d092d1e6570afae2b56ede074a244

Use no-cache, a 25-second request limit and fixed PASS/FAIL output; no raw body. Do not run the UI failure check against unverified older source.

## Prepared AU01.05 browser check — only after upload/readback

This is about 5–10 active minutes and uses the ordinary account just confirmed. No new inbox/account creation is intended.

1. In the Incognito window sign out of that controlled account once as preparation. Open stable signup.html in the same signed-out window. Enter the SAME confirmed email, SAME password, Batch W Confirmation and USD/default USD, then submit once. Expect the same generic pending/check-inbox guidance, without an account-existence-specific error or a dashboard. This is one duplicate signup API attempt, not a password change or reset request. Stop on rate/error; no resend/new signup retry. Actual provider mail traffic for this duplicate operation is unmeasured and no quota/reset is assumed.
2. Open https://mushavo-budget-staging.pages.dev/auth.html?flow=request-confirmation in a new tab in that window. Enter the same controlled email.
3. Open DevTools/Network (No throttling). Ctrl+Shift+P > Show Request conditions. Add an enabled BLOCK condition for:
   https://dczlddwbtgvfdujgcitb.supabase.co/auth/v1/resend*
   The final wildcard includes redirect query parameters; only this staging resend endpoint is targeted. Enable blocking and throttling; keep DevTools open.
4. Click Send link once. Verify the resend request actually shows (blocked:devtools). Expect The request could not finish. Check your connection and try again. The same address/form should remain and the button should re-enable. If not actually blocked, stop, remove the test rule and report; do not credit failure acceptance or retry a live send.
5. Immediately, within 60 seconds, click Send link once more while the rule remains enabled. Expect Too many attempts. Wait before trying again. Network should show no additional resend request because the existing local cooldown stops it before SDK dispatch.
6. Delete only the rule added for this test. Stop; do not make an unblocked resend request. Retain the account.

Return: generic duplicate response yes/no and short message; resend request actually blocked yes/no; retry guidance shown yes/no; address/form retained and button usable yes/no; immediate second click showed the wait message yes/no; no additional resend request on second click yes/no; test rule removed yes/no. No password, full email link, token, Network headers/body or HAR.

This exercises current UI account-state privacy, browser-blocked request failure and LOCAL cooldown feedback. It does not exercise a fresh provider 429, establish provider quotas/reset times, deliver a resend email to an unconfirmed account, or close Business Edge 502/UI/stale-token scope AU05.07. Local mocks are not relabelled as hosted provider evidence. Evaluate actual owner results at this declared scope; no deliberate quota hammering.

## Carry-forward

AU01.04 is accepted; all eight invitation groups remain scoped passes. AU01.05 is not yet hosted-accepted. Remaining W password/recovery/session and exact older Node-session cleanup carries stay open; AU03.04 retry remains owner-deferred. V/X/Y/Z, FR.2–8 and full release are not closed. Production/native unchanged, APK deferred. No new public AU case or factor/trust/sign-in-code workflow.
