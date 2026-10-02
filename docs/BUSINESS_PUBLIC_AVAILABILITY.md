# Business public availability — 4.9.29

Admin → Plans → Business → Availability → **Available for public purchase** is an editable sales switch. Review and publish after changing it. On: public Pricing and signed-in Subscription show configured Business rates and a purchase option. Off: they show Coming soon and block new purchases. Show on public Pricing separately controls whether the card is listed at all.

Before opening sales, enable Business subscription billing, set included seats, active currency, payment instructions, and at least one complete monthly/annual pair of base and extra-seat prices. Blank cycles stay unavailable. Zero is an intentional price. Every configured cycle needs both prices. The editor validates this, and deferred database constraints protect atomic saves. Prices mirror from Business billing settings to the existing catalogue; they have one authoritative editor.

Customers purchase from their owned Personal workspace. Family heads selecting Business are switched to Personal first. They enter a Business name, total seats (including Owner), cycle and payment details, with optional verified proof. Total = base + extra seats × that cycle's seat rate. Business annual extra-seat rates are annual, without Family's ×12 multiplier. Settings versions and amounts are checked server-side; repeated submission IDs do not duplicate purchases.

Payment remains pending until authorized finance staff approve it. Approval creates a separate Business workspace, Owner membership, existing foundation and permissions, workspace settings, active subscription, invoice/receipt and billing history. The paid term starts at approval and ends one calendar month/year later in UTC. Self-approval, inactive owners and suspended source workspaces are rejected. Rejection creates no workspace.

Closing new sales preserves existing subscriptions, purchased capacity, recorded prices and submitted invoices. Finance can approve a valid previously submitted purchase after sales close. Existing Owner renewal/extra-seat billing continues while Business subscription billing remains enabled. Legacy Personal/Family invitation setup cannot create Business workspaces: registered-account manual Business grants remain available to Super Admins.

## Deployment

Apply `supabase/migrations/20261002060000_business_public_availability.sql`, then `supabase/diagnostics/business_public_availability_diagnostic.sql` (25 PASS rows), before merging the frontend. The migration prepares checkout without automatically selecting availability for any plan. No Edge Function deployment is required.

```powershell
git fetch origin feature/business-public-availability
git show "FETCH_HEAD:supabase/migrations/20261002060000_business_public_availability.sql" | Out-String | Set-Clipboard
# Paste and run in Supabase SQL editor, then copy/run the diagnostic:
git show "FETCH_HEAD:supabase/diagnostics/business_public_availability_diagnostic.sql" | Out-String | Set-Clipboard
```

After deploying, configure Business billing and publish availability. Check public Pricing and Personal Subscription, submit a monthly/annual payment with an extra seat, review it through Admin Finance, and open the new Business workspace. Close availability and check Coming soon plus continued existing Owner billing. Database diagnostics check prerequisites; they do not replace these live acceptance checks.

## Verification

Repository tests plus `scripts/verify-admin-plans-sql.cjs`, `scripts/verify-admin-plans-ui.cjs`, `scripts/verify-business-public-sales-sql.cjs`, and `scripts/verify-business-public-sales-ui.cjs`. SQL scripts use disposable PostgreSQL/PGlite with production RPCs and relevant production triggers; they never connect to the live project. Browser scripts exercise the actual modules/HTML with offline RPC responses at desktop, 390px and 320px.
