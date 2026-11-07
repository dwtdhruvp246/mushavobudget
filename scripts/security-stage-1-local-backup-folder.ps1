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
