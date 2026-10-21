# E5.13 reviewed CRLF artifacts and metadata completion

21 October 2026, FRE114. The [owner revision-four receipt](security-fr-2-email-edge-impact-owner-revision4-CRLF-only.json), checked `2026-10-21T19:24:09.169Z`, establishes that both downloaded files differ from the reviewed LF files only by CRLF line endings. Source mapping completed; strict UTF-8 decoding succeeded; neither file had a leading BOM. Revision four correctly retained its LF-only exact-byte failure, exit 1. The after-detail and after-list checks did not run.

The assistant independently [reproduced both exact reported fingerprints](security-fr-2-email-edge-CRLF-artifact-reproduction.json) by generating CRLF copies solely from the public reviewed repository files. No hosted source body was accessed or received by the assistant.

| File | Reviewed LF bytes | Reproduced CRLF bytes | Exact reproduced SHA256, equal to owner download |
|---|---:|---:|---|
| `index.ts` | 357 | 363 | `3298a0baa0f4f3dc430e7a633390a26f8150e6f4218c0de5f9bfca6a9d88fb45` |
| `handler.mjs` | 10,703 | 10,881 | `a3e355178fc9f9c156c802f7f1d2f4423f7171e7eebb36e30435532491e78974` |

The byte increases are exactly six and 178 added carriage returns, respectively. These are now two concrete reviewed artifacts with independently reproduced raw fingerprints. Their selected-source content is established; fresh full before/after metadata stability, actual hosted runtime behavior and deployment readiness are separate, incomplete checks. The received output contains no separate offline verifier receipt, so no owner offline test count is asserted.

## Revision five explicit artifact allowlist

The source gate is deliberately expanded from the single reviewed LF variant per file to two exact variants per file: that original LF artifact and its specific owner-observed CRLF artifact shown above. The checker pins the LF and CRLF byte counts and SHA256 values in code. It verifies the local LF source against its fixed pin, generates the candidate CRLF variant from that known local source, verifies that variant against the reproduced CRLF pin, then compares downloaded raw buffers exactly against the two variants. Downloaded source is not normalized for acceptance.

This is not a general line-ending equivalence rule. Mixed line endings still fail even when CRLF normalization would yield the reviewed text. BOMs, missing/added final newlines, formatting changes, altered code, unknown artifacts and changed local reviewed sources still fail. All earlier path, two-file, target, prior digest, JWT/import-map, time/size, privacy and before/after identity controls remain required. The accepted deployment source package and its immutable false readiness assertions are unchanged.

The receipt has `diagnostic_revision: 5`. For CRLF artifacts, `exact_reviewed_contact_source_bytes_match` stays false because it describes the original LF bytes. Each row separately reports `reviewed_artifact_variant` and `reviewed_artifact_exact_bytes_match`. The top-level `reviewed_contact_artifacts_match` and fixed `source_review_basis` distinguish an exact match to the pinned CRLF artifacts from an exact LF match. `downloaded_source_normalized_for_acceptance` remains false. No historical false flag or previous exit 1 is rewritten into success.

After both artifacts match, the checker may establish the source-bound conclusion that these reviewed contact files do not consume the six proposed custom names, then submits the two existing after-reads. A matching source cannot bypass metadata drift. Only matching after-detail and after-list snapshots permit `STAGING_REVIEWED_CONTACT_ARTIFACT_PARITY_OBSERVED_NOT_CONFIGURATION_APPROVAL`, exit 0. Shared runtime impact, deployable recovery, private configuration values, readiness, hosted acceptance and activation remain false/unapproved.

## Verification and next execution

Sixty offline cases pass with eight source hashes and four JS syntax checks. The prior 52 cases remain, with the pinned CRLF case's expected artifact result intentionally updated. Eight new cases cover exact reproduction of both owner hashes, rejection of mixed line endings, changed local baselines, after-read drift despite accepted CRLF source, forbidden caller allowlist overrides, actual configuration-reader behavior of a CRLF artifact generated from public source, rejection of BOM/newline alterations, and all four LF/CRLF file combinations.

The CRLF runtime configuration case imports a variant derived from the public reviewed repository handler, with synthetic values and blocked default HTTP. It never imports or executes a downloaded provider module. Modern and legacy configuration reads/values match the LF handler and do not consume any of the six custom names. A clean Git-tree export rehearsal is recorded separately without increasing the distinct test count. Earlier owner and 25/33/43/52-case receipts remain preserved.

Use the newly pinned complete PowerShell block supplied in chat. It runs the 60-case verifier, parses the Windows parent and prompts privately for the same staging-only read token. This check has no additional permissions, dependencies, secret/SQL requests, source extraction or write operations. It performs at most the same six fixed GETs. Native execution of the revised parent and fresh after-read acceptance remain owner evidence pending. Return both safe JSON outputs and both exit codes.

The remaining deployment preparation includes privately establishing configuration values, deployable recovery capture/rehearsal, external caller containment, current Pages deployment/binding evidence, canonical integration, privileged write targeting and coordinated rollout/recovery. This artifact review approves none of those actions. No function is redeployed to change its line endings. Findings remain open, production/native stay unchanged and APK work remains deferred.
