# 1.2 — External database and file protection

Started 7 October 2026 after owner-tested normal sign-ins completed in 1.1. Stage 1 remains in progress. Account recovery gaps are carried forward; no provider recovery test or full F08 closure is inferred.

## Current scope and starting facts

Owner baseline: Supabase Free, no owner-held external database/uploaded-file backups and no separate staging project. F16 remains open. S1E09 records the completed Windows executable-version check. Next are Docker engine/CLI option checks and an owner-run read-only SQL inventory; no export, restore, package install, local stack, account setting or production write is requested.

For a recoverable backup we must account for database schema/data/roles and privileges, uploaded file bytes and their database metadata, and separately inventoried Auth/platform/Edge/provider configuration dependencies. Supabase's database-backup guidance distinguishes Storage metadata from actual object bytes and recommends off-site exports for Free projects. Its default CLI dump is not a complete data/role export and excludes managed schemas. Exact tool flags, actual PostgreSQL version and required Auth/Storage coverage must be reconciled before preparing exports.

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

## Engine/help results — S1E11

Owner output on 7 October selects `desktop-linux`, but `docker version` returns client 29.6.2, no server version and a missing `dockerDesktopLinuxEngine` named pipe. **FAIL at selected-engine readiness scope / container export path BLOCKED.** The cause is not established: Docker Desktop may be stopped, still starting or unable to initialize. CLI installation remains proven separately; a missing pipe is not a hosted Supabase database failure.

Bare `supabase db dump --help` selected the npm `supabase.ps1` wrapper and was blocked by PowerShell's execution policy before the CLI help ran. **CLI options NOT VERIFIED / wrapper invocation BLOCKED**, not an absent executable or failed export. The assistant's original bare-command instruction was incorrect for the already known PowerShell policy. The corrected block resolves an Application executable exactly as the successful version inventory did, avoiding the `.ps1` wrapper; use this or an explicitly available `.cmd`/`.exe` for future CLI instructions. No policy weakening or automatic CLI upgrade is requested.

## Next owner checks — engine recovery/options and deployed scope

Open **Docker Desktop** from the Windows Start menu and wait until its Linux engine is running, then run the block below. If Desktop cannot start or shows a WSL/virtualization error, report that exact message; no reset, reinstall, container removal or Windows feature change is requested from this observation alone. Starting Desktop is an owner startup action, separate from the read-only probes; no Supabase stack is started by these commands.

`docker version` queries the selected engine; no context change, image pull or Supabase connection is requested. CLI help must come from the installed Application executable rather than a blocked PowerShell script or auto-fetching package runner. Its version is checked again to identify the executable used for help.

```powershell
docker context show
docker version --format 'Client={{.Client.Version}}; Server={{.Server.Version}}; OS={{.Server.Os}}; Arch={{.Server.Arch}}'

$mushavoSupabaseCommand = Get-Command -Name supabase -CommandType Application -ErrorAction Stop |
    Select-Object -First 1
& $mushavoSupabaseCommand.Source --version
& $mushavoSupabaseCommand.Source db dump --help
```

Report all output, including any engine error. Help can be checked while engine recovery is unresolved. The Dashboard SQL inventory below is also independent of Docker and local PowerShell CLI wrappers; its owner result remains pending. Expected successful engine output includes a nonempty server version and `OS=linux`. This readiness result alone would not prove a complete export.

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

[verify-security-stage-1-backup-inventory.cjs](../scripts/verify-security-stage-1-backup-inventory.cjs) executes the diagnostic against disposable PGlite PostgreSQL fixtures, with no network or hosted credentials. It checks the 13-row INFO/REVIEW contract, read-only/repeatable-read context, counts, empty inventories, invalid/missing/negative/oversized size metadata, managed trigger/policy indicators, omission of seeded private values and rejection of writes in a read-only transaction. The fixture passed; S1E11 records selected Docker engine readiness failure and the help-wrapper blocker, while hosted execution remains pending. This is SQL preparation evidence, not a production backup or recovery test.

## Work after this inventory

1. Establish exact tool versions and execution path; inspect any existing npm-local Supabase CLI without auto-fetching or altering the original native checkout. Check container runtime/target only if the selected method needs it.
2. Obtain the deployed PostgreSQL version, selected schema/role scope and aggregate Storage/configuration inventory using the read-only diagnostic above. SQL handoffs remain PowerShell fetch → `git show "FETCH_HEAD:<path>" | Out-String | Set-Clipboard` → owner manual Supabase paste. Hosted results remain pending.
3. Choose compatible database export and authorized file-byte export paths. Require explicit target identity, connection method, completeness scope and separate credentials handling; do not embed credentials in pasted history, git or reports.
4. Agree owner-held protected off-site storage, recovery targets, frequency/retention and completion/failure records using actual size/volume. Prepare concrete commands only after these dependencies are known. A schema file or object metadata alone is insufficient.
5. Review owner-held artifact counts, scope/integrity and incomplete-run detection. Isolated restore proof is step 1.4; a live production restore is not part of this work.

Only redacted outcome/size/date/completeness records enter the repository. Customer database/file bytes and recovery credentials stay with the owner. An export that succeeds without its required scope stays incomplete, not PASS.

## Primary guidance checked 7 October 2026

- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase CLI database dump](https://supabase.com/docs/reference/cli/supabase-db-dump)
- [Supabase local CLI/container prerequisites](https://supabase.com/docs/guides/local-development)
- [Supabase CLI backup/restore and separate managed-schema/Edge/file recovery](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
- [Docker client/server version checks](https://docs.docker.com/reference/cli/docker/version/)
