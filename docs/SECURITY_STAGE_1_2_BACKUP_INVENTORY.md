# 1.2 — External database and file protection

Started 7 October 2026 after owner-tested normal sign-ins completed in 1.1. Stage 1 remains in progress. Account recovery gaps are carried forward; no provider recovery test or full F08 closure is inferred.

## Current scope and starting facts

Owner baseline: Supabase Free, no owner-held external database/uploaded-file backups and no separate staging project. F16 remains open. S1E09 records the completed Windows executable-version check. S1E12 records the owner choice to use standalone PostgreSQL command-line tools for exports. S1E13 records the received 13-row owner inventory: deployed PostgreSQL 17.6 and aggregate scope are known. S1E14 prepares discovery/installation of compatible PostgreSQL 17.x Windows clients; their actual availability and versions remain pending. No export, restore, package install, local stack, account setting or production write has been performed.

For a recoverable backup we must account for database schema/data/roles and privileges, uploaded file bytes and their database metadata, and separately inventoried Auth/platform/Edge/provider configuration dependencies. Supabase's database-backup guidance distinguishes Storage metadata from actual object bytes and recommends off-site exports for Free projects. The earlier Supabase CLI route has defaults/managed-schema exclusions that differ from standalone PostgreSQL tools. The selected standalone export's actual schema/data/role/privilege/managed scope must be designed explicitly; no CLI flags/defaults are blindly copied. Actual PostgreSQL version and required Auth/Storage coverage must be reconciled before preparing exports.

## First owner check — installed tool versions

Paste the PowerShell block below directly in the existing terminal. It does not need a directory change and uses `npm.cmd` to avoid the blocked `npm.ps1` wrapper. Each discovered executable is called only with `--version`. The output contains tool status/version, not credentials or project data. Missing commands are recorded rather than automatically installed.

The source is [scripts/security-stage-1-tool-inventory.ps1](../scripts/security-stage-1-tool-inventory.ps1). The owner supplied successful Windows execution results on 7 October (S1E09). No PowerShell runtime exists in the audit workspace; no local Windows execution is claimed. The original block is retained below for reproducibility, not as a repeat check request.

```powershell
& {
    foreach ($mushavoTool in @(
        "node", "npm.cmd", "git", "docker", "pg_dump", "psql", "supabase"
    )) {
        $mushavoCommand = Get-Command -Name $mushavoTool `
            -CommandType Application -ErrorAction SilentlyContinue |
            Select-Object -First 1

        $mushavoStatus = "NOT ON PATH"
        $mushavoVersion = ""

        if ($mushavoCommand) {
            try {
                $mushavoOutput = & $mushavoCommand.Source --version 2>&1
                $mushavoExitCode = $LASTEXITCODE

                if ($mushavoExitCode -eq 0) {
                    $mushavoStatus = "FOUND"
                    $mushavoVersion = ($mushavoOutput | Out-String).Trim()
                } else {
                    $mushavoStatus = "VERSION CHECK FAILED"
                }
            } catch {
                $mushavoStatus = "VERSION CHECK FAILED"
            }
        }

        [pscustomobject]@{
            Tool = $mushavoTool
            Status = $mushavoStatus
            Version = $mushavoVersion
        }
    }
} | Format-Table -Wrap -AutoSize
```

`NOT ON PATH` means no matching executable was found in this shell. It does not prove that an npm-local/cached CLI or non-PATH PostgreSQL installation is absent. If Supabase is normally invoked through `npx.cmd`, report that separately; this check intentionally does not invoke a package runner that could download a CLI. Docker CLI presence does not prove a running/compatible container engine or identify its target. Report results before choosing a backend/export path.

## Owner results — S1E09

| Executable | Observed status | Version |
|---|---|---|
| node | FOUND | v22.17.0 |
| npm.cmd | FOUND | 10.9.2 |
| git | FOUND | git version 2.55.0.windows.3 |
| docker | FOUND | Docker version 29.6.2, build dfc4efb |
| pg_dump | NOT ON PATH | Not established |
| psql | NOT ON PATH | Not established |
| supabase | FOUND | 2.106.0 |

The executable inventory completed at owner-tested scope. No version check failed. The repository devDependency pins Supabase CLI 2.116.0; this is distinct from the owner's PATH-resolved 2.106.0. No automatic upgrade, dependency edit or assumption that the installed CLI supports every current documented flag follows. PostgreSQL executable absence on PATH is not a backup failure, and Docker's `--version` does not prove engine readiness. No backup/restore PASS is inferred.

## Earlier engine/help results — S1E11 (historical)

Owner output on 7 October selects `desktop-linux`, but `docker version` returns client 29.6.2, no server version and a missing `dockerDesktopLinuxEngine` named pipe. **FAIL at selected-engine readiness scope / container export path BLOCKED.** The cause is not established: Docker Desktop may be stopped, still starting or unable to initialize. CLI installation remains proven separately; a missing pipe is not a hosted Supabase database failure.

Bare `supabase db dump --help` selected the npm `supabase.ps1` wrapper and was blocked by PowerShell's execution policy before the CLI help ran. **CLI options NOT VERIFIED / wrapper invocation BLOCKED**, not an absent executable or failed export. The assistant's original bare-command instruction was incorrect for the already known PowerShell policy. The corrected block resolves an Application executable exactly as the successful version inventory did, avoiding the `.ps1` wrapper; use this or an explicitly available `.cmd`/`.exe` for future CLI instructions. No policy weakening or automatic CLI upgrade is requested.

## Selected export route — S1E12

Owner instruction on 7 October: **use PostgreSQL command**. Use Windows PostgreSQL client tools directly for database exports; Docker startup and Supabase CLI dump/help are no longer prerequisites for this selected export route. S1E11's engine failure and wrapper blocker remain historical evidence, not repaired PASS. Docker's role in any later optional local staging proposal is a separate decision; no container-based environment is assumed or started.

The planned tools are `pg_dump` for selected database content, `pg_dumpall` for the selected global-role scope where permitted, `pg_restore` for archive inspection/isolated recovery and `psql` for read-only connection checks and selected script recovery. These are not yet verified as installed/compatible. The original probe found pg_dump/psql not on PATH, which does not rule out a non-PATH installation.

Prefer the deployed server's supported major version for the Windows clients and isolated recovery target. PostgreSQL documents that pg_dump refuses a server newer than its own major version; a newer client's output is also not guaranteed to restore to an older server. Establish the actual hosted version before selecting a client download/installation. PostgreSQL's official Windows download page links to supported EDB installers and binary archives; installing a local server is not required merely to run clients against Supabase. Exact available-client paths, versions and help/options must be checked before preparing exports. No automatic installation or change to the native project dependencies is performed by this decision.

Database connection host/port/username will come from the intended project's Dashboard Connect panel. Prefer a supported direct connection, or reconcile session-pooler fallback for an IPv4-only owner network; do not guess the pooler host or use a transaction-pooler URL for a dump. Credentials, SSL certificate/verification settings, selected scope and owner-held protected destination remain export prerequisites. No connection string or password is requested in this inventory handoff.

## Owner deployed inventory — S1E13

Owner attachment `Pasted text(8).txt`, SHA-256 `10a2c41d21d6956d6c33aba32f1e09338930a53f93b75c16d74bd34016a89aaa`, reports the expected **12 INFO + 1 REVIEW** at 2026-10-07 11:56:22.695585 UTC (13:56:22.695585 Africa/Johannesburg). It is an owner-run metadata inventory, not 13 security PASS results. The read-only/repeatable-read labels are present; intended project identity follows the owner's handoff context and is not independently proved by catalog output. Full parsed technical metadata is retained in Stage 1 evidence, without attachment/customer bytes or secrets.

| Observed scope | Result |
|---|---|
| PostgreSQL | 17.6 / server_version_num 170006 |
| Database disk size | 30,559,379 bytes, approximately 30.6 MB decimal; not export size |
| Non-system schemas | 11; public has 80 tables, 1 view and 281 routines; 80 RLS-enabled relations reported |
| Auth | 9 user records; no identities/credentials/session contents returned |
| Storage | 4 private bucket configurations; 2 object metadata records, both business-logos; 771,059 recorded bytes, no unknown sizes in those two records |
| Extensions | pg_cron, pg_net, pg_stat_statements, pgcrypto, plpgsql, supabase_vault, uuid-ossp with versions in evidence |
| Role/privilege indicators | 16 non-pg_ roles; 24 memberships; 27 default ACL records, plus explicit schema/relation/column/routine ACL indicators |
| Managed dependencies | 15 Storage object policy names; 9 non-internal trigger metadata records, including auth.users → public.handle_new_user_profile |
| Publications | supabase_realtime lists 28 tables; supabase_realtime_messages_publication lists 7; exact table mapping not retrieved |
| Scheduler/encryption/history | cron.job and vault.secrets present; pgsodium extension, queried migration-history table and supabase_functions schema absent in this metadata check |

These counts do not prove tenant authorization, file-byte integrity, exact grants, scheduler use or source/deployment parity. Platform trigger metadata is mixed with app customizations and requires classification. Empty object metadata in other buckets does not verify provider file-byte integrity. Vault presence requires explicit encrypted-secret/root-key recovery treatment; pgsodium absence does not establish that no encryption dependency exists. The absence of the queried migration-history table is not a failed application migration, but source/deployment parity remains to be reconciled in isolated staging. F16 remains open with no backup or restore result.

## Next owner check — PostgreSQL 17.x Windows clients (S1E14)

Select the supported PostgreSQL **17.x** Windows client major to match the deployed 17.6 server; the latest available stable 17.x client patch need not equal the server patch. First paste the block below directly into PowerShell to check the four required executables at the standard 17 installation path. Full `.exe` paths avoid the blocked script wrappers and do not require persistent PATH changes. Each invocation is `--version` only; there is no database connection, installation, server startup or export.

```powershell
& {
    $mushavoPgBin = "C:\Program Files\PostgreSQL\17\bin"
    foreach ($mushavoPgTool in @("pg_dump", "pg_dumpall", "pg_restore", "psql")) {
        $mushavoPgExe = Join-Path $mushavoPgBin "$mushavoPgTool.exe"
        if (-not (Test-Path $mushavoPgExe -PathType Leaf)) {
            Write-Output "MISSING: $mushavoPgExe"
            continue
        }
        & $mushavoPgExe --version
        if ($LASTEXITCODE -ne 0) { throw "$mushavoPgTool version check failed." }
    }
}
```

If all four print PostgreSQL 17.x versions, skip installation and send the output. `MISSING` means absent at the checked path, not absent everywhere; if a compatible installation is already in another location, set `mushavoPgBin` to its actual bin directory and rerun instead of reinstalling.

If tools are missing and no compatible existing installation is known:

1. Open [the official PostgreSQL Windows download page](https://www.postgresql.org/download/windows/) and follow its EDB installer link. Select the latest available stable **17.x** installer in the **Windows x86-64** column.
2. Keep the installation directory `C:\Program Files\PostgreSQL\17` for the supplied commands.
3. At **Select Components**, keep **Command Line Tools** selected and clear PostgreSQL Server, pgAdmin 4 and Stack Builder. EDB lists pg_dump, pg_dumpall, pg_restore and psql in this component. This is client setup for the existing hosted database; no local recovery server is configured here.
4. Complete installation and skip any Stack Builder launch. Report unexpected installer blockers rather than changing server/provider settings.
5. Rerun the same PowerShell block and send all four actual versions or the exact error. No password or connection string is needed for `--version` checks.

**Owner result — S1E15:** all four executables were reported MISSING at `C:\Program Files\PostgreSQL\17\bin`; no version executable ran. This confirms absence at that checked path, not every installation location. No compatible custom installation was supplied. Continue the prepared Command Line Tools installation or use a known compatible custom bin path, then report all four actual versions. No client setup/export PASS is inferred.

No local PowerShell runtime exists in the audit workspace, so these Windows instructions are reviewed/prepared, not locally executed. Owner client installation/version results remain pending. Before any export, still establish the actual Dashboard endpoint, SSL/credential handling, required schema/data/global-role/managed scope and owner-held protected off-site destination. Separate Storage file-byte and configuration exports remain required.

## Completed owner SQL handoff — retained for reproducibility


The owner supplied its results in S1E13. The original Dashboard handoff below is retained for reproducibility, not a repeat request. No engine startup or CLI help rerun is requested for the selected route.

The deployed SQL source is [security_stage_1_backup_inventory.sql](../supabase/diagnostics/security_stage_1_backup_inventory.sql). Copy it using the owner's established handoff below. Fetch/show does not merge, reset or change the original native checkout's tracked files.

```powershell
& {
    Set-Location "C:\Users\HP\Desktop\Mushavo Budget"

    git fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }

    git show "FETCH_HEAD:supabase/diagnostics/security_stage_1_backup_inventory.sql" |
        Out-String | Set-Clipboard
    if ($LASTEXITCODE -ne 0) { throw "SQL copy failed." }

    Write-Output "Read-only Stage 1.2 inventory SQL copied."
}
```

In the Supabase Dashboard, verify the intended project reference **kttkospkblwvguuwnhjj**; open SQL Editor, use its `postgres` role, create a new query, paste and run. Send the full result table (CSV is fine), or the exact error if it fails. Expected output is **13 inventory rows: 12 INFO and 1 REVIEW**. Those labels mean evidence collection, not successful protection or restore. Database/catalog metadata cannot independently prove the Dashboard project reference.

The SQL uses a repeatable-read, read-only transaction with 30-second statement and 3-second lock timeouts, then rolls back. It reports deployed PostgreSQL/database size, non-system schema/extension/role metadata, privilege indicators, Auth user count, bucket configuration, object counts/recorded sizes, managed trigger/policy metadata, publication indicators and presence of scheduler/encryption/migration dependencies. Missing or malformed object sizes stay explicit unknowns. It returns no user emails/IDs, file paths/contents, passwords, routine bodies, cron commands, webhook URLs or decrypted secret values. Standard Supabase Auth/Storage tables and owner SQL permissions are prerequisites; report errors instead of interpreting unavailable results as empty scope.

This metadata is not a full configuration inventory. Auth/SMTP/Edge/provider settings, precise grants, custom managed definitions, encryption keys and actual object integrity remain separate dependencies. Each export's data/role/managed-schema behavior will be checked against actual CLI options and deployed version; a successful default schema dump is not complete recovery coverage.

## Local validation — S1E10

[verify-security-stage-1-backup-inventory.cjs](../scripts/verify-security-stage-1-backup-inventory.cjs) executes the diagnostic against disposable PGlite PostgreSQL fixtures, with no network or hosted credentials. It checks the 13-row INFO/REVIEW contract, read-only/repeatable-read context, counts, empty inventories, invalid/missing/negative/oversized size metadata, managed trigger/policy indicators, omission of seeded private values and rejection of writes in a read-only transaction. The fixture passed; S1E11 records the historical engine/wrapper blockers; S1E12 selects standalone PostgreSQL exports. S1E13 separately records the owner-run deployed output; local fixture evidence remains its own scope. Neither result is a production backup or recovery test.

## Work after this inventory

1. Deployed version/aggregate scope is recorded; locate/verify compatible Windows pg_dump/pg_dumpall/pg_restore/psql clients using the prepared 17.x instructions. No dependency edits or Docker/CLI-help prerequisite is required for this selected route.
2. Reconcile exact export/grant/managed-object/encryption/configuration scope from the received metadata and separately needed owner checks. Future SQL handoffs retain the PowerShell fetch/show/clipboard format; do not infer complete coverage from this aggregate inventory.
3. Prepare compatible standalone PostgreSQL database export and separately authorized file-byte export paths. Require explicit target identity, connection method, completeness scope and separate credentials handling; do not embed credentials in pasted history, git or reports.
4. Agree owner-held protected off-site storage, recovery targets, frequency/retention and completion/failure records using actual size/volume. Prepare concrete commands only after these dependencies are known. A schema file or object metadata alone is insufficient.
5. Review owner-held artifact counts, scope/integrity and incomplete-run detection. Isolated restore proof is step 1.4; a live production restore is not part of this work.

Only redacted outcome/size/date/completeness records enter the repository. Customer database/file bytes and recovery credentials stay with the owner. An export that succeeds without its required scope stays incomplete, not PASS.

## Primary guidance checked 7 October 2026

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase local CLI/container prerequisites](https://supabase.com/docs/guides/local-development)
- [Supabase CLI backup/restore and separate managed-schema/Edge/file recovery](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Docker client/server version checks](https://docs.docker.com/reference/cli/docker/version/)

- [PostgreSQL pg_dump and version compatibility](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_dumpall and global-role scope](https://www.postgresql.org/docs/current/app-pg-dumpall.html)
- [Official PostgreSQL Windows client distribution entry point](https://www.postgresql.org/download/windows/)
- [Supabase database connection modes and SSL](https://supabase.com/docs/guides/database/connecting-to-postgres)

- [EDB Windows component selection and command-line tools](https://www.enterprisedb.com/docs/supported-open-source/postgresql/installing/windows/)
- [PostgreSQL 17 pg_dump scope/compatibility](https://www.postgresql.org/docs/17/app-pgdump.html)
