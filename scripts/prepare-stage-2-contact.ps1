# 2.2.2: prepare new web and single-function deployment folders from a pinned commit.
# No secrets, SQL execution, provider deployment or checkout/reset are performed.
$ErrorActionPreference = "Stop"
$mushavoCommit = $env:MUSHAVO_STAGE2_CONTACT_COMMIT
if ($mushavoCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned contact candidate commit is required." }
$mushavoSource = "C:\Users\HP\Desktop\MushavoBudget-Staging-Headers-e86954edacbc4788b027093b3183f443"
if (-not (Test-Path -LiteralPath $mushavoSource -PathType Container)) {
    $mushavoSource = (Read-Host "Full path to your existing STAGING web folder").Trim().Trim('"')
}
$mushavoSitekey = (Read-Host "PUBLIC sitekey for the Mushavo Budget STAGING Turnstile widget").Trim()
if ($mushavoSitekey -notmatch '^0x[A-Za-z0-9_-]{10,100}$') {
    throw "Expected a real public Turnstile sitekey. Do not enter the secret key."
}
$mushavoFiles = @{}
foreach ($mushavoPath in @(
    "site.js", "contact.html", "scripts/prepare-stage-2-headers.cjs", "scripts/prepare-stage-2-contact.cjs",
    "supabase/functions/submit-enquiry/index.ts", "supabase/functions/submit-enquiry/handler.mjs"
)) {
    $mushavoText = git show "${mushavoCommit}:$mushavoPath" | Out-String
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoText)) {
        throw "Pinned file could not be read: $mushavoPath"
    }
    $mushavoFiles[$mushavoPath] = $mushavoText
}
$mushavoDesktop = [Environment]::GetFolderPath("Desktop")
$mushavoCandidateRoot = Join-Path $mushavoDesktop ("MushavoBudget-Staging-Contact-" + [guid]::NewGuid().ToString("N"))
if (Test-Path -LiteralPath $mushavoCandidateRoot) { throw "New candidate folder unexpectedly exists." }
New-Item -ItemType Directory -Path $mushavoCandidateRoot | Out-Null
$mushavoUtf8 = [Text.UTF8Encoding]::new($false)
foreach ($mushavoPath in $mushavoFiles.Keys) {
    $mushavoDestination = Join-Path $mushavoCandidateRoot $mushavoPath
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($mushavoDestination)) -Force | Out-Null
    [IO.File]::WriteAllText($mushavoDestination, $mushavoFiles[$mushavoPath], $mushavoUtf8)
}
$mushavoConfig = "[functions.submit-enquiry]`nverify_jwt = false`n"
[IO.File]::WriteAllText((Join-Path $mushavoCandidateRoot "supabase/config.toml"), $mushavoConfig, $mushavoUtf8)
$mushavoWeb = Join-Path $mushavoCandidateRoot "web"
& node (Join-Path $mushavoCandidateRoot "scripts/prepare-stage-2-contact.cjs") $mushavoSource $mushavoWeb $mushavoSitekey
if ($LASTEXITCODE -ne 0) { throw "Contact preparation failed. Keep the candidate folder and send the error only." }
Write-Output "Source commit: $mushavoCommit"
Write-Output "Cloudflare staging upload folder: $mushavoWeb"
Write-Output "Single-function deployment folder: $mushavoCandidateRoot"
Write-Output "Preparation only. No upload, Edge deployment or database change was performed."
