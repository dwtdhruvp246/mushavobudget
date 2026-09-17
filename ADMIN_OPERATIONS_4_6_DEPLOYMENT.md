# Mushavo Budget Admin Operations 4.6

This release implements the approved Admin Operations stages:

- compact two-column Dashboard metrics on every phone width;
- active and paid workspace counts for Personal, Family, and Business;
- compact two-column Enquiry metrics on every phone width;
- private admin bell notifications and optional Web Push;
- security, regression, diagnostics, and rollback controls.

CurrencyAPI recovery is deliberately excluded. This release does not change
`sync-exchange-rates`, its secret, its schedule, or its cached rate data.

## Admin notification events

The initial event catalogue contains:

| Event | Recipients | Destination |
| --- | --- | --- |
| Subscription payment submitted | Super admin, admin staff, finance staff | Finance |
| Customer support ticket created | Super admin, admin staff, support staff | Support |
| Public website enquiry created | Super admin, admin staff, support staff | Enquiries |

Customer Personal, Family, and Business budget-payment records never create
platform-admin notifications.

## Release markers

- Application: `app.js?v=68`
- Stylesheet: `styles.css?v=54`
- Displayed version: `4.6.0`
- Service worker: `pwa-shell-v24`

## Controlled deployment order

Do not activate the new Cron job until the migration and Edge Function have
both been deployed and verified.

1. Pull the reviewed release from `main`.
2. Run `supabase/migrations/20260916190000_admin_event_notifications.sql`
   in the Supabase SQL Editor.
3. Run `supabase/admin-operations-4-6-diagnostic.sql`.
   - The structural checks must all be `true`.
   - Duplicate idempotency keys must be `0`.
   - `admin_notification_cron_active` is expected to be `false` before step 6.
4. Deploy the protected dispatcher:

   ```powershell
   npx.cmd supabase functions deploy dispatch-admin-notifications --use-api
   ```

5. Confirm a public request is rejected:

   ```powershell
   try {
       Invoke-WebRequest `
           -Uri "https://kttkospkblwvguuwnhjj.supabase.co/functions/v1/dispatch-admin-notifications" `
           -Method Post `
           -ContentType "application/json" `
           -Body '{"source":"cron"}' `
           -UseBasicParsing
   } catch {
       "HTTP status: $([int]$_.Exception.Response.StatusCode)"
   }
   ```

   Expected: `HTTP status: 401`.

6. Run `supabase/cron-admin-notifications.sql` in the SQL Editor. It reuses the
   existing project URL and protected push Cron secret already stored in Vault.
7. Run the diagnostic again. `admin_notification_cron_active` must now be
   `true` and the schedule must be every five minutes.
8. Allow the normal Cloudflare web release to publish Version 4.6.0.

## Live verification

1. Open the admin account and confirm Dashboard and Enquiries show two metric
   cards per row at 320px, 360px, 390px, and 430px widths.
2. Open Workspaces and compare the Personal, Family, and Business paid counts
   with the active subscription records.
3. Open the admin bell and enable notifications on the admin device.
4. From a test customer account, submit one subscription payment for review.
5. Confirm the admin bell updates and the optional push opens Admin Finance.
6. Create one customer support ticket and confirm its alert opens Admin Support.
7. Submit one public enquiry and confirm its alert opens Admin Enquiries.
8. Confirm marking an alert read updates the unread badge.

## Rollback

Run `supabase/rollback-admin-notifications.sql` to stop the new Cron job and
remove the new triggers, protected functions, and delivery queue. Existing
in-app notification rows are intentionally retained as an audit trail.

The previous web release can then be restored independently. The customer
payment-reminder queue and `dispatch-push-reminders` remain untouched throughout.
