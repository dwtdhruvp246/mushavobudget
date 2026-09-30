# Business Stage 9 — reports

Release 4.9.24. Requires the completed Stage 8 migration. Business customer purchase and workspace creation remain closed; admin-granted test subscriptions continue to work.

## Reports

Reports have independent date, category, project/branch/department and currency filters. Current and previous periods follow the configured business period start day. Financial-year dates also use the configured financial-year start month. Custom bounds are inclusive; all dates removes the bounds.

The screen shows income received, actual company payments, unpaid commitments and the difference between received income and paid amounts. It also shows bills due and overdue, missing documents, employee claims, paid reimbursements, approved unpaid reimbursements, category/tag spending and budget comparisons. Each figure opens its exact source records, with totals covering every matching row even when the source list spans multiple pages. A source exposes stored amounts, currencies, rates, dates and record IDs; members can open the original item when their existing finance/claim/budget permissions allow it.

Actual payments use their payment date in the workspace timezone. Voided income is excluded. Employee-paid claims count as company payments only when reimbursed. Linked claims and requests do not duplicate a non-cancelled bill's commitment. Bill commitments use the outstanding balance and the bill's stored conversion; individual payments keep their own stored conversions.

Due and overdue classifications use today's workspace date and current unpaid balances. They are not historical balance reconstructions. Claim-register totals include every claim status and are informational, separate from actual spending. Missing-document checks distinguish expense receipts, supplier invoices (including fully paid bills) and individual payment proofs; an invoice does not replace payment proof. Archived/deleted documents do not satisfy the check.

Reporting-currency totals use saved conversion snapshots, never today's exchange rate. Original-currency totals require one currency. Budgets are compared only in reporting currency, using their full planned target and the selected dates intersecting the budget period; targets are not prorated. Different overlapping budget scopes must not be added together.

## Access and exports

SQL enforces active membership/subscription, account suspension, `reports.view` and `reports.export`. The Owner can configure report permissions under Team. Finance access permits workspace totals within existing scope; other eligible members see assigned tags and their own records. Staff remain restricted to their own records even if assigned tags or granted finance overrides, and cannot see company budgets through reports.

Report fingerprints include source rows, aggregate values, budget data, filters and scope metadata. Drill-down and export recompute the fingerprint and require a refresh if anything changed. Workspace changes clear reports and invalidate pending results and print windows.

CSV and printable reports include every matching source, not just the current page. Exports above 10,000 records are rejected with a request to narrow the filter. CSV preserves original/reporting amounts and conversion metadata, escapes quotes/newlines and neutralizes spreadsheet formulas in text cells. Numeric columns remain numeric. Exports record a retry-safe audit event without storing exported contents in the audit log.

Printable reports contain summary, scope/date/currency metadata, spending groups, budget comparisons and exact selected source records. Choose **Print / Save PDF**, then **Save as PDF** in the browser print dialog. This uses the browser's PDF output; it does not generate a separate server PDF.

## Deployment

Run the migration once in the Supabase SQL editor:

```powershell
git fetch origin feature/business-stage-9-reports
git show "FETCH_HEAD:supabase/migrations/20260930073000_business_stage_9_reports.sql" | Out-String | Set-Clipboard
```

After it returns `Success. No rows returned`, copy and run the read-only diagnostic:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_stage_9_reports_diagnostic.sql" | Out-String | Set-Clipboard
```

All **20 rows** should say **PASS** before merging/deploying the frontend. No new Edge Function deployment is needed.

## Verification

`npm test` covers regression checks and report period/filter rules. `scripts/verify-business-stage-9-sql.cjs` applies actual Stage 9 functions in a disposable PostgreSQL engine using Stage 2/5/6/7/8 fixtures. It verifies mixed currencies, partial payments, reimbursement timing, linked exclusions, scope/Staff privacy, receipt types, budget comparisons, all-page exports, the 10,000-row rejection, CSV escaping, stale fingerprints, suspension/expiry, internal grants and all 20 diagnostic checks.

```sh
MUSHAVO_PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node scripts/verify-business-stage-9-sql.cjs
```

The optional UI runner `scripts/verify-business-stage-9-ui.cjs` uses Playwright and Chromium to render the actual HTML/CSS/JavaScript with offline fixture responses. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to a directory containing Playwright and `MUSHAVO_CHROMIUM_EXECUTABLE` to Chromium. Checks cover desktop and phone widths, scrollable source dialogs, independent filters, CSV/print, safe record text, stale-data refresh, original-currency behavior and permission/workspace clearing.

Live testing should compare a known mixed-currency dataset with Reports, drill into each total, download CSV and save a PDF. Repeat with a scoped Team Manager, Staff, export permission revoked, changed source data and an expired/suspended workspace.
