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
