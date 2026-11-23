param(
    [Parameter(Mandatory = $true)]
    [string]$StorageHelper,
    [string]$ResumeCompletedUtc
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$summary = [ordered]@{
    stage = 3
    fr = "3.3"
    batch = "production-backup"
    project = "kttkospkblwvguuwnhjj"
    result = "STOPPED_FOR_REVIEW"
    failure_step = $null
    reused_database_export = $false
    reused_verified_database_backup = $false
    database_backup_source_completed_utc = $null
    database_archive_read_verified = $false
    database_encrypted_extraction_verified = $false
    storage_encrypted_extraction_verified = $false
    storage_inventory_stable = $false
    storage_objects = $null
    storage_objects_downloaded = $null
    storage_problem_codes = @()
    storage_helper_exit_code = $null
    isolated_live_service_restore_verified = $false
    exit_code = 2
    completed_utc = $null
}

$step = "verify_private_location"
$run = $null

try {
    Write-Host "STARTED FR.3.3 production backup. All archives stay in your private Windows backup folder."
    $root = Join-Path ([Environment]::GetFolderPath("LocalApplicationData")) "MushavoBudget-Private-Backup-eb5ce347aa18442a8559acc40d2fa342"
    $folder = Get-Item -LiteralPath $root -Force
    if (-not $folder.PSIsContainer) { throw "Expected the existing protected backup directory." }

    $ancestor = $folder
    while ($null -ne $ancestor) {
        if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "The backup path is redirected." }
        $ancestor = $ancestor.Parent
    }
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    $authorized = @($owner, "S-1-5-18", "S-1-5-32-544")
    $acl = Get-Acl -LiteralPath $root
    $rules = $acl.GetAccessRules($true, $true, [Security.Principal.SecurityIdentifier])
    $inheritance = [Security.AccessControl.InheritanceFlags]"ContainerInherit,ObjectInherit"
    if (-not $acl.AreAccessRulesProtected -or $acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $owner -or $rules.Count -ne 3 -or
        @($rules | ForEach-Object { $_.IdentityReference.Value } | Sort-Object -Unique).Count -ne 3) {
        throw "The private backup directory permissions changed."
    }
    foreach ($rule in $rules) {
        if ($rule.IdentityReference.Value -notin $authorized -or $rule.IsInherited -or
            $rule.AccessControlType -ne "Allow" -or $rule.FileSystemRights -ne "FullControl" -or
            $rule.InheritanceFlags -ne $inheritance -or $rule.PropagationFlags -ne "None") {
            throw "The private backup directory permissions changed."
        }
    }
    $driveName = [IO.Path]::GetPathRoot($root).TrimEnd("\")
    $disk = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$driveName'"
    if (-not $disk -or $disk.DriveType -ne 3 -or $disk.FileSystem -ne "NTFS" -or $disk.FreeSpace -lt 1GB) {
        throw "A fixed NTFS drive with at least 1 GiB free is required."
    }

    $step = "verify_7zip"
    $zip = Join-Path $env:ProgramFiles "7-Zip\7z.exe"
    if (-not (Test-Path -LiteralPath $zip -PathType Leaf)) {
        $zip = (Get-Command 7z.exe -CommandType Application -ErrorAction Stop).Source
    }
    if (-not (Test-Path -LiteralPath $zip -PathType Leaf)) { throw "7-Zip was unavailable." }

    $step = "verify_node"
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1).Source

    $step = "verify_storage_helper"
    if ((Get-FileHash -LiteralPath $StorageHelper -Algorithm SHA256).Hash -ne "4E8955F83A8D919C856F6C9932F54EB7EFC6DDA3A744667BAF83C0FFCF0AB4B2") {
        throw "The Storage helper does not match the reviewed source."
    }

    $step = "verify_credential_and_tls_environment"
    if ((Test-Path Env:MUSHAVO_STORAGE_BACKUP_KEY) -or $env:NODE_TLS_REJECT_UNAUTHORIZED -eq "0") {
        throw "A pre-existing backup credential or TLS override needs local review."
    }

    $step = "prepare_output"
    $run = Join-Path $root ("FR33-Production-" + [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ") + "-" + [guid]::NewGuid().ToString("N"))
    $database = Join-Path $run "Database"
    New-Item -ItemType Directory -Path $run | Out-Null
    New-Item -ItemType Directory -Path $database | Out-Null

    $previousRun = $null
    if ($ResumeCompletedUtc) {
        $step = "locate_previous_export"
        $resumeTime = [DateTimeOffset]::Parse($ResumeCompletedUtc, [Globalization.CultureInfo]::InvariantCulture)
        $match = @(
            foreach ($candidate in Get-ChildItem -LiteralPath $root -Directory -Filter "FR33-Production-*") {
                if ($candidate.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }
                $receiptPath = Join-Path $candidate.FullName "safe-summary.json"
                $receiptFile = Get-Item -LiteralPath $receiptPath -ErrorAction SilentlyContinue
                if (-not $receiptFile -or $receiptFile.PSIsContainer -or ($receiptFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) { continue }
                try {
                    $receipt = Get-Content -LiteralPath $receiptPath -Raw | ConvertFrom-Json
                    $when = [DateTimeOffset]$receipt.completed_utc
                    if ($when -eq $resumeTime -and $receipt.project -eq $summary.project -and
                        $receipt.fr -eq $summary.fr -and $receipt.batch -eq $summary.batch -and
                        $receipt.result -eq "STOPPED_FOR_REVIEW" -and $receipt.database_archive_read_verified -eq $true -and
                        (($receipt.database_encrypted_extraction_verified -eq $false -and
                          [string]$receipt.failure_step -like "database_encryption*") -or
                         ($receipt.database_encrypted_extraction_verified -eq $true -and
                          [string]$receipt.failure_step -like "storage_*"))) {
                        [pscustomobject]@{ Folder = $candidate; Receipt = $receipt }
                    }
                } catch { continue }
            }
        )
        if ($match.Count -ne 1) { throw "No unique verified export matched the supplied backup receipt." }
        $previousRun = $match[0]
        $previousDatabase = Get-Item -LiteralPath (Join-Path $previousRun.Folder.FullName "Database") -Force
        if (-not $previousDatabase.PSIsContainer -or
            ($previousDatabase.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "The previous database directory changed."
        }
    }

    if ($previousRun -and $previousRun.Receipt.database_encrypted_extraction_verified -eq $true) {
        $step = "reuse_verified_database_backup"
        $previousPackage = Get-Item -LiteralPath (Join-Path $previousDatabase.FullName "database-component.7z") -Force
        if ($previousPackage.PSIsContainer -or ($previousPackage.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            $previousPackage.Length -le 0) {
            throw "The verified encrypted database archive is unavailable."
        }
        $package = Join-Path $database "database-component.7z"
        $expectedHash = (Get-FileHash -LiteralPath $previousPackage.FullName -Algorithm SHA256).Hash
        Copy-Item -LiteralPath $previousPackage.FullName -Destination $package
        if ((Get-FileHash -LiteralPath $package -Algorithm SHA256).Hash -ne $expectedHash) {
            throw "The reused encrypted database archive did not match."
        }
        $summary.reused_database_export = $true
        $summary.reused_verified_database_backup = $true
        $summary.database_backup_source_completed_utc = $ResumeCompletedUtc
        $summary.database_archive_read_verified = $true
        $summary.database_encrypted_extraction_verified = $true
        Write-Host "Reusing the encrypted database backup verified in your previous run. Starting the Storage backup."
    } else {
        $step = "verify_postgresql_17"
        $postgres = Join-Path $env:ProgramFiles "PostgreSQL\17\bin"
        $dump = Join-Path $postgres "pg_dump.exe"
        $restore = Join-Path $postgres "pg_restore.exe"
        if (-not (Test-Path -LiteralPath $dump -PathType Leaf) -or -not (Test-Path -LiteralPath $restore -PathType Leaf)) {
            $dump = (Get-Command pg_dump.exe -CommandType Application -ErrorAction Stop).Source
            $restore = Join-Path ([IO.Path]::GetDirectoryName($dump)) "pg_restore.exe"
        }
        $dumpVersion = (& $dump --version | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $dumpVersion -notmatch '^pg_dump \(PostgreSQL\) 17\.') { throw "PostgreSQL 17 pg_dump is required." }
        $restoreVersion = (& $restore --version | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or $restoreVersion -notmatch '^pg_restore \(PostgreSQL\) 17\.') { throw "PostgreSQL 17 pg_restore is required." }

        $step = "verify_production_certificate"
        $cert = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "Mushavo Budget\prod-ca-2021.crt"
        $certificate = Get-Item -LiteralPath $cert -Force
        if ($certificate.PSIsContainer -or ($certificate.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "The production CA certificate was unavailable."
        }

        if ($previousRun) {
            $previousPayload = Get-Item -LiteralPath (Join-Path $previousDatabase.FullName "payload") -Force
            if (-not $previousPayload.PSIsContainer -or
                ($previousPayload.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
                throw "The previous archive directory changed."
            }
            $payload = $previousPayload.FullName
            $archive = Join-Path $payload "production.database.dump"
            $previousArchive = Get-Item -LiteralPath $archive -Force
            if ($previousArchive.PSIsContainer -or ($previousArchive.Attributes -band [IO.FileAttributes]::ReparsePoint) -or
                $previousArchive.Length -le 0) {
                throw "The verified database dump is unavailable."
            }
            $summary.reused_database_export = $true
            Write-Host "Reusing the database export from your previous run."
        } else {
            $payload = Join-Path $database "payload"
            New-Item -ItemType Directory -Path $payload | Out-Null
            $archive = Join-Path $payload "production.database.dump"
            $partialDump = Join-Path $database "production.partial.dump"
            $certValue = (Resolve-Path -LiteralPath $cert).ProviderPath.Replace("\", "/").Replace("'", "\'")
            $connection = @(
                "host=aws-0-eu-central-1.pooler.supabase.com"
                "port=5432"
                "dbname=postgres"
                "user=postgres.kttkospkblwvguuwnhjj"
                "sslmode=verify-full"
                "sslrootcert='$certValue'"
                "gssencmode=disable"
                "connect_timeout=15"
                "application_name=mushavo_fr33_production_backup"
            ) -join " "
            $step = "database_export"
            Write-Host "Enter the production database password at pg_dump's native prompt."
            & $dump --format=custom --lock-wait-timeout=30000 --password --dbname $connection --file $partialDump
            if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $partialDump).Length -le 0) { throw "The database export did not complete." }
        }

        $step = "database_archive_read"
        $readTarget = if ($summary.reused_database_export) { $archive } else { $partialDump }
        $contents = @(& $restore --list $readTarget)
        if ($LASTEXITCODE -ne 0) { throw "The archive inventory could not be read." }
        $expected = @("auth users", "public profiles", "public budget_workspaces", "public payment_records",
            "mushavo_account_deletion requests", "storage buckets", "storage objects")
        foreach ($table in $expected) {
            if (-not ($contents -match (" TABLE DATA " + [regex]::Escape($table) + " "))) {
                throw "The archive is missing a required table-data entry."
            }
        }
        & $restore --file=NUL $readTarget
        if ($LASTEXITCODE -ne 0) { throw "The archive payload could not be read." }
        if (-not $summary.reused_database_export) {
            Move-Item -LiteralPath $partialDump -Destination $archive
            $contents | Set-Content -LiteralPath (Join-Path $payload "archive-contents.txt") -Encoding UTF8
        }
        $summary.database_archive_read_verified = $true

        $step = "database_encryption_create"
        $package = Join-Path $database "database-component.partial.7z"
        $name = [IO.Path]::GetFileName($archive)
        $originalHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash
        Write-Host "Enter your private backup passphrase when 7-Zip prompts. Use the same passphrase again for extraction."
        Push-Location -LiteralPath $payload
        try {
            & $zip a -t7z -mhe=on -p $package $name
            $archiveExit = $LASTEXITCODE
        } finally { Pop-Location }
        if ($archiveExit -ne 0 -or -not (Test-Path -LiteralPath $package -PathType Leaf)) {
            throw "7-Zip did not create the encrypted database package."
        }

        $step = "database_encryption_headers"
        $sentinel = [Guid]::NewGuid().ToString("N")
        $savedPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            $negative = @(& $zip l -slt "-p$sentinel" $package 2>&1)
            $negativeExit = $LASTEXITCODE
        } finally { $ErrorActionPreference = $savedPreference }
        if ($negativeExit -ne 2 -or (($negative | Out-String) -match [regex]::Escape($name))) {
            throw "The encrypted archive header did not pass its wrong-password check."
        }

        $step = "database_encryption_extract"
        $verifyDirectory = Join-Path $database "verified-files"
        New-Item -ItemType Directory -Path $verifyDirectory | Out-Null
        Write-Host "7-Zip will now ask for the same backup passphrase to verify extraction."
        # Let 7-Zip request the passphrase when it opens the encrypted header.
        & $zip x "-o$verifyDirectory" $package
        if ($LASTEXITCODE -ne 0) { throw "7-Zip could not extract the database package." }
        $extracted = @(Get-ChildItem -LiteralPath $verifyDirectory -Force)
        if ($extracted.Count -ne 1 -or $extracted[0].Name -ne $name -or $extracted[0].PSIsContainer -or
            ($extracted[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -or
            (Get-FileHash -LiteralPath $extracted[0].FullName -Algorithm SHA256).Hash -ne $originalHash -or
            (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $originalHash) {
            throw "The extracted database dump did not match the verified original."
        }
        Move-Item -LiteralPath $package -Destination (Join-Path $database "database-component.7z")
        $summary.database_encrypted_extraction_verified = $true
    }

    $step = "storage_helper_preflight"
    $localHelper = Join-Path $run "storage-backup.cjs"
    Copy-Item -LiteralPath $StorageHelper -Destination $localHelper
    & $node --check $localHelper
    if ($LASTEXITCODE -ne 0) { throw "Node could not load the reviewed Storage helper." }

    $start = [Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $node
    $start.WorkingDirectory = $run
    $start.UseShellExecute = $false
    $keyMessages = @{
        STORAGE_KEY_EMPTY = "The entry was empty. Paste the copied key into the masked prompt."
        STORAGE_KEY_COPY_FORMAT = "The entry is not a complete legacy API key. Use the Copy button on the service_role row."
        STORAGE_SERVICE_ROLE_JWT_REQUIRED = "That is a new-format key. Open the Legacy API Keys tab and copy the service_role row."
        STORAGE_KEY_PUBLIC = "That is a public key. Use the service_role row in the Legacy API Keys tab."
        STORAGE_KEY_ROLE_MISMATCH = "That key does not have the service_role role. Copy the legacy service_role API key."
        STORAGE_KEY_PROJECT_MISMATCH = "That key does not identify the production project. Open API Keys for $($summary.project)."
    }
    $process = $null
    for ($attempt = 1; $attempt -le 3; $attempt++) {
        $step = "storage_key_prompt"
        $secret = Read-Host "Production legacy service_role API key" -AsSecureString
        $pointer = [IntPtr]::Zero
        try {
            $step = "storage_key_validation"
            if ($null -ne $secret -and $secret.Length -gt 0) {
                $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
                $start.EnvironmentVariables["MUSHAVO_STORAGE_BACKUP_KEY"] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
            }
            $start.Arguments = '"{0}" --check-credential' -f $localHelper
            $start.RedirectStandardOutput = $true
            $check = [Diagnostics.Process]::Start($start)
            if ($null -eq $check) { throw "Node could not start the local key check." }
            try {
                $keyCode = $check.StandardOutput.ReadToEnd().Trim()
                $check.WaitForExit()
                $keyExit = $check.ExitCode
            } finally {
                $check.Dispose()
            }
            if ($keyExit -eq 0 -and $keyCode -eq "STORAGE_KEY_ACCEPTED_LOCALLY") {
                $summary.storage_problem_codes = @()
                $step = "storage_helper_start"
                $start.Arguments = '"{0}" "{1}" "{2}"' -f $localHelper, $run, $zip
                $start.RedirectStandardOutput = $false
                $process = [Diagnostics.Process]::Start($start)
                if ($null -eq $process) { throw "Node did not start." }
                break
            }
            if ($keyExit -ne 2 -or -not $keyMessages.ContainsKey($keyCode)) {
                $summary.storage_problem_codes = @("STORAGE_KEY_CHECK_UNAVAILABLE")
                throw "The local key check did not return a recognized result."
            }
            $summary.storage_problem_codes = @($keyCode)
            Write-Host $keyMessages[$keyCode]
        } finally {
            $start.EnvironmentVariables.Remove("MUSHAVO_STORAGE_BACKUP_KEY")
            if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
            if ($null -ne $secret) { $secret.Dispose() }
        }
    }
    if ($null -eq $process) { throw "The Storage key check stopped after three attempts." }
    $step = "storage_helper_wait"
    try {
        $process.WaitForExit()
        $summary.storage_helper_exit_code = $process.ExitCode
    } finally {
        $process.Dispose()
    }
    $step = "storage_receipt_read"
    $dirs = @(Get-ChildItem -LiteralPath $run -Directory -Filter "StorageComponent-*")
    if ($dirs.Count -ne 1 -or ($dirs[0].Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        $summary.storage_problem_codes = @("STORAGE_RUN_DIRECTORY_UNAVAILABLE")
        throw "The new Storage run directory is unavailable."
    }
    $receiptFile = Get-Item -LiteralPath (Join-Path $dirs[0].FullName "verification.json") -ErrorAction SilentlyContinue
    if (-not $receiptFile -or $receiptFile.PSIsContainer -or
        ($receiptFile.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        $summary.storage_problem_codes = @("STORAGE_RECEIPT_UNAVAILABLE")
        throw "The new Storage verification receipt is unavailable."
    }
    $storageSummary = (Get-Content -LiteralPath $receiptFile.FullName -Raw | ConvertFrom-Json).summary
    if ($storageSummary.project -ne $summary.project) { throw "The Storage receipt targets a different project." }
    $summary.storage_objects = $storageSummary.object_count
    $summary.storage_objects_downloaded = $storageSummary.downloaded_objects
    $summary.storage_problem_codes = @($storageSummary.problem_codes | Where-Object { $_ -match '^[A-Z0-9_]{1,100}$' })
    $summary.storage_inventory_stable = $storageSummary.before_after_inventory_equal
    $summary.storage_encrypted_extraction_verified = $storageSummary.encrypted_package_and_extracted_hashes_verified
    $step = "storage_verification"
    if ($summary.storage_helper_exit_code -ne 0 -or $storageSummary.result -ne "STORAGE_CURRENT_COMPONENT_LOCAL_PASS" -or
        -not $summary.storage_inventory_stable -or -not $summary.storage_encrypted_extraction_verified) {
        throw "The Storage backup needs local review."
    }

    $summary.result = "ENCRYPTED_DATABASE_AND_STORAGE_BACKUPS_VERIFIED_LOCALLY"
    $summary.exit_code = 0
} catch {
    $summary.failure_step = $step
    if ($run -and (Test-Path -LiteralPath $run -PathType Container)) {
        try { $_.ToString() | Set-Content -LiteralPath (Join-Path $run "private-error.txt") -Encoding UTF8 } catch {}
    }
}

$summary.completed_utc = [DateTime]::UtcNow.ToString("o")
$json = $summary | ConvertTo-Json -Depth 4
if ($run -and (Test-Path -LiteralPath $run -PathType Container)) {
    $json | Set-Content -LiteralPath (Join-Path $run "safe-summary.json") -Encoding UTF8
}
Write-Output $json
$global:LASTEXITCODE = [int]$summary.exit_code
