# FR.2.2 — preventive paid-record workspace binding candidate

13 October 2026, FRE13. **Prepared and tested: 32 named local database control groups PASS, zero FAIL, exit 0; one JS syntax check.** Guarded staging installation, genuine API acceptance and canonical integration remain pending. [Actual final receipt/history](security-fr-2-binding-local-checks.json), [source contract](security-fr-2-binding-candidate-contract.json). Source/evidence parent: `8220ae5a85673bb4d06725ca9245560625e42bf2`.

## Concrete correction

The existing sync function derives a paid record's workspace from its parent payment item. The installed trigger only fires on INSERT and UPDATE OF payment_item_id. A direct workspace_id-only update therefore avoids normalization. FR.2.1 owner metadata confirms the original sync and final finance-guard bodies match reviewed source, with the omitted update column. The earlier owner batch failed this control, and current aggregate metadata identifies one record/parent mismatch and one conversion/record mismatch without affected identities.

The candidate replaces only **sync_payment_record_workspace_trigger** on public.payment_records:

```sql
before insert or update of payment_item_id, workspace_id
on public.payment_records
for each row execute function public.sync_payment_record_workspace();
```

This normalizes submitted workspace changes to the authorized parent, preserving the prior INSERT/relink behavior. The existing finance guard still checks parent entitlement before normalization; source RLS remains responsible for owner/member/role boundaries. A normalized successful write is acceptable for the frozen binding criterion; an HTTP error is not mandatory. No function, policy, grant, account or factor is replaced. No UPDATE/DELETE of historical records/conversions occurs during installation.

## Installation and rollback guards

`supabase/remediation/security_fr_2_2_paid_record_binding.sql` is a controlled staging review candidate outside automatic migrations. It uses a short transaction, 15-second statement and three-second lock limits, and a SHARE ROW EXCLUSIVE lock on payment_records. It requires a privileged SQL Editor role, origin replication mode and no active event hook covering CREATE TRIGGER (including unfiltered hooks). It validates an ordinary table, both selected PL/pgSQL trigger functions' signature/result/definer/exact search-path/LF body fingerprints, and exact original-or-corrected trigger associations/events/column lists, rejecting WHEN/arguments/constraint/clone/disabled drift. The existing paid-record finance guard must also remain attached and enabled. Unknown conditions fail before replacement; do not remove guards to force installation.

CREATE OR REPLACE keeps the same named trigger and only adds workspace_id update coverage. Reapplication to the exact corrected shape is idempotent. The final safe installation metadata SELECT is **after COMMIT**, and independently reports whether the workspace_id update column is present. Project selection is still owner-confirmed; the printed target label is not independent project attestation. It proves selected installation metadata, not genuine authorization behavior.

`supabase/remediation/security_fr_2_2_paid_record_binding_rollback.sql` is an owner-only reviewed fallback. It requires the exact corrected shape and same function/finance/event conditions, restores the prior column list and does not rewrite rows. It deliberately restores the known coverage gap; it is not an acceptance or recovery substitute. It was exercised locally and is not being executed or requested on staging now. If rollback becomes necessary, its complete code will be supplied in chat for the concrete reviewed situation.

The canonical schema and all 52 automatic migrations are unchanged at candidate preparation. Do not infer future reproducible deployment from a manual installation alone. After accepted installed and direct hosted evidence, integrate the narrow accepted definition into canonical source/migrations with compatibility/rollback checks. This dependency remains explicit; the controlled candidate is not automatically applied by a branch push or ordinary migration runner.

## Actual local evidence and limits

The assistant verified 55 selected source inputs against current Git blob identities, reused an already available PGlite dependency in a **fresh in-memory database**, and compiled all 52 current source migrations. The final runner rechecks exact SHA-256 or known CRLF-to-LF source representations and uses disabled default network transport. Engine: **PGlite 0.5.8, PostgreSQL 18.3 WebAssembly**, Node v24.19.0; historical staging is PostgreSQL 17.11. SQL uses the CREATE OR REPLACE TRIGGER form supported by PostgreSQL 17, but these are not hosted PostgreSQL 17 execution, genuine GoTrue/JWT, REST, browser or provider tests. Auth/Storage helpers and default source grants are modeled as explicitly recorded in the existing local database helper.

The 32 sequential named groups have multiple effect assertions where appropriate; they are not an undiscovered Node-test suite count. They demonstrate:

- The original submitted-foreign-workspace gap in the complete ordered source catalog, followed by successful installation and exact target columns.
- No installation/idempotent/rollback data changes; all source functions, policy metadata, table grants and unrelated trigger definitions unchanged.
- Foreign/NULL submitted workspace normalization; legitimate own amount/notes/INSERT/relink; invalid foreign/missing-parent relinks denied with preserved parent.
- Known-row outsider read/update/delete boundaries, anonymous denied-or-zero effects, and both owners' exact own synthetic record deletion/absence.
- Both retained manual conversion fixture rows remain byte-identical through selected writes/deletions. This is model evidence, not a recheck of the two real retained staging USD1 conversions or all historical accounting correctness.
- Guarded rollback/reinstallation; rejection of changed function body, search path, disabled/reattached/WHEN/column-drift triggers, missing finance guard, ordinary installer, non-origin replication and unreviewed DDL hook.

Early fixture setup errors (a nonexistent fixture column and already-created identity conversion collision) were corrected before named cases. Draft preservation assertions initially included unrelated conversion rows affected by the deliberately deleted test records, then assumed cleanup that source does not implement. The final assertion is scoped to the two retained manual fixtures; no binding SQL change was required for those expectation failures. Before additional replication/event guards, a 30-case run passed; final 32-case runs passed and the definitive source-verified/default-network-disabled receipt is retained. No full 882-case regression/CI or successful hosted caller result is claimed.

**Separate deletion/retention observation:** after deleting two exact synthetic records locally, two conversion rows referencing those records remain. This is only a local source-model observation; current staging readiness reported zero missing records. It does not establish live orphaning, intended retention semantics or a new vulnerability. Keep it with FR.3 deletion/ownership/retention and coordinating DL/PR review; do not delete financial history or manufacture cleanup acceptance through this binding change. The final receipt records conversion_cleanup_or_retention_acceptance=false.

## Complete owner handoff and next evidence

Open the default privileged SQL Editor for **STAGING dczlddwbtgvfdujgcitb** and verify the project bar. Run the complete installer SQL pasted in chat, exactly matching the published candidate. This changes one trigger's update coverage. No terminal command, frontend upload, test account creation, role promotion, factor enrollment, Auth setting change, key entry or historical rewrite is needed. Return the one **binding_installation** JSON or error; do not retry with weakened guards. Production kttkospkblwvguuwnhjj is excluded.

After the installation result, prepare the bounded direct Personal API tests and exact fixture readbacks/cleanup, with safe known-trigger/dispatch dependencies and ordinary controlled sessions. Existing aggregate mismatch provenance and historical repair need a separate private plan; do not touch either retained manual USD1 conversion or infer the record/conversion mismatch is the same pair. Business outbox source drift, full Admin policy/recovery/MFA/operator requirements and genuine Auth settings/session/inbox cases remain open. Source/metadata success alone does not close F08/F10/F15 or wider coordinating requirements.

All original 123 coverage rows, 20 findings, Stage 0–10 objects, 12 preceding final-remediation events, earlier receipts/action/decision records and successful FR.1 frontend scope remain preserved. Staging accounts/rows/settings and the stopped successful recovery target have not been changed by preparation. Full hosted/native/store acceptance is false; release gate OPEN_PENDING_REQUIRED_EVIDENCE; fresh final audit PLANNED_NOT_PERFORMED; APK deferred.

Primary reference read 13 October 2026: [PostgreSQL 17 CREATE TRIGGER](https://www.postgresql.org/docs/17/sql-createtrigger.html), including column-specific update firing and alphabetical same-kind trigger order. It does not attest the hosted project or authorize production execution.

## Owner installation attempt — 14 October 2026

FRE14 supersedes the pending installation handoff state: the SQL Editor screenshot reports UNREVIEWED_TRIGGER_DDL_EVENT_HOOK before replacement. No installation success receipt was returned. [Event-hook review](SECURITY_FR_2_2_EVENT_HOOK_REVIEW.md) records the one bounded read-only diagnostic and limits. Candidate/rollback SQL and 32-case local evidence are unchanged; do not disable or bypass the hook guard.
