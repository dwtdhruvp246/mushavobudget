# 1.4.1: creates one NEW local cluster; no existing PostgreSQL service is changed.
& {
    $ErrorActionPreference = "Stop"
    $PSNativeCommandUseErrorActionPreference = $false
    if ([string]::IsNullOrWhiteSpace($env:MUSHAVO_LOCAL_RECOVERY_PROBE_SQL)) { throw "Recovery metadata SQL was not provided." }
    $mushavoPgBin = "C:\Program Files\PostgreSQL\17\bin"
    foreach ($mushavoTool in @("initdb", "pg_ctl", "postgres", "psql")) {
        if (-not (Test-Path -LiteralPath (Join-Path $mushavoPgBin "$mushavoTool.exe") -PathType Leaf)) {
            throw "Required PostgreSQL executable is missing: $mushavoTool"
        }
    }
    $mushavoLocalBase = [Environment]::GetFolderPath("LocalApplicationData")
    if ([string]::IsNullOrWhiteSpace($mushavoLocalBase)) { throw "Local application-data folder was not found." }
    $mushavoDrive = [IO.Path]::GetPathRoot($mushavoLocalBase).Substring(0, 2)
    $mushavoDisk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='$mushavoDrive'"
    if (-not $mushavoDisk -or $mushavoDisk.DriveType -ne 3 -or $mushavoDisk.FileSystem -ne "NTFS" -or $mushavoDisk.FreeSpace -lt 1GB) {
        throw "A fixed local NTFS drive with at least 1 GiB free is required."
    }
    $mushavoAncestor = Get-Item -LiteralPath $mushavoLocalBase -Force
    while ($null -ne $mushavoAncestor) {
        if ($mushavoAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Recovery parent path is redirected." }
        $mushavoAncestor = $mushavoAncestor.Parent
    }
    $mushavoPort = 55439
    $mushavoListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $mushavoPort)
    try { $mushavoListener.Start() } catch { throw "Local port 55439 is occupied. No target was initialized." }
    finally { $mushavoListener.Stop() }

    $mushavoRoot = Join-Path $mushavoLocalBase ("MushavoBudget-Local-Recovery-" + [guid]::NewGuid().ToString("N"))
    if (Test-Path -LiteralPath $mushavoRoot) { throw "Expected a new recovery directory." }
    New-Item -ItemType Directory -Path $mushavoRoot | Out-Null
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = [Security.AccessControl.DirectorySecurity]::new()
    $mushavoAcl.SetOwner($mushavoOwnerSid)
    $mushavoAcl.SetAccessRuleProtection($true, $false)
    foreach ($mushavoSidValue in $mushavoAllowedSids) {
        $mushavoAcl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(
            [Security.Principal.SecurityIdentifier]::new($mushavoSidValue),
            [Security.AccessControl.FileSystemRights]::FullControl,
            [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit",
            [Security.AccessControl.PropagationFlags]::None,
            [Security.AccessControl.AccessControlType]::Allow
        ))
    }
    Set-Acl -LiteralPath $mushavoRoot -AclObject $mushavoAcl
    $mushavoCheck = Get-Acl -LiteralPath $mushavoRoot
    $mushavoRules = $mushavoCheck.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $mushavoCheck.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoCheck.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) {
        throw "Recovery-folder ownership or protected permissions did not match."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or $mushavoRule.IsInherited -or
            $mushavoRule.AccessControlType -ne "Allow" -or $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") { throw "Unexpected recovery-folder permission." }
    }
    $mushavoData = Join-Path $mushavoRoot "data"
    $mushavoPgCtl = Join-Path $mushavoPgBin "pg_ctl.exe"
    $mushavoStartAttempted = $false
    $mushavoProbe = $null
    try {
        Write-Output "Choose and privately save a NEW LOCAL recovery-admin password at the initdb prompts."
        & (Join-Path $mushavoPgBin "initdb.exe") --pgdata $mushavoData `
            --username=mushavo_restore_admin --auth-host=scram-sha-256 `
            --auth-local=scram-sha-256 --encoding=UTF8 --locale=C `
            --data-checksums --no-instructions --pwprompt
        if ($LASTEXITCODE -ne 0) { throw "Local initialization failed. Retain the new folder; send the error only." }
        $mushavoLocalSettings = "`nlisten_addresses = '127.0.0.1'`nport = 55439`nssl = off`n"
        [IO.File]::AppendAllText((Join-Path $mushavoData "postgresql.conf"), $mushavoLocalSettings, [Text.UTF8Encoding]::new($false))
        $mushavoStartAttempted = $true
        & $mushavoPgCtl start -D $mushavoData -l (Join-Path $mushavoRoot "server.log") -w -t 30
        if ($LASTEXITCODE -ne 0) { throw "New local recovery server failed to start." }
        $mushavoProbeFile = Join-Path $mushavoRoot "target-probe.sql"
        [IO.File]::WriteAllText($mushavoProbeFile, $env:MUSHAVO_LOCAL_RECOVERY_PROBE_SQL, [Text.UTF8Encoding]::new($false))
        if ([string]::IsNullOrWhiteSpace($env:MUSHAVO_LOCAL_RECOVERY_PROBE_SQL)) { throw "Recovery metadata SQL was not provided." }
        $mushavoConnection = "host=127.0.0.1 port=55439 dbname=postgres user=mushavo_restore_admin sslmode=disable gssencmode=disable connect_timeout=10"
        Write-Output "Enter the NEW LOCAL recovery-admin password again for the readiness check."
        $mushavoProbeOutput = & (Join-Path $mushavoPgBin "psql.exe") --no-psqlrc --password --quiet `
            --tuples-only --no-align --set=ON_ERROR_STOP=1 --dbname $mushavoConnection --file $mushavoProbeFile
        if ($LASTEXITCODE -ne 0) { throw "Local metadata connection/check failed." }
        $mushavoProbe = ($mushavoProbeOutput | Out-String).Trim() | ConvertFrom-Json
        $mushavoActualData = [IO.Path]::GetFullPath($mushavoProbe.data_directory.Replace('/', '\')).TrimEnd('\')
        if ($mushavoActualData -ne [IO.Path]::GetFullPath($mushavoData).TrimEnd('\') -or
            $mushavoProbe.user -ne "mushavo_restore_admin" -or $mushavoProbe.database -ne "postgres" -or
            $mushavoProbe.server_version_num -lt 170011 -or $mushavoProbe.server_version_num -ge 180000 -or
            $mushavoProbe.listen_addresses -ne "127.0.0.1" -or $mushavoProbe.port -ne 55439 -or
            ($mushavoProbe.connected_address -ne "127.0.0.1/32" -and $mushavoProbe.connected_address -ne "127.0.0.1") -or
            $mushavoProbe.hba_parse_errors -ne 0 -or $mushavoProbe.hba_rule_count -lt 1 -or
            $mushavoProbe.all_hba_rules_scram -ne $true -or $mushavoProbe.public_relation_count -ne 0 -or
            $mushavoProbe.auth_schema_exists -ne $false -or $mushavoProbe.storage_schema_exists -ne $false) {
            throw "New cluster identity, local-only authentication or empty scope check did not match."
        }
    }
    finally {
        if ($mushavoStartAttempted) {
            & $mushavoPgCtl status -D $mushavoData *> $null
            $mushavoStatusCode = $LASTEXITCODE
            if ($mushavoStatusCode -eq 0) {
                & $mushavoPgCtl stop -D $mushavoData -m fast -w -t 30
                if ($LASTEXITCODE -ne 0) { throw "New recovery server shutdown failed; retain folder and report this error." }
            }
            elseif ($mushavoStatusCode -ne 3) { throw "New recovery server status could not be established." }
            & $mushavoPgCtl status -D $mushavoData *> $null
            if ($LASTEXITCODE -ne 3) { throw "New recovery server is not confirmed stopped." }
        }
    }
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.4.1"
        result = "NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED"
        completed_utc = [DateTime]::UtcNow.ToString("o")
        root = $mushavoRoot
        data_directory = $mushavoData
        host = "127.0.0.1"
        port = 55439
        admin_user = "mushavo_restore_admin"
        server_version = $mushavoProbe.server_version
        owner_system_admins_only_folder_permissions = $true
        authentication = "scram-sha-256"
        empty_application_scope = $true
        pgcrypto_available = $mushavoProbe.pgcrypto_available
        managed_extensions_available = @($mushavoProbe.managed_extensions_available)
        server_stopped = $true
        existing_databases_modified = $false
        staging_or_production_connected = $false
        synthetic_export_or_restore_performed = $false
        full_platform_recovery_verified = $false
    }
    $mushavoSummary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $mushavoRoot "target-preparation.json") -Encoding UTF8
    $mushavoSummary | ConvertTo-Json -Depth 4
    Write-Output "Send only this final summary and redacted errors. Privately retain the new local password and folder."
}
