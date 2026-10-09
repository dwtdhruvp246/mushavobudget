# 2.1 — Browser header baseline, candidate and staging handoff

Prepared 9 October 2026. **Baseline and checked candidate complete; staging deployment/browser acceptance pending.** F07 remains open. Candidate presence or local checks do not establish live repair or full XSS protection.

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
