& {
    $ErrorActionPreference = "Stop"
    $mushavoRoot = "C:\Users\HP\AppData\Local\MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $mushavoDumpAll = "C:\Program Files\PostgreSQL\17\bin\pg_dumpall.exe"
    $mushavoCert = "C:\Users\HP\Desktop\Mushavo Budget\prod-ca-2021.crt"
    foreach ($mushavoRequired in @($mushavoDumpAll, $mushavoCert)) {
        if (-not (Test-Path -LiteralPath $mushavoRequired -PathType Leaf)) {
            throw "A required verified PostgreSQL executable/certificate is missing."
        }
    }
    $mushavoFolder = Get-Item -LiteralPath $mushavoRoot -Force
    if (-not $mushavoFolder.PSIsContainer) { throw "Private backup folder was not found." }
    $mushavoParent = $mushavoFolder
    while ($null -ne $mushavoParent) {
        if ($mushavoParent.Attributes -band [IO.FileAttributes]::ReparsePoint) {
            throw "Backup path contains a redirected directory."
        }
        $mushavoParent = $mushavoParent.Parent
    }
    $mushavoOwner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowed = @($mushavoOwner.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoRoot
    $mushavoRules = $mushavoAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwner.Value) {
        throw "Private folder owner or protected permissions changed."
    }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowed -or $mushavoRule.IsInherited -or
            $mushavoRule.AccessControlType -ne "Allow" -or $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") {
            throw "Unexpected private folder permission."
        }
    }
    $mushavoRun = [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ") + "-" + [guid]::NewGuid().ToString("N")
    $mushavoPartial = Join-Path $mushavoRoot "$mushavoRun.partial.roles.sql"
    $mushavoFinal = Join-Path $mushavoRoot "$mushavoRun.roles.sql"
    $mushavoManifest = Join-Path $mushavoRoot "$mushavoRun.roles.manifest.json"
    $mushavoCertValue = (Resolve-Path -LiteralPath $mushavoCert).ProviderPath.Replace('\', '/').Replace("'", "\'")
    $mushavoConnection = @(
        "host=aws-0-eu-central-1.pooler.supabase.com", "port=5432",
        "user=postgres.kttkospkblwvguuwnhjj", "sslmode=verify-full",
        "sslrootcert='$mushavoCertValue'", "gssencmode=disable", "connect_timeout=15",
        "application_name=mushavo_stage_1_2_roles"
    ) -join " "
    Write-Output "Enter the database password only at pg_dumpall's native prompt."
    Write-Output "Keep this role/settings export private in the existing local backup folder."
    $ErrorActionPreference = "Continue"
    & $mushavoDumpAll --roles-only --no-role-passwords --quote-all-identifiers --encoding=UTF8 --password `
        --database=postgres --dbname $mushavoConnection --file $mushavoPartial
    $mushavoExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($mushavoExit -ne 0) {
        throw "Role export failed (exit $mushavoExit). Keep the partial file; send only redacted errors."
    }
    $mushavoFile = Get-Item -LiteralPath $mushavoPartial -Force
    if ($mushavoFile.Length -le 0) { throw "Role export is empty; file stays partial." }
    $mushavoText = [IO.File]::ReadAllText($mushavoPartial, [Text.Encoding]::UTF8)
    if ($mushavoText -notmatch '(?m)^-- PostgreSQL database cluster dump complete\r?$') {
        throw "Native completion marker missing; file stays partial."
    }
    $mushavoRoles = @("anon", "authenticated", "authenticator", "dashboard_user", "pgbouncer", "postgres", "service_role",
        "supabase_admin", "supabase_auth_admin", "supabase_etl_admin", "supabase_functions_admin", "supabase_privileged_role",
        "supabase_read_only_user", "supabase_realtime_admin", "supabase_replication_admin", "supabase_storage_admin")
    $mushavoCreateCount = [regex]::Matches($mushavoText, '(?m)^CREATE ROLE ').Count
    if ($mushavoCreateCount -ne 16) { throw "Role count differs from the latest 16-role inventory; keep partial for review." }
    foreach ($mushavoRole in $mushavoRoles) {
        $mushavoPattern = '(?m)^CREATE ROLE "' + [regex]::Escape($mushavoRole) + '";\r?$'
        if ([regex]::Matches($mushavoText, $mushavoPattern).Count -ne 1) {
            throw "An expected inventoried role definition is missing/duplicated; file stays partial."
        }
    }
    if ($mushavoText -match '(?m)^ALTER ROLE .* WITH .*\bPASSWORD\b') {
        throw "Unexpected role-password clause; keep the file private and partial."
    }
    $mushavoMembershipCount = [regex]::Matches($mushavoText, '(?m)^GRANT (?![^\r\n]* ON )').Count
    $mushavoParameterCount = [regex]::Matches($mushavoText, '(?m)^(GRANT|REVOKE) [^\r\n]* ON PARAMETER ').Count
    Move-Item -LiteralPath $mushavoPartial -Destination $mushavoFinal
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.2"
        result = "ROLE_EXPORT_NATIVE_COMPLETION_AND_MARKERS_PASS"
        project = "kttkospkblwvguuwnhjj"
        completed_utc = [DateTime]::UtcNow.ToString("o")
        file = $mushavoFinal
        bytes = (Get-Item -LiteralPath $mushavoFinal).Length
        inventoried_role_definitions = $mushavoCreateCount
        membership_grant_statements = $mushavoMembershipCount
        parameter_acl_statements = $mushavoParameterCount
        role_password_export_disabled = $true
        exact_membership_flags_and_settings_recovery_verified = $false
        database_scoped_role_settings_reconciled = $false
        encrypted_roles_package_created = $false
        complete_platform_backup_verified = $false
        isolated_restore_verified = $false
    }
    [pscustomobject]@{
        summary = $mushavoSummary
        file_sha256 = (Get-FileHash -LiteralPath $mushavoFinal -Algorithm SHA256).Hash
        source_metadata_checked_utc = "2026-10-08T04:04:45.322523Z"
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $mushavoManifest -Encoding UTF8
    $mushavoSummary | Format-List
    Write-Output "Send only this summary and redacted warnings/errors. Keep SQL, settings values and hashes private."
    Write-Output "Next: private encryption/file verification. No roles/grants/settings were restored or changed."
}
