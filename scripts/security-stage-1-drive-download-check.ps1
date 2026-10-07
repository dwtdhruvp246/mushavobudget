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
