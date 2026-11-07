# 1.4.3: restore only into the prepared native loopback target; no hosted connection.
& {
    $ErrorActionPreference = "Stop"
    $PSNativeCommandUseErrorActionPreference = $false
    foreach ($mushavoRequiredEnv in @("MUSHAVO_SYNTHETIC_SOURCE", "MUSHAVO_RESTORE_HELPER_CODE", "MUSHAVO_LOCAL_RECOVERY_PROBE_SQL")) {
        if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($mushavoRequiredEnv))) {
            throw "Pinned restore helper, probe and private source directory are required."
        }
    }
    $mushavoSource = (Get-Item -LiteralPath $env:MUSHAVO_SYNTHETIC_SOURCE -Force).FullName
    $mushavoRoot = [IO.Path]::GetDirectoryName($mushavoSource)
    if ([IO.Path]::GetDirectoryName($mushavoRoot) -ne [Environment]::GetFolderPath("LocalApplicationData") -or
        [IO.Path]::GetFileName($mushavoRoot) -notmatch '^MushavoBudget-Local-Recovery-[0-9a-f]{32}$' -or
        [IO.Path]::GetFileName($mushavoSource) -notmatch '^SyntheticSource-[0-9a-f]{32}$') {
        throw "Expected the completed synthetic source under the prepared recovery root."
    }
    $mushavoAncestor = Get-Item -LiteralPath $mushavoSource -Force
    while ($null -ne $mushavoAncestor) {
        if ($mushavoAncestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Private source or ancestor is redirected." }
        $mushavoAncestor = $mushavoAncestor.Parent
    }
    $mushavoOwnerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $mushavoAllowedSids = @($mushavoOwnerSid.Value, "S-1-5-18", "S-1-5-32-544")
    $mushavoAcl = Get-Acl -LiteralPath $mushavoRoot
    $mushavoRules = $mushavoAcl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    if (-not $mushavoAcl.AreAccessRulesProtected -or $mushavoRules.Count -ne 3 -or
        $mushavoAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $mushavoOwnerSid.Value) { throw "Private root owner/permissions changed." }
    foreach ($mushavoRule in $mushavoRules) {
        if ($mushavoRule.IdentityReference.Value -notin $mushavoAllowedSids -or $mushavoRule.IsInherited -or
            $mushavoRule.AccessControlType -ne "Allow" -or $mushavoRule.FileSystemRights -ne "FullControl" -or
            $mushavoRule.InheritanceFlags -ne [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit" -or
            $mushavoRule.PropagationFlags -ne "None") { throw "Unexpected private root permissions." }
    }
    $mushavoReady = Get-Content -LiteralPath (Join-Path $mushavoRoot "target-preparation.json") -Raw -Encoding UTF8 | ConvertFrom-Json
    $mushavoData = Join-Path $mushavoRoot "data"
    $mushavoDataItem = Get-Item -LiteralPath $mushavoData -Force
    if (-not $mushavoDataItem.PSIsContainer -or
        ($mushavoDataItem.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Prepared data directory is missing or redirected." }
    if ($mushavoReady.result -ne "NEW_LOCAL_RECOVERY_TARGET_READY_AND_STOPPED" -or
        $mushavoReady.root -ne $mushavoRoot -or $mushavoReady.data_directory -ne $mushavoData -or
        $mushavoReady.host -ne "127.0.0.1" -or $mushavoReady.port -ne 55439 -or
        $mushavoReady.admin_user -ne "mushavo_restore_admin") { throw "Prepared target receipt does not match." }
    $mushavoPgBin = "C:\Program Files\PostgreSQL\17\bin"
    foreach ($mushavoTool in @("pg_ctl", "pg_restore", "psql")) {
        if (-not (Test-Path -LiteralPath (Join-Path $mushavoPgBin "$mushavoTool.exe") -PathType Leaf)) { throw "Required native tool missing." }
    }
    $mushavoNode = Get-Command -Name node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $mushavoPgCtl = Join-Path $mushavoPgBin "pg_ctl.exe"
    & $mushavoPgCtl status -D $mushavoData *> $null
    if ($LASTEXITCODE -ne 3) { throw "Prepared cluster is not confirmed stopped. No restore started." }
    $mushavoListener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, 55439)
    try { $mushavoListener.Start() } catch { throw "Local port 55439 is occupied. No restore started." }
    finally { $mushavoListener.Stop() }
    $mushavoRun = Join-Path $mushavoRoot ("SyntheticRestore-" + [guid]::NewGuid().ToString("N"))
    New-Item -ItemType Directory -Path $mushavoRun | Out-Null
    $mushavoHelper = Join-Path $mushavoRun "restore-helper.cjs"
    [IO.File]::WriteAllText($mushavoHelper, $env:MUSHAVO_RESTORE_HELPER_CODE, [Text.UTF8Encoding]::new($false))
    $mushavoClock = [Diagnostics.Stopwatch]::StartNew()
    $mushavoStarted = $false; $mushavoStopped = $true; $mushavoCommitted = $false
    $mushavoFileMatched = $false; $mushavoSourceUnchanged = $false; $mushavoProblem = $null
    $mushavoPhase = "private_input_preparation"; $mushavoValidation = $null; $mushavoPlan = $null
    try {
        $env:MUSHAVO_RESTORE_RUN = $mushavoRun
        $mushavoPlanOutput = & $mushavoNode.Source $mushavoHelper
        if ($LASTEXITCODE -ne 0) { throw "PRIVATE_INPUT_PREPARATION_FAILED" }
        $mushavoPlan = ($mushavoPlanOutput | Out-String).Trim() | ConvertFrom-Json
        $mushavoSourceReceipt = Join-Path $mushavoSource "source-manifest.json"
        $mushavoSourceReceiptHash = (Get-FileHash -LiteralPath $mushavoSourceReceipt -Algorithm SHA256).Hash
        $mushavoRestoreSql = Join-Path $mushavoRun "restored-public.sql"
        & (Join-Path $mushavoPgBin "pg_restore.exe") --no-owner --no-comments --no-security-labels `
            --use-list (Join-Path $mushavoRun "restore.toc.txt") --file $mushavoRestoreSql `
            (Join-Path $mushavoSource "staging-public.dump")
        if ($LASTEXITCODE -ne 0) { throw "PRIVATE_ARCHIVE_SQL_RENDER_FAILED" }
        # No reconnect or shell meta-command is accepted in the rendered script.
        $mushavoSqlText = Get-Content -LiteralPath $mushavoRestoreSql -Raw -Encoding UTF8
        if ($mushavoSqlText -match '(?m)^\s*\\(?:connect|c(?:\s|$)|!|i(?:\s|$)|ir(?:\s|$)|o(?:\s|$)|gexec(?:\s|$))') {
            throw "UNEXPECTED_RENDERED_PSQL_COMMAND"
        }
        $mushavoSqlInputs = @((Join-Path $mushavoRun "restore-bootstrap.sql"), $mushavoRestoreSql,
            (Join-Path $mushavoRun "restore-validation.sql"))
        $mushavoSqlHashes = @($mushavoSqlInputs | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash })
        $mushavoPhase = "local_startup_and_identity"
        $mushavoStarted = $true; $mushavoStopped = $false
        & $mushavoPgCtl start -D $mushavoData -l (Join-Path $mushavoRun "server.log") -w -t 30
        if ($LASTEXITCODE -ne 0) { throw "PREPARED_LOCAL_CLUSTER_START_FAILED" }
        $mushavoProbeFile = Join-Path $mushavoRun "local-probe.sql"
        [IO.File]::WriteAllText($mushavoProbeFile, $env:MUSHAVO_LOCAL_RECOVERY_PROBE_SQL, [Text.UTF8Encoding]::new($false))
        $mushavoConnection = "host=127.0.0.1 port=55439 dbname=postgres user=mushavo_restore_admin sslmode=disable gssencmode=disable connect_timeout=10 options='-c client_encoding=UTF8'"
        $mushavoProbeOutput = Join-Path $mushavoRun "local-before.json"
        Write-Output "Enter the LOCAL mushavo_restore_admin password for the target check."
        & (Join-Path $mushavoPgBin "psql.exe") --no-psqlrc --password --quiet --tuples-only --no-align `
            --set=ON_ERROR_STOP=1 --set=VERBOSITY=terse --dbname $mushavoConnection --file $mushavoProbeFile --output $mushavoProbeOutput
        if ($LASTEXITCODE -ne 0) { throw "LOCAL_IDENTITY_PROBE_FAILED" }
        $mushavoProbe = Get-Content -LiteralPath $mushavoProbeOutput -Raw -Encoding UTF8 | ConvertFrom-Json
        if ([IO.Path]::GetFullPath($mushavoProbe.data_directory.Replace('/', '\')).TrimEnd('\') -ne [IO.Path]::GetFullPath($mushavoData).TrimEnd('\') -or
            $mushavoProbe.user -ne "mushavo_restore_admin" -or $mushavoProbe.database -ne "postgres" -or
            $mushavoProbe.server_version_num -lt 170011 -or $mushavoProbe.server_version_num -ge 180000 -or
            $mushavoProbe.port -ne 55439 -or $mushavoProbe.listen_addresses -ne "127.0.0.1" -or
            $mushavoProbe.connected_address -notin @("127.0.0.1", "127.0.0.1/32") -or
            $mushavoProbe.hba_parse_errors -ne 0 -or $mushavoProbe.all_hba_rules_scram -ne $true -or
            $mushavoProbe.public_relation_count -ne 0 -or $mushavoProbe.auth_schema_exists -ne $false -or
            $mushavoProbe.storage_schema_exists -ne $false) { throw "LOCAL_IDENTITY_OR_EMPTY_SCOPE_REJECTED" }
        & $mushavoNode.Source $mushavoHelper verify | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "PRIVATE_SOURCE_CHANGED_BEFORE_RESTORE" }
        if ((Get-FileHash -LiteralPath $mushavoSourceReceipt -Algorithm SHA256).Hash -ne $mushavoSourceReceiptHash) { throw "SOURCE_RECEIPT_CHANGED_BEFORE_RESTORE" }
        for ($mushavoIndex = 0; $mushavoIndex -lt $mushavoSqlInputs.Count; $mushavoIndex++) {
            if ((Get-FileHash -LiteralPath $mushavoSqlInputs[$mushavoIndex] -Algorithm SHA256).Hash -ne $mushavoSqlHashes[$mushavoIndex]) { throw "GENERATED_SQL_CHANGED_BEFORE_RESTORE" }
        }
        $mushavoPhase = "single_transaction_restore_and_validation"
        $mushavoExpectedDataLiteral = $mushavoProbe.data_directory.Replace("'", "''")
        $mushavoBind = "SET mushavo.restore.expected_data = '$mushavoExpectedDataLiteral';"
        $mushavoResultFile = Join-Path $mushavoRun "database-validation-output.txt"
        Write-Output "Enter the same LOCAL mushavo_restore_admin password for the restore."
        & (Join-Path $mushavoPgBin "psql.exe") --no-psqlrc --password --quiet --tuples-only --no-align `
            --single-transaction --set=ON_ERROR_STOP=1 --set=VERBOSITY=terse --dbname $mushavoConnection `
            --command $mushavoBind --file $mushavoSqlInputs[0] --file $mushavoSqlInputs[1] `
            --file $mushavoSqlInputs[2] --output $mushavoResultFile
        if ($LASTEXITCODE -ne 0) { throw "LOCAL_RESTORE_OR_VALIDATION_TRANSACTION_FAILED" }
        $mushavoCommitted = $true
        $mushavoResultLines = @(Get-Content -LiteralPath $mushavoResultFile -Encoding UTF8 | Where-Object {
            $_ -match 'SELECTED_RESTORED_VALUES_AND_ROLE_BOUNDARIES_PASS'
        })
        if ($mushavoResultLines.Count -ne 1) { throw "LOCAL_VALIDATION_SUMMARY_MISSING" }
        $mushavoValidation = $mushavoResultLines[0] | ConvertFrom-Json
        if ($mushavoValidation.effective_access_checks -ne 13 -or
            $mushavoValidation.relation_and_rls_flags_match -ne $true -or
            $mushavoValidation.selected_payment_and_workspace_values_match -ne $true) { throw "LOCAL_VALIDATION_SUMMARY_REJECTED" }
        $mushavoPhase = "dummy_file_and_source_hashes"
        $mushavoRestoredFolder = Join-Path $mushavoRun "restored-files"
        New-Item -ItemType Directory -Path $mushavoRestoredFolder | Out-Null
        $mushavoRestoredDummy = Join-Path $mushavoRestoredFolder "synthetic-attachment.txt"
        Copy-Item -LiteralPath (Join-Path $mushavoSource "synthetic-attachment.txt") -Destination $mushavoRestoredDummy
        if ((Get-FileHash -LiteralPath $mushavoRestoredDummy -Algorithm SHA256).Hash -ne
            (Get-FileHash -LiteralPath (Join-Path $mushavoSource "synthetic-attachment.txt") -Algorithm SHA256).Hash) { throw "DUMMY_FILE_RESTORED_HASH_MISMATCH" }
        $mushavoFileMatched = $true
        & $mushavoNode.Source $mushavoHelper verify | Out-Null
        if ($LASTEXITCODE -ne 0) { throw "PRIVATE_SOURCE_CHANGED_AFTER_RESTORE" }
        if ((Get-FileHash -LiteralPath $mushavoSourceReceipt -Algorithm SHA256).Hash -ne $mushavoSourceReceiptHash) { throw "SOURCE_RECEIPT_CHANGED_AFTER_RESTORE" }
        $mushavoSourceUnchanged = $true
        $mushavoPhase = "completed"
    }
    catch {
        $mushavoProblem = "LOCAL_RESTORE_WORKFLOW_ERROR"
        if ($_.Exception.Message -match '^[A-Z][A-Z0-9_]+$') { $mushavoProblem = $_.Exception.Message }
    }
    finally {
        Remove-Item Env:MUSHAVO_RESTORE_RUN -ErrorAction SilentlyContinue
        if ($mushavoStarted) {
            & $mushavoPgCtl status -D $mushavoData *> $null
            $mushavoStatus = $LASTEXITCODE
            if ($mushavoStatus -eq 0) {
                & $mushavoPgCtl stop -D $mushavoData -m fast -w -t 30
                if ($LASTEXITCODE -ne 0) { $mushavoProblem = "LOCAL_CLUSTER_SHUTDOWN_FAILED" }
            } elseif ($mushavoStatus -ne 3) { $mushavoProblem = "LOCAL_CLUSTER_STATUS_UNKNOWN" }
            & $mushavoPgCtl status -D $mushavoData *> $null
            $mushavoStopped = ($LASTEXITCODE -eq 3)
            if (-not $mushavoStopped) { $mushavoProblem = "LOCAL_CLUSTER_NOT_CONFIRMED_STOPPED" }
        }
        $mushavoClock.Stop()
    }
    $mushavoPass = -not $mushavoProblem -and $mushavoCommitted -and $mushavoFileMatched -and $mushavoSourceUnchanged -and $mushavoStopped
    $mushavoSummary = [pscustomobject]@{
        stage_step = "1.4.3"
        result = $(if ($mushavoPass) { "SYNTHETIC_NATIVE_APPLICATION_RESTORE_SCOPED_PASS" } else { "SYNTHETIC_NATIVE_APPLICATION_RESTORE_REVIEW" })
        completed_utc = [DateTime]::UtcNow.ToString("o"); run_directory = $mushavoRun
        phase = $mushavoPhase; problem_code = $mushavoProblem
        elapsed_seconds = [math]::Round($mushavoClock.Elapsed.TotalSeconds, 2)
        database_restore_transaction_committed = $mushavoCommitted
        effective_role_access_checks = $(if ($mushavoValidation) { $mushavoValidation.effective_access_checks } else { 0 })
        relation_and_rls_flags_match = $(if ($mushavoValidation) { $mushavoValidation.relation_and_rls_flags_match } else { $false })
        selected_payment_and_workspace_values_match = $(if ($mushavoValidation) { $mushavoValidation.selected_payment_and_workspace_values_match } else { $false })
        dummy_file_restored_sha256_matches = $mushavoFileMatched; source_component_hashes_unchanged = $mushavoSourceUnchanged
        local_server_stopped = $mushavoStopped
        excluded_schema_or_provider_toc_entries = $(if ($mushavoPlan) { $mushavoPlan.excluded_schema_or_provider_toc_entries } else { 0 })
        auth_identity_adapter = "SQL_SETTINGS_WITH_MINIMAL_AUTH_TABLE"
        managed_roles_adapter = "NONLOGIN_NONPRIVILEGED_PLACEHOLDERS"
        original_hosted_ownership_or_global_role_authority_recovered = $false
        storage_service_or_file_backup_verified = $false; hosted_auth_or_app_runtime_recovered = $false
        full_platform_recovery_verified = $false; offsite_copy_verified = $false
        staging_or_production_connected = $false; original_backup_files_modified = $false
    }
    $mushavoSummary | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $mushavoRun "restore-verification.json") -Encoding UTF8
    $mushavoSummary | ConvertTo-Json -Depth 5
    Write-Output "Send only this summary and redacted errors. Keep private files/passwords/hashes. Do not rerun against a committed target."
}
