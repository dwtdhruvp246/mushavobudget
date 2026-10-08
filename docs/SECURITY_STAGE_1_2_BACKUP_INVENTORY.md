# 1.2 — External database and file protection

Started 7 October 2026 after owner-tested normal sign-ins completed in 1.1. Stage 1 remains in progress. Account recovery gaps are carried forward; no provider recovery test or full F08 closure is inferred.

> **Standing owner decision — S1E40:** Google Drive backup troubleshooting/upload/download is **DEFERRED**. Earlier Google commands below are historical and are not current execution requests. Keep existing local artifacts/private passphrase protected; no local/cloud cleanup is requested. Local export/encryption PASS remain, while verified offsite copy, earlier cloud scope/privacy and full coverage/recovery stay open for final remediation/re-audit. Stage 1.2 remains in progress.

## Current scope and starting facts

Owner baseline: Supabase Free, no owner-held external database/uploaded-file backups and no separate staging project. F16 remains open. S1E09 records the completed Windows executable-version check. S1E12 records the owner choice to use standalone PostgreSQL command-line tools for exports. S1E13 records the received 13-row owner inventory: deployed PostgreSQL 17.6 and aggregate scope are known. S1E14 prepares discovery/installation of compatible PostgreSQL 17.x Windows clients; S1E15 records earlier standard-path absence. S1E16 now records owner-executed PASS for all four full-path clients at 17.11. S1E17 supplies displayed Dashboard session-pooler connection fields. S1E18 prepares the certificate-verified connection check; S1E19 now records owner execution PASS with the intended endpoint and TLS 1.3. S1E20 records the owner choice of Google Drive for the encrypted off-site copy; S1E21 prepares the encryption-tool check; S1E22 records the prior 24.09 patch gap; S1E23 now records completed owner executable/library 26.04 recheck PASS. S1E24 prepares the dummy-file encryption/header-privacy/recovery check; S1E25 now records owner execution with all three PASS lines, scoped to public dummy data/passwords. S1E26 records owner confirmation of Google two-step verification and the Restricted owner-only Drive folder; S1E27 prepares the separate local folder/DACL/capacity handoff. S1E28 now records completed owner private local folder/DACL PASS, 28.12 GiB free, and owner reports of about 10 GB Drive space and enabled disk encryption. S1E29 prepares the first custom database archive and offline checks; S1E30 now records completed owner export/offline-read PASS. S1E31 prepares private database-component encryption and local extracted-file verification; S1E32 now records completed owner PASS for the real 566,080-byte, three-file encrypted package. S1E33 prepares manual Drive upload/download and private local archive checking; S1E34 records rejection of a selected folder-named ZIP before copying/testing. S1E35 clarifies that error and prepares uploaded-item scope inspection and the single-.7z correction. S1E36 records a repeated rejection for the same bundle basename now ending .7z; S1E37 prepares a small read-only size/format/candidate diagnostic. S1E38 now completes it: current 7z marker, 1,212,733 bytes and no expected-name Downloads candidate, confirming a different artifact. S1E39 prepares exact original/private-hash-bound clipboard selection and categorical owner scope/key-status reports. S1E40 supersedes that current request: the owner defers Google backup work, with those handoffs retained as history. Private credential storage, actual cloud upload scope, offsite integrity and precise recovery coverage remain pending/carry-forward. No production connection/export/restore, local stack or account setting has been performed by the audit agent; client availability and the database component follow owner execution.

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

The planned tools are `pg_dump` for selected database content, `pg_dumpall` for the selected global-role scope where permitted, `pg_restore` for archive inspection/isolated recovery and `psql` for read-only connection checks and selected script recovery. S1E16 verifies all four full-path executable versions as 17.11, matching the deployed 17.6 server major. Their connection/options/export/restore behavior is not established by --version. The original probe found pg_dump/psql not on PATH; that earlier PATH result is retained separately from current full-path availability.

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

## Completed client discovery/setup handoff — S1E14–S1E16

The original handoff below is retained for reproducibility; S1E16 supplies the successful owner results. No repeat check or installation is requested.

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

No local PowerShell runtime exists in the audit workspace, so these Windows instructions are reviewed/prepared, not locally executed. S1E16 supplies the owner-executed version results below. Before any export, still establish the actual Dashboard endpoint, SSL/credential handling, required schema/data/global-role/managed scope and owner-held protected off-site destination. Separate Storage file-byte and configuration exports remain required.

## Current client results and connection preparation — S1E16

The owner reruns the full-path check at `C:\Program Files\PostgreSQL\17\bin` and reports:

| Tool | Actual version | Result scope |
|---|---|---|
| pg_dump | 17.11 | OWNER-TESTED version PASS |
| pg_dumpall | 17.11 | OWNER-TESTED version PASS |
| pg_restore | 17.11 | OWNER-TESTED version PASS |
| psql | 17.11 | OWNER-TESTED version PASS |

All four clients are available at the checked path and their major matches the received server 17.6 inventory. S1E15's earlier missing-path observation remains historical. PATH registration, installer component selection, database authentication, SSL, actual supported options and exports/restores are not certified by version output. No repeat version or installation check is requested.

**Completed field-collection handoff:** open the intended Supabase project **kttkospkblwvguuwnhjj**, click **Connect** and select **Session pooler**. This is the planned IPv4-compatible session route; the owner's network capability and any direct endpoint connection have not been tested. Supabase recommends direct connections for native backup commands and documents session mode as the alternative for IPv4-only networks. Copy the actual host, port, database and username shown in that panel, or send a crop showing those fields. Keep `[YOUR-PASSWORD]` as a placeholder and omit any real password, API key or secret. Do not run the copied URI or change database/provider settings during this field collection. The pooler host must come from the panel; it cannot be guessed from the region. Transaction-pooler mode is not selected for this dump route.

S1E17 now supplies the fields and S1E18 prepares the connection check below with explicit SSL server verification and owner-local password entry. SSL certificate trust/hostname compatibility must be reconciled for the selected endpoint; `sslmode=require` alone is not server verification. No connection is attempted by this documentation update. Selected export completeness, protected owner-held off-site destination, separate Storage bytes and configuration recovery remain pending. F16 is still open.

## Displayed endpoint and prepared connection check — S1E17–S1E18

The owner screenshot displays a Shared pooler panel with the session-mode IPv4 banner and these fields:

| Field | Displayed value |
|---|---|
| Host | aws-0-eu-central-1.pooler.supabase.com |
| Port | 5432 |
| Database | postgres |
| Username | postgres.kttkospkblwvguuwnhjj |

The username contains the intended project reference, but a screenshot is not authenticated connectivity/target proof. The password stays a placeholder. Only these non-secret metadata and the screenshot SHA-256 are retained; the raw image is excluded from git. No connection or provider change has occurred.

**Completed certificate/connection handoff — retained for reproducibility:** in the intended project, open **Database Settings → SSL Configuration → Download certificate** and save the server root certificate locally. Supabase's official psql guide uses the downloaded root certificate with session-pooler `sslmode=verify-full`. This handoff does not enable/change SSL enforcement (a distinct provider setting). Paste the following block directly into the existing PowerShell terminal; it asks for the certificate's full local path, then psql prompts for the **database password** privately. The source is [security-stage-1-connection-check.ps1](../scripts/security-stage-1-connection-check.ps1); use the inline block to retain the owner's existing execution policy.

```powershell
& {
    $mushavoPsql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
    if (-not (Test-Path -LiteralPath $mushavoPsql -PathType Leaf)) {
        throw "PostgreSQL psql.exe was not found at the verified path."
    }

    $mushavoCertInput = (Read-Host "Full path to the downloaded Supabase certificate").Trim().Trim('"')
    if (-not (Test-Path -LiteralPath $mushavoCertInput -PathType Leaf)) {
        throw "Certificate file was not found. Send the error and file path only."
    }
    $mushavoCertPath = (Resolve-Path -LiteralPath $mushavoCertInput -ErrorAction Stop).ProviderPath
    $mushavoCertValue = $mushavoCertPath.Replace('\', '/').Replace("'", "\'")

    $mushavoConnection = @(
        "host=aws-0-eu-central-1.pooler.supabase.com"
        "port=5432"
        "dbname=postgres"
        "user=postgres.kttkospkblwvguuwnhjj"
        "sslmode=verify-full"
        "sslrootcert='$mushavoCertValue'"
        "gssencmode=disable"
        "connect_timeout=15"
        "application_name=mushavo_stage_1_2_connection"
    ) -join " "

    & $mushavoPsql --no-psqlrc --password --set=ON_ERROR_STOP=1 `
        --dbname $mushavoConnection --command '\conninfo'
    if ($LASTEXITCODE -ne 0) {
        throw "Connection check failed. Send the error output without any password."
    }

    Write-Output "Connection check completed. Send the connection and TLS output."
}
```

`\conninfo` is a psql client command that reports current connection metadata, including SSL details; it is not an application SQL query. `--no-psqlrc` skips user/system startup commands and `--command` makes psql exit after this one command. The actual Dashboard endpoint is explicit; the certificate is resolved as a local file, normalized/escaped as a quoted libpq value, and certificate-chain plus hostname verification is required. GSS encryption is disabled for this check so TLS is the selected transport. The 15-second value bounds connection setup, not an entire future export. No password is embedded in the command, environment or script. Nonzero psql exit is preserved as a failed check; no weaker SSL retry or database password reset is requested.

Send only the connection/TLS output or exact error. These outcomes were pending at preparation; S1E19 below supplies the completed owner execution. No repeat connection check is requested. The audit workspace has no PowerShell, psql or libpq runtime, so this block is prepared/reviewed against official documentation rather than locally executed. Future actual SQL retains the owner's fetch/show/clipboard/manual SQL Editor handoff. No backup artifact, app-table query/write, protected off-site storage result or restore follows from preparing this command. Precise database/role/managed/encryption coverage, separate Storage bytes and configuration recovery remain required before F16 can close.

## Current owner connection result — S1E19

The owner pastes the complete prepared block and completed output. Local `prod-ca-2021.crt` path checking/resolution succeeds; psql requests the database password privately, displays the expected database/user/host/port and returns to the normal PowerShell prompt with the completed message and no error. **OWNER-TESTED certificate-verified connection metadata PASS**: database postgres, user postgres.kttkospkblwvguuwnhjj, host aws-0-eu-central-1.pooler.supabase.com, port 5432; TLSv1.3 / TLS_AES_256_GCM_SHA384, compression off, ALPN none. The supplied command uses verify-full with the downloaded root certificate; no weaker retry is observed. Password/certificate bytes are not received or committed.

This confirms the owner-local client-to-session-pooler connection at the supplied-command scope. The audit agent did not connect, the provider-internal pooler-to-database transport is not independently inspected, and SQL privileges/tenant authorization/dump completeness/recovery are not tested by connection metadata. No production SQL or export was run. The version and connection prerequisites now pass; no repeat setup/check is requested.

**Completed destination-choice handoff:** identify the existing off-site destination for an encrypted backup copy: owner-controlled cloud storage (for example Google Drive/OneDrive) with verified protected account access, or an external drive kept at a separate physical location. Also settle protected local export storage outside the repository/served assets, encryption/access and recovery-secret storage before customer backup bytes are written. A proposed path or successful connection is not an artifact-protection result.

The selected export coverage still needs these separately reviewable components:

| Component | Preparation and remaining evidence |
|---|---|
| Application database | Complete intended schema/data, indexes, routines, triggers, RLS/ACLs and dependencies; reconcile exact inclusion against the 11-schema inventory. Do not call a public-only or schema-only dump complete. |
| Auth and Storage database metadata | Account/identity and required Storage records, plus classified application customizations on managed schemas; preserve platform/application distinction for recovery. Never apply a blanket platform-schema restore to production. |
| Roles and privileges | Preserve accessible role attributes/memberships, object/default/column grants and ownership evidence; separate provider roles and private login-secret recovery. Counts alone do not prove coverage. |
| Vault, scheduler and publications | Vault encryption/root-key recovery, approved cron configuration/secret dependencies and exact publication mappings; presence alone is not configured-use proof. Keep sensitive values owner-held. |
| Storage object bytes | Download/inventory all intended objects separately, verify count/size/hash and changes/incomplete transfers; metadata totals do not protect actual files. |
| Auth/Edge/provider configuration | Source plus import maps/deno configuration, private secret/configuration recovery and actual deployed SMTP/Auth/hosting settings; database exports do not cover all provider settings. |

Next prepare concrete PostgreSQL/file commands against that selected scope and protected destination, preserving failed/partial runs and final completeness records. Frequency, retention and acceptable data-loss/downtime targets remain owner decisions. Only redacted outcome/scope/size/date evidence enters git; real backup data stays owner-held. F16 and isolated restore proof remain open.

## Destination choice and completed tool-discovery handoff — S1E20–S1E22

The owner accepts **Google Drive** for the encrypted off-site copy. This is a destination choice, not evidence of protected account access, private sharing, capacity, a complete upload or a recoverable artifact. No Drive account is accessed, folder created or file uploaded by the audit agent. The plan keeps raw working exports in a separately protected owner-local directory outside the repository/served assets and synced folders; a directory under LOCALAPPDATA is proposed, with actual path/ACL/space/disk protection to verify before writing backup bytes.

Use 7-Zip's 7z AES-256 encryption for the planned portable package, with encrypted filenames and an owner-held strong recovery passphrase saved independently of the archive. First establish the actual Windows executable/version before preparing flags or customer data exports. The official Windows x64 installer currently lists **26.04 (5 October 2026)**; do not infer an installed version from the download page or automatically replace an existing tool. The probe source is [security-stage-1-encryption-tool-check.ps1](../scripts/security-stage-1-encryption-tool-check.ps1). Paste it directly into PowerShell; it reads executable information only and creates no export/archive or password prompt:

```powershell
& {
    $mushavo7ZipCommand = Get-Command -Name "7z.exe" `
        -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1

    $mushavo7ZipCandidates = @(
        "C:\Program Files\7-Zip\7z.exe"
        "C:\Program Files (x86)\7-Zip\7z.exe"
    )
    if ($mushavo7ZipCommand) {
        $mushavo7ZipCandidates += $mushavo7ZipCommand.Source
    }

    $mushavo7ZipPath = $mushavo7ZipCandidates |
        Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } |
        Select-Object -First 1

    if (-not $mushavo7ZipPath) {
        Write-Output "7-ZIP NOT FOUND at the checked paths or on PATH."
        return
    }

    Write-Output "Executable: $mushavo7ZipPath"
    $mushavo7ZipInfo = & $mushavo7ZipPath i 2>&1
    $mushavo7ZipExitCode = $LASTEXITCODE
    if ($mushavo7ZipExitCode -ne 0) {
        throw "7-Zip information check failed with exit code $mushavo7ZipExitCode."
    }
    $mushavo7ZipInfo | Select-Object -First 6
}
```

Send the executable/header output or exact error. Missing means absent at these checked paths/PATH, not every custom location. If no known existing installation is found, download the official **Windows x64 .exe** from [7-zip.org](https://www.7-zip.org/), install using its default directory, and rerun the same inline block. Do not invoke a blocked .ps1 wrapper or change execution policy. No PowerShell runtime is present in the audit workspace; this Windows probe is prepared/reviewed, not locally executed. S1E22 supplies the information result below; no repeat discovery is needed. Actual encryption/header privacy, correct/wrong-passphrase behavior and archive integrity need a synthetic check after the required security update; a successful information probe alone is not encryption PASS.

**Owner destination preparation:** create an owner-private **Mushavo Budget Backups** folder in Google Drive, verify General access is Restricted and unintended accounts/groups have no access. Report whether the actual Google account has two-step verification enabled, without sharing codes/keys/passphrases. Account/folder evidence remains pending; Google access is not inferred from earlier Cloudflare/Google sign-in. Confirm sufficient capacity before upload. The concrete upload procedure follows a verified encrypted archive, then a separately downloaded copy must match the recorded SHA-256 and decrypt/test successfully. Upload completion alone does not prove recovery; no real backup archive is attached to chat or git.

Database/file/configuration completeness from S1E19 remains required; encryption does not fill missing coverage. Selected plaintext working artifacts/partial runs remain protected, and cleanup follows verified successful packaging/copy checks. Export scheduling, retention and recovery targets are still undecided. F16 remains open with no export, encrypted archive, upload or restore result.

## Historical encryption-tool patch gap and update handoff — S1E22

The owner information probe returns **7-Zip 24.09 x64 (29 November 2024)** at `C:\Program Files\7-Zip\7z.exe`, with `7z.dll` also 24.09. The command completes without the scripted error. **OWNER-TESTED information/version PASS**, not an encryption-capability or recovery PASS.

**Security update prerequisite:** official release history records symbolic-link extraction fixes in 25.00 (CVE-2025-11001/CVE-2025-11002), further hardening in 25.01 (CVE-2025-55188), and later 26.x archive-handler/extraction fixes. The then-installed 24.09 predates those fixes; S1E23 below supersedes this installed-version gap. The official current Windows x64 installer is **26.04, released 5 October 2026**, checked 7 October. Record this as a patch GAP and update before backup archive creation/test/recovery work. The information command processes no archive; this finding does not show compromise or a broken AES implementation.

Owner closes any open 7-Zip windows, downloads the current **Windows x64 .exe** from [the official download page](https://www.7-zip.org/download.html), and installs to the established `C:\Program Files\7-Zip` directory. Then paste this short known-path information check and report its header/library output:

```powershell
& {
    $mushavo7ZipInfo = & "C:\Program Files\7-Zip\7z.exe" i 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "7-Zip information check failed. Send the error."
    }
    $mushavo7ZipInfo | Select-Object -First 6
}
```

Expected current header is 26.04; verify the reported library version too rather than inferring update completion from installer UI. Unexpected installer/path/version errors stay explicit. No installation or archive processing occurs in the audit workspace, and no Windows runtime execution is claimed. The earlier script remains the reproducible discovery source; a full discovery or dependency reinstall is not requested.

The user has not yet reported Google account two-step verification or the Drive backup folder's actual privacy/capacity. They remain **UNCONFIRMED**, not disabled/failed. Continue the already prepared private-folder/account checks without requesting codes or recovery secrets. Protected local work location, safe encryption/passphrase handling, synthetic encryption/integrity checks, selected complete database/file/configuration exports and real upload/download proof remain pending. F16 stays open with no backup or restore artifact.

## Completed updated version and synthetic encryption handoff — S1E23–S1E25

The owner completed the short known-path recheck: **7-Zip 26.04 x64 (5 October 2026)** and its DLL both report **26.04**, with no scripted error and a normal PowerShell prompt. **OWNER-TESTED version/update information PASS**; S1E22's installed-version patch gap is superseded. No repeat installation or information check is requested. This is not binary-authenticity, encryption or recovery verification.

The owner has now completed the [synthetic encryption check](../scripts/security-stage-1-encryption-synthetic-check.ps1) by pasting its inline block into PowerShell (S1E25). The reproducible source below creates a unique directory under the owner's LOCALAPPDATA, writes a fixed dummy text file, and uses explicitly public dummy correct/wrong passwords. **These passwords are test fixtures and must never protect real backups.** No production database, repository files, customer data, Google account or real recovery secret is accessed. Files are retained for review; no recursive cleanup or upload occurs.

The check requires successful archive creation, correct-password technical listing with 7zAES/encrypted metadata, wrong-password listing failure without the dummy filename, wrong-password archive-test failure, correct-password integrity/extraction success, and an exact SHA-256 match with the original dummy file. Exit codes are checked immediately; native fatal code 2 is expected only for the two intentional wrong-password operations. Other outcomes remain failures. The block's local Continue preference permits inspection of those expected native errors; filesystem/hash operations use terminating error handling.

```powershell
& {
    # Public dummy data/passwords only. Never use this password for real backups.
    $ErrorActionPreference = "Continue"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) {
        throw "Verified 7-Zip executable was not found."
    }

    $mushavoTestParent = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($mushavoTestParent)) {
        throw "Local application-data directory was not found."
    }
    $mushavoTestRoot = Join-Path $mushavoTestParent `
        ("MushavoBudget-Audit-Test-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoTestRoot -ErrorAction Stop | Out-Null
    $mushavoSource = Join-Path $mushavoTestRoot "dummy.txt"
    $mushavoArchive = Join-Path $mushavoTestRoot "dummy.7z"
    $mushavoRestored = Join-Path $mushavoTestRoot "restored"
    Set-Content -LiteralPath $mushavoSource -Encoding UTF8 -ErrorAction Stop `
        -Value "Mushavo Budget synthetic encryption test. No customer data."

    Push-Location -LiteralPath $mushavoTestRoot -ErrorAction Stop
    try {
        $mushavoOutput = & $mushavo7Zip a -t7z -mhe=on `
            -pMushavo-DUMMY-Only-1 $mushavoArchive "dummy.txt" 2>&1
        if ($LASTEXITCODE -ne 0) {
            $mushavoOutput | Write-Output
            throw "Dummy archive creation failed."
        }

        $mushavoListing = & $mushavo7Zip l -slt `
            -pMushavo-DUMMY-Only-1 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Correct-password listing failed." }
        $mushavoListingText = $mushavoListing | Out-String
        if ($mushavoListingText -notmatch "7zAES" -or
            $mushavoListingText -notmatch "(?m)^Encrypted = \+\r?$") {
            throw "Expected encrypted payload metadata was not reported."
        }

        $mushavoWrongListing = & $mushavo7Zip l -slt `
            -pMushavo-DUMMY-Wrong-2 $mushavoArchive 2>&1
        $mushavoWrongListingExit = $LASTEXITCODE
        if ($mushavoWrongListingExit -ne 2 -or
            (($mushavoWrongListing | Out-String) -match "dummy\.txt")) {
            throw "Wrong-password filename-protection check failed."
        }

        $mushavoOutput = & $mushavo7Zip t `
            -pMushavo-DUMMY-Wrong-2 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 2) { throw "Wrong-password rejection check failed." }

        $mushavoOutput = & $mushavo7Zip t `
            -pMushavo-DUMMY-Only-1 $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Correct-password integrity check failed." }

        $mushavoOutput = & $mushavo7Zip x `
            -pMushavo-DUMMY-Only-1 "-o$mushavoRestored" $mushavoArchive 2>&1
        if ($LASTEXITCODE -ne 0) { throw "Dummy extraction failed." }
        $mushavoSourceHash = (Get-FileHash -LiteralPath $mushavoSource `
            -Algorithm SHA256 -ErrorAction Stop).Hash
        $mushavoRestoredHash = (Get-FileHash -LiteralPath `
            (Join-Path $mushavoRestored "dummy.txt") `
            -Algorithm SHA256 -ErrorAction Stop).Hash
        if ($mushavoSourceHash -ne $mushavoRestoredHash) {
            throw "Restored dummy file hash does not match."
        }

        Write-Output "PASS: Dummy archive created; payload reports 7zAES/encrypted."
        Write-Output "PASS: Wrong password cannot list dummy filename or test archive."
        Write-Output "PASS: Correct password tests archive; restored SHA-256 matches."
        Write-Output "Synthetic files retained at: $mushavoTestRoot"
    } finally {
        Pop-Location
    }
}
```

**Completed owner result — S1E25:** all three PASS lines are returned, including 7zAES/encrypted payload metadata, wrong-password filename/integrity rejection and correct-password integrity/extraction with identical restored SHA-256. The retained synthetic directory is `C:\Users\HP\AppData\Local\MushavoBudget-Audit-Test-b984d6c3ac374488b2913c195841341c`. **OWNER-TESTED synthetic encryption/extraction PASS**; no repeat test is requested. The audit agent has no PowerShell or 7-Zip runtime and has not retrieved the files or raw hashes. This proves the checked owner dummy-file/tool behavior, not real backup completeness, private-passphrase recovery or database restore. Real packaging will use separate owner-held recovery credentials with safe entry, independently verified local/cloud protection and complete selected database/file/configuration coverage.

S1E26 below supersedes the unreported Google two-step/folder settings at owner-confirmation scope. Drive capacity and actual artifact/upload/download proof remain pending. No real backup/encrypted upload or restore has been created/verified; F16 remains open.

## Completed cloud settings confirmation and local working folder — S1E26–S1E28

The owner answers **yes** to both explicit questions: the selected Google account has two-step verification enabled, and **Mushavo Budget Backups** exists with **General access: Restricted**, access limited to the owner. Record **OWNER-CONFIRMED protection settings**. No repeat question or screenshot is required merely to re-establish these reports. The audit agent has not accessed Google, inspected its account/folder via API, or performed a fresh sign-in/recovery drill. Capacity and real upload/download integrity remain unverified.

Next paste [the local backup-folder block](../scripts/security-stage-1-local-backup-folder.ps1) into normal PowerShell. It resolves LOCALAPPDATA, requires a fixed NTFS drive and rejects reparse-point ancestors, then creates one new unique empty directory. It replaces only that new directory's DACL with protected inheritable FullControl rules for the current Windows user, SYSTEM and Administrators, re-reads the actual owner/rules, and reports the path and free GiB. Existing directories/permissions and the dirty Windows repository remain untouched; no administrator shell or execution-policy change is requested. If any filesystem/CIM/permission check fails, stop and report the exact error; no export is attempted into an unverified folder.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoLocalBase = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($mushavoLocalBase)) {
        throw "Local application-data directory was not found."
    }
    $mushavoDriveRoot = [IO.Path]::GetPathRoot($mushavoLocalBase)
    if ($mushavoDriveRoot -notmatch "^[A-Za-z]:\\$") {
        throw "Expected a local Windows drive. Send the error."
    }
    $mushavoDriveId = $mushavoDriveRoot.Substring(0, 2)
    $mushavoDisk = Get-CimInstance -ClassName Win32_LogicalDisk `
        -Filter "DeviceID='$mushavoDriveId'"
    if (-not $mushavoDisk -or $mushavoDisk.DriveType -ne 3 -or
        $mushavoDisk.FileSystem -ne "NTFS") {
        throw "A fixed NTFS drive is required for this private folder."
    }
    $mushavoParent = Get-Item -LiteralPath $mushavoLocalBase -Force
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Local path has a redirected directory. Send the error."
        }
        $mushavoParent = $mushavoParent.Parent
    }

    $mushavoBackupRoot = Join-Path $mushavoLocalBase `
        ("MushavoBudget-Private-Backup-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoBackupRoot | Out-Null
    Write-Output "Backup working folder: $mushavoBackupRoot"

    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @(
        $mushavoOwnerSid.Value,
        "S-1-5-18",
        "S-1-5-32-544"
    )
    $mushavoAcl = [Security.AccessControl.DirectorySecurity]::new()
    $mushavoAcl.SetOwner($mushavoOwnerSid)
    $mushavoAcl.SetAccessRuleProtection($true, $false)
    foreach ($mushavoSidValue in $mushavoAllowedSids) {
        $mushavoSid = [Security.Principal.SecurityIdentifier]::new($mushavoSidValue)
        $mushavoRule = [Security.AccessControl.FileSystemAccessRule]::new(
            $mushavoSid,
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit",
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        )
        $mushavoAcl.AddAccessRule($mushavoRule)
    }
    Set-Acl -LiteralPath $mushavoBackupRoot -AclObject $mushavoAcl

    $mushavoCheck = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoCheck.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoCheck.AreAccessRulesProtected -or
        $mushavoCheck.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne
            $mushavoOwnerSid.Value -or $mushavoRules.Count -ne 3) {
        throw "Folder owner or protected permission count did not match."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or
            $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permission. Send the error."
        }
    }

    Write-Output "PASS: New local NTFS folder; permissions limited to your user, SYSTEM and Administrators."
    Write-Output ("Local free space (GiB): " +
        [math]::Round([double]$mushavoDisk.FreeSpace / 1GB, 2))
    Write-Output "Folder is empty. No database export or cloud upload was performed."
}
```

**Completed owner result — S1E28:** block returns private directory `C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342`, the checked NTFS/owner/protected inheritable DACL PASS, **28.12 GiB free**, and empty-folder/no-export/no-upload output. Owner also reports approximately **10 GB free in Drive** and **yes** to Windows device/BitLocker encryption being enabled. No repeat folder creation or capacity/encryption question is requested. Space is time-specific and disk-encryption status is owner-reported, not a cipher/protection/key-recovery inspection. The audit workspace has no Windows/PowerShell runtime; the audit agent did not execute the block or access the folder. A successful DACL check would limit normal filesystem access to the listed identities; administrators/SYSTEM remain authorized, and this does not prove at-rest encryption, endpoint security or exclusion from separately configured sync/backup software.

The requested Drive-space and enabled disk-encryption reports are now received in S1E28; independent encryption/recovery-key protection and actual artifact/upload results are not inferred. Keep raw working files local and upload only the separately verified encrypted package. Private backup-passphrase creation/entry/independent recovery, exact database/managed/role/Vault/file/configuration coverage, incomplete-run detection and actual export/upload/download/isolated restore remain pending. The folder is empty at preparation: F16 stays open and no real backup is created.

## Completed first database export handoff — S1E29–S1E30

The local folder/DACL, compatible clients and certificate-verified endpoint now have owner execution evidence; Google protection/disk encryption/capacity have the separately stated owner-report scopes. Prepare the **first logical database component** in that protected local directory. This is a raw custom PostgreSQL archive; owner-reported disk encryption and the rechecked DACL protect its local working location. It will be separately packaged with a private recovery passphrase before any Drive upload. Those outcomes were pending at preparation; S1E30 below records the completed export. Portable encryption remains pending until the S1E31 handoff is executed.

The selected `pg_dump` has **no schema/table/extension/data filters**, no no-owner/no-ACL flags, no weakened row-security option and no database restore command. It requests default non-system-schema/data/large-object and ownership/privilege/dependency scope for one database; extension-owned objects/configuration data follow PostgreSQL's rules. Global role definitions/tablespaces, foreign-table data not explicitly selected, actual Storage object bytes, Vault/root-key recovery and deployed Auth/SMTP/Edge/provider settings still require separate coverage. Catalog counts alone cannot certify all those contents. This first component is not labeled a complete platform backup.

Paste [the database-export block](../scripts/security-stage-1-database-export.ps1) into the normal PowerShell window. It re-reads the existing exact owner/DACL, reuses the known client/certificate paths and endpoint with verify-full, and uses the native **database password prompt**. No password is added to the connection string, arguments, environment or files. UTC/GUID names prevent overwriting earlier runs. Dump failures/interruptions retain `.partial.dump`; no automatic exclusion or privileged-grant repair masks errors. The 30-second lock wait bounds initial shared-lock acquisition, not the total export duration. Report any native warnings as review evidence.

After zero exit and a nonempty archive, `pg_restore --list` operates **offline**, keeps the TOC privately and requires core public/Auth/Storage data markers. A second **offline** `pg_restore --file=NUL` decodes/renders archive payload to the Windows null device with no database name/connection arguments. SQL is discarded, never shown in chat or run against a database. This is an archive-read check, not a restore, semantic integrity test or completeness proof. Only after checks pass is `.partial.dump` renamed `.database.dump`, with private TOC/manifest containing bytes, UTC, SHA-256 and public data-entry count.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
    $mushavoRestore = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
    $mushavoCert = "C:\Users\HP\Desktop\Mushavo Budget\prod-ca-2021.crt"
    foreach ($mushavoRequiredFile in @($mushavoDump, $mushavoRestore, $mushavoCert)) {
        if (-not (Test-Path -LiteralPath $mushavoRequiredFile -PathType Leaf)) {
            throw "Required local file missing: $mushavoRequiredFile"
        }
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer -or
        ($mushavoFolder.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected the verified local backup directory."
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }

    $mushavoRun = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ") + "-" + [guid]::NewGuid().ToString("N")
    $mushavoPartial = Join-Path $mushavoBackupRoot "$mushavoRun.partial.dump"
    $mushavoFinal = Join-Path $mushavoBackupRoot "$mushavoRun.database.dump"
    $mushavoTocFile = Join-Path $mushavoBackupRoot "$mushavoRun.toc.txt"
    $mushavoManifest = Join-Path $mushavoBackupRoot "$mushavoRun.manifest.json"
    $mushavoCertPath = (Resolve-Path -LiteralPath $mushavoCert).ProviderPath
    $mushavoCertValue = $mushavoCertPath.Replace('\', '/').Replace("'", "\'")
    $mushavoConnection = @(
        "host=aws-0-eu-central-1.pooler.supabase.com"
        "port=5432"
        "dbname=postgres"
        "user=postgres.kttkospkblwvguuwnhjj"
        "sslmode=verify-full"
        "sslrootcert='$mushavoCertValue'"
        "gssencmode=disable"
        "connect_timeout=15"
        "application_name=mushavo_stage_1_2_export"
    ) -join " "

    Write-Output "Database password is entered only at pg_dump's password prompt."
    Write-Output "Output remains partial until the local archive checks succeed."
    Write-Output "Partial output path: $mushavoPartial"
    $ErrorActionPreference = "Continue"
    & $mushavoDump --format=custom --lock-wait-timeout=30000 --password `
        --dbname $mushavoConnection --file $mushavoPartial
    $mushavoDumpExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoDumpExit -ne 0) {
        throw "Database export failed (exit $mushavoDumpExit). Keep the partial file; send the error without secrets."
    }
    if ((Get-Item -LiteralPath $mushavoPartial).Length -le 0) {
        throw "Database export file is empty."
    }

    $ErrorActionPreference = "Continue"
    $mushavoToc = & $mushavoRestore --list $mushavoPartial
    $mushavoListExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoListExit -ne 0) { throw "Archive listing failed; file stays partial." }
    $mushavoToc | Set-Content -LiteralPath $mushavoTocFile -Encoding UTF8
    $mushavoTocText = $mushavoToc | Out-String
    foreach ($mushavoExpected in @("TABLE DATA public ", "TABLE DATA auth users ",
        "TABLE DATA storage buckets ", "TABLE DATA storage objects ")) {
        if (-not $mushavoTocText.Contains($mushavoExpected)) {
            throw "Expected archive entry missing: $mushavoExpected. File stays partial."
        }
    }
    # Offline SQL rendering validates archive payload decoding. No database is connected.
    $ErrorActionPreference = "Continue"
    & $mushavoRestore --file=NUL $mushavoPartial
    $mushavoReadExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoReadExit -ne 0) { throw "Archive payload read failed; file stays partial." }

    Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
    $mushavoFile = Get-Item -LiteralPath $mushavoFinal
    $mushavoHash = (Get-FileHash -LiteralPath $mushavoFinal -Algorithm SHA256).Hash
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.2"
        result = "DATABASE_EXPORT_AND_OFFLINE_ARCHIVE_READ_PASS"
        project = "kttkospkblwvguuwnhjj"
        completed_utc = [DateTime]::UtcNow.ToString("o")
        file = $mushavoFinal
        bytes = $mushavoFile.Length
        sha256 = $mushavoHash
        public_table_data_entries = @($mushavoToc | Where-Object { $_ -match " TABLE DATA public " }).Count
        auth_users_and_storage_metadata_present = $true
        encrypted_7z_package_created = $false
        global_roles_storage_file_bytes_provider_config_complete = $false
        isolated_restore_verified = $false
    }
    $mushavoSummary | ConvertTo-Json | Set-Content -LiteralPath $mushavoManifest -Encoding UTF8
    $mushavoSummary | Format-List
    Write-Output "Keep these files in the private local folder. Send only this summary and any warnings."
}
```

Send **only the final summary and any redacted warning/error**, never the dump/TOC/generated SQL, passwords, real row data or private keys. No warning is silently cleared because native exit is zero. Keep raw artifacts in the verified local working directory; only a later checked encrypted package may be uploaded. Do not run a production restore from the archive. The workspace lacks Windows/PostgreSQL runtime: source/flag/credential/scope handling was reviewed/prepared here, and S1E30 separately supplies the owner-executed result. Remaining exact catalog/managed/role/foreign/encryption/file/configuration coverage and isolated synthetic recovery remain open; F16 stays open.

## Completed database component result — S1E30

The owner supplies `DATABASE_EXPORT_AND_OFFLINE_ARCHIVE_READ_PASS` completed **2026-10-07T18:11:03.7896753Z**, project `kttkospkblwvguuwnhjj`: **2,109,566 bytes**, **80 public table-data entries**, with expected Auth users and Storage metadata present. The dump is `20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database.dump` inside the verified private local folder. This completes the S1E29 export/core-marker/offline-read handoff at owner execution scope. The audit agent receives no artifact, TOC, generated SQL or customer bytes.

SHA-256 is intentionally **owner-withheld**, retained in the private local manifest and compared locally by the next block. No hash disclosure is requested. Warnings were **not reported**, which is not independent evidence that none occurred. Encryption=false, complete global-role/Storage-file/provider coverage=false and isolated restore=false remain explicit. Offline archive reading does not execute SQL or prove successful database restoration; entry counts are not full row/object/extension coverage.

## Completed database-component encryption handoff — S1E31–S1E32

First generate a unique random backup passphrase of at least 20 characters and save it privately in a password manager or another protected recovery location separate from the Drive archive. Use that saved passphrase at each native 7-Zip prompt; do not leave it blank, reuse the database password, put it in the PowerShell block or send it here. Run directly in the normal interactive PowerShell terminal. Creation uses bare `-p`; testing/extraction omit that switch so encrypted-header reading asks for the password. Official console source distinguishes those modes and disables Windows console input echo. No real passphrase is stored in a PowerShell variable, command argument, environment or receipt.

The block packages **only this run's three explicit dump/TOC/manifest files**, after comparing the private dump hash and exact metadata locally. It creates a unique encrypted-header 7z partial package, requires correct-password integrity success and a random wrong-password header-listing failure without source filenames, then extracts exactly three copies inside a new child of the private folder and compares all original/extracted hashes. Only after those checks does it rename the archive and write a private verification receipt with archive/file hashes. It retains originals, local verification copies and failures; it performs no raw cleanup, database reconnect/restore or Drive upload. This is the database component, with separate file/global-role/configuration coverage still pending. The original at-export manifest remains unchanged, including its historical encrypted=false value.

Source: [security-stage-1-database-encryption.ps1](../scripts/security-stage-1-database-encryption.ps1). Execution was pending at preparation; S1E32 below supplies owner PASS. The audit workspace has no native PowerShell/7-Zip runtime. Source/inline equality, preserved events/tables, JSON/local links/fences and diff whitespace are checked; native prompt/exit/header/hash/partial behavior is reviewed against official source/manual.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoRun = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1"
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) {
        throw "Verified 7-Zip executable was not found."
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    $mushavoNames = @("$mushavoRun.database.dump", "$mushavoRun.toc.txt", "$mushavoRun.manifest.json")
    $mushavoFileRecords = @()
    foreach ($mushavoName in $mushavoNames) {
        $mushavoPath = Join-Path $mushavoBackupRoot $mushavoName
        $mushavoItem = Get-Item -LiteralPath $mushavoPath -Force
        if ($mushavoItem.PSIsContainer -or $mushavoItem.Length -le 0 -or
            ($mushavoItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected export file is missing, empty or redirected."
        }
        $mushavoFileRecords += [pscustomobject]@{
            name = $mushavoName
            bytes = $mushavoItem.Length
            sha256 = (Get-FileHash -LiteralPath $mushavoPath -Algorithm SHA256).Hash
        }
    }
    $mushavoManifestPath = Join-Path $mushavoBackupRoot "$mushavoRun.manifest.json"
    $mushavoManifest = Get-Content -LiteralPath $mushavoManifestPath -Raw | ConvertFrom-Json
    $mushavoDumpPath = Join-Path $mushavoBackupRoot "$mushavoRun.database.dump"
    if ($mushavoManifest.stage_step -ne "1.2" -or
        $mushavoManifest.result -ne "DATABASE_EXPORT_AND_OFFLINE_ARCHIVE_READ_PASS" -or
        $mushavoManifest.project -ne "kttkospkblwvguuwnhjj" -or
        $mushavoManifest.file -ne $mushavoDumpPath -or
        $mushavoManifest.bytes -ne 2109566 -or
        $mushavoFileRecords[0].bytes -ne $mushavoManifest.bytes -or
        $mushavoManifest.sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
        $mushavoFileRecords[0].sha256 -ne $mushavoManifest.sha256 -or
        $mushavoManifest.public_table_data_entries -ne 80 -or
        $mushavoManifest.auth_users_and_storage_metadata_present -ne $true) {
        throw "Local dump/manifest does not match the completed export. Hashes stay private."
    }
    $mushavoPackageRun = "$mushavoRun.database-component-" + [guid]::NewGuid().ToString("N")
    $mushavoPartial = Join-Path $mushavoBackupRoot "$mushavoPackageRun.partial.7z"
    $mushavoFinal = Join-Path $mushavoBackupRoot "$mushavoPackageRun.7z"
    $mushavoVerifiedFiles = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verified-files"
    $mushavoReceipt = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verification.json"
    Write-Output "Enter your saved, unique backup passphrase only at each 7-Zip prompt. Never enter a blank password."
    Write-Output "Partial encrypted package: $mushavoPartial"
    Push-Location -LiteralPath $mushavoBackupRoot
    try {
        # Bare -p invokes 7-Zip's native hidden-input prompt. No real password is in PowerShell.
        $ErrorActionPreference = "Continue"
        & $mushavo7Zip a -t7z -mhe=on -p $mushavoPartial @mushavoNames
        $mushavoCreateExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoCreateExit -ne 0) {
            throw "Encryption failed (exit $mushavoCreateExit). Keep partial files and report the error."
        }
        if ((Get-Item -LiteralPath $mushavoPartial).Length -le 0) { throw "Encrypted package is empty." }
        Write-Output "Enter the same saved passphrase to test the package."
        $ErrorActionPreference = "Continue"
        # Reading an encrypted archive without -p triggers the native password prompt.
        & $mushavo7Zip t $mushavoPartial
        $mushavoTestExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoTestExit -ne 0) { throw "Package integrity/password test failed; package stays partial." }

        # Random negative-test input only; this is never the real backup passphrase.
        $mushavoWrongProbe = "-p" + [guid]::NewGuid().ToString("N")
        $ErrorActionPreference = "Continue"
        $mushavoDeniedListing = & $mushavo7Zip l -slt $mushavoWrongProbe $mushavoPartial 2>&1
        $mushavoDeniedExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoDeniedExit -ne 2) { throw "Wrong-password header check failed; package stays partial." }
        $mushavoDeniedText = $mushavoDeniedListing | Out-String
        foreach ($mushavoName in $mushavoNames) {
            if ($mushavoDeniedText.Contains($mushavoName)) {
                throw "Wrong-password listing exposed a source filename; package stays partial."
            }
        }
        New-Item -ItemType Directory -Path $mushavoVerifiedFiles | Out-Null
        Write-Output "Enter the same saved passphrase to extract verification copies inside the private folder."
        $ErrorActionPreference = "Continue"
        & $mushavo7Zip x "-o$mushavoVerifiedFiles" $mushavoPartial
        $mushavoExtractExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoExtractExit -ne 0) { throw "Verification extraction failed; package stays partial." }
        if (@(Get-ChildItem -LiteralPath $mushavoVerifiedFiles -File -Recurse -Force).Count -ne 3) {
            throw "Expected exactly three extracted files; package stays partial."
        }
        foreach ($mushavoRecord in $mushavoFileRecords) {
            $mushavoOriginal = Join-Path $mushavoBackupRoot $mushavoRecord.name
            $mushavoExtracted = Join-Path $mushavoVerifiedFiles $mushavoRecord.name
            $mushavoOriginalHash = (Get-FileHash -LiteralPath $mushavoOriginal -Algorithm SHA256).Hash
            $mushavoExtractedHash = (Get-FileHash -LiteralPath $mushavoExtracted -Algorithm SHA256).Hash
            if ($mushavoOriginalHash -ne $mushavoRecord.sha256 -or
                $mushavoExtractedHash -ne $mushavoRecord.sha256) {
                throw "A source changed or an extracted file differs; package stays partial."
            }
        }
        Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
        $mushavoPackage = Get-Item -LiteralPath $mushavoFinal
        $mushavoPackageHash = (Get-FileHash -LiteralPath $mushavoFinal -Algorithm SHA256).Hash
        $mushavoSummary = [pscustomobject]@{
            stage_step = "1.2"
            result = "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS"
            project = "kttkospkblwvguuwnhjj"
            completed_utc = [DateTime]::UtcNow.ToString("o")
            file = $mushavoFinal
            bytes = $mushavoPackage.Length
            packaged_files = 3
            dump_matches_private_manifest = $true
            wrong_password_cannot_list_source_filenames = $true
            all_three_extracted_hashes_match = $true
            offsite_upload_download_verified = $false
            global_roles_storage_file_bytes_provider_config_complete = $false
            isolated_database_restore_verified = $false
        }
        [pscustomobject]@{
            summary = $mushavoSummary
            archive_sha256 = $mushavoPackageHash
            source_files = $mushavoFileRecords
            verified_files_directory = $mushavoVerifiedFiles
        } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $mushavoReceipt -Encoding UTF8
        $mushavoSummary | Format-List
        Write-Output "Keep originals, verification copies and receipt private. No upload or database restore was performed."
        Write-Output "Send only this summary and any warnings/errors. Do not send passwords, files or hashes."
    } finally {
        Pop-Location
    }
}
```

Send only the resulting metadata summary and any redacted warnings/errors, plus whether the backup passphrase is saved privately. Keep hashes, originals, verification receipt/copies, passwords and keys private. A successful file extraction is not an isolated database restore or complete platform backup. Upload instructions and offsite download/integrity checks follow the owner encryption result; F16 stays open.

## Completed encrypted database component — S1E32

The owner supplies `DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS`, completed **2026-10-07T18:26:23.3604019Z**, project `kttkospkblwvguuwnhjj`. The checked final archive is `20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731.7z` in the verified private folder, **566,080 bytes**, **three files**. Native output reports `LZMA2:3m 7zAES`, 336 header bytes, one solid block, 2,320,648 uncompressed bytes and `Everything is Ok`. The `.partial.7z` name in native test output precedes the handoff's checked rename; the final summary identifies the completed `.7z`.

| Owner-executed check | Result |
|---|---|
| Original dump matches its private manifest | PASS |
| Wrong password cannot list source filenames | PASS |
| Correct-password integrity and exactly three extracted files | PASS |
| All three source/extracted SHA-256 comparisons, with source hashes unchanged | PASS |
| Private recovery-passphrase storage | Not reported |
| Drive upload/download; complete role/file/provider coverage; isolated database restore | Pending |

This supersedes S1E31 owner execution pending at real component encryption/file verification scope. Artifact/hash/passphrase bytes remain owner-held. No warnings are reported; this does not independently establish that none occurred. File extraction is not SQL database restoration and this component is not complete platform backup evidence; F16 remains open.

## Drive copy/download handoff — S1E33; ZIP guidance clarified S1E35

Keep the backup passphrase saved privately and separately from the Drive archive. In the existing **Mushavo Budget Backups** folder on [Google Drive](https://drive.google.com/), use **New → File upload** for **only the final `.7z` identified above**, and wait until the upload completes. Raw dumps, TOC/manifest/verification receipts, extracted files and credentials stay in the private local working folder. Inspect the uploaded file's Share dialog and confirm **Restricted**, with only your account listed. Select that single uploaded file, right-click **Download**, and wait for a fresh browser download; retain the local original. These are owner browser steps, not an automated connector transfer or new sharing request.

Run the block below with the full path to that newly downloaded `.7z` (often in Downloads). It checks the original against its exact private receipt and rejects selecting the original path as the download. It retains an encrypted copy in a fresh private child directory, compares its hash locally, tests that downloaded archive with the saved passphrase at the native hidden-input prompt and writes a private receipt without printing hashes. It creates no plaintext extraction or database connection and deletes no original/download. A local path/hash cannot independently prove Google provenance or sharing: report explicit owner confirmation of the actual Drive upload/download, uploaded-file privacy and privately saved passphrase alongside the summary.

Source: [security-stage-1-drive-download-check.ps1](../scripts/security-stage-1-drive-download-check.ps1). Exact source/inline handoff, immutable evidence/tables, JSON/local links/fences and diff whitespace are checked. Manual UI instructions use official Google guidance; receipt/size/hash, native prompt, distinct-file/private-copy and exit ordering are reviewed. Windows execution remains owner pending, with no local PowerShell/7-Zip runtime.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoPackageRun = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731"
    $mushavoOriginal = Join-Path $mushavoBackupRoot "$mushavoPackageRun.7z"
    $mushavoReceipt = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verification.json"
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) {
        throw "Verified 7-Zip executable was not found."
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer -or
        ($mushavoFolder.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected the private local backup directory."
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    foreach ($mushavoPath in @($mushavoOriginal, $mushavoReceipt)) {
        $mushavoItem = Get-Item -LiteralPath $mushavoPath -Force
        if ($mushavoItem.PSIsContainer -or $mushavoItem.Length -le 0 -or
            ($mushavoItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Original archive or private verification receipt is missing, empty or redirected."
        }
    }
    $mushavoPrivateRecord = Get-Content -LiteralPath $mushavoReceipt -Raw | ConvertFrom-Json
    $mushavoOriginalHash = (Get-FileHash -LiteralPath $mushavoOriginal -Algorithm SHA256).Hash
    if ($mushavoPrivateRecord.summary.stage_step -ne "1.2" -or
        $mushavoPrivateRecord.summary.project -ne "kttkospkblwvguuwnhjj" -or
        $mushavoPrivateRecord.summary.result -ne "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS" -or
        $mushavoPrivateRecord.summary.file -ne $mushavoOriginal -or
        $mushavoPrivateRecord.summary.bytes -ne 566080 -or
        (Get-Item -LiteralPath $mushavoOriginal).Length -ne 566080 -or
        $mushavoPrivateRecord.summary.packaged_files -ne 3 -or
        $mushavoPrivateRecord.summary.all_three_extracted_hashes_match -ne $true -or
        $mushavoPrivateRecord.archive_sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
        $mushavoOriginalHash -ne $mushavoPrivateRecord.archive_sha256) {
        throw "Original archive does not match its completed private receipt. Hashes stay private."
    }

    $mushavoDownloadInput = (Read-Host "Full path to the newly downloaded Google Drive .7z file").Trim().Trim('"')
    $mushavoDownload = Get-Item -LiteralPath $mushavoDownloadInput -Force
    if ($mushavoDownload -is [IO.FileInfo] -and $mushavoDownload.Extension -eq ".zip") {
        throw "Selected a ZIP bundle. In Drive, download the single final .7z file. If the whole private working folder was uploaded, report that first; upload scope is unverified."
    }
    if ($mushavoDownload -isnot [IO.FileInfo] -or $mushavoDownload.Extension -ne ".7z" -or
        $mushavoDownload.Length -ne 566080 -or
        ($mushavoDownload.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected the completed 566080-byte downloaded .7z file."
    }
    if ($mushavoDownload.FullName -eq $mushavoOriginal) {
        throw "Select the new browser download, not the original local archive."
    }
    $mushavoCheckRoot = Join-Path $mushavoBackupRoot ("DriveCheck-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoCheckRoot | Out-Null
    $mushavoPrivateCopy = Join-Path $mushavoCheckRoot "$mushavoPackageRun.7z"
    Copy-Item -LiteralPath $mushavoDownload.FullName -Destination $mushavoPrivateCopy
    $mushavoDownloadedHash = (Get-FileHash -LiteralPath $mushavoPrivateCopy -Algorithm SHA256).Hash
    if ($mushavoDownloadedHash -ne $mushavoPrivateRecord.archive_sha256 -or
        (Get-FileHash -LiteralPath $mushavoOriginal -Algorithm SHA256).Hash -ne $mushavoOriginalHash) {
        throw "Downloaded bytes differ or the original changed. Keep files and report the error without hashes."
    }
    Write-Output "Enter your privately saved backup passphrase at the 7-Zip prompt."
    $ErrorActionPreference = "Continue"
    & $mushavo7Zip t $mushavoPrivateCopy
    $mushavoTestExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoTestExit -ne 0) {
        throw "Downloaded archive/password integrity test failed (exit $mushavoTestExit). Keep all files."
    }
    if ((Get-FileHash -LiteralPath $mushavoPrivateCopy -Algorithm SHA256).Hash -ne $mushavoDownloadedHash) {
        throw "Downloaded copy changed during checking."
    }
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.2"
        result = "DOWNLOADED_DATABASE_PACKAGE_HASH_AND_ARCHIVE_TEST_PASS"
        project = "kttkospkblwvguuwnhjj"
        completed_utc = [DateTime]::UtcNow.ToString("o")
        file = $mushavoPrivateCopy
        bytes = (Get-Item -LiteralPath $mushavoPrivateCopy).Length
        matches_private_original_receipt = $true
        downloaded_archive_password_test_passed = $true
        cloud_upload_download_provenance = "OWNER_BROWSER_ACTION_CONFIRMATION_REQUIRED"
        complete_platform_backup_created = $false
        isolated_database_restore_verified = $false
    }
    [pscustomobject]@{
        summary = $mushavoSummary
        archive_sha256 = $mushavoDownloadedHash
        owner_selected_download_path = $mushavoDownload.FullName
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath `
        (Join-Path $mushavoCheckRoot "download-verification.json") -Encoding UTF8
    $mushavoSummary | Format-List
    Write-Output "Send only this summary and redacted warnings/errors; confirm actual Drive upload/download and privately saved passphrase."
    Write-Output "Original files and the encrypted download remain retained. No database restore was performed."
}
```

Send only the metadata summary and redacted warnings/errors, plus the three owner confirmations above. Keep passphrase, hashes, archive, raw files and receipts private. Successful download/integrity establishes an offsite database-component copy at the stated owner-provenance scope; full global-role/managed/extension/foreign/Vault/Storage-byte/Auth/Edge/provider coverage, frequency/retention/recovery objectives and isolated synthetic recovery still need evidence. No complete-platform backup or F16 closure is claimed.

## Prior blocked download and upload-scope question — S1E34–S1E35

The owner runs the complete S1E33 block and selects `MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342-20261007T185032Z-1-001.zip` in Downloads. The expected `.7z` type/size guard rejects it. This happens before new private DriveCheck folder/copy, downloaded hash/7-Zip test or verification receipt; no offsite PASS follows. Original encrypted-component PASS from S1E32 remains intact. ZIP contents/size and actual Drive actions are unknown; this error does not establish damaged encryption or archive corruption.

The ZIP basename matches the local private **working folder**, which also contains raw database/TOC/manifest/verification files. That suggests a folder or multi-item bundle, and raises a concrete missing fact: **was only the final encrypted `.7z` uploaded, or the entire private working folder?** Do not infer raw-file upload or a breach from the name alone. Owner first opens the actual uploaded Drive items and reports that scope using only filenames/types; no archive/customer bytes, keys or hashes enter chat. No deletion/extraction/new-upload instruction is given while that scope is unresolved. If unintended raw copies exist, their actual scope/privacy and handling must be addressed before encrypted-only cloud protection can be accepted.

The local script now gives a specific `.zip` error before the unchanged guards (S1E35); the inline block above matches the refreshed source. Once correct upload scope is established, open the folder and select **the single** `20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731.7z`, right-click **Download**, and use the fresh `.7z` path in the local check. A ZIP wrapper is a different input and is not renamed or accepted as the checked 566,080-byte archive. Google transfer/sharing, saved passphrase, offsite integrity and full recovery coverage remain pending; F16 stays open. This is missing factual evidence, not a new permission request.

## Completed repeated file rejection and read-only diagnosis — S1E36–S1E38

The owner repeats the original S1E33 block and supplies the previous bundle basename with suffix `.7z`: `MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342-20261007T185032Z-1-001.7z`. The combined FileInfo/extension/length/reparse guard still rejects it before any private verification folder/copy/hash/archive test/receipt. The exact failing predicate, actual bytes and true format are unknown. The changed suffix suggests the ZIP may have been renamed, but that action/format is not established. Renaming an extension does not perform archive conversion, and converting a bundle would not produce a byte-identical copy of the original checked encrypted archive. Acceptance still requires the expected original private hash and integrity test; no size/type/hash guard is relaxed.

Run the small read-only diagnostic below for that exact owner-supplied file. It reads at most six initial bytes and prints a format hint, size and expected-name candidate count/list only. It does not display raw header/data/hash bytes, request a password, parse/extract archives or write files. A known signature is not proof of integrity, encryption or offsite provenance; any candidate still needs the original local hash/test checker. Source: [security-stage-1-download-format-check.ps1](../scripts/security-stage-1-download-format-check.ps1). Source/inline equality, unchanged history/tables, JSON/links/fences/diff and bounded read/disposal/output are checked; signatures use official 7-Zip source. Windows execution remains owner pending.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoSelectedPath = "C:\Users\HP\Downloads\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342-20261007T185032Z-1-001.7z"
    $mushavoExpectedBase = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731"
    $mushavoFile = Get-Item -LiteralPath $mushavoSelectedPath -Force
    if ($mushavoFile -isnot [IO.FileInfo] -or
        ($mushavoFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Expected an ordinary downloaded file at the supplied path."
    }
    $mushavoHeader = New-Object byte[] 6
    $mushavoStream = [IO.File]::OpenRead($mushavoFile.FullName)
    try {
        $mushavoRead = $mushavoStream.Read($mushavoHeader, 0, 6)
    } finally {
        $mushavoStream.Dispose()
    }
    $mushavoFormat = "Unrecognized prefix; format and integrity unverified"
    if ($mushavoRead -eq 6 -and
        [BitConverter]::ToString($mushavoHeader) -eq "37-7A-BC-AF-27-1C") {
        $mushavoFormat = "7z signature present; archive integrity not tested"
    } elseif ($mushavoRead -ge 4 -and
        [BitConverter]::ToString($mushavoHeader, 0, 4) -in @(
            "50-4B-03-04", "50-4B-05-06", "50-4B-07-08"
        )) {
        $mushavoFormat = "ZIP signature present; filename extension does not convert the format"
    }
    $mushavoCandidates = @(Get-ChildItem -LiteralPath $mushavoFile.DirectoryName `
        -File -Force -Filter "$mushavoExpectedBase*.7z")
    [pscustomobject]@{
        stage_step = "1.2"
        result = "READ_ONLY_DOWNLOAD_FORMAT_AND_SIZE_DIAGNOSTIC"
        selected_name = $mushavoFile.Name
        actual_bytes = $mushavoFile.Length
        expected_bytes = 566080
        size_matches_expected = ($mushavoFile.Length -eq 566080)
        format_hint = $mushavoFormat
        expected_named_download_candidates = $mushavoCandidates.Count
        files_modified_or_extracted = $false
        offsite_integrity_verified = $false
    } | Format-List
    if ($mushavoCandidates.Count -gt 0) {
        $mushavoCandidates | Select-Object Name, Length | Format-Table -Wrap -AutoSize
    } else {
        Write-Output "No download with the expected archive name was found in this Downloads directory."
    }
    Write-Output "Send only this metadata output. No password, hash or file contents are needed."
}
```

Send only the metadata/candidate rows. Also answer the outstanding scope question: **was only the final encrypted `.7z` uploaded to Drive, or the entire private local working folder?** File/customer bytes, passphrase and hashes remain private. No root cloud/raw-copy/compromise or offsite success is inferred. Original encrypted-component PASS remains S1E32; F16 stays open until actual component coverage/privacy/integrity and separate recovery requirements are met.

## Completed format/size result — S1E38

The owner executes the read-only diagnostic: the selected folder-named file has a **7z signature**, **1,212,733 bytes**, versus **566,080 expected**, with **zero expected-name encrypted archive candidates** in the selected Downloads directory. No files were modified/extracted and offsite integrity remains false. Size mismatch explains the rejection and confirms this is a different artifact. The current marker does not support simply treating it as a ZIP renamed by suffix; previous file format, creation/repacking history, payload validity/encryption/contents and cloud scope remain unknown. The earlier rename possibility is superseded at current-prefix scope only. No new archive validity/PASS or original component corruption follows.

## Prior exact original selection — S1E39; deferred by S1E40

The next correction selects the previously checked **original encrypted component**, without recompressing/converting/repackaging the working folder. Keep its backup passphrase saved privately and separately. The block below checks the exact original file against its private verification receipt and SHA-256, collects the two missing categorical owner reports, and copies **only its full path text** to the Windows clipboard. It does not copy file contents or upload/decrypt/delete anything. Unexpected/blank status responses remain UNSURE; it never asks for the real passphrase and does not print raw responses or hashes.

After the helper succeeds, open the existing private **Mushavo Budget Backups** Drive folder, choose **New → File upload**, paste the copied path into the Windows **File name** field and click **Open**. Wait for upload completion, then select that exact named file and right-click **Download** individually. This known encrypted-file upload is already authorized; previous unknown/whole-folder/raw cloud items remain separate scope/privacy follow-up before cloud protection acceptance. No cloud cleanup or other file upload is instructed. The strict original receipt/hash/downloaded-archive test still follows; path/size alone is not offsite proof.

Source: [security-stage-1-original-archive-selection.ps1](../scripts/security-stage-1-original-archive-selection.ps1). Exact source/inline equality, immutable events/original tables, JSON/local links/fences/diff and private-hash/categorical/path-only behavior are checked against Microsoft/Google guidance. Windows execution and actual selected-file transfer remain owner pending.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoPackageRun = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1.database-component-8135efd7cfce4f89b01da7296e864731"
    $mushavoArchive = Join-Path $mushavoBackupRoot "$mushavoPackageRun.7z"
    $mushavoReceipt = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verification.json"
    foreach ($mushavoPath in @($mushavoArchive, $mushavoReceipt)) {
        $mushavoItem = Get-Item -LiteralPath $mushavoPath -Force
        if ($mushavoItem -isnot [IO.FileInfo] -or $mushavoItem.Length -le 0 -or
            ($mushavoItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected the original archive and its private verification receipt."
        }
    }
    $mushavoRecord = Get-Content -LiteralPath $mushavoReceipt -Raw | ConvertFrom-Json
    $mushavoFile = Get-Item -LiteralPath $mushavoArchive
    $mushavoHash = (Get-FileHash -LiteralPath $mushavoArchive -Algorithm SHA256).Hash
    if ($mushavoFile.Length -ne 566080 -or
        $mushavoRecord.summary.stage_step -ne "1.2" -or
        $mushavoRecord.summary.project -ne "kttkospkblwvguuwnhjj" -or
        $mushavoRecord.summary.result -ne "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS" -or
        $mushavoRecord.summary.file -ne $mushavoArchive -or
        $mushavoRecord.summary.bytes -ne 566080 -or
        $mushavoRecord.summary.packaged_files -ne 3 -or
        $mushavoRecord.summary.all_three_extracted_hashes_match -ne $true -or
        $mushavoRecord.archive_sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
        $mushavoHash -ne $mushavoRecord.archive_sha256) {
        throw "Original archive does not match its private receipt. Keep files and send the error without hashes."
    }
    $mushavoScope = switch ((Read-Host "Previous Drive upload: 1=only final encrypted .7z; 2=whole private working folder; 3=unsure").Trim()) {
        "1" { "OWNER_REPORTED_ONLY_FINAL_ENCRYPTED_7Z" }
        "2" { "OWNER_REPORTED_WHOLE_PRIVATE_WORKING_FOLDER" }
        default { "UNSURE" }
    }
    $mushavoKeyStorage = switch ((Read-Host "Is the backup passphrase saved privately, separate from the archive? Reply YES/NO/UNSURE only; never enter the passphrase").Trim().ToUpperInvariant()) {
        "YES" { "OWNER_REPORTED_YES" }
        "NO" { "OWNER_REPORTED_NO" }
        default { "UNSURE" }
    }
    # Copy only path text, not the file or its contents.
    Set-Clipboard -Value $mushavoArchive
    [pscustomobject]@{
        stage_step = "1.2"
        result = "ORIGINAL_ARCHIVE_PRIVATE_HASH_MATCH_PATH_COPIED"
        file = $mushavoFile.Name
        bytes = $mushavoFile.Length
        matches_private_receipt = $true
        exact_upload_path_copied_to_clipboard = $true
        owner_reported_existing_drive_upload_scope = $mushavoScope
        owner_reported_private_passphrase_storage = $mushavoKeyStorage
        offsite_integrity_verified = $false
    } | Format-List
    Write-Output "In Drive use New > File upload, paste the copied path into File name and click Open."
    Write-Output "This helper made no archive changes, Drive upload, deletion or extraction. Send only the summary."
}
```

Send the helper's metadata summary and actual newly downloaded filename. Cloud scope and private-key retention are owner reports, not independent permissions/secret recovery proof. A WHOLE_PRIVATE_WORKING_FOLDER or UNSURE reply requires follow-up on earlier cloud items; the correct encrypted component may be prepared/transferred independently and does not erase those unknowns. No full platform backup/recovery or F16 closure is claimed.

## Current Google deferral and retained local evidence — S1E40

The owner asks to skip backing up in Google. **Google Drive upload/download/selection troubleshooting is DEFERRED now**; the prepared S1E39 helper is not requested, and no alternate provider or schedule is chosen. Historical wrong-input/different-archive findings and prepared instructions remain reproducible above with their dated scopes. No further Google prompt, file deletion, renaming, cloud cleanup or upload is part of this deferral.

The local single-database export/offline-read PASS (S1E30) and real encrypted-component/password/three extracted-hash checks PASS (S1E32) are preserved. Keep the original verified encrypted archive and local source/verification files protected, with the actual backup passphrase saved privately and separately. This instruction is not confirmation that storage/recovery is already evidenced.

Verified offsite protection remains **UNVERIFIED / Google work DEFERRED**. The unanswered earlier cloud upload scope/privacy and independent private passphrase retention are carried forward, not erased or converted to PASS. F16 stays open for the stage-end report and final remediation/re-audit: decide/resume a protected destination when that work is taken up, verify the correct component transfer/download integrity and reconcile any other cloud items. Separate exact local/global-role/managed/extension/foreign/Vault/Storage-byte/Auth/Edge/provider coverage still belongs to 1.2, and isolated synthetic restoration remains 1.4. Skipping Google does not skip those independent audit requirements or imply full backup completion.

## Prior local coverage handoff and remaining work — S1E41; completed in S1E42

The owner authorizes continuing and asks how much of 1.2 remains. The local database export/offline-read and real encrypted component/file-integrity checks are completed at their recorded scopes. **Four work groups remain**, excluding the currently deferred Google upload/download route; these groups are not equally sized tests/commands and do not justify an invented completion percentage.

| Remaining group | Needed evidence |
| --- | --- |
| Database and roles | Reconcile archive contents with source scope, managed customizations, extension/foreign/Vault dependencies; separately protect global role attributes/memberships and grant/ownership recovery dependencies. |
| Uploaded files | Retrieve and verify actual Storage object bytes; the earlier inventory reported two object metadata records, not two completed file downloads. Reconcile a consistent inventory, count/size/hash and changes/incomplete transfers. |
| Configuration and recovery credentials | Owner-held protected Auth/SMTP/Edge/provider recovery inventory, dependencies and separately retained credentials/key handling; no secrets or raw configuration sent to chat/git. |
| Backup operating decisions | Frequency, retention, acceptable data loss/recovery time and completion/failure records, with deferred/unverified offsite protection carried into final remediation/re-audit. |

The isolated synthetic database restore test is **1.4**, following isolated target preparation in **1.3**. It is not a new live production restore requirement at 1.2. Other provider/offsite/key-recovery gaps retain their existing carry-forward status and must not be silently cleared by moving steps.

The next block uses the **existing checked local component**. It checks the exact encrypted archive and its three local source files against the completed private receipt, reads the saved TOC and prints only aggregate object-category/schema counts. No PostgreSQL password, new export, archive extraction, database connection, file write, upload, cleanup or permission change occurs. Hashes and raw TOC/receipt contents remain private. It does not repeat the 7-Zip password test or create another package.

PostgreSQL documents that pg_dump covers one database, with global role definitions handled separately; extension members can be recreated by installing extensions, and foreign data requires explicit selection. Supabase distinguishes Storage metadata from actual object bytes. These are coverage dependencies to reconcile, not reasons to label every zero TOC category a failed backup. Listed table-data entries are not row counts; grant/publication/extension category counts do not prove exact definitions, effective access or working recovery.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoRun = "20261007T180751Z-216304be49af48c4b889640c8ab9cef1"
    $mushavoPackage = "$mushavoRun.database-component-8135efd7cfce4f89b01da7296e864731"
    $mushavoFolder = Get-Item -LiteralPath $mushavoRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoNames = @("$mushavoRun.database.dump", "$mushavoRun.toc.txt", "$mushavoRun.manifest.json")
    foreach ($mushavoName in ($mushavoNames + @("$mushavoPackage.7z", "$mushavoPackage.verification.json"))) {
        $mushavoItem = Get-Item -LiteralPath (Join-Path $mushavoRoot $mushavoName) -Force
        if ($mushavoItem -isnot [IO.FileInfo] -or $mushavoItem.Length -le 0 -or
            ($mushavoItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "A required local component file is missing, empty or redirected."
        }
    }
    $mushavoReceipt = Get-Content -LiteralPath (Join-Path $mushavoRoot "$mushavoPackage.verification.json") -Raw | ConvertFrom-Json
    $mushavoArchive = Join-Path $mushavoRoot "$mushavoPackage.7z"
    if ($mushavoReceipt.summary.stage_step -ne "1.2" -or
        $mushavoReceipt.summary.project -ne "kttkospkblwvguuwnhjj" -or
        $mushavoReceipt.summary.result -ne "DATABASE_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS" -or
        $mushavoReceipt.summary.file -ne $mushavoArchive -or
        $mushavoReceipt.summary.bytes -ne 566080 -or
        (Get-Item -LiteralPath $mushavoArchive).Length -ne 566080 -or
        $mushavoReceipt.summary.all_three_extracted_hashes_match -ne $true -or
        @($mushavoReceipt.source_files).Count -ne 3 -or
        $mushavoReceipt.archive_sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
        (Get-FileHash -LiteralPath $mushavoArchive -Algorithm SHA256).Hash -ne $mushavoReceipt.archive_sha256) {
        throw "Encrypted component does not match its private completed receipt. Hashes stay private."
    }
    foreach ($mushavoName in $mushavoNames) {
        $mushavoRecord = @($mushavoReceipt.source_files | Where-Object { $_.name -eq $mushavoName })
        $mushavoPath = Join-Path $mushavoRoot $mushavoName
        if ($mushavoRecord.Count -ne 1 -or
            $mushavoRecord[0].sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
            (Get-Item -LiteralPath $mushavoPath).Length -ne $mushavoRecord[0].bytes -or
            (Get-FileHash -LiteralPath $mushavoPath -Algorithm SHA256).Hash -ne $mushavoRecord[0].sha256) {
            throw "A local source file differs from the encrypted-component receipt. Hashes stay private."
        }
    }
    $mushavoTocPath = Join-Path $mushavoRoot "$mushavoRun.toc.txt"
    $mushavoEntries = @(foreach ($mushavoLine in (Get-Content -LiteralPath $mushavoTocPath)) {
        if ($mushavoLine -match '^\d+;\s+\d+\s+\d+\s+(.+)$') { $Matches[1] }
    })
    if ($mushavoEntries.Count -eq 0) { throw "No recognizable PostgreSQL TOC entries were found." }
    $mushavoPublicData = @($mushavoEntries | Where-Object { $_ -match '^TABLE DATA public ' }).Count
    if ($mushavoPublicData -ne 80) { throw "TOC no longer matches the reported 80 public table-data entries." }
    $mushavoSchemaRows = @(foreach ($mushavoSchema in @("public", "auth", "storage", "realtime", "cron", "vault", "extensions", "graphql", "graphql_public", "net", "pgbouncer")) {
        $mushavoEscapedSchema = [regex]::Escape($mushavoSchema)
        [pscustomobject]@{
            schema = $mushavoSchema
            table_definitions = @($mushavoEntries | Where-Object { $_ -match "^TABLE $mushavoEscapedSchema " }).Count
            table_data_entries = @($mushavoEntries | Where-Object { $_ -match "^TABLE DATA $mushavoEscapedSchema " }).Count
            routine_definitions = @($mushavoEntries | Where-Object { $_ -match "^(FUNCTION|PROCEDURE|AGGREGATE) $mushavoEscapedSchema " }).Count
            policies = @($mushavoEntries | Where-Object { $_ -match "^POLICY $mushavoEscapedSchema " }).Count
            triggers = @($mushavoEntries | Where-Object { $_ -match "^TRIGGER $mushavoEscapedSchema " }).Count
        }
    })
    $mushavoTocRecord = @($mushavoReceipt.source_files | Where-Object { $_.name -eq "$mushavoRun.toc.txt" })
    if ((Get-FileHash -LiteralPath $mushavoTocPath -Algorithm SHA256).Hash -ne $mushavoTocRecord[0].sha256) {
        throw "TOC changed during reading."
    }
    [pscustomobject]@{
        stage_step = "1.2"
        result = "LOCAL_VERIFIED_COMPONENT_TOC_COVERAGE_REVIEW"
        project = "kttkospkblwvguuwnhjj"
        checked_utc = [DateTime]::UtcNow.ToString("o")
        archive_and_three_sources_match_private_receipt = $true
        toc_entries = $mushavoEntries.Count
        table_data_entries_total = @($mushavoEntries | Where-Object { $_ -match '^TABLE DATA ' }).Count
        extension_definitions = @($mushavoEntries | Where-Object { $_ -match '^EXTENSION ' }).Count
        acl_entries = @($mushavoEntries | Where-Object { $_ -match '^ACL ' }).Count
        default_acl_entries = @($mushavoEntries | Where-Object { $_ -match '^DEFAULT ACL ' }).Count
        publication_definitions = @($mushavoEntries | Where-Object { $_ -match '^PUBLICATION - ' }).Count
        publication_table_entries = @($mushavoEntries | Where-Object { $_ -match '^PUBLICATION TABLE ' }).Count
        foreign_table_definitions = @($mushavoEntries | Where-Object { $_ -match '^FOREIGN TABLE ' }).Count
        large_object_related_entries = @($mushavoEntries | Where-Object { $_ -match '^(BLOB|BLOBS|BLOB METADATA|LARGE OBJECT|LARGE OBJECT DATA) ' }).Count
        complete_platform_backup_verified = $false
        isolated_database_restore_verified = $false
        files_modified_or_uploaded = $false
    } | Format-List
    $mushavoSchemaRows | Format-Table -AutoSize
    Write-Output "REVIEW: TOC counts are coverage indicators, not row counts or successful restore proof."
    Write-Output "Zero entries do not prove a schema is unnecessary; extension-owned objects can be supplied by installed extensions."
    Write-Output "Global role definitions, actual Storage file bytes and provider/key recovery still need separate coverage."
    Write-Output "Send only this summary/table and errors. Do not send TOC contents, hashes, receipts, backups or passwords."
}
```

Source: [security-stage-1-local-coverage-check.ps1](../scripts/security-stage-1-local-coverage-check.ps1). Owner execution of the original block is recorded in S1E42 below; S1E43 corrects the publication definition descriptor counter. No repeat full block or export is requested. Send only resulting summary/table and redacted warnings/errors. Do not send hashes, source files, TOC/receipt contents, real passwords or archives. A REVIEW result is expected: it supplies indicator metadata for the next reconciliation, not complete platform or restore PASS. Google remains deferred and no Google handoff is reactivated.

## Completed local count result and prior dependency handoff — S1E42–S1E43; received in S1E44

Owner S1E42 completes the S1E41 local check at **2026-10-07T19:45:48.9791986Z**. The encrypted archive and three source files match the private receipt; no hashes/files are supplied, no files changed/uploaded and no database restore occurred. **OWNER-TESTED local integrity PASS** is retained. The TOC supplies **2,322 entries**, **127 table-data entries**, **six extension entries**, **527 ACL entries**, **27 default ACL entries**, **29 publication-table entries**, zero foreign-table entries and zero large-object-related entries. Full platform backup and isolated restore are still false.

| Schema | Table definitions | Table-data entries | Routines | Policies | Triggers |
| --- | ---: | ---: | ---: | ---: | ---: |
| public | 80 | 80 | 281 | 151 | 140 |
| auth | 27 | 27 | 4 | 0 | 1 |
| storage | 8 | 8 | 19 | 15 | 7 |
| realtime | 10 | 9 | 17 | 0 | 1 |
| cron | 0 | 2 | 0 | 0 | 0 |
| vault | 0 | 1 | 0 | 0 | 0 |
| extensions | 0 | 0 | 6 | 0 | 0 |
| graphql | 0 | 0 | 0 | 0 | 0 |
| graphql_public | 0 | 0 | 1 | 0 | 0 |
| net | 0 | 0 | 0 | 0 | 0 |
| pgbouncer | 0 | 0 | 1 | 0 | 0 |

The 127 data-entry total reconciles to this table. Public/Auth/Storage table and routine aggregates, Realtime routine aggregates, 15 Storage policies, managed 1/7/1 trigger counts and 27 default ACL records match the earlier source indicators. These are count matches, not exact-row/definition/effective-access or restore proof. Cron/Vault definition-vs-data differences, six unnamed extensions, Realtime 10 definitions/9 data entries and Net zero require extension ownership/config-table/partition/persistence classification; none is automatically declared a failed backup.

**Counter correction:** the owner-reported `publication_definitions = 31` was calculated by a broad `^PUBLICATION ` prefix that also counted the 29 `PUBLICATION TABLE` entries. Preserve the raw owner result; label it a nonexclusive publication-related entry count, not 31 definitions. The helper/source-inline prefix is corrected to exact `^PUBLICATION - `, excluding mapping descriptors. Corrected owner TOC count is not reported; the earlier source inventory lists two publications. Do not assume schema mappings absent or infer exact restoration from subtracting aggregate counters. The query below independently reports actual source definition/direct mapping/schema mapping/expanded categories. No repeat export/encryption/full helper run is requested.

The current handoff is a **seven-row read-only source catalog query**: expected **6 INFO + 1 REVIEW**. It reports role attributes and exact membership flags/grantors, ownership totals, extension-owned/configuration table metadata, foreign/large-object counts and distinct publication categories. Names returned are database role/extension/table metadata; it reads no customer data or Auth user rows. Passwords, role-setting values, routine bodies, extension filter text, scheduler commands, Vault values and foreign option credentials are omitted. Missing/unavailable query results are errors to report, not zero/PASS. The source query uses a current repeatable-read snapshot, which is not the earlier export's same snapshot.

Run the following in the original Windows repository. It fetches the audit branch and copies only the intended SQL text, without checking out/merging or changing the dirty application/native files:

```powershell
& {
    Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
    git fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoRecoverySql = git show "FETCH_HEAD:supabase/diagnostics/security_stage_1_recovery_dependencies.sql" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoRecoverySql)) {
        throw "SQL retrieval failed."
    }
    $mushavoRecoverySql | Set-Clipboard
    Write-Output "Read-only 1.2 recovery dependency SQL copied. Paste into the intended Supabase SQL Editor."
}
```

Verify Dashboard project **kttkospkblwvguuwnhjj**, paste into its SQL Editor and run. Send the seven metadata rows or redacted errors. The transaction is read-only/repeatable-read, bounded by 30-second statement and 3-second lock timeouts, then rolled back. This query creates no backup or restore and changes no roles, grants or configuration. Google remains deferred.

The dedicated [recovery dependency fixture verifier](../scripts/verify-security-stage-1-recovery-dependencies.cjs) passes on disposable PGlite 0.5.8 / PostgreSQL 18.3. It exercises grant flags/ownership, direct/schema/expanded publication categories, zero/nonzero foreign/large-object counts, registered extension table/unlogged/filter metadata, empty publication inventories, private sentinel omission and rejected read-only writes. Its synthetic fixture setup mutates only the disposable test catalog, never hosted tables or the owner diagnostic. Owner PostgreSQL 17.6 execution was pending at S1E43 and is now received in S1E44 below. Source/member counts do not replace protected role/configuration artifacts or usable credential/key/Storage-byte recovery proof.

## Source result and prior private role-export handoff — S1E44–S1E45; completed in S1E46

Owner attachment `Pasted text(9).txt` supplies all **7 rows: 6 INFO + 1 REVIEW**, checked **2026-10-08T04:04:45.322523Z** on PostgreSQL **17.6** in read-only/repeatable-read context. This is successful owner source metadata execution, not seven security/backup PASS results. Existing local export/encryption/file-integrity PASS remains. Project identity follows owner context and the Dashboard requirement, not a SQL-proven project identity.

| Source result | Recovery implication |
| --- | --- |
| 16 non-pg roles; 24 memberships with exact grantor/admin/inherit/set flags | Role names match earlier inventory candidates; no additional non-pg role name appears. Preserve private role attributes/memberships, classify provider-managed authority/customizations and compare before any separate isolated restore. |
| 10 role/database-setting records; 1 parameter-ACL record | Values/scope split remain unreturned. Need protected artifacts and independent login credential recovery; record counts do not prove role/database-specific setting coverage. |
| Cron registers 4 relations: 2 tables + 2 sequences; Vault registers 1 secrets table; reported filters false | Extension ownership/configuration data explains why separate table definitions may be absent while data appears. Exact TOC entries/sequences/versions and Vault key usability remain unverified. |
| pg_net owns 3 unlogged relations, including 2 tables, with no registered configuration tables | Earlier zero Net TOC entries fit extension classification. Do not declare in-flight HTTP request/response data unnecessary; queue/replay/recovery treatment stays open. |
| Foreign tables/servers/user mappings/large objects all 0 | No extra foreign/large-object data component indicated in this current source snapshot; do not assert earlier exact snapshot or future absence. |
| 2 publications, 29 direct relation mappings, 35 expanded tables, 0 schema mappings | Reconciles the older 29 TOC table mappings and the mistaken broad 31-related-entry counter. Corrected owner TOC definition counter is not rerun. |
| Realtime has 1 partitioned + 9 ordinary relations | Consistent with 10 definitions/9 table-data entries; exact source/archive object correspondence and restore behavior remain unverified. |
| Realtime now has 18 routines, compared with earlier 17 | Preserve source drift for exact identity/classification and a later updated release snapshot. Do not call the older archive corrupt or incomplete for its own timestamp solely from this later count. |

The next concrete handoff creates the **separate owner-private role export**, outside the first single-database archive. It uses the verified Windows PostgreSQL 17 `pg_dumpall.exe`, native local database-password prompt, certificate/verify-full session-pooler endpoint and **roles-only** selection. It excludes role passwords, quotes identifiers, fixes UTF-8 output and retains ACLs. Official PostgreSQL 17 source confirms roles-only still invokes role membership and (PG15+) parameter-ACL export when ACLs are enabled, and omits database/tablespace exports. Per-role settings are exported where `setdatabase=0`; database-scoped settings among the source's 10 records remain to reconcile separately.

The file can contain sensitive **role-setting values**, so it stays in the existing protected local folder. The block rechecks folder owner/DACL/no redirection, creates a unique partial file, requires native zero exit/nonempty/completion marker and exactly the latest 16 role definitions, then keeps a private hash manifest and prints aggregate metadata only. Failure retains partial output for review without weakened permissions or alternate privileged credentials. The output is an archival component; no generated SQL is run and no roles, grants or settings are restored/changed. Its basic statement markers/counts are not an SQL parser, exact membership/settings comparison or recovery proof. Owner export execution and subsequent private encryption are pending.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoDumpAll = "C:\Program Files\PostgreSQL\17\bin\pg_dumpall.exe"
    $mushavoCert = "C:\Users\HP\Desktop\Mushavo Budget\prod-ca-2021.crt"
    foreach ($mushavoRequired in @($mushavoDumpAll, $mushavoCert)) {
        if (-not (Test-Path -LiteralPath $mushavoRequired -PathType Leaf)) {
            throw "A required verified PostgreSQL executable/certificate is missing."
        }
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowed = @($mushavoOwner.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoRoot
    $mushavoRules = $mushavoAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwner.Value) {
        throw "Private folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowed -or $mushavoRule.IsInherited -or
            $mushavoRule.AccessControlType -ne "Allow" -or $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected private folder permission."
        }
    }
    $mushavoRun = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ") + "-" + [guid]::NewGuid().ToString("N")
    $mushavoPartial = Join-Path $mushavoRoot "$mushavoRun.partial.roles.sql"
    $mushavoFinal = Join-Path $mushavoRoot "$mushavoRun.roles.sql"
    $mushavoManifest = Join-Path $mushavoRoot "$mushavoRun.roles.manifest.json"
    $mushavoCertValue = (Resolve-Path -LiteralPath $mushavoCert).ProviderPath.Replace('\', '/').Replace("'", "\'")
    $mushavoConnection = @(
        "host=aws-0-eu-central-1.pooler.supabase.com", "port=5432",
        "user=postgres.kttkospkblwvguuwnhjj", "sslmode=verify-full",
        "sslrootcert='$mushavoCertValue'", "gssencmode=disable", "connect_timeout=15",
        "application_name=mushavo_stage_1_2_roles"
    ) -join " "
    Write-Output "Enter the database password only at pg_dumpall's native prompt."
    Write-Output "Keep this role/settings export private in the existing local backup folder."
    $ErrorActionPreference = "Continue"
    & $mushavoDumpAll --roles-only --no-role-passwords --quote-all-identifiers --encoding=UTF8 --password `
        --database=postgres --dbname $mushavoConnection --file $mushavoPartial
    $mushavoExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoExit -ne 0) {
        throw "Role export failed (exit $mushavoExit). Keep the partial file; send only redacted errors."
    }
    $mushavoFile = Get-Item -LiteralPath $mushavoPartial -Force
    if ($mushavoFile.Length -le 0) { throw "Role export is empty; file stays partial." }
    $mushavoText = [IO.File]::ReadAllText($mushavoPartial, [Text.Encoding]::UTF8)
    if ($mushavoText -notmatch '(?m)^-- PostgreSQL database cluster dump complete\r?$') {
        throw "Native completion marker missing; file stays partial."
    }
    $mushavoRoles = @("anon", "authenticated", "authenticator", "dashboard_user", "pgbouncer", "postgres", "service_role",
        "supabase_admin", "supabase_auth_admin", "supabase_etl_admin", "supabase_functions_admin", "supabase_privileged_role",
        "supabase_read_only_user", "supabase_realtime_admin", "supabase_replication_admin", "supabase_storage_admin")
    $mushavoCreateCount = [regex]::Matches($mushavoText, '(?m)^CREATE ROLE ').Count
    if ($mushavoCreateCount -ne 16) { throw "Role count differs from the latest 16-role inventory; keep partial for review." }
    foreach ($mushavoRole in $mushavoRoles) {
        $mushavoPattern = '(?m)^CREATE ROLE "' + [regex]::Escape($mushavoRole) + '";\r?$'
        if ([regex]::Matches($mushavoText, $mushavoPattern).Count -ne 1) {
            throw "An expected inventoried role definition is missing/duplicated; file stays partial."
        }
    }
    if ($mushavoText -match '(?m)^ALTER ROLE .* WITH .*\bPASSWORD\b') {
        throw "Unexpected role-password clause; keep the file private and partial."
    }
    $mushavoMembershipCount = [regex]::Matches($mushavoText, '(?m)^GRANT (?![^\r\n]* ON )').Count
    $mushavoParameterCount = [regex]::Matches($mushavoText, '(?m)^(GRANT|REVOKE) [^\r\n]* ON PARAMETER ').Count
    Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.2"
        result = "ROLE_EXPORT_NATIVE_COMPLETION_AND_MARKERS_PASS"
        project = "kttkospkblwvguuwnhjj"
        completed_utc = [DateTime]::UtcNow.ToString("o")
        file = $mushavoFinal
        bytes = (Get-Item -LiteralPath $mushavoFinal).Length
        inventoried_role_definitions = $mushavoCreateCount
        membership_grant_statements = $mushavoMembershipCount
        parameter_acl_statements = $mushavoParameterCount
        role_password_export_disabled = $true
        exact_membership_flags_and_settings_recovery_verified = $false
        database_scoped_role_settings_reconciled = $false
        encrypted_roles_package_created = $false
        complete_platform_backup_verified = $false
        isolated_restore_verified = $false
    }
    [pscustomobject]@{
        summary = $mushavoSummary
        file_sha256 = (Get-FileHash -LiteralPath $mushavoFinal -Algorithm SHA256).Hash
        source_metadata_checked_utc = "2026-10-08T04:04:45.322523Z"
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $mushavoManifest -Encoding UTF8
    $mushavoSummary | Format-List
    Write-Output "Send only this summary and redacted warnings/errors. Keep SQL, settings values and hashes private."
    Write-Output "Next: private encryption/file verification. No roles/grants/settings were restored or changed."
}
```

Source: [security-stage-1-role-export.ps1](../scripts/security-stage-1-role-export.ps1). Prepared/source-reviewed only; no Windows/PowerShell/native PostgreSQL runtime exists here. Send **only the metadata summary and redacted warnings/errors**. Keep SQL/setting values, password, hashes and manifest private. Next privately encrypt/verify the role component after its native result; do not upload raw files. No repeated original database export/encryption is requested. Google remains deferred. F16/exact managed/custom/extension/settings/key/file/configuration scope, source drift and isolated synthetic recovery remain open.

## Role-export result and prior private encryption — S1E46–S1E47; completed in S1E48

Owner completes the role-export handoff at **2026-10-08T04:22:25.3745418Z**: **6,310 bytes**, **16 inventoried role definitions**, **21 membership GRANT statements** and **one parameter-ACL statement**, with role password export disabled. This is **OWNER-TESTED native/basic marker PASS**; no SQL/settings/hash contents are supplied. Exact membership flags/settings recovery, database-scoped settings, encrypted role package, full backup and isolated restore remain false. Warnings/errors were not supplied; that does not independently prove there were none.

The earlier source has **24 membership records** while the artifact summary has **21 statement markers**. Counts of different representations/timestamps alone establish neither omission nor equivalence. Preserve exact grantor/ADMIN/INHERIT/SET comparison as an open recovery item; do not label missing grants as a failure or claim full grant fidelity from these counters. Source drift, managed/custom authority, independent login credentials, Vault/queue/settings coverage and broader F16 remain open.

Next package **only this role SQL and its private manifest** in the existing protected local folder. The block binds source path/bytes/counters/private hash to the completed export, uses native passphrase prompts for a unique header-encrypted 7z, checks correct-password integrity and random wrong-password filename denial, then extracts exactly two verification files privately and compares both with the original hashes. All original/private verification files and receipts remain retained. It performs no hosted database connection, SQL execution, upload or deletion. Google stays deferred; the old database component is not re-created. This uses the existing owner-tested native 7-Zip packaging pattern; actual new Windows execution remains pending.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoRun = "20261008T042143Z-48bbd715d1b24cec870ee95e8113edb2"
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) {
        throw "Verified 7-Zip executable was not found."
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    $mushavoNames = @("$mushavoRun.roles.sql", "$mushavoRun.roles.manifest.json")
    $mushavoFileRecords = @()
    foreach ($mushavoName in $mushavoNames) {
        $mushavoPath = Join-Path $mushavoBackupRoot $mushavoName
        $mushavoItem = Get-Item -LiteralPath $mushavoPath -Force
        if ($mushavoItem.PSIsContainer -or $mushavoItem.Length -le 0 -or
            ($mushavoItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Expected export file is missing, empty or redirected."
        }
        $mushavoFileRecords += [pscustomobject]@{
            name = $mushavoName
            bytes = $mushavoItem.Length
            sha256 = (Get-FileHash -LiteralPath $mushavoPath -Algorithm SHA256).Hash
        }
    }
    $mushavoManifestPath = Join-Path $mushavoBackupRoot "$mushavoRun.roles.manifest.json"
    $mushavoPrivateRecord = Get-Content -LiteralPath $mushavoManifestPath -Raw | ConvertFrom-Json
    $mushavoRolePath = Join-Path $mushavoBackupRoot "$mushavoRun.roles.sql"
    $mushavoRoleSummary = $mushavoPrivateRecord.summary
    if ($mushavoRoleSummary.stage_step -ne "1.2" -or
        $mushavoRoleSummary.result -ne "ROLE_EXPORT_NATIVE_COMPLETION_AND_MARKERS_PASS" -or
        $mushavoRoleSummary.project -ne "kttkospkblwvguuwnhjj" -or
        $mushavoRoleSummary.file -ne $mushavoRolePath -or
        $mushavoRoleSummary.bytes -ne 6310 -or $mushavoFileRecords[0].bytes -ne 6310 -or
        $mushavoRoleSummary.inventoried_role_definitions -ne 16 -or
        $mushavoRoleSummary.membership_grant_statements -ne 21 -or
        $mushavoRoleSummary.parameter_acl_statements -ne 1 -or
        $mushavoRoleSummary.role_password_export_disabled -ne $true -or
        $mushavoPrivateRecord.file_sha256 -notmatch "^[0-9a-fA-F]{64}$" -or
        $mushavoFileRecords[0].sha256 -ne $mushavoPrivateRecord.file_sha256) {
        throw "Role file/manifest differs from the completed export. Hashes stay private."
    }
    $mushavoPackageRun = "$mushavoRun.roles-component-" + [guid]::NewGuid().ToString("N")
    $mushavoPartial = Join-Path $mushavoBackupRoot "$mushavoPackageRun.partial.7z"
    $mushavoFinal = Join-Path $mushavoBackupRoot "$mushavoPackageRun.7z"
    $mushavoVerifiedFiles = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verified-files"
    $mushavoReceipt = Join-Path $mushavoBackupRoot "$mushavoPackageRun.verification.json"
    Write-Output "Enter your saved, unique backup passphrase only at each 7-Zip prompt. Never enter a blank password."
    Write-Output "Partial encrypted package: $mushavoPartial"
    Push-Location -LiteralPath $mushavoBackupRoot
    try {
        # Bare -p invokes 7-Zip's native hidden-input prompt. No real password is in PowerShell.
        $ErrorActionPreference = "Continue"
        & $mushavo7Zip a -t7z -mhe=on -p $mushavoPartial @mushavoNames
        $mushavoCreateExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoCreateExit -ne 0) {
            throw "Encryption failed (exit $mushavoCreateExit). Keep partial files and report the error."
        }
        if ((Get-Item -LiteralPath $mushavoPartial).Length -le 0) { throw "Encrypted package is empty." }
        Write-Output "Enter the same saved passphrase to test the package."
        $ErrorActionPreference = "Continue"
        # Reading an encrypted archive without -p triggers the native password prompt.
        & $mushavo7Zip t $mushavoPartial
        $mushavoTestExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoTestExit -ne 0) { throw "Package integrity/password test failed; package stays partial." }

        # Random negative-test input only; this is never the real backup passphrase.
        $mushavoWrongProbe = "-p" + [guid]::NewGuid().ToString("N")
        $ErrorActionPreference = "Continue"
        $mushavoDeniedListing = & $mushavo7Zip l -slt $mushavoWrongProbe $mushavoPartial 2>&1
        $mushavoDeniedExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoDeniedExit -ne 2) { throw "Wrong-password header check failed; package stays partial." }
        $mushavoDeniedText = $mushavoDeniedListing | Out-String
        foreach ($mushavoName in $mushavoNames) {
            if ($mushavoDeniedText.Contains($mushavoName)) {
                throw "Wrong-password listing exposed a source filename; package stays partial."
            }
        }
        New-Item -ItemType Directory -Path $mushavoVerifiedFiles | Out-Null
        Write-Output "Enter the same saved passphrase to extract verification copies inside the private folder."
        $ErrorActionPreference = "Continue"
        & $mushavo7Zip x "-o$mushavoVerifiedFiles" $mushavoPartial
        $mushavoExtractExit = $LASTEXITCODE
        $ErrorActionPreference = "Stop"
        if ($mushavoExtractExit -ne 0) { throw "Verification extraction failed; package stays partial." }
        if (@(Get-ChildItem -LiteralPath $mushavoVerifiedFiles -File -Recurse -Force).Count -ne 2) {
            throw "Expected exactly two extracted files; package stays partial."
        }
        foreach ($mushavoRecord in $mushavoFileRecords) {
            $mushavoOriginal = Join-Path $mushavoBackupRoot $mushavoRecord.name
            $mushavoExtracted = Join-Path $mushavoVerifiedFiles $mushavoRecord.name
            $mushavoOriginalHash = (Get-FileHash -LiteralPath $mushavoOriginal -Algorithm SHA256).Hash
            $mushavoExtractedHash = (Get-FileHash -LiteralPath $mushavoExtracted -Algorithm SHA256).Hash
            if ($mushavoOriginalHash -ne $mushavoRecord.sha256 -or
                $mushavoExtractedHash -ne $mushavoRecord.sha256) {
                throw "A source changed or an extracted file differs; package stays partial."
            }
        }
        Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
        $mushavoPackage = Get-Item -LiteralPath $mushavoFinal
        $mushavoPackageHash = (Get-FileHash -LiteralPath $mushavoFinal -Algorithm SHA256).Hash
        $mushavoSummary = [pscustomobject]@{
            stage_step = "1.2"
            result = "ROLES_COMPONENT_ENCRYPTED_PACKAGE_AND_EXTRACTED_HASH_PASS"
            project = "kttkospkblwvguuwnhjj"
            completed_utc = [DateTime]::UtcNow.ToString("o")
            file = $mushavoFinal
            bytes = $mushavoPackage.Length
            packaged_files = 2
            roles_match_private_manifest = $true
            wrong_password_cannot_list_source_filenames = $true
            both_extracted_hashes_match = $true
            role_password_export_disabled = $true
            exact_membership_flags_and_settings_recovery_verified = $false
            database_scoped_role_settings_reconciled = $false
            offsite_upload_download_verified = $false
            complete_platform_backup_verified = $false
            isolated_database_restore_verified = $false
        }
        [pscustomobject]@{
            summary = $mushavoSummary
            archive_sha256 = $mushavoPackageHash
            source_files = $mushavoFileRecords
            verified_files_directory = $mushavoVerifiedFiles
        } | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $mushavoReceipt -Encoding UTF8
        $mushavoSummary | Format-List
        Write-Output "Keep originals, verification copies and receipt private. No upload or SQL restore was performed."
        Write-Output "Send only this summary and any warnings/errors. Do not send passwords, files or hashes."
    } finally {
        Pop-Location
    }
}
```

Source: [security-stage-1-role-encryption.ps1](../scripts/security-stage-1-role-encryption.ps1). Use a privately saved unique nonblank backup passphrase only at the native prompts. Send **only the metadata summary and redacted warnings/errors**; SQL, manifest/receipt contents, settings values, passwords, archives and hashes stay private. The package/file checks do not verify exact memberships/settings or SQL recovery. No Google handoff is reactivated.

## Role-package result and prior private comparison — S1E48–S1E49; completed in S1E50

Owner completes the role package at **2026-10-08T04:31:59.1197194Z**: **1,919 bytes**, **two files**, role/private-manifest binding, wrong-password source-filename denial and **both extracted hashes match**. Record **OWNER-TESTED local package/file PASS**. Password export remains disabled. Exact role/settings recovery, offsite, full platform and isolated restore remain false; no raw artifacts/hashes are supplied. Warnings/errors are not independently checked merely because none are supplied. Existing database component PASS stays retained and Google stays deferred.

Official PostgreSQL 17 `dumpRoleMembership` excludes memberships when **both granted role and member begin `pg_`**. The S1E44 snapshot includes exactly three such records: `pg_read_all_settings`, `pg_read_all_stats` and `pg_stat_scan_tables` granted to `pg_monitor`. Thus **24 source records − 3 default builtin-to-builtin omissions = 21 expected export statements**. This source-backed classification explains the count difference; it does not prove the private 21 identities/options match or that omitted builtin membership state is recovered at a destination. Provider-managed/custom authority and actual destination behavior remain separate recovery requirements.

The next local checker fetches a **pinned public helper** from the draft branch without changing the dirty checkout or installing dependencies. After the protected-folder check, native `node.exe` reads the exact role/private manifest and encrypted-package receipt, rechecks their private hashes, then parses selected quoted PostgreSQL 17 role-export forms **without executing SQL**. It compares the 16 role names and selected superuser/inherit/create-role/create-database/login/replication/bypass-RLS/connection-limit attributes, plus all expected 21 membership tuples including grantor/ADMIN/INHERIT/SET, against S1E44. SQL lookalikes inside literals/comments do not count as grants; unsupported forms fail into sanitized REVIEW.

Role-wide setting statement counts are separate indicators: values and database-scoped coverage are not compared. Passwords, validity values, comments/security labels, parameter ACL semantics, omitted builtin grants, managed/custom authority and live/isolated recovery stay unverified. Results refer to the earlier metadata snapshot, not a fresh live catalog. The checker writes only its public code copy and a private verification receipt in the protected folder; original backups stay retained. No password prompt, database connection, extraction, SQL execution, raw upload or cleanup is requested.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    $mushavoProject = "C:\Users\HP\Desktop\Mushavo Budget"
    $mushavoNode = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoGit = Get-Command -Name "git.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $mushavoGit.Source -C $mushavoProject fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoBlob = & $mushavoGit.Source -C $mushavoProject rev-parse "FETCH_HEAD:scripts/security-stage-1-role-coverage.cjs"
    if ($LASTEXITCODE -ne 0 -or ($mushavoBlob | Out-String).Trim() -ne "7e7aa5f6cb1463fb5141939b2b847d9bcd880502") {
        throw "Fetched checker differs from this reviewed version. Send the error only."
    }
    $mushavoCode = & $mushavoGit.Source -C $mushavoProject show "FETCH_HEAD:scripts/security-stage-1-role-coverage.cjs" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCode)) { throw "Checker read failed." }
    $mushavoLocalTool = Join-Path $mushavoBackupRoot ("RoleCoverageTool-" + [guid]::NewGuid().ToString("N") + ".cjs")
    [IO.File]::WriteAllText($mushavoLocalTool, $mushavoCode, [Text.UTF8Encoding]::new($false))
    & $mushavoNode.Source $mushavoLocalTool $mushavoBackupRoot
    $mushavoCheckExit = $LASTEXITCODE
    if ($mushavoCheckExit -ne 0 -and $mushavoCheckExit -ne 2) { throw "Local checker failed unexpectedly." }
    Write-Output "Send only the JSON summary and redacted warnings/errors. Keep SQL, manifests, receipts, hashes and values private."
    Write-Output "No SQL was executed or uploaded. Existing backup files remain retained; Google stays deferred."
}
```

Sources: [private role coverage handoff](../scripts/security-stage-1-role-coverage-check.ps1), [pinned Node checker](../scripts/security-stage-1-role-coverage.cjs) and [synthetic fixture tests](../tests/security-stage-1-role-coverage.test.cjs). Ten meaningful Node fixtures pass for changed flags/grantor/limits, duplicated/missing grants, literal/comment boundaries, unsupported syntax/password directives, setting-value scope and private-byte/sanitized-CLI guards. Dummy receipts/bytes test binding only; no real archive/native encryption proof is inferred. Windows/native owner execution remains pending. Send **only the JSON summary and redacted warnings/errors**. Keep SQL, settings, manifests, receipts, archives and hashes private. Google remains deferred.

## Prior private comparison and setting-scope handoff — S1E50–S1E51; metadata completed in S1E52

Owner completes the pinned checker at **2026-10-08T04:50:05.598Z**. **OWNER-TESTED selected comparison PASS:** role/package files match private receipts; all **16 role names/selected attributes** and all **21 expected exported grantor/ADMIN/INHERIT/SET tuples** match S1E44, after classifying the three builtin-to-builtin omissions. This closes the earlier private selected-role/tuple comparison pending at the **older source snapshot** scope, not root raw-file review, current source drift or isolated recovery.

**15 role-wide setting statement counts match** the earlier per-role counts. The role file has **zero database-scoped setting statements**, **one parameter-ACL statement** and **three unexamined metadata statements**. Exact setting values/database scope, parameter ACL semantics, omitted builtin grants, independent login credentials, live/isolated restoration and full platform recovery remain false. A role-file zero does not prove the source has no database-scoped settings. No private values/hashes/artifacts are supplied and unreported warnings are not independent absence proof. Existing local database/role package checks remain retained; Google stays deferred.

Next split the earlier **10 role/database-setting records** by role-wide, database-wide, role-in-database and any all-role/all-database scope. Return only role/database identities, setting **keys/counts**, incomplete-metadata indicators and exact nondefault parameter ACL grantor/grantee/privilege/grant-option metadata. Include current builtin omission-category memberships to preserve the source/destination distinction. This is **five read-only rows: 4 INFO + 1 REVIEW**, with repeatable-read context, catalog search path, timeouts and rollback. No setting values, customer records, role passwords, function bodies or Vault/credential material are returned. Catalog errors remain errors; null/unresolved/malformed metadata is not replaced by complete default/zero assumptions. This classifies recovery scope; it does not create another backup or execute role/configuration/grant changes.

Use the owner's established SQL handoff:

```powershell
& {
    $ErrorActionPreference = "Stop"
    Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
    git.exe fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }

    $mushavoSql = git.exe show "FETCH_HEAD:supabase/diagnostics/security_stage_1_setting_scope.sql" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoSql)) {
        throw "SQL read failed."
    }

    Set-Clipboard -Value $mushavoSql -ErrorAction Stop
    Write-Output "Stage 1.2 setting-scope SQL copied to clipboard."
    Write-Output "Verify Supabase project kttkospkblwvguuwnhjj, paste into SQL Editor and run once."
    Write-Output "Send all five rows and redacted warnings/errors. Expected: 4 INFO + 1 REVIEW."
}
```

Verify Dashboard project **kttkospkblwvguuwnhjj**, paste into its SQL Editor and run once. Send **all five rows and redacted warnings/errors**; INFO/REVIEW are expected metadata states, not five security PASS results. Keep archived SQL/settings values, credentials, manifests and hashes private. No repeat role export/encryption/private comparison or Google action is requested.

The [setting-scope fixture verifier](../scripts/verify-security-stage-1-setting-scope.cjs) passes on disposable PostgreSQL for all four scope categories, key-only privacy with equals/malformed/null entries, parameter PUBLIC/grant-option/ALTER SYSTEM metadata and null ACLs, builtin category, empty inventories, rejected read-only writes and propagated catalog permission errors. Any fixture catalog mutation is fresh disposable setup only; the [owner diagnostic](../supabase/diagnostics/security_stage_1_setting_scope.sql) contains read queries/local transaction settings and rollback. Hosted 17.6 execution/value reconciliation/restore remain pending.

## Prior settings metadata/private coverage handoff — S1E52–S1E53; owner REVIEW in S1E54, TOC correction in S1E55

Owner supplies all five read-only rows at **2026-10-08T05:28:30.392498+00:00**, PostgreSQL **17.6**, database **postgres**, repeatable-read/read-only: **4 INFO + 1 REVIEW**. This completes source metadata collection, not a backup/security/recovery PASS. Intended project identity remains owner Dashboard context, not a SQL-proven identity.

| Source setting scope | Observed metadata | Private coverage still needed |
|---|---|---|
| Role-wide | Nine roles, 15 setting keys; complete/resolved metadata | Archived key identity and exact values; restored behavior |
| Database-wide | postgres, role null, one key app.settings.jwt_exp | Database archive property content, exact value and destination recovery |
| Role-in-database / all-role-all-database | No record appears at this snapshot | No claim about earlier archive contents or future source absence |

The roles are anon/authenticated (statement_timeout), authenticator (session_preload_libraries/statement_timeout/lock_timeout), postgres (search_path), supabase_admin (search_path/log_statement), supabase_auth_admin (search_path/idle_in_transaction_session_timeout/log_statement), supabase_read_only_user (default_transaction_read_only), supabase_realtime_admin (search_path) and supabase_storage_admin (search_path/log_statement). All ten records have resolved identities/present config arrays and zero unrecognized entries; incomplete metadata is zero. No actual setting value is supplied.

The one nonnull **log_min_messages** ACL contains three entries: supabase_admin self-granted ALTER SYSTEM and SET, and supabase_admin-granted SET to supabase_realtime_admin; all grant options are false and identities resolve. Official PG17 `dumpRoleGUCPrivs` compares ACLs with `acldefault('p', 10)` and `buildACLCommands` emits the delta. The observed self-grants are consistent with owner defaults, but bootstrap OID-10 identity/effective semantics and private exported commands have not been established by the metadata alone. The three current builtin-to-builtin pg_monitor memberships still match the earlier omission category (same grantor and ADMIN false/INHERIT true/SET true); recovered managed grants remain unverified.

Official PG17 `pg_dump` always enables database entries for non-plain custom archives, and stores database/role-in-database configuration in a separate **DATABASE PROPERTIES** entry when nondefault properties exist. Therefore absence of database-specific settings in roles-only SQL is not a missing database-backup proof. Actual private archive presence/content must be checked; do not rerun or replace the original export based on that role-file count alone. Sources: [pg_dump.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/pg_dump.c), [pg_dumpall.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/pg_dumpall.c), [dumputils.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/dumputils.c), [acl.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/backend/utils/adt/acl.c).

The next block checks the **existing local components**. After owner/DACL/ancestor checks, it fetches two reviewed public helper blobs without checking out or changing the dirty working files. The unchanged role helper validates existing private role receipts and discards literal values. The new helper validates the exact database archive/dump/TOC/manifest against its completed private receipt, compares 15 archived role setting key identities with S1E52, checks the one extra parameter GRANT's target/privilege/no-grant-option shape, and counts exact intended postgres DATABASE / DATABASE PROPERTIES entries in the saved TOC. It rechecks bytes during the run and creates a unique private JSON receipt. No SQL is generated/executed; no connection, extraction, password prompt, new export/package, upload, cleanup or permission change occurs. Google stays deferred.

**Historical preparation: owner execution completed with REVIEW in S1E54; selected-TOC prerequisite corrected in S1E55.** The intended PASS was only key/delta-shape/TOC presence, not exact archived values, the required database property's key/value content, bootstrap-owner mapping/effective ACL semantics, live source drift or destination recovery. Those remain explicit recovery/final remediation work; following this coverage check, proceed to actual Storage bytes and provider/credential configuration rather than repeat these inventories. Nine meaningful synthetic Node tests PASS, including altered same-size files, same-count privilege/key changes, malformed SQL, missing/duplicate/other-database TOC entries and private content/value/path omission. Synthetic buffers are not real archive-validation proof. Windows/private artifacts are unavailable to root.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    $mushavoProject = "C:\Users\HP\Desktop\Mushavo Budget"
    $mushavoNode = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoGit = Get-Command -Name "git.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $mushavoGit.Source -C $mushavoProject fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoToolRoot = Join-Path $mushavoBackupRoot ("SettingCoverageTool-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoToolRoot | Out-Null
    foreach ($mushavoTool in @(
        @{ Name = "security-stage-1-role-coverage.cjs"; Blob = "7e7aa5f6cb1463fb5141939b2b847d9bcd880502" },
        @{ Name = "security-stage-1-setting-coverage.cjs"; Blob = "18ee5bed07835aec0432f690bf5d6ede2dd1324c" }
    )) {
        $mushavoObject = "FETCH_HEAD:scripts/" + $mushavoTool.Name
        $mushavoBlob = & $mushavoGit.Source -C $mushavoProject rev-parse $mushavoObject
        if ($LASTEXITCODE -ne 0 -or ($mushavoBlob | Out-String).Trim() -ne $mushavoTool.Blob) {
            throw "Fetched checker differs from this reviewed version. Send the error only."
        }
        $mushavoCode = & $mushavoGit.Source -C $mushavoProject show $mushavoObject | Out-String
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCode)) { throw "Checker read failed." }
        [IO.File]::WriteAllText((Join-Path $mushavoToolRoot $mushavoTool.Name), $mushavoCode, [Text.UTF8Encoding]::new($false))
    }
    & $mushavoNode.Source (Join-Path $mushavoToolRoot "security-stage-1-setting-coverage.cjs") $mushavoBackupRoot
    $mushavoCheckExit = $LASTEXITCODE
    if ($mushavoCheckExit -ne 0 -and $mushavoCheckExit -ne 2) { throw "Local checker failed unexpectedly." }
    Write-Output "Send only the JSON summary and redacted warnings/errors. Keep SQL, TOC, manifests, receipts, hashes and values private."
    Write-Output "No SQL was executed or uploaded. Existing backups remain retained; Google stays deferred."
}
```

Source: [security-stage-1-setting-coverage-check.ps1](../scripts/security-stage-1-setting-coverage-check.ps1), [new pinned helper](../scripts/security-stage-1-setting-coverage.cjs) and [nine synthetic tests](../tests/security-stage-1-setting-coverage.test.cjs). Send only the JSON summary and redacted errors/warnings. Never send SQL/TOC, receipts/manifests, actual setting values, passwords, archives or private hashes. A REVIEW retains the artifact and identifies a narrower unresolved check; it is not automatically corruption or a new export requirement. F16/full platform/offsite/isolated recovery remain open.

## Current private coverage result and corrected full-TOC handoff — S1E54–S1E55

Owner runs the pinned local checker at **2026-10-08T06:01:38.392Z**, returning **PRIVATE_SETTING_COVERAGE_REVIEW**. Preserve this overall result. Narrow owner-tested **PASS**: database/roles originals match private receipts; all **15 role setting key identities across nine roles** match S1E52; the **one added parameter GRANT shape** matches. Zero database-scoped setting commands in the roles file is retained. Exact values, bootstrap/default-owner association/effective ACL semantics, property key/value content, live drift and destination recovery remain false; no raw artifacts/values/hashes are supplied.

The zero intended DATABASE / DATABASE PROPERTIES counters need a correction to the **audit tool**, not an invented missing-backup finding. S1E29 saved a **selected** TOC from plain `pg_restore --list`. Official PG17 `PrintTOCSummary` ordinarily prints entries with selected schema/data bits; `_tocEntryRequired` returns zero bits for DATABASE / DATABASE PROPERTIES when createDB mode is off. Thus that saved list legitimately hides those entries. The S1E53 checker mistakenly required them in this filtered TOC; its nine synthetic tests did not cover the native default selection behavior. S1E54 counts do not inspect the full archive catalog or prove absent/corrupt archive properties. Earlier records and the original selected TOC are preserved.

The correction uses **`pg_restore --list --verbose --file <new private TOC> <original dump>`**. In PG17 source, verbose TOC listing prints all entries regardless of selection bits, and --list routes to `PrintTOCSummary` instead of `RestoreArchive` before any connection. No --create/--clean/connection flags or SQL are used. Sources: [pg_backup_archiver.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/pg_backup_archiver.c) and [pg_restore.c](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/pg_restore.c).

The inline block below retains owner/DACL/ancestor checks, fetches three pinned public helper files without changing the dirty checkout, rebinds the exact original database archive/dump/selected-TOC/manifest to the private completed receipt, then runs only the native offline listing. Full TOC, native messages and a new private verification receipt are saved in a unique protected subdirectory. Only aggregate context/counts/presence are printed; all private hashes/messages stay local. The role setting/grant comparisons already completed in S1E54 are not repeated. Original archive/source/receipt bytes are rechecked and retained without edits, deletion, export, repackaging, SQL, connection or upload. Google remains deferred.

**Seven targeted synthetic tests PASS**, including selected versus full TOC fixtures, missing/duplicate/wrong context, nonzero native completion/timeout despite complete-looking output, private native messages, changed original bytes and malformed/private input. The native runner is substituted and archive buffers are dummy bytes: those tests prove orchestration/binding/privacy, not real native PG/7z execution. Actual Windows PG17 full-archive execution is pending. If one database definition and one property entry appear, that proves only full-TOC presence; app.settings.jwt_exp and actual values/effective/restored behavior remain unverified. Any native message is retained privately and prevents unreviewed whole-check PASS.

```powershell
& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoFolder = Get-Item -LiteralPath $mushavoBackupRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoBackupRoot
    $mushavoRules = $mushavoAcl.GetAccessRules(
        $true, $true, [Security.Principal.SecurityIdentifier]
    )
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Backup-folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne
                [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected backup-folder permissions."
        }
    }
    $mushavoRestore = "C:\Program Files\PostgreSQL\17\bin\pg_restore.exe"
    if (-not (Test-Path -LiteralPath $mushavoRestore -PathType Leaf)) { throw "Verified pg_restore.exe path was not found." }
    $mushavoProject = "C:\Users\HP\Desktop\Mushavo Budget"
    $mushavoNode = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoGit = Get-Command -Name "git.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $mushavoGit.Source -C $mushavoProject fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoToolRoot = Join-Path $mushavoBackupRoot ("DatabasePropertiesTool-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoToolRoot | Out-Null
    foreach ($mushavoTool in @(
        @{ Name = "security-stage-1-role-coverage.cjs"; Blob = "7e7aa5f6cb1463fb5141939b2b847d9bcd880502" },
        @{ Name = "security-stage-1-setting-coverage.cjs"; Blob = "18ee5bed07835aec0432f690bf5d6ede2dd1324c" },
        @{ Name = "security-stage-1-database-properties-toc.cjs"; Blob = "2ddfa1ebb5ab13eeef37335700f6251654bf5ace" }
    )) {
        $mushavoObject = "FETCH_HEAD:scripts/" + $mushavoTool.Name
        $mushavoBlob = & $mushavoGit.Source -C $mushavoProject rev-parse $mushavoObject
        if ($LASTEXITCODE -ne 0 -or ($mushavoBlob | Out-String).Trim() -ne $mushavoTool.Blob) {
            throw "Fetched checker differs from this reviewed version. Send the error only."
        }
        $mushavoCode = & $mushavoGit.Source -C $mushavoProject show $mushavoObject | Out-String
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCode)) { throw "Checker read failed." }
        [IO.File]::WriteAllText((Join-Path $mushavoToolRoot $mushavoTool.Name), $mushavoCode, [Text.UTF8Encoding]::new($false))
    }
    & $mushavoNode.Source (Join-Path $mushavoToolRoot "security-stage-1-database-properties-toc.cjs") $mushavoBackupRoot $mushavoRestore
    $mushavoCheckExit = $LASTEXITCODE
    if ($mushavoCheckExit -ne 0 -and $mushavoCheckExit -ne 2) { throw "Offline listing checker failed unexpectedly." }
    Write-Output "Send only the JSON summary and redacted warnings/errors. Keep full TOC, native messages, receipts, hashes and values private."
    Write-Output "Original backups remain retained. No SQL, database connection, new export or cloud upload; Google stays deferred."
}
```

Source: [inline handoff](../scripts/security-stage-1-database-properties-toc-check.ps1), [new pinned listing helper](../scripts/security-stage-1-database-properties-toc.cjs), [seven targeted tests](../tests/security-stage-1-database-properties-toc.test.cjs). Send **only JSON summary and redacted errors/warnings**; never send full TOC, native-message files, receipts, archives, values or hashes. Do not rerun the superseded S1E53 selected-list check or infer that its zero counts require a new export. Review the new full-TOC result, then proceed to actual Storage bytes/provider configuration; exact settings/managed/key/source-drift/recovery dependencies stay carried into recovery/final remediation. F16/full platform/offsite/restore gates remain open.

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

1. Retain the owner-tested local database component export/offline-read and encrypted package/password/extracted-file hash PASS (S1E30/S1E32), alongside recorded client/TLS/folder evidence. The owner defers Google Drive troubleshooting/upload/download in S1E40; do not execute the earlier Google handoffs now. S1E42 records completed local receipt/hash/TOC indicators; S1E44 completes source dependency metadata. S1E46 completes the private role-export native/basic checks. S1E48 completes private role-component encryption/file checks. S1E50 completes exact private selected-role attributes and 21 expected memberships against S1E44, with 15 role-wide counts matching. S1E52 completes five setting-scope rows (4 INFO + 1 REVIEW): 9 role-wide/15 entries plus one database-wide app.settings.jwt_exp, a nonnull three-entry parameter ACL and the same three builtin omissions. S1E54 now completes local private receipts/15 setting key identities/one parameter delta shape at narrow PASS scope, with an overall REVIEW caused by zero database entries in a default selected TOC. The audit checker incorrectly required entries hidden by plain --list. Execute only the corrected S1E55 offline --list --verbose handoff against the same archive, then proceed to actual Storage bytes and protected Auth/Edge/provider configuration. Exact values/database property content/bootstrap/default/managed/key/source-drift and recovery gaps remain explicit final remediation/recovery dependencies. No repeat installation, connection test, database-component encryption or Docker/CLI-help prerequisite is requested.
2. Reconcile exact export/grant/managed-object/encryption/configuration scope from the received metadata and separately needed owner checks. Future SQL handoffs retain the PowerShell fetch/show/clipboard format; do not infer complete coverage from this aggregate inventory.
3. Prepare compatible standalone PostgreSQL database export and separately authorized file-byte export paths. Require explicit target identity, connection method, completeness scope and separate credentials handling; do not embed credentials in pasted history, git or reports.
4. Carry the unverified offsite copy and Google deferral into the stage report/final action plan. No replacement destination is chosen by this decision. Later reconcile protected destination, recovery targets, frequency/retention and completion/failure records using actual volume and owner preferences; a schema file or object metadata alone remains insufficient.
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

- [Supabase psql certificate/session-pooler instructions](https://supabase.com/docs/guides/database/psql)
- [Supabase SSL verification/enforcement distinction](https://supabase.com/docs/guides/platform/ssl-enforcement)
- [PostgreSQL 17 psql options and connection metadata](https://www.postgresql.org/docs/17/app-psql.html)
- [PostgreSQL 17 libpq connection-string and SSL parameters](https://www.postgresql.org/docs/17/libpq-connect.html)

- [Official 7-Zip Windows distribution and encryption features](https://www.7-zip.org/)
- [Official 7z format and AES-256 encryption](https://www.7-zip.org/7z.html)
- [Google Drive computer upload procedure](https://support.google.com/drive/answer/2424368?hl=en)
- [Google Drive restricted sharing controls](https://support.google.com/drive/answer/2494822?hl=en)
- [Official 7-Zip release/security history](https://www.7-zip.org/history.txt)
- [Official 7-Zip current Windows installer](https://www.7-zip.org/download.html)
- [7-Zip project-linked password switch manual](https://7-zip.opensource.jp/chm/cmdline/switches/password.htm)
- [7-Zip project-linked header-encryption method manual](https://7-zip.opensource.jp/chm/cmdline/switches/method.htm)
- [7-Zip project-linked exit-code manual](https://7-zip.opensource.jp/chm/cmdline/exit_codes.htm)
- [Official 7-Zip exit-code definitions](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Common/ExitCode.h)
- [Microsoft Set-Acl for Windows PowerShell 5.1](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.security/set-acl?view=powershell-5.1)
- [Microsoft FileSystemAccessRule constructors](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.filesystemaccessrule.-ctor)
- [Microsoft inherited-access protection API](https://learn.microsoft.com/en-us/dotnet/api/system.security.accesscontrol.objectsecurity.setaccessruleprotection)
- [Microsoft local disk type/filesystem/free-space metadata](https://learn.microsoft.com/en-us/windows/win32/cimwin32prov/win32-logicaldisk)
- [PostgreSQL 17 custom archive listing and offline script output](https://www.postgresql.org/docs/17/app-pgrestore.html)
- [Microsoft Windows null-device name](https://learn.microsoft.com/en-us/windows/win32/fileio/naming-a-file)

- [Official 7-Zip console creation/read prompt behavior](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Console/Main.cpp)
- [Official 7-Zip creation password callback](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Console/UpdateCallbackConsole.cpp)
- [Official 7-Zip hidden console-input implementation](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Console/UserInputUtils.cpp)
- [Official 7-Zip extraction password callback](https://github.com/ip7z/7zip/blob/main/CPP/7zip/UI/Console/ExtractCallbackConsole.cpp)

- [Google Drive single-file browser download](https://support.google.com/drive/answer/2423534?hl=en)
- [Google Drive uploaded-file sharing and parent permissions](https://support.google.com/drive/answer/2494822?hl=en)

- [Official 7-Zip 7z signature constants](https://github.com/ip7z/7zip/blob/main/CPP/7zip/Archive/7z/7zHeader.cpp)
- [Official 7-Zip ZIP marker constants](https://github.com/ip7z/7zip/blob/main/CPP/7zip/Archive/Zip/ZipHeader.h)

- [Microsoft Windows PowerShell path-text clipboard value](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.management/set-clipboard?view=powershell-5.1)

- [PostgreSQL 17 extension member/configuration-data recovery rules](https://www.postgresql.org/docs/17/extend-extensions.html)

- [PostgreSQL 17 exact role membership flags](https://www.postgresql.org/docs/17/catalog-pg-auth-members.html)
- [PostgreSQL 17 extension configuration-table metadata](https://www.postgresql.org/docs/17/catalog-pg-extension.html)
- [PostgreSQL 17 publication definitions](https://www.postgresql.org/docs/17/catalog-pg-publication.html)
- [PostgreSQL 17 direct publication relation mappings](https://www.postgresql.org/docs/17/catalog-pg-publication-rel.html)
- [PostgreSQL 17 publication schema mappings](https://www.postgresql.org/docs/17/catalog-pg-publication-namespace.html)
- [Supabase Vault encrypted-backup behavior and secret recovery dependency](https://supabase.com/docs/guides/database/vault)

- [PostgreSQL 17 pg_dumpall role/membership/parameter-ACL source](https://raw.githubusercontent.com/postgres/postgres/REL_17_STABLE/src/bin/pg_dump/pg_dumpall.c)
- [PostgreSQL 17 database-specific versus role-wide setting scope](https://www.postgresql.org/docs/17/catalog-pg-db-role-setting.html)
- [Supabase provider-managed/default database role context](https://supabase.com/docs/guides/database/postgres/roles)
