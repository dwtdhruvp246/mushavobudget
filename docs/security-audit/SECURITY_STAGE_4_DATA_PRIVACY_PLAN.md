# Stage 4 — Data lifecycle, uploads and privacy plan

**Started 11 October 2026 at 4.1.1, S4E01.** Stage 3 is [closed with carry-forward](SECURITY_STAGE_3_COMPLETION_REPORT.md). This stage preserves the original F01/F02/F13/F20 assignments and earlier F08/F15/backup/device dependencies.

Source/evidence baseline: `70b34a545a81db983e1030a90e3b26d3419621da`, branch `security/stage-3-authorization`. Staging is `dczlddwbtgvfdujgcitb` and `https://mushavo-budget-staging.pages.dev/`; production `kttkospkblwvguuwnhjj` is excluded from mutation. No deletion, upload, Auth/Storage change, provider message or deployment is requested by this plan.

## Four finite steps

| Step | Work | Outcome required |
|---|---|---|
| 4.1 — Account deletion, shared ownership and retention | Inspect source and identity/FK/file dependencies; prepare a justified candidate and one bounded acceptance outcome | Explicit data/ownership decisions, server-self identity controls and truthfully scoped deletion/retry/preservation evidence; blockers carried |
| 4.2 — Uploads and downloads | Inspect payment/subscription/Business proofs and logos; validate supported types/content/size/quota and object authorization | Valid positive files plus malformed/mismatched/oversized/foreign/signed-URL behavior at actual scope; preserve accepted product file types |
| 4.3 — Factual privacy and disclosures | Inventory operator/audience/territories, collected data, processors, SDKs, purposes, retention and support; prepare notices consistent with actual behavior | Factual approved notices/working links and unresolved decisions; native/store declarations retain later-stage prerequisites |
| 4.4 — Recheck, full report and handoff | Relevant bounded regressions/effect rechecks; reconcile evidence/actions; publish dated detailed report | Four recorded outcomes, original findings preserved, remaining remediation and next-stage handoff |

Steps 4.1–4.3 each have three bounded groups: source/contract review, justified candidate/local checks, and one controlled hosted/owner batch or explicit BLOCKED outcome. Step 4.4 consolidates these results. No endless prerequisite setup or extra stage is added.

## 4.1 milestones

| Milestone | Work | Current outcome |
|---|---|---|
| 4.1.1 | Source review, selected identity/ownership dependencies, current official requirements and frozen DL01–DL05 contract | COMPLETE at source/documentation scope; no hosted deletion proof |
| 4.1.2 | Prepare review-only data-decision/preflight and deletion workflow candidates with meaningful isolated checks; distinguish implementable controls from unresolved retention decisions | NEXT |
| 4.1.3 | One controlled acceptance phase only if approved semantics, recoverable disposable identities/files and safe provider boundaries exist; otherwise record BLOCKED and checkpoint carry-forward | PENDING |

The [4.1 source review](SECURITY_STAGE_4_1_ACCOUNT_LIFECYCLE.md) defines the selected cases, proposed decision matrix and current blockers. A deletion design or request receipt is not a completed erasure result.

## Scope boundaries and dependencies

- Personal data, shared family/Business finance, Auth identity, workspace memberships, support/analytics/notifications, Storage bytes/ownership, provider/session/device state and retained backup copies must be classified separately.
- Keep deletion of an app account distinct from leaving a shared workspace, removing a member, deleting a family, suspension, and subscription cancellation. Shared ownership must not silently erase someone else's records.
- Retention requires actual supported grounds, defined duration/expiry, minimized data/access and a factual notice. Do not invent retention periods, assume a regulated-industry exemption or retain all shared user content indefinitely.
- Preserve `audit.owner@example.com`, `audit.outsider@example.com`, existing Personal/Family audit fixtures, inactive former member and two USD1 conversions. They are not disposable Auth-erasure test accounts.
- Stage 3 Personal invariant, Business guard/parity and Admin MFA/actor/recovery blockers remain open. Stage 1 backup completeness/isolated recovery remains limited. A new deletion test needs separate controlled recoverable fixtures, not customer data or sole-operator tests.
- Provider social-login revocation and store subscription/native callback behavior retain Stages 5–7. Device/notification lifecycle retains Stage 8. Stage 4 records missing prerequisites without claiming those checks complete.
- Public notices and store form answers must describe actual final behavior. No policy publication, Play/App Store form submission, production rollout or native build is inferred from a source review.

## Current primary requirements

Checked 11 October 2026:
- [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion) requires an in-app initiation path for apps supporting account creation; disabling an account alone is insufficient. Reasonable verification and explained timing/retention are allowed.
- [Google Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en) require an in-app path and a functional web deletion resource for apps with account creation, plus associated-data deletion and truthful retention disclosures.
- [Supabase deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) is a server-side privileged operation. [User management](https://supabase.com/docs/guides/auth/managing-user-data) describes Storage ownership blockers and the residual issued-JWT window.
- [Storage object deletion](https://supabase.com/docs/guides/storage/management/delete-objects) must remove bytes through the Storage API; SQL metadata deletion alone can orphan the object.

These are platform/service requirements and planning inputs, not a legal-retention decision or store acceptance certification.

## Evidence and reporting

Record source/local/owner/hosted/device scopes, exact versions, expected/observed effects and PASS/REVIEW/FAIL/BLOCKED/DECISION separately. Counts from Stage 3 remain historical evidence, not fresh Stage 4 results. Owner actions require a complete pinned PowerShell/SQL/browser handoff; only safe summaries return, never credentials/tokens/private rows.

- [Stage 4 evidence](security-stage-4-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json), [carry-forward](SECURITY_AUDIT_CARRY_FORWARD.md), [123-section register](SECURITY_AUDIT_REGISTER.md).
- [Workflow](SECURITY_AUDIT_WORKFLOW.md), [audit roadmap](AUDIT_PLAN.md).
