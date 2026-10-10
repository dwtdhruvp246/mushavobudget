# 2.2.2/2.2.3: prepare or repair new folders using byte-preserving Git extraction.
# No secrets, SQL execution, provider deployment or checkout/reset are performed.
$ErrorActionPreference = "Stop"
$mushavoCommit = $env:MUSHAVO_STAGE2_CONTACT_COMMIT
if ($mushavoCommit -notmatch '^[0-9a-f]{40}$') { throw "A pinned contact candidate commit is required." }
$mushavoRepair = -not [string]::IsNullOrWhiteSpace($env:MUSHAVO_STAGE2_CONTACT_REPAIR_FROM)
$mushavoSource = if ($mushavoRepair) {
    $env:MUSHAVO_STAGE2_CONTACT_REPAIR_FROM
} else {
    "C:\Users\HP\Desktop\MushavoBudget-Staging-Headers-e86954edacbc4788b027093b3183f443"
}
if (-not (Test-Path -LiteralPath $mushavoSource -PathType Container)) {
    $mushavoSource = (Read-Host "Full path to your existing STAGING web folder").Trim().Trim('"')
}
$mushavoSitekey = ""
if (-not $mushavoRepair) {
    $mushavoSitekey = (Read-Host "PUBLIC sitekey for the Mushavo Budget STAGING Turnstile widget").Trim()
    if ($mushavoSitekey -notmatch '^0x[A-Za-z0-9_-]{10,100}$') {
        throw "Expected a real public Turnstile sitekey. Do not enter the secret key."
    }
}
$mushavoDesktop = [Environment]::GetFolderPath("Desktop")
$mushavoCandidateRoot = Join-Path $mushavoDesktop ("MushavoBudget-Staging-Contact-" + [guid]::NewGuid().ToString("N"))
if (Test-Path -LiteralPath $mushavoCandidateRoot) { throw "New candidate folder unexpectedly exists." }
New-Item -ItemType Directory -Path $mushavoCandidateRoot | Out-Null
$mushavoWeb = Join-Path $mushavoCandidateRoot "web"
$mushavoExtractor = @'
// Native Git stdout stays a Buffer; PowerShell never decodes repository assets.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
class PreparationError extends Error {}
try {
  const commit = process.env.MUSHAVO_STAGE2_CONTACT_COMMIT;
  const root = process.env.MUSHAVO_STAGE2_CONTACT_NEW_ROOT;
  const source = process.env.MUSHAVO_STAGE2_CONTACT_SOURCE;
  const repair = process.env.MUSHAVO_STAGE2_CONTACT_REPAIR_MODE === 'true';
  if (!/^[0-9a-f]{40}$/.test(commit || '') || !path.isAbsolute(root || '') || !path.isAbsolute(source || '')) {
    throw new PreparationError('INVALID_PREPARATION_CONTEXT');
  }
  const names = ['site.js', 'contact.html', 'scripts/prepare-stage-2-headers.cjs',
    'scripts/prepare-stage-2-contact.cjs', 'scripts/check-staging-contact-api.cjs',
    'supabase/functions/submit-enquiry/index.ts', 'supabase/functions/submit-enquiry/handler.mjs'];
  const contents = names.map(name => [name, execFileSync('git', ['show', commit + ':' + name],
    { encoding: null, windowsHide: true, maxBuffer: 8 * 1024 * 1024 })]);
  for (const [name, bytes] of contents) {
    if (!Buffer.isBuffer(bytes) || !bytes.length) throw new PreparationError('EMPTY_PINNED_FILE');
    const destination = path.join(root, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes, { flag: 'wx' });
  }
  const { prepareContact } = require(path.join(root, 'scripts/prepare-stage-2-contact.cjs'));
  const { PRODUCTION, STAGING } = require(path.join(root, 'scripts/prepare-stage-2-headers.cjs'));
  const { hash, SITE_HASH, HTML_HASH } = require(path.join(root, 'scripts/check-staging-contact-api.cjs'));
  if (hash(fs.readFileSync(path.join(root, 'site.js'), 'utf8')) !== SITE_HASH ||
      hash(fs.readFileSync(path.join(root, 'contact.html'), 'utf8').replace(PRODUCTION, STAGING)) !== HTML_HASH) {
    throw new PreparationError('PINNED_CONTACT_CANDIDATE_MISMATCH');
  }
  let sitekey = process.env.MUSHAVO_STAGE2_CONTACT_PUBLIC_KEY || '';
  if (repair) {
    const matches = [...fs.readFileSync(path.join(source, 'contact.html'), 'utf8')
      .matchAll(/data-sitekey="(0x[A-Za-z0-9_-]{10,100})"/g)];
    if (matches.length !== 1) throw new PreparationError('EXISTING_PUBLIC_SITEKEY_NOT_UNIQUE');
    sitekey = matches[0][1];
  }
  fs.writeFileSync(path.join(root, 'supabase/config.toml'), '[functions.submit-enquiry]\nverify_jwt = false\n', { flag: 'wx' });
  const web = path.join(root, 'web');
  const report = prepareContact(source, web, sitekey);
  const jsMatches = hash(fs.readFileSync(path.join(web, 'site.js'), 'utf8')) === SITE_HASH;
  const htmlMatches = hash(fs.readFileSync(path.join(web, 'contact.html'), 'utf8')
    .replace(/data-sitekey="0x[A-Za-z0-9_-]{10,100}"/, 'data-sitekey=""')) === HTML_HASH;
  if (!jsMatches || !htmlMatches) throw new PreparationError('PREPARED_CONTACT_CANDIDATE_MISMATCH');
  console.log(JSON.stringify({ ...report,
    stage_step: repair ? '2.2.3' : '2.2.2',
    result: repair ? 'STAGING_CONTACT_ENCODING_REPAIR_PREPARED' : report.result,
    source_commit: commit, binary_git_extraction_used: true,
    reviewed_contact_javascript_match: jsMatches, reviewed_contact_html_match: htmlMatches,
    existing_public_sitekey_reused: repair,
    existing_source_config_bytes_preserved: fs.readFileSync(path.join(source, 'config.js'))
      .equals(fs.readFileSync(path.join(web, 'config.js'))),
    edge_or_database_redeployment_performed: false,
  }, null, 2));
} catch (error) {
  console.error('Contact preparation: ' + (error instanceof PreparationError ? error.message : 'PREPARATION_READ_OR_WRITE_FAILED'));
  process.exitCode = 1;
}
'@
try {
    $env:MUSHAVO_STAGE2_CONTACT_EXTRACTOR = $mushavoExtractor
    $env:MUSHAVO_STAGE2_CONTACT_NEW_ROOT = $mushavoCandidateRoot
    $env:MUSHAVO_STAGE2_CONTACT_SOURCE = $mushavoSource
    $env:MUSHAVO_STAGE2_CONTACT_REPAIR_MODE = $mushavoRepair.ToString().ToLowerInvariant()
    $env:MUSHAVO_STAGE2_CONTACT_PUBLIC_KEY = $mushavoSitekey
    node -e 'eval(process.env.MUSHAVO_STAGE2_CONTACT_EXTRACTOR)'
    if ($LASTEXITCODE -ne 0) {
        throw "Contact preparation failed. Keep the new candidate folder and send the error."
    }
}
finally {
    foreach ($mushavoTemporaryVariable in @(
        "MUSHAVO_STAGE2_CONTACT_EXTRACTOR", "MUSHAVO_STAGE2_CONTACT_NEW_ROOT",
        "MUSHAVO_STAGE2_CONTACT_SOURCE", "MUSHAVO_STAGE2_CONTACT_REPAIR_MODE",
        "MUSHAVO_STAGE2_CONTACT_PUBLIC_KEY"
    )) {
        Remove-Item "Env:$mushavoTemporaryVariable" -ErrorAction SilentlyContinue
    }
}
Write-Output "Source commit: $mushavoCommit"
Write-Output "Cloudflare staging upload folder: $mushavoWeb"
if (-not $mushavoRepair) {
    Write-Output "Single-function deployment folder: $mushavoCandidateRoot"
}
Write-Output "Preparation only. No upload, Edge deployment or database change was performed."
