# Stage 2 — Browser, public submission and outbound-request hardening

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
3. Staging handoff and actual served/browser checks — PREPARED, owner upload/results pending. Resource CSP enforcement and production acceptance remain unverified.

Two of three 2.1 items have completed outcomes; one remains. Do not add an unlimited screenshot/diagnostic cascade. Record unavailable workflows as carry-forward instead of manufacturing a pass. The [2.1 checkpoint and handoff](SECURITY_STAGE_2_1_BROWSER_HEADERS.md) give the concrete next action.

Production Supabase remains kttkospkblwvguuwnhjj; staging remains dczlddwbtgvfdujgcitb at https://mushavo-budget-staging.pages.dev. Keep controlled synthetic accounts/destinations and private credentials separate. No production restore, APK update, paid service or Google backup upload is part of Stage 2. The new security/stage-2-web-hardening branch is based on the Stage 1 audit head; its draft PR is stacked on security/stage-1-foundations pending that PR's review/merge. No merge or provider deployment is performed by preparation.
