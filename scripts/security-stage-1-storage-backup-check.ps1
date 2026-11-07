& {
    $ErrorActionPreference = "Stop"
    $mushavoBackupRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavo7Zip = "C:\Program Files\7-Zip\7z.exe"
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
    if (-not (Test-Path -LiteralPath $mushavo7Zip -PathType Leaf)) { throw "Verified 7-Zip executable was not found." }
    if (Test-Path Env:MUSHAVO_STORAGE_BACKUP_KEY) { throw "The task credential variable already exists. Keep its value private and send this error only." }
    $mushavoProject = "C:\Users\HP\Desktop\Mushavo Budget"
    $mushavoNode = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoGit = Get-Command -Name "git.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $mushavoGit.Source -C $mushavoProject fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoObject = "FETCH_HEAD:scripts/security-stage-1-storage-backup.cjs"
    $mushavoBlob = & $mushavoGit.Source -C $mushavoProject rev-parse $mushavoObject
    if ($LASTEXITCODE -ne 0 -or ($mushavoBlob | Out-String).Trim() -ne "1c6d1ca70be9d285b19042eb4f0ab3830fd8f156") {
        throw "Fetched helper differs from this reviewed version. Send the error only."
    }
    $mushavoCode = & $mushavoGit.Source -C $mushavoProject show $mushavoObject | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCode)) { throw "Helper read failed." }
    $mushavoToolRoot = Join-Path $mushavoBackupRoot ("StorageTool-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoToolRoot | Out-Null
    $mushavoTool = Join-Path $mushavoToolRoot "storage-backup.cjs"
    [IO.File]::WriteAllText($mushavoTool, $mushavoCode, [Text.UTF8Encoding]::new($false))

    Write-Output "Copy an existing Supabase secret key (or legacy service_role key) from this project's Settings > API Keys."
    Write-Output "Paste it ONLY at the masked local prompt below. This is not the database password or backup passphrase."
    $mushavoSecret = Read-Host "Supabase secret key for kttkospkblwvguuwnhjj" -AsSecureString
    $mushavoSecretPointer = [IntPtr]::Zero
    try {
        $mushavoSecretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoSecret)
        $env:MUSHAVO_STORAGE_BACKUP_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoSecretPointer)
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoSecretPointer)
        $mushavoSecretPointer = [IntPtr]::Zero
        Set-Clipboard -Value "Mushavo Budget: credential removed from clipboard."
        Write-Output "Running one bounded Storage inventory/download pass, then native encrypted-package verification."
        & $mushavoNode.Source $mushavoTool $mushavoBackupRoot $mushavo7Zip
        $mushavoStorageExit = $LASTEXITCODE
        if ($mushavoStorageExit -ne 0 -and $mushavoStorageExit -ne 2) {
            throw "Storage helper failed unexpectedly. Send the redacted error only."
        }
    } finally {
        Remove-Item Env:MUSHAVO_STORAGE_BACKUP_KEY -ErrorAction SilentlyContinue
        if ($mushavoSecretPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoSecretPointer)
        }
        $mushavoSecret.Dispose()
    }
    Write-Output "Send only the final JSON summary or redacted error. Keep keys, passphrases, manifests, files and hashes private."
    Write-Output "If REVIEW/BLOCKED, keep partial artifacts; we record the gap and move to configuration inventory."
}
