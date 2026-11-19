param([Parameter(Mandatory=$true)][string]$SnapshotRoot)
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

$PreviousCandidate = 'C:\Users\HP\Desktop\Mushavo-Staging-Candidate-6205f79b476048a48edf4fe9e8a88cd0'
$PreviousZip = Join-Path $PreviousCandidate 'mushavo-staging-upload-beb642556710479b91dbfde0931744a2.zip'
$OldZipItem = Get-Item -LiteralPath $PreviousZip -Force
if ($OldZipItem.PSIsContainer -or ($OldZipItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
    (Get-FileHash -LiteralPath $PreviousZip -Algorithm SHA256).Hash.ToLowerInvariant() -cne 'c79819c4abb1cc8184d87ccfeb70c7d0e6b2cd7630e1f89072ea63415ba7707c') {
    throw 'Retained upload ZIP identity mismatch.'
}
$CandidateParent = Join-Path 'C:\Users\HP\Desktop' ('Mushavo-Staging-Corrected-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $CandidateParent | Out-Null
node (Join-Path $SnapshotRoot 'scripts/prepare-final-staging-correction.mjs') $PreviousCandidate $CandidateParent
if ($LASTEXITCODE -ne 0) { throw 'Corrected candidate preparation failed; no upload performed.' }
$PublicRoot = Join-Path $CandidateParent 'public'
$ReceiptPath = Join-Path $CandidateParent 'preparation-receipt.json'
$ReviewedSource = '268eb30b21154c14b5eede7e3ceb187341ef586b'
$Contract = Get-Content -LiteralPath (Join-Path $SnapshotRoot 'docs/security-audit/security-final-staging-source-contract.json') -Raw -Encoding UTF8 | ConvertFrom-Json

foreach ($Directory in @($CandidateParent, $PublicRoot)) {
    $Item = Get-Item -LiteralPath $Directory -Force
    if (-not $Item.PSIsContainer -or ($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Candidate path must be an ordinary directory.'
    }
}
$ReceiptItem = Get-Item -LiteralPath $ReceiptPath -Force
if ($ReceiptItem.PSIsContainer -or $ReceiptItem.Length -gt 262144 -or ($ReceiptItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
    throw 'Unexpected sidecar receipt file.'
}
$Receipt = Get-Content -LiteralPath $ReceiptPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Contract.source_commit -ne $ReviewedSource -or $Contract.staging_project -ne 'dczlddwbtgvfdujgcitb' -or
    $Receipt.source_commit -ne $ReviewedSource -or $Receipt.project -ne 'dczlddwbtgvfdujgcitb' -or
    $Receipt.result -ne 'ISOLATED_STAGING_STATIC_CANDIDATE_PREPARED_NOT_DEPLOYED' -or
    $Receipt.public_files -ne 40 -or $Receipt.selected_source_inputs_verified -ne 39 -or $Receipt.deployed -ne $false) {
    throw 'Candidate receipt/source identity mismatch.'
}

$ExpectedNames = @($Contract.public_inputs | ForEach-Object { $_.path }) + @('_headers', '404.html')
if ($ExpectedNames.Count -ne 40) { throw 'Unexpected public allowlist.' }
$Files = @()
foreach ($Item in @(Get-ChildItem -LiteralPath $PublicRoot -Force)) {
    if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked candidate entry rejected.' }
    if ($Item.PSIsContainer) {
        if ($Item.Name -cne 'assets') { throw 'Unexpected public directory.' }
        foreach ($Asset in @(Get-ChildItem -LiteralPath $Item.FullName -Force)) {
            if ($Asset.PSIsContainer -or ($Asset.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                throw 'Unexpected nested or linked asset.'
            }
            $Files += $Asset
        }
    } else { $Files += $Item }
}
$ActualNames = @($Files | ForEach-Object { $_.FullName.Substring($PublicRoot.Length + 1).Replace('\', '/') })
$Difference = @(Compare-Object -ReferenceObject $ExpectedNames -DifferenceObject $ActualNames -CaseSensitive)
if ($Files.Count -ne 40 -or $Difference.Count -ne 0) { throw 'Public file set differs from the reviewed allowlist.' }

$Manifest = @($Receipt.public_asset_manifest)
$ManifestNames = @($Manifest | ForEach-Object { $_.path })
$ExpectedManifestNames = @($ExpectedNames | Where-Object { $_ -ne 'config.js' })
$ManifestDifference = @(Compare-Object -ReferenceObject $ExpectedManifestNames -DifferenceObject $ManifestNames -CaseSensitive)
if ($Manifest.Count -ne 39 -or $ManifestDifference.Count -ne 0) { throw 'Unexpected non-config artifact manifest.' }
$ExpectedHashes = @{}
foreach ($Row in $Manifest) {
    if ($Row.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $Row.bytes -lt 1 -or $Row.bytes -gt 2097152) { throw 'Invalid artifact identity.' }
    $FilePath = Join-Path $PublicRoot $Row.path
    $Hash = (Get-FileHash -LiteralPath $FilePath -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($Hash -cne $Row.sha256 -or (Get-Item -LiteralPath $FilePath).Length -ne [long]$Row.bytes) {
        throw ('Prepared artifact changed: ' + $Row.path)
    }
    $ExpectedHashes[$Row.path] = $Hash
}

try {
    $ConfigItem = Get-Item -LiteralPath (Join-Path $PublicRoot 'config.js')
    if ($ConfigItem.Length -lt 1 -or $ConfigItem.Length -gt 32768) { throw 'Unexpected config size.' }
    $ConfigText = Get-Content -LiteralPath (Join-Path $PublicRoot 'config.js') -Raw -Encoding UTF8
    if ($ConfigText -notmatch '(?s)^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{.*\})\s*;\s*$') { throw 'Invalid config format.' }
    $Config = $Matches[1] | ConvertFrom-Json
    $ConfigFields = @($Config.PSObject.Properties.Name | Sort-Object)
    if (($ConfigFields -join ',') -ne 'supabasePublishableKey,supabaseUrl,vapidPublicKey' -or
        $Config.supabaseUrl -ne 'https://dczlddwbtgvfdujgcitb.supabase.co' -or
        $Config.supabasePublishableKey -cnotmatch '^sb_publishable_[A-Za-z0-9_-]+$' -or $Config.vapidPublicKey -ne '') {
        throw 'Unexpected staging config.'
    }
} catch { throw 'Staging config validation failed. No key value is printed.' }
finally { $Config = $null; $ConfigText = $null }
$ExpectedHashes['config.js'] = (Get-FileHash -LiteralPath (Join-Path $PublicRoot 'config.js') -Algorithm SHA256).Hash.ToLowerInvariant()

$ZipPath = Join-Path $CandidateParent ('mushavo-staging-upload-' + [guid]::NewGuid().ToString('N') + '.zip')
$HeaderText = Get-Content -LiteralPath (Join-Path $PublicRoot '_headers') -Raw -Encoding UTF8
if (-not $HeaderText.EndsWith("`n/manifest.webmanifest`n  Content-Type: application/manifest+json`n")) {
    throw 'Manifest MIME header rule is missing.'
}
Add-Type -AssemblyName System.IO.Compression.FileSystem
$ZipStream = [IO.File]::Open($ZipPath, [IO.FileMode]::CreateNew)
$Writer = New-Object IO.Compression.ZipArchive($ZipStream, [IO.Compression.ZipArchiveMode]::Create, $false)
try {
    foreach ($Name in ($ExpectedNames | Sort-Object)) {
        if ($Name.Contains('\') -or $Name.StartsWith('/') -or $Name.Contains('..')) { throw 'Unsafe literal ZIP entry.' }
        [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($Writer, (Join-Path $PublicRoot $Name), $Name, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
    }
} finally { $Writer.Dispose(); $ZipStream.Dispose() }
$Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
$Sha = [Security.Cryptography.SHA256]::Create()
try {
    $ZipFiles = @($Archive.Entries)
    $ZipNames = @($ZipFiles | ForEach-Object { $_.FullName })
    $ZipDifference = @(Compare-Object -ReferenceObject $ExpectedNames -DifferenceObject $ZipNames -CaseSensitive)
    if ($ZipFiles.Count -ne 40 -or $ZipDifference.Count -ne 0) { throw 'ZIP must contain exactly the 40 public files at its root.' }
    foreach ($Entry in $ZipFiles) {
        $Name = $Entry.FullName
        if ($Name.Contains('\') -or $Name.EndsWith('/')) { throw 'Non-POSIX or directory ZIP entry rejected.' }
        $Stream = $Entry.Open()
        try { $Hash = [BitConverter]::ToString($Sha.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant() }
        finally { $Stream.Dispose() }
        if ($Hash -cne $ExpectedHashes[$Name]) { throw ('ZIP content mismatch: ' + $Name) }
    }
} finally { $Sha.Dispose(); $Archive.Dispose() }

$SafeReceipt = [ordered]@{
    stage_step = 'FR.1.3_DELIVERY_CORRECTION'
    result = 'CORRECTED_POSIX_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED'
    source_commit = $ReviewedSource
    target_project = 'mushavo-budget-staging'
    target_channel = 'PRODUCTION_CHANNEL_OF_STAGING_PAGES_PROJECT'
    target_domain = 'mushavo-budget-staging.pages.dev'
    ZIP_literal_forward_slash_paths_verified = $true
    manifest_content_type_rule_present = $true
    previous_candidate_and_ZIP_changed = $false
    public_files = 40
    non_config_receipt_hashes_matched = 39
    ZIP_content_hashes_matched = 40
    staging_config_shape_verified = $true
    key_ownership_independently_verified = $false
    receipt_and_audit_files_excluded = $true
    zip_sha256 = (Get-FileHash -LiteralPath $ZipPath -Algorithm SHA256).Hash.ToLowerInvariant()
    zip_path = $ZipPath
    deployed = $false
    production_application_or_native_changed = $false
    hosted_acceptance = $false
    APK_update_deferred = $true
} | ConvertTo-Json -Depth 4
$SafeReceipt | Set-Content -LiteralPath (Join-Path $CandidateParent 'corrected-zip-receipt.json') -Encoding UTF8
Write-Host $SafeReceipt
Write-Host "Corrected upload ZIP: $ZipPath"
Write-Host 'Prepared only. Return the two summaries before uploading this new corrected ZIP.'

