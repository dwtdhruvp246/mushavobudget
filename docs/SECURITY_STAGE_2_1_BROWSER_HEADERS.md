# 2.1 — Browser header baseline, candidate and staging handoff

**2.1 update — S2E10:** Owner reports the production mushavobudget.com Always Use HTTPS setting OFF. This identifies a disabled setting, not proof that every HTTP request lacks another redirect. Checks 1–4 and targeted Console nonrecurrence remain owner-reported scoped PASS. Fresh root HTTP/HTTPS probes received 403 through this execution path and cannot establish the live redirect. One bounded owner-native curl batch is the remaining behavior check. A path/query-preserving 301 candidate limited to the known apex website is prepared if a redirect is actually missing; no provider change is made. Two of three work items are complete. Strict CSP, deliberate blocking and full production acceptance remain open.

**Prior live result — 9 October 2026, S2E05–S2E07:** Owner Windows preparation passed with 35 public files and original sources retained; owner then confirmed staging deployed. Root's fresh GET checks at 13:11–13:12 UTC (15:11–15:12 +0200) found all seven header families with matching baseline values on 11 successful canonical HTML/JS/CSS responses and the app.html → app 308 response. MIME checks passed. Public config uses dczlddwbtgvfdujgcitb with publishable-key format and empty push key; config/CSP/selected signup content contain no production reference. The one live inline signup block matches the declared CSP hash. No credentials, token values or raw bodies are recorded. This is a sampled served-header/configuration PASS, not browser execution, key-ownership/source-parity or production acceptance. One bounded owner browser batch and the production Always Use HTTPS setting reply remain pending; two of three work items remain complete. Preparation/upload instructions below are retained as history and need not be repeated.

Prepared 9 October 2026. **Baseline/candidate and sampled staging headers complete; owner workflows 1–4 and targeted Console nonrecurrence report scoped PASS; production HTTPS redirect behavior review pending.** F07 remains open. Candidate presence or local checks do not establish live repair or full XSS protection.

## Fresh observations

Read-only unauthenticated GETs returned 200 for production home, app and business documents (app.html/business.html canonicalized to extensionless paths), signup/contact and app.js/business.js/sw.js. All seven recorded families were absent: Content-Security-Policy, Content-Security-Policy-Report-Only, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, Referrer-Policy and Permissions-Policy. Staging home returned 200 with nosniff and strict-origin-when-cross-origin, but lacked the other five. These are dated sampled responses, not every route/cache/client or exploit proof.

A separate manual-redirect HTTP probe of http://mushavobudget.com/ returned 200 without Location through this execution path. HTTPS redirect enforcement is not established; confirm the actual Cloudflare zone setting and recheck from the owner path. No TLS mode/redirect setting was changed. HTTPS success alone does not prove the HTTP redirect.

Reviewed audit source 8334bdae71e6f69fc726d8bfebf289caa4b4eaed matches local wrangler.jsonc and signup.html. Production uses Workers Static Assets from the repository root. The public assets use same-origin scripts/styles, jsDelivr Supabase modules, exact backend HTTPS/WSS, uploaded Supabase images, blob downloads/previews and one inline signup module. Dynamic inline styles and print windows exist. No existing iframe/object flow or explicit cross-origin form action was found in the selected HTML inventory. Cloudflare analytics was already observed in Stage 0 and remains in the report-only allowlist; this does not resolve its privacy finding.

Cloudflare supports a root _headers file for static responses on Workers and Pages. Rules do not cover arbitrary function-generated responses and redirects take precedence; actual canonical, redirect and cache paths must be rechecked. The candidate uses one rule with all lines below the 2,000-character limit. References: [Workers headers](https://developers.cloudflare.com/workers/static-assets/headers/) and [Pages headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Candidate controls and limits

| Control | Candidate | Limit / purpose |
|---|---|---|
| HSTS | max-age=86400 | Initial one-day lifetime, without includeSubDomains/preload. HTTPS redirect is a separate required check. |
| MIME treatment | X-Content-Type-Options: nosniff | Verify actual JS/CSS MIME types after upload. |
| Framing | X-Frame-Options: DENY and enforced frame-ancestors none | Prevent framing; actual browser denial test pending. |
| Referrer | strict-origin-when-cross-origin | Retains origin while limiting cross-origin path/query disclosure. |
| Browser capabilities | Camera self; microphone/geolocation/payment/USB disabled | Current web workflows do not use these disabled APIs in the selected source; later commerce/native features require review. |
| Enforced CSP baseline | object-src none; base-uri self; form-action self; frame-ancestors none | Immediate object/base/form/frame restrictions. Does not enforce script or connection allowlists. |
| Resource CSP | Report-only exact backend HTTPS/WSS, self, jsDelivr, observed analytics origins, inline script hashes, required data/blob image/download paths | Diagnose compatibility before enforcing script/connect/resource restrictions. Inline styles remain allowed for current dynamic/print behavior. |

The signup module hash is generated from exact normalized inline text, including whitespace; modified inline code does not have that hash. No unsafe-inline/unsafe-eval script permission is added. CDN host permission remains broader than an integrity-verified bundled dependency. Resource policy is only report-only: it does not prevent otherwise-permitted injection or outbound connections today. Full enforced CSP, deliberate XSS/frame checks, third-party integrity and native/callback behavior remain open under F07/F10/F18 and later relevant stages.

No remote reporting endpoint is configured: browser console diagnostics are used; violation URLs/session identifiers are not uploaded to a new service. No automated CSP monitoring is claimed. References: [MDN CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP), [report-only header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only).

## Local validation

Command: node --test tests/security-stage-2-headers.test.mjs tests/cloudflare-assets.test.mjs. **15/15 PASS** on local Node 24.19.0. Checks cover generated production policy/source binding, exact inline hash versus altered payload, CRLF normalization, exact staging origins/line limits, public allowlist/source preservation, production URL/reference/secret-key/push/missing-file rejection before output, existing-output preservation, redirected-file/output-parent rejection and the git-show/environment handoff without printing the key. Existing asset privacy/configuration checks also pass.

These are source/helper/guard tests, not browser or native Windows execution. Playwright is installed but its Chromium executable is absent; no browser workflow/frame/injection pass is invented. Owner Windows Node 22.17.0 execution and served/browser checks remain pending. No broad unrelated suite, app/data change or native build was performed.

## Owner PowerShell: prepare a new staging upload folder

Run from your existing checkout. Fetch/git show does not switch/reset your branch or overwrite your native edits. The helper reads the existing Stage 1 staging folder, requires the exact staging URL, publishable-key format and empty push key, scans all copied bytes for the production reference, and copies only the 34 reviewed public filenames plus a newly generated staging _headers. Extra private files are not copied. It refuses existing/redirected targets and validates inputs before writing. Key/project ownership and source commit are not independently established by a format check; prior owner configuration evidence retains its scope.

```powershell
& {
    $ErrorActionPreference = "Stop"
    Set-Location "C:\Users\HP\Desktop\Mushavo Budget"

    git fetch origin security/stage-2-web-hardening
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }

    $mushavoHeaderCode = git show "FETCH_HEAD:scripts/prepare-stage-2-headers.cjs" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoHeaderCode)) {
        throw "Staging header helper could not be read."
    }

    $mushavoStagingSource = "C:\Users\HP\Desktop\MushavoBudget-Staging-Web-7ed99d1cd378498da28e246760d744d7"
    if (-not (Test-Path -LiteralPath $mushavoStagingSource -PathType Container)) {
        $mushavoStagingSource = (Read-Host "Full path to your existing STAGING web upload folder").Trim().Trim('"')
    }
    $mushavoHeaderOutput = Join-Path ([Environment]::GetFolderPath("Desktop")) `
        ("MushavoBudget-Staging-Headers-" + [guid]::NewGuid().ToString("N"))

    try {
        $env:MUSHAVO_STAGE2_HEADER_SCRIPT = $mushavoHeaderCode
        node -e 'eval(process.env.MUSHAVO_STAGE2_HEADER_SCRIPT)' -- `
            --stage-2-preview $mushavoStagingSource $mushavoHeaderOutput
        if ($LASTEXITCODE -ne 0) { throw "Candidate preparation failed. Send the error only." }
    } finally {
        Remove-Item Env:MUSHAVO_STAGE2_HEADER_SCRIPT -ErrorAction SilentlyContinue
    }
}
```

This prepares a local folder only. Send the metadata summary/error without passwords or config contents. Keep any failed new folder; the source is retained.

## Upload and one bounded browser check

Open Cloudflare Workers & Pages, select **mushavo-budget-staging** (the Pages project serving mushavo-budget-staging.pages.dev), then Create a new deployment. Upload the **new output folder** and select its production environment so the staging pages.dev alias receives the update. Here production means the deployment slot of the separate staging project; it is not the production mushavobudget Worker/domain/backend. Verify the target project first. [Official Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/).

After upload, report the staging URL/completion. Root can recheck unauthenticated served headers. Use a fresh browser session or bypass the old service-worker cache for compatibility checks. In one owner batch:

1. Home, pricing, app, signup and business sign-in shell render normally.
2. Existing synthetic account can sign in; its selected payment persists after reload.
3. The second synthetic account still has its separate Personal workspace and cannot see the first payment.
4. Available controlled download/print/logo preview flows still work; unavailable paid/Business flows are marked UNAVAILABLE, not forced into production tests.
5. Inspect DevTools Console for report-only CSP violations during those flows. Report safe directive/source-origin details only; redact paths/queries, tokens and user identifiers. Do not send invitations/enquiries/emails as part of this header check.

In the same bounded review, check the **production domain's** Cloudflare SSL/TLS > Edge Certificates > Always Use HTTPS setting and report ON/OFF/UNAVAILABLE. This is a read-only setting check, not an instruction to change other domain hosts or TLS modes. A concrete redirect correction will follow confirmed scope if needed. [Official setting guide](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/).

If deployment or a workflow is unavailable, record the exact safe outcome and carry it rather than restart earlier audit checkpoints. Full browser/direct blocking checks, strict CSP promotion, production deployment and final re-audit remain separate acceptance evidence. SQL, credentials, Google backup and APK changes are not requested by this handoff.


## S2E08 targeted Console follow-up — historical instructions; answered in S2E09

Checks 1–4 above are owner-reported PASS and do not need to be repeated. The screenshot was readable despite the attachment's earlier error text. It shows Chromium's asynchronous extension-message channel error, not a visible CSP directive violation. This is a likely extension issue, not proof that all Console errors or application behavior are harmless. The screenshot crops out the address bar; hosted identity and complete Console history are not independently established.

The 20 local allowlisted HTML/JS sources have no selected chrome/browser runtime messaging calls or this exact error text. This is a source scan, not deployed-byte parity or external dependency/runtime proof. A fresh broader public source fetch received HTTP 403 through this execution path; it supplied no completed deployed-source scan and is not treated as an application fault.

Use one browser window/profile with extensions disabled, open the staging app, sign in with a synthetic account and open Support. Observe the Console for at least the delay that previously produced the error (at least five minutes if the delay is unknown), then perform a normal navigation. Report whether this exact error returns and whether the app still works. Do not submit a support ticket, invitation or email for this check. Incognito can still permit explicitly allowed extensions; Guest mode or a new profile is an alternative. Only this Console confirmation and the outstanding production Always Use HTTPS ON/OFF/UNAVAILABLE reply are requested. Remaining unavailable evidence will carry to final remediation rather than extend this step indefinitely.

Primary references: [Chromium extension message port error](https://chromium.googlesource.com/chromium/src/+/9256bc8b668f61e755ab587f623e7da94d8a6f47/extensions/browser/api/messaging/extension_message_port.cc), [Chrome extension messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Chrome Guest mode](https://support.google.com/chrome/answer/6130773?hl=en).


## S2E09 owner outcome and remaining item

Owner reply: “error did not return”. Record the selected error's nonrecurrence as an owner-reported scoped PASS. The reply follows the requested Guest/extensions-disabled staging Support test; profile, extension state, elapsed time and full Console history are not independently observed. The result supports the extension explanation without identifying an extension or proving universal absence of browser errors. No application patch or error suppression is warranted by the current evidence, and no additional Console retest is requested for this bounded step.

The production mushavobudget.com Always Use HTTPS read-only ON/OFF/UNAVAILABLE reply is the sole remaining owner item. Previously passed workflows stay passed. Strict resource CSP, deliberate frame/injection evidence, production deployment/acceptance and any unavailable settings evidence carry explicitly to the closing checkpoint/final remediation rather than restart earlier stages.


## S2E10 production setting and one bounded behavior check

Owner reports Always Use HTTPS OFF in the original account's production mushavobudget.com zone. Other existing redirect rules are not inventoried, so OFF alone is not a proof of an unprotected HTTP response. Cloudflare documents the switch as covering all hosts/subdomains; that wider website scope is not established here. Fresh root GETs on 9 October at 2026-10-09T18:23:53.411868+00:00 returned 403 for HTTP root and HTTPS root/app/business through this environment. Their origin/execution-path attribution is unresolved; do not treat them as proved application downtime or a validated HTTP redirect.

Run this owner-side read-only batch. curl configuration files are ignored, redirects are not automatically followed, TLS verification is retained and response bodies are discarded. The URLs contain only public paths and a synthetic query marker. No login, database, local project/source modification or provider write occurs.

```powershell
& {
    $mushavoCurl = Get-Command -Name "curl.exe" `
        -CommandType Application -ErrorAction Stop |
        Select-Object -First 1

    foreach ($mushavoUrl in @(
        "http://mushavobudget.com/",
        "http://mushavobudget.com/app?audit_https=2.1",
        "http://mushavobudget.com/business",
        "https://mushavobudget.com/app"
    )) {
        $mushavoResult = & $mushavoCurl.Source --disable --silent `
            --show-error --max-time 15 --output NUL `
            --write-out 'status=%{http_code}; redirect=%{redirect_url}' `
            --url $mushavoUrl
        $mushavoExitCode = $LASTEXITCODE

        [pscustomobject]@{
            URL = $mushavoUrl
            Result = ($mushavoResult -join "")
            ExitCode = $mushavoExitCode
        }
    }
} | Format-Table -Wrap -AutoSize
```

Expected protected behavior: HTTP paths return a redirect to HTTPS on the same hostname, retaining the selected path and dummy query; HTTPS app loads successfully. The root request may be 301 or another intentional HTTP-to-HTTPS redirect status under an existing rule. The three HTTP observations and HTTPS positive control establish only this sample, not all domain hosts/routes/cache states. Send the metadata table and safe errors. If the result is unavailable/inconclusive, explicitly carry the gap; do not reopen earlier stages or add an unlimited diagnostic sequence.

### Prepared correction if the redirect is missing

In production mushavobudget.com, review Rules > Overview for an overlapping existing redirect before creating this candidate. Use Create rule > Redirect Rule, name “Mushavo website HTTP to HTTPS”, match Wildcard pattern, Request URL `http://mushavobudget.com/*`, Target URL `https://mushavobudget.com/${1}`, Status code 301, Preserve query string enabled. This candidate matches HTTP for the known apex website, not HTTPS or other hostnames. It preserves navigation and query parameters and avoids an HTTPS self-redirect. It is not deployed or accepted by this evidence. Single Redirects require Cloudflare-proxied traffic; no DNS or TLS-mode change is requested.

Deployment handoff will depend on the actual owner-path behavior. If an existing rule already protects these requests, do not duplicate it just to make the Always Use HTTPS switch ON. Provider validation and post-change behavior remain required for any implemented correction. See [Always Use HTTPS scope](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/), [rule creation](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/create-dashboard/) and [scoped HTTPS redirect example](https://developers.cloudflare.com/rules/url-forwarding/examples/redirect-admin-https/).
