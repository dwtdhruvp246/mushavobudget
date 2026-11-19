# FR.2.4.E5.5: portable package test correction and Windows retry

20 October 2026, FRE93. Parent `c56b925dbd8fa66cb853db8b23e7a547b87957e1`.

[Owner receipt](security-fr-2-email-modern-package-owner-Windows-review.json):60 source hashes and15 syntax checks passed under Node v22.17.0;17 tests ran,16 passed and1 failed. ZIP preparation did not start. Neither the old owner ZIP nor private DPAPI packet was opened, and no provider/deployment/SQL action occurred. The earlier141-check and encrypted-packet successes remain valid.

The previous receipt did not print the failing title, so the owner's exact failed case or cause is not established. Inspection found an optional Python invocation that asserted success whenever a `python` process could start. A present but unusable interpreter command could therefore fail a suite whose documented prerequisites were pinned Node/esbuild tools.

[Bounded local reproduction](security-fr-2-email-modern-package-python-reproduction.json): a temporary `python` command that exits49 reproduced17 tests,16 passes and1 failure in the actual Worker/static-export/ZIP case. This establishes a test portability defect and a matching failure class, not independent proof of the owner's Python state.

The portable test suite now uses its existing pinned Node/esbuild tools. All17 cases remain, including the actual modern/historical compiled Worker hashes,44 ZIP entries and CRC/directory validation,43 unchanged-file comparison, CSP/routes/staging constraints and negative boundaries. The independent44-entry Windows .NET ZIP readback is unchanged and remains mandatory in the owner wrapper. Independent Python readback previously performed locally remains historical evidence; Python is no longer requested or invoked by this portable suite.

The verifier now returns only bounded failed static test titles, allowlisted phase/process metadata and a fixed error code. It does not print raw stderr, stack traces, configuration or credentials.

[Corrected local receipt](security-fr-2-email-modern-package-portable-local-checks.json):17/17 pass,60 source hashes and15 syntax checks. A second run with the same deliberately unusable `python` command also passed17/17. Actual Windows retry is pending. Only the test, verifier and current package source manifest change; package builder, public source, Worker/limiter bundles, Windows wrapper, SQL, private-packet source and previous manifests/receipts remain unchanged. Historical package checks must use their own original commit.

## Owner retry

Export the corrected pinned commit into a fresh temporary directory with LF line endings. Install only the pinned worker-tools fixture and run `scripts/verify-fr-2-email-modern-package.mjs`. If it passes, parse and run the unchanged `scripts/package-fr-2-email-modern.ps1` with exported source/tools folders. This builds a new candidate from the old public ZIP and independently checks its44 entries under .NET. The old ZIP and all private files are preserved. No keys, email addresses or API tokens are requested.

Return all safe JSON and exit codes, including any failed title and package phase if verification fails. No upload, secret installation, email or SQL activation is requested. Both ZIPs remain unuploaded until a concrete coordinated rollout handoff. All findings stay open; release gate `OPEN_PENDING_REQUIRED_EVIDENCE`, re-audit `PLANNED_NOT_PERFORMED`; production/native unchanged and APK update deferred.
