# Stage 9 completion report — regression and release evidence

**9.4 / 13 October 2026 — all four bounded milestones complete with carry-forward.**
Source reconciliation pin: `bbb4086376c0885da95374ad753875cd1e26a389`; corrected executable candidate: `fe0fb66bdc502d135e31495b81a0641aab5e8fd3`.
Stage status: `CLOSED_REGRESSION_RELEASE_CHECKPOINT_WITH_CARRY_FORWARD`. Evidence: **S9E06**.
[Final reconciliation receipt](security-stage-9-final-recheck.json) · [Stage 9 evidence](security-stage-9-evidence.json) · [OPEN action definitions](security-stage-9-remediation-actions.json).

## Recorded outcome and its limits

Stage 9 has delivered its source inventory, an actual offline regression and public-site export candidate, a corrected Windows repeat, a bounded readiness outcome and this report. The final selected local suite contains **882 unique cases in 92 files** (85 MJS and seven CJS). Both the corrected assistant suite and the owner's Windows Node v22.17.0 repeat recorded **882 PASS, zero FAIL, exit 0**, with **21 syntax checks**. No cases were skipped, cancelled or marked todo in the final repeat.

Those results establish the stated offline scope: selected actual client functions, synthetic ports, source assertions and temporary exporter/builder fixtures. They do not establish installed PostgreSQL permissions, Auth configuration, provider delivery, physical-device behavior, store compliance or release readiness. All **48 grouped hosted/device/store acceptance requirements remain BLOCKED_NOT_RUN**, with zero full-case executions. There are **eight OPEN coordinating actions**, **eight UNCONFIRMED release decisions**, six blocked prerequisite groups and no finding closures.

The dated 9.3 public observation is also retained as an explicit negative result: the selected staging `auth-flows.js` URL returned HTML with `Content-Type: text/html`. It cannot satisfy the candidate JavaScript-module prerequisite. This is a FAIL at that selected public asset-type scope, separately recorded from the unexecuted full acceptance matrix. “Hosted acceptance blocked” means that the evidence prerequisites for accepting the installed system have not been met; it does not mean that an automated approval mechanism stopped these offline tests.

The release gate remains `OPEN_PENDING_REQUIRED_EVIDENCE`; the final fresh re-audit remains `PLANNED_NOT_PERFORMED`. **APK update remains deferred.** Stage completion records bounded work and carries unresolved items into final remediation.

## Four milestone outcomes

| Step | Recorded scope and outcome | Evidence |
|---|---|---|
| 9.1 | Source catalog and primary requirement review complete: 45 selected inputs reconciled; 91 tests / 106 scripts cataloged; eight decisions, eight actions and 48 grouped cases defined | [Source review](SECURITY_STAGE_9_1_REGRESSION_RELEASE_REVIEW.md), immutable inventory/catalog/matrix |
| 9.2 | Actual offline candidate and corrected owner repeat complete: 882 final PASS; original assistant failures and Windows 875 PASS / seven FAIL preserved | [Candidate](SECURITY_STAGE_9_2_REGRESSION_CANDIDATE.md), [Windows correction](SECURITY_STAGE_9_2_WINDOWS_CORRECTION.md), [passed owner receipt](security-stage-9-regression-owner-recheck.json) |
| 9.3 | Bounded readiness complete with blocked acceptance: 12 public static GETs, selected asset-type FAIL, six blocked prerequisites and 48 unrun full cases | [Checkpoint](SECURITY_STAGE_9_3_READINESS_CHECKPOINT.md), [immutable readiness receipt](security-stage-9-regression-readiness.json) |
| 9.4 | Final source/receipt reconciliation and report complete; no new behavioral, syntax, hosted or device execution | [Final receipt](security-stage-9-final-recheck.json); this report |

The original 123 coverage rows, 20 finding definitions, all prior Stage 0–8 progress objects and completed 9.1–9.3 objects retain their definitions and recorded scope. Stage 9 does not replace earlier hosted positives or convert unresolved carry-forward into PASS.

## Execution history: failures remain visible

| Execution | Cases | PASS | FAIL | Exit / scope |
|---|---:|---:|---:|---|
| Assistant initial discovery | 876 | 861 | 15 | 1; initial 91-file run |
| Assistant first 92-file candidate | 882 | 876 | 6 | 1 |
| Assistant corrected original suite | 882 | 882 | 0 | 0 |
| Assistant original verifier | 882 | 882 | 0 | 0; 17 syntax checks |
| Owner original Windows repeat | 882 | 875 | 7 | 1; Node v22.17.0, 17 syntax checks |
| Assistant Windows-correction suite | 882 | 882 | 0 | 0; Linux Node v24.19.0 |
| Assistant corrected verifier | 882 | 882 | 0 | 0; 21 syntax checks |
| Assistant CRLF / special-path simulation | 882 | 882 | 0 | 0; Linux simulation, 21 syntax checks |
| Owner corrected Windows repeat | 882 | 882 | 0 | 0; Node v22.17.0, 21 syntax checks |
| Historical execution total | **7,932** | **7,904** | **28** | Repeated executions of at most 882 unique final cases |

The initial 15 failures included 13 stale harness/source assertions, an outdated header hash and temporary network-guard interference with a private-DNS fixture. The next six involved cross-context async scheduling and old literal workflow-copy assertions. Their corrections retain the underlying security, financial and race assertions and add actual exporter checks.

The original owner repeat had seven failures: native executable redirection, exact reviewed header comparison, redirected public asset, output-parent alias and three staging builder cases. The 21 initial owner hashes reconciled as three exact published bytes and 18 exact CRLF variants, without an unexpected mismatch. Source and failure titles justified Windows path/newline/link-fixture corrections; no missing raw Windows exception was invented as observed evidence.

The correction used `fileURLToPath` for Windows-safe filesystem paths; normalized only CR/CRLF for exact header comparison; used real Windows directory junctions for redirected-parent fixtures; and strengthened canonical executable-path checking before launching the native database tool. LF rules were added for selected script/header paths without global renormalization. The Linux simulation converted 178 selected script/header files and used a folder containing spaces, percent and hash characters; it was not represented as a Windows test.

The corrected owner repeat reconciled all 26 candidate hashes: **25 exact published bytes and one exact CRLF variant, `.gitattributes`**. Actual Windows junction fixture cases reported PASS within the offline fixture scope. Non-failing TypeScript experimental and module-type warnings remain recorded. The [initial FAILED owner receipt](security-stage-9-regression-owner-local-checks.json), original assistant receipt and correction receipt remain immutable alongside the passed repeat.

## Source change boundary and meaningful coverage

The complete Stage 9 non-audit diff, from `2ea0a69b1bbe5ffedf7a3fc5c0d2179ff1b1f895` to the reconciliation pin, has **25 paths: 20 existing replacements and five additions; zero deletions**. The initial candidate contributed 20 paths; the subsequent Windows correction contributed five additional existing paths.

The explicit runner discovers sorted ordinary MJS/CJS test files, includes the formerly omitted seven CJS suites, applies a 180-second child deadline and a 32 MB capture limit, and passes an allowlisted system environment. Its Node network guard rejects ordinary fetch/HTTP/HTTPS transport; the injected native DNS fixture can perform its controlled lookup but cannot successfully continue to a resolved address. This guard is test-process instrumentation, not an operating-system sandbox.

The public-site builder exports an allowlist, adds the Auth page and helpers, checks ordinary source files before creating a new output, rejects existing output/redirected paths and preserves the source. CI now calls the same builder. Six new release-runner cases cover actual temporary export and references, private-file exclusion, source preservation, missing Auth dependencies/existing output rejection, explicit test discovery, network denial and package/workflow wiring. Full CI and installed deployment were not run.

The changed source paths are:

- `.gitattributes`
- `.github/workflows/pages.yml`
- `_headers`
- `package.json`
- `scripts/build-public-site.mjs`
- `scripts/offline-test-network.cjs`
- `scripts/run-offline-tests.mjs`
- `scripts/security-stage-1-database-properties-toc.cjs`
- `scripts/verify-stage-9-regression.mjs`
- `tests/admin-analytics.test.mjs`
- `tests/admin-event-notifications.test.mjs`
- `tests/admin-plans-workbench.test.mjs`
- `tests/business-stage-1.test.mjs`
- `tests/business-stage-3.test.mjs`
- `tests/cashbook-private-test.test.mjs`
- `tests/push-notifications.test.mjs`
- `tests/pwa-install.test.mjs`
- `tests/pwa-stage-13-hardening.test.mjs`
- `tests/pwa-update.test.mjs`
- `tests/security-stage-1-database-properties-toc.test.cjs`
- `tests/security-stage-2-headers.test.mjs`
- `tests/stage-3-auth-edge-build.test.mjs`
- `tests/stage-3-auth-flows.test.mjs`
- `tests/stage-9-regression-release.test.mjs`
- `tests/workspace-startup.test.mjs`

Application finance code, Business finance code, service worker, SQL, cron, dependency lock, native builder and native projects had no Stage 9 source diff. Existing Capacitor fixtures execute the builder with mocked esbuild/Capacitor modules in temporary directories; no real dependency bundle, native compile, signing or installation is established.

## Final reconciliation at 9.4

The fresh current tree reconciles **215 distinct selected Git identities**, including **202 current catalog targets** (92 test files and 110 script paths). The original 197 catalog entries account for 181 preserved identities and 16 intentional replacements; five additions produce the current 202. The fresh 26 selected candidate byte/SHA checks match current Git blobs and the accepted exact/CRLF owner classifications. Ten immutable Stage 9 structured records, now including the readiness receipt, match their retained bytes and Git identities.

The [final receipt](security-stage-9-final-recheck.json) records each identity, byte check, immutable record and all 25 non-audit changed paths. There is zero unexpected selected source drift. These are source/metadata reconciliation checks, not 215 behavioral tests or a fresh re-audit. Closure adds documentation only and does not rewrite the executable candidate, original matrix, decisions, prior receipts or action definitions.

## Dated public staging observations

At 9.3 on 13 October 2026, 12 read-only public static GETs sampled staging config, pages and scripts. No redirects were automatically followed; canonical pages were separately requested. There was no Auth session, cookie/token, authenticated API, SQL, provider call, notification, device or performance test. Response bodies and public keys were not printed or stored in the audit.

The sampled `config.js` contained the expected staging reference `dczlddwbtgvfdujgcitb` and no production reference. This scoped positive does not establish project-key ownership or installed backend settings. Selected canonical pages and application scripts differed from current source after newline/project-reference-overlay comparison, leaving installed parity unestablished. The deployed commit or serving transform was not identified.

The Auth/MFA asset samples shared a 9,850-byte response SHA. The follow-up for `auth-flows.js` confirmed HTML content and content type despite HTTP 200. The report retains RG-OBS01 (config-scope positive), RG-OBS02 (parity REVIEW) and RG-OBS03 (asset-type FAIL). It does not infer a global app malfunction or mark a full RG05 case executed. There was no repeat public probe in 9.4; this remains a dated 9.3 observation requiring remediation and later genuine recheck.

## Six blocked prerequisite groups and the frozen matrix

- **RG-P01 — Installed frontend/Edge/schema/grant/Auth parity: BLOCKED.** Selected public frontend samples differ from the current source under raw/newline/project-overlay comparisons; auth-flows.js returns HTML. Exact installed Edge, schema, grants and Auth settings remain unverified.
- **RG-P02 — Completed direct security/data/native/commerce implementations: BLOCKED.** Prior Personal binding/relink/automatic-rate/history work, trusted file/deletion/retention adapters, installed native push and provider/commerce verification remain unresolved in the accepted records. Local models and mocks do not provide these implementations.
- **RG-P03 — Recoverable controlled actors, datasets and safe operational scope: BLOCKED.** Retained synthetic actors/two USD 1 conversions and earlier scoped API passes are preserved; they do not establish the full current actor/MFA/recovery, file/deletion, inbox and provider/sandbox matrix needed by the 48 cases.
- **RG-P04 — Accepted measurement/device matrix and final artifact evidence: BLOCKED.** Budgets, representative datasets/networks, browser/accessibility and physical Android/iOS matrix remain unconfirmed; no final merged/signed artifacts, SDK/privacy archive or actual device/performance results are accepted here.
- **RG-P05 — Publisher/account, audience/privacy/catalog and beta/reviewer decisions: BLOCKED.** Current developer account type/verification/signing custody and accepted audience/territory/data declarations/commerce/beta/reviewer arrangements are unavailable as verified requirements. Earlier owner facts are retained; no current account absence is inferred.
- **RG-P06 — Operational recovery/rollback and final coverage/release evidence: BLOCKED.** Installed schedule/queue/egress/support/alert/recovery and rollback evidence remains incomplete; the final full re-audit has not started. Prior 123 coverage rows/20 findings are preserved but not globally cleared.

| Group | Acceptance area | Full cases | Current result |
|---|---|---:|---|
| RG01 | Finance and workspace correctness | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG02 | Auth and privilege boundaries | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG03 | Files, deletion and privacy | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG04 | Usability, performance and PWA | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG05 | Installed deployment and operations | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG06 | Native artifact and device evidence | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG07 | Store and external testing | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |
| RG08 | Final evidence and release control | 6 | BLOCKED_NOT_RUN / NOT_EXECUTED |

These 48 cases overlap earlier controls and are not additive unique global coverage. Their exact IDs, expected behavior and prerequisite mappings are preserved in the immutable readiness receipt. Zero full-case PASS and zero full-case FAIL reflect non-execution; the separately observed public prerequisite FAIL remains explicit.

## Final remediation action plan

All original coordinating action definitions stay OPEN. The offline runner/exporter is a partial source contribution to RG-R05; it does not close that action or any finding.

| Action | Owner | Findings | Remaining acceptance |
|---|---|---|---|
| RG-R01 — Correctness across finance/workspaces | Both | F15, F10 | Resolve Personal binding REVIEW and demonstrate relink/deletion, Business roles and automatic currency/history integrity on accepted isolated deployment. |
| RG-R02 — Auth and effective privileges | Both | F08, F14, F15 | Complete deployed Auth, recovery/linking, Admin AAL2/recovery and direct caller/grant acceptance. |
| RG-R03 — Data, files and factual privacy | Both | F01, F02, F13, F20 | Implement/verify trusted content limits, authorized objects, durable deletion, retention and final actual collection/disclosures. |
| RG-R04 — Measured quality and PWA behavior | Both | F07, F10, F14, F17 | Choose representative devices/data/networks and budgets; measure startup/errors and verify responsive/accessibility/update/offline flows. |
| RG-R05 — Repeatable regression and deployment parity | Both | F05, F07, F09, F15, F19 | Include seven CJS suites explicitly, reconcile dedicated verifiers and CI/serving artifact asset closure; verify exact installed source/configuration. |
| RG-R06 — Final native artifact security | Both | F05, F11, F14, F17, F20 | Preserve identity/signing; prove complete signed artifacts, Auth returns, backup/session behavior, SDK/privacy reasons and native push lifecycle. |
| RG-R07 — Store accounts, declarations and external review | Owner/Both | F05, F17, F20, F02 | Verify publisher account applicability, final truthful listings/data declarations/reviewer resources and required beta/closed-test outcomes. |
| RG-R08 — Traceable final evidence and release decision | Both | F05, F15, F19, F20 | Reconcile all original findings/coverage and actions; demonstrate recovery/rollback, retain failures and complete fresh full re-audit before release. |

Required rechecks remain the original action-specific lists in [the action index](security-stage-9-remediation-actions.json). Work must first establish exact accepted staging deployment/configuration and recoverable controlled actors, then complete implementation gaps, direct caller checks, durable cleanup/recovery and measured browser/device behavior. Publisher and store evidence must correspond to the final actual artifact and account. Final release reconciliation must trace all original coverage/findings and preserve failures before a fresh full re-audit.

Owner-reported identity/contact facts remain Dhruv Parekh, Zimbabwe, individual operator not yet a registered business, with the previously confirmed privacy contact. No age restriction is the owner's stated intent; child/audience controls and legal/store acceptance are unresolved. Territory is unconfirmed. Older reports about absent publisher accounts or Mac hardware are historical, not newly verified current absence.

## Eight unconfirmed decisions

- **RG-D01: Exact accepted source/deployment and release serving channel.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D02: Recoverable isolated actors, finance/file datasets and cleanup boundary.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D03: Performance budgets, representative data sizes and network conditions.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D04: Browser/PWA/Android/iOS versions, physical devices and accessibility coverage.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D05: Current developer account type/verification, publisher identity and signing custody.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D06: Audience, territories, privacy/retention declarations and supported commerce catalog.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D07: Controlled beta/reviewer access, feedback contact and external testing schedule.** UNCONFIRMED; owner Both; no accepted value inferred.
- **RG-D08: Release/rollback approval, incident ownership and final full re-audit evidence.** UNCONFIRMED; owner Both; no accepted value inferred.

The four primary store/testing references reviewed at 9.1 remain dated requirement context. Google personal-account closed-testing applicability is account-specific; TestFlight and store review depend on actual final builds and console evidence; privacy/data declarations must reflect actual behavior and SDKs. Those references do not grant store acceptance and must be rechecked for the actual account and submission date. No accounts, beta groups, invitations, uploads, charges or submissions were created.

## Stage 10 handoff

**Next: 10.1 — release and operations evidence inventory with a finite Stage 10 plan.** The next bounded milestone should inventory accepted source/version/channel mapping; current staging and eventual production deployment evidence; queue/cron/egress and support/alert evidence; backup/recovery/rollback and incident ownership; publisher/reviewer resources; and outstanding dependencies from all prior stages. It should define a finite plan and distinguish source review, owner decisions, controlled installed checks and final release acceptance.

This handoff does not execute 10.1, deploy the candidate, repair staging, adopt a privacy policy, activate SDKs/providers or authorize publishing. Production project `kttkospkblwvguuwnhjj` remains excluded from mutation. Retained synthetic actors and the two intended USD 1 manual conversions remain unchanged. No account, fixture, Auth, Storage, SQL setting or native artifact was changed for closure.

**No owner SQL, terminal, setup, file-opening or rerun action is required for 9.4.** All necessary executable handoffs, when later warranted, must be supplied in chat in full. Final remediation and a fresh full re-audit remain required before an evidence-backed release decision.
