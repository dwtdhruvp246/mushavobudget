# Batch G: compiled gateway integration, frontend preflight and staging upload

## Owner preflight completed — dashboard upload pending

22 October 2026, FRE130. [Owner receipt](security-fr-2-email-batch-g-owner-preflight-pass.json) reports five read-only requests and exit 0 at 16:00:14.404Z; the exact 44-file ZIP and all selected Pages/limiter metadata checks passed. No upload completion was supplied. Proceed to the existing conditional dashboard upload instructions below using the exact verified Batch B ZIP. Do not rerun this static-deployment preflight after uploading the gateway. No new owner offline test total is inferred from this hosted receipt. Database activation and hosted acceptance remain pending.

---

22 October 2026, FRE129. Batch F dormant registration is complete at its verified scope. This handoff combines the remaining local compiled integration check, retained frontend artifact proof, fresh Cloudflare metadata preflight and a conditional owner dashboard upload. It does not install or activate database guards.

| Combined work | Scope |
| --- | --- |
| Compiled gateway/database integration | Rebuild the actual accepted `_worker.js` with esbuild0.28.2 and require its exact accepted SHA256. Execute its handlers against actual integrated registration/quarantine/recovery SQL in PGlite0.5.8 and the actual shared Edge session check. |
| Retained frontend proof | Read the exact Batch B ZIP without extraction. Require44 canonical entries, its accepted SHA256, exact Worker SHA256, staging configuration and present public VAPID key. The earlier Batch B exact private/public key pairing proof is retained; no private packet is reopened. |
| Fresh Pages/limiter preflight | Five fixed Cloudflare GETs check the staging Pages target, current static deployment, limiter/SQLite namespace/public-URL metadata, fixed dates, fail-closed settings, markers, bindings and13 secret-text names in both channels; repeat selected Pages metadata before completion. |
| Conditional manual upload | Only after the complete owner command exits0, upload exactly the verified ZIP to the **Production channel of the existing `mushavo-budget-staging` Pages project**. This is the live channel of the staging site. The actual production application/project is outside this handoff. |

## Local verification

[Local result](security-fr-2-email-batch-g-local-checks.json): **31/31**,127 source hashes,4 JavaScript syntax checks,Node24.19.0,PGlite0.5.8,esbuild0.28.2. The original Batch F101 source identities are preserved. No application, Worker or SQL implementation changed; the new code is preparation/verification tooling and tests.

The17 integration cases exercise the actual compiled accepted Worker through explicit synthetic Auth, Zoho and Durable Object ports, with actual integrated SQL behind the modeled PostgREST port. They verify registered-only failure without mail dispatch; real quarantined installation of148 RPC guards and82 policies; code proof creation while access remains blocked; explicit resume aligning gateway status/shared Edge authorization/own-row access; unverified account/session denial; remembered restore without sliding expiry; cross-account cookie refusal; quarantine retaining proofs; drift refusing resume; unchanged recovery; revocation; limiter denial; and static credential stripping. Auth JWT validation, Zoho delivery and a real Durable Object runtime are not established by these synthetic boundaries. The native Deno entrypoints are not rerun here; the actual shared deployed session-check module is exercised against its real SQL predicate.

The14 preflight/artifact cases cover canonical ZIP proof, correct staging configuration, mandatory public VAPID presence, fixed GETs, both channels, installed secret metadata, target/deployment/settings drift, limiter namespace/inventory/public-URL failures, all five transport failure positions, redacted errors, bounded responses and private CLI input. Secret values are not accessed by the summaries or compared; providers may return them within the private JSON response body. Only known nonsecret staging markers are compared by value.

The new small dependency fixture combines previously locked PGlite and esbuild packages, including esbuild's platform-optional packages, without Miniflare. Lifecycle scripts are disabled. An attempted local offline npm installation stopped because the esbuild tarball was not in that environment's npm cache; tests used the already installed pinned versions. The owner's command performs the real public-registry `npm ci`. Installed dependency bytes are not independently hashed. Windows parent execution and actual new provider preflight remain owner-pending.

## Prompts, in order

1. **Only if the retained default ZIP is missing:** full path to the Batch B `mushavo-email-push-review.zip`. It was printed after Batch B completed. Its accepted SHA256 cannot be overridden. The expected retained path is:

   `C:\Users\HP\AppData\Local\Temp\mushavo-batch-b-27ecd840ce3a42fb9a5c9bd008f3d9e4\batch-b-frontend\mushavo-email-push-review.zip`

2. **Cloudflare Account ID** for the account containing `mushavo-budget-staging`. Reuse the earlier Pages/limiter account ID. Cloudflare documents copying it from Workers & Pages → Account Details, or dashboard search → `Copy account ID`: [official instructions](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/).
3. **Cloudflare API token**, hidden: reuse the token used for the earlier Pages/limiter read checks. It needs the same previously exercised read capabilities for the Pages project, Worker inventory, Durable Object namespace inventory and limiter public-URL settings. No write API permission is used by this command. If authorization fails, return the safe result rather than changing unrelated token scopes.

Both mandatory credential prompts concern Cloudflare. No Supabase Management token, email address, password, VAPID/CurrencyAPI key or encrypted packet is requested. The Account ID and token travel only in the private process/stdin path, not arguments/environment/files/safe output. The verified public ZIP path is printed on successful completion.

## Preflight behavior

The fixed target is `mushavo-budget-staging.pages.dev`; its configuration must still point to Supabase staging `dczlddwbtgvfdujgcitb`. The existing static deployment must have `uses_functions:false`, a valid deployment identity, no Git source and no Wrangler-managed channel configuration. Both channels must have compatibility date2026-07-01, automatic latest date disabled, fail_open:false, exactly16 selected variables comprising3 exact plaintext markers plus13 secret-text entries, the selected limiter binding and no extra Durable Object binding.

The reused metadata inspector must establish a complete selected Worker inventory, one matching SQLite namespace and disabled workers.dev/preview URLs for the limiter. A separate Pages GET must retain selected project/deployment identity and the same required channel metadata. Only the previous static deployment ID's SHA256 enters the receipt; raw account, namespace and deployment identifiers are omitted.

This is a metadata snapshot, not a write lock. It does not prove secret-value equality, deployed limiter source bytes, all unselected settings, full caller/scheduler graph, prior deployable artifact retention or runtime gateway/limiter operation. A changed secret value with the same secret-text metadata is intentionally not claimed detected. This preparation scope is sufficient only for the exact staging frontend handoff; remaining activation/acceptance prerequisites are preserved.

The checker accepts only account/token/ZIP input and has no deployment path. It makes four fixed baseline GETs plus one independent Pages GET, refuses redirects, bounds JSON bodies and performs no retry, settings mutation, SQL/Auth/Edge request or provider dispatch. Unexpected existing functions or changed target/installed state require review; this preflight is not intended to be rerun unchanged after publishing the new gateway deployment.

## Owner command and conditional upload

Run the full pinned PowerShell block supplied in chat. It fetches the security branch into an isolated LF Git archive, installs the two pinned public test dependencies with scripts disabled, runs31 tests, verifies127 source identities, parses the private PowerShell runner, verifies the retained ZIP and performs the five GETs. Expect BATCH G STARTED, then COMPLETE for preflight or STOPPED FOR REVIEW. Source/ZIP failure stops before credential use; any hosted failure stops before the manual upload instruction applies.

**Only if both offline verification and combined Batch G exit codes are0**, with `manual_staging_frontend_upload_preflight_passed:true`:

1. Open Cloudflare Workers & Pages and select the existing **mushavo-budget-staging** project in the account just checked.
2. Choose **Create a new deployment** and **Production** within this staging project. Preserve the existing deployment/history for the pre-activation recovery window.
3. Upload only the path printed as **VERIFIED FRONTEND ZIP**. Choose **Save and Deploy** and wait for the dashboard's success result. Do not create another project or modify configuration while uploading.

Cloudflare supports ZIP drag-and-drop and prebuilt `_worker.js` files for existing Direct Upload Pages projects: [Direct Upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) and [Advanced mode](https://developers.cloudflare.com/pages/functions/advanced-mode/). The fresh preflight refuses Git-managed or already-function-enabled targets because those require a different rollout/review path.

This step publishes the staging frontend/gateway. Staging sign-in may show verification unavailable while database mode is still REGISTERED and backend RPCs are not installed. That failure is exercised locally and dispatches no mail. The next database step must install guards/backend in QUARANTINED mode and verify recovery before access is opened. This handoff provides no activate/resume/quarantine SQL and no scheduler or email-send instruction.

If preflight fails, send the safe JSON and exit code before uploading. If the dashboard upload fails or its outcome is unclear, send the deployment status before retrying. A successful dashboard status is owner deployment evidence; live source/asset parity, gateway runtime and provider behavior still need independent post-deployment checks.

**Send both safe JSON results, the combined Batch G exit code and the dashboard deployment status.** The actual application production project, native packages and APK remain unchanged/deferred. Full findings, live activation approval and hosted acceptance remain open. No overall launch percentage is inferred from test totals.
