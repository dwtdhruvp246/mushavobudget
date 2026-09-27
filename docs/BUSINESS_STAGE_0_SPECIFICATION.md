# Mushavo Budget Business — Stage 0 specification

Status: approved foundation specification  
Release stage: `stage_0`  
Customer purchase: disabled  
Customer workspace creation: disabled

## Purpose and launch gate

Stage 0 makes the unfinished Business product safe to keep visible while its dedicated application is built. Business is industry-neutral and will reuse the existing Mushavo account, but Business records must remain completely separate from Personal and Family workspaces.

At Stage 0:

- Business is marked **Coming soon** in public and signed-in plan catalogues.
- Public Business prices and included-seat counts are not disclosed.
- No customer, administrator invitation, approval workflow, or direct insert may create a Business subscription or Business workspace.
- Pricing, included seats, and additional-seat prices remain configurable by administrators for later approval.
- Personal and Family purchasing, invitations, subscriptions, and records are unchanged.

Business must not be opened to customers by changing a button alone. A future release migration must deliberately enable both launch controls after the Business application, permission model, pricing, and operational checks are complete.

## Non-goals for the first Business release

Payroll, tax filing, inventory, medical billing, regulated accounting, banking, automated money transfers, and industry-specific workflows are outside the first release. Cash-flow forecasting follows the reliable recording of actual income, expenses, bills, and payments.

## Data model

Existing shared foundations will be reused: `budget_workspaces`, `workspace_members`, `workspace_invitations`, `workspace_settings`, plans, prices, subscriptions, currencies, and exchange-rate snapshots.

Stage 2 should add the following Business-owned records. Names are architectural targets and may be refined in their implementation migration.

| Area | Planned records | Required relationship |
|---|---|---|
| Identity | Business profile and settings | Exactly one active profile per Business workspace |
| Access | Role permissions, member overrides, member scopes | Member and scope must belong to the same workspace |
| Organisation | Teams, projects, branches, departments, cost centres | Each unit belongs to one workspace and may be archived |
| Classification | Business categories | Workspace-owned, typed for income or spending |
| Counterparties | Suppliers and other counterparties | Workspace-owned; financial history survives archival |
| Spending | Expenses, claims, reimbursements, allocations | Submitter, payer, approver and allocations are workspace-scoped |
| Bills | Bills, recurring bill rules and bill payments | Payments link to one bill and never duplicate expense totals |
| Requests | Spending requests and decisions | Every decision records actor, time and reason |
| Income | Income receipts and allocations | Only received income enters actual totals |
| Budgets | Budgets and budget lines | Lines target workspace categories or organisation units |
| Documents | Receipt and proof metadata | Private object path is workspace-scoped |
| Audit | Immutable audit events | Append-only actor, action, record, before/after metadata |

Every Business record must contain `workspace_id`. Every foreign-key relationship must reject cross-workspace references in the database. Client-side filtering is not a security boundary. Posted financial records are not hard-deleted; cancellation, reversal, or voiding preserves their audit history.

## Roles and permission matrix

Permissions are enforced by Supabase RLS and protected database functions, not only by hidden controls.

| Capability | Owner | Business Admin | Finance Manager | Team Manager | Staff | Viewer / Auditor |
|---|---:|---:|---:|---:|---:|---:|
| Subscription and billing | Full | No | No | No | No | No |
| Ownership transfer | Full | No | No | No | No | No |
| Configure workspace | Full | Configurable | No | No | No | No |
| Invite or remove members | Full | Only with `team.manage` | No | Scoped team only if granted | No | No |
| Configure roles and permissions | Full | Configurable, never ownership/billing | No | No | No | No |
| Record income, bills and company expenses | Full | Configurable | Full | Scoped if granted | Own/assigned only | Read only if granted |
| Submit own claim or request | Full | Yes | Yes | Yes | Yes | No |
| Approve claims and requests | Full, except own | Configurable, except own | Configurable, except own | Scoped, except own | No | No |
| Record payments and reimbursements | Full | Configurable | Full | No unless granted | No | No |
| View company-wide totals | Full | Configurable | Full | No | No | Only if explicitly granted |
| Reports and export | Full | Configurable | Full | Scoped | Own/assigned only | Read/export only if granted |
| Audit history | Full | Configurable | Configurable | Scoped | Own actions | Explicitly granted scope |

Binding rules:

- Only the Owner manages subscription, paid-through dates, seat quantity, and billing.
- A Business Admin may invite people only when the Owner grants `team.manage`.
- Nobody may approve their own claim, expense, or spending request.
- Staff never receive company-wide financial totals through UI, RPC, view, or RLS access.
- Finance Managers cannot change the plan, Owner, billing dates, or ownership.
- Removing or suspending a member revokes Business data access immediately without deleting that member's historical activity.

## Record statuses and transitions

Transitions must be validated in protected database functions. Arbitrary client updates are not allowed.

| Record | Statuses | Core transition rule |
|---|---|---|
| Workspace | `active`, `suspended`, `closed` | Suspended is read-blocked except Owner recovery; closed is terminal operationally |
| Subscription | `active`, `expired`, `suspended` | Only an approved billing action activates or extends access |
| Invitation | `pending`, `accepted`, `declined`, `cancelled`, `expired` | Only pending invitations consume reserved capacity |
| Expense / claim | `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, `partially_paid`, `paid`, `voided` | Submitter can edit draft/changes requested; approval and payment are distinct |
| Supplier bill | `draft`, `open`, `partially_paid`, `paid`, `overdue`, `voided` | Overdue is derived from due date and remaining balance |
| Spending request | `draft`, `submitted`, `changes_requested`, `approved`, `rejected`, `cancelled`, `committed`, `fulfilled` | Approval creates a commitment, not an actual payment |
| Income | `received`, `voided` | Expected income is not an actual and belongs to a later forecasting model |
| Budget | `draft`, `active`, `closed`, `archived` | One period/scope may have an explicit active budget version |

## Financial calculation rules

1. **Actual income** includes only non-voided income with status `received`.
2. **Actual paid spending** includes company payments and reimbursements that were actually paid and not reversed or voided.
3. **Committed spending** is reported separately and includes approved unpaid requests and the outstanding portion of open bills.
4. **No duplicate counting:** a request may lead to a bill and a bill to one or more payments, but actual spending is counted from the payment layer once. The linked request and bill supply context and commitment balances.
5. **Partial balances:** `outstanding = greatest(record_total - valid_paid_amount, 0)`. A record is paid only when outstanding is zero within the currency's rounding precision.
6. **Multi-currency:** every transaction stores its original amount and currency. Reporting values use an immutable conversion-rate snapshot, source, captured time, and workspace reporting currency. Later rate changes do not rewrite historical reports.
7. **Corrections:** posted finance is reversed or voided with a reason and actor. It is never silently overwritten or hard-deleted.
8. **Dates:** store event instants in UTC and business dates separately; interpret business periods and overdue rules using the workspace timezone.
9. **Documents:** receipts and proofs are private. Access follows the linked record's workspace and permission scope.
10. **Traceability:** every dashboard and report total must open the exact source records and filters used to calculate it.

## Expiry and suspension

When a Business subscription expires, all Business records are preserved. The Owner is redirected to a locked renewal experience containing plan, amount, payment instructions, and billing history; the Owner cannot use operational finance screens. Other members see: “This Business subscription has expired. Contact the Business Owner.” Mutations, invitations, reminders, approvals, and exports stop.

When the platform suspends a Business workspace or member, access stops immediately. The screen states that access is suspended and directs the affected person to the Business Owner or Mushavo support as appropriate. Suspension preserves financial records, membership history, approvals, and audit events. Only authorized recovery actions remain available.

## Stage 0 acceptance checklist

- [x] Business is visibly marked Coming soon.
- [x] Business purchase, renewal request, payment approval, invitation, and workspace creation paths are blocked in the database.
- [x] Public catalogue returns no Business prices or currencies while locked.
- [x] The historical six-seat assumption is removed and the Business seat limit is unset.
- [x] Administrators retain configurable pricing and seat fields for a future approved launch.
- [x] Roles, permissions, statuses, financial calculations, expiry, and suspension are specified.
- [x] Personal and Family behaviour is covered by regression tests and is not changed by the Stage 0 migration.

## Deferred launch decisions

Public Business prices, included seats, additional-seat prices, any free trial, payment-provider automation, and the release date remain undecided. They require explicit approval before the launch controls can be enabled.
