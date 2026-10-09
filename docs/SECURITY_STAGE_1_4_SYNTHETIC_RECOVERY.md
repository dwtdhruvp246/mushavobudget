# 1.4 — Synthetic recovery testing

Active 9 October 2026 at 1.4.2 after owner-reported native target readiness PASS at 1.4.1 and the [1.3 checkpoint](SECURITY_STAGE_1_3_CHECKPOINT_REPORT.md). Four finite work items: local target/scope, synthetic exports, actual restore/validation, checkpoint report. One completed with scope limits; three remain. Existing Stage 1.2 backup/completeness/encryption/offsite/operating gaps remain carried; Google Drive remains deferred. No production overwrite or customer-data import into staging.

## 1.4.1 — Native local target preparation

Owner reported initdb, pg_ctl and postgres all FOUND at PostgreSQL 17.11. Client PostgreSQL 17.11 was previously checked. Native PostgreSQL remains the chosen workflow; no Docker, new paid project or extra hosted project is required.

The [preparation script](../scripts/prepare-local-recovery-target.ps1) creates a unique folder under LocalApplicationData on a fixed NTFS drive, requires at least 1 GiB free and rejects redirected ancestors. Permissions are verified for owner, SYSTEM and Administrators only. It initializes a fresh PostgreSQL 17 cluster owned by mushavo_restore_admin, with UTF8/C locale, page checksums and SCRAM password authentication; no existing service/cluster files are changed. Native initdb password prompting avoids a plaintext password file or password on the command line. Owner privately saves this NEW LOCAL password for later operations.

Only 127.0.0.1 port 55439 is enabled. An occupied-port precheck stops before initialization; a later bind race remains possible and startup must then fail without stopping the other listener. The script starts its own data directory briefly, uses a read-only metadata probe and verifies actual data_directory/user/database/version, loopback address/port, parsed SCRAM rules and empty public/Auth/Storage scope. Shutdown targets only that new directory and verifies pg_ctl status 3 (not running). Startup/check errors still attempt shutdown of that same new cluster, never another PostgreSQL service. Artifacts remain private for review; no existing directory/database deletion is requested.

Successful result is NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED, with path/port/version/dependency metadata and a private target-preparation.json receipt. This is target readiness, not any export/restoration or full Supabase service recovery. Local sslmode=disable applies only to this password-authenticated loopback-only native target, not hosted connections.

Available pgcrypto and managed extension names are reported for scope planning, rather than assumed. Supabase Auth/Storage/Edge/provider services and managed-extension behavior are not recreated by merely starting native PostgreSQL. Exact compatible restore scope and any explicitly substituted bootstrap dependencies must be documented before the synthetic drill.

### Actual owner outcome — 9 October

The first initialization failed because the checked installation lacked postgres.bki and the sample configuration files, despite working executable version output. It stopped before server startup or restoration. Owner then supplied PostgreSQL 17.11 version and all three supporting-file presence checks as true, followed by NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED at 2026-10-09T05:48:28.4415907Z. The owner summary reports verified private permissions, SCRAM, empty application scope, 127.0.0.1:55439, pgcrypto available, no managed extensions available, and server stopped. Existing databases were not modified; no hosted connection/export/restore occurred in preparation. The private target receipt/path remain owner-held. Root did not execute Windows lifecycle actions independently.

This establishes native target readiness, with full managed-service recovery explicitly excluded. The first executable-only check was insufficient to establish installation completeness; its failure and subsequent successful native run remain in the evidence history.

## 1.4.2 — Guarded synthetic application export

The [export script](../scripts/export-synthetic-recovery-source.ps1) runs the [private source probe](../supabase/diagnostics/security_stage_1_synthetic_export.sql) only through the fixed staging session pooler/user, with the previously used staging CA certificate and sslmode=verify-full. Native prompts accept the STAGING database password; it is not stored in command arguments, files or environment variables. Do not use production credentials. Keep staging idle until the command finishes.

The repeatable-read/read-only probe requires PostgreSQL 17/postgres, exactly the two reserved test Auth accounts, exactly one owner-created personal USD 20 AUDIT-S135-OWNER-ONLY item and its owner-recorded paid record, and exactly two separate personal workspaces. Failure stops before pg_dump. The fixed connection provides the client-side project target; SQL alone does not establish hosted project identity. These guards verify selected test-data scope, not every public row's provenance or full staging isolation.

The native custom-format dump selects the entire public schema, including application definitions, table data, ACLs and RLS policy definitions. Auth/Storage/cron/Vault schemas, global roles, provider services and large-object data are not included. The private probe exports only Auth id/email bootstrap identities, never Auth password columns. Public staging configuration/routine bodies may be present in the private archive; nothing is uploaded or printed. Original ownership metadata can remain in a custom archive; later restoration must deliberately adapt ownership to the local administrator rather than claim original hosted ownership recovered.

Before finalizing the archive, pg_restore lists the TOC, checks the three selected table-data entries and absence of non-public table-data entries, and decodes the full payload offline to NUL. A second guarded probe must exactly match the first private JSON file. This is selected-row/relation-metadata comparison across separate transactions; pg_dump's own snapshot is consistent, but the probes do not share that snapshot and other public-row drift/transient changes are not proved absent.

The script validates the prepared root's identity/ACL/receipt, creates one new child there, retains private source JSON/TOC/archive, creates a harmless local dummy attachment and records five file SHA-256 hashes/sizes in a private manifest. It performs no hosted write, local server startup, restore, encryption, Storage upload or offsite action. Errors preserve partial artifacts and issue no success receipt.

Acceptance is SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS. It proves archive creation/readability and private component hashes, not successful restoration. Minimal Auth/Storage SQL dependencies, non-login placeholder roles and any dependency substitutions must be reviewed explicitly in 1.4.3 before writes to the separate local target. Original public ACL/RLS definitions are available for later selected behavior checks; hosted role authority, Auth sign-in, Storage API/file backup, email/push/schedulers and full platform recovery remain outside the drill. Copying the dummy file later can establish local file-byte recovery only.

Disposable embedded PostgreSQL fixtures PASS for the valid seed, missing item, extra Auth user, wrong amount, wrong workspace owner, wrong paid-record owner and missing workspace; password-field/value omission, deterministic repeated metadata, wrong-database guard and read-only write rejection also pass. The fixture runtime uses PostgreSQL 18, so only its database/major predicates are adapted for fixture execution; published owner SQL still requires PostgreSQL 17. These tests do not establish Windows execution, TLS/project identity, pg_dump/pg_restore decoding or restore success.

## Preparation validation and limits

Disposable embedded PostgreSQL probe checks PASS: empty/nonempty public/Auth/Storage metadata, private sentinel-value omission and read-only write rejection. This does not validate Windows ACL enforcement, native initdb prompting, executable startup, pg_ctl lifecycle or hosted dependencies. No PowerShell runtime exists in the root executor; owner execution supplies actual Windows evidence. No hosted/staging/production connection or customer records were accessed by these fixtures.

The owner handoff fetches the audit branch and reads pinned Git script/probe contents without checking out or changing the dirty Windows project. The nonsecret probe SQL is supplied temporarily through MUSHAVO_LOCAL_RECOVERY_PROBE_SQL and cleared afterward. Run in ordinary PowerShell. Initdb prompts for the new local password; psql prompts for it again. Send only the final metadata summary/redacted errors, not password or raw database/log content.

## Remaining work

| Work item | Status / acceptance |
|---|---|
| 1.4.1 Target and scope | PASS with managed-service limits: owner native target ready and stopped; managed extensions absent |
| 1.4.2 Synthetic exports | Script and SQL fixtures ready; owner export pending |
| 1.4.3 Restore and compare | Pending: separate target, selected records/schema/grants/RLS/file-byte checks and elapsed time |
| 1.4.4 Checkpoint report | Pending: passes, failures, substituted/missing dependencies and limits; no full live-recovery guarantee |

Production private artifacts remain separate owner-held completeness evidence. Source setting/key/provider/full-platform behavior and operational 24-hour targets are not proved by this synthetic drill. No outbound scheduler/mail/push deployment or Google upload is authorized by preparation.
