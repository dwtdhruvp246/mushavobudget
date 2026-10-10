# Stage 2 — Browser, public submission and outbound-request hardening

**Current — 2.4, 10 October 2026:** Stage 2 is CLOSED WITH CARRY-FORWARD; all four bounded steps have outcomes. Staging header and selected Contact checks passed; production HTTPS redirect samples failed. The source push guard passed local checks, but hosted push delivery is BLOCKED/UNVERIFIED. F07/F09/F12 remain open. Read the [detailed Stage 2 report](SECURITY_STAGE_2_COMPLETION_REPORT.md) for actions, evidence limits and the final remediation/re-audit gate. Next is 3.1 authorization baseline and bounded role/Admin MFA checks. No production promotion was performed.

Started 9 October 2026 at **2.1**, after the [Stage 1 report](SECURITY_STAGE_1_COMPLETION_REPORT.md). Four finite steps. Each receives a bounded evidence/change pass and explicit outcome; unresolved controls carry to final remediation and full re-audit. Stage 1 checkpoints remain closed with their limits. Broader tenant roles and application Admin MFA belong to Stage 3.

| Step | Purpose and work | Completion evidence |
|---|---|---|
| 2.1 Browser security headers | Verify actual serving responses/configuration; prepare compatible headers and phased CSP; use separate staging before production promotion | Baseline, checked candidate, actual served headers and controlled browser compatibility/deliberate blocking evidence, with missing checks carried explicitly |
| 2.2 Public contact abuse | Review direct submission grants/path, validation, challenge and server quota controls; prepare isolated allowed/denied tests and a justified implementation | Normal enquiry positive control; forged/missing challenge, malformed/oversized and repeated submissions denied without exposing private enquiries |
| 2.3 Web Push egress | Review actual stored endpoint handling and provider compatibility; restrict unsafe destinations/redirects where justified | Private-network/malformed/redirect cases rejected; accepted provider destinations and failure/retry semantics tested in controlled scope |
| 2.4 Stage closure/report | Recheck affected changes and issue detailed results/action report | Prior definitions/evidence preserved; outstanding findings and required final retests retained |

## 2.1 finite work items

1. Baseline and dependency inventory — COMPLETE, scoped live/source evidence.
2. Candidate and local checks — COMPLETE, 15 selected checks; native browser execution unavailable in this environment.
3. Staging handoff and actual served/browser checks — COMPLETE WITH CARRY-FORWARD: staging samples and owner flows scoped PASS; production HTTP redirect samples FAIL; strict CSP and full production acceptance unverified. Correction retained for final remediation.

All three 2.1 items have completed outcomes; none remains in this checkpoint. Do not add an unlimited screenshot/diagnostic cascade. Record unavailable workflows as carry-forward instead of manufacturing a pass. The [2.1 checkpoint and handoff](SECURITY_STAGE_2_1_BROWSER_HEADERS.md) give the concrete next action.

Production Supabase remains kttkospkblwvguuwnhjj; staging remains dczlddwbtgvfdujgcitb at https://mushavo-budget-staging.pages.dev. Keep controlled synthetic accounts/destinations and private credentials separate. No production restore, APK update, paid service or Google backup upload is part of Stage 2. The new security/stage-2-web-hardening branch is based on the Stage 1 audit head; its draft PR is stacked on security/stage-1-foundations pending that PR's review/merge. No merge or provider deployment is performed by preparation.


## 2.2 finite work items

1. **2.2.1 — COMPLETE:** Source review and five-row owner staging metadata received. Effective six-column inserts are available to anon/authenticated; RLS enabled. No runtime abuse-control proof.
2. **2.2.2 — COMPLETE IN LOCAL SCOPE:** Edge validation + server Turnstile, transactional database quotas and direct grant revocation candidate; 32 selected tests, Edge bundle and SQL/PLpgSQL syntax pass. Providers and PostgreSQL runtime were not exercised.
3. **2.2.3 — COMPLETE WITH CARRY-FORWARD:** Staging endpoint/gate/secrets and repaired frontend were owner-deployed. All 18 API checks pass; saved-row and fourth-limit/field-retention receipts have scoped passes. Blank fields, actual concurrency/global quotas/rollback, replay/host binding, staff/dispatch and full production acceptance remain unverified. No repeat successful form batch.

[Contact baseline and owner handoff](SECURITY_STAGE_2_2_PUBLIC_CONTACT.md). Production redirect failure from 2.1 remains in F07; resolving it is not a prerequisite for 2.2. The detailed Stage 2 report is available at 2.4; this paragraph retains the earlier Contact handoff context.

## 2.3 finite work items

1. **2.3.1 — COMPLETE, METADATA SCOPE (S2E35):** Owner production read-only inventory reports RLS enabled/forced, anonymous endpoint INSERT denied, signed-in INSERT allowed and UPDATE denied; zero subscriptions. No provider compatibility or delivery is inferred.
2. **2.3.2 — COMPLETE, SOURCE/LOCAL SCOPE (S2E36):** Shared strict provider URL/DNS guard integrated into three senders; environment proxy disabled and TLS verification retained. Forty-five selected Node checks, local Deno 2.9.6 transport checks and three entrypoint bundles pass. No hosted deployment.
3. **2.3.3 — COMPLETE OUTCOME, BLOCKED/UNVERIFIED (S2E37):** Fresh read-only staging config confirms empty public push key. Real registration/delivery, deployed runtime parity and hosted retry/network behavior carry to final remediation; production sending is not a substitute.

[Web Push review and outcomes](SECURITY_STAGE_2_3_WEB_PUSH.md). Zero work items remain in this checkpoint. F12 is not closed.

## 2.4 report and closure

The [detailed Stage 2 report](SECURITY_STAGE_2_COMPLETION_REPORT.md) and S2E38 record four completed checkpoint steps, no full release/security acceptance and no production promotion. Original Stage 0/1 evidence and all 123 coverage / 20 finding definitions remain intact. Outstanding actions are consolidated in the [carry-forward register](SECURITY_AUDIT_CARRY_FORWARD.md). Next is **3.1**. Resolve remaining failures/uncertainties and production rollout during final remediation, then run the agreed full fresh re-audit.
