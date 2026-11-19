# Stage 9.2 — Windows repeat correction

**Superseding owner recheck — 13 October 2026 (S9E04):** [Corrected Windows receipt](security-stage-9-regression-owner-recheck.json): 882 PASS/0 FAIL/exit 0 across all 92 files, 21 syntax checks. 26 pinned hashes reconcile (25 exact/one exact CRLF variant), no unexplained difference. The earlier seven-failure receipt remains unchanged; 9.2 is complete at corrected source/owner offline scope. No further owner action; next 9.3. Hosted/native/store acceptance remains unverified and APK deferred. Earlier pending-status text below is historical.

**9.2 / 13 October 2026 — Corrected local candidate PASS; owner Windows recheck PENDING.**
Source parent: `f2c5d32de32b4c48cf3e1c3f25c4d9a2f6268783`. The owner's original result remains **875 PASS / 7 FAIL / exit 1** across 882 cases on Node v22.17.0, with all 17 syntax checks passing. This is a REVIEW result, not a Windows pass. Stay at 9.2 until the corrected repeat is received.

[Original owner receipt/hash reconciliation](security-stage-9-regression-owner-local-checks.json) · [Correction runs](security-stage-9-regression-windows-correction-checks.json) · [Updated contract](security-stage-9-regression-candidate-contract.json) · [Original candidate/history](SECURITY_STAGE_9_2_REGRESSION_CANDIDATE.md).

## Seven failed cases and targeted corrections

| Failed cases | Source observation | Correction and limit |
|---|---|---|
| Three Auth staging builder cases (487–489) | Fixture derives a native filename with URL.pathname, which is incorrect for a Windows drive URL and leaves encoded characters | Use fileURLToPath for the actual builder. All positive, invalid-key/config and missing-asset assertions remain |
| Header policy case (419) | Owner _headers SHA is exactly the LF-to-CRLF variant of the pinned source, while the test compares raw text against LF-generated policy | Normalize line separators only before the existing exact policy comparison. Approved inline hash, injection rejection and restrictive directives remain checked |
| Three redirected path cases (356, 429–430) | Test fixtures call Unix-style symlink creation; this can require privileges on Windows. Raw Windows exception codes were not included in the receipt | Use real directory junction fixtures on Windows and real directory symlinks on POSIX. Verify redirects are rejected before writes or native execution; no skip or mock substitution |

The redirected executable fixture now presents an ordinary executable file through a redirected parent directory. The source TOC inspection helper previously checked the leaf's file/link metadata alone; it now also requires canonical realpath agreement, ignoring path case only on Windows. This strengthens the path guard instead of relaxing it. All native runners in these tests remain synthetic; no real pg_restore, database connection or archive inspection occurred.

`.gitattributes` now explicitly selects LF for MJS, CJS and _headers. Existing JS/HTML/JSON/SQL attributes are preserved, and no repository-wide rewrite or owner Git configuration change is requested. Header text normalization is still checked independently of export line endings.

## Byte reconciliation

All **21 owner hashes reconcile** against the exact f2c5d32 source: **three exact pinned byte hashes and 18 exact CRLF variants**, with zero unexplained differences. The workflow, package.json and candidate-contract JSON match exactly; _headers and the selected MJS/CJS files match their computed CRLF variants. This is byte identity evidence at that earlier pin, not proof that failed cases passed.

The three symlink fixture failures are consistent with Windows link privileges based on the source and titles, but their exact exceptions are not available. The corrected real junction cases still require the owner's actual Windows execution; Linux cannot certify that branch.

## Executed verification

| Run | Platform | Cases | PASS | FAIL | Syntax checks | Exit |
|---|---|---:|---:|---:|---:|---:|
| Corrected full suite | Linux / Node v24.19.0 | 882 | 882 | 0 | Separate verifier | 0 |
| Updated contract verifier | Linux / Node v24.19.0 | 882 | 882 | 0 | 21 | 0 |
| CRLF and encoded-folder simulation | Linux / Node v24.19.0 | 882 | 882 | 0 | 21 | 0 |

Every run includes all 92 files (85 MJS/seven CJS), with zero skips, cancellations or todo cases. The simulation converts 178 MJS/CJS/header files to CRLF and executes the actual verifier from a folder containing spaces, percent and hash characters. It exercises line endings and decoded source filenames; it is explicitly **not a Windows run**.

The updated verifier hashes 26 candidate inputs. No test was removed, marked skipped or accepted on a failure. No pass count was lowered. Existing models, source assertions and synthetic function tests retain their original local scope.

Earlier assistant history is unchanged: 3,522 executions, 3,501 PASS and 21 FAIL. Adding the owner's failed 882-case repeat and these three corrected executions yields repeat-inclusive history of 7,050 executions, 7,022 PASS and 28 FAIL. The final local suite still has 882 cases, not 7,050 unique controls.

## Status and owner handoff

9.1 remains complete. 9.2 has a corrected locally passing candidate but is held for the Windows repeat; 9.3 and 9.4 remain unexecuted. Original Stage 0–8 records, prior 9.1/9.2 events, Linux receipts and the failed owner result remain preserved. All eight RG actions and all original findings stay OPEN. The 48 real hosted/device/store acceptance cases remain unrun.

The only new non-audit changes in this correction are the attributes file, TOC executable guard and three existing test files. Application/Business/worker JS, SQL, dependencies, deployment workflow and native builder are unchanged from f2c5d32. No live account/fixture/Auth/Storage/settings/provider/email/push/payment/production/native action occurred.

Complete PowerShell is supplied in chat: fetch the pinned corrected commit, archive to a new temporary directory and run the Node verifier. No SQL, dependency installation, elevated terminal, Developer Mode change or native build is required by this handoff. **Send the printed result after it finishes. APK update remains deferred.**

## Primary implementation references

- [Node fileURLToPath](https://nodejs.org/api/url.html#urlfileurltopathurl-options): proper Windows drive and percent-encoded file URL conversion.
- [Node symlink/junction API](https://nodejs.org/docs/latest-v22.x/api/fs.html#fssymlinksynctarget-path-type): Windows directory junctions use absolute directory targets.
- [Git text/eol attributes](https://git-scm.com/docs/gitattributes): explicit text line-ending policy for future exports/checkouts.

References reviewed 13 October 2026; implementation instructions do not independently establish the owner's corrected outcome.
