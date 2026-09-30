# Business Stage 10 — subscription, capacity and expiry

Release 4.9.25. Requires the completed Stage 9 migration. Business public purchase and customer workspace creation remain closed. This stage enables billing only for existing Business workspaces when a platform admin explicitly configures private pilot billing.

## Configuration and quotes

Admin → Plans → Business pilot billing configures included seats, billing currency, monthly/annual base prices, monthly/annual **full-cycle** additional-seat prices and payment instructions. All prices and included seats start unset, and pilot billing starts disabled. No old Business catalogue price or six/ten-seat assumption is adopted. Existing accepted members and live invitations retain enough stored capacity during migration. Admin manual grants use configured included capacity when available and do not create payment receipts.

Leave undecided prices blank. Zero is an intentional configured price, not an unset value. Enable a monthly or annual cycle only when both its base and extra-seat price are supplied. Public plan availability stays closed. Settings changes are versioned and audited; stale quotes must be regenerated before submission. Submitted payments retain their accepted amount when settings subsequently change.

Only the current Business Owner with an active account and Owner membership can view billing history, request quotes or submit payments. Private quotes expire after 30 minutes. One payment review may be pending per workspace. Submission retries use the same quote and payment UUID and do not create duplicate invoices.

Additional seats match the subscription's existing monthly/annual cycle. The charge is:

`extra seats × full-cycle extra-seat price × remaining term seconds ÷ full term seconds`

The result is rounded to currency cents once, using the quote time. Exact stored timestamps account for different month lengths and leap years. This is separate from Family's half-month rule. For example, with 20 of 30 days remaining, two seats at $5 per monthly cycle cost $6.67. At 355 of 365 annual days remaining, one seat at $50 per annual cycle costs $48.63. The quote shows its full-cycle rate, remaining days/fraction, total, currency and unchanged expiry date. Approval adds capacity without extending the term. Expired subscriptions must renew rather than buy mid-term seats.

Renewal charges the configured full-cycle base plus extra seats above the included quantity. Seat totals include the Owner and must cover active members and unexpired pending invitations. Removing a member releases capacity but does not trigger an automatic refund. Unused seats remain available until the term ends.

## Early renewal

An active subscription's next term starts at its current expiry. An expired subscription's new term starts at approval, so waiting for payment review does not consume the new term. Monthly terms add one calendar month; annual terms add one calendar year, using UTC calendar arithmetic. The activation date remains visible separately from the current billing anchor.

Early renewal schedules the new seat quantity for the next term; it does not immediately remove current seats. Invitation capacity reserves the smaller current/next quantity, preventing overbooking before a scheduled reduction. The effective capacity changes automatically at the stored boundary, without a cron job.

One future renewal can be paid ahead. Further renewal or extra-seat purchases are blocked until that next term starts; the screen explains this restriction. This avoids quoting across two prepaid terms with different cycles/prices. Reject an unapproved request through the admin payment-review workflow before submitting a replacement. An admin manual grant clears a previously scheduled capacity change and resets the billing anchor.

## Payments, receipts and review

Owner → Subscription & Billing shows activation, cycle, paid-through date, countdown, current seats, reservations and any scheduled quantity. Renew or purchase seats to obtain a server quote, then submit payment method/date/reference, notes and optional proof. Payment proof accepts JPG, PNG, WEBP or PDF up to 10 MB; the server checks workspace/Owner path and actual private storage metadata. No-charge requests still need admin review and do not accept payment proof.

Admin → Finance uses the existing subscription payment queue. Business payment details include the protected quotation, request kind, full-cycle seat price, fraction and term dates. Approval rechecks the Owner, account/workspace suspension, unchanged subscription version/term, and capacity including live reservations. An Owner who is also platform staff cannot approve their own payment. Rejection requires a reason. Reviewed payments, unique receipt numbers, entitlement history, notifications and audit events remain stored. Existing admin reporting conversions continue through the existing payment triggers.

Owners can page through invoice/payment history, view private proofs and print approved receipts using browser Save as PDF. Pending payment never grants access or seats. A payment whose term or capacity changed cannot be approved silently; admin must reject it with a reason and arrange a fresh request or an appropriate payment resolution. There are no automatic transfers or refunds.

## Expiry and suspension

Expired Owners load access metadata and billing only. Operational finance screens and actions stay locked until approval. Other members see: “This Business subscription has expired. Contact the Business Owner.” They cannot access Owner billing or operational Business data. Records remain stored, and renewal restores role-based access.

Backend finance, approvals, reports, exports and invitation gates require an active subscription. Team snapshots now require active access too. The client checks local expiry every 15 seconds, clears operational data/dialogs on locking, refreshes account/workspace/membership access every minute and on returning to the tab, and reloads operational data after renewal. Failed/offline access checks do not weaken server permissions. Existing Business reminder dispatch still checks active subscription and suspension.

Suspension has a separate screen/message. Owners may inspect billing, but cannot quote or submit while the workspace/subscription is suspended. Approval cannot remove workspace, subscription or Owner-account suspension. A suspended user account loses all Business access. Only an administrator can restore the suspended state.

Personal and Family billing review delegates to the preserved implementation. Shared subscription write restrictions and proof guards apply to Business; operational Business finance records are not edited by billing.

## Deployment

Copy and run the migration in Supabase SQL Editor:

```powershell
git fetch origin feature/business-stage-10-billing
git show "FETCH_HEAD:supabase/migrations/20260930090000_business_stage_10_billing.sql" | Out-String | Set-Clipboard
```

Expected: `Success. No rows returned.` Then copy and run the read-only diagnostic:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/business_stage_10_billing_diagnostic.sql" | Out-String | Set-Clipboard
```

All **25 rows** should say **PASS** before merging/deploying the frontend. No new Edge Function deployment is required. After deployment, the admin may leave pilot billing disabled or deliberately supply test settings. Existing manual test grants continue to work.

## Verification

`npm test` covers regressions, Owner/role expiry locks, missing versus zero prices and out-of-order billing responses. The disposable PostgreSQL runner applies actual Stage 10 SQL and verifies private configuration, monthly/annual/leap-year proration, quote and proof validation, duplicate-safe submission/review, accepted prices, no-charge requests, self-review protection, pending reservations, future capacity, expiry/suspension, client write restrictions, legacy review delegation and all 25 diagnostics.

```sh
MUSHAVO_PGLITE_MODULE=/path/to/node_modules/@electric-sql/pglite node scripts/verify-business-stage-10-sql.cjs
```

The offline Playwright runner `scripts/verify-business-stage-10-ui.cjs` renders actual HTML/CSS/JavaScript at desktop and phone widths. Set `CODEX_PRIMARY_RUNTIME_NODE_MODULES` to a directory containing Playwright and `MUSHAVO_CHROMIUM_EXECUTABLE` to Chromium. It tests quote/payment/proof submission, unchanged pending capacity, receipt printing, safe text, Owner/Staff expiry paths, suspension, dialog scrolling and workspace clearing.

Live pilot checks: configure deliberate test prices, obtain an extra-seat quote partway through a monthly/annual term, approve it using another admin, and verify the same expiry. Renew with a lower quantity that still covers active members and pending invitations; verify the future quantity/reservation limit. Test expired Owner versus Staff, rejection with reason, suspension during review, proof access, and renewal restoring operational access. Broader admin support controls remain Stage 11; pilot and realtime testing remain Stage 12.
