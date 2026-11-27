# Stage 3 — Authorization, application Admin MFA and Auth flows

**Latest — 3.6 / Stage 3 CLOSED WITH CARRY-FORWARD, 11 October 2026 (S3E25):** All six main steps now have recorded outcomes and the [full Stage 3 report/action plan](SECURITY_STAGE_3_COMPLETION_REPORT.md) is published. Final offline regression against `1eebdc58cb6a71268fa62f3e555dd07db3c0b346`: **177 PASS / 0 FAIL across 20 files, exit 0; 12 syntax checks PASS**. Owner staging Personal/Family/currency batches retain **26/33/23 PASS check groups and one Personal binding REVIEW** (82 execution groups, not unique controls). Business, Admin MFA and Auth hosted acceptance remain BLOCKED; no fresh hosted or modeled-database tests ran at 3.6. The report consolidates 20 existing PF/Business/AM/AU actions, preserves earlier evidence and keeps F08/F15 and release gates OPEN. No production promotion, hosted deployment, settings/account mutation, email/provider job or native rebuild was performed by 3.6. **Next is 4.1**, source/evidence review of account deletion, shared ownership and retention. Earlier summaries are historical.

**Latest — 3.5 checkpoint closed with BLOCKED hosted acceptance, 11 October 2026 (S3E24):** The owner completed the read-only staging Auth summary: project selection, email confirmation and staging Site URL are owner-confirmed; the server minimum is reported as **8**, against the candidate's proposed **12**. Required characters, secure/current-password checks, callback coverage and exact candidate deployment remain unknown; separate controlled Auth test identities are unavailable. Prior mail delivery is owner-reported only, with no new delivery test. **Zero hosted Auth cases ran; all 31 AU01–AU05 cases remain BLOCKED.** The 111 local candidate PASS and six syntax checks retain their local scope. All three 3.5 milestones now have outcomes. [3.5 checkpoint report and AU-R01–AU-R06 actions](SECURITY_STAGE_3_5_CHECKPOINT_REPORT.md). No further 3.5 owner setup, settings change, email, deployment, SQL, production or native action is requested. Earlier Personal/Business/MFA actions and F08/F15 remain OPEN. **Next is 3.6**, evidence reconciliation and the detailed full Stage 3 report. Earlier summaries are historical.

**Latest — 3.5.2 candidate/local verification complete / next 3.5.3, 11 October 2026 (S3E23):** The Auth compatibility candidate adds separated confirmation/recovery/change and Business first-password UX, isolated link sessions with explicit verified-account transfer, a proposed 12-character new-password rule, compatible older-password sign-in, explicit logout failures and old-account query/render guards. **111 local checks PASS, exit 0; six syntax checks PASS.** Pinned SDK source supports nonce/current-password fields. This is source, VM/SDK/provider mocks and synthetic Git-builder evidence, not genuine Auth/SMTP/browser/JWT/hosted acceptance. Two of three 3.5 milestones have outcomes. [Candidate report and complete read-only staging handoff](SECURITY_STAGE_3_5_AUTH_CANDIDATE.md). Next is one owner settings/readiness summary; no setting toggle, mail/account mutation, SQL install, deployment or native action is requested. AU01–AU05 hosted cases and AU-R01–AU-R06 remain pending, alongside all earlier Business/MFA/Personal carry-forward. F08/F15 stay OPEN; Stage 3's full report remains due at 3.6. Earlier summaries are historical.

**Latest — 3.5.1 source review complete / next 3.5.2, 11 October 2026 (S3E22):** Auth source review and the existing AU01–AU05 groups are detailed in [the 3.5 plan](SECURITY_STAGE_3_5_AUTH_FLOWS.md). New-password UI currently advertises six characters; ordinary recovery/change and Business first-password UI are absent in the reviewed source, and confirmation shares an unfinished-invitation fallback route. The selected existing Node regressions return **34 PASS / 1 FAIL (35 tests, exit 1)**; the failure is a brittle first-statement assertion after MFA state cleanup, retained as test compatibility REVIEW. Hosted settings, links, passwords, browsers and API acceptance are unverified; zero hosted Auth checks ran. One of three 3.5 milestones is complete. Next is candidate preparation/local verification; no owner action, email dispatch, Auth setting toggle, SQL install, deployment or existing synthetic account change is requested. AU-R01–AU-R06 and all earlier checkpoint actions remain open; F08/F15 stay OPEN and the full Stage 3 report stays due at 3.6. Earlier summaries are historical.

**Latest — 3.4 checkpoint closed with BLOCKED hosted acceptance, 11 October 2026 (S3E21):** Owner read-only receipt matches all 36 reviewed routine bodies via their exact CRLF variant and reports zero body/shape mismatches; 34 of 58 selected policy definitions differ, with semantics unverified. No platform staff, verified active super operators or candidate helpers are reported. Genuine A01–A05 hosted MFA/role/recovery/Edge/job acceptance is BLOCKED; zero hosted API/MFA checks ran. The 90 local candidate checks remain scoped local evidence. Carry policy reconciliation, isolated privileged actor/settings/recovery, coordinated reviewed rollout/effective grants and full bounded acceptance to AM-R01–AM-R05 in [the 3.4 checkpoint report](SECURITY_STAGE_3_4_CHECKPOINT_REPORT.md). No repeated setup or further 3.4 owner action is requested. Next is 3.5.1 Auth-flow source review; F08/F15 stay OPEN and the full Stage 3 report remains due at 3.6. Earlier summaries are historical.

**Started — 3.1, 10 October 2026.** Owner authorized the six-step stage with “ok lets start”. [3.1 permission map and baseline](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md) is now closed with two owner metadata passes, source classification and the frozen follow-up matrix. All three baseline work items have outcomes; 12 local diagnostic fixtures passed. [3.2.1 Personal checkpoint](SECURITY_STAGE_3_2_PERSONAL_FAMILY.md) is recorded: 26 owner PASS, one workspace-binding REVIEW and six later groups unrun. Source/local reproduction supports the paid-record gap; exact failed response/persisted-state and wider impact remain unverified. The failure/unrun cases carry to final remediation. 3.2.2 Family owner API result has all 33 selected checks PASS (S3E11). 3.2.3 currency owner API has all 23 checks PASS (S3E13). All three 3.2 milestones are closed with carry-forward; [the checkpoint report](SECURITY_STAGE_3_2_CHECKPOINT_REPORT.md) reconciles the four later helper rechecks and the outstanding binding/relink/delete/provider/history cases (S3E14). [3.3.1 Business source role/scope matrix](SECURITY_STAGE_3_3_BUSINESS_ROLES.md) is recorded (S3E15); 3.3.2 controlled fixture/checker preparation is complete (S3E16: 11 local source scenarios and eight isolated tests). 3.3.3 closes with BLOCKED hosted acceptance (S3E18): the first fixture guard stopped setup, and a read-only diagnostic identified 77 line-ending differences plus one remaining unreviewed notification-outbox function. No Business API checks ran; the frozen expected 24 PASS/five BLOCKED batch and its prerequisites carry to final remediation. See the [Business checkpoint report](SECURITY_STAGE_3_3_CHECKPOINT_REPORT.md). 3.4.1 privileged-entrypoint/Admin-MFA source review is complete (S3E19): the local ordered-source catalog selects 36 routines and 55 direct staff policies across 34 public relations; the reviewed UI/helpers/selected Edge human branches have no explicit assurance gate. The existing A01–A05 groups and operation role rules are frozen in the [3.4 plan](SECURITY_STAGE_3_4_ADMIN_MFA.md). Next is 3.4.2 staged candidate/local verification, with operator recovery and hosted acceptance still pending. Application permission/MFA/Auth behavior and hosted body parity remain pending. Stage 2 remains closed with carry-forward. No runtime enforcement or Auth setting has changed.

## What this stage means

Stage 3 checks who is allowed to see or change each piece of Mushavo Budget data and whether the backend actually enforces those rules. A visible button or a hidden page is only the interface. Direct requests must preserve the same account, workspace, role and scope restrictions.

The principal open findings are **F08** (application Admin MFA, password and Auth UX) and **F15** (effective grants, protected functions, tenant/currency/finance authorization). Prior metadata and selected Personal checks are useful evidence, but do not prove the full Personal/Family/Business/Admin matrix. We audit the permission model already built and repair demonstrated gaps; new roles or changed product rules need an explicit requirement.

## Six finite steps

| Step | Work and purpose | Recorded outcome |
|---|---|---|
| 3.1 | Permission map and read-only baseline | CLOSED: two narrow metadata PASS; broader behavior/grants/parity carried |
| 3.2 | Personal/Family/currency isolation | CLOSED: 26/33/23 owner PASS check groups; one binding REVIEW and unrun cases carried |
| 3.3 | Business roles/scopes | CLOSED: source/local tools complete; hosted BLOCKED, zero API groups run |
| 3.4 | Privileged entrypoints/Admin MFA | CLOSED: historical 90 local PASS; hosted A01–A05 BLOCKED, operator/policy/recovery actions carried |
| 3.5 | Password/sign-in/invitation/recovery | CLOSED: historical 111 local PASS; 31 hosted AU cases BLOCKED; owner server 8 versus proposed 12 |
| 3.6 | Recheck, full report and handoff | CLOSED: fresh 177 local PASS, 12 syntax checks; detailed report/20-action register; next 4.1 |


Each main step has three bounded work groups: **review/baseline**, **justified candidate and meaningful local checks**, and **one controlled staging acceptance batch with recorded unavailable outcomes**. Step 3.6 consolidates the affected rechecks and report. Several commands or test cases may be needed within a group; the six labels are not a promise of six messages. Define the exact selected cases at the start of the step rather than expanding it indefinitely. For 3.2, the single frozen acceptance matrix has three owner-facing phases: source/Personal CRUD, Family fixture/requests, then selected currency controls and checkpoint reconciliation; review/local work is included in those phases. See the [bounded 3.2 milestones](SECURITY_STAGE_3_2_PERSONAL_FAMILY.md).

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

