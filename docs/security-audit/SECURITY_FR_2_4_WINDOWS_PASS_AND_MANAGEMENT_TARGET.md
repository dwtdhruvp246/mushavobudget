# E5.8 Windows pass and E5.9 fixed read-only Management API target check

Current outcome: [E5.9 owner pass](SECURITY_FR_2_4_MANAGEMENT_TARGET_OUTCOME.md), FRE102. Both fixed provider requests succeeded, all eight selected checks matched and the private runner exited zero at `2026-10-21T08:54:12.854Z`. No repeat of the historical owner action below is requested. This receipt does not verify a future installation target or grant activation approval.

21 October2026,FRE100–101. [E5.8 owner receipt](security-fr-2-email-staging-rollout-owner-Windows-pass.json) confirms70PASS,78hashes,12syntax checks and exit0 at commit `0a0244f05e8b81f744afbca526f5a7c80a92564d`. The activation/recovery source remains a separate candidate; no ordered migration/canonical source or hosted application changed. All78 original source identities were rechecked unchanged while preparing this step; those70 tests are not claimed rerun.

## Why this check is separate

The candidate's project GUC is an operator acknowledgement. A future write must run through a trusted, pinned staging connection. This new check exercises one provider-routed catalog read through a fixed Management API path; it cannot attest a later SQL Editor tab, connection, write token or privileged installation. A pass is not permission to activate the candidate.

[Contract](security-fr-2-email-management-target-contract.json), [fixed SQL](../../supabase/diagnostics/security_fr_2_4_email_management_target.sql), [private handler](../../scripts/check-fr-2-email-management-target.mjs), [PowerShell parent](../../scripts/run-fr-2-email-management-target.ps1), [manifest](security-fr-2-email-management-target-source-manifest.json), [local checks](security-fr-2-email-management-target-local-checks.json).

## Request and credential contract

The parent asks privately for a scoped Supabase Management API personal access token, limited to staging project `dczlddwbtgvfdujgcitb` with **Project Settings: Read** and **Database: Read**. This is separate from the Cloudflare token and saved application keys. No saved credential packet, ZIP, database password or app key is accessed. The token is passed only through captured stdin, never command arguments, environment variables or a plaintext file. Managed strings can exist in process memory; clearing references is not a claim of forensic erasure.

The fixed first request is GET `/v1/projects/dczlddwbtgvfdujgcitb`. It requires the documented project reference (or the older id-as-ref metadata shape), exact default database hostname and active status. The second request is POST `/v1/projects/dczlddwbtgvfdujgcitb/database/query/read-only` with one pinned SELECT statement. It requires an actual `supabase_read_only_user` result, read-only transaction mode, and eight boolean checks for selected counts/types/RLS/view metadata and absent email installation. All base catalog relations are schema qualified. No application table row or application/hook routine is queried or invoked.

The query deliberately does not substitute for the original privileged policy/routine fingerprint and exact hook-definition guard. Deparsed expression fingerprints depend on search path; a privilege-reduced target probe uses narrower count/type/state checks without pretending to reproduce that guard or changing session settings. Full fingerprint and hook-definition acceptance stays false in its receipt. The original privileged activation guards remain unchanged.

The scoped-token prefix is input validation, not an independent inspection of token permissions. The requested scope is least privilege for these two endpoints. The Node handler rejects caller URLs, SQL, extra fields, redirects, unexpected content types, oversized responses, malformed results and wrong target metadata. It makes at most two requests, with no retry or fallback to the general query endpoint. Both endpoints are provider control-plane APIs; the dedicated query endpoint is documented as beta. An unavailable endpoint or unexpected response stops for review.

Only fixed labels, booleans, numeric HTTP status and bounded error codes are printed. Project names, database identifiers, credentials, raw provider bodies, row contents and routine source are not copied into receipts. The parent checks source identities and performs a token-free child-pipe preflight before requesting the token. Source hash/PowerShell syntax/private-pipe failure stops before the prompt.

## Verification and limits

Local final verifier: **21PASS,0fail,exit0**, Node24.19.0/PGlite0.5.8, **68source hashes and6JS syntax checks**. Eighteen tests exercise the actual private handler and CLI with synthetic transport: the exact two URLs/methods/body, no override fields, wrong/contradictory targets, wrong database host, inactive state,401/403/429/500 stops, no fallback, redirects/content types/size limits, strict receipt shape/booleans, role/transaction refusal, redaction and token-free CLI preflight. Three actual in-memory PostgreSQL tests compile the fixed SELECT under a modeled read-only role, verify it requires no application-row SELECT grants, and detect an existing installer namespace.

Fixtures explicitly model six additional empty Storage tables and four inert extension hooks to represent selected hosted counts. Their real provider implementation/behavior is not reproduced. No runtime/network/Windows behavior is inferred from those fixture rows. Default Node HTTP/fetch is disabled outside injected transports. No real Management API call or token was used. PowerShell native parsing, hidden input and child execution remain owner evidence pending. The owner block parses PowerShell before execution and preflights the child before prompting.

Earlier development exposed that the privileged deparsed-policy hash does not transfer directly to a different search path, and that the local bootstrap models only two hosted Storage tables. The final query is explicitly a narrower target/count/type/state probe, not a relaxed activation guard; extra Storage-count fixtures are explicit. The final21-case result supersedes intermediate development attempts only for this new checker. It does not close findings or establish genuine hosted authorization, email delivery, recovery/concurrency, candidate/canonical integration or any future write target.

## Owner action

Create a short-lived scoped Management API token for staging only with the two Read permissions above. Keep it private and enter it only at the hidden local prompt. Export the pinned source to a fresh temporary directory, install the locked single PGlite test dependency with lifecycle scripts disabled, run the new21-case verifier, parse the PowerShell wrapper, then execute it with `-RunReadOnlyTargetCheck`. The complete PowerShell block is supplied in chat. It makes a maximum of one metadata GET and one fixed dedicated read-only SQL POST.

Return both safe JSON results and exit codes. No SQL Editor action, ZIP upload, secret reinstallation or live activation is requested. Production/native stay unchanged and APK remains deferred.

## Official references checked21October2026

- https://supabase.com/docs/reference/api/v1-get-project — fixed project lookup, project_admin_read.
- https://supabase.com/docs/reference/api/v1-read-only-query — dedicated read-only role endpoint, database_read; beta contract.
- https://supabase.com/docs/guides/platform/personal-access-tokens — scoped token UI permissions and project limits.
