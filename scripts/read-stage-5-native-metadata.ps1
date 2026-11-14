# 5.1: read-only metadata from the existing Windows checkout.
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'
$SourcePin = '83f5dd2ac04be107e82baf992f796f47e24d7049'
$CurrentCommit = git rev-parse HEAD
if ($LASTEXITCODE -ne 0) { throw 'Not a readable Git checkout.' }
$CurrentBranch = git branch --show-current
if ($LASTEXITCODE -ne 0) { throw 'Branch metadata unavailable.' }
$Paths = @(
    'package.json', 'package-lock.json', '.gitignore',
    'scripts/build-capacitor.mjs',
    'capacitor.config.json', 'capacitor.config.ts', 'capacitor.config.js',
    'android', 'ios', 'www', 'node_modules',
    'android/build.gradle', 'android/variables.gradle',
    'android/app/build.gradle', 'android/gradle/wrapper/gradle-wrapper.properties',
    'android/app/src/main/AndroidManifest.xml',
    'android/app/src/main/res/xml/file_paths.xml',
    'android/app/src/main/res/xml/backup_rules.xml',
    'android/app/src/main/res/xml/data_extraction_rules.xml',
    'android/app/src/main/res/xml/network_security_config.xml',
    'ios/App/App/Info.plist', 'ios/App/App/PrivacyInfo.xcprivacy',
    'ios/App/PrivacyInfo.xcprivacy', 'ios/App/App/App.entitlements'
)
$Rows = foreach ($Relative in $Paths) {
    $Parts = $Relative.Split('/')
    $Probe = (Get-Location).Path
    $Linked = $false
    foreach ($Part in $Parts) {
        $Probe = Join-Path $Probe $Part
        if (Test-Path -LiteralPath $Probe) {
            $PartItem = Get-Item -LiteralPath $Probe -Force
            if (($PartItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
                $Linked = $true
                break
            }
        } else { break }
    }
    $Exists = Test-Path -LiteralPath $Relative
    $Kind = 'MISSING'
    $Bytes = $null
    $Hash = $null
    if ($Linked) { $Kind = 'LINK_SKIPPED' }
    elseif ($Exists) {
        $Item = Get-Item -LiteralPath $Relative -Force
        if ($Item.PSIsContainer) { $Kind = 'DIRECTORY' }
        else {
            $Kind = 'FILE'
            $Bytes = $Item.Length
            $Hash = (Get-FileHash -LiteralPath $Relative -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    }
    $Tracked = @(git ls-files -- $Relative)
    if ($LASTEXITCODE -ne 0) { throw 'Git file metadata check failed.' }
    [ordered]@{
        path=$Relative; kind=$Kind; bytes=$Bytes; sha256=$Hash
        tracked_entries=$Tracked.Count
    }
}
$Tools = [ordered]@{}
foreach ($Tool in @('git', 'node', 'npm', 'java', 'adb')) {
    $Tools[$Tool] = [bool](Get-Command $Tool -ErrorAction SilentlyContinue)
}
[ordered]@{
    stage_step='5.1'; scope='OWNER_LOCAL_FILE_METADATA_ONLY'
    audit_source_pin=$SourcePin
    checkout_commit=($CurrentCommit -join '').Trim()
    checkout_branch=($CurrentBranch -join '').Trim()
    checkout_matches_audit_pin=(($CurrentCommit -join '').Trim() -eq $SourcePin)
    files=@($Rows); tools_on_path=$Tools
    android_sdk_env_present=[bool]($env:ANDROID_HOME -or $env:ANDROID_SDK_ROOT)
    java_home_env_present=[bool]$env:JAVA_HOME
    config_contents_reviewed=$false; build_prerequisites_verified=$false
    build_sync_install_or_sign_run=$false; device_checks_run=0
    native_security_acceptance=$false; files_settings_or_accounts_changed=$false
} | ConvertTo-Json -Depth 6
