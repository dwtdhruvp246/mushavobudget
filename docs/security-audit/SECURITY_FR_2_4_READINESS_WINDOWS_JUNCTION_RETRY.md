# FR.2.4.E5.6: Windows junction fixture correction

20 October 2026, FRE95. Parent `3e465bf082ad5cd269e7112c35e224948c81af19`.

[Owner receipt](security-fr-2-email-private-readiness-owner-Windows-review.json) confirms25 source hashes and20 syntax checks passed under Node v22.17.0. Of44 tests,43 passed and1 failed: “Redirected artifact roots are rejected before any credential transport”. The verifier stopped before private execution. No owner archive, DPAPI packet, Cloudflare/Supabase request, credential prompt, mail or hosted write occurred. Earlier encrypted-packet and44-entry modern ZIP passes remain valid.

The included historical regression creates a directory symbolic link with `fs.symlinkSync(..., 'dir')`. That fixture can require Windows symlink privileges. The owner receipt identifies the case but does not include a native error code; the exact failing operation is not independently established.

[Local reproduction](security-fr-2-email-readiness-junction-reproduction.json) denies dir-style link creation with a synthetic EPERM and reproduces the same43-pass/1-fail case. A corrected fixture explicitly chooses `junction` on Windows and `dir` elsewhere, checks that a real redirect exists and resolves to the intended temporary fixture, then requires the original artifact inspector to reject it. Cleanup occurs in finally. This preserves the redirect-rejection assertion rather than skipping the case or changing production path checks.

A new portable regression copy retains all18 historical cases; the original checker and original six-source manifest stay unchanged at their historical pin. The current verifier uses this portable copy, retains the26 new readiness cases, emits the selected fixture type, and reports native Windows junction execution only when a successful run actually occurs on Windows.

[Corrected local checks](security-fr-2-email-private-readiness-junction-local-checks.json):44/44 pass,26 source hashes and21 syntax checks. An additional temporary selected-junction branch run passes all18 inspector cases under the same injected dir-link denial. That branch rehearsal occurred on the local non-Windows platform, so actual Windows junction behavior remains owner-pending. Temporary rehearsal files were removed.

Only the verifier, current readiness source manifest and new portable test copy are involved in the correction. Production artifact/path guards, readiness handler, private PowerShell wrapper, accepted ZIP, private packet, all Worker/runtime/SQL and prior evidence remain unchanged.

## Owner retry

Export this corrected pinned commit with LF line endings to a fresh temporary folder. Run `scripts/verify-fr-2-email-private-readiness.mjs` (built-in Node; no npm install). If it passes, parse and invoke the unchanged `scripts/run-fr-2-email-private-readiness.ps1` with the accepted candidate directory and saved encrypted packet.

The private runner then requests the same Cloudflare Account ID and API token in hidden prompts and performs the previously reviewed maximum7 read-only GETs:4 Cloudflare metadata checks and3 fixed staging Auth-settings checks including the invalid-key rejection control. No Supabase keys or recipient addresses need re-entering. No sign-in, rows, application routines, mail, secret installation, upload or SQL activation occurs.

Return safe JSON and exit codes. If the offline check still fails, include its failed title and selected fixture type; no elevation or Developer Mode change is requested. Keep the modern ZIP unuploaded and the encrypted packet private. All findings remain open; release gate `OPEN_PENDING_REQUIRED_EVIDENCE`, re-audit `PLANNED_NOT_PERFORMED`; production/native unchanged and APK update deferred.
