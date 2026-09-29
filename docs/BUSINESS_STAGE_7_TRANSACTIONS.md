# Business Stage 7 — received income and transaction activity

Release: 4.9.22. Requires the completed Stage 6 database migrations. Business public purchase and customer workspace creation remain closed; admin-granted test subscriptions continue to work.

## Included

- Record actual received income with original currency, received date, payer, reference, payment source, category and optional assigned project/branch/team.
- Income records capture the conversion rate and reporting amount at recording time. Posted records cannot be edited or deleted; finance payment roles may void with a reason, preserving the original record and audit trail. Voided income is excluded from actuals.
- One paginated activity feed combines income, company expenses, employee-paid costs, reimbursements, open/cancelled bills and individual bill payments. Search, type, status, original currency, category, tag, inclusive date range and payment-source filters run on the server. Summary totals cover every matching record, not only the displayed page.
- Record the employee's personal funding source on reimbursement drafts and the company's funding source when paying an expense or bill. Historical records show “Not recorded (legacy)” rather than inventing a source.
- Received income and actual company payments remain separate from unpaid commitments. Employee-paid costs become company payments only when reimbursement is recorded. Approved claims linked to a non-cancelled bill are excluded so their bill and payments are counted once.
- Overview and basic Reports show all-recorded-date totals. Activity filters do not alter these totals. These are not a profit report, bank balance or budget report.

## Access and safeguards

Income requires active Business membership, the finance-view/create permissions, and the assigned scope. Income voiding also requires the record-payment permission. Staff retain their own expense/claim access but receive no company income or company-wide totals. Existing approval and payment rules remain enforced by the Stage 5/6 RPCs. Client tables remain read-only, with forced RLS. Expired/suspended accounts cannot bypass those checks.

Income and bill-payment retry IDs return an already recorded financial action without duplicating it or rewriting its funding source. Currency changes are blocked once any claim, bill, schedule or income exists. Activity dates use the workspace timezone.

## Deployment

1. Fetch `feature/business-stage-7-transactions`.
2. Run `supabase/migrations/20260929193000_business_stage_7_transactions.sql` once in the Supabase SQL editor.
3. Run `supabase/diagnostics/business_stage_7_transactions_diagnostic.sql`; all 16 rows should PASS.
4. Merge and deploy the frontend only after the diagnostic passes. No new Edge Function deployment is required; retain Stage 6's deployed reminder dispatcher.

Manual checks: owner records income and retries the same request; void and verify actuals fall while history remains. Test two currencies with stored conversion rates, own employee claim/reimbursement, partial supplier payments, linked claim/bill exclusion, filters and pagination beyond 50 records. Verify Staff, scoped Finance, another workspace, expired membership and suspended account cannot access prohibited records. Confirm dialogs scroll on mobile and desktop. Income receipt-file attachments are not introduced in this stage; existing expense and bill proofs remain supported.

Budgets and spending-request controls remain Stage 8; formal reports/export remain Stage 9. Pricing will be decided later.
