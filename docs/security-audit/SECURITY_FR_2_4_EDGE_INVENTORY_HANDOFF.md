# E5.10 read-only staging Edge metadata inventory

Latest outcome: [four selected functions absent; first-deployment preparation](SECURITY_FR_2_4_EDGE_ABSENCE_AND_FIRST_DEPLOYMENT_PREPARATION.md), FRE105. The revision-2 owner observation resolves which prerequisite is missing. No rerun or hosted write is requested at this receipt checkpoint. Earlier handoff follows.

Current outcome: [owner review and revision-2 diagnostics](SECURITY_FR_2_4_EDGE_INVENTORY_REVIEW_AND_DIAGNOSTICS.md), FRE104. Both initial GETs returned HTTP 200, but a selected function was missing or non-active. Revision 2 adds bounded per-function presence observations before refusal; the current verifier has 28 cases. Use the revised pinned owner block from chat. No deployment or permission expansion is requested.

21 October 2026, FRE103. E5.9's [provider-routed read-only target pass](SECURITY_FR_2_4_MANAGEMENT_TARGET_OUTCOME.md) is retained. This next check inventories the four Edge functions exercised by the reviewed Deno suite. It is one preparation checkpoint within the coordinated rollout; Pages refresh, source parity, recoverable deployment artifacts, canonical integration and the full cross-service recovery handoff remain outstanding.

## Fixed request contract

The checker makes at most **seven GET requests** to the Supabase Management API, all under the fixed staging project `dczlddwbtgvfdujgcitb`:

1. Project metadata, requiring the exact reference, default database hostname and `ACTIVE_HEALTHY` status.
2. The function list.
3. Four individual function metadata reads, in the fixed order below.
4. The function list again.

| Selected function | Reviewed source boundary | Local gateway JWT setting |
|---|---|---|
| `invite-admin-user` | Auth user, email-session proof and independent Admin authorization | No explicit override in `supabase/config.toml`; report the hosted boolean without inventing a deployment setting |
| `invite-business-member` | Auth user, email-session proof and Business invitation authorization | No explicit override; report the hosted boolean |
| `send-test-push` | Auth user, email-session proof and recipient boundary | Explicit `verify_jwt = false`; handler validates Auth itself |
| `sync-exchange-rates` | Browser-session proof and independent FX authorization; separate cron path | Explicit `verify_jwt = false`; handler retains its independent authorization |

The exact selected normalized metadata must agree across list/detail/list. All four functions must be active and have valid versions, timestamps and boolean `verify_jwt` values. Missing functions, malformed metadata, selected drift, timeout or an unexpected HTTP response stops without retry. An observation agreement is not a lock or proof that no concurrent or later change occurred. An unrelated function may change without this check failing; only its initial count is reported.

Receipts expose only these fixed slugs, numeric versions/timestamps/counts, active status, presence/status-match and JWT/import-map booleans, a SHA256 of each selected function identity, and an optional validated provider bundle SHA256. Validated list observations retain all four selected presences before a missing/non-active function stops the check. IDs, arbitrary provider status text, names, entrypoint paths, unrelated function names, raw responses and credentials are suppressed. Provider bundle hashes are observations, not a comparison with local source or a retained deployable artifact. Missing optional provider hashes are reported as null. No JWT policy match or runtime acceptance is inferred from a boolean.

No function invocation, function-body download, secret endpoint, SQL endpoint, application row, Auth session, mail/push action, deployment or configuration write is requested. Each GET has a ten-second timeout and a 256KiB JSON limit. Redirects and alternate response URLs are rejected. There are no caller-provided URLs, slugs, SQL or write fallback paths.

## Private Windows execution

Create a short-lived scoped Supabase Management token for **Mushavo Budget Staging only** with:

- **Project → Project Settings: Read**.
- **Application services → Edge Functions: Read**.
- All other permissions: **None**.

The previous token's requested Database Read permission does not cover Edge metadata. If it has only the earlier permissions, create a separate scoped token with the two permissions above. Enter the token only at the hidden local prompt. Its prefix is checked, but the token's scope is not independently inspected.

The [PowerShell wrapper](../../scripts/run-fr-2-email-edge-inventory.ps1) copies the private-child pattern successfully exercised in E5.9, with this stage, handler, maximum request count and receipt allowlist. It checks source hashes and rejects redirected paths before a token-free child preflight, then captures UTF-8 stdin/stdout privately. It does not place the token in arguments, environment or a plaintext file. BSTR/byte buffers are cleared; managed process strings are not claimed forensically erased. Raw stderr and exceptions are suppressed. The entire child has a 90-second limit. Native Windows parsing and execution of this new wrapper remain owner evidence pending.

The complete owner block is supplied in chat. It exports the pinned commit to a fresh temporary directory, runs the built-in Node verifier with **no npm installation**, parses the PowerShell wrapper and starts the private read-only runner. Return both safe JSON results and exit codes. Keep the ZIP unuploaded; do not run an installer or change JWT settings to satisfy this inventory.

## Local validation and remaining work

[Manifest](security-fr-2-email-edge-inventory-source-manifest.json), [local result](security-fr-2-email-edge-inventory-local-checks.json), [handler](../../scripts/check-fr-2-email-edge-inventory.mjs), [tests](../../tests/fr-2-email-edge-inventory.test.mjs).

The original 24 offline cases exercise the actual exported handler with synthetic provider ports: exact URLs/methods, request bounds, caller overrides, wrong target/host/health, permission/rate/HTTP failures, missing/inactive/duplicate functions, malformed selected metadata, optional fields, list/detail/list drift, unrelated-function suppression, credential/path/exception redaction, redirect/content-type/JSON/stream limits and private CLI handling. Revision 2 retains these and adds four diagnostic regressions, for 28 cases. Default fetch/HTTP is blocked during tests; no real token or hosted request is used. A clean archive verifier rehearsal is recorded separately in the local result. Existing runtime suites are not claimed rerun.

A successful owner inventory will identify the observed selected versions and settings. It cannot establish their source contents, provider runtime/JWT behavior, recoverable prior artifacts, current Pages identity/bindings, database write target/privileges, backups, canonical candidate integration or coordinated recovery. Those remain required before an executable deployment handoff. No hosted write, deployment or live activation is approved by this checkpoint. Hosted acceptance stays false, findings stay open, production/native remain unchanged and APK work stays deferred.

## Primary references reviewed 21 October 2026

- https://supabase.com/docs/reference/api/v1-list-all-functions — GET `/v1/projects/{ref}/functions`, `edge_functions_read`, metadata response.
- https://supabase.com/docs/reference/api/v1-get-a-function — GET `/v1/projects/{ref}/functions/{function_slug}`, `edge_functions_read`, metadata response; distinct from the body endpoint.
- https://supabase.com/docs/reference/api/v1-get-project — fixed project metadata and `project_admin_read`.
- https://supabase.com/docs/guides/platform/personal-access-tokens — Project Settings and Edge Functions Read permission labels, resource scoping and scoped-token prefix.
