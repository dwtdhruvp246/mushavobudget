# FR.2.4.E5.2 Pages baseline passed; E5.3 public settings

19 October 2026, FRE88. The [owner receipt](security-fr-2-email-pages-baseline-owner-pass.json) at pinned source commit `553c6642948a14dfcdc8254fcc5aa70463d95368` completed at 2026-10-19T15:48:11.280Z with exit 0. All six source hashes and the exact accepted local ZIP were rechecked. All four fixed Cloudflare GETs returned HTTP 200 and successful envelopes. The selected account contains the expected staging Pages project and limiter Worker; the selected Durable Object namespace is SQLite and limiter workers.dev and preview URLs remain disabled. The namespace envelope again has errors:null and is accepted by the reviewed null-errors interpretation.

## Interpretation and retained limits

The earlier user-transcript attempt at 2026-10-19T12:19:32.941Z stopped on the first Pages GET with HTTP 401, one request and no parsed JSON. The other resource checks did not run; their false fields were not absence evidence. No exact authentication root cause was established. The subsequent successful run resolves the authentication blocker for this read-only run without proving that a particular token change caused it. No new diagnostic, repeated application test suite or runtime code change is justified by that failure.

Both current staging channels report fail_open:true and compatibility_date_matches_reviewed:false, with always_use_latest_compatibility_date:false. All 16 selected variable states, three marker comparisons and the Durable Object binding are NOT_REPORTED. Counts are null. Those maps are not reported, so this is not proof that variables or bindings are absent; sensitive_required_variables_in_plaintext:0 also does not establish a complete credential configuration.

The provider reports no Git source metadata and canonical_deployment_uses_functions:false. These are bounded API observations, not proof of deployed source identities or a new package upload. The existing static deployment is not the prepared email gateway deployment. The accepted ZIP remains `33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1`, reviewed Worker `fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99`, 44 files. Source/ZIP/bindings/secrets/SQL were not changed by the baseline. No email or provider dispatch occurred. gateway_configuration_ready_verified, Supabase project identity, live activation and hosted acceptance remain false.

## Concrete next owner action: settings only

[Contract](security-fr-2-email-pages-public-settings-contract.json). Open Workers & Pages and select **mushavo-budget-staging**, then Settings. Configure the **Production and Preview environments of this staging project**. Production here is the live channel of the staging project, not the actual production application. Leave unrelated settings, compatibility flags, variables, secrets and bindings intact.

1. Under Runtime, set a fixed compatibility date of **2026-07-01** for both channels. Leave automatic/latest date selection off. This is the date used by the reviewed runtime templates; do not substitute today's date.
2. Under Runtime > Fail open / closed, select **Fail closed** for both channels. Cloudflare's Free-plan fail-open mode otherwise serves static assets after the Pages Functions daily allowance is exhausted. This setting prevents that static fallback; it is not a replacement for database authorization.
3. Under Variables and Secrets, add the following **Text/plain-text** values in each channel. If a same-name value already exists and matches, keep it. If it differs or is an encrypted target marker, return the name/state for review rather than silently replacing an unknown configuration.

| Name | Public value |
| --- | --- |
| EMAIL_GATE_MODE | STAGING_CONTROLLED_ONLY |
| EMAIL_GATE_PROJECT | dczlddwbtgvfdujgcitb |
| EMAIL_GATE_ORIGIN | https://mushavo-budget-staging.pages.dev |

4. Under Bindings > Add > Durable Object, use binding name **EMAIL_GATE_LIMITER_NS** and select the **existing** namespace exported by Worker **mushavo-email-rate-staging**, class **EmailGatewayRateLimiter**. Do this for each channel. Keep an existing exact match. Do not create another namespace or replace a conflicting binding without review.
5. Save these settings. **Do not redeploy or upload the ZIP yet.** Cloudflare documents that a binding takes effect on a subsequent deployment. This is configuration preparation, not evidence that the current deployment is using the binding.
6. Run the existing pinned E5.2 read-only inspection again. Its receipt intentionally retains E5.2 as its stage name and gateway_configuration_ready_verified:false; it is reused for E5.3 configuration readback. Expect both date matches:true, always-latest:false, fail_open:false, each of the three markers MATCH with PLAIN_TEXT variable type, and each limiter_binding MATCH. Any secret-state entries can still be absent or NOT_REPORTED at this checkpoint; they are not accepted as configured by implication.

The Pages gateway remains restricted to the canonical staging origin in reviewed source; setting the same canonical marker in Preview does not authorize a preview URL for email API calls. This checkpoint introduces no credentials, pepper generation, Zoho DPAPI access, Supabase role assignments, SQL activation or provider traffic. Secret configuration, independent staging-key ownership, coordinated Pages/Edge/SQL rollout, genuine Auth/mail/browser/session recovery and final acceptance are still pending.

If dashboard controls are absent, managed by a Wrangler configuration or show conflicting target values, report that specific non-secret state. A dashboard screenshot must exclude credentials. No further approval is requested here; this is the bounded next staging-remediation step already within the authorized work.

## Evidence handling

The exact owner JSON is retained without invented fields. The contract and handoff are new documents; the six hashed inspection inputs and manifest remain unchanged. Documentation/evidence validation preserves all earlier 87 events, 123 coverage rows, all 20 full finding definitions, unrelated stage objects, existing application/SQL/runtime sources and historical source pins. No new application tests are needed for a documentation/settings handoff. The prior 18 synthetic inspector cases and full 1525 offline regression remain evidence at their original pins, not newly run or hosted acceptance.

All full findings remain open. Release gate OPEN_PENDING_REQUIRED_EVIDENCE; final re-audit PLANNED_NOT_PERFORMED. Actual production and native remain untouched; APK update deferred.

## Primary references checked 19 October 2026

- https://developers.cloudflare.com/pages/functions/routing/#fail-open--closed — dashboard Runtime path and Free-plan fallback behavior.
- https://developers.cloudflare.com/pages/functions/bindings/#durable-objects — bind an already deployed DO via Settings > Bindings; redeploy required for runtime effect.
- https://developers.cloudflare.com/pages/functions/bindings/#environment-variables — add plain-text values via Settings > Variables and Secrets.
- https://developers.cloudflare.com/pages/functions/wrangler-configuration/#handling-compatibility-dates-set-to-latest — dashboard latest-date behavior and fixed configuration dates.

The external references support Cloudflare behavior and UI paths. The exact application marker values, binding identity and fixed date come from the reviewed repository contracts/runtime, not the external docs.
