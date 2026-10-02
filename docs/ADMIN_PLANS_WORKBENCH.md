# Admin Plans & Pricing — release 4.9.28

Admin → Plans now combines catalogue details, price versions, features, limits,
availability and history in one selected-plan editor. It supports real edits,
review before publishing, field validation, customer previews and protected
subscription calculations. Desktop uses a catalogue beside the editor; small
screens stack controls without horizontal scrolling.

## Connections

| Control | Source of truth | Where the result appears |
| --- | --- | --- |
| Name, description, marketing summary, recommendation, order and button text | `plans` | Public Pricing and signed-in Subscription catalogue |
| Personal/Family base price and Family monthly additional-person rate | `plan_prices` | Public pricing, purchase and renewal quotes, Family added-place quotes |
| Features | `plan_features` | Customer plan comparison; `finance.analytics` also controls Personal/Family finance access |
| Active payment limit | `plan_limits` | Personal payment access rules; Free remains five active payments |
| Included people | `plan_limits` | Catalogue and new subscription quotes; purchased workspace capacity remains recorded separately |
| Pilot cycles, currency, base/seat prices, instructions and included seats | `business_billing_settings` | Existing Business Owner billing page and its protected quote/payment workflow |
| Public visibility / purchase availability | `plans` plus existing release gates | Public catalogue and purchase controls |
| Price cancellation / audit history | Price versions and `subscription_audit_events` | Selected plan → History |

Other feature flags describe available product tools. They do not create new
authorization controls for every module. Business operating permissions remain
under Team. Public Business purchase and workspace creation remain closed.

The editor uses four role-checked RPCs: snapshot, atomic save, future-price
cancellation and calculation preview. Super Admin and Admin Staff can use them;
Finance Staff, customers and suspended administrators cannot. Stale snapshots
cannot overwrite newer settings. Failed saves roll back the whole bundle.

Personal/Family catalogue changes participate in existing app refresh/realtime
handling. Business billing edits emit the existing workspace change signal so
the Owner billing snapshot can refresh. Draft editor entries survive background
reloads and failed saves. In-flight writes participate in the PWA operation guard.

## Subscriber policy

- Feature access and active payment limits apply to current subscribers on their
  next access refresh. The publish review explicitly states this consequence.
- New prices apply to new purchases and renewal quotes from their effective
  date. Future prices remain hidden until that date. Cancelling a future price
  restores the preceding price's open end date.
- Paid-through dates, purchased seats, existing invoices, submitted payment
  amounts and operational finance records are not rewritten by catalogue edits.
- Business billing changes invalidate unsubmitted quotes through their settings
  version. Already submitted payment amounts retain their recorded values.
- Unaccepted Family added-place quotes use the applicable price at quote time;
  catalogue price changes do not change an existing invoice.

The actual Family quote and admin preview share UTC purchase-anchored calendar
month arithmetic. The current month is excluded from remaining full months.
Before its midpoint it adds half a month; at/after midpoint it adds none. For an
annual term starting May 20, the four agreed examples yield factors 11.5, 11,
10.5 and 9. Business additions retain the existing remaining-time proration rule.

## Deployment

1. Fetch `feature/admin-plans-workbench`.
2. Run `supabase/migrations/20261001190000_admin_plans_workbench.sql` in the
   project's SQL editor. This is transactional and includes schema reload.
3. Run `supabase/migrations/20261002042500_reconcile_business_plan_seats.sql`
   to align legacy Business catalogue seats with their private billing settings.
   This preserves configured/unset settings and purchased workspace seats.
4. Run `supabase/diagnostics/admin_plans_workbench_diagnostic.sql`. All 22 rows
   should say PASS. Resolve any failure before merging the frontend.
5. Merge the PR after the diagnostic passes. GitHub Pages includes
   `admin-plans.js`; release/cache references advance to 4.9.28.
6. Refresh the app and open Admin → Plans. No Edge Function deployment is needed.

## Verification and live acceptance

Repository tests cover existing workflows and catalogue validation. Disposable
PostgreSQL runs the actual protected catalogue/billing functions and the 22-row
diagnostic. Browser suites use actual modules, HTML and CSS with explicit offline
RPC responses at 1366, 390 and 320 px. They exercise price editing, scheduling,
cancellation, Business validation, preview/calculation, draft retention, stale
selection isolation, role restrictions and the full app's panel/data-loader wiring.
The existing Business Owner billing SQL/UI suites are also retained.

These checks do not verify production credentials or live Supabase RLS/realtime
delivery. After deployment, use a test plan/workspace to check:

1. Change a plan name/summary and verify public Pricing and signed-in Subscription.
2. Schedule a price; verify the current price remains visible, then cancel it in History.
3. Try incomplete Business pilot settings; verify field errors before any save.
4. Save valid pilot settings; refresh the test Owner billing page and request a quote.
5. Confirm recorded invoices, expiry dates and purchased member capacity stay intact.
6. Check desktop/mobile dialogs and a Finance Staff account's lack of plan-edit access.

Do not use a production plan's feature or limit settings solely for testing: those
changes affect current subscribers as stated in the publish review.
