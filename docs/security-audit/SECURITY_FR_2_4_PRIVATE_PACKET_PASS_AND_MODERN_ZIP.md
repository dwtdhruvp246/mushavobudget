# FR.2.4.E5.4 passed; E5.5 replacement ZIP preparation

20 October 2026, FRE92. Parent: `ab612daeea8e946aacc9341b9b69244d65bab328`.

[Owner Windows receipts](security-fr-2-email-modern-owner-Windows-pass.json) confirm 141/141 checks, 91 source hashes, 23 syntax checks and both expected bundle identities under Node v22.17.0. The private preparation separately confirms Windows DPAPI/private-pipe preflight, retained ZIP identity, private Zoho decryption, matching public key, modern key formats, actual16-variable gateway construction, two independent random peppers, two controlled recipients, new encrypted-packet save and exact readback. The old Zoho file stayed unchanged. No private path, addresses or credentials are stored in this receipt.

The earlier attempt failed with a generic local input rejection and saved no packet. Its exact rejected input is not established. The successful receipt is the current preparation evidence; it does not prove Supabase key ownership/validity, provider mail delivery, hosted enforcement or Admin authorization. No Cloudflare or SQL writes or email occurred.

## Separate replacement package

The new builder keeps the historical old package and all old manifests unchanged. It verifies the exact owner ZIP SHA256 `33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1`, reads its bounded canonical STORE archive without extracting or executing config, and validates its staging-only configuration.

It then checks60 pinned source identities and the original package tool lock, compiles the reviewed modern Worker, and uses the actual static exporter/CSP header generator. Exactly44 public entries are allowed. All43 entries other than `_worker.js`, including `config.js`, routes, headers and public assets, must be byte-identical to the retained old ZIP. Only the Worker changes from `fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99` to `a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651`. The unchanged limiter is not redeployed.

Output is a new ordinary temporary directory with a public folder, a separate ZIP and safe sidecar receipts. SQL, tools, private files and audit receipts are excluded from the ZIP. The new bundle needs the later coordinated secrets/backend rollout; do not upload it yet.

[Local checks](security-fr-2-email-modern-package-local-checks.json): 17/17 pass,60 source hashes and15 syntax checks. Tests exercise the actual compiled modern Worker, original static exporter, full44-entry portable ZIP with independent local Python readback, exact historical gateway reconstruction/source hash and old bundle identity, positive43-unchanged comparison, unrelated-change rejection, bad archive/config handling, existing-output preservation and safe failure receipts. The historical adapter exists only in a temporary test fixture and never replaces current source. Actual owner archive and Windows .NET execution remain owner-pending; the earlier141 runtime checks were not rerun.

## Owner command

Export this pinned commit into a fresh temporary folder with LF line endings, install only the existing pinned worker-tools fixture, then run `scripts/verify-fr-2-email-modern-package.mjs`. Parse `scripts/package-fr-2-email-modern.ps1` before execution and invoke it with the exported source/tools folders. The wrapper reuses the established PS5.1 JSON-array handling and independently verifies all44 ZIP entries with .NET, then rechecks the full ZIP digest and saves a safe readback receipt.

No keys, API tokens or account emails are requested; the saved private packet and old Zoho file are not opened. The old public ZIP is the only owner input. Return the safe verifier/preparation/readback JSON and exit codes. If it fails, return the receipt before retrying; only a new candidate may remain. Keep both ZIPs unuploaded and preserve the encrypted packet locally.

Next checkpoints still include concrete staging secret installation and readback, replacement deployment identity, backend/Edge/SQL coordination, actual provider Auth/email and browser/device/recovery acceptance. No hosted rollout or SQL activation is approved by this preparation step. All findings remain open; release gate `OPEN_PENDING_REQUIRED_EVIDENCE`, re-audit `PLANNED_NOT_PERFORMED`. Production and native builds unchanged; APK update deferred.
