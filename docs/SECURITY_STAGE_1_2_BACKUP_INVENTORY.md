# 1.2 — External database and file protection

Started 7 October 2026 after owner-tested normal sign-ins completed in 1.1. Stage 1 remains in progress. Account recovery gaps are carried forward; no provider recovery test or full F08 closure is inferred.

## Current scope and starting facts

Owner baseline: Supabase Free, no owner-held external database/uploaded-file backups and no separate staging project. F16 remains open. S1E09 records the completed Windows executable-version check. S1E12 records the owner choice to use standalone PostgreSQL command-line tools for exports. S1E13 records the received 13-row owner inventory: deployed PostgreSQL 17.6 and aggregate scope are known. S1E14 prepares discovery/installation of compatible PostgreSQL 17.x Windows clients; S1E15 records earlier standard-path absence. S1E16 now records owner-executed PASS for all four full-path clients at 17.11. S1E17 supplies displayed Dashboard session-pooler connection fields. S1E18 prepares the certificate-verified connection check; S1E19 now records owner execution PASS with the intended endpoint and TLS 1.3. S1E20 records the owner choice of Google Drive for the encrypted off-site copy; S1E21 prepares the encryption-tool check; S1E22 records the prior 24.09 patch gap; S1E23 now records completed owner executable/library 26.04 recheck PASS. S1E24 prepares the dummy-file encryption/header-privacy/recovery check; S1E25 now records owner execution with all three PASS lines, scoped to public dummy data/passwords. S1E26 records owner confirmation of Google two-step verification and the Restricted owner-only Drive folder; S1E27 prepares the separate local folder/DACL/capacity handoff. Actual local protection/private-passphrase handling, real export/encryption/upload and precise coverage remain pending. No export, restore, local stack, account setting or production write has been performed by this work; client availability follows the owner setup, not an assistant installation.

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

## Current cloud settings confirmation and local working folder — S1E26–S1E27

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

Send the path, PASS/free-space lines or the exact error. Owner execution is pending; the audit workspace has no Windows/PowerShell runtime, so actual folder/ACL/space results cannot be claimed from this source review. A successful DACL check would limit normal filesystem access to the listed identities; administrators/SYSTEM remain authorized, and this does not prove at-rest encryption, endpoint security or exclusion from separately configured sync/backup software.

Also report **available Google Drive storage** and whether **Windows device encryption/BitLocker is enabled on the displayed local drive** (yes/no/unsure), without sharing recovery keys. Keep raw working files local and upload only the separately verified encrypted package. Private backup-passphrase creation/entry/independent recovery, exact database/managed/role/Vault/file/configuration coverage, incomplete-run detection and actual export/upload/download/isolated restore remain pending. The folder is empty at preparation: F16 stays open and no real backup is created.

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

1. Deployed version/aggregate scope and owner-tested 17.11 client versions are recorded. Dashboard fields and owner certificate-verified connection PASS are recorded. Google Drive is selected; the 26.04 update is owner-verified; the dummy-file encryption check is owner-tested PASS; Google two-step/Restricted owner-only folder is owner-confirmed. Run the prepared local folder/DACL check and report local/cloud capacity and disk encryption, then establish safe private-passphrase handling and prepare exports against the reconciled coverage; no repeat connection test is requested. No repeat installation, dependency edit or Docker/CLI-help prerequisite is required for this selected route.
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
