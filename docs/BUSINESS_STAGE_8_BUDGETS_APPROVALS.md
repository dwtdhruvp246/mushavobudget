# Business Stage 8 — budgets and spending approvals

Release: 4.9.23. Requires the completed Stage 7 database migration. Business pricing and public purchase remain closed while the product is built; admin-granted test subscriptions work as before.

## Behavior

- Create monthly budgets using the business period start day, or custom inclusive date ranges. Each budget can cover all expense categories or one category, and the workspace or one project, branch or department tag. Amounts use the workspace reporting currency.
- Save drafts, activate a target, close it with a reason, and archive it with a reason. Active targets cannot be edited. Identical category/tag scopes cannot have overlapping active periods. Different scopes can overlap and must not be added together.
- Show planned amount, actual company payments, unpaid commitments, remaining before commitments and available after commitments. Negative available amounts remain visible. Warn at 80%; show over target above 100%. These are planning warnings, not payment blocks.
- Requests start as editable drafts with a purpose, original currency, amount and planned purchase date. Submission locks editing. Another authorized reviewer can approve, reject or request changes. Rejection and change requests require reasons. The submitter can revise and resubmit, or cancel an eligible unlinked request with a reason. Owners cannot review their own requests.
- Approved requests reserve spending without counting as payments. Finance can create one supplier bill from an approved request. The bill preserves its amount, currency, category, tag and approved conversion snapshot; it replaces the request commitment. Individual payments reduce its unpaid commitment and count once as actuals. Full payment marks the request fulfilled. Cancelling an unpaid linked bill restores the approved request commitment.
- Request decisions notify the submitter and retain an audit history. Existing bill payment references and proof attachments remain available. Spending-request attachments are not introduced here.
- Owners can enable or disable approval view/review and budget view/manage permissions for Team Managers, Finance Managers and Staff under Team. Member overrides and assigned tag scopes still apply. Only explicitly scoped non-finance members can view budget totals; granting budget access alone never exposes workspace-wide figures.

## Financial rules

Budget sources are approved unlinked requests dated by planned purchase date, approved unpaid claims dated by expense date, outstanding bills dated by due date, and actual company payments dated in the workspace timezone. Linked claims and requests are excluded while a non-cancelled bill exists. Employee-paid costs become company actuals only when reimbursed. Budget detail shows the exact sources, with server totals covering every matching source regardless of pagination.

Original amounts and currency conversions are stored with each financial record. The linked bill uses the approved request's conversion for its outstanding commitment. Actual payments retain their own conversion snapshot at payment time, so exchange-rate changes may make final reporting-currency spending differ from the approved estimate. Budgets and requests also prevent changing the reporting currency. Existing posted finance cannot be edited through this workflow. Scope, active subscription, account suspension and self-approval rules are enforced in PostgreSQL. Clients receive read-only tables through forced RLS and perform changes through restricted RPCs.

## Deployment

1. Fetch `feature/business-stage-8-budgets`.
2. Run `supabase/migrations/20260930060000_business_stage_8_budgets_approvals.sql` once in the Supabase SQL editor.
3. Run `supabase/diagnostics/business_stage_8_budgets_approvals_diagnostic.sql`. All **26 rows** should be PASS.
4. Merge and deploy the frontend after the diagnostic passes. No new Edge Function deployment is needed.

PowerShell clipboard commands:

```powershell
git fetch origin feature/business-stage-8-budgets
git show "FETCH_HEAD:supabase/migrations/20260930060000_business_stage_8_budgets_approvals.sql" | Out-String | Set-Clipboard
```

After running that SQL:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_stage_8_budgets_approvals_diagnostic.sql" | Out-String | Set-Clipboard
```

## Verification

Run `npm test` for regression checks. The optional SQL integration runner uses a disposable PostgreSQL engine, actual Stage 2/5/6/7/8 functions and a controlled exchange-rate fixture. It does not connect to Supabase:

```sh
npm install --prefix /tmp/mushavo-sql-check --ignore-scripts --no-audit --no-fund @electric-sql/pglite@0.5.8
MUSHAVO_PGLITE_MODULE=/tmp/mushavo-sql-check/node_modules/@electric-sql/pglite node scripts/verify-business-stage-8-sql.cjs
```

The optional UI runner `scripts/verify-business-stage-8-ui.cjs` needs Playwright and Chromium. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to a directory containing Playwright and optionally `MUSHAVO_CHROMIUM_EXECUTABLE` to an installed Chromium binary. It renders the actual HTML/CSS/JavaScript with fixture RPC responses at desktop and phone sizes, and verifies request/budget forms, reviewer actions, permission visibility and dialog scrolling.

Manual checks: create monthly and custom scoped targets; reject an identical overlapping active target; verify warning and over-target figures. Submit a request, request changes, resubmit and approve using another member. Link a bill, make partial and final payments, and verify that request/bill/payment sources count once. Test Staff privacy, scoped Team Manager access, delegated review, Owner self-approval rejection, another workspace, expired subscription and suspended account. Verify workspace switching clears the request/budget details. Formal reporting and exports remain Stage 9.
