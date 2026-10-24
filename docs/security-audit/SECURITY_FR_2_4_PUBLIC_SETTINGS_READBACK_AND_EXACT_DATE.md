# FR.2.4.E5.3 public settings read back; exact date via bounded API update

19 October 2026, FRE89. The [owner readback](security-fr-2-email-pages-public-settings-owner-readback.json) completed at 2026-10-19T17:58:40.978Z using the unchanged E5.2 inspector at commit 553c6642948a14dfcdc8254fcc5aa70463d95368. Exit 0, four successful HTTP 200 requests, six source hashes and unchanged accepted 44-file ZIP. Both production and preview channels of mushavo-budget-staging now report fail_open:false, latest-date:false, exactly three plain-text variables with all three staging marker values MATCH, the expected limiter binding MATCH and no other DO bindings. The other 13 selected variables are ABSENT in both reported maps. This establishes the scoped public settings except the date. It does not establish secret readiness, runtime binding use, mail delivery or hosted authorization.

## Correction to the dashboard handoff

The owner's screenshot shows a preset-only compatibility-date picker without 2026-07-01. The preceding dashboard instructions wrongly assumed a custom date could be entered. The owner was told to cancel the picker, retain the current date and complete the remaining public settings. Both date-match fields remain false; no substitute date is accepted as equivalent. The screenshot showed Production 2026-10-08, but the latest receipt does not disclose either exact current date, so no exact Preview date is invented here. Existing historical reports remain as history; this checkpoint corrects the next action.

## Exact date-only change

[Contract](security-fr-2-email-pages-date-contract.json), [seven-input manifest](security-fr-2-email-pages-date-source-manifest.json), [local checks](security-fr-2-email-pages-date-local-checks.json).

The new runner first verifies all seven selected source hashes and the exact accepted ZIP SHA256 33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1 before credential prompts. The helper then reuses the existing actual inspector and its bounded saved-Windows-receipt check plus four fixed metadata GETs. It requires both fail-closed channels, latest date off, exactly the three matching plain-text markers, no other variables, one correct DO binding per channel, the expected SQLite namespace and disabled limiter public URLs. A reported Git source, Wrangler-managed channel, missing date or current Functions deployment is refused rather than treated as permission to alter a running gateway.

If both dates already match, there is no write. Otherwise exactly one PATCH is sent to the fixed selected-account endpoint /pages/projects/mushavo-budget-staging with this complete body:

```json
{"deployment_configs":{"production":{"compatibility_date":"2026-07-01"},"preview":{"compatibility_date":"2026-07-01"}}}
```

No environment variables, bindings, compatibility flags, build/source settings or secret values are submitted. A separate fresh project GET must confirm both dates. Every other field observed in deployment_configs is compared privately with the fresh pre-write snapshot. Selected identity, source, build, branch, domains and deployment metadata are also compared unchanged. Object order is ignored; changed values, missing settings and changed arrays are not ignored. No comparison values or hashes are printed. The API may normalize fields or another operator may change them; either produces review-required state, not an assertion that all changes were caused by this script.

Normal execution is four GETs, at most one PATCH and one independent GET: six requests maximum. Already-matching dates use four GETs only. Responses are capped at 2MiB, requests use 15-second timeouts, redirects are refused, and no write is retried or automatically rolled back. A failed write/readback retains remote_state_may_require_review:true. A private-runner failure after child launch reports unknown mutation state rather than falsely claiming no settings write. Concurrent configuration updates are not excluded or claimed atomic. Do not run parallel dashboard edits. Return a failed receipt before any write retry; read-only review comes first.

## Credentials and owner handoff

The API update requires Pages Write (Cloudflare dashboard token permission Account > Cloudflare Pages > Edit). The reused inventory GETs require Account > Workers Scripts > Read. Scope the token to the account containing mushavo-budget-staging. A read-only Pages token can inspect but cannot perform this PATCH. The complete pinned terminal block is supplied in chat; no npm install is needed.

The Windows private runner retains the proven ProcessStartInfo/redirected-stdin pattern and independently resolves the working Node process.execPath. Token input is hidden SecureString, is passed only through child stdin, and is not placed in command arguments, environment or files. Child debug/TLS-disable/keylog and Cloudflare/Wrangler credential environment overrides are removed; raw stderr is not printed; BSTR/SecureString/process resources are released. The new version's actual Windows execution remains pending even though this pattern was previously exercised by the owner. The owner block parses its PowerShell source before credential prompts. No Zoho DPAPI file, application credentials, Auth or SQL action is required for this date update. Keep the ZIP unuploaded and do not redeploy.

## Local verification and preserved evidence

55 local cases pass on Node v24.19.0: 37 new date-mutator cases and 18 unchanged inspector regressions. Five JavaScript syntax checks and all seven manifest hashes pass. The tests exercise the real helper with synthetic Cloudflare responses, the exact request body/order, guard refusals before writes, idempotence, null errors, bounds, unknown write outcomes, changed variables/bindings/flags/unknown settings/deployments, value privacy, actual CLI rejection and a minimal seven-source export without npm. PowerShell privacy/error-state assertions are source checks, not a claim of native Windows execution. No real provider request or PATCH is performed by the assistant; real Cloudflare merge/readback remains pending.

The original inspector/runner/manifests, application/SQL sources, reviewed Worker and retained ZIP remain unchanged. All earlier 88 events, 123 coverage rows, full 20 finding definitions, unrelated stage objects and historical source pins are preserved. Prior full 1525 regression remains scoped to its original pin and is not rerun for this new deployment helper. No findings close. Release gate OPEN_PENDING_REQUIRED_EVIDENCE; final re-audit PLANNED_NOT_PERFORMED. Production/native unchanged, APK deferred.

## Primary source

https://developers.cloudflare.com/api/resources/pages/subresources/projects/methods/edit/ — checked 19 October 2026: PATCH project endpoint, Pages Write permission, optional deployment_configs.production/preview compatibility_date fields. Omitted configuration is not replayed from the GET into the PATCH. Actual selected-settings preservation must still pass independent readback; the documentation is not hosted acceptance.
