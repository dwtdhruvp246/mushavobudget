# 1.4 — Synthetic recovery testing

Active 9 October 2026 at 1.4.1 after the [1.3 checkpoint](SECURITY_STAGE_1_3_CHECKPOINT_REPORT.md). Four finite work items: local target/scope, synthetic exports, actual restore/validation, checkpoint report. Existing Stage 1.2 backup/completeness/encryption/offsite/operating gaps remain carried; Google Drive remains deferred. No production overwrite or customer-data import into staging.

## 1.4.1 — Native local target preparation

Owner reported initdb, pg_ctl and postgres all FOUND at PostgreSQL 17.11. Client PostgreSQL 17.11 was previously checked. Native PostgreSQL remains the chosen workflow; no Docker, new paid project or extra hosted project is required.

The [preparation script](../scripts/prepare-local-recovery-target.ps1) creates a unique folder under LocalApplicationData on a fixed NTFS drive, requires at least 1 GiB free and rejects redirected ancestors. Permissions are verified for owner, SYSTEM and Administrators only. It initializes a fresh PostgreSQL 17 cluster owned by mushavo_restore_admin, with UTF8/C locale, page checksums and SCRAM password authentication; no existing service/cluster files are changed. Native initdb password prompting avoids a plaintext password file or password on the command line. Owner privately saves this NEW LOCAL password for later operations.

Only 127.0.0.1 port 55439 is enabled. An occupied-port precheck stops before initialization; a later bind race remains possible and startup must then fail without stopping the other listener. The script starts its own data directory briefly, uses a read-only metadata probe and verifies actual data_directory/user/database/version, loopback address/port, parsed SCRAM rules and empty public/Auth/Storage scope. Shutdown targets only that new directory and verifies pg_ctl status 3 (not running). Startup/check errors still attempt shutdown of that same new cluster, never another PostgreSQL service. Artifacts remain private for review; no existing directory/database deletion is requested.

Successful result is NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED, with path/port/version/dependency metadata and a private target-preparation.json receipt. This is target readiness, not any export/restoration or full Supabase service recovery. Local sslmode=disable applies only to this password-authenticated loopback-only native target, not hosted connections.

Available pgcrypto and managed extension names are reported for scope planning, rather than assumed. Supabase Auth/Storage/Edge/provider services and managed-extension behavior are not recreated by merely starting native PostgreSQL. Exact compatible restore scope and any explicitly substituted bootstrap dependencies must be documented before the synthetic drill.

## Preparation validation and limits

Disposable embedded PostgreSQL probe checks PASS: empty/nonempty public/Auth/Storage metadata, private sentinel-value omission and read-only write rejection. This does not validate Windows ACL enforcement, native initdb prompting, executable startup, pg_ctl lifecycle or hosted dependencies. No PowerShell runtime exists in the root executor; owner execution supplies actual Windows evidence. No hosted/staging/production connection or customer records were accessed by these fixtures.

The owner handoff fetches the audit branch and reads pinned Git script/probe contents without checking out or changing the dirty Windows project. The nonsecret probe SQL is supplied temporarily through MUSHAVO_LOCAL_RECOVERY_PROBE_SQL and cleared afterward. Run in ordinary PowerShell. Initdb prompts for the new local password; psql prompts for it again. Send only the final metadata summary/redacted errors, not password or raw database/log content.

## Remaining work

| Work item | Status / acceptance |
|---|---|
| 1.4.1 Target and scope | Tools reported available; target preparation pending owner run |
| 1.4.2 Synthetic exports | Pending: guarded synthetic-only staging scope and dummy file, private hashes/manifest |
| 1.4.3 Restore and compare | Pending: separate target, selected records/schema/grants/RLS/file-byte checks and elapsed time |
| 1.4.4 Checkpoint report | Pending: passes, failures, substituted/missing dependencies and limits; no full live-recovery guarantee |

Production private artifacts remain separate owner-held completeness evidence. Source setting/key/provider/full-platform behavior and operational 24-hour targets are not proved by this synthetic drill. No outbound scheduler/mail/push deployment or Google upload is authorized by preparation.
