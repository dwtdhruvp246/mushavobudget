# 3.3 — Business roles and scopes

**3.3.2 preparation complete — 11 October 2026 (S3E16); hosted acceptance pending.** The [complete fixture/checker handoff](SECURITY_STAGE_3_3_BUSINESS_ACCEPTANCE.md) records 11 local source scenarios, eight isolated tests and the frozen 24-PASS/five-BLOCKED executable scope. Next is one 3.3.3 staging setup/acceptance phase. Production remains unchanged.

**3.3.1 source review complete — 10 October 2026 (S3E15).** The existing B01–B08 groups from the permission baseline are mapped below to current source boundaries. This is source/request-matrix evidence, not a Business authorization PASS. The next milestone is **3.3.2**, controlled fixture/checker preparation and meaningful local validation. No owner SQL, account creation or deployment is requested yet.

Business testing checks that a member can perform the work permitted in the matching business, while edited requests cannot escape the assigned organisation scope, promote a role or reach another business. It audits the permission model already built; it does not add product roles or change customer permission rules.

## Three finite milestones

| Milestone | Work | Current outcome |
|---|---|---|
| 3.3.1 | Review current role/permission/scope and operation guards; freeze B01–B08 requests and controlled-fixture prerequisites | Complete at source scope; hosted behavior unverified |
| 3.3.2 | Prepare the controlled staging fixture and checker; validate positive paths, strict denials and hidden-effect detection locally | Complete: 11 source scenarios and eight isolated tests; pinned fixture/checker handoff ready |
| 3.3.3 | One bounded staging acceptance phase, then record its checkpoint summary and any blocked/failed/unverified cases | Pending owner fixture receipt and API batch; five named carry-forward groups are frozen |

The group count is eight, not the eventual number of API requests or assertions. Exact executable cases/counts are fixed during preparation before the owner run. The Stage 3 report remains at 3.6.

## Current source contract

There is a Business Owner plus six built-in member roles: Business Admin, Finance Manager, Team Manager, Staff, Contributor and Viewer. Built-ins use `legacy` scope. Custom roles have stable workspace-local codes and `own`, `assigned` or `all` scope. `all` does not mean all businesses. A role name alone does not determine access: actual role permissions, individual exceptions, dependencies, membership/account/entitlement state and operation-specific scope all matter.

The latest `business_has_permission` checks ordinary identity/account state and active Business entitlement/membership. For nonowners it verifies the assigned role, restricts custom/own-mode actions and enforces required view permissions before considering member allow/deny overrides and role grants. Required dependencies include report export/view, budget manage/view, team manage/view, approval review/view, finance payment/view-all and document manage/view.

Custom-role creation/edit/archive and individual overrides are owner-gated. Assignment/removal uses `business_check_role_assignment`: a nonowner manager cannot change their own access, assign privileges they do not possess, or expand a target/new assignment outside their own assigned dimensions. Required assigned scope, known active same-business dimension IDs and protected Owner membership also constrain writes. Valid matching Owner operations need positive controls; do not blanket-deny management for every nonowner.

Scope differs by operation. Claim access can include the submitter's own records or scoped finance/review authority. Budgets additionally require their view permission and finance/explicit dimension scope. Reports use current custom/legacy submitter and dimension rules; the protected export RPC separately checks `reports.export`, the snapshot fingerprint and selected filters. Receipt metadata and private Storage reads inherit selected parent claim/bill access as well as document permissions. A report's `can_open` or `can_export` flag is not itself evidence that the protected original/download/export request is allowed or denied.

## Frozen request groups

| ID | Selected operations and controls |
|---|---|
| B01 — Existing role permissions | Capture each fixture's current effective Owner and six built-in role permissions. Verify ordinary active identities and legitimate operation controls; unknown role/permission and anonymous/foreign Business calls cannot gain access. |
| B02 — Existing scope modes | Known own, assigned, outside-assigned and other-business claim/report/budget identifiers. Exercise legacy and custom own/assigned/all behavior with valid dimensions; empty assigned scope and foreign dimension substitution are rejected where required. |
| B03 — Role definitions, exceptions and dependencies | Owner positive custom-role save/edit/archive and member allow/deny controls; nonowner/foreign calls denied. Check required view/action dependencies, custom own-mode conflicts, protected system/Owner role, stale version, role-in-use archive/scope change and direct table bypass attempts. |
| B04 — Team management and invitations | Matching manager/recipient positive controls through `create_business_invitation`, `edit_business_invitation`, `respond_business_invitation`, cancellation and member-access RPCs. Check wrong recipient/anonymous/replay/cancelled state, forbidden self/Owner/foreign-member change, privilege and scope escalation. Database-only invitation requests must not invoke the email-sending Edge function. |
| B05 — Selected finance workflows | Known claim create/draft/submit/review/payment, bill and budget/request paths. Verify legitimate permission/state controls, own versus other submitter, direct DML bypass, foreign parent/dimension/workspace substitution and stale/replayed transitions. Synthetic amounts only; no real billing/provider payment. |
| B06 — Reports, export and receipts | Known rows and valid filters through summary/records/export RPCs; compare permitted scope, export-without-view dependency and stale/foreign filters/fingerprint. Selected receipt metadata/private file authorization requires a harmless controlled file or a recorded BLOCKED outcome. File-signature/content processing remains Stage 4. |
| B07 — Removal and state changes | Matching manager removes only the exact permitted fixture member, preserving Owner/foreign business. The same tested session loses selected API/RPC/report/file access and cannot regain it through accepted-invitation replay or direct membership edits. Account suspension/expired entitlement cases use isolated fixtures or are explicitly carried forward. |
| B08 — Cross-business and ordinary API bypass | Pair known positive rows in two isolated businesses. For every selected denied mutation, owner readbacks verify no protected change. Business role labels and client fields cannot confer platform staff or protected backend-helper authority. |

This expands the descriptions of the already assigned B01–B08 groups, without claiming full combinations of every role, operation and input. Demonstrated failures or unavailable prerequisites are recorded with scope and a concrete action. Generic errors, expired tokens, missing functions, malformed references and foreign-key failures cannot substitute for an authorization denial.

## Controlled staging prerequisites and effect limits

Preparation targets **STAGING `dczlddwbtgvfdujgcitb`** and `https://mushavo-budget-staging.pages.dev/`. Production is `kttkospkblwvguuwnhjj` and is not a substitute test target. Start from the two existing ordinary synthetic accounts, preserving Personal/Family fixtures and the two manual conversions. Reuse verified accounts across protected role transitions only if source/local preparation proves that each caller state and positive control remains valid; no additional account is assumed available.

Prepare known synthetic Business workspaces, dimensions, role/override states and inactive/non-dispatching finance data with legitimate entitlement controls. Fixture creation is setup evidence, not authorization evidence. Product launch/owner/team permit guards and active subscription requirements must remain intact. No global switch or platform elevation is an inferred workaround.

Before owner writes, source/local preparation must check relevant notification/outbox/cron/trigger paths, selected harmless file prerequisites and safe dispatch destinations. Do not call the invitation-email Edge function, automatic provider/scheduler or real payment channel to bypass a blocker. A missing safe file/provider/credential becomes BLOCKED with an action instead of another environment-building loop.

Use exact known synthetic IDs and current versions; verify allowed operations and denied effects separately. Summaries contain named outcomes/counts only, never raw tokens, keys, passwords, customer rows or private identifiers. Provide the complete pinned PowerShell and clipboard SQL instructions, name the target and explain every prompt before the owner acts.

## Reviewed source and limits

- [Business security foundation](../../supabase/migrations/20260928070000_business_stage_2_security_foundation.sql): seeded permissions, active account/membership guards, protected direct writes and document metadata.
- [Team rules](../../supabase/migrations/20260928170000_business_stage_4_team.sql) and latest [custom roles](../../supabase/migrations/20261004153000_business_custom_roles.sql): current permission dependencies, scope/assignment/role/override rules and removal replacements.
- [Expense claims](../../supabase/migrations/20260928200000_business_stage_5_expense_claims.sql), [bills](../../supabase/migrations/20260928213000_business_stage_6_bills.sql), [transactions](../../supabase/migrations/20260929193000_business_stage_7_transactions.sql) and [budgets/approvals](../../supabase/migrations/20260930060000_business_stage_8_budgets_approvals.sql): selected operation and parent/scope guards.
- [Reports/export](../../supabase/migrations/20260930073000_business_stage_9_reports.sql), its latest custom-role replacements and [Business frontend](../../business.js): server export permission/fingerprint plus UI gating, not UI-only authority.
- [Invitation notifications](../../supabase/migrations/20261006180000_business_invitation_notifications.sql): source in-app notice synchronization; rendered UI, physical deletion and transitive dispatch remain separate evidence.

Review uses the current audit source parent `3e6ebe575a65eacbb1fc719ccf6fdf72cc1a007e` and ordered migration replacements, not a single obsolete function definition. No Business API execution, fresh owner inventory, local executable acceptance, runtime change, production promotion or APK change was performed in 3.3.1. Hosted body/configuration parity, broad file/realtime behavior, concurrency and safe actual dispatch remain unverified until their selected evidence exists. F08/F15 stay open.

See the [3.1 permission baseline](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md), [completed 3.2 checkpoint](SECURITY_STAGE_3_2_CHECKPOINT_REPORT.md), [Stage 3 plan](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md) and [action register](SECURITY_AUDIT_CARRY_FORWARD.md).

