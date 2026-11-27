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
