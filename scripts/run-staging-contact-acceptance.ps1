# 2.2.3: one staging API batch and clipboard handoff for read-only row counts.
$ErrorActionPreference = "Stop"
$mushavoContactCommit = $env:MUSHAVO_CONTACT_ACCEPTANCE_COMMIT
if ($mushavoContactCommit -notmatch '^[0-9a-f]{40}$') {
    throw "A pinned contact acceptance commit is required."
}
$mushavoContactCode = git show `
    "${mushavoContactCommit}:scripts/check-staging-contact-api.cjs" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoContactCode)) {
    throw "Contact API checker could not be read."
}
$mushavoContactSql = git show `
    "${mushavoContactCommit}:supabase/diagnostics/security_stage_2_contact_acceptance.sql" | Out-String
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($mushavoContactSql)) {
    throw "Read-only contact review SQL could not be read."
}
$mushavoContactPassword = Read-Host `
    "STAGING APP password for audit.owner@example.com (press Enter to skip; not the database password)" `
    -AsSecureString
$mushavoContactBstr = [IntPtr]::Zero
try {
    $env:MUSHAVO_CONTACT_AUDIT_CODE = $mushavoContactCode
    if ($mushavoContactPassword.Length -gt 0) {
        $mushavoContactBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($mushavoContactPassword)
        $env:MUSHAVO_CONTACT_TEST_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($mushavoContactBstr)
    } else {
        Remove-Item Env:MUSHAVO_CONTACT_TEST_PASSWORD -ErrorAction SilentlyContinue
    }
    node -e 'eval(process.env.MUSHAVO_CONTACT_AUDIT_CODE); module.exports.run({password:process.env.MUSHAVO_CONTACT_TEST_PASSWORD || String()}).then(r=>{console.log(JSON.stringify(r,null,2));if(r.result.endsWith(''_REVIEW''))process.exitCode=1;}).catch(()=>{console.log(''2.2.3: Local API check failed.'');process.exitCode=1;});'
    $mushavoContactApiExit = $LASTEXITCODE
}
finally {
    if ($mushavoContactBstr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($mushavoContactBstr)
    }
    $mushavoContactPassword.Dispose()
    Remove-Item Env:MUSHAVO_CONTACT_AUDIT_CODE -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_CONTACT_TEST_PASSWORD -ErrorAction SilentlyContinue
}
Write-Output "2.2.3: API batch completed with exit code $mushavoContactApiExit. Keep its JSON summary."
if ($mushavoContactApiExit -ne 0) {
    throw "API checks require review. Stop here and send the summary. Browser test writes were not requested."
}
Read-Host "Keep this window open. Complete the browser form tests in the instructions, then return and press Enter to copy the read-only review SQL" | Out-Null
Set-Clipboard -Value $mushavoContactSql
Write-Output "Read-only contact review SQL is now on your clipboard."
Write-Output "Paste into a new query in STAGING dczlddwbtgvfdujgcitb SQL Editor and run the whole script."
Write-Output "Send the API summary, SQL result rows and the form checklist. No passwords, tokens or raw enquiries."
