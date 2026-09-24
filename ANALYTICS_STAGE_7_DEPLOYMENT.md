# Stage 7 — Admin Analytics (release 4.9.0)

## Deployment order

1. In the Mushavo Budget Supabase SQL Editor, run the entire contents of
   `supabase/migrations/20260924110000_admin_analytics_page.sql` once. Expect
   `Success. No rows returned`.
2. Check the new function and its permissions with the SQL below.
3. Merge the Stage 7 pull request. Wait for the Cloudflare Pages release,
   then reopen the Admin console and confirm Version 4.9.0.
4. Open Analytics. Check the default 30-day report, then change country, plan,
   workspace, billing, status, and currency filters. Reset filters afterwards.
5. Compare registered and active users with Stage 6 results when no category
   filter is selected. Use View data for precise counts. Check one approved
   subscription payment in Finance against its currency breakdown here.

```sql
select
  to_regprocedure('public.admin_analytics_page(date,date,text,text,text,text,text,text)') is not null as rpc_exists,
  has_function_privilege('authenticated', 'public.admin_analytics_page(date,date,text,text,text,text,text,text)', 'EXECUTE') as authenticated_can_call,
  not has_function_privilege('anon', 'public.admin_analytics_page(date,date,text,text,text,text,text,text)', 'EXECUTE') as anonymous_cannot_call,
  not has_table_privilege('authenticated', 'public.analytics_activity_hours', 'SELECT') as raw_activity_is_private;
```

All four checks should return `true`. The function checks the app admin role
before returning aggregate data, so an ordinary authenticated account cannot
read the report despite having permission to call the function.

## Metric notes

- UTC dates are inclusive. Seven, 30, and 90 days show daily points; 12 months
  and all time show monthly points. All time starts on 2020-01-01, earlier than
  the launch of Mushavo Budget.
- Country filters registered users directly. Plan, workspace, subscription,
  billing, and currency filters restrict users to owners of matching workspaces.
  Payments and workspace totals use those same matching workspaces.
- Registered users exclude unfinished admin invitations. Active users count
  distinct accounts with a recorded visible session in the selected period.
  Activity before Stage 6 was not recorded and cannot be reconstructed.
- Collected revenue includes only approved subscription payments within the
  selected period, dated when approved. Different original currencies are
  always shown separately. The combined reporting total includes only same
  currency payments or payments with a locked conversion; missing conversions
  are called out instead of silently using current exchange rates.
- Monthly run rate estimates the current paid invoice amount for each active
  paid workspace. Annual paid invoices are divided by 12. It is distinct from
  cash collected.
- Operational health and the invitation funnel are current platform-wide
  counts. These do not respond to date or category filters. The rest of the
  report uses the selected filters, except current activity windows and other
  snapshot metrics, which use the chosen account/workspace scope but not the
  selected date range.

The report has no direct raw activity query from the browser. User names,
emails, receipt details, payment references, and auth data are absent from the
analytics response. View details opens the existing role-protected admin pages.
