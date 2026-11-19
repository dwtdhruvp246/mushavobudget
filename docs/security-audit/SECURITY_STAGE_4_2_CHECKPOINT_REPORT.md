# 4.2 — Upload/download checkpoint report and action plan

Recorded 11 October 2026 at **4.2.3**, S4E07. Source/evidence parent: `8e4ccd63656ab1ea26c46daafec3b3b08effc42d`, branch `security/stage-3-authorization`. Client candidate pin: `06d4ca99c798a04c83d8be5b353731975fff887c`.

**4.2 is CLOSED WITH CARRY-FORWARD.** All three bounded milestones have recorded outcomes. Hosted acceptance is **BLOCKED**: zero of 30 planned grouped UF01–UF06 cases ran. This is an audit checkpoint outcome, not acceptance of server upload safety, deployed authorization, cleanup or release readiness. Next is **4.3.1**, factual privacy/data-flow source review. The full Stage 4 report remains due at **4.4**.

## Recorded outcomes

| Milestone | Outcome | Limits |
|---|---|---|
| 4.2.1, S4E04 | Source review complete: 65 matched blobs, four private bucket definitions, nine file inputs, 15 selected policy declarations, 22 selected routine definitions; 30 grouped cases frozen | Syntactic source inventory; no effective hosted catalog, object bytes or authorization tests |
| 4.2.2, S4E05–06 | Actual client candidate: 63 new checks and 36 related regressions PASS, 99 tests across eight files, four syntax checks PASS. Owner repeats the same 63 tests on Windows/Node v22.17.0: 63 PASS, exit 0; all four reported file hashes reconciled | Node VM execution with synthetic Storage/UI responses. Owner repeat is cross-environment evidence, not 63 additional unique controls. No deployment or hosted file acceptance |
| 4.2.3, S4E07 | Source/evidence readiness assessment complete: 67 current source blobs match, four candidate primary SHA-256 hashes match, zero mismatches; hosted acceptance BLOCKED / 0 of 30 grouped cases run | No fresh local behavior tests, hosted HTTP/catalog/SQL/Storage/Auth requests or browser/device checks |

The 67 source files are the original 65-file selected inventory plus the new test and verifier. Of the original inventory, 63 files are unchanged; the two intended client candidates are `app.js` and `business.js`. The four primary candidate hashes cover those clients, the test and verifier. These checks confirm source integrity, not deployed runtime parity. Historical inventory counts are retained rather than rewritten as current hosted facts.

Read [source review and frozen contract](SECURITY_STAGE_4_2_UPLOAD_DOWNLOAD_REVIEW.md), [candidate/local limits](SECURITY_STAGE_4_2_UPLOAD_DOWNLOAD_CANDIDATE.md), [primary local receipt](security-stage-4-upload-local-checks.json), [36-test regression receipt](security-stage-4-upload-regression.json), [owner Windows repeat and EOL reconciliation](security-stage-4-upload-owner-local-checks.json), and [4.2.3 readiness receipt](security-stage-4-upload-readiness.json).

## Readiness assessment and blockers

| Prerequisite | Current evidence | Why full hosted acceptance cannot run |
|---|---|---|
| UF-P01 — Staging deployment and effective configuration | Candidate is pinned and checked locally. No fresh hosted source/hash or bucket/catalog/grant receipt establishes its current deployment. Historical owner staging confirmation identifies `dczlddwbtgvfdujgcitb`, but does not prove current file-control parity. | Need exact deployed client and final bucket/policy/helper/grant evidence, including restrictive policy composition and staff assurance. Offline verifier fields such as `candidate_deployed:false` are fixed scope declarations, not deployment probes. |
| UF-P02 — Complete controlled actor matrix | Earlier ordinary Personal/Family actors and retained fixtures exist. Business role/scoped/removed/expired actors and genuine stepped-up staff/recovery acceptance remain unverified; earlier MFA readiness reports no verified super operator. | The complete own/foreign/removed/suspended/expired/scoped/staff matrix is not established for this batch. Do not treat a limited ordinary-account pass as Business/staff acceptance. |
| UF-P03 — Exact disposable file/record fixture scope | No dedicated UF object manifest, verified file-byte hashes/type matrix, test-only parent rows or authorized cleanup boundaries have been established for these 30 grouped cases. | Need harmless, known valid and invalid content, exact object/record ownership and isolated mutation/cleanup scope. Preserve retained audit accounts, finance records and manual conversions. |
| UF-P04 — Trusted ingestion and object/record binding | Client candidate adds nonzero/type/size preflight, generated names and late-link context checks. Selected source still lacks an identified trusted type-specific processing/quarantine route; registration metadata trust differs across flows. | Direct Storage callers bypass client preflight. MIME/extension checks cannot establish safe actual content, authoritative metadata, registration concurrency or submitted/active reference integrity. |
| UF-P05 — Processing/quota and processor decisions | Per-file caps exist in source. Actual aggregate count/byte/concurrency/processing/egress budgets, server enforcement, processor use/privacy and bounded parsing failure evidence are not established. | Do not invent paid-plan limits or send data to an unapproved processor. Full processing/limit cases require reviewed budgets and actual enforcement/observability. |
| UF-P06 — Durable cleanup and lifecycle observability | Existing cleanup consists of selected browser compensations and old-file removals. No implemented authoritative durable cleanup manifest/reconciler or verified ambiguous-registration recovery is supplied by this client candidate. | Need recoverable retries, active/shared reference preservation and truthful failed-cleanup evidence before exercising the full ambiguous-commit/orphan/reconciliation batch. |

These are readiness gaps and selected-source observations, not newly demonstrated hosted exploits. Effective bucket settings, deployed server controls, provider configuration and external jobs may differ from selected source and remain unknown until independently checked. Existing financial fixtures cannot substitute for disposable upload fixtures. A partial readiness SQL query would not remove the substantive candidate, processing and cleanup blockers, so this checkpoint requests no additional setup loop.

## Planned hosted cases remain blocked

| Group | Planned grouped cases | Cases run | Scope still required |
|---|---:|---:|---|
| UF01 — Formats/content | 5 | 0 | Valid supported formats, declared/actual mismatch, malformed/empty content, harmless masquerades and processing/dimension/archive bounds |
| UF02 — Object authorization | 5 | 0 | Own/intended shared access, foreign paths, inactive/outsider actors, suspension/expiry exceptions and Business/scoped/staff assurance |
| UF03 — Registration/integrity | 5 | 0 | Valid binding, missing metadata/object, mismatched authority/path/size/type, foreign parent and overwrite/delete/archive protection |
| UF04 — Downloads | 5 | 0 | Actual response/disposition, foreign read/list/sign, issued-link TTL/replay, in-flight context changes and cache/log/referrer/device exposure |
| UF05 — Limits/processing | 5 | 0 | Exact caps, aggregate/concurrent limits, repeated requests, bounded file processing and processor privacy/failure |
| UF06 — Cleanup | 5 | 0 | Failed registration removal, ambiguous commit preservation, switched-context orphan handling, shared/logo ownership and idempotent reconciliation |

These 30 entries are grouped cases with surface/actor variants; they are not an exact count of future HTTP requests. Local test cases do not count as hosted UF cases. No malware or customer files are required for the planned harmless boundary tests.

## Final remediation and fresh acceptance

All six actions remain OPEN, with their original finding mappings and required closure evidence preserved:

| Action | Required implementation/evidence |
|---|---|
| UF-R01 | Trusted bounded type-specific byte validation and appropriate private processing/quarantine. Preserve JPG/PNG/WebP/PDF and separately supported general Business CSV/XLSX. Do not substitute declared MIME, signatures or client checks for the server trust decision. |
| UF-R02 | Reconcile final hosted private buckets, operation grants, permissive/restrictive policy composition and helper roles. Resolve Stage 3 parity/MFA dependencies and verify direct own/foreign/removed/scoped/staff effects. |
| UF-R03 | Authoritative object/uploader/workspace/parent/content-state/type/size binding. Reject missing or inconsistent metadata without caller fallbacks; protect active/submitted references and financial integrity under concurrency. |
| UF-R04 | Deploy and verify the selected client guards and actual downloads: lifetime/replay, response headers/names/disposition, context races, cache/log/referrer and browser/native behavior. Issued signatures are a separate capability from Auth sessions. |
| UF-R05 | Decide actual aggregate/count/concurrency/processing/egress budgets and enforce them server-side. Record any processor's purpose/data/privacy treatment and exercise harmless bounded failures. |
| UF-R06 | Implement durable authoritative cleanup/reconciliation with failed-removal evidence, ambiguous-commit handling, active/shared reference preservation and idempotent retries. Recheck retained finance/history/fixtures before full fresh acceptance. |

Reopen the frozen hosted batch in final remediation after these prerequisites are verified; record actual per-case effects and cleanup rather than repeatedly running source/preflight checks. Do not close F13 or linked F08/F15/F02/F20 from the client passes or this blocked checkpoint.

## Owner handoff and preserved state

**No SQL or terminal command is required for this checkpoint.** The owner completed the optional 4.2.2 local verification. No further repeat is requested. Whenever later remediation needs an owner command, supply its full SQL/terminal block in chat and ask for the result after it finishes; a linked file alone is not the handoff.

No upload, object removal, signed-URL creation, download, SQL/settings/Auth change, provider/scanner/email job, deployment, production promotion or native rebuild was performed at 4.2.3. Production `kttkospkblwvguuwnhjj` and native/signing history remain excluded from mutation. Existing `audit.owner@example.com`/`audit.outsider@example.com`, retained Personal/Family fixtures, inactive former member and both USD1 conversions remain intact. Original 123 coverage rows, 20 finding definitions, Stage 0–3 progress and prior Stage 4 evidence remain unchanged.

Stage 4 now has **two of four main steps closed with carry-forward**, with two remaining. Next: **4.3.1**, source/evidence inventory of data collection, processors/SDKs, purposes, retention, support, operator/audience/territory facts and disclosure gaps. Unconfirmed facts must remain explicit; no invented legal identity, age threshold, retention period or public policy publication. Full report due **4.4**.
