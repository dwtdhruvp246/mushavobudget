# Stage 2 — Browser, public submission and outbound-request hardening

**Current — 2.3.1, 10 October 2026:** Two of four stage steps are complete. 2.1 closed with scoped staging passes, failed production HTTP redirects and unverified strict CSP (F07 open). 2.2 closed with 18 owner API checks PASS plus three saved enquiries and fourth-attempt quota/field-retention evidence; unavailable contact checks carry to final re-audit (F09 open). The next step is the read-only Web Push inventory (F12). No production promotion is performed. The detailed Stage 2 report is due at 2.4.

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

[Contact baseline and owner handoff](SECURITY_STAGE_2_2_PUBLIC_CONTACT.md). Production redirect failure from 2.1 remains in F07; resolving it is not a prerequisite for 2.2. The detailed Stage 2 report is still due at 2.4.

## 2.3 finite work items

1. **2.3.1 — ACTIVE:** Review the three senders and obtain one production read-only aggregate subscription/permission inventory. No notifications or writes.
2. **2.3.2 — PENDING:** Prepare justified destination restrictions and local positive/negative/transport/failure checks. Preserve reviewed provider compatibility and distinguish source/library guarantees from hosted behavior.
3. **2.3.3 — PENDING:** One bounded isolated acceptance batch if a safe device/provider setup is available; otherwise record UNVERIFIED and carry it forward.

[Web Push source and owner handoff](SECURITY_STAGE_2_3_WEB_PUSH.md). Two stage steps remain: 2.3 and the 2.4 closure/report. [Contact checkpoint report](SECURITY_STAGE_2_2_CHECKPOINT_REPORT.md).
