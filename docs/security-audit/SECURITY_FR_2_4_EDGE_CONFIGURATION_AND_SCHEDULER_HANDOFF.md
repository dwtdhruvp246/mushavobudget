# E5.12 read-only Edge configuration and scheduler visibility

Current outcome: [owner observation completed](SECURITY_FR_2_4_EDGE_READINESS_OBSERVATION_OUTCOME.md), FRE109. Four requests completed; all selected routes and custom names were absent, the cron relation was not observed, and aggregates remain null. This historical preparation handoff below is retained. No rerun is requested.

21 October 2026, FRE108. The [owner Windows package pass](SECURITY_FR_2_4_FIRST_EDGE_WINDOWS_OUTCOME.md) is retained. This new checker collects selected metadata needed before preparing deployment/configuration writes. It does not certify readiness, deploy functions or change the accepted source package.

[Private handler](../../scripts/check-fr-2-email-edge-readiness.mjs), [Windows parent](../../scripts/run-fr-2-email-edge-readiness.ps1), [verifier](../../scripts/verify-fr-2-email-edge-readiness.mjs), [catalog SELECT](../../supabase/diagnostics/security_fr_2_4_email_edge_scheduler_access.sql), [aggregate SELECT](../../supabase/diagnostics/security_fr_2_4_email_edge_scheduler_aggregates.sql), [manifest](security-fr-2-email-edge-readiness-source-manifest.json), [contract](security-fr-2-email-edge-readiness-contract.json), [local checks](security-fr-2-email-edge-readiness-local-checks.json).

## Fixed request and disclosure contract

All requests use the fixed Management API prefix `https://api.supabase.com/v1/projects/dczlddwbtgvfdujgcitb`. There are at most five requests, without retries, redirects or a general-query/write fallback:

| Order | Operation | Bounded receipt |
|---|---|---|
| 1 | GET project metadata | Exact project reference/default database host and active status matched; no names/IDs/body printed |
| 2 | GET `/functions` | Four fixed selected-slug presence booleans; count and SHA256 of selected metadata fields for other functions |
| 3 | GET `/secrets` | Only six fixed custom configuration names with `listed` booleans |
| 4 | POST `/database/query/read-only` with the pinned catalog SELECT | Execution context, `cron.job` presence/type, relevant grants and RLS controls |
| 5, conditional | Same dedicated read-only endpoint with the pinned aggregate SELECT | Visible job/active-job counts and active command-text matches for `sync-exchange-rates`, plus selected RLS visibility controls |

The six custom names come from the actual four entrypoints: `APP_ORIGIN`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CURRENCYAPI_API_KEY`, `CURRENCY_SYNC_SECRET`. Platform-supplied `SUPABASE_*` environment presence and actual values are not established by the list. Supabase reserves the `SUPABASE_` prefix; this checker requests no manual writes to those names. Missing custom names remain explicit false observations, not verified runtime absence or an instruction to write credentials.

The documented secrets response schema includes a `value` field. The private local child treats every non-name field as opaque and does not consume, compare, hash, print or save it. It does not assume the field is a digest or claim the provider returned only names. Raw responses exist transiently in process memory; no forensic erasure guarantee is made. Only the six fixed labels are returned, never arbitrary configured names or provider values. No API key retrieval or saved packet access occurs.

The other-function digest includes normalized slug, ID, status, version, JWT flag and creation/update times, sorted by slug. Those arbitrary strings remain private. This is selected metadata identity at one observed time, not a full source/configuration fingerprint, recoverable artifact, provider lock or proof of how project-wide configuration changes affect that function. Selected functions that have appeared since the earlier absence observation are explicitly reported. Their appearance is not permission to overwrite them.

Each request has a 12-second timeout and 256KiB JSON limit. Unexpected HTTP/shape/context responses stop, without returning private error bodies or continuing through an alternate endpoint.

## Scheduler interpretation

The first SQL statement reads only schema-qualified PostgreSQL catalogs. It checks the actual read-only execution role/transaction, whether `cron.job` is an ordinary or partitioned table with boolean `active` and text `command` columns, relevant read privileges, RLS/FORCE RLS and selected owner/bypass controls. It creates no object, changes no role/grant and reads no application row or scheduler command.

The aggregate SELECT is submitted only if the table shape and schema/table read privileges are established. It reads operational scheduler metadata rows and compares command text inside PostgreSQL, returning numbers and booleans only. It does not execute that text, call a scheduler routine, fetch Vault values or inspect job-run logs. No application/hook/scheduler function is explicitly invoked. Normal PostgreSQL RLS still applies to the selected read; it may filter rows.

Absent relations, wrong shapes and missing grants skip the aggregate request and retain a null aggregate, never an invented zero. An RLS-filtered zero count is explicitly limited. The `all_rows_visible_under_selected_rls_controls` boolean describes the selected catalog controls, not an independent proof of all operational callers. Literal case-insensitive command-text matches do not resolve indirect/dynamic targets, wrapped routines, external schedulers or callers. Even a zero match count leaves full scheduler/caller acceptance false. No job is run, paused, rescheduled or deleted.

## Results and private execution

A complete observation returns `STAGING_EDGE_CONFIGURATION_AND_SCHEDULER_VISIBILITY_OBSERVED_NOT_READINESS_APPROVAL`, exit 0. Missing custom names, newly present selected functions, unavailable scheduler read access and restricted row visibility are reported for review while `readiness_approved`, runtime environment/value acceptance, shared-configuration impact, external-caller acceptance, privileged write targeting and hosted acceptance remain false. Exit 0 means bounded collection completed, not that these deployment gates passed. HTTP/context/shape failures return exit 1.

Use a short-lived scoped token for **Mushavo Budget Staging only**, with exactly these Read permissions:

- **Project → Project Settings: Read**.
- **Database → Database: Read**.
- **Application services → Edge Functions: Read**.
- **Application services → Edge Function Secrets: Read**.

All other permissions should be None. An existing token with all four permissions can be reused if still valid. The extra secrets permission enables the configuration-list request; Database Read enables the fixed scheduler SELECTs. No write permission, classic token, API-key-secret permission or Supabase CLI login is requested. Token prefix validation does not independently inspect its configured scope.

The Windows parent copies the owner-executed private-child pattern, adjusted only for this stage, entrypoint, five-request ceiling, manifest and bounded receipt fields. It verifies 14 source hashes and performs a token-free child preflight before hidden input. The token is captured through private UTF-8 stdin, never arguments, environment or a plaintext file. BSTR and stdin byte buffers are cleared; managed process memory is not claimed erased. Raw stderr is suppressed. Native parsing and execution of this new wrapper remain owner evidence pending.

The complete pinned PowerShell block is supplied in chat. It exports source to a fresh directory, installs the locked single public PGlite dependency with lifecycle scripts disabled, runs the offline verifier, parses the PowerShell wrapper, then prompts privately for the scoped token. Return both safe JSON results and exit codes. Do not paste a token, provider body or scheduler command in chat.

## Validation and remaining work

Local verification: **33 PASS**, 14 source hashes and four JS syntax checks. Twenty-six transport/CLI cases exercise the actual handler and seven PGlite cases compile/run the actual fixed SELECTs under a modeled read-only role. The scheduler table/rows, RLS policies and role changes in tests are explicit synthetic fixtures, not an installed pg_cron scheduler. Private-looking fixture command text is stored as inert data, never executed. Default fetch/HTTP is blocked in tests; no real token or hosted request is used. A clean Git-tree archive rehearsal is recorded separately without increasing the distinct case count. Installed dependency bytes are not independently hashed.

An initial test fixture mislabeled a syntactically valid unselected environment name as malformed; the fixture was corrected to an invalid hyphenated name. The final full verifier result supersedes that development attempt. No acceptance guard was loosened.

The prior 20-file source package, 18-file inventory, 68-file target checker and 78-file SQL candidate identities are unchanged. The owner package identity and all readiness flags remain intact. Source values, runtime key validity, the unrelated function's source/shared-setting impact, external callers, current Pages deployment/bindings, canonical integration, future writes, uncertain-outcome handling and coordinated recovery still need their scoped evidence. No deployment, secret write, SQL registration/activation, scheduler change, mail/push/FX action or ZIP upload is requested.

## Primary references checked 21 October 2026

- https://supabase.com/docs/reference/api/v1-list-all-secrets — GET route, response fields and `edge_functions_secrets_read`.
- https://supabase.com/docs/reference/api/v1-read-only-query — dedicated beta endpoint, schema-qualified references, `supabase_read_only_user`, `database_read`.
- https://supabase.com/docs/guides/cron — `cron.job` operational metadata and separate job-run records.
- https://supabase.com/docs/guides/functions/secrets — custom configuration, reserved platform prefix and project-wide runtime visibility.
- https://supabase.com/docs/guides/platform/personal-access-tokens — scoped-project resources and the four Read permission labels.
