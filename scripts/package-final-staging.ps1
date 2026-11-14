$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $false
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

$CandidateParent = 'C:\Users\HP\Desktop\Mushavo-Staging-Candidate-6205f79b476048a48edf4fe9e8a88cd0'
$PublicRoot = Join-Path $CandidateParent 'public'
$ReceiptPath = Join-Path $CandidateParent 'preparation-receipt.json'
$ContractCommit = '360befd88bc747d2af309161840fe564a0e8ba9c'
$ReviewedSource = '268eb30b21154c14b5eede7e3ceb187341ef586b'

git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed.' }
$ContractLines = git show ($ContractCommit + ':docs/security-audit/security-final-staging-source-contract.json')
if ($LASTEXITCODE -ne 0 -or -not $ContractLines) { throw 'Pinned source contract unavailable.' }
$Contract = ($ContractLines -join [Environment]::NewLine) | ConvertFrom-Json

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
Compress-Archive -Path (Join-Path $PublicRoot '*') -DestinationPath $ZipPath -CompressionLevel Optimal
Add-Type -AssemblyName System.IO.Compression.FileSystem
$Archive = [IO.Compression.ZipFile]::OpenRead($ZipPath)
$Sha = [Security.Cryptography.SHA256]::Create()
try {
    $ZipFiles = @($Archive.Entries | Where-Object { -not $_.FullName.Replace('\', '/').EndsWith('/') })
    $ZipNames = @($ZipFiles | ForEach-Object { $_.FullName.Replace('\', '/') })
    $ZipDifference = @(Compare-Object -ReferenceObject $ExpectedNames -DifferenceObject $ZipNames -CaseSensitive)
    if ($ZipFiles.Count -ne 40 -or $ZipDifference.Count -ne 0) { throw 'ZIP must contain exactly the 40 public files at its root.' }
    foreach ($Entry in $ZipFiles) {
        $Name = $Entry.FullName.Replace('\', '/')
        $Stream = $Entry.Open()
        try { $Hash = [BitConverter]::ToString($Sha.ComputeHash($Stream)).Replace('-', '').ToLowerInvariant() }
        finally { $Stream.Dispose() }
        if ($Hash -cne $ExpectedHashes[$Name]) { throw ('ZIP content mismatch: ' + $Name) }
    }
} finally { $Sha.Dispose(); $Archive.Dispose() }

[ordered]@{
    stage_step = 'FR.1.2'
    result = 'LOCAL_UPLOAD_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED'
    source_commit = $ReviewedSource
    target_project = 'mushavo-budget-staging'
    target_channel = 'PRODUCTION_CHANNEL_OF_STAGING_PAGES_PROJECT'
    target_domain = 'mushavo-budget-staging.pages.dev'
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
Write-Host "Upload ZIP: $ZipPath"

