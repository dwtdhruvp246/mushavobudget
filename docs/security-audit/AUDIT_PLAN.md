# Mushavo Budget security audit plan

Updated 10 October 2026. This roadmap consolidates the stage assignments already recorded in the [baseline](SECURITY_STAGE_0_BASELINE.md), [123-section coverage register](SECURITY_AUDIT_REGISTER.md), stage plans and completion reports. It does not add new tests or claim that later stages have been performed.

## Current position

Stages **0, 1 and 2** have closed audit checkpoints, with their failed, blocked and unverified items retained. Stage 3 has completed **3.1**, the permission map and read-only staging baseline. **3.2.1** Personal/Family source review and the first controlled Personal API batch are prepared; owner result pending. A focused local paid-record workspace gap is recorded under F15. Broader authorization/MFA/Auth behavior remains pending. The [progress record](SECURITY_AUDIT_PROGRESS.json) tracks the current stage and completed checkpoint steps.

Completion of a stage means its planned work has recorded outcomes and a report. It does not mean every security control passed or that its findings are closed.

## Stage roadmap

| Stage | Purpose and assigned work | Position and document |
|---|---|---|
| 0 — Baseline | Inventory source, hosting, database, native prerequisites and all 123 audit sections; identify findings and perform justified narrow repairs | Closed with carry-forward. [Baseline](SECURITY_STAGE_0_BASELINE.md), [completion report](SECURITY_STAGE_0_COMPLETION_REPORT.md), [sign-off](SECURITY_STAGE_0_SIGNOFF.md) |
| 1 — Foundations | Infrastructure access/recovery, database and file protection, isolated staging, scoped recovery drill, provider inventory and operational runbooks | Six checkpoint steps complete with carry-forward. [Plan](SECURITY_STAGE_1_FOUNDATIONS_PLAN.md), [report](SECURITY_STAGE_1_COMPLETION_REPORT.md) |
| 2 — Web hardening | Browser headers/HTTPS, Contact challenge and server quota controls, and Web Push outbound destinations | Four checkpoint steps complete with carry-forward. [Plan](SECURITY_STAGE_2_WEB_HARDENING_PLAN.md), [report](SECURITY_STAGE_2_COMPLETION_REPORT.md) |
| 3 — Authorization and Auth controls | Direct permitted/denied tenant, role, RPC and finance access; Personal/Family/Business separation; privilege escalation; application Admin MFA and password/Auth UX | 3.1 baseline closed. 3.2.1 source/local review and Personal API handoff prepared; owner result pending. [Six-step plan](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md), [baseline result](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md). Two owner metadata checks passed; remaining application behavior checks pending. F08/F15 remain open |
| 4 — Data lifecycle, uploads and privacy | Account deletion/shared ownership/retention; content and download validation; factual operator, audience, policy and processor disclosures | Planned. F01/F02/F13/F20 |
| 5 — Native security and compatibility | Existing Android/iOS source and release configuration; token storage, cloud/device backup exclusions, native origins/callbacks, privacy manifests and build prerequisites | Planned. F05/F06/F10/F14/F17; APK update remains deferred |
| 6 — Identity and email workflows | Google/Apple login decisions/configuration, linking and invitation collisions; confirmation/recovery/callback matrix; proposed shared email architecture | Planned. F04 plus Auth/email dependencies; preserve working SMTP while later routing is reviewed |
| 7 — Subscription commerce | Store-supported digital plan purchases, server entitlements, product/seat mapping, purchase verification, restore/refunds and any provider webhook protocol | Planned. F03; product/operator/channel decisions remain prerequisites |
| 8 — Notifications and device behavior | Native push transport and device/account token lifecycle; private notification content; event routing and available PWA/device update/offline behavior | Planned. F11 and event/device dependencies |
| 9 — Broad regression and release evidence | Complete staged app/finance/permission/device regression and performance evidence; signed artifacts, SDK/data declarations, store accounts and external testing prerequisites | Planned. Coverage register and F05/F17/F20 retain the actual evidence required |
| 10 — Release and operations gate | Final operational/release review, production/version mapping, recovery/response readiness and store submission/review prerequisites | Planned. F19 and unresolved release gates; stage completion is not automatic permission to publish |

Later-stage steps must be finite and numbered before execution. The original finding definitions and assigned dependencies remain authoritative; a title in this roadmap does not expand authorization or replace the evidence checklist.

## How each stage runs

1. Explain the finite work items and why they are needed; use `stage.step` in every message.
2. Review the relevant source and current evidence. Keep production, staging and local checks clearly identified.
3. Prepare authorized changes and meaningful checks. Use synthetic staging data for controlled risky tests.
4. Record PASS, FAIL, BLOCKED, UNVERIFIED and decisions at their actual scope. A UI-hidden action, local fixture or metadata result is not a direct authorization or delivery proof.
5. Issue the detailed stage-end report and update the [action register](SECURITY_AUDIT_CARRY_FORWARD.md).
6. Advance after the bounded outcomes are recorded. Carry missing prerequisites and unresolved cases instead of creating an endless diagnostic sequence.

The [workflow](SECURITY_AUDIT_WORKFLOW.md) preserves the owner's full reporting, Windows/SQL handoff and final re-audit requirements. [The tool index](TOOL_INDEX.md) links the existing diagnostic SQL, scripts, tests and migrations without relocating executable files.

## Final remediation and full re-audit

After the audit stages, consolidate all failed, blocked, uncertain and decision items. Resolve them, obtain the missing hosted/device evidence and coordinate the approved production rollout, including the Stage 2 Contact verification controls. Then perform a fresh full audit of the final source, deployments and artifacts, including regressions and unchanged areas.

Keep findings open until their defined rechecks pass. Any remaining release blocker or missing evidence stays explicit. The final re-audit precedes store submission/release approval; there is no all-PASS or store-acceptance guarantee inferred from the stage reports.

## Environment references

| Environment | Identity | Use |
|---|---|---|
| Actual Supabase | kttkospkblwvguuwnhjj | Clearly identified production metadata/review and separately authorized production changes |
| Isolated Supabase | dczlddwbtgvfdujgcitb | Synthetic staging checks and staged changes |
| Staging website | https://mushavo-budget-staging.pages.dev/ | Separate frontend acceptance |
| Owner Windows checkout | C:\Users\HP\Desktop\Mushavo Budget | Existing native/source work; preserve local edits and signing identity |

Secrets, private backup bytes, credentials and raw customer records stay outside these audit documents. Google offsite backup work remains deferred. This folder organization does not deploy runtime, modify hosted data or rebuild an APK.
