# FR.2.4.E2 — Windows backend PASS; dependency parser correction

15 October2026,FRE44. Source commit51df7703e24172266288069bb403c9c064582a83. [Sanitized owner result](security-fr-2-email-backend-owner-Windows-result.json), [replacement checker local evidence](security-fr-2-email-backend-dependency-recheck-local.json).

The owner returned all46 backend checks PASS,0fail,exit0 on Windows Node22.17.0/PGlite0.5.8:39 actual candidate-SQL checks and7 crypto tests,54 source migrations,59 source SHA256 matches,4 syntax checks. Both the pasted PowerShell hash loop and verifier completed. This establishes owner-run offline backend evidence using modeled Auth users/sessions; it establishes no real Auth, email, cookie, hosted or native acceptance. No need to repeat the46 backend cases for this handoff correction.

The separate PowerShell package-lock check did not complete. ConvertFrom-Json rejected an object property name, after which the next comparison used an unset parsed-lock object and printed a misleading integrity-mismatch exception. The transcript therefore does not establish an actual package-integrity mismatch. The original chat batch was pasted as independent top-level statements, so later statements continued despite the earlier terminating statement errors. Npm reported successful installation of one package, but successful owner lock-integrity comparison remains pending.

Npm package-lock packages objects normally include the empty root key. The assistant's existing local npm lock was inspected and has that key. Microsoft documents that ConvertFrom-Json without AsHashtable cannot handle empty-string keys: https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/convertfrom-json?view=powershell-7.4 . This explains the observed error shape; the owner's raw lock was not uploaded or read independently. The replacement uses Node JSON.parse and no PowerShell lockfile conversion or PowerShell version upgrade. An enclosing script block stops this replacement batch after any dependency-check failure.

The exact replacement JavaScript was exercised locally via Node stdin against copied59 real source inputs and installed-package metadata in a temporary fixture. It accepts the real local lock including its empty root key, rejects deliberately changed dependency integrity and rejects deliberately changed source bytes:3/3 checks PASS,exit0. This is local fixture evidence, not owner Windows execution. The checker compares the installed package name/version plus pinned lock version, npm registry tarball URL and SHA512 integrity against the manifest and independent literal pin. It rehashes all59 source inputs. It does not independently hash every installed dependency byte or re-run the backend. No npm install/update, mail, SQL, hosted request or file mutation occurs.

Run the following complete block in the same PowerShell window where EmailBackendRoot remains available. If that variable or directory is unavailable, it stops and asks for the safe error text; it never guesses another directory. Return only its JSON and exit code. Candidate SQL remains outside the hosted installation handoff; old TOTP commands and Admin promotion remain deferred. Once dependency metadata is confirmed, proceed to E3 trusted email adapter and same-origin device-cookie gateway, then E4 UI and complete data-entry-point guards. Hosted delivery/security acceptance still requires later tests; no finding closes and APK remains deferred.

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $PSNativeCommandUseErrorActionPreference = $false

    if (-not (Get-Variable -Name EmailBackendRoot -ErrorAction SilentlyContinue)) {
        throw 'The previous temporary-folder variable is unavailable. Return this message here.'
    }
    if (-not (Test-Path -LiteralPath $EmailBackendRoot -PathType Container)) {
        throw 'The previous temporary folder is unavailable. Return this message here.'
    }

    @'
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
try {
  const root = path.resolve(process.argv[2]);
  const readJSON = relative => JSON.parse(
    fs.readFileSync(path.join(root, relative), 'utf8').replace(/^\uFEFF/, '')
  );
  const manifest = readJSON('docs/security-audit/security-fr-2-email-backend-source-manifest.json');
  const lock = readJSON('package-lock.json');
  const entry = lock.packages?.['node_modules/@electric-sql/pglite'];
  const installed = readJSON('node_modules/@electric-sql/pglite/package.json');
  const integrity = 'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==';
  if (manifest.test_dependency.package !== '@electric-sql/pglite' ||
      manifest.test_dependency.version !== '0.5.8' ||
      manifest.test_dependency.integrity !== integrity ||
      entry?.version !== '0.5.8' || entry.integrity !== integrity ||
      entry.resolved !== 'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz' ||
      installed.name !== '@electric-sql/pglite' || installed.version !== '0.5.8') {
    throw new Error('DEPENDENCY_METADATA_MISMATCH');
  }
  const files = Object.entries(manifest.file_sha256);
  if (files.length !== 59) throw new Error('SOURCE_COUNT_MISMATCH');
  for (const [relative, expected] of files) {
    const actual = crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(root, relative))).digest('hex');
    if (actual !== expected) throw new Error('SOURCE_HASH_MISMATCH');
  }
  console.log(JSON.stringify({
    stage_step: 'FR.2.4.E2_DEPENDENCY_RECHECK',
    result: 'SOURCE_HASHES_AND_PINNED_DEPENDENCY_METADATA_PASS',
    node_version: process.version,
    source_files_SHA256_verified: files.length,
    installed_package_name_and_version_match: true,
    package_lock_version_registry_and_integrity_match: true,
    installed_package_bytes_independently_hashed: false,
    backend_tests_rerun: false,
    hosted_requests: 0,
    files_or_settings_changed: false,
    hosted_acceptance: false,
    exit_code: 0
  }, null, 2));
} catch (error) {
  const safe = ['DEPENDENCY_METADATA_MISMATCH', 'SOURCE_COUNT_MISMATCH', 'SOURCE_HASH_MISMATCH'];
  console.log(JSON.stringify({
    stage_step: 'FR.2.4.E2_DEPENDENCY_RECHECK',
    result: 'DEPENDENCY_RECHECK_NEEDS_REVIEW',
    problem_code: safe.includes(error.message) ? error.message : 'LOCAL_INPUT_UNAVAILABLE_OR_INVALID',
    hosted_requests: 0,
    files_or_settings_changed: false,
    exit_code: 1
  }, null, 2));
  process.exitCode = 1;
}
'@ | node - $EmailBackendRoot

    $EmailDependencyExit = $LASTEXITCODE
    Write-Host ('Dependency recheck exit code: ' + $EmailDependencyExit)
    if ($EmailDependencyExit -ne 0) {
        throw 'Dependency recheck needs review. Return its JSON and exit code.'
    }
}
```
