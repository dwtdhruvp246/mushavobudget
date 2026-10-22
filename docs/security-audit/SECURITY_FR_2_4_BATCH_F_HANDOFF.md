# Batch F: dormant staging database registration

**Completion update,FRE128,22 October2026:** [owner read-only result](security-fr-2-email-batch-f-review-owner-pass.json) confirms PostgreSQL17.11,exact version-reference parity across all10 sections,stable target/catalog observations,REGISTERED state and inactive application guards,exit0. The original-reference difference is limited to the four PostgreSQL18 NOT NULL catalog rows; column flags and all selected source/privilege properties match. Registration was not repeated. Current dormant registration is verified; activation and full hosted acceptance remain pending. See [completion report](SECURITY_FR_2_4_BATCH_F_COMPLETE.md). Earlier handoff text below is historical.

**Owner update,FRE127,22 October2026:** offline18/18 passed on Windows; one registration POST returnedHTTP201 after all9 fresh prerequisites passed. Independent catalog readback passed the other8 baseline checks but failed exact private reference equality. Control state was not read. Receipt: [owner review-required](security-fr-2-email-batch-f-owner-review-required.json). Do not rerun this registration command. Continue with the [read-only version/catalog review](SECURITY_FR_2_4_BATCH_F_READ_ONLY_REVIEW_HANDOFF.md); the original handoff follows for history.

22 October 2026, FRE126. Owner Batch E is complete: Windows Node22.17.0, PGlite0.5.8,114/114,88 source hashes,18 syntax checks,exit0 at commit `0deaccfc91610e1acb6c60276fa2728fdf7b2ad6`. The pasted output supplied no execution timestamp. The receipt is owner-reported, not an independent machine attestation.

This batch combines the next three related steps in one owner run. It does not repeat Edge deployment or configuration installation.

| Step | Operation and required result |
| --- | --- |
| Fresh target/context/baseline | Fixed GET for staging project metadata and expected database host, then fixed general Management SQL route with SQL `BEGIN TRANSACTION READ ONLY`. Require privileged postgres current/session/origin context and all nine selected reviewed baseline checks, including exact selected routine/policy fingerprints and reviewed relevant event hooks. |
| One dormant registration | Same fixed project and general query route, one POST of the Batch E reviewed existing54 bundle. Add only transaction-local staging/action acknowledgements. The bundle repeats privileged origin, target/action, selected baseline and hook guards inside the same write transaction, registers private controls and commits. |
| Independent readback | Separate SQL read-only catalog request must preserve the other eight baseline checks and exactly match the pinned private catalog projection. Only then read the private control aggregate: one row, fixed target, REGISTERED mode and null activation identity. Finally repeat project metadata/host validation. |

Successful run: six provider requests total, one registration write attempt, no automatic write retry or delete. Application activation, resume and quarantine are never called. Registration creates the private schema, five private functions, forced-RLS control table, constraints/index and restricted ACLs. API roles have no selected private schema, function or table access. No email backend or application guard is installed. This is not migration-history synchronization or a full canonical bootstrap application.

## Prompt and required token

The command first performs local source checks and the18 new regression cases. It installs only the locked public PGlite0.5.8 dependency with lifecycle scripts disabled. It then checks PowerShell parsing, hashes all95 source files, validates the private child pipe, and asks **one hidden prompt**:

> Paste a staging-only scoped Management token: Project Settings Read + Database Read-write (hidden)

Create/select a **scoped** token at [Supabase account access tokens](https://supabase.com/dashboard/account/tokens). Limit it to staging `dczlddwbtgvfdujgcitb`; choose **Project Settings — Read** and **Database — Read-write**. The prior Edge-only token may not include these permissions. Account-role limits still apply. Do not choose legacy account-wide access. This run requires no email address, VAPID keys, CurrencyAPI key, database password, ZIP selection or DPAPI packet.

The token stays in the parent/child process memory and private standard-input pipe; it is not written to disk, command arguments, environment or safe output. Raw provider bodies, SQL source, function bodies, paths, private values and database identifiers are not echoed. The final receipt reports fixed labels, status codes, booleans and selected baseline results. Supabase may itself retain normal provider query/audit logs; the SQL contains no user credentials.

## SQL route and limits

The [general query API](https://supabase.com/docs/reference/api/v1-run-a-query) is documented as experimental/Beta. The request uses `read_only:false` on that write-capable route so the actual intended privileged context can be inspected. The preflight and both catalog/control readbacks explicitly start SQL READ ONLY transactions and end in ROLLBACK; they do not use the dedicated read-only-user endpoint. The write uses its own BEGIN/COMMIT transaction. A dedicated read-only-role observation would not establish the required postgres origin. The script refuses the write if the observed context differs.

The API's documented success response schema is generic. The write response is required to be bounded valid JSON with HTTP201; its internal shape is not treated as proof of commit. Separate exact catalog/control readback supplies the scoped committed-state evidence. Preflight/readback expect one flat result row at their fixed alias; an unknown provider result envelope stops the batch instead of weakening a predicate. This real provider transport has not yet been exercised by the assistant. HTTP201 alone never completes registration acceptance.

The project metadata plus fixed provider project route supply routed-target evidence. The project GUC is only an acknowledgement. Neither the observations nor catalog hashes are a write lock, independent database-server attestation, proof of all unselected metadata, proof of every event-hook side effect, real PostgreSQL concurrency, or proof of authenticated runtime behavior. The same source guards run again inside registration, but concurrent changes after a readback remain possible.

The pinned private projection includes schema ownership/ACLs; function signature, return/language/owner/security attributes, config, ACL, exact prosrc SHA256 and API execute access; relations, columns/defaults, constraints, indexes, policies, noninternal triggers and effective API schema/table access. It is derived by executing the actual registration SQL in the reviewed synthetic platform fixture, then independently compared in the regression suite. It is a selected projection, not every possible catalog field. The platform fixture retains exact reviewed relevant hook definitions and four explicitly inert count stand-ins. Registration may automatically run reviewed DDL hooks; no application or Edge function is explicitly invoked.

## Failure and recovery handling

Before registration, any target/context/baseline/format failure stops with zero write attempts. An already present installer is refused; this is intentionally not an idempotent overwrite tool.

After a registration POST attempt, including HTTP error, timeout or malformed response, the script attempts a separate read-only catalog inspection. Exact catalog and REGISTERED control observations can resolve the current committed-state uncertainty, while an HTTP/format failure still returns review-required. If readback cannot establish state, uncertainty remains true. No POST is repeated and no private objects are deleted. The parent timeout reports that hosted state requires inspection if the child was started. **Send the safe JSON and exit code before any retry.**

No saved credentials, application rows, Auth settings, secret values, schedules, production data or native packages are read or changed by the intended batch operations. The newly supplied scoped Management token is used only for these requests. A private control row is aggregated for registration state. Existing staging Edge and configuration installations are not repeated. Retain the encrypted Batch A packet and Batch B frontend ZIP for later steps.

## Verification and next checkpoint

[Local verification](security-fr-2-email-batch-f-local-checks.json):18/18,95 source hashes,4 JavaScript syntax checks,Node24.19.0,PGlite0.5.8. Cases exercise the real fixed handler/SQL with synthetic HTTP transport, all six transport failure positions, readback after a failed write, no retry, wrong target/context, every prerequisite mismatch, catalog/control drift, bounded malformed responses, private pipe behavior, SQL read-only enforcement, late prerequisite drift, late transaction rollback, dormant registration and refusal of a second write. All Batch E88 source hashes are retained. Installed dependency bytes are not independently hashed; native Windows parent execution and real provider transport remain owner-pending.

Run the complete pinned PowerShell block supplied in chat. It announces BATCH F STARTED and COMPLETE or STOPPED FOR REVIEW. Expected offline18/18,95 hashes,4 syntax checks,exit0; successful hosted receipt requires all registration/readback predicates and exit0. Send **both safe JSON results and the combined exit code**. Do not rerun automatically on failure.

After dormant registration, the remaining work is coordinated Pages/frontend/caller readiness, quarantined application guard installation and recovery, followed by authenticated authorization, browser, email/push/FX and full hosted acceptance. Those controls are prerequisites to activation acceptance, not to this dormant private registration. Full finding closure, live activation approval, production/native/store release and APK updates remain pending. No launch completion percentage is inferred from test counts.
