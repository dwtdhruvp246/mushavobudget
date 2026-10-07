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
        publication_definitions = @($mushavoEntries | Where-Object { $_ -match '^PUBLICATION ' }).Count
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
