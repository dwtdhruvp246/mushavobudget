param(
    [Parameter(Mandatory = $true)][string]$SnapshotRoot,
    [Parameter(Mandatory = $true)][string]$ToolsRoot,
    [Parameter(Mandatory = $true)][string]$BridgeCode,
    [string]$RetainedConfigPath = 'C:\Users\HP\Desktop\Mushavo-Staging-Corrected-8b88f9465732442890ad06803e0513bc\public\config.js'
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$CandidateRoot = $null
$LocalCheckpoint = 'VERIFY_PINNED_BRIDGE'
try {
    $Hasher = [Security.Cryptography.SHA256]::Create()
    try {
        $BridgeHash = ([BitConverter]::ToString($Hasher.ComputeHash(
            [Text.Encoding]::UTF8.GetBytes($BridgeCode)
        ))).Replace('-', '').ToLowerInvariant()
    } finally { $Hasher.Dispose() }
    if ($BridgeHash -cne '1e152ad6e7afc8a2ed1ba97483a842136c31a1d971396775f100499c04e10e8e') { throw 'BRIDGE_IDENTITY_REVIEW_REQUIRED' }
    $LocalCheckpoint = 'POWERSHELL_JSON_ARRAY_COMPATIBILITY_PROBE'
    $ProbeJSON = '[' + ((1..43) -join ',') + ']'
    $LegacyProbeCount = @($ProbeJSON | ConvertFrom-Json).Count
    $ParsedProbe = $ProbeJSON | ConvertFrom-Json
    $FixedProbeCount = @($ParsedProbe).Count
    if ($FixedProbeCount -ne 43) { throw 'JSON_ARRAY_ENUMERATION_REVIEW_REQUIRED' }
    $LocalCheckpoint = 'CREATE_NEW_TEMPORARY_REVIEW_FOLDER'
    $CandidateRoot = Join-Path $env:TEMP (
        'mushavo-email-staging-review-' + [guid]::NewGuid().ToString('N')
    )
    New-Item -ItemType Directory -Path $CandidateRoot | Out-Null
    $LocalCheckpoint = 'INVOKE_ORIGINAL_API_WITH_VISIBLE_SAFE_OUTPUT'
    $BridgeCode | & node --input-type=module - `
        $SnapshotRoot $RetainedConfigPath $CandidateRoot $ToolsRoot | Out-Host
    $BridgeExit = $LASTEXITCODE
    if ($BridgeExit -ne 0) { return 1 }
    $LocalCheckpoint = 'READ_SAVED_PREPARATION_RECEIPT'
    $ReceiptPath = Join-Path $CandidateRoot 'preparation-receipt.json'
    $ReceiptItem = Get-Item -LiteralPath $ReceiptPath
    if ($ReceiptItem.Length -lt 1 -or $ReceiptItem.Length -gt 32768) {
        throw 'SAVED_RECEIPT_SIZE_REVIEW_REQUIRED'
    }
    $Summary = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $LocalCheckpoint = 'VALIDATE_SAVED_PREPARATION_RECEIPT'
    $ExpectedZipPath = Join-Path $CandidateRoot 'mushavo-email-staging-review.zip'
    if ($Summary.exit_code -ne 0 -or $Summary.public_files -ne 44 -or
        $Summary.do_not_upload_yet -ne $true -or $Summary.deployed -ne $false -or
        $Summary.ZIP_path -cne $ExpectedZipPath -or
        $Summary.wrapper_revision -cne 'TEMP_FOLDER_DIRECT_API_SAVED_RECEIPT') {
        throw 'SAVED_RECEIPT_SHAPE_REVIEW_REQUIRED'
    }
    $PublicRoot = Join-Path $CandidateRoot 'public'
    $LocalCheckpoint = 'READ_ORIGINAL_CONTRACT_AND_PUBLIC_FILE_SET'
    $Contract = Get-Content -LiteralPath (Join-Path $SnapshotRoot `
        'docs/security-audit/security-fr-2-email-staging-package-contract.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $ExpectedNames = @($Contract.static_preparation_contract.public_inputs | ForEach-Object { $_.path }) +
        @('404.html', '_headers', '_worker.js', '_routes.json')
    $ActualFiles = @(Get-ChildItem -LiteralPath $PublicRoot -Recurse -File)
    if ($ExpectedNames.Count -ne 44 -or $ActualFiles.Count -ne 44) {
        throw 'PUBLIC_COUNT_REVIEW_REQUIRED'
    }
    $LocalCheckpoint = 'READ_NON_CONFIG_MANIFEST'
    # Windows PowerShell 5.1 sends a parsed JSON array as one pipeline object.
    # Assign first, then enumerate the resulting value explicitly.
    $ParsedManifest = Get-Content -LiteralPath (Join-Path $CandidateRoot `
        'public-asset-manifest.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    $Manifest = @($ParsedManifest)
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
            $DiskPath = Join-Path $PublicRoot $Name.Replace([char]47, [IO.Path]::DirectorySeparatorChar)
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
    $LocalCheckpoint = 'FINAL_ZIP_DIGEST'
    $FinalZipHash = (Get-FileHash -LiteralPath $Summary.ZIP_path -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($FinalZipHash -cne $Summary.ZIP_SHA256) { throw 'ZIP_FINAL_HASH_REVIEW_REQUIRED' }
    $Summary.Windows_dotNET_ZIP_independent_readback_verified = $true
    $Summary | Add-Member -NotePropertyName ZIP_content_hashes_matched -NotePropertyValue 44
    $Summary.result = 'LOCAL_ADVANCED_MODE_POSIX_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED'
    $LocalCheckpoint = 'SAVE_FINAL_READBACK_RECEIPT'
    $Summary | Add-Member -NotePropertyName candidate_location -NotePropertyValue 'NEW_ORDINARY_LOCAL_TEMP_FOLDER'
    $Summary | Add-Member -NotePropertyName PowerShell_version -NotePropertyValue ($PSVersionTable.PSVersion.ToString())
    $Summary | Add-Member -NotePropertyName legacy_JSON_array_probe_count -NotePropertyValue $LegacyProbeCount
    $Summary | Add-Member -NotePropertyName corrected_JSON_array_probe_count -NotePropertyValue $FixedProbeCount
    $Summary | Add-Member -NotePropertyName old_array_count_behavior_reproduced -NotePropertyValue ($LegacyProbeCount -eq 1)
    $SafeJSON = $Summary | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText((Join-Path $CandidateRoot 'preparation-receipt.json'),
        $SafeJSON + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    Write-Host $SafeJSON
    Write-Host ('Review ZIP: ' + $Summary.ZIP_path)
    Write-Host 'Prepared only. Do not upload this ZIP yet. Return the JSON and exit code.'
    return 0
} catch {
    $AllowedProblems = @(
        'BRIDGE_IDENTITY_REVIEW_REQUIRED', 'JSON_ARRAY_ENUMERATION_REVIEW_REQUIRED', 'SAVED_RECEIPT_SIZE_REVIEW_REQUIRED',
        'SAVED_RECEIPT_SHAPE_REVIEW_REQUIRED', 'PUBLIC_COUNT_REVIEW_REQUIRED',
        'MANIFEST_COUNT_REVIEW_REQUIRED', 'DUPLICATE_MANIFEST_PATH',
        'ZIP_COUNT_REVIEW_REQUIRED', 'ZIP_PATH_OR_SIZE_REVIEW_REQUIRED',
        'ZIP_CONTENT_REVIEW_REQUIRED', 'ASSET_IDENTITY_REVIEW_REQUIRED',
        'ZIP_FINAL_HASH_REVIEW_REQUIRED'
    )
    $SafeProblem = 'LOCAL_WINDOWS_WRAPPER_REVIEW_REQUIRED'
    if ($AllowedProblems -ccontains $_.Exception.Message) {
        $SafeProblem = $_.Exception.Message
    }
    $SafeFailure = [ordered]@{
        stage_step = 'FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE'
        result = 'LOCAL_PACKAGE_RETRY_REVIEW_REQUIRED_NOT_DEPLOYED'
        problem_code = $SafeProblem
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
