# Stage 3 — Authorization, application Admin MFA and Auth flows

**Started — 3.1, 10 October 2026.** Owner authorized the six-step stage with “ok lets start”. [3.1 permission map and baseline](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md) is now closed with two owner metadata passes, source classification and the frozen follow-up matrix. All three baseline work items have outcomes; 12 local diagnostic fixtures passed. Next is 3.2.1. Application permission/MFA/Auth behavior and hosted body parity remain pending. Stage 2 remains closed with carry-forward. No runtime enforcement or Auth setting has changed.

## What this stage means

Stage 3 checks who is allowed to see or change each piece of Mushavo Budget data and whether the backend actually enforces those rules. A visible button or a hidden page is only the interface. Direct requests must preserve the same account, workspace, role and scope restrictions.

The principal open findings are **F08** (application Admin MFA, password and Auth UX) and **F15** (effective grants, protected functions, tenant/currency/finance authorization). Prior metadata and selected Personal checks are useful evidence, but do not prove the full Personal/Family/Business/Admin matrix. We audit the permission model already built and repair demonstrated gaps; new roles or changed product rules need an explicit requirement.

## Six finite steps

| Step | Work and purpose | Recorded outcome |
|---|---|---|
| 3.1 — Permission map and baseline | Identify existing roles, membership/scope rules and privileged entrypoints. Compare intended access with source/current metadata. Agree a bounded caller × workspace × operation matrix before tests | Permission matrix, one consolidated baseline inventory and prioritized candidate/retest cases |
| 3.2 — Personal and Family isolation | Verify permitted and denied reads/writes, selected finance/currency RPCs, invitations and membership removal. Test owner/member/outsider/former-member boundaries with verified sessions | Allowed/denied outcomes and justified repairs; unmatched requirements or unavailable cases carried explicitly |
| 3.3 — Business roles and scopes | Exercise the built-in and custom role model, assigned/own/team scopes, role administration and cross-business isolation. Include selected expenses/bills/budgets/approvals/reports and export/receipt authorization | Bounded Business role/scope matrix, escalation/replay/removal outcomes and regression checks |
| 3.4 — Privileged entrypoints and application Admin MFA | Review platform Admin/staff permissions, protected API/RPC operations and Edge/cron authentication. Prepare app authenticator enrollment/challenge and backend-enforced verified MFA for the agreed platform administrative scope; preserve a reviewed recovery path | Candidate plus permitted/denied privilege/MFA/job checks; hosted/recovery gaps remain explicit |
| 3.5 — Sign-in, password, invitation and recovery flows | Coordinate password rules and UI with actual supported project settings. Check confirmation/unconfirmed-email guidance, ordinary and invited setup, password recovery/change, session refresh/sign-out/account switching and selected failure/rate cases | One bounded Auth acceptance matrix and justified UX/control corrections |
| 3.6 — Recheck, report and handoff | Recheck affected permitted/denied cases and relevant regressions. Publish detailed results, versions/evidence and the action plan | Stage 3 report; failures/blocked/uncertain results carry into final remediation and full re-audit |

Each main step has three bounded work groups: **review/baseline**, **justified candidate and meaningful local checks**, and **one controlled staging acceptance batch with recorded unavailable outcomes**. Step 3.6 consolidates the affected rechecks and report. Several commands or test cases may be needed within a group; the six labels are not a promise of six messages. Define the exact selected cases at the start of the step rather than expanding it indefinitely.

## 3.1 — The permission map

Personal callers: owner, a second signed-in user and anonymous access. Family callers: head, active member, unrelated user and removed member. Business callers: Owner, Business Admin, Finance Manager, Team Manager, Staff, Contributor, Viewer and representative custom roles with existing scope modes. Platform callers: authorized Admin/staff, ordinary user and revoked/suspended identity where applicable.

For selected sensitive operations, record the caller, workspace, role/scope, operation, expected result and observed effect. Keep public catalogue/signup lookups and protected backend jobs separate from ordinary user operations; do not blanket-revoke legitimate entrypoints.

A response status alone is insufficient: a denied update must affect no protected row, an empty scoped read must reveal no other user's row, and an allowed positive control must prove the tested path works for its legitimate caller.

## 3.2–3.3 — Examples of the boundaries

- Personal user A can read and change A's own selected payment; user B cannot read or change it by substituting an identifier.
- Family members get only the existing permitted family access; changing a request cannot grant head powers or reach an unrelated family.
- Invitation acceptance requires the intended recipient and valid pending state; replay/cancellation/outsider cases must not create unauthorized membership.
- A Viewer can perform the permitted reads but cannot change records. A scoped Team Manager cannot escape assigned scope.
- A role manager cannot give themselves ownership/platform Admin authority or assign a forbidden role through unexpected fields.
- Permission removal and account suspension are checked against actual direct requests and any residual session behavior; UI hiding is not the evidence.
- Report/export/receipt access follows the same workspace and role boundaries. File-content validation remains Stage 4, while file authorization belongs to this matrix.
- Legitimate protected currency/finance writes and immutable historical conversions remain functional. Wider store commerce and financial reconciliation remain assigned to Stage 7.

## 3.4 — What Admin MFA adds

The infrastructure MFA checked in Stage 1 protects the operator's Cloudflare/GitHub/Supabase/Zoho accounts. This step protects **administrative actions inside Mushavo Budget itself**.

The proposed scope is platform administrative access: verify an authenticator factor, challenge the app session and require sufficient assurance at the privileged backend boundary. Business Owner/Admin role names do not automatically become platform Admin roles or imply a new MFA requirement for every customer. The precise privileged operation/staff scope is mapped before enforcement.

An Admin enrollment prompt alone does not secure a direct API call. Enforce verified session assurance alongside actual role checks. Verify that a conventional Admin session is denied for protected actions, a correctly stepped-up authorized Admin succeeds, and a non-Admin cannot gain privileges by submitting MFA/role fields. Supabase represents a second-factor-verified session as aal2; the integration must verify identity/claims rather than trust client-supplied flags.

Include safe enrollment/factor removal, refresh/resume behavior and a controlled lost-factor/recovery procedure. Establish the recovery/enrollment path in staging before enforcement that could lock out the operator. Service jobs use their reviewed service authentication, not an interactive Admin challenge. Test absent/wrong credentials and legitimate job controls without sending real customer notifications.

## 3.5 — Auth flow compatibility

The baseline displayed a six-character minimum and gaps in password-change/Auth UX evidence. Select and coordinate a stronger password rule, invitation first-password setup and ordinary recovery before toggling settings. Backend rules and form hints must match. Inspect available Free-plan features; do not claim paid leaked-password protection or advanced session controls are enabled.

Use a bounded flow list: ordinary signup and pre-confirmation denial; correct confirmation destination; Admin and Business invitation setup; ordinary sign-in; expired/used links; password recovery/change; refresh/sign-out/account switch; selected session/rate failure handling. Record stale-token/revocation windows as observed rather than promise immediate invalidation from sign-out alone.

Full Google/Apple integration and the shared application email architecture remain Stage 6. This step preserves the working SMTP path and verifies current Auth behavior.

## Where we work and what the owner will receive

Implementation and mutation/negative tests use **STAGING dczlddwbtgvfdujgcitb** and **https://mushavo-budget-staging.pages.dev/** with synthetic data and controlled accounts. Any production metadata request must explicitly identify **kttkospkblwvguuwnhjj** and its read-only purpose. No production customer-data restore or risky production substitute is inferred.

Before an owner action, provide the full PowerShell block, identify the exact environment, explain prompts and state the expected output. SQL uses the existing pinned fetch/show/clipboard handoff, then manual paste into the named Supabase project. Account secrets, authenticator setup material and tokens stay private; provide summaries only.

At each step, distinguish local/source/owner/API/hosted/device evidence. Missing prerequisites produce a bounded BLOCKED/UNVERIFIED outcome rather than an endless setup sequence. The owner's standing process remains: stage-end detailed report, final remediation/approved production rollout and full fresh re-audit. This planning document does not initiate a production rollout or an APK rebuild.

## Completion and references

Stage 3 closes its checkpoint after all six steps have recorded outcomes and the detailed report/action register is updated. F08/F15 do not close just because the stage does. Broader device/event/financial cases retain their assigned later stages.

- [Complete audit roadmap](AUDIT_PLAN.md).
- [Workflow](SECURITY_AUDIT_WORKFLOW.md), [action register](SECURITY_AUDIT_CARRY_FORWARD.md) and [123-section coverage](SECURITY_AUDIT_REGISTER.md).
- [Stage 0 F08/F15 definitions and action plan](SECURITY_STAGE_0_COMPLETION_REPORT.md).
- [Stage 1 report](SECURITY_STAGE_1_COMPLETION_REPORT.md) and [Stage 2 report](SECURITY_STAGE_2_COMPLETION_REPORT.md).
- [Supabase application MFA documentation](https://supabase.com/docs/guides/auth/auth-mfa) and [password-security documentation](https://supabase.com/docs/guides/auth/password-security), checked 10 October 2026.
