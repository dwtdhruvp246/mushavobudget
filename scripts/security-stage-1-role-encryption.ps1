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
