param(
    [Parameter(Mandatory=$true)][string]$SnapshotRoot,
    [Parameter(Mandatory=$true)][string]$ToolsRoot,
    [string]$RetainedZIP = 'C:\Users\HP\AppData\Local\Temp\mushavo-email-staging-review-3e602d4d6b8e4c1d8f870057905f5269\mushavo-email-staging-review.zip'
)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
$CandidateRoot = $null
$LocalCheckpoint = 'VERIFY_RETAINED_ZIP'
try {
    if ((Get-FileHash -LiteralPath $RetainedZIP -Algorithm SHA256).Hash.ToLowerInvariant() -cne
        '33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1') { throw 'RETAINED_ZIP_REVIEW_REQUIRED' }
    $CandidateRoot = Join-Path $env:TEMP ('mushavo-email-modern-review-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $CandidateRoot | Out-Null
    $LocalCheckpoint = 'PREPARE_NEW_MODERN_ZIP'
    & node (Join-Path $SnapshotRoot 'scripts/prepare-fr-2-email-modern-package.mjs') `
        $SnapshotRoot $CandidateRoot $ToolsRoot $RetainedZIP | Out-Host
    if ($LASTEXITCODE -ne 0) { return 1 }
    $LocalCheckpoint = 'READ_SAVED_PREPARATION_RECEIPT'
    $ReceiptPath = Join-Path $CandidateRoot 'preparation-receipt.json'
    $ReceiptItem = Get-Item -LiteralPath $ReceiptPath
    if ($ReceiptItem.Length -lt 1 -or $ReceiptItem.Length -gt 32768) {
        throw 'SAVED_RECEIPT_SIZE_REVIEW_REQUIRED'
    }
    $Summary = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $LocalCheckpoint = 'VALIDATE_SAVED_PREPARATION_RECEIPT'
    $ExpectedZipPath = Join-Path $CandidateRoot 'mushavo-email-modern-review.zip'
    if ($Summary.exit_code -ne 0 -or $Summary.public_files -ne 44 -or
        $Summary.do_not_upload_yet -ne $true -or $Summary.deployed -ne $false -or
        $Summary.ZIP_path -cne $ExpectedZipPath -or
        $Summary.stage_step -cne 'FR.2.4.E5.5_MODERN_REPLACEMENT_ZIP' -or
        $Summary.only_Worker_changed -ne $true -or
        $Summary.public_files_except_Worker_byte_identical_to_prior_ZIP -ne 43 -or
        $Summary.Worker_SHA256 -cne 'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651') {
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
    $Summary.result = 'LOCAL_MODERN_ZIP_DOTNET_PREFLIGHT_SCOPED_PASS_NOT_DEPLOYED'
    $LocalCheckpoint = 'SAVE_FINAL_READBACK_RECEIPT'
    $Summary | Add-Member -NotePropertyName candidate_location -NotePropertyValue 'NEW_ORDINARY_LOCAL_TEMP_FOLDER'
    $Summary | Add-Member -NotePropertyName PowerShell_version -NotePropertyValue ($PSVersionTable.PSVersion.ToString())
    $SafeJSON = $Summary | ConvertTo-Json -Depth 8
    [IO.File]::WriteAllText((Join-Path $CandidateRoot 'preparation-receipt.json'),
        $SafeJSON + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    Write-Host $SafeJSON
    Write-Host ('Review ZIP: ' + $Summary.ZIP_path)
    Write-Host 'Prepared only. Do not upload this ZIP yet. Return the JSON and exit code.'
    return 0
} catch {
    Write-Host ([ordered]@{
        stage_step = 'FR.2.4.E5.5_MODERN_REPLACEMENT_ZIP'
        result = 'LOCAL_MODERN_WINDOWS_ZIP_REVIEW_REQUIRED'
        problem_code = 'LOCAL_WINDOWS_WRAPPER_REVIEW_REQUIRED'
        local_checkpoint = $LocalCheckpoint
        new_local_candidate_may_remain = ($null -ne $CandidateRoot)
        previous_candidate_changed = $false
        private_DPAPI_or_Zoho_files_accessed = $false
        raw_exceptions_configuration_or_keys_printed = $false
        actual_hosted_requests = 0
        deployed = $false
        hosted_acceptance = $false
        exit_code = 1
    } | ConvertTo-Json -Depth 5)
    return 1
}
