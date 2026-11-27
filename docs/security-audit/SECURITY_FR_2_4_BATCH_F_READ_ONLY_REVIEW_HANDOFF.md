# Batch F: read-only private catalog and dormant-state review

**Completion update,FRE128,22 October2026:** [owner read-only result](security-fr-2-email-batch-f-review-owner-pass.json) confirms PostgreSQL17.11,exact version-reference parity across all10 sections,stable target/catalog observations,REGISTERED state and inactive application guards,exit0. The original-reference difference is limited to the four PostgreSQL18 NOT NULL catalog rows; column flags and all selected source/privilege properties match. Registration was not repeated. Current dormant registration is verified; activation and full hosted acceptance remain pending. See [completion report](SECURITY_FR_2_4_BATCH_F_COMPLETE.md). Earlier handoff text below is historical.

22 October2026,FRE127. The [owner Batch F receipt](security-fr-2-email-batch-f-owner-review-required.json) reports Windows Node22.17.0,18/18 offline,95 source hashes,4 syntax checks and offline exit0. At `2026-10-22T10:34:57.208Z`, fresh fixed staging target/host, privileged postgres origin and all9 prerequisites passed. One registration request returned HTTP201. Independent readback also returned201 and passed the other8 baseline checks, but the private catalog did not equal the single local reference. Control state and post-target checks were not reached. Hosted exit1 and registration uncertainty remain historical facts. **Do not repeat registration.**

This review performs no registration, activation, resume, quarantine, delete, deployment or configuration write. It combines the next diagnostic and state confirmation in one run.

| Combined observation | Required evidence |
| --- | --- |
| Target and execution context | Fixed provider staging project `dczlddwbtgvfdujgcitb` and expected host, before/after; postgres privileged origin and explicit SQL READ ONLY context. |
| Server version and private catalog | Read numeric `server_version_num`, select the predeclared reference for major15,16,17 or18, and compare the unmodified observed private catalog exactly. Report each section's equality, row counts, hashes and redacted field differences. |
| Dormant state | Only after exact version-reference parity, all8 retained baseline checks and explicit application-guard absence, read the private control aggregate: exactly one REGISTERED row for the fixed target and null activation identity. |
| Observation stability | Read the catalog/version/baseline again and require equality with the first observation; repeat target metadata. Successful run uses five provider requests; a catalog mismatch skips control access and normally uses four. |

## Version differences addressed explicitly

The original reference was produced by PGlite's PostgreSQL18 engine. PostgreSQL18 stores table NOT NULL constraints in `pg_constraint`; PostgreSQL17 and earlier represent these through `pg_attribute.attnotnull` instead. See the official [18 catalog](https://www.postgresql.org/docs/18/catalog-pg-constraint.html) and [17 catalog](https://www.postgresql.org/docs/17/catalog-pg-constraint.html). PostgreSQL17 adds the table `MAINTAIN` ACL privilege `m`; the [17 privilege table](https://www.postgresql.org/docs/17/ddl-priv.html) lists `arwdDxtm`, while [16](https://www.postgresql.org/docs/16/ddl-priv.html) lists `arwdDxt`.

The reviewer changes only its pinned **expected reference**, never the observed metadata:

- For15/16/17, omit exactly the four known separate NOT NULL catalog entries from the PostgreSQL18 reference. The exact five-column projection, including the four required true `attnotnull` flags, remains mandatory.
- For15/16, the one owner-only rollout table ACL reference is exactly `{postgres=arwdDxt/postgres}`. For17/18 it remains exactly `{postgres=arwdDxtm/postgres}`. Other owner/schema/function ACLs and all effective API privilege booleans remain exact.
- Major18 requires the unchanged original reference. Unsupported versions stop. Source hashes, security-definer flags, settings, ownership, RLS/force-RLS, columns/defaults, indexes, all remaining constraints, policy/trigger absence and private API access are never relaxed.

The source hashes must still match all five private functions byte-for-byte. There is no whitespace, line-ending, BOM, source or ACL normalization of observed metadata. A missing NOT NULL flag, extra object, unexpected grant, different body or unreviewed metadata field within the selected projection remains review-required. The output distinguishes original-reference equality from version-reference equality and lists the selected reference adjustments. **The hosted server version and actual mismatch cause are not known yet.** The documented version differences are a hypothesis until this owner review supplies evidence.

Diagnostics use fixed expected object labels, section names, counts, booleans, known owner-only ACL profile labels and SHA256 values. Unknown provider names, definitions, SQL source and ACL text are redacted; unexpected objects are counted without printing their identifiers. Catalog comparison is a selected projection, not proof of every possible namespace object, role-membership path or provider side effect.

## Prompt and execution

Run the full pinned PowerShell block supplied in chat. It fetches the security branch, exports the reviewed commit with LF bytes, installs the single locked public PGlite0.5.8 dependency with lifecycle scripts disabled, performs local verification, checks PowerShell syntax and starts the private runner. It announces READ-ONLY REVIEW STARTED and COMPLETE or STOPPED FOR REVIEW.

There is **one hidden prompt**, for the same staging-scoped Management token used in Batch F: **Project Settings Read + Database Read-write**. Reuse it if still valid. No email, VAPID, CurrencyAPI, database password, owner ZIP or encrypted packet is requested. The token is used only in memory/private stdin; not written to disk, arguments, environment or safe output.

The general Management query endpoint is used with API `read_only:false` so the established privileged postgres context can be checked. Every SQL request itself starts `BEGIN TRANSACTION READ ONLY`, sets local search_path/timeouts, performs only fixed catalog SELECTs or the conditional private control aggregate, then ROLLBACKs. It does not use the separate provider read-only-user context. A write-capable token/route is not permission for this script to issue writes: the input accepts only the token, the entrypoint has no registration switch, and tests inspect every dispatched query against the two fixed read-only statements. Extra SQL/URL/version/acknowledgement inputs and `--Register` are rejected. No old installer script is called.

## Tests and interpretation

[Local checks](security-fr-2-email-batch-f-review-local-checks.json):18/18,101 source hashes,4 JavaScript syntax checks,Node24.19.0,PGlite0.5.8. All original Batch F95 source bytes remain pinned and unchanged. Tests cover exact supported references, version-gated NOT NULL/MAINTAIN differences, mandatory column flags, every selected function field, extra/missing objects, grants/RLS/owners, redacted diagnostics, fixed target/context, every baseline check, guard absence, malformed/active/duplicate control, before/after drift, all five transport failures, private pipe input and bounded malformed responses. The actual reviewer SQL/handler is also exercised against the actual locally registered database and leaves its selected catalogs and REGISTERED mode unchanged.

Older PostgreSQL comparison observations are **synthetic fixtures**, not execution against older servers. Installed dependency bytes are not independently hashed. Native Windows parent execution and the hosted versioned review remain owner-pending. Earlier owner preflight/write/readback HTTP observations do not establish full transport semantics or committed registration acceptance.

Success means only that the **current** private catalog and REGISTERED control state match the reviewed version-specific projection under stable observed baseline/target metadata. The prior owner receipt remains unchanged. Observation stability is not a write lock, concurrency proof, independent database-server attestation, activation approval or full hosted acceptance. State could change after the final observation.

On mismatch, send the complete safe comparison and exit code; do not rerun the original registration command. The output should identify whether the difference is a documented version representation or another field requiring review, without printing credentials or function bodies. No automatic retry or deletion occurs.

Expected offline18/18,101 hashes,4 syntax checks,exit0. Successful hosted review requires every target/context/version/catalog/baseline/guard/control/stability predicate and exit0. **Send both safe JSON results and the combined review exit code.** Pages/frontend readiness, quarantined activation/recovery and authenticated/browser/delivery acceptance remain pending; production/native unchanged, APK deferred and findings remain open.
