# E5.13 private source parity and configuration impact preparation

Current outcome: [E5.13 owner source/selected-metadata scoped pass](SECURITY_FR_2_4_EDGE_SOURCE_IMPACT_SCOPED_OUTCOME.md), FRE115. Six GETs completed with exit 0. No rerun is requested; private configuration input availability is pending.

Earlier handoff: [revision-five reviewed CRLF artifacts and metadata completion](SECURITY_FR_2_4_EDGE_REVIEWED_CRLF_ARTIFACTS.md), FRE114. Sixty offline cases pass; fresh owner before-and-after acceptance is pending.

Earlier handoff: [revision-four per-file source-byte comparison](SECURITY_FR_2_4_EDGE_SOURCE_BYTE_COMPARISON_DIAGNOSTIC.md), FRE113. Fifty-two offline cases pass; the owner source-byte diagnostic is pending.

Earlier handoff: [revision-three Deno 2 path mapping correction](SECURITY_FR_2_4_EDGE_DENO2_SOURCE_PATH_CORRECTION.md), FRE112. Forty-three offline cases pass; owner corrected-check execution is pending.

Earlier outcome: [owner source-format review and diagnostic revision two](SECURITY_FR_2_4_EDGE_SOURCE_REVIEW_DIAGNOSTIC.md), FRE111. Four GETs returned 200; the decoder refused the source structure before returning files. Thirty-three offline cases pass for the instrumented revision, with source acceptance requirements unchanged. Owner diagnostic execution is pending. The original preparation details below remain historical context.

21 October 2026, FRE110. The [E5.12 owner observation](SECURITY_FR_2_4_EDGE_READINESS_OBSERVATION_OUTCOME.md) is retained: four selected routes and six custom names were absent, one other function was listed, no cron relation was observed, and aggregates remain null. This check addresses the existing function's source dependency before preparing project-wide configuration writes. No existing function identity is inferred from that prior count.

[Handler and bounded decoder](../../scripts/check-fr-2-email-edge-impact.mjs), [Windows private runner](../../scripts/run-fr-2-email-edge-impact.ps1), [offline verifier](../../scripts/verify-fr-2-email-edge-impact.mjs), [tests](../../tests/fr-2-email-edge-impact.test.mjs), [manifest](security-fr-2-email-edge-impact-source-manifest.json), [contract](security-fr-2-email-edge-impact-contract.json), [local checks](security-fr-2-email-edge-impact-local-checks.json).

## Fixed six-GET contract

Every provider request is a GET beneath `https://api.supabase.com/v1/projects/dczlddwbtgvfdujgcitb`. There is no SQL, secret-list/key retrieval, deployment, function invocation, retry or alternate target:

| Order | Read | Required observation |
|---|---|---|
| 1 | Project metadata | Exact staging ref, default database host and ACTIVE_HEALTHY status |
| 2 | Function list before | All four selected routes absent, exactly one other function, and its normalized selected metadata digest equal to E5.12 |
| 3 | Detail for the fixed reviewed contact slug | The other function must actually be `submit-enquiry`; list/detail identity, version, JWT false, no import map and a bounded valid entrypoint must agree |
| 4 | Source body for that same fixed slug, Accept multipart/form-data | Exactly two source parts matching the reviewed local `index.ts` and `handler.mjs`, byte for byte |
| 5 | Same function detail after | Selected list fields, entrypoint, import-map state and optional bundle digest unchanged |
| 6 | Function list after | Same normalized list as before, including selected-route absence |

If the existing function is different, this check stops before requesting its source. It reports a review code without printing its arbitrary slug, ID, status, source or paths. No arbitrary source is classified using string matching. The known contact handler is only confirmed after live metadata and exact source checks pass. Changed metadata is reviewed rather than silently adopting a new baseline. These observations do not create a write lock.

The source comparison uses a strict bounded multipart parser, supporting the provider's `supabase-path` header or a quoted filename. It compares provider paths in memory, accepts only the two files relative to the exact detail entrypoint, rejects traversal before URL normalization, and refuses duplicate files/headers, extra dependencies, incompatible metadata, unknown formats and truncated bodies. No downloaded module is imported, evaluated, compiled, extracted or written. A provider-format difference yields a safe review result, never a weaker source comparison or Docker/CLI fallback. Unsupported legacy eszip bodies are not interpreted.

Each GET has a 12-second timeout. JSON metadata is limited to 256KiB, downloaded multipart source to 2MiB, multipart parts to eight and headers/metadata to 8KiB each. Raw responses exist transiently in private process memory; no forensic erasure guarantee is made. The receipt contains fixed labels, booleans, counts, the already selected metadata digest and safe HTTP status samples. It contains no raw source, provider body, unselected identity, token or arbitrary path.

## Source-bound conclusion and remaining configuration work

The reviewed contact entrypoint imports only `./handler.mjs` and supplies `Deno.env.get` to its configuration reader. That reader uses `SUPABASE_URL`, `SUPABASE_SECRET_KEYS`, the legacy `SUPABASE_SERVICE_ROLE_KEY` fallback, `MUSHAVO_CONTACT_TURNSTILE_SECRET` and `MUSHAVO_CONTACT_QUOTA_SECRET`. The matched two-file source does not consume any of the six proposed custom names. This is a source-bound dependency conclusion, not a claim that all future platform/runtime behavior or any hosted configuration write is verified.

The new tests invoke the actual local `readConfiguration` function with synthetic modern and legacy key dictionaries. Adding each or all six names leaves the returned configuration unchanged; the six names cannot supply missing contact credentials. These tests do not invoke the deployed contact function or submit an enquiry.

The private configuration preparation remains:

| Name | Source of the proposed value | Required preparation |
|---|---|---|
| `APP_ORIGIN` | Fixed staging origin `https://mushavo-budget-staging.pages.dev` | Preserve production and existing contact-specific settings |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Existing controlled staging key pair | Validate the pair privately and establish the frontend subscription key; do not regenerate keys as an automatic replacement |
| `VAPID_SUBJECT` | Controlled contact URI | Validate privately alongside the pair |
| `CURRENCYAPI_API_KEY` | Controlled staging provider credential | Keep private; syntax does not prove provider validity |
| `CURRENCY_SYNC_SECRET` | Controlled private staging caller credential | Establish caller ownership/containment; the scheduled branch precedes user-session proof |

This checker collects none of these values, accesses no saved packet/ZIP and does not generate replacement keys or caller secrets. It does not retain a deployable recovery artifact. Even if source parity passes, private value validation, recovery capture/rehearsal, external caller containment, current Pages deployment/binding evidence, canonical SQL integration, privileged write targeting and coordinated deployment/recovery remain open. Do not edit the existing immutable source-package plan's false readiness fields into approval.

## Windows handoff and result

Reuse the existing short-lived token scoped to Mushavo Budget Staging if valid. This step uses only Project Settings Read and Edge Functions Read; it needs no additional permissions. The read-only body route uses `edge_functions_read`. No secret or Database permission is used by this checker.

The parent retains the previously owner-executed private stdin/stdout pattern, with the new stage/manifest, safe output allowlist, a six-request ceiling and a 105-second child limit. Eight source hashes and token-free preflight precede hidden token input. The token is never put in arguments, environment or a plaintext file. The parent suppresses raw stderr and unknown receipt fields, rejects redirected local paths and clears BSTR/stdin byte buffers without claiming complete managed-memory erasure. Native parsing and execution of this new wrapper remain pending owner evidence.

Run the complete pinned PowerShell block supplied in chat. No npm/dependency installation or SQL block is needed. It exports the pinned source, runs the offline verifier, parses the wrapper and starts the private GET check. Return both safe JSON outputs and both exit codes. Do not paste a token, source body or credentials.

Successful observation returns `STAGING_CONTACT_SOURCE_PARITY_OBSERVED_NOT_CONFIGURATION_APPROVAL`, exit 0. Differences return exit 1 with a bounded checkpoint/code and no retry. Readiness, hosted runtime impact, recoverability, live activation and hosted acceptance stay false in both cases. Nothing is deployed, configured or dispatched.

## Verification

Twenty-five offline cases pass with eight source hashes and four JavaScript syntax checks. Twenty-two cases cover the real transport/decoder/CLI, including fixed routes, changed targets, prior metadata drift, selected-route appearance, unknown existing functions, private errors, redirects, byte limits, multipart/path validation, mismatched inert JavaScript and before/after metadata changes. Three exercise the actual reviewed contact configuration reader. Default HTTP/fetch is blocked during tests; all provider ports and values are synthetic. No installed dependency is needed.

An initial traversal test caught standard URL parsing removing dot segments before validation. The parser now rejects those original path segments before URL parsing; the final 25-case verifier supersedes the 24/25 development result. No source/identity requirement was weakened. The accepted 12-file Edge package and application/SQL/canonical sources remain unchanged.

Primary references checked 21 October 2026:

- https://supabase.com/docs/reference/api/v1-get-a-function-body — GET route and read permission; the public response schema does not specify source framing.
- https://github.com/supabase/cli/blob/7e3035c644f4528833dd7a6a992535ded7158a8f/apps/cli/src/shared/functions/download.ts — pinned first-party implementation negotiates multipart/form-data and reads source paths from supabase-path/filename plus entrypoint metadata. The checker uses its own smaller strict parser and performs no extraction.
- https://supabase.com/docs/reference/api/v1-get-a-function — selected detail fields.

No assistant hosted staging request, credentials, source upload, secret write, schedule change, activation or delivery occurs. Findings remain open, production/native stay unchanged and APK work remains deferred.
