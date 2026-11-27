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
    $mushavoProject = "C:\Users\HP\Desktop\Mushavo Budget"
    $mushavoNode = Get-Command -Name "node.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoGit = Get-Command -Name "git.exe" -CommandType Application -ErrorAction Stop | Select-Object -First 1
    & $mushavoGit.Source -C $mushavoProject fetch origin security/stage-1-foundations
    if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
    $mushavoBlob = & $mushavoGit.Source -C $mushavoProject rev-parse "FETCH_HEAD:scripts/security-stage-1-role-coverage.cjs"
    if ($LASTEXITCODE -ne 0 -or ($mushavoBlob | Out-String).Trim() -ne "7e7aa5f6cb1463fb5141939b2b847d9bcd880502") {
        throw "Fetched checker differs from this reviewed version. Send the error only."
    }
    $mushavoCode = & $mushavoGit.Source -C $mushavoProject show "FETCH_HEAD:scripts/security-stage-1-role-coverage.cjs" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoCode)) { throw "Checker read failed." }
    $mushavoLocalTool = Join-Path $mushavoBackupRoot ("RoleCoverageTool-" + [guid]::NewGuid().ToString("N") + ".cjs")
    [IO.File]::WriteAllText($mushavoLocalTool, $mushavoCode, [Text.UTF8Encoding]::new($false))
    & $mushavoNode.Source $mushavoLocalTool $mushavoBackupRoot
    $mushavoCheckExit = $LASTEXITCODE
    if ($mushavoCheckExit -ne 0 -and $mushavoCheckExit -ne 2) { throw "Local checker failed unexpectedly." }
    Write-Output "Send only the JSON summary and redacted warnings/errors. Keep SQL, manifests, receipts, hashes and values private."
    Write-Output "No SQL was executed or uploaded. Existing backup files remain retained; Google stays deferred."
}
