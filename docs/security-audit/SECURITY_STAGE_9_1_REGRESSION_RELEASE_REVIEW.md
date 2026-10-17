# Stage 9.1 — Regression and release-evidence source review

**9.1 / 12 October 2026 — COMPLETE AT SOURCE, CATALOG AND PRIMARY REQUIREMENT SCOPE.**
Pinned source: `2ea0a69b1bbe5ffedf7a3fc5c0d2179ff1b1f895`. No behavioral suite, installed API/database case, benchmark, physical-device check or store acceptance ran during this milestone.

[Finite Stage 9 plan](SECURITY_STAGE_9_REGRESSION_RELEASE_PLAN.md) · [Source identities](security-stage-9-regression-source-inventory.json) · [Regression catalog](security-stage-9-regression-catalog.json) · [Real acceptance matrix](security-stage-9-regression-test-matrix.json) · [Decisions](security-stage-9-release-decisions.json) · [OPEN actions](security-stage-9-remediation-actions.json).

## Verified inventory

45 freshly retrieved selected files match exact current Git blob identities: 20 code/config/scripts, 12 selected test files read without execution and 13 audit records. SHA-256 and byte size are recorded for each. One incomplete local write of the carry-forward document was detected and re-exported; final bytes match the pinned Git blob. No repository source defect or unexpected drift was inferred from that temporary export.

Complete Git tree discovery contains **91 test files: 84 MJS and seven CJS**, plus **106 script paths**. Catalog entries identify paths and Git blobs; discovery is not evidence that all assertions were read or executed. The selected tests demonstrate both actual client functions in VM contexts with synthetic ports and source/SQL/config assertions. Selected verifier code records bounded case counts, syntax checks and mock/model limitations; its prior receipts remain historical evidence, not a fresh run.

No tracked Android/iOS project path appears in this audit tree. This does not contradict the owner's existing local Android checkout. No named Lighthouse/Playwright/Cypress/benchmark/performance artifact was found in the pinned tree; this is a repository inventory observation, not proof that no external measurement has ever happened.

## Concrete runner and packaging observations

| Observation | Source evidence | Required follow-up |
|---|---|---|
| Seven CJS test files are outside the default package command | package.json uses `node --experimental-strip-types --test tests/*.test.mjs` | Include the intended CJS files explicitly in the next reviewed local batch and maintain tested/excluded/blocked dispositions |
| CI does not establish complete current audit verification | pages.yml calls npm test plus selected native-dependency, build and disposable PostgreSQL scripts; triggers are main push/PR and manual dispatch | Review exact chosen offline commands and current source coverage; no latest CI run or installed release was verified here |
| Auth callback assets are absent from the GitHub Pages export list | Workflow copies no auth.html, auth-flows.js or auth-security.js; app/business reference auth.html, and auth.html loads auth-flows.js | Reconcile full serving artifact page/module closure and correct justified source packaging gap before relying on that channel |
| Native builder includes the Auth callback assets | build-capacitor.mjs requires auth.html and both Auth helpers, with source/type validation and temporary replacement | Preserve this candidate behavior; actual dependency bundle, compilation, signed artifacts and physical-device behavior are separate requirements |
| Serving paths differ | GitHub workflow exports an explicit _site; wrangler.jsonc serves root assets with .assetsignore exclusions | Verify which serving layer and exact frontend/Edge/schema/config versions are actually installed; source does not attest deployment |
| Local counts cannot certify server enforcement | Reviewed API checker tests use synthetic ports; finance tests include source assertions; session/startup tests execute selected actual functions with mocks | Preserve scope and obtain real role/grant/concurrency/callback cases separately |
| Quality evidence needs a reproducible measurement plan | No chosen device/data/network matrix or accepted performance budgets were verified in this milestone | Agree meaningful cold/warm startup, interaction/error and data-scale measurements; record real device/browser traces without invented PASS thresholds |

The seven omitted CJS files are three Stage 1 metadata/coverage test files and four Stage 3 Personal/Family/currency/Business checker test files. They are local test code, distinct from the hosted owner runners. Running them does not execute the controlled hosted finance acceptance batches by itself; chosen supporting modules and invocation boundaries still need review in 9.2.

The observed Auth export gap is a source packaging mismatch on one workflow. It is not proof that the current Cloudflare staging website lacks the callback page, nor permission to execute a manual deployment.

## Carry-forward reconciliation

| Earlier stage | Retained evidence | Still required |
|---|---|---|
| 0–1 Baseline/operations | Closed checkpoints with decisions and recovery/isolation evidence retained | Final effective isolation, backup/restore, operational ownership and installed evidence |
| 2 Public perimeter/contact/push | Scoped staging passes and local/Deno source candidate results | Historical failed production redirect samples, actual serving parity and hosted push egress acceptance |
| 3 Authorization/Auth | Personal 26 PASS with workspace-binding REVIEW, Family 33 PASS and currency 23 PASS; scoped local source checks | Personal binding repair/relink/exact deletion, automatic rates/scheduler/history, Business roles, Admin MFA/recovery and Auth hosted settings/callbacks |
| 4 Lifecycle/files/privacy | Local source/model/client/draft results retained; 18 actions OPEN | 80 grouped hosted cases unrun; real deletion/retention/processing/access/cleanup and factual published controls |
| 5 Native | Source and mocked packaging checks retained; seven native actions OPEN | Complete merged/signed Android/iOS artifacts, real toolchain/device storage/backup/returns and SDK privacy evidence |
| 6 Identity/email | Same final 46 local cases passed for assistant and owner; initial harness failure remains in history | 36 genuine cases unrun; actual renderer/escaping/provider linking, callback and delivery acceptance |
| 7 Commerce | Same final 30 local cases passed for assistant and owner; pure model remains separate from product integration | 48 real cases unrun; actual catalog/channel/purchases/verification/ledger/concurrency/restore/refund acceptance |
| 8 Notifications/device | Same final 70 local cases passed for assistant and owner; 60 identities/21 hashes reconciled in closure | 48 real cases unrun; native transport, installed parity, device privacy/cleanup, actual queue/scheduler/egress and recovery |

These counters overlap and represent grouped acceptance plans, repeats or historical scopes. They must not be summed into global unique controls or an overall security pass rate. Stage 9 coordinating actions preserve all original 123 coverage rows and 20 finding definitions; they do not replace prior actions.

## Current primary store requirements reviewed

Four primary pages were substantively reviewed on 12 October 2026. Recheck the applicable rules against the actual account, final artifacts, supported territories and submission date before release.

- [Google personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en): personal accounts created after 13 November 2023 need at least 12 testers continuously opted into a closed test for 14 days before applying for production access. Meeting the testing minimum is not automatic production approval. Current owner account type/date and console applicability are unverified.
- [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): final on-device stability, working URLs/backend, review access and truthful metadata are required. An authenticated app needs usable review access; beta distribution belongs in TestFlight. No review account, submission or approval was established.
- [Google Data safety](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en): declared data must include actual third-party libraries/SDKs. Closed/open/production tracks need the form; an exclusively internal track is exempt. Final installed data flows and Stage 4 privacy blockers remain unresolved.
- [Apple TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/): beta evidence belongs to an uploaded exact build and actual feedback; the first external-group build goes to App Review and later builds may not need a full review. No upload, external invitation or test execution occurred.

Earlier owner reports of absent store accounts/Mac prerequisites are historical and do not independently prove the current state. Operator identity/privacy contact/no-age-restriction intent are retained as owner-reported facts. Intended no age restriction does not settle target-audience, child handling, store ratings, consent or territory obligations. No policy, disclosure, pricing or launch scope was adopted.

## Action plan and remaining decisions

RG-R01–RG-R08 coordinate finance, Auth/privilege, data/files/privacy, measured quality/PWA, explicit regression/deployment, native artifacts, store/external review and final evidence. **All eight remain OPEN.** Each structured entry links original findings, an owner, prerequisites and a meaningful recheck. RG-D01–RG-D08 remain UNCONFIRMED: accepted deployment/channel, recoverable actors/data, budgets, device matrix, publisher/signing, audience/territory/privacy/commerce, beta/reviewer arrangements and release/rollback/re-audit responsibilities.

48 planned real grouped cases are frozen across RG01–RG08, six each. All are PENDING / NOT RUN; no PASS, FAIL or actual store/device acceptance is assigned. These supplement traceability to earlier direct requirements rather than replacing them.

## Scope and next handoff

This milestone changed documentation only. No local behavioral or syntax suite, hosted request, performance trace, SQL, real email/notification/charge, device permission, account/fixture/settings/provider change, native build/sync/install/sign/upload or store publication occurred. Production remains outside mutations; the retained staging actors and two USD 1 manual conversions remain untouched.

**No owner SQL/terminal/setup/rerun action is required. APK update remains deferred.** Next is **9.2**, a bounded reviewable local regression/packaging candidate and actual offline execution with explicit file selection and retained failures. Full Stage 9 report remains due at **9.4**, then Stage 10/final remediation and a full fresh re-audit. No original finding is closed by this inventory.
