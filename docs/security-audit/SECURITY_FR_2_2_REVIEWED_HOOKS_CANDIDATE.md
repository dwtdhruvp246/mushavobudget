# FR.2.2 — reviewed provider hooks and revised binding candidate

14 October 2026, FRE15. [Owner read-only hook result](security-fr-2-event-hooks-owner-result.json), [source contract](security-fr-2-reviewed-hooks-contract.json) and [48-case local result](security-fr-2-reviewed-hooks-local-checks.json). The earlier stopped installer/screenshot and original 32-case evidence remain preserved unchanged.

## Owner result and exact upstream reconciliation

At 04:21:02 UTC the owner receipt reports postgres, READ ONLY on, origin replication, seven catalog event hooks and two matches to the original conservative guard. Five command-tag-restricted hooks do not include CREATE TRIGGER. The matching hooks are extensions.pgrst_ddl_watch on ddl_command_end and extensions.pgrst_drop_watch on sql_drop, both O, unrestricted tags, supabase_admin hook/function ownership, PLpgSQL no-argument event_trigger security invoker, and empty search_path configuration. The binding trigger still has payment_item_id-only update coverage. Project selection remains owner context, not independently attested by the fixed label.

Both LF body fingerprints and byte lengths exactly match the official Supabase PostgreSQL 17 schema at pinned commit 220751e04862f6023ba56871cc22fb81bc6f0954, and the earlier provider migration at the separately pinned current upstream commit f4c005d50608990033ab370f9b00fd1c693c99db. The reviewed bodies loop catalog event details and conditionally NOTIFY pgrst, 'reload schema'; they contain no application-row mutation or external mail/push/charge dispatch. The ddl hook includes CREATE TRIGGER in its catalog tag selection. sql_drop remains conservatively reviewed rather than globally ignored.

| Hook | LF bytes | Owner MD5 matching reviewed source | Reviewed LF SHA-256 enforced on next install |
|---|---:|---|---|
| pgrst_ddl_watch | 729 | 7f27b8118fea5c88b0164331292859e3 | de987df746eb39647098459e7993bd8595e592969b0cd647828a3d13d37cffe0 |
| pgrst_drop_watch | 412 | bc09cc3003d66f91844af4cb05e203b7 | 791b41f0632fc86e0fc86a303ec0fd710c4e2ecf947a23422dae2b7a2c122f1d |

The live metadata came from the owner and is not independent provider provenance attestation. Matching source identifies a reviewed body; it is not a blanket declaration of database security. Current upstream develop has newer bodies (1188/851 bytes) and is deliberately not used as an assumed hosted version or substituted on staging. No hook upgrade/replacement/disable is requested.

## Concrete revised installer

`supabase/remediation/security_fr_2_2_paid_record_binding_reviewed_hooks.sql` and its separate reviewed-hooks rollback companion retain the prior role, origin, relation, exact application-function, trigger and finance checks. The former rejects every active CREATE TRIGGER-capable hook unless it matches the reviewed SHA-256 plus exact event/name/schema/owners/signature/config/default execution flags. A name-only exception is not used. Only CRLF-to-LF body normalization is allowed. The existing provider hooks continue enabled and execute normally, including the expected schema-cache notification when trigger DDL succeeds.

The sole target DDL remains CREATE OR REPLACE of sync_payment_record_workspace_trigger to INSERT or UPDATE OF payment_item_id, workspace_id. No existing rows/conversions are rewritten and no application function, policy, grant, account, factor or hook is changed. This prevents future direct binding substitutions; the existing one record/one conversion workspace mismatch is not repaired. Candidate/rollback are outside automatic migrations. Canonical schema/automatic integration and genuine hosted acceptance remain pending. The rollback companion restores the known prior coverage gap and is not requested now.

## Meaningful local checks

The revised runner executes 48 named cases in a fresh PGlite 0.5.8 PostgreSQL 18.3 WebAssembly full ordered 52-migration source catalog with modeled Auth/Storage/default grants. All 55 source input Git blobs match the current audit branch; runtime input hashing is retained. One JS syntax check passes; default external transport is disabled. The 32 prior finance/binding/guard/rollback cases are rerun against the revised SQL because that code changed. Sixteen additions exercise active exact provider hooks, installation/idempotence/rollback/normalization, unknown additional hooks, altered bodies, owners, security-definer/search-path/mode/event/tag drift, CRLF normalization and exact fixture restoration. Hooks and rows remain unchanged by accepted installs; rejected installs preserve drifted hooks, data and target columns. Results: 48 PASS, 0 FAIL, exit 0.

An initial local setup run completed all 32 baseline cases but exited 1 with 42501 before added cases: the synthetic provider role was not superuser and could not own event triggers. The model role was corrected to permit that provider-owned catalog fixture; no real role was changed. That attempt is retained in the local receipt. These are modeled PostgreSQL 18 checks, not hosted PostgreSQL 17, JWT/REST/browser or concurrent DDL acceptance. The local observation of two post-deletion synthetic conversion references remains separate from both retained manual fixture preservation and any hosted/history/retention conclusion.

## Owner handoff and remaining scope

The complete revised installer is pasted in chat for staging dczlddwbtgvfdujgcitb, replacing the stopped handoff. Await its one post-COMMIT metadata receipt before controlled direct authorization/relink/deletion tests. No terminal dependency install or new frontend upload is needed. No historical repair or Business/outbox/Admin/Auth prerequisite bypass is authorized by this revision. FR.1 scoped 65/65 serving remains accepted; original findings/actions and full release gate stay open. All Stage 0–10 progress objects, events FRE01–FRE14, retained actors/two manual conversions, native owner edits and stopped recovery target remain preserved. Production excluded; APK deferred.

Primary source pins:

- https://github.com/supabase/postgres/blob/220751e04862f6023ba56871cc22fb81bc6f0954/migrations/schema-17.sql
- https://github.com/supabase/postgres/blob/f4c005d50608990033ab370f9b00fd1c693c99db/migrations/db/migrations/20220321174452_fix-postgrest-alter-type-event-trigger.sql
- https://www.postgresql.org/docs/17/functions-binarystring.html
- https://www.postgresql.org/docs/17/event-trigger-definition.html

## Owner installation metadata — 14 October 2026

FRE16: [owner receipt](security-fr-2-binding-owner-installation.json) reports post-COMMIT workspace update-column coverage present. [Installation checkpoint](SECURITY_FR_2_2_INSTALLATION_CHECKPOINT.md) records limits and the next controlled Personal API recheck. This supersedes the pending-installation handoff state above without changing earlier evidence, reviewed SQL or local results. No hosted authorization/finding/history/canonical integration acceptance is claimed.
