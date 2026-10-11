# Mushavo Budget security audit — Start here

All security audit documentation and evidence is collected here on **`security/stage-3-authorization`**. Updated 11 October 2026. Stages 0–3 are **CLOSED WITH CARRY-FORWARD**; Stage 4 is active. **4.1.1 lifecycle source review is complete; next is 4.1.2, review-only candidate/preflight and local checks.** No hosted deletion or account/file change has run. Read the Stage 4 plan and lifecycle contract; full report remains due at 4.4. F01/F02/F13/F20 and earlier F08/F15/release gates remain OPEN.

To browse normally on GitHub, select the **`security/stage-3-authorization`** branch, then open **docs → security-audit**. The default main branch does not contain this audit folder. Direct commit links are pinned snapshots; use this branch for the latest progress.

## Main documents

| Open this | What it contains |
|---|---|
| [Audit plan](AUDIT_PLAN.md) | Complete stage roadmap, current position, stage workflow and final remediation/re-audit sequence |
| [Action plan and carry-forward register](SECURITY_AUDIT_CARRY_FORWARD.md) | Outstanding failures, uncertain results, decisions and remediation history |
| [Master audit coverage register](SECURITY_AUDIT_REGISTER.md) | All original 123 audit sections and their evidence/owner/stage assignments |
| [Audit workflow](SECURITY_AUDIT_WORKFLOW.md) | Numbered messages, bounded work, stage-end reports and execution conventions |
| [Stage 4 finite plan](SECURITY_STAGE_4_DATA_PRIVACY_PLAN.md) | Four steps, three lifecycle milestones and full report at 4.4 |
| [4.1 lifecycle review and decision matrix](SECURITY_STAGE_4_1_ACCOUNT_LIFECYCLE.md) | Source gaps, dependencies, proposed data decisions, DL01–DL05 and DL-R01–DL-R06 |
| [Full Stage 3 report and action plan](SECURITY_STAGE_3_COMPLETION_REPORT.md) | All six outcomes, exact evidence limits, final regression and 20 remaining actions |
| [3.5 Auth checkpoint and actions](SECURITY_STAGE_3_5_CHECKPOINT_REPORT.md) | Owner readiness, password-rule mismatch, 31 blocked hosted cases and AU-R01–AU-R06 |
| [3.5.2 Auth candidate and readiness handoff](SECURITY_STAGE_3_5_AUTH_CANDIDATE.md) | Candidate scope, 111 local checks and complete read-only staging commands |
| [3.5 Auth flows and bounded plan](SECURITY_STAGE_3_5_AUTH_FLOWS.md) | Source findings, AU01–AU05 cases, three milestones and candidate/hosted prerequisites |
| [3.4 Admin MFA checkpoint](SECURITY_STAGE_3_4_CHECKPOINT_REPORT.md) | Local candidate evidence, owner readiness blocker and AM-R01–AM-R05 |
| [3.3 Business checkpoint](SECURITY_STAGE_3_3_CHECKPOINT_REPORT.md) | Guard/source-parity blocker and zero hosted Business API checks |
| [3.3 Business roles and scopes](SECURITY_STAGE_3_3_BUSINESS_ROLES.md) | Three bounded milestones, source contract and B01–B08 test groups |
| [3.2 checkpoint report](SECURITY_STAGE_3_2_CHECKPOINT_REPORT.md) | Personal/Family/currency outcomes, remaining issues and concrete remediation actions |
| [Current progress](SECURITY_AUDIT_PROGRESS.json) | Structured stage/step status; preserved prior-stage outcomes |
| [SQL, scripts and tests](TOOL_INDEX.md) | Linked index of audit tools, migration files and relevant implementation locations |

## Completion reports

| Stage | Report | Outcome |
|---|---|---|
| 0 | [Baseline completion report and original F01–F20 actions](SECURITY_STAGE_0_COMPLETION_REPORT.md) | Closed with known gaps and prerequisites |
| 1 | [Foundations completion report](SECURITY_STAGE_1_COMPLETION_REPORT.md) | Closed with scoped passes and failed/unverified carry-forward |
| 2 | [Web hardening completion report](SECURITY_STAGE_2_COMPLETION_REPORT.md) | Closed with scoped passes, failed production HTTPS samples and blocked/unverified hosted checks |
| 3 | [Authorization/Auth completion report](SECURITY_STAGE_3_COMPLETION_REPORT.md) | Closed with scoped API passes, Personal binding REVIEW, blocked hosted cases and 20 remaining actions |

## All stage documents and evidence

The 36 existing audit documents/evidence files were moved here from the parent docs folder; their report outcomes and historical receipts are retained. Earlier status paragraphs within a report are historical snapshots. Use its latest status and the progress record for current position.

### Stage 0 — Baseline

- [Business invitation email and Notifications setup](BUSINESS_INVITATION_NOTIFICATION_SETUP.md)
- [Security and store release — Stage 0 baseline](SECURITY_STAGE_0_BASELINE.md)
- [Stage 0 closure checklist](SECURITY_STAGE_0_CLOSURE_CHECKLIST.md)
- [0.6 — Stage 0 completion audit report and action plan](SECURITY_STAGE_0_COMPLETION_REPORT.md)
- [Stage 0 database function exposure review](SECURITY_STAGE_0_FUNCTION_REVIEW.md)
- [Stage 0 sign-off record](SECURITY_STAGE_0_SIGNOFF.md)
- [security-stage-0-evidence.json](security-stage-0-evidence.json)

### Stage 1 — Foundations

- [1.1 — Account security and recovery checks](SECURITY_STAGE_1_1_ACCOUNT_CHECKS.md)
- [1.2 — External database and file protection](SECURITY_STAGE_1_2_BACKUP_INVENTORY.md)
- [1.2 checkpoint report — external backups and recovery](SECURITY_STAGE_1_2_CHECKPOINT_REPORT.md)
- [1.3 — Isolated staging checkpoint report](SECURITY_STAGE_1_3_CHECKPOINT_REPORT.md)
- [1.3 — Isolated staging](SECURITY_STAGE_1_3_ISOLATED_STAGING.md)
- [1.3.2 — Staging preflight result](SECURITY_STAGE_1_3_PREFLIGHT_RESULT.md)
- [1.3.3–1.3.4 — Schema completion and frontend preparation](SECURITY_STAGE_1_3_SCHEMA_AND_FRONTEND_CHECKPOINT.md)
- [1.3.5 — Synthetic staging acceptance checks](SECURITY_STAGE_1_3_SYNTHETIC_CHECKS.md)
- [1.4 — Synthetic recovery checkpoint report](SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md)
- [1.4 — Synthetic recovery testing](SECURITY_STAGE_1_4_SYNTHETIC_RECOVERY.md)
- [1.5 — Operations checkpoint report](SECURITY_STAGE_1_5_CHECKPOINT_REPORT.md)
- [1.5.1 — Production operations inventory](SECURITY_STAGE_1_5_INVENTORY.md)
- [1.5.2 — Monitoring, usage and controlled support check](SECURITY_STAGE_1_5_MONITORING_CHECK.md)
- [1.5.3 — Operational runbooks](SECURITY_STAGE_1_5_OPERATIONAL_RUNBOOKS.md)
- [1.5 — Inventory, monitoring and response](SECURITY_STAGE_1_5_OPERATIONS.md)
- [Stage 1 foundations — detailed completion report](SECURITY_STAGE_1_COMPLETION_REPORT.md)
- [Stage 1 foundations worklist — closed with carry-forward](SECURITY_STAGE_1_FOUNDATIONS_PLAN.md)
- [security-stage-1-evidence.json](security-stage-1-evidence.json)

### Stage 2 — Web hardening

- [2.1 — Browser header baseline, candidate and staging handoff](SECURITY_STAGE_2_1_BROWSER_HEADERS.md)
- [Stage 2.2 — Public contact checkpoint report](SECURITY_STAGE_2_2_CHECKPOINT_REPORT.md)
- [2.2 — Public contact-form abuse controls](SECURITY_STAGE_2_2_PUBLIC_CONTACT.md)
- [Stage 2.3 — Web Push outbound destinations](SECURITY_STAGE_2_3_WEB_PUSH.md)
- [Stage 2 completion report — Browser, contact and outbound-request hardening](SECURITY_STAGE_2_COMPLETION_REPORT.md)
- [Stage 2 — Browser, public submission and outbound-request hardening](SECURITY_STAGE_2_WEB_HARDENING_PLAN.md)
- [security-stage-2-evidence.json](security-stage-2-evidence.json)

### Stage 3 — Authorization and Auth controls (closed with carry-forward)

- [Full Stage 3 report/action plan](SECURITY_STAGE_3_COMPLETION_REPORT.md) and [final local regression receipt](security-stage-3-final-regression.json).
- [Six-step Stage 3 breakdown](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md).
- [3.1 — Permission map, bounded acceptance groups and staging baseline](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md) — baseline closed with owner scoped metadata passes and source classification; application behavior checks remain pending.
- [3.2 — Personal/Family phases and recorded Personal result](SECURITY_STAGE_3_2_PERSONAL_FAMILY.md).
- [3.2 checkpoint report](SECURITY_STAGE_3_2_CHECKPOINT_REPORT.md).
- [3.3 Business checkpoint report](SECURITY_STAGE_3_3_CHECKPOINT_REPORT.md).
- [3.4 Admin MFA candidate](SECURITY_STAGE_3_4_ADMIN_MFA_CANDIDATE.md) and [checkpoint report](SECURITY_STAGE_3_4_CHECKPOINT_REPORT.md).
- [3.5 Auth-flow source review and bounded acceptance plan](SECURITY_STAGE_3_5_AUTH_FLOWS.md).
- [3.5.2 Auth candidate, local result and read-only staging handoff](SECURITY_STAGE_3_5_AUTH_CANDIDATE.md).
- [3.5 Auth checkpoint report](SECURITY_STAGE_3_5_CHECKPOINT_REPORT.md) and [owner readiness receipt](security-stage-3-auth-owner-readiness.json).
- [Auth candidate local receipt](security-stage-3-auth-local-checks.json).
- [Pinned Auth source inventory and local regression receipt](security-stage-3-auth-source-inventory.json).
- [security-stage-3-evidence.json](security-stage-3-evidence.json).

### Stage 4 — Data lifecycle, uploads and privacy (active)

- [Four-step Stage 4 plan](SECURITY_STAGE_4_DATA_PRIVACY_PLAN.md).
- [4.1 source review and lifecycle contract](SECURITY_STAGE_4_1_ACCOUNT_LIFECYCLE.md).
- [Selected lifecycle source inventory](security-stage-4-lifecycle-source-inventory.json).
- [Stage 4 evidence](security-stage-4-evidence.json).

## How to use the folder

Start with the audit plan, then the latest stage report. Use the carry-forward action plan to see what still needs work. Later stage plans/reports/evidence belong in this same folder and must be linked here when created.

The audit SQL, scripts, tests and runtime fixes retain their normal repository paths so existing commands, migrations and checks continue to work; the tool index links them. Product feature documentation remains in the parent docs folder. Historical GitHub commit links retain their original paths because those commits are immutable.

Production promotion and unresolved checks are reserved for final remediation, followed by a full fresh re-audit. No runtime deployment, hosted database change or APK rebuild was performed by this organization change.
