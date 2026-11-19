# E5.13 source-format review and revision two diagnostic

Current correction: [revision-three Deno 2 body path mapping](SECURITY_FR_2_4_EDGE_DENO2_SOURCE_PATH_CORRECTION.md), FRE112. The owner diagnostic located the metadata equality rejection; 43 offline cases pass for the correction and owner execution remains pending. The revision-two handoff below is historical.

21 October 2026, FRE111. The [owner result](security-fr-2-email-edge-impact-owner-source-review.json) from the requested commit `551dbf0578a148f3f6cc083e33bf1ea34a50494d` stopped at `STAGING_CONTACT_SOURCE` with `FUNCTION_SOURCE_REVIEW_REQUIRED`, exit 1, checked `2026-10-21T18:45:47.626Z`. All four attempted GETs returned HTTP 200 and bounded bodies. Eight source hashes were verified. The submitted result contains no separate offline verifier receipt, so no owner offline test count is asserted.

## What this result establishes

- Project reference and default database host matched staging.
- The before-list selected metadata digest matched E5.12: `a88734d959d4c93173609d771f13f5761f76d3478b1b9b7eb1aaca829f76ee78`.
- The sole unrelated function actually matched the reviewed `submit-enquiry` slug. Its before-detail passed the existing identity/JWT/import-map/entrypoint checks.
- The source GET succeeded and its bounded multipart body reached the strict decoder. That decoder refused a structural/path/metadata condition before returning its file map.

`downloaded_source_files: 0` is the unchanged caller counter, assigned only after the decoder returns successfully. It is not evidence that the provider returned zero file parts. The result is not `FUNCTION_SOURCE_MISMATCH`, and no deployed source divergence has been established. The exact decoder rule remains unknown because revision one combined its guards under one safe code.

The after-detail and after-list were never requested. Their combined acceptance flags remain false because those checks did not run; no appearance of a selected route or observed change after the source GET is inferred. No source was invoked, printed or saved, and no SQL, secrets, values, schedules, deployments or settings were changed. No additional permissions or endpoint fallback is indicated by these four HTTP 200 responses.

## Concrete diagnostic revision

The updated handler retains every source-format, size, target, prior metadata, path, file-count and exact-byte acceptance requirement. It adds `diagnostic_revision: 2` and a fixed `source_observation` object. The Windows parent accepts only the two new top-level fields alongside the prior allowlist and requires revision two before printing a full result.

| Diagnostic field | Bounded meaning |
|---|---|
| `decoder_step` | Last attempted fixed guard category: body bounds, boundary, part framing/headers, disposition/parameters, metadata, file path/identity, closing boundary, file count, relative paths or COMPLETE |
| `multipart_parts_observed` | Count through the current part, at most nine when the eight-part limit is exceeded |
| `file_parts_observed`, `source_files_decoded` | File branches reached and valid unique file paths accepted so far, each at most eight |
| `parts_with_content_disposition`, `parts_with_supabase_path`, `parts_with_quoted_filename` | Counts of selected framing elements seen before failure; no header names/values copied from the response |
| Metadata presence flags and nullable entrypoint match | Which fixed entrypoint fields were observed and whether their effective value matched the detail path when checked |
| `file_path_forms` | Counts for absolute POSIX, file URL, relative and unsupported categories; no path text |
| `expected_relative_files`, `unexpected_relative_file_count` | Positive observations only for the two fixed names `index.ts` and `handler.mjs`, plus a bounded count for other paths |

Diagnostic values describe the checked prefix. A false positive-observation flag is not proof that a later unprocessed part or field was absent. A null metadata-entrypoint comparison means it was not reached or there was no metadata part. Decoder COMPLETE means structural mapping succeeded; exact source-byte comparison and subsequent metadata checks still must pass separately. No diagnostic field changes a failure into acceptance.

This is a controlled read-only diagnostic rerun from a new pinned commit, not a retry of the unchanged revision-one script. The maximum remains six fixed staging GETs, with no retry, SQL/secret request, download-format fallback, function execution or source extraction. The same prior metadata digest remains the required baseline. Source stays transient in the private process; the token is entered only at the existing hidden prompt, with no additional permissions.

Return both safe outputs and exit codes. If exit 1 recurs, the new decoder stage/counts should identify the next review scope. Do not paste provider headers, raw multipart, source paths, source text or token. This diagnostic intentionally does not guess which parser requirement should change.

## Verification and unchanged gates

Thirty-three cases pass: the original 25-case transport/source/configuration coverage and eight new diagnostic cases. New cases distinguish boundary grammar, missing disposition, missing file-path parameters, metadata mismatch after two files were decoded, extra files, relative paths, a valid source with opaque metadata extras, and rejected diagnostic injection through private input. They also verify that private marker strings, paths and identity do not appear in receipts. Four JavaScript syntax checks and eight source hashes pass. A clean Git-tree archive rehearsal is recorded separately without doubling the distinct case count.

A development fixture initially used a header name outside the existing parser grammar, causing the earlier header guard to fire. The fixture was corrected to a valid hyphenated header name; no parser acceptance guard changed. The original 25-case local receipt and owner error remain preserved. The revised verifier reports its own 33-case receipt and source parent.

No actual hosted request is made by the assistant. The application sources, two reviewed contact source files, accepted Edge source package, SQL and earlier source manifests outside this checker remain unchanged. Source parity, shared runtime impact, deployable recovery, configuration values, readiness, activation and hosted acceptance remain unverified/unapproved. Findings remain open, production/native stay unchanged and APK work remains deferred.
