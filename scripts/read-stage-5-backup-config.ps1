# 5.2: inspect source XML only; no build, device access or data backup.
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

function Read-BackupXml([string]$Relative) {
    $Probe = (Get-Location).Path
    foreach ($Part in $Relative.Split('/')) {
        $Probe = Join-Path $Probe $Part
        if (-not (Test-Path -LiteralPath $Probe)) { return $null }
        $Item = Get-Item -LiteralPath $Probe -Force
        if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked source path encountered; inspection stopped.'
        }
    }
    if ($Item.PSIsContainer -or $Item.Length -gt 262144) {
        throw 'Unexpected source file type or size; inspection stopped.'
    }
    $Settings = New-Object System.Xml.XmlReaderSettings
    $Settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $Settings.XmlResolver = $null
    $Settings.MaxCharactersInDocument = 262144
    $Reader = [System.Xml.XmlReader]::Create($Probe, $Settings)
    try {
        $Doc = New-Object System.Xml.XmlDocument
        $Doc.XmlResolver = $null
        $Doc.Load($Reader)
        return ,$Doc
    } catch {
        throw 'Selected source XML could not be parsed safely.'
    } finally { $Reader.Dispose() }
}

function Safe-BackupValue([string]$Value) {
    if ([string]::IsNullOrEmpty($Value)) { return 'UNSET' }
    if ($Value.Length -le 160 -and $Value -match '^[A-Za-z0-9_./@|:-]+$') {
        return $Value
    }
    return 'OTHER_VALUE_REDACTED'
}

$ManifestPath = 'android/app/src/main/AndroidManifest.xml'
$Manifest = Read-BackupXml $ManifestPath
if ($null -eq $Manifest) { throw 'Main Android manifest is missing.' }
$Applications = @($Manifest.SelectNodes(
    "/*[local-name()='manifest']/*[local-name()='application']"
))
if ($Applications.Count -ne 1) { throw 'Unexpected manifest application shape.' }
$Application = $Applications[0]
$AndroidNs = 'http://schemas.android.com/apk/res/android'
$Attributes = [ordered]@{}
$ResourceNames = @()
foreach ($Name in @('allowBackup', 'fullBackupContent',
                    'dataExtractionRules', 'fullBackupOnly', 'restoreAnyVersion')) {
    $Value = $Application.GetAttribute($Name, $AndroidNs)
    $Attributes[$Name] = 'OTHER_VALUE_REDACTED'
    if (-not $Value) { $Attributes[$Name] = 'UNSET' }
    elseif ($Value -match '^(true|false|@xml/[A-Za-z0-9_]+)$') {
        $Attributes[$Name] = $Value
    }
    if ($Name -in @('fullBackupContent', 'dataExtractionRules') -and
        $Value -match '^@xml/([A-Za-z0-9_]+)$') {
        $ResourceNames += $Matches[1]
    }
}
$Folders = @('xml')
if (Test-Path -LiteralPath 'android/app/src/main/res') {
    $ResItem = Get-Item -LiteralPath 'android/app/src/main/res' -Force
    if (($ResItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Linked resource directory encountered; inspection stopped.'
    }
    $Folders += @(Get-ChildItem -LiteralPath 'android/app/src/main/res' -Directory |
        Where-Object { $_.Name -match '^xml-[A-Za-z0-9-]+$' } |
        ForEach-Object { $_.Name })
}
$Resources = foreach ($Name in @($ResourceNames | Select-Object -Unique)) {
    foreach ($Folder in @($Folders | Select-Object -Unique)) {
        $Relative = "android/app/src/main/res/$Folder/$Name.xml"
        $Doc = Read-BackupXml $Relative
        if ($null -eq $Doc) {
            [ordered]@{ path=$Relative; status='MISSING'; rules=@() }
            continue
        }
        $Rules = @($Doc.SelectNodes(
            "//*[local-name()='include' or local-name()='exclude']"
        ))
        if ($Rules.Count -gt 256) { throw 'Unexpected backup rule count.' }
        $Modes = @($Doc.SelectNodes(
            "//*[local-name()='cloud-backup' or local-name()='device-transfer' or local-name()='cross-platform-transfer']"
        ))
        [ordered]@{
            path=$Relative
            status='PARSED_SOURCE_ONLY'
            sha256=(Get-FileHash -LiteralPath $Relative -Algorithm SHA256).Hash.ToLowerInvariant()
            root=Safe-BackupValue $Doc.DocumentElement.LocalName
            modes=@($Modes | ForEach-Object {
                [ordered]@{
                    mode=Safe-BackupValue $_.LocalName
                    disableIfNoEncryptionCapabilities=Safe-BackupValue (
                        $_.GetAttribute('disableIfNoEncryptionCapabilities')
                    )
                }
            })
            rules=@($Rules | ForEach-Object {
                [ordered]@{
                    mode=Safe-BackupValue $_.ParentNode.LocalName
                    operation=$_.LocalName
                    domain=Safe-BackupValue ($_.GetAttribute('domain'))
                    path=Safe-BackupValue ($_.GetAttribute('path'))
                    requireFlags=Safe-BackupValue ($_.GetAttribute('requireFlags'))
                }
            })
        }
    }
}
[ordered]@{
    stage_step='5.2'
    scope='OWNER_MAIN_MANIFEST_AND_REFERENCED_BACKUP_XML_SOURCE_ONLY'
    manifest_sha256=(Get-FileHash -LiteralPath $ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    application_attributes=$Attributes
    custom_backup_agent_declared=$Application.HasAttribute('backupAgent', $AndroidNs)
    referenced_backup_resources=@($Resources)
    merged_release_manifest_verified=$false
    actual_token_store_or_backup_payload_inspected=$false
    device_backup_restore_checks_run=0
    files_settings_or_accounts_changed=$false
    build_sync_install_or_sign_run=$false
    native_security_acceptance=$false
} | ConvertTo-Json -Depth 8
