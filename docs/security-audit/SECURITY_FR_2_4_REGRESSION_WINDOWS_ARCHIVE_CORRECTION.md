# FR.2.4.E4.14 — Windows archive line-ending correction

17 October 2026, FRE78. [First owner Windows result](security-fr-2-email-regression-first-owner-Windows-result.json) at commit 01f916084c31fda7dce8fd8add354f2ad37494e9: Node v22.17.0/PGlite 0.5.8, zero source hashes completed, zero syntax checks or tests run, empty groups, exit 1. The manifest parsed. This is a source-preflight block, not 1522 failed tests; no hosted operation or acceptance occurred.

## Reproduction and correction

The first manifest entry is .assetsignore. The previous default `* text=auto` did not specify its export EOL. Actual isolated Git archive with core.autocrlf=false and core.eol=crlf exported LF source as CRLF, changing SHA256. Thus core.autocrlf=false alone is insufficient. This reproduces a concrete first-entry failure consistent with the owner result. The receipt did not include the failed filename or exported bytes, so their exact Windows values are not independently observed; the corrected owner run must confirm the diagnosis.

The default attribute is now `* text=auto eol=lf`. Explicit binary declarations are unchanged. Exact hashes remain mandatory; the verifier does not normalize away mismatches. Application source bytes, all SQL candidates, all 55 migrations and schema are unchanged. No existing checkout is renormalized and no global Git settings change. The handoff additionally uses `-c core.eol=lf` for that single archive command. Failure output now names the fixed checkpoint and a safe relative source path without raw exceptions or source contents.

## Verification

[New actual Git tests](../../tests/regression-source-archive.test.mjs) create temporary repositories with isolated empty configuration, disabled hooks and no remotes. One case reproduces legacy CRLF mismatch. Two cases commit every current manifest input, export with core.eol=crlf and core.eol=lf, extract with actual tar and compare all 612 exact hashes, including binary assets. Temporary data is removed. [Archive result](security-fr-2-email-regression-archive-export-local-checks.json): 3 PASS, Git 2.51.1/GNU tar 1.35/Node v24.19.0 on Linux; native Windows execution remains pending.

[Complete corrected result](security-fr-2-email-regression-archive-local-checks.json): 1525 PASS, zero FAIL/cancelled/skipped/todo, exit 0, all 612 hashes and 316 syntax targets. It retains all prior 1522 cases and adds exactly three archive cases: 1421 discovered tests in 119 files (108 MJS/11 CJS), plus 104 actual SQL integration cases in eight batches. [Manifest](security-fr-2-email-regression-source-manifest.json), [contract](security-fr-2-email-regression-contract.json). The prior local1522 receipt and all earlier evidence remain historical at their pinned commits.

## Owner retry and remaining work

Run only the full pinned temporary-folder PowerShell block in chat, with core.autocrlf=false/core.eol=lf. Expected: 1525 PASS, zero FAIL, exit 0, 612 hashes and 316 syntax checks. Return JSON and exit code. No staging SQL, credentials, email or deployment action is requested. Existing staging Worker and DPAPI file are untouched.

This does not establish real Deno/Cloudflare/native bundles, hosted Auth/JWT/SQL, browser cookies, email delivery, parallel PostgreSQL or recovery acceptance. SQL uses in-memory models and synthetic provider ports. npm may reach the registry for the locked dependency with lifecycle scripts disabled; installed package bytes are not independently hashed. Default Node fetch/HTTP is disabled in test children; this is not an OS sandbox. Full CI and coordinated gateway/client/SQL activation remain pending. All 20 findings remain open; release gate OPEN_PENDING_REQUIRED_EVIDENCE; final re-audit PLANNED_NOT_PERFORMED; production excluded, APK/native deferred.
