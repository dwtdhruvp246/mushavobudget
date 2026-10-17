# 4.2.2 — Upload/download client candidate and local checks

Recorded 11 October 2026, S4E05. Source parent: `1dbef82a9c4231c9d62ee1cadff0a6b6972be0aa`, audit branch `security/stage-3-authorization`. This completes the second of three bounded 4.2 milestones at client/local scope. Next is **4.2.3**, one controlled hosted/owner outcome or explicit BLOCKED result. Stage 4's full report remains due at **4.4**.

## Result and actual implementation

**63 new client-function checks PASS, plus 36 related regressions PASS: 99 tests across eight files, zero failures. Four syntax checks PASS.** No hosted upload, removal, signing request, object fetch, SQL execution, scanner, deployment or native rebuild ran. The functions execute in Node VM contexts with synthetic Storage responses and synthetic UI objects. Browser rendering, popup behavior and real Storage authorization remain unverified.

| Changed source | Resulting behavior |
|---|---|
| `app.js`: `validateProofFile`, `uploadPaymentProof`, `uploadSubscriptionProof` | Both upload helpers reject non-integer, empty, negative and oversized sizes before a Storage call. JPG/PNG/WebP/PDF and the exact 10 MiB cap remain supported. New object names use a generated UUID and an extension mapped from the declared MIME. Original names remain record display metadata. Family owner/uploader path positions remain intact. |
| `app.js`: `openPaymentProof` | Capture user, Auth epoch, budget workspace, Family identity and record/path. Discard a result or error when that captured context no longer matches after signing completes. No signature request for a missing session, workspace or proof record. |
| `business.js`: `captureBusinessFileContext`, `openBusinessDocumentProof`, both claim/bill click handlers | Capture user, Auth epoch, workspace ID and workspace load sequence; recheck the selected parent and currently listed document. Bill payment proofs must remain linked to the selected bill. Results/errors from stale contexts do not open a link or replace current UI messages. |
| `business.js`: `openBusinessBillingProof` | Recheck captured identity/workspace context, current owner eligibility and listed proof after signing completes. |

Proof signing remains at 60 seconds, with `noopener,noreferrer` or the equivalent anchor `rel`. Previously stored object paths remain usable; no existing files are renamed. General Business document CSV/XLSX allowance and Business receipt/bill/logo acceptance rules are unchanged. No new runtime import, public asset or build manifest entry is introduced.

Client file size/type claims and generated extensions are **not trusted content verification**. A one-byte object declared as PDF can pass the client metadata check; a test explicitly records that limit. Direct Storage/API callers can bypass all these browser controls. The candidate does not revoke an already issued URL and does not establish server authorization, processing safety or reliable cleanup.

## Verification evidence

The new batch executes source slices of the actual checked-in functions rather than a separately copied behavior model. It covers each proof MIME at 1 byte and the exact cap; invalid sizes; unsupported proof MIME declarations; canonical paths despite unsafe original names; retained display names; Family path positions; supported current links; stale success/error responses after identity, epoch, workspace, sequence, parent, record or path changes; current failures; unknown paths; and selected bill-payment binding. One source assertion checks that the actual claim/bill click handlers call the tested opener. The remaining checks are functional executions.

[Primary receipt](security-stage-4-upload-local-checks.json): 63 PASS, exit 0, Node v24.19.0, four syntax checks, SHA-256 for both runtime sources, the new test and verifier. [Related regression receipt](security-stage-4-upload-regression.json): 36 PASS, exit 0, seven existing test files covering completed payments, Business claims/bills/administrative subscription integration/realtime, Family extra places and session recovery. The 99 checks are local test cases, not hosted UF acceptance cases or unique security controls.

The reproducible primary verifier is [verify-stage-4-files.mjs](../../scripts/verify-stage-4-files.mjs), and the actual-function tests are [stage-4-upload-client.test.mjs](../../tests/stage-4-upload-client.test.mjs). It needs Node and the five exported repository files: `package.json`, `app.js`, `business.js`, the verifier and its test. No dependency installation, credentials, database, browser login or execution-policy change is required. Running it without an output argument prints the summary and does not write a receipt.

There is **no required owner SQL or terminal action at 4.2.2**. An optional isolated verification command is supplied completely in the chat, pinned to the published candidate commit. The owner should return only its JSON result if they choose to run it. No owner rerun is necessary for the recorded assistant local result.

## Owner Windows repeat, S4E06

The owner ran the full optional PowerShell export against candidate commit `06d4ca99c798a04c83d8be5b353731975fff887c`. The pasted output reports **63 PASS, zero failures, exit 0 and four syntax checks PASS on Node v22.17.0**. [Owner receipt and reconciliation](security-stage-4-upload-owner-local-checks.json) preserves the exact JSON. Both application source hashes match the published LF files. The two `.mjs` hashes exactly match SHA-256 computed from the published source with every LF replaced by CRLF; there are zero unexplained differences. The repository explicitly requires LF for `.js` but has no separate `.mjs` EOL rule. The exact owner Git EOL setting and file bytes were not separately collected; the reported hashes are verified against these deterministic published variants. No code repair, execution-policy change or rerun is needed.

This repeats the existing 63-case primary batch on Windows. It adds cross-environment evidence, not 63 additional unique security controls. The original assistant 99-test evidence and seven-file 36-test regression receipt remain unchanged; the owner did not rerun that regression package. Hosted checks remain zero, candidate deployment and server controls remain unverified, and 4.2.3 remains next.

## Server completion contract and carry-forward

The [source contract](SECURITY_STAGE_4_2_UPLOAD_DOWNLOAD_REVIEW.md) retains all six OPEN actions and all 30 planned UF01–UF06 grouped cases. This client candidate addresses only selected UF-R01/UF-R04 usability and late-response behavior. No finding or server action closes.

| Action | Required completion evidence |
|---|---|
| UF-R01 | Trusted ingestion must validate actual bytes with bounded type-specific processing, including JPEG/PNG/WebP dimensions, PDF structure and general document CSV/XLSX processing limits. Preserve the supported types; MIME, filename, magic bytes or a client check alone cannot be the trust decision. Any external processor needs an explicit data/privacy decision before use. Quarantined or rejected bytes must not become ordinary downloadable documents. |
| UF-R02 | Reconcile actual private bucket settings, grants and effective policies for each operation/actor, including three restrictive Business subscription guards and stepped-up staff access. Test direct requests, list/read/sign/delete, active/inactive/outsider scopes and approved suspended/expired access exceptions. |
| UF-R03 | Authoritative object, uploader, workspace, parent, size/type and verified content status must bind at registration. Missing metadata must fail rather than use caller fallbacks. Protect active/submitted references, concurrent registration and overwrite/delete/archive transitions. A client name/size/type is not the object authority. |
| UF-R04 | Recheck the deployed client with genuine sessions and browser/native behavior; measure TTL, issued-URL replay after removal/role change, actual response headers/disposition, cache/referrer/log exposure and downloads. This candidate only discards late client results when captured context no longer matches. |
| UF-R05 | Choose and enforce aggregate bytes/count, concurrent ingestion, processing, download/egress and rate budgets on the server. Test boundary/concurrency behavior and bounded failures. Client 10 MiB checks do not establish aggregate quota or archive/PDF processing safety. |
| UF-R06 | Durable manifest/reconciliation must distinguish definitely unregistered objects from ambiguously committed registrations, preserve active/shared references, record failed removals and support idempotent retries. Current compensating browser removals and logo cleanup are unchanged; do not infer reliable cleanup from a successful upload test. Recheck financial/audit integrity and retained fixtures. |

No untested server migration, content scanner adapter, provider transfer or object mutation is bundled as if those requirements had been met. Hosted readiness still requires verified staging selection and candidate deployment/source parity, controlled isolated identities/known disposable objects, actual bucket/policy/grant/catalog evidence, safe mutation boundaries and processing/quota/cleanup observability. Unavailable prerequisites produce BLOCKED at 4.2.3 with carry-forward; they do not create additional milestone loops.

F13 and earlier F08/F15/F02/F20 remain OPEN. Stages 0–3, prior Stage 4 evidence, the original 123 coverage rows and 20 finding definitions are preserved. The two manual conversion fixtures and retained Personal/Family/Business accounts/records are unchanged. Production `kttkospkblwvguuwnhjj`, hosted settings and native/signing history are excluded from mutation.
