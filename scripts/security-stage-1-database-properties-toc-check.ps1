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
