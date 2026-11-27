# 1.4.2: one guarded STAGING public-schema export; no hosted writes or restore.
& {
    $ErrorActionPreference = "Stop"
    $PSNativeCommandUseErrorActionPreference = $false
    if ([string]::IsNullOrWhiteSpace($env:MUSHAVO_SYNTHETIC_EXPORT_SQL) -or
        [string]::IsNullOrWhiteSpace($env:MUSHAVO_RECOVERY_ROOT)) {
        throw "Pinned export SQL and prepared local recovery root are required."
    }
    $mushavoPgBin = "C:\Program Files\PostgreSQL\17\bin"
    foreach ($mushavoTool in @("psql", "pg_dump", "pg_restore")) {
        if (-not (Test-Path -LiteralPath (Join-Path $mushavoPgBin "$mushavoTool.exe") -PathType Leaf)) {
            throw "Required PostgreSQL tool missing: $mushavoTool"
        }
    }
    $mushavoRoot = (Get-Item -LiteralPath $env:MUSHAVO_RECOVERY_ROOT -Force).FullName
    $mushavoLocalBase = [Environment]::GetFolderPath("LocalApplicationData")
    if ([IO.Path]::GetDirectoryName($mushavoRoot) -ne $mushavoLocalBase -or
        [IO.Path]::GetFileName($mushavoRoot) -notmatch '^MushavoBudget-Local-Recovery-[0-9a-f]{32}$') {
        throw "Expected the previously prepared recovery root in LocalApplicationData."
    }
    $mushavoAncestor = Get-Item -LiteralPath $mushavoRoot -Force
    while ($null -ne $mushavoAncestor) {
        if ($mushavoAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Recovery directory or ancestor is redirected."
        }
        $mushavoAncestor = $mushavoAncestor.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoRoot
    $mushavoRules = $mushavoAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Recovery root owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or
            $mushavoRule.IsInherited -or $mushavoRule.AccessControlType -ne "Allow" -or
            $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") { throw "Unexpected recovery root permissions." }
    }
    $mushavoReady = Get-Content -LiteralPath (Join-Path $mushavoRoot "target-preparation.json") -Raw | ConvertFrom-Json
    if ($mushavoReady.result -ne "NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED" -or
        $mushavoReady.root -ne $mushavoRoot -or $mushavoReady.server_stopped -ne $true -or
        $mushavoReady.data_directory -ne (Join-Path $mushavoRoot "data") -or
        $mushavoReady.host -ne "127.0.0.1" -or $mushavoReady.port -ne 55439) {
        throw "Prepared target receipt does not match."
    }
    $mushavoCert = "C:\Users\HP\Desktop\Mushavo Budget STAGING\prod-ca-2021.crt"
    if (-not (Test-Path -LiteralPath $mushavoCert -PathType Leaf)) { throw "Previously used STAGING certificate was not found." }
    $mushavoCertValue = (Resolve-Path -LiteralPath $mushavoCert).ProviderPath.Replace('\', '/').Replace("'", "\'")
    $mushavoConnection = @(
        "host=aws-0-eu-west-1.pooler.supabase.com", "port=5432", "dbname=postgres",
        "user=postgres.dczlddwbtgvfdujgcitb", "sslmode=verify-full",
        "sslrootcert='$mushavoCertValue'", "gssencmode=disable", "connect_timeout=15",
        "application_name=mushavo_stage_1_4_2_synthetic_export", "options='-c client_encoding=UTF8'"
    ) -join " "
    $mushavoRun = Join-Path $mushavoRoot ("SyntheticSource-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoRun | Out-Null
    $mushavoSqlFile = Join-Path $mushavoRun "source-probe.sql"
    [IO.File]::WriteAllText($mushavoSqlFile, $env:MUSHAVO_SYNTHETIC_EXPORT_SQL, [Text.UTF8Encoding]::new($false))
    function Read-MushavoSyntheticSnapshot([string]$mushavoOutputFile) {
        Write-Output "Enter the STAGING database password at the psql prompt."
        & (Join-Path $mushavoPgBin "psql.exe") --no-psqlrc --password --quiet --tuples-only --no-align `
            --set=ON_ERROR_STOP=1 --dbname $mushavoConnection --file $mushavoSqlFile --output $mushavoOutputFile
        if ($LASTEXITCODE -ne 0) { throw "Synthetic source guard failed. Export is not verified; keep the private run folder." }
    }
    $mushavoBeforeFile = Join-Path $mushavoRun "source-before.json"
    Read-MushavoSyntheticSnapshot $mushavoBeforeFile
    $mushavoBefore = Get-Content -LiteralPath $mushavoBeforeFile -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($mushavoBefore.project -ne "dczlddwbtgvfdujgcitb" -or $mushavoBefore.synthetic_guard_passed -ne $true) {
        throw "Source guard metadata was not accepted."
    }
    $mushavoPartial = Join-Path $mushavoRun "staging-public.partial.dump"
    $mushavoFinal = Join-Path $mushavoRun "staging-public.dump"
    Write-Output "Enter the STAGING database password at the pg_dump prompt."
    & (Join-Path $mushavoPgBin "pg_dump.exe") --format=custom --schema=public --strict-names `
        --no-large-objects --lock-wait-timeout=30000 --password --dbname $mushavoConnection --file $mushavoPartial
    if ($LASTEXITCODE -ne 0) { throw "Public schema export failed. Keep the partial file." }
    $mushavoToc = & (Join-Path $mushavoPgBin "pg_restore.exe") --list $mushavoPartial
    if ($LASTEXITCODE -ne 0) { throw "Archive listing failed. Keep the partial file." }
    $mushavoTocText = $mushavoToc | Out-String
    foreach ($mushavoTable in @("payment_items", "payment_records", "budget_workspaces")) {
        if ($mushavoTocText -notmatch ("(?m)^\d+; \d+ \d+ TABLE DATA public " + $mushavoTable + " ")) {
            throw "Required synthetic table-data entry is missing."
        }
    }
    $mushavoNonPublic = @($mushavoToc | Where-Object { $_ -match '^\d+; \d+ \d+ TABLE DATA ' -and $_ -notmatch ' TABLE DATA public ' })
    if ($mushavoNonPublic.Count -ne 0) { throw "Unexpected non-public table data in the archive." }
    & (Join-Path $mushavoPgBin "pg_restore.exe") --file=NUL $mushavoPartial
    if ($LASTEXITCODE -ne 0) { throw "Offline archive payload decoding failed. Keep the partial file." }
    $mushavoAfterFile = Join-Path $mushavoRun "source-after.json"
    Read-MushavoSyntheticSnapshot $mushavoAfterFile
    if ((Get-FileHash -LiteralPath $mushavoBeforeFile -Algorithm SHA256).Hash -ne
        (Get-FileHash -LiteralPath $mushavoAfterFile -Algorithm SHA256).Hash) {
        throw "Selected synthetic rows/schema metadata changed during export. Keep files; no verified result was issued."
    }
    Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
    $mushavoTocFile = Join-Path $mushavoRun "staging-public.toc.txt"
    $mushavoToc | Set-Content -LiteralPath $mushavoTocFile -Encoding UTF8
    $mushavoDummy = Join-Path $mushavoRun "synthetic-attachment.txt"
    [IO.File]::WriteAllText($mushavoDummy, "Mushavo Budget 1.4 synthetic attachment. No customer data.`n", [Text.UTF8Encoding]::new($false))
    $mushavoFiles = @($mushavoFinal, $mushavoBeforeFile, $mushavoAfterFile, $mushavoTocFile, $mushavoDummy)
    $mushavoHashes = @($mushavoFiles | ForEach-Object {
        [pscustomobject]@{ name = [IO.Path]::GetFileName($_); bytes = (Get-Item -LiteralPath $_).Length;
            sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash }
    })
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.4.2"; result = "SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS"
        project = "dczlddwbtgvfdujgcitb"; completed_utc = [DateTime]::UtcNow.ToString("o")
        run_directory = $mushavoRun; archive_bytes = (Get-Item -LiteralPath $mushavoFinal).Length
        synthetic_auth_identities = 2; synthetic_payment_items = 1; synthetic_paid_records = 1
        synthetic_personal_workspaces = 2
        public_table_data_entries = @($mushavoToc | Where-Object { $_ -match ' TABLE DATA public ' }).Count
        selected_source_rows_and_relation_metadata_unchanged = $true
        archive_payload_decoded_offline = $true; private_file_hash_manifest_created = $true
        dummy_file_created_locally = $true; storage_service_or_file_backup_verified = $false
        auth_passwords_exported = $false
        public_acl_entries = @($mushavoToc | Where-Object { $_ -match ' ACL public ' }).Count
        separate_source_checks_share_dump_snapshot = $false; all_public_data_drift_checked = $false
        hosted_database_modified = $false; local_server_started = $false
        isolated_restore_verified = $false; full_platform_recovery_verified = $false
        offsite_copy_verified = $false
    }
    [pscustomobject]@{ summary = $mushavoSummary; files = $mushavoHashes; restore_target = $mushavoReady;
        scope = "Public application archive including ACL/RLS; Auth identity-only bootstrap, dummy file. External dependencies must be adapted explicitly before restore; not hosted Auth/Storage recovery." } |
        ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $mushavoRun "source-manifest.json") -Encoding UTF8
    $mushavoSummary | ConvertTo-Json -Depth 4
    Write-Output "Send only the final summary or redacted error. Keep files/hashes private. No restore or upload was performed."
}
