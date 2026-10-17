# 5.3: selected public source configuration only. No build or device action.
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'
$SourceMeta = [ordered]@{}

function Read-ReviewSource([string]$Relative) {
    $Probe = (Get-Location).Path
    foreach ($Part in $Relative.Split('/')) {
        $Probe = Join-Path $Probe $Part
        if (-not (Test-Path -LiteralPath $Probe)) {
            $SourceMeta[$Relative] = [ordered]@{ status='MISSING' }
            return $null
        }
        $Item = Get-Item -LiteralPath $Probe -Force
        if (($Item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'Linked source path encountered; inspection stopped.'
        }
    }
    if ($Item.PSIsContainer -or $Item.Length -gt 262144) {
        throw 'Unexpected source file type or size.'
    }
    $SourceMeta[$Relative] = [ordered]@{
        status='READ_SOURCE_ONLY'
        sha256=(Get-FileHash -LiteralPath $Relative -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return [IO.File]::ReadAllText($Probe)
}
function Read-ReviewXml([string]$Relative) {
    $Text = Read-ReviewSource $Relative
    if ($null -eq $Text) { return $null }
    $Settings = New-Object System.Xml.XmlReaderSettings
    $Settings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
    $Settings.XmlResolver = $null
    $Settings.MaxCharactersInDocument = 262144
    $Reader = [System.Xml.XmlReader]::Create(
        (New-Object IO.StringReader($Text)), $Settings
    )
    try {
        $Doc = New-Object System.Xml.XmlDocument
        $Doc.XmlResolver = $null
        $Doc.Load($Reader)
        return ,$Doc
    } catch { throw 'Selected source XML could not be parsed safely.' }
    finally { $Reader.Dispose() }
}
function Public-Value($Value) {
    if ($null -eq $Value -or "$Value" -eq '') { return 'UNSET' }
    if ($Value -is [bool]) { return $Value }
    $Text = [string]$Value
    if ($Text.Length -le 160 -and $Text -match '^[A-Za-z0-9_./@*:$}{+;-]+$') {
        return $Text
    }
    return 'OTHER_VALUE_REDACTED'
}
function Url-Summary($Value) {
    if (-not $Value) { return [ordered]@{ status='UNSET' } }
    $Uri = $null
    if (-not [Uri]::TryCreate([string]$Value, [UriKind]::Absolute, [ref]$Uri)) {
        return [ordered]@{ status='INVALID_OR_UNSUPPORTED' }
    }
    return [ordered]@{
        scheme=Public-Value $Uri.Scheme
        host=Public-Value $Uri.Host
        has_userinfo=[bool]$Uri.UserInfo
        has_query_or_fragment=[bool]($Uri.Query -or $Uri.Fragment)
    }
}
$ConfigText = Read-ReviewSource 'capacitor.config.json'
$ConfigSummary = [ordered]@{ status='MISSING_JSON_CONFIG' }
if ($null -ne $ConfigText) {
    try { $Config = $ConfigText | ConvertFrom-Json }
    catch { throw 'Capacitor JSON could not be parsed.' }
    $ConfigSummary = [ordered]@{
        status='PARSED_SOURCE_ONLY'
        app_id=Public-Value $Config.appId
        web_dir_is_www=($Config.webDir -eq 'www')
        server_hostname=Public-Value $Config.server.hostname
        android_scheme=Public-Value $Config.server.androidScheme
        ios_scheme=Public-Value $Config.server.iosScheme
        server_url_summary=Url-Summary $Config.server.url
        cleartext=Public-Value $Config.server.cleartext
        allow_navigation_entries=@($Config.server.allowNavigation |
            ForEach-Object { Public-Value $_ })
        allow_mixed_content=Public-Value $Config.android.allowMixedContent
        web_contents_debugging=Public-Value $Config.android.webContentsDebuggingEnabled
        logging_behavior=Public-Value $Config.loggingBehavior
        android_logging_behavior=Public-Value $Config.android.loggingBehavior
        plugin_config_present=[bool]$Config.plugins
    }
}
$Doc = Read-ReviewXml 'android/app/src/main/AndroidManifest.xml'
if ($null -eq $Doc) { throw 'Main Android manifest missing.' }
$Apps = @($Doc.SelectNodes(
    "/*[local-name()='manifest']/*[local-name()='application']"
))
if ($Apps.Count -ne 1) { throw 'Unexpected manifest application shape.' }
$AppNode = $Apps[0]
$Ns = 'http://schemas.android.com/apk/res/android'
$Attributes = [ordered]@{}
foreach ($Name in @('usesCleartextTraffic','debuggable','networkSecurityConfig')) {
    $Attributes[$Name] = Public-Value ($AppNode.GetAttribute($Name,$Ns))
}
$Permissions = @($Doc.SelectNodes(
    "/*/*[local-name()='uses-permission' or local-name()='uses-permission-sdk-23']"
) | ForEach-Object {
    [ordered]@{
        name=Public-Value ($_.GetAttribute('name',$Ns))
        max_sdk=Public-Value ($_.GetAttribute('maxSdkVersion',$Ns))
    }
})
$Components = @($AppNode.SelectNodes(
    "*[local-name()='activity' or local-name()='activity-alias' or local-name()='service' or local-name()='receiver' or local-name()='provider']"
) | ForEach-Object {
    [ordered]@{
        type=$_.LocalName
        name=Public-Value ($_.GetAttribute('name',$Ns))
        exported=Public-Value ($_.GetAttribute('exported',$Ns))
        permission=Public-Value ($_.GetAttribute('permission',$Ns))
        grant_uri_permissions=Public-Value ($_.GetAttribute('grantUriPermissions',$Ns))
        file_provider_resources=@($_.SelectNodes("*[local-name()='meta-data']") |
            Where-Object { $_.GetAttribute('name',$Ns) -eq 'android.support.FILE_PROVIDER_PATHS' } |
            ForEach-Object { Public-Value ($_.GetAttribute('resource',$Ns)) })
        intent_filters=@($_.SelectNodes("*[local-name()='intent-filter']") |
            ForEach-Object {
                [ordered]@{
                    auto_verify=Public-Value ($_.GetAttribute('autoVerify',$Ns))
                    actions=@($_.SelectNodes("*[local-name()='action']") |
                        ForEach-Object { Public-Value ($_.GetAttribute('name',$Ns)) })
                    categories=@($_.SelectNodes("*[local-name()='category']") |
                        ForEach-Object { Public-Value ($_.GetAttribute('name',$Ns)) })
                    data=@($_.SelectNodes("*[local-name()='data']") | ForEach-Object {
                        $Route = [ordered]@{}
                        foreach ($Name in @('scheme','host','port','path','pathPrefix','pathPattern')) {
                            $Route[$Name] = Public-Value ($_.GetAttribute($Name,$Ns))
                        }
                        $Route
                    })
                }
            })
    }
})
$ResourceNames = @('file_paths')
foreach ($Meta in $AppNode.SelectNodes(".//*[local-name()='meta-data']")) {
    if ($Meta.GetAttribute('name',$Ns) -eq 'android.support.FILE_PROVIDER_PATHS') {
        $Ref = $Meta.GetAttribute('resource',$Ns)
        if ($Ref -match '^@xml/([A-Za-z0-9_]+)$') { $ResourceNames += $Matches[1] }
    }
}
$NetworkRef = $AppNode.GetAttribute('networkSecurityConfig',$Ns)
if ($NetworkRef -match '^@xml/([A-Za-z0-9_]+)$') { $ResourceNames += $Matches[1] }
$Folders = @('xml')
if (Test-Path -LiteralPath 'android/app/src/main/res') {
    $ResItem = Get-Item -LiteralPath 'android/app/src/main/res' -Force
    if (($ResItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'Linked resource directory encountered.'
    }
    $Folders += @(Get-ChildItem -LiteralPath 'android/app/src/main/res' -Directory |
        Where-Object { $_.Name -match '^xml-[A-Za-z0-9-]+$' } |
        ForEach-Object { $_.Name })
}
$Resources = foreach ($Name in @($ResourceNames | Select-Object -Unique)) {
    foreach ($Folder in @($Folders | Select-Object -Unique)) {
        $Relative = "android/app/src/main/res/$Folder/$Name.xml"
        $Xml = Read-ReviewXml $Relative
        if ($null -eq $Xml) {
            [ordered]@{ path=$Relative; status='MISSING' }
            continue
        }
        $Nodes = @($Xml.SelectNodes('//*'))
        if ($Nodes.Count -gt 256) { throw 'Unexpected resource node count.' }
        [ordered]@{
            path=$Relative
            nodes=@($Nodes | ForEach-Object {
                $Row = [ordered]@{ element=Public-Value $_.LocalName }
                foreach ($Key in @('cleartextTrafficPermitted','includeSubdomains',
                                   'src','overridePins','name','path')) {
                    if ($_.HasAttribute($Key)) {
                        $Row[$Key] = Public-Value ($_.GetAttribute($Key))
                    }
                }
                if ($_.LocalName -eq 'domain') { $Row.domain = Public-Value $_.InnerText }
                $Row
            })
        }
    }
}
[ordered]@{
    stage_step='5.3'
    scope='OWNER_SELECTED_CAPACITOR_JSON_AND_ANDROID_MAIN_SOURCE_ONLY'
    capacitor_config=$ConfigSummary
    android_application_attributes=$Attributes
    android_permissions=$Permissions
    android_components=$Components
    selected_network_and_file_path_resources=@($Resources)
    file_metadata=$SourceMeta
    merged_release_or_effective_native_settings_verified=$false
    actual_callback_origin_link_delivery_or_privacy_archive_verified=$false
    hosted_or_device_checks_run=0
    files_settings_or_accounts_changed=$false
    build_sync_install_or_sign_run=$false
    native_security_acceptance=$false
} | ConvertTo-Json -Depth 12
