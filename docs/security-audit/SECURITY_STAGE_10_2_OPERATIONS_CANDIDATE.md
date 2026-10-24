# 10.2 — Operational instructions and public metadata collection candidate

**Latest — 10.2 / owner Windows offline PASS recorded, 13 October 2026 (S10E03):** [Owner receipt](security-stage-10-operations-owner-local-checks.json) and [candidate/report](SECURITY_STAGE_10_2_OPERATIONS_CANDIDATE.md). Node v22.17.0: all 27 cases PASS, zero fail/skip/cancel/todo, exit 0; four syntax PASS. All 15 hashes and current/pinned Git identities reconcile as exact published bytes, zero unexpected mismatch or CRLF variants. Windows junction fixtures passed at their owner-reported offline scope. Initial assistant 54 executions and owner 27 = 81 successful executions / 27 unique cases. No fresh assistant behavior/syntax/public/backend/provider/device check or source/settings/deployment/native change. All 24 real OP requirements remain unrun, six OP actions OPEN/six decisions UNCONFIRMED; prior scoped positives/failures, original 123 rows/20 definitions and Stage 0–9/completed 10.1 preserved. **Two of four Stage 10 milestones complete; next 10.3 bounded staging operations/readiness; full report 10.4.** No extra SQL/terminal/setup/rerun action; hosted/native/store acceptance remains false, APK deferred and final remediation/full fresh re-audit required. Earlier summaries are historical.

**13 October 2026, S10E02 — source candidate and offline checks COMPLETE.**
Source parent: `1b012fd9c47bfb1733596f64c470feee5d308341`.
[Operational instructions](SECURITY_STAGE_10_OPERATIONAL_RUNBOOKS.md) · [Candidate contract](security-stage-10-operations-candidate-contract.json) · [Measured offline receipt](security-stage-10-operations-local-checks.json).

## Outcome and scope

The actual new public-metadata collector and CLI passed **27 local cases, zero failures, exit 0**, with **four Node syntax checks** on Linux Node v24.19.0. The tests use synthetic Response/stream ports, actual temporary filesystem copies/links and actual CLI subprocesses under disabled default transport. The two recorded runs total 54 successful executions of 27 unique cases. These are actual candidate safety/behavior checks, not full hosted OP controls or proof of Windows behavior.

No live public staging GET, Auth/API/SQL, job/alert/provider/device/store check, email/notification/charge, source client/SQL/workflow change, setting mutation or deployment ran. The existing network guard remains unchanged. Hosted operations/native/store/release acceptance remains false; all 24 full OP requirements remain unrun. All actions/decisions remain OPEN/UNCONFIRMED. APK update remains deferred.

The operational instructions cover exact serving/project/version mapping; read-only evidence versus real scheduler/business/delivery outcomes; monitoring/support ownership; full-service recovery; compatible containment/rollback and final release dependencies. They are reviewable source-bound instructions, not an exercised incident/recovery program.

## Concrete source contribution

Four new code paths were added:

- `scripts/lib/stage-10-public-metadata.mjs`: reads/reconciles the nine ordinary local reviewed sources, validates fixed staging targets, collects bounded safe public response metadata and retains negative/incomplete results.
- `scripts/collect-stage-10-public-metadata.mjs`: requires exact staging/source-pin arguments, outputs safe receipts and returns 0 only for the scoped metadata match, 1 for a review outcome and 2 when collection cannot start.
- `tests/stage-10-public-metadata.test.mjs`: 27 meaningful actual collector/CLI/source/stream boundary cases.
- `scripts/verify-stage-10-operations.mjs`: offline-only selected test runner with four syntax checks, system-only child environment, a 60-second batch timeout, explicit no-default-network preload, complete expected case counts and 15 input byte hashes.

The frozen candidate contract records the source parent, nine fixed route/type/source hashes and 27-case offline scope. It does not contain credentials or authorize arbitrary endpoints. Existing application/Business code, Auth assets, config, SQL, cron, workflow, dependency lock and native files remain unchanged. No dependency installation is required for the standalone verifier.

This tool is a partial source contribution to **OP-R01 / RG-R05**, useful for the already recorded public Auth asset gap. It does not collect authenticated backend job/alert/recovery evidence or close an action.

## Collector behavior and evidence limits

The nine fixed public staging routes are config.js, auth.html, auth-flows.js, auth-security.js, admin-mfa.js, app.js, business.js, /app and /business. GETs use omitted credentials and manual redirects, with a six-second request deadline, 30-second overall deadline, 32 KiB config body cap and 2 MiB cap for each other body. No URL override, provider invocation, script evaluation or mutation path exists.

The collector reports HTTP 200 HTML at a JavaScript URL as an explicit asset-type FAIL. Correct MIME with differing reviewed content is a parity REVIEW. Redirects are retained and not followed. Missing/invalid content type, body overflow, invalid UTF-8, transport errors and deadlines remain visible. Raw bodies, keys, headers and exception text are omitted from the receipt; fixed path, count/type/boolean/time/hash metadata is retained.

Only CR/CRLF and the known production-to-staging project-reference overlay are normalized for source comparison. Config gets a narrowly labelled project-reference observation with selected forbidden-marker checks; key ownership, executable configuration correctness and full secret scanning are not asserted. A metadata match never verifies installed backend/CI/artifact parity or a full OP case.

The source identity guard is for ordinary reviewed local exports, not a filesystem/OS sandbox. Windows root/link handling has a junction fixture path in the tests, but the assistant execution used a Linux directory link. The pinned owner Windows repeat is supplied separately; no new Windows result is inferred.

## Meaningful checks and measured history

| Boundary | What the actual checks exercised |
|---|---|
| Source/target identity | Real reviewed input bytes; changed/missing source denial; CRLF and spaces/percent/hash paths; actual redirected root rejection; contract and strict CLI target/source confirmation |
| Fixed transport | Nine exact GETs, omitted credentials, manual redirects, no Authorization/body; redirected destination rejection and no redirected body consumption |
| Response interpretation | HTML module FAIL, deceptive script MIME with HTML, wrong intended page REVIEW, missing MIME, CRLF/overlay matches, HTTP failures and config-specific observation/negative markers |
| Bounded/private output | Streaming byte cap, invalid UTF-8, sanitized transport errors, total/stream timeout, immutable timeout maxima and no acceptance promotion |
| CLI | Actual no-confirmation exit before collection; actual guarded default-transport run returns sanitized review/nonzero exit without an external request |

| Execution | Tests | PASS | FAIL | Exit |
|---|---:|---:|---:|---:|
| Initial actual candidate/CLI batch | 27 | 27 | 0 | 0 |
| Final verifier after source-bound/contract review | 27 | 27 | 0 | 0 |
| Historical executions / unique cases | 54 / 27 | 54 | 0 | — |

The final verifier reports four syntax PASS and 15 file SHA-256 values. Those measured bytes were checked again without rerunning behavior. The earlier 15 reviewed source inputs also matched the current parent Git identities. The standalone export uses only Node built-ins. Default-network instrumentation is not an OS sandbox or proof of real Node HTTP/DNS/provider behavior; live collection remains a separate later bounded outcome.

The current test discovery gains one file. Earlier Stage 9 receipts and its 882-case contract stay immutable at their own source/export pin; the historical Stage 9 standalone verifier is not claimed to describe the changed current test catalog. No full regression/CI/native dependency build was rerun for these isolated new tools.

## Preservation, owners and next handoff

All original 123 rows and 20 finding definitions, Stage 0–9 objects, completed 10.1 object, previous receipts, frozen OP matrix/decisions and action definitions remain unchanged. Prior scoped restore/support positives, the corrected Windows 882 PASS, all earlier failures and dated staging Auth module asset-type FAIL are retained. No current installed result replaces them in 10.2.

All six OP actions remain OPEN and six decisions UNCONFIRMED; inherited eight RG actions/eight decisions and 48 blocked cases are unchanged. Operational instructions contribute preparation to OP-R02–OP-R06 but no exercised acceptance. The successful local recovery target stays stopped and the two manual USD 1 conversions remain intact.

An exact-commit PowerShell export and offline Windows verification handoff is supplied in chat; it uses a new temporary directory and the standalone verifier. It does not check out files, install dependencies, run the live collector or change accounts/SQL/settings. **Owner repeat: REQUESTED_NOT_RECEIVED.** Return the JSON summary after it finishes; no SQL action is required for this preparation milestone.

**Next: 10.3 — one bounded staging operations/readiness outcome**, after any supplied repeat result is reconciled. Use accepted prerequisites for actual cases or record BLOCKED_NOT_RUN once and carry forward. Full Stage 10 report remains due at 10.4. Release gate remains OPEN_PENDING_REQUIRED_EVIDENCE; final remediation and a fresh full audit remain required.

## Owner Windows receipt recorded — S10E03 / 13 October

Pinned candidate `88503798ebd381aac2d52ab5a7905774636a4afc`; owner Node v22.17.0 reported 27 PASS, zero fail/skip/cancel/todo, exit 0 and four syntax PASS. All 15 consumed hashes freshly reconcile against pinned/current Git blobs as exact published bytes. Zero CRLF variants or unexpected mismatch. [Full safe owner receipt](security-stage-10-operations-owner-local-checks.json). Windows junction fixtures reported PASS within the stated offline scope. No new assistant test or current public/backend/job/alert/recovery check was run to record it.

Combined history is 81 successful executions of 27 unique cases (54 assistant plus 27 owner), not 81 unique controls. All earlier assistant source/receipts and unrelated prior failures remain unchanged. The preparation paragraphs above are historical; owner repeat is now PASS_27_EXIT_0. No additional owner action is required. All 24 full OP cases remain unrun and six actions OPEN. Next 10.3; full Stage 10 report 10.4; APK deferred.
