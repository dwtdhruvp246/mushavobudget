# FR.2.4.E3.3 — Git archive line-ending correction

15 October 2026, FRE50. [Owner first result](security-fr-2-zoho-private-setup-first-owner-result.json), [actual Git archive checks](security-fr-2-zoho-archive-local-checks.json). The owner Node22.17 verifier matched two source hashes, ran zero syntax checks and zero test cases, then exited 1. The outer handoff stopped there, before PowerShell private setup, credential prompts or provider requests. No refresh token was requested by this run.

## Cause and bounded correction

The next selected file was scripts/setup-fr-2-zoho-private.ps1. The committed attributes had a general text=auto rule and explicit LF rules for JS/JSON files, but no LF rule for this PowerShell wrapper. Actual Git archive fixtures reproduced the problem under core.autocrlf=true: the reviewed 13911-byte LF wrapper (SHA256 708fee3f5e68610f378a50c7f0dc6e44661e309a5521ee5fd6da3b8da27d9617) became a 14162-byte CRLF wrapper (SHA256 a5006073510d1f5ed32ea50727807601b2a93b1cb5885e40d20798b4b73d9a28). The first two .mjs files already have explicit LF rules, matching the owner's stop position. The owner did not return actual wrapper bytes/hash or core.autocrlf, so this is a demonstrated handoff defect and a supported explanation, not independent proof of the owner's precise bytes.

Add only the scoped attribute scripts/setup-fr-2-zoho-private.ps1 text eol=lf. The corrected chat handoff also uses git -c core.autocrlf=false archive for that single export. No git config command or global/local configuration file is changed. No blanket source normalization, working-tree replacement, hash bypass, raw-file rewrite or execution-policy change is needed. All eight previously reviewed executable/input files and their source manifest remain byte-identical. The strict hashes still apply.

## Validation

scripts/check-fr-2-zoho-archive.mjs creates a temporary real Git repository with the actual selected source and attributes, commits previous and corrected attributes, archives both with core.autocrlf true/false, and extracts each archive. Six transport checks pass: four archive outcomes, all eight hashes from the corrected true-mode archive, and executing that archive's actual offline verifier. Its nested verifier returns 27PASS, zero failures, eight hashes and seven JS syntax checks. Temporary fixtures are removed. This is actual local Git/archive/extraction evidence with Windows-style configuration, not actual Windows PowerShell/DPAPI execution. The new transport checker has one additional Node syntax check. No existing application runtime implementation changed.

## Owner recheck

Run the complete corrected PowerShell block pasted in chat using its new source pin and explicit per-command archive option. It exports to a fresh temporary folder, verifies the same eight source files and 27 tests, parses the wrapper with the actual PowerShell parser, then runs the encryption/private-pipe preflight. Generate a short-lived Zoho code only if those checks pass and the hidden code prompt is ready. Keep the corrected plural sender address. Use exactly ZohoMail.accounts.READ,ZohoMail.messages.CREATE. Return only the verifier JSON, safe setup JSON and exit code. If any step fails, stop at its safe summary; do not bypass the hash check or repeatedly generate codes.

The private setup still makes at most three fixed OAuth/account metadata requests, saves any issued refresh configuration only as current-user DPAPI ciphertext, and sends no message. Existing owner Self Client registration is preserved. Mail-send permission, inbox delivery, actual Windows execution, deployed gateway, E4 canonical/global guards and hosted acceptance remain pending. Production is excluded, APK deferred and all 20 full findings remain open.

Primary documentation checked 15 October 2026: https://git-scm.com/docs/gitattributes and https://git-scm.com/docs/git-archive .
