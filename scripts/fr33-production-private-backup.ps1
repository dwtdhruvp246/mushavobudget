param(
    [Parameter(Mandatory = $true)]
    [string]$StorageHelper
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
    database_archive_read_verified = $false
    database_encrypted_extraction_verified = $false
    storage_encrypted_extraction_verified = $false
    storage_inventory_stable = $false
    storage_objects = $null
    storage_objects_downloaded = $null
    storage_problem_codes = @()
    isolated_live_service_restore_verified = $false
    exit_code = 2
    completed_utc = $null
}

$step = "verify_private_location"
$run = $null
$secure = $null
$pointer = [IntPtr]::Zero
$setStorageKey = $false

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

    $step = "verify_native_tools"
    $postgres = Join-Path $env:ProgramFiles "PostgreSQL\17\bin"
    $dump = Join-Path $postgres "pg_dump.exe"
    $restore = Join-Path $postgres "pg_restore.exe"
    $cert = Join-Path ([Environment]::GetFolderPath("DesktopDirectory")) "Mushavo Budget\prod-ca-2021.crt"
    $zip = Join-Path $env:ProgramFiles "7-Zip\7z.exe"
    $node = (Get-Command node.exe -CommandType Application -ErrorAction Stop).Source
    foreach ($file in @($dump, $restore, $cert, $zip, $StorageHelper)) {
        $item = Get-Item -LiteralPath $file -Force
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "A required backup tool or input was unavailable."
        }
    }
    if ((Get-FileHash -LiteralPath $StorageHelper -Algorithm SHA256).Hash -ne "C7DA9847A36D90BBDFDC4A40DDF0B4D1C4A785B79FBF1F14C63236E0694AC626") {
        throw "The Storage helper does not match the reviewed source."
    }
    if ((Test-Path Env:PGPASSWORD) -or (Test-Path Env:PGPASSFILE) -or (Test-Path Env:MUSHAVO_STORAGE_BACKUP_KEY) -or
        $env:NODE_TLS_REJECT_UNAUTHORIZED -eq "0") {
        throw "A pre-existing credential or TLS override needs local review."
    }

    $run = Join-Path $root ("FR33-Production-" + [DateTime]::UtcNow.ToString("yyyyMMddTHHmmssZ") + "-" + [guid]::NewGuid().ToString("N"))
    $database = Join-Path $run "Database"
    $payload = Join-Path $database "payload"
    New-Item -ItemType Directory -Path $run | Out-Null
    New-Item -ItemType Directory -Path $database | Out-Null
    New-Item -ItemType Directory -Path $payload | Out-Null
    $partial = Join-Path $database "production.partial.dump"
    $archive = Join-Path $payload "production.database.dump"
    $toc = Join-Path $payload "archive-contents.txt"
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
    & $dump --format=custom --lock-wait-timeout=30000 --password --dbname $connection --file $partial
    if ($LASTEXITCODE -ne 0 -or (Get-Item -LiteralPath $partial).Length -le 0) { throw "The database export did not complete." }

    $step = "database_archive_read"
    $contents = @(& $restore --list $partial)
    if ($LASTEXITCODE -ne 0) { throw "The archive inventory could not be read." }
    $contents | Set-Content -LiteralPath $toc -Encoding UTF8
    $expected = @("auth users", "public profiles", "public budget_workspaces", "public payment_records",
        "mushavo_account_deletion requests", "storage buckets", "storage objects")
    foreach ($table in $expected) {
        if (-not ($contents -match (" TABLE DATA " + [regex]::Escape($table) + " "))) {
            throw "The archive is missing a required table-data entry."
        }
    }
    & $restore --file=NUL $partial
    if ($LASTEXITCODE -ne 0) { throw "The archive payload could not be read." }
    Move-Item -LiteralPath $partial -Destination $archive
    $summary.database_archive_read_verified = $true

    $step = "database_encryption"
    $bridge = Join-Path $run "backup-components.cjs"
    @'
const fs = require('node:fs');
const path = require('node:path');
const [mode, helper, directory, sevenZip] = process.argv.slice(2);
const api = require(helper);

async function main() {
  if (mode === 'database') {
    const verified = api.packageFiles(directory, sevenZip);
    fs.renameSync(verified.file, path.join(directory, 'database-component.7z'));
    return;
  }
  if (mode !== 'storage') throw Error('Unknown backup component');
  const key = process.env.MUSHAVO_STORAGE_BACKUP_KEY;
  delete process.env.MUSHAVO_STORAGE_BACKUP_KEY;
  const summary = await api.runPass(directory, key, sevenZip);
  if (summary.result !== 'STORAGE_CURRENT_COMPONENT_LOCAL_PASS') process.exitCode = 2;
}

main().catch(() => {
  console.error('PRIVATE_BACKUP_COMPONENT_REVIEW');
  process.exitCode = 2;
});
'@ | Set-Content -LiteralPath $bridge -Encoding ASCII
    Write-Host "Use your private backup passphrase at the 7-Zip prompts."
    & $node $bridge database $StorageHelper $database $zip
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath (Join-Path $database "database-component.7z") -PathType Leaf)) {
        throw "The database encryption or extracted-file comparison failed."
    }
    $summary.database_encrypted_extraction_verified = $true

    $step = "storage_export"
    $secure = Read-Host "Existing production Supabase secret key for the local Storage export" -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $env:MUSHAVO_STORAGE_BACKUP_KEY = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer)
    $setStorageKey = $true
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer)
    $pointer = [IntPtr]::Zero
    & $node $bridge storage $StorageHelper $run $zip
    $storageExit = $LASTEXITCODE
    Remove-Item Env:MUSHAVO_STORAGE_BACKUP_KEY
    $setStorageKey = $false
    $dirs = @(Get-ChildItem -LiteralPath $run -Directory -Filter "StorageComponent-*")
    if ($dirs.Count -ne 1) { throw "The new Storage verification receipt is unavailable." }
    $receiptFile = Join-Path $dirs[0].FullName "verification.json"
    $storageSummary = (Get-Content -LiteralPath $receiptFile -Raw | ConvertFrom-Json).summary
    if ($storageSummary.project -ne $summary.project) { throw "The Storage receipt targets a different project." }
    $summary.storage_objects = $storageSummary.object_count
    $summary.storage_objects_downloaded = $storageSummary.downloaded_objects
    $summary.storage_problem_codes = @($storageSummary.problem_codes | Where-Object { $_ -match '^[A-Z0-9_]{1,100}$' })
    $summary.storage_inventory_stable = $storageSummary.before_after_inventory_equal
    $summary.storage_encrypted_extraction_verified = $storageSummary.encrypted_package_and_extracted_hashes_verified
    if ($storageExit -ne 0 -or $storageSummary.result -ne "STORAGE_CURRENT_COMPONENT_LOCAL_PASS") {
        throw "The Storage backup needs local review."
    }

    $summary.result = "ENCRYPTED_DATABASE_AND_STORAGE_BACKUPS_VERIFIED_LOCALLY"
    $summary.exit_code = 0
} catch {
    $summary.failure_step = $step
    if ($run -and (Test-Path -LiteralPath $run -PathType Container)) {
        try { $_.ToString() | Set-Content -LiteralPath (Join-Path $run "private-error.txt") -Encoding UTF8 } catch {}
    }
} finally {
    if ($setStorageKey) { Remove-Item Env:MUSHAVO_STORAGE_BACKUP_KEY -ErrorAction SilentlyContinue }
    if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($null -ne $secure) { $secure.Dispose() }
}

$summary.completed_utc = [DateTime]::UtcNow.ToString("o")
$json = $summary | ConvertTo-Json -Depth 4
if ($run -and (Test-Path -LiteralPath $run -PathType Container)) {
    $json | Set-Content -LiteralPath (Join-Path $run "safe-summary.json") -Encoding UTF8
}
Write-Output $json
$global:LASTEXITCODE = [int]$summary.exit_code
