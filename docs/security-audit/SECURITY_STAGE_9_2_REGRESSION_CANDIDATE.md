# Stage 9.2 — Local regression and release-packaging candidate

**9.2 / 12 October 2026 — COMPLETE AT SOURCE CANDIDATE AND OFFLINE REGRESSION SCOPE.**
Source parent: `bf7d1ec1690a43b692d2164204ebbd7d21d051ae`. Final verifier: **882 PASS, 0 FAIL, 0 skipped/cancelled/todo, exit 0 across 92 test files; 17 syntax checks PASS** on Node v24.19.0.

[Finite plan](SECURITY_STAGE_9_REGRESSION_RELEASE_PLAN.md) · [Candidate contract](security-stage-9-regression-candidate-contract.json) · [Execution history and final receipt](security-stage-9-regression-local-checks.json) · [Eight OPEN actions](security-stage-9-remediation-actions.json).

## Final changes and behavior

| Candidate path/scope | Resulting behavior | Verification limit |
|---|---|---|
| package.json and scripts/run-offline-tests.mjs | Explicit sorted discovery runs both MJS and CJS files, including all seven CJS suites previously omitted; bounded child process and minimal inherited environment | Local Node runner, not deployed role/RLS proof |
| scripts/offline-test-network.cjs | Default fetch/HTTP and ordinary HTTPS fail locally; the existing injected native Agent lookup can return its rejection, with any successful address replaced by an offline error | Guarded reviewed Node test paths, not an OS sandbox; synthetic ports can still substitute mocks |
| scripts/build-public-site.mjs and .github/workflows/pages.yml | The workflow uses one exercised allowlist exporter including auth.html, auth-flows.js and auth-security.js alongside existing public assets | Actual exporter executes only in temporary test fixtures; CI workflow/deployment did not run |
| _headers | Report-only signup inline-script hash is regenerated from the current reviewed HTML; other policy directives and enforced restrictions remain unchanged | Source header candidate; current hosting/header/redirect acceptance unverified |
| Twelve existing test files | Harnesses include current MFA tickets, session epochs and logout guards; version references and asset checks reflect current source and exercised exporter | Original race/isolation/no-navigation/private-read checks remain; no application permission bypass |
| tests/stage-9-regression-release.test.mjs | Six meaningful cases exercise actual exporter references, private-file exclusion/source preservation, missing Auth dependency/existing artifact preservation, MJS/CJS discovery, default network denial and CI/package wiring | File fixtures and offline processes, not browser/store acceptance |
| scripts/verify-stage-9-regression.mjs | Enforces exact file catalog/case count and false hosted/native/deployment flags; runs the batch, checks syntax and prints a safe receipt with 21 input hashes | Executed Node suite and syntax only |

There are exactly **20 changed/added non-audit paths**: 15 existing replacements and five additions. The additions are four scripts and one test file. 603 original tracked file paths were available in the isolated clone; all original file bytes outside the intended 20 paths were verified unchanged before documentation updates. No file was deleted.

Application JS, Business JS, service worker, database/SQL/cron, dependency lock, native builder and native projects are unchanged in this milestone. The package change is its test command; dependency versions are unchanged. Product release labels/cache markers are preserved. The existing native builder is exercised by its previous mocked temporary fixtures; no real native dependency bundle or compile ran.

## All execution outcomes retained

| Execution | Test files | Tests | PASS | FAIL | Exit | Recorded meaning |
|---|---:|---:|---:|---:|---:|---|
| Initial explicit batch | 91 | 876 | 861 | 15 | 1 | Older harness/assertion drift, stale report-only hash and one temporary offline-guard interference |
| First candidate | 92 | 882 | 876 | 6 | 1 | Remaining analytics scheduling harness and five older workflow-copy assertions |
| Corrected full suite | 92 | 882 | 882 | 0 | 0 | Corrected source/fixtures and new exporter/discovery checks |
| Final pinned-contract verifier | 92 | 882 | 882 | 0 | 0 | Same final suite plus 17 syntax checks and 21 hashes |

Repeat-inclusive totals are **3,522 case executions: 3,501 PASS and 21 FAIL**. The final suite contains 882 unique local test cases, not 3,522 distinct security controls. Historical failures are not deleted or silently promoted to PASS. Full titles and counts are retained in the JSON history.

The initial 15 failures are distinguished as follows:

- Thirteen older harness/assertion failures: missing MFA assurance/ticket and asynchronous scheduling, older Admin notification loading shape, obsolete cache versions, a blanket ban on Business direct writes that predates current-device push retirement, missing logout state/timers and missing Business startup session epoch. Current-device retirement is now the only allowed direct-write match; Personal/Family/Cashbook read isolation assertions remain.
- One actual stale source assertion: the tracked report-only CSP inline hash did not match the changed signup module. Regeneration changed only that approved hash, without broadening script permissions.
- One temporary executor interference: blanket HTTPS interception stopped the private-DNS Agent test before its injected lookup. The source egress guard was unchanged. The final preload permits this injected lookup to reject, and never passes a successfully resolved address to the connector.

The first candidate's remaining six failures were the analytics harness not waiting for cross-context assurance scheduling and five tests asserting literal workflow cp text after the source exporter moved into a shared module. They now check that CI invokes the actual exporter and that the required assets are in its allowlist; the six new tests exercise actual copied files and their literal page/module dependencies. No production guard was removed to satisfy a fixture.

Non-failing TypeScript experimental and module-type warnings were observed and retained. No warning is counted as a failed test or evidence of browser performance. Owner Windows/Node execution is a separate repeat; it has not been claimed in this assistant receipt.

## Actual local coverage and deliberate limits

All 92 discovered test files ran: **85 MJS and seven CJS**, no test-file omission or test-name filter. The 876 existing cases include actual selected client/controller/worker/stripped Edge functions executed with synthetic ports, source/SQL/config assertions, temporary Git/filesystem recovery fixtures and review-only lifecycle/privacy/commerce models. The six added cases are release-export/runner checks.

Case PASS means its actual local assertion passed. It does not prove complete UI navigation, rendering, physical-device behavior, full app integration, real identity provider/email delivery, installed grants/RLS, database concurrency, scheduler/provider execution, trusted upload/deletion/retention, durable commerce ledger, performance budgets or SDK/store acceptance.

Dedicated PGlite SQL verifiers, Deno dependency/type/bundle checks, real esbuild/native bundles, npm dependency installation and the full CI workflow were not invoked. Their unexecuted status is separate from the zero-skipped test result. The complete 106-path script catalog is not an instruction to execute historical owner/hosted/setup tools.

## Carry-forward and next outcome

RG-R01–RG-R08 remain OPEN. RG-R05 receives partial source contributions for explicit test discovery and source packaging; installed parity and final release evidence remain required. All prior PF/DL/UF/PR/NR/IE/CO/ND actions and original finding definitions are preserved. No finding closure follows from 882 local passes.

The frozen **48 RG01–RG08 real grouped acceptance cases remain unrun**. No hosted, physical-device, store or performance outcome was substituted with a local fixture. Publisher accounts/applicability, accepted deployment/configuration, recoverable actors/data/files, budgets/device matrix, final signed artifacts, privacy/commerce/audience decisions, beta/reviewer arrangements and recovery/rollback still need actual evidence.

No account/fixture/Auth/Storage/SQL setting, provider/SDK/key/cron/Vault, notification/email/charge, production serving state, native build/sync/install/sign/upload or store publication changed. The source workflow/header candidate is only on the audit branch. Production Supabase remains excluded from mutations; retained synthetic actors and the two USD 1 manual conversions are untouched.

**Two of four Stage 9 milestones are complete. Next is 9.3**, one bounded installed/device/store readiness or genuine controlled acceptance outcome. Full report remains due at **9.4**. Missing prerequisites will be recorded once and carried to final remediation/full fresh re-audit.

**Owner handoff: no SQL, installation, checkout, deployment or native build.** The complete chat PowerShell fetches the candidate, exports its full source into a new temporary folder and runs the Node verifier. Test code uses only temporary fixtures and guarded synthetic ports. Send only the printed summary; passwords/tokens/private endpoints/provider data are unnecessary. APK update stays deferred.
