# Stage 6 — Analytics data foundation (release 4.8.0)

Stage 6 records active hours for signed-in users and prepares an admin-only
analytics query. Stage 7 will use that query to build the Admin Analytics page.
No external analytics service or API key is needed.

## Deploy in this order

1. In the **Mushavo Budget** Supabase project, open **SQL Editor** → **New query**.
2. Copy the entire contents of
   `supabase/migrations/20260924100000_analytics_data_foundation.sql` into the query.
   Run it **once**. The result should say `Success. No rows returned`.
3. Run the read-only checks below. Every privilege test should return `true`.
4. Merge the Stage 6 pull request into `main`. Cloudflare Pages then deploys
   release 4.8.0. The Android APK remains on its separately packaged code until
   the Capacitor branch is rebuilt and reinstalled.
5. Sign in using an ordinary completed account, leave the app visible, and run
   the final activity check below in SQL Editor. The count should be at least 1.
   The admin dashboard does not show these figures yet; that is Stage 7.

The app tolerates a missing migration without breaking login, but its activity
requests will fail until the SQL is installed. Deploy the database first.

```sql
select
  to_regclass('public.analytics_activity_hours') is not null as table_exists,
  to_regprocedure('public.record_my_analytics_activity()') is not null as activity_rpc_exists,
  to_regprocedure('public.admin_analytics_foundation(date,date)') is not null as admin_rpc_exists,
  (select relrowsecurity from pg_class where oid = 'public.analytics_activity_hours'::regclass) as rls_enabled,
  not has_table_privilege('authenticated', 'public.analytics_activity_hours', 'SELECT') as no_direct_activity_read,
  not has_column_privilege('authenticated', 'public.profiles', 'signup_source', 'UPDATE') as signup_source_protected,
  not has_column_privilege('authenticated', 'public.profiles', 'admin_invitation_id', 'UPDATE') as invitation_link_protected,
  has_function_privilege('authenticated', 'public.record_my_analytics_activity()', 'EXECUTE') as activity_rpc_available,
  has_function_privilege('authenticated', 'public.admin_analytics_foundation(date,date)', 'EXECUTE') as admin_rpc_available;
```

After signing in, check activity without selecting identities:

```sql
select count(*) as recorded_user_hours_today
from public.analytics_activity_hours
where hour_start >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
```

`admin_analytics_foundation` requires a signed-in app administrator. Calling it
directly from SQL Editor lacks the user's Auth context and correctly returns
`ADMIN_REQUIRED`. Stage 7 will call it from the protected admin interface.

## Meaning of the numbers

- **New users**: completed admin invitations at completion time, and other
  accounts at profile creation time. Historical self signups may predate this
  release; unfinished admin invitations are excluded.
- **Active users**: distinct accounts with an activity record in the requested
  date range. Tracking begins after the web release; older activity cannot be
  reconstructed. The site reports a visible session hourly, not each click.
- **Country**: chosen at signup or set on the admin invitation. Existing
  accounts without one are listed under `unknown`. Browser language and IP do
  not determine a user's country.
- **Collected revenue**: approved subscription payments, dated when approved
  (or when last updated if no approval row exists), grouped by original
  currency. Pending or rejected payments and historical legacy notes are not
  included. Amounts in different currencies are never summed together.
- **Monthly run rate**: active paid workspaces with a paid invoice for their
  current plan. The latest invoice amount is divided by 12 for annual plans;
  this is an estimate, not cash collected or a forecast of renewals.
- **Operational totals**: current invitation, review, subscription-expiry,
  and exchange-rate statuses. These are point-in-time values, not date-filtered
  historical series.

Only the signed-in account ID and activity hour are retained for activity
counts; the table cascades on account deletion. No IP address, device ID,
page URL, payment notes, payment reference, or browser fingerprint is stored.
Access to raw activity rows is closed even to authenticated users. The report
function checks `is_app_admin()` before returning grouped results.
