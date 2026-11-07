param(
    [Parameter(Mandatory = $true)][string]$SnapshotRoot,
    [Parameter(Mandatory = $true)][string]$ToolsRoot,
    [string]$RetainedConfigPath = 'C:\Users\HP\Desktop\Mushavo-Staging-Corrected-8b88f9465732442890ad06803e0513bc\public\config.js'
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$PackageStage = 'FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE'
$CandidateRoot = $null
$LocalCheckpoint = 'RETAINED_STAGING_CONFIGURATION'
try {
    if (-not [IO.File]::Exists($RetainedConfigPath)) {
        throw 'RETAINED_STAGING_CONFIGURATION_UNAVAILABLE'
    }
    $DesktopPath = [Environment]::GetFolderPath('Desktop')
    if (-not [IO.Directory]::Exists($DesktopPath)) {
        throw 'DESKTOP_UNAVAILABLE'
    }
    $CandidateRoot = Join-Path $DesktopPath (
        'Mushavo-Email-Staging-Review-' + [guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $CandidateRoot | Out-Null
    $LocalCheckpoint = 'SOURCE_TOOLS_AND_PACKAGE_PREPARATION'
    $NodeLines = @(& node (Join-Path $SnapshotRoot 'scripts/prepare-fr-2-email-staging.mjs') `
        $SnapshotRoot $RetainedConfigPath $CandidateRoot $ToolsRoot)
    if ($LASTEXITCODE -ne 0) {
        throw 'NODE_PACKAGE_REVIEW_REQUIRED'
    }
    $Summary = ($NodeLines -join [Environment]::NewLine) | ConvertFrom-Json
    if ($Summary.exit_code -ne 0 -or $Summary.public_files -ne 44 -or
        $Summary.do_not_upload_yet -ne $true) {
        throw 'SUMMARY_REVIEW_REQUIRED'
    }
    $PublicRoot = Join-Path $CandidateRoot 'public'
    $Contract = Get-Content -LiteralPath (Join-Path $SnapshotRoot `
        'docs/security-audit/security-fr-2-email-staging-package-contract.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $ExpectedNames = @($Contract.static_preparation_contract.public_inputs | ForEach-Object { $_.path }) +
        @('404.html', '_headers', '_worker.js', '_routes.json')
    $ActualFiles = @(Get-ChildItem -LiteralPath $PublicRoot -Recurse -File)
    if ($ExpectedNames.Count -ne 44 -or $ActualFiles.Count -ne 44) {
        throw 'PUBLIC_COUNT_REVIEW_REQUIRED'
    }
    $Manifest = @(Get-Content -LiteralPath (Join-Path $CandidateRoot `
        'public-asset-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json)
    if ($Manifest.Count -ne 43) { throw 'MANIFEST_COUNT_REVIEW_REQUIRED' }
    $ExpectedMap = @{}
    foreach ($Row in $Manifest) {
        if ($ExpectedMap.ContainsKey($Row.path)) { throw 'DUPLICATE_MANIFEST_PATH' }
        $ExpectedMap[$Row.path] = $Row
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $LocalCheckpoint = 'INDEPENDENT_DOTNET_ZIP_READBACK'
    $Archive = [IO.Compression.ZipFile]::OpenRead($Summary.ZIP_path)
    try {
        if ($Archive.Entries.Count -ne 44) { throw 'ZIP_COUNT_REVIEW_REQUIRED' }
        $Seen = @{}
        foreach ($Entry in $Archive.Entries) {
            $Name = $Entry.FullName
            if ($Name.Contains('\') -or $Name.EndsWith('/') -or
                $ExpectedNames -cnotcontains $Name -or $Seen.ContainsKey($Name) -or
                $Entry.Length -lt 1 -or $Entry.Length -gt 2097152) {
                throw 'ZIP_PATH_OR_SIZE_REVIEW_REQUIRED'
            }
            $Seen[$Name] = $true
            $DiskPath = Join-Path $PublicRoot $Name.Replace('/', [IO.Path]::DirectorySeparatorChar)
            $Stream = $Entry.Open()
            $Digest = [Security.Cryptography.SHA256]::Create()
            try {
                $EntryHash = ([BitConverter]::ToString($Digest.ComputeHash($Stream))).Replace('-', '').ToLowerInvariant()
            } finally {
                $Digest.Dispose()
                $Stream.Dispose()
            }
            $DiskHash = (Get-FileHash -LiteralPath $DiskPath -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($EntryHash -cne $DiskHash -or $Entry.Length -ne (Get-Item -LiteralPath $DiskPath).Length) {
                throw 'ZIP_CONTENT_REVIEW_REQUIRED'
            }
            if ($Name -cne 'config.js') {
                if (-not $ExpectedMap.ContainsKey($Name) -or
                    $ExpectedMap[$Name].sha256 -cne $EntryHash -or
                    $ExpectedMap[$Name].bytes -ne $Entry.Length) {
                    throw 'ASSET_IDENTITY_REVIEW_REQUIRED'
                }
            }
        }
    } finally { $Archive.Dispose() }
    $FinalZipHash = (Get-FileHash -LiteralPath $Summary.ZIP_path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($FinalZipHash -cne $Summary.ZIP_SHA256) { throw 'ZIP_FINAL_HASH_REVIEW_REQUIRED' }
    $Summary.Windows_dotNET_ZIP_independent_readback_verified = $true
    $Summary | Add-Member -NotePropertyName ZIP_content_hashes_matched -NotePropertyValue 44
    $Summary.result = 'LOCAL_ADVANCED_MODE_POSIX_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED'
    $SafeJSON = $Summary | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText((Join-Path $CandidateRoot 'preparation-receipt.json'),
        $SafeJSON + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    Write-Host $SafeJSON
    Write-Host ('Review ZIP: ' + $Summary.ZIP_path)
    Write-Host 'Prepared only. Do not upload this ZIP yet. Return the JSON and exit code.'
    return 0
} catch {
    $SafeFailure = [ordered]@{
        stage_step = $PackageStage
        result = 'LOCAL_PACKAGE_REVIEW_REQUIRED_NOT_DEPLOYED'
        problem_code = 'LOCAL_SOURCE_CONFIG_PACKAGE_OR_ZIP_READBACK_REVIEW_REQUIRED'
        local_checkpoint = $LocalCheckpoint
        new_local_candidate_may_remain = ($null -ne $CandidateRoot)
        previous_candidate_changed = $false
        raw_exceptions_configuration_or_keys_printed = $false
        actual_hosted_requests = 0
        deployed = $false
        hosted_acceptance = $false
        exit_code = 1
    }
    Write-Host ($SafeFailure | ConvertTo-Json -Depth 5)
    return 1
}
