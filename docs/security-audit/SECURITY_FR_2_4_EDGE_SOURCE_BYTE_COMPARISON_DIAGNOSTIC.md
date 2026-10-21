# E5.13 exact-byte mismatch and per-file diagnostic

21 October 2026, FRE113. The [owner revision-three receipt](security-fr-2-email-edge-impact-owner-revision3-byte-mismatch.json), checked `2026-10-21T19:15:25.513Z`, confirms that the Deno 2 source mapping correction worked. The decoder reached COMPLETE, mapped the two relative source files to the exact reviewed names, and returned both files. The byte comparison then stopped with `FUNCTION_SOURCE_MISMATCH`, exit 1. All four requests returned HTTP 200 and eight source hashes were verified.

This is an observed byte difference, rather than the earlier multipart/path rejection. Revision three stopped at the first unequal file without identifying that file in its receipt. The submitted output does not establish which file differs, whether the cause is line endings, encoding, source formatting, compiler output or changed code, or whether both files differ. No source text or private path was provided. The before metadata remained consistent with E5.12; the after-detail/list requests were not made. No before-and-after stability acceptance is claimed. The separate offline verifier output was not supplied, so no owner offline case count is asserted.

## Revision four diagnostic

The checker now compares both fixed files in deterministic order before applying the same exact-byte gate. Its new `source_comparison` array contains exactly one row for `index.ts` and one for `handler.mjs` after successful source mapping. Each row contains bounded byte counts, reviewed/downloaded SHA256 fingerprints, exact-match and UTF-8 flags, plus descriptive comparison flags. No source text, snippets, first differing bytes, arbitrary paths or identifiers are emitted. No additional request or source extraction is added.

| Classification | Description only; every non-exact class still fails |
|---|---|
| `EXACT` | Identical raw bytes |
| `CRLF_ONLY` | Valid UTF-8 text matches after replacing CRLF pairs with LF, without removing a BOM |
| `LEADING_UTF8_BOM_ONLY` | Valid UTF-8 text matches after removing at most one leading BOM from each file, without changing line endings |
| `BOM_AND_CRLF_ONLY` | The combined two transformations match where the separate checks did not |
| `SINGLE_FINAL_LF_AFTER_BOM_CRLF_NORMALIZATION` | After those descriptive transformations, one text is exactly the other plus one final LF |
| `OTHER_BYTES` | None of the preceding comparisons explains the difference; this is not itself proof of a semantic code change |
| `INVALID_UTF8` | Strict UTF-8 decoding failed; no replacement-character text comparison is used |

UTF-8 decoding explicitly preserves a leading BOM so its removal can be checked separately. Internal BOMs, bare CR characters, spaces, code, comments and additional final newlines are not stripped. These comparisons neither rewrite source nor treat text normalization as deployed-source approval. SHA256 fingerprints describe entire selected files; they are not recovery artifacts or secret values.

The original exact-byte requirement remains: if either row has `exact_bytes_match: false`, the result is exit 1 with `FUNCTION_SOURCE_MISMATCH`. Source-dependency acceptance, shared runtime impact, readiness and hosted acceptance remain false. No after-reads are issued on a mismatch. If both are exact, the existing before/after metadata checks must still pass. The Windows parent requires diagnostic revision four and allows only the new bounded top-level array in addition to its prior receipt fields.

## Validation and owner execution

Fifty-two offline cases pass: the 43 existing transport/path/configuration cases plus nine comparison cases. New coverage checks both files despite an initial mismatch, stable exact fingerprints, CRLF, leading BOM, combined BOM/CRLF, one final LF, changed configuration names, invalid UTF-8, and preserved internal BOM/CR/whitespace/code differences. Changed-source and normalization fixtures still return exit 1 with four requests and no source execution. Eight source hashes and four JS syntax checks pass. A clean Git-tree export rehearsal is recorded separately without doubling distinct cases.

The actual downloaded files have not been supplied to the assistant or independently reproduced. This revision provides the missing per-file evidence; it does not assume the mismatch is harmless or repair a deployed function. The earlier receipts and all owner results remain unchanged. Application sources, reviewed contact files, SQL and the accepted Edge source package remain unchanged.

Run the newly pinned PowerShell block supplied in chat, using the existing staging-only read token at its hidden prompt. No extra permissions, dependencies, SQL, secret requests or deployment are required. Return both safe JSON outputs and both exit codes, including an exit 1 result. Keep raw source, provider bodies, credentials and private paths out of chat. The maximum remains six fixed GETs, with no retry/fallback and the existing response/time limits.

No assistant hosted staging request, settings write, configuration-value collection, function invocation, source upload, activation or mail/push/FX action occurs. Findings remain open, production/native stay unchanged and APK work remains deferred.
