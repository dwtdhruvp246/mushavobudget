# 1.4 — Synthetic recovery testing

Closed 9 October 2026 with scoped native passes and carry-forward. Read the [1.4 checkpoint report](SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md). S1E87 records the successful corrected native restore: thirteen effective role checks, selected relation/RLS/value comparisons, local dummy-file hash and unchanged source hashes, transaction committed and own server stopped. Four finite work items have outcomes; zero remain. Stage 1 continues at [1.5.1 operations inventory](SECURITY_STAGE_1_5_OPERATIONS.md). Existing 1.2 backup/completeness/encryption/offsite/operating gaps remain carried; Google stays deferred and full platform recovery remains unverified.

## 1.4.1 — Native local target preparation

Owner reported initdb, pg_ctl and postgres all FOUND at PostgreSQL 17.11. Client PostgreSQL 17.11 was previously checked. Native PostgreSQL remains the chosen workflow; no Docker, new paid project or extra hosted project is required.

The [preparation script](../../scripts/prepare-local-recovery-target.ps1) creates a unique folder under LocalApplicationData on a fixed NTFS drive, requires at least 1 GiB free and rejects redirected ancestors. Permissions are verified for owner, SYSTEM and Administrators only. It initializes a fresh PostgreSQL 17 cluster owned by mushavo_restore_admin, with UTF8/C locale, page checksums and SCRAM password authentication; no existing service/cluster files are changed. Native initdb password prompting avoids a plaintext password file or password on the command line. Owner privately saves this NEW LOCAL password for later operations.

Only 127.0.0.1 port 55439 is enabled. An occupied-port precheck stops before initialization; a later bind race remains possible and startup must then fail without stopping the other listener. The script starts its own data directory briefly, uses a read-only metadata probe and verifies actual data_directory/user/database/version, loopback address/port, parsed SCRAM rules and empty public/Auth/Storage scope. Shutdown targets only that new directory and verifies pg_ctl status 3 (not running). Startup/check errors still attempt shutdown of that same new cluster, never another PostgreSQL service. Artifacts remain private for review; no existing directory/database deletion is requested.

Successful result is NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED, with path/port/version/dependency metadata and a private target-preparation.json receipt. This is target readiness, not any export/restoration or full Supabase service recovery. Local sslmode=disable applies only to this password-authenticated loopback-only native target, not hosted connections.

Available pgcrypto and managed extension names are reported for scope planning, rather than assumed. Supabase Auth/Storage/Edge/provider services and managed-extension behavior are not recreated by merely starting native PostgreSQL. Exact compatible restore scope and any explicitly substituted bootstrap dependencies must be documented before the synthetic drill.

### Actual owner outcome — 9 October

The first initialization failed because the checked installation lacked postgres.bki and the sample configuration files, despite working executable version output. It stopped before server startup or restoration. Owner then supplied PostgreSQL 17.11 version and all three supporting-file presence checks as true, followed by NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED at 2026-10-09T05:48:28.4415907Z. The owner summary reports verified private permissions, SCRAM, empty application scope, 127.0.0.1:55439, pgcrypto available, no managed extensions available, and server stopped. Existing databases were not modified; no hosted connection/export/restore occurred in preparation. The private target receipt/path remain owner-held. Root did not execute Windows lifecycle actions independently.

This establishes native target readiness, with full managed-service recovery explicitly excluded. The first executable-only check was insufficient to establish installation completeness; its failure and subsequent successful native run remain in the evidence history.

## 1.4.2 — Guarded synthetic application export

The [export script](../../scripts/export-synthetic-recovery-source.ps1) runs the [private source probe](../../supabase/diagnostics/security_stage_1_synthetic_export.sql) only through the fixed staging session pooler/user, with the previously used staging CA certificate and sslmode=verify-full. Native prompts accept the STAGING database password; it is not stored in command arguments, files or environment variables. Do not use production credentials. Keep staging idle until the command finishes.

The repeatable-read/read-only probe requires PostgreSQL 17/postgres, exactly the two reserved test Auth accounts, exactly one owner-created personal USD 20 AUDIT-S135-OWNER-ONLY item and its owner-recorded paid record, and exactly two separate personal workspaces. Failure stops before pg_dump. The fixed connection provides the client-side project target; SQL alone does not establish hosted project identity. These guards verify selected test-data scope, not every public row's provenance or full staging isolation.

The native custom-format dump selects the entire public schema, including application definitions, table data, ACLs and RLS policy definitions. Auth/Storage/cron/Vault schemas, global roles, provider services and large-object data are not included. The private probe exports only Auth id/email bootstrap identities, never Auth password columns. Public staging configuration/routine bodies may be present in the private archive; nothing is uploaded or printed. Original ownership metadata can remain in a custom archive; later restoration must deliberately adapt ownership to the local administrator rather than claim original hosted ownership recovered.

Before finalizing the archive, pg_restore lists the TOC, checks the three selected table-data entries and absence of non-public table-data entries, and decodes the full payload offline to NUL. A second guarded probe must exactly match the first private JSON file. This is selected-row/relation-metadata comparison across separate transactions; pg_dump's own snapshot is consistent, but the probes do not share that snapshot and other public-row drift/transient changes are not proved absent.

The script validates the prepared root's identity/ACL/receipt, creates one new child there, retains private source JSON/TOC/archive, creates a harmless local dummy attachment and records five file SHA-256 hashes/sizes in a private manifest. It performs no hosted write, local server startup, restore, encryption, Storage upload or offsite action. Errors preserve partial artifacts and issue no success receipt.

Acceptance is SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS. It proves archive creation/readability and private component hashes, not successful restoration. Minimal Auth/Storage SQL dependencies, non-login placeholder roles and any dependency substitutions must be reviewed explicitly in 1.4.3 before writes to the separate local target. Original public ACL/RLS definitions are available for later selected behavior checks; hosted role authority, Auth sign-in, Storage API/file backup, email/push/schedulers and full platform recovery remain outside the drill. Copying the dummy file later can establish local file-byte recovery only.

Disposable embedded PostgreSQL fixtures PASS for the valid seed, missing item, extra Auth user, wrong amount, wrong workspace owner, wrong paid-record owner and missing workspace; password-field/value omission, deterministic repeated metadata, wrong-database guard and read-only write rejection also pass. The fixture runtime uses PostgreSQL 18, so only its database/major predicates are adapted for fixture execution; published owner SQL still requires PostgreSQL 17. These tests do not establish Windows execution, TLS/project identity, pg_dump/pg_restore decoding or restore success.

### Actual owner export outcome — 9 October

The first connection failed database password authentication before the probe or export. After retry, owner reports SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS at 2026-10-09T06:09:31.6792097Z: 1,330,785-byte archive, 80 public table-data entries, 380 public ACL entries, two Auth identity-only records, one payment item, one paid record and two personal workspaces. Offline payload decoding, private manifest creation, local dummy-file creation and repeated selected metadata match passed. No hosted writes/local startup/restore/offsite operation occurred. Separate probes still do not establish a shared snapshot or all-public-data drift absence. Owner-held files/hashes remain private; root independently accessing the actual archive is neither required nor claimed.

## 1.4.3 — Native application restore and selected access checks

Run the [native restore script](../../scripts/restore-synthetic-recovery.ps1) and [private builder](../../scripts/prepare-synthetic-restore.cjs) only through the pinned Git handoff in ordinary Windows PowerShell. Both native password prompts use the LOCAL mushavo_restore_admin password saved in 1.4.1. The script has only a 127.0.0.1:55439 connection; it contains no staging/production database connection or upload operation.

Before startup, the script verifies private root ACL/identity, target receipt/data-directory non-redirection, stopped cluster status and free loopback port. The builder verifies the five component filenames, sizes and SHA-256 values, source receipt paths, repeated source JSON and selected synthetic row/identity shape. Source files are never rewritten. One new private SyntheticRestore child holds helper/SQL/TOC/logs/results. A copied TOC excludes only CREATE SCHEMA public (already present from initdb) and any provider publication/event-trigger entries. Unsupported database/extension/foreign/server/subscription entries stop preparation; non-public table data is rejected. Archived public table/routine/constraint/index/RLS/ACL definitions and data remain selected. Comments/security labels are not restored. Original ownership is adapted deliberately with pg_restore --no-owner; this is not original hosted ownership recovery.

After offline SQL rendering, the script starts only its own data directory, rechecks live path/user/database/version/loopback/SCRAM/empty public/Auth/Storage scope, rechecks input hashes and then uses psql --single-transaction with ON_ERROR_STOP. Bootstrap, archived SQL and validation either commit together or roll back on a SQL error. An archive render/guard failure happens before database writes. Do not rerun against a committed target; no clean/reset/drop of an existing database is supplied. Later file-copy/shutdown failures can occur after database commit and must remain REVIEW with the explicit commit flag.

### Explicit native dependency substitutions

| Dependency | Local drill behavior | Remaining limitation |
|---|---|---|
| Hosted ownership | Objects owned by local recovery administrator | Original hosted owner/authority is not recreated |
| Provider roles | Fixed names created NOLOGIN, NOSUPERUSER, NOINHERIT, NOBYPASSRLS, no replication or role/database creation | Source passwords, memberships, global settings and managed privileges not restored |
| Auth identities | Minimal auth.users with two id/email bootstrap rows; no passwords | Hosted Auth schema/sign-in/token/provider recovery not tested |
| auth.uid/role/jwt | SQL helpers read administrator-supplied request.jwt.claims test settings | Trusted SQL identity emulation, not token verification or PostgREST authentication |
| Storage SQL dependencies | Minimal empty buckets/objects tables and foldername helper | No restored bucket/object metadata, Storage API authorization or file-service recovery |
| pgcrypto | Native extension installed into extensions schema | Other managed extensions/providers remain absent |
| Realtime/event triggers | Provider publication/event-trigger TOC entries excluded if present | Provider initialization/dispatch/replication not recovered |
| Dummy attachment | Local source file copied to a new local destination and hash-compared | Demonstrates local file-byte copying only; not Storage/offsite recovery |

Validation checks archived public relation names/kinds/RLS flags, selected payment/workspace column names and typed values, required authenticated read/update permissions and non-bypassing test roles. It switches to authenticated/anon roles with distinct owner/outsider/null identities and tests owner-item, paid-record and workspace reads plus same-name update boundaries. Only zero rows or SQL insufficient_privilege count as a denied access; other errors fail. Owner positive controls and outsider's own-workspace positive control are required. Each update attempt runs in a deliberate rolled-back subtransaction, including trigger/audit/timestamp effects. Thirteen effective access checks must pass; no application policy/grant is patched to manufacture a native pass. This does not test insert/delete/RPC/Family/Business/Storage/HTTP behavior or every recovered row/routine/constraint.

After a committed validation, the script copies the dummy file, checks its hash and source receipt/component hashes, attempts verified shutdown of only its own cluster and records elapsed seconds including local prompts/preparation. Elapsed time is scoped drill duration, not full platform RTO. A success summary is SYNTHETIC_NATIVE_APPLICATION_RESTORE_SCOPED_PASS; otherwise REVIEW includes phase, problem code, database-commit/file/source/shutdown flags. Preserve all artifacts and send only that summary/redacted errors. Private SQL/source data/hashes/passwords must not enter chat/Git.

The disposable PostgreSQL 18 fixture replays all 51 migrations, models missing hosted default table/function ACLs, creates synthetic users/payment through application routines and passes thirteen access checks plus exact selected values/columns and no-op rollback. Six negative application cases fail as intended: broad read policy, missing update grant, disabled RLS, altered paid amount, bypass-RLS role and added selected-table column. Private package fixtures reject source-byte changes and path escape. The embedded native target guard/pgcrypto differences are explicit adapters. None of these fixtures executes the owner's Windows lifecycle, actual pg_restore archive or original hosted ACLs. Owner native scoped acceptance is subsequently recorded in S1E87; fixtures remain separate evidence.

### First native attempt and corrected validation

S1E84 records the owner native attempt at 2026-10-09T06:44:31.5662939Z: restore/validation transaction failed, commit false, zero completed access checks and own server stopped. The later error-only log output (S1E85) identifies `query would be affected by row-level security policy for table "payment_items"`. PostgreSQL dumps set row_security off for loading; the first validator inherited that setting when switching to a regular role. This is a validation-session defect, not evidence that the application policy needs weakening. The final source/dummy checks were not reached; their false summary flags do not establish source corruption.

S1E86 corrects the validator with `SET LOCAL row_security = on;` after archived SQL and before access checks. The regression fixture now starts with the dump setting off, reproduces the exact reported error with the previous validator and passes all thirteen checks with the corrected validator. All six application and two private-package negative cases remain effective. No application policy, grant or archive bytes change. At correction publication owner native retry remained pending; existing guards require an empty target, use a new private run folder and retain prior artifacts. No reset/drop or repeat source export is required.

## Preparation validation and limits

Disposable embedded PostgreSQL probe checks PASS: empty/nonempty public/Auth/Storage metadata, private sentinel-value omission and read-only write rejection. This does not validate Windows ACL enforcement, native initdb prompting, executable startup, pg_ctl lifecycle or hosted dependencies. No PowerShell runtime exists in the root executor; owner execution supplies actual Windows evidence. No hosted/staging/production connection or customer records were accessed by these fixtures.

The owner handoff fetches the audit branch and reads pinned Git script/probe contents without checking out or changing the dirty Windows project. The nonsecret probe SQL is supplied temporarily through MUSHAVO_LOCAL_RECOVERY_PROBE_SQL and cleared afterward. Run in ordinary PowerShell. Initdb prompts for the new local password; psql prompts for it again. Send only the final metadata summary/redacted errors, not password or raw database/log content.

## Checkpoint outcomes

| Work item | Status / acceptance |
|---|---|
| 1.4.1 Target and scope | PASS with managed-service limits: owner native target ready and stopped; managed extensions absent |
| 1.4.2 Synthetic exports | Scoped PASS: owner native public export/offline decode and selected source checks; 80 table-data/380 ACL entries |
| 1.4.3 Restore and compare | Scoped native PASS S1E87: committed restore, 13 checks, selected metadata/values and file/source hashes; server stopped |
| 1.4.4 Checkpoint report | Complete S1E88: detailed checkpoint report and carry-forward; no full live-recovery guarantee |

Production private artifacts remain separate owner-held completeness evidence. Source setting/key/provider/full-platform behavior and operational 24-hour targets are not proved by this synthetic drill. No outbound scheduler/mail/push deployment or Google upload is authorized by preparation.
