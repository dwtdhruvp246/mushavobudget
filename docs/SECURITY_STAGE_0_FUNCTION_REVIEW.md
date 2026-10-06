# Stage 0 database function exposure review

Reviewed 6 October 2026 against the owner-supplied post-table-fix metadata and tracked source. The owner reported 61 anonymously executable SECURITY DEFINER functions. Source definitions were found for 57; four live-only/provider functions remain unverified. This is a source/metadata classification, not a live penetration test.

## Confirmed narrow permission gaps

`store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamptz)` is a trusted internal writer. Its source accepts supplied entity, workspace and amount values without caller authorization; it is invoked by protected triggers/backfills. The live inventory confirms anonymous EXECUTE. With matching source and Supabase-style direct default grants, the isolated verifier reproduces an anonymous conversion insertion with a supplied amount unrelated to the payment row. This does not establish that the live body is identical or that production data was altered.

`currency_conversion_backfill_dates(integer)` reads missing-conversion dates across workspace, platform and subscription records. Its source intentionally grants service-role access, but the live anonymous inventory includes it. The isolated verifier reproduces the date disclosure. The scheduled Edge function calls it through its service client.

The old migration revokes PUBLIC execution but not direct anon/authenticated grants. The follow-up migration revokes EXECUTE on these two helpers from PUBLIC, anon and authenticated; grants service execution explicitly; and retains conversion-writer access for the trusted owners of five protected trigger/backfill callers. It aborts if prerequisites are missing, a protected caller owner is inherited by API users, or forbidden EXECUTE remains inherited. No bodies, data, financial calculations or APK assets change.

The SQL verifier uses the actual source helper, rate, backfill, settings, manual-conversion, trigger and public-lookup definitions, plus the actual conversion-table DDL. Auth claims, auxiliary ownership/payment tables and rows are synthetic. It does not test PostgREST/JWT validation or the complete surrounding production RLS/approval/subscription stack.

## Classification of the live anonymous inventory

| Function | Classification / next check |
|---|---|
| `admin_subscription_monitor()` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `apply_approved_subscription_member_limit()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `backfill_currency_conversions()` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `backfill_workspace_currency_conversions(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `business_team_can_manage(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `can_manage_family_members(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `create_family_workspace(text,numeric,text)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `currency_conversion_backfill_dates(integer)` | Internal helper — narrow EXECUTE fix prepared; live application/recheck pending. |
| `delete_family_workspace(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `effective_workspace_entitlement(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `enforce_approved_additional_seat()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `enforce_business_member_role_compatibility()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `enforce_personal_payment_limit()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `exchange_rate_status(boolean)` | Currency lookup/status used by signed-in flows — direct anonymous grant needs least-privilege review; no private-payment write in its source. |
| `get_public_plan_catalogue(text)` | Intended public lookup — retain anonymous access; public behavior covered by currency fixture. |
| `get_public_signup_currencies()` | Intended public lookup — retain anonymous access; public behavior covered by currency fixture. |
| `guard_account_status_change()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `guard_suspended_account_write()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `guard_workspace_finance_write()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `handle_new_user_profile()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `has_active_family_plan()` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `invite_family_member(uuid,text,text)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `is_active_family_participant(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `is_app_admin()` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `is_family_admin(uuid)` | Live-only/provider definition — cannot certify body or ownership from tracked source; inspect limited live evidence before any change. |
| `is_family_member(uuid)` | Live-only/provider definition — cannot certify body or ownership from tracked source; inspect limited live evidence before any change. |
| `is_platform_staff(text[])` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `is_workspace_member(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `is_workspace_owner(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `latest_exchange_rate(text,text,timestamp with time zone)` | Currency lookup/status used by signed-in flows — direct anonymous grant needs least-privilege review; no private-payment write in its source. |
| `link_family_head_to_profile()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `lock_payment_record_conversion()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `lock_platform_payment_conversion()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `lock_subscription_payment_conversion()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `normalize_enquiry()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `provision_my_budget_workspace()` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `record_public_enquiry_event()` | Live-only/provider definition — cannot certify body or ownership from tracked source; inspect limited live evidence before any change. |
| `remove_family_member(uuid,uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `respond_to_family_invitation(uuid,boolean)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `rls_auto_enable()` | Live-only/provider definition — cannot certify body or ownership from tracked source; inspect limited live evidence before any change. |
| `save_admin_finance_currency_settings(text,text[],boolean)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `save_manual_payment_conversion(text,uuid,text,numeric,numeric)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `save_plan_definition(uuid,text,text,text,text,text,integer,integer,boolean,boolean,boolean,boolean,text,integer,text[])` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `save_plan_price(text,text,text,numeric,numeric)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `save_workspace_currency_settings(uuid,text,text[],text,boolean)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `seed_business_stage_4_team_permissions()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `store_api_payment_conversion(text,uuid,uuid,numeric,text,text,timestamp with time zone)` | Internal helper — narrow EXECUTE fix prepared; live application/recheck pending. |
| `submit_family_plan_request(uuid,text,integer,text,text,text,numeric,text,date,text,text,text,text,text,bigint)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `submit_subscription_renewal(uuid,text,integer,text,text,numeric,text,date,text,text,text,text,text,bigint)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `sync_family_head_subscription_status()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `sync_legacy_family_invitation()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `sync_legacy_family_member()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `sync_legacy_family_workspace()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `sync_payment_record_workspace()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `sync_payment_workspace()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `validate_budget_expense_currency()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `validate_payment_record_currency()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `validate_workspace_transaction_currency()` | Trigger entry point — not an ordinary callable RPC; preserve Auth/record workflows, review grants and definer ownership in Stage 3. |
| `workspace_billable_member_count(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `workspace_has_feature(uuid,text)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |
| `workspace_member_usage(uuid)` | Signed-in operation or permission helper — source identity/owner/role checks need Stage 3 direct allowed/denied testing and grant review. |

Counts: **2 internal helpers, 2 intended public lookups, 23 triggers, 30 signed-in/permission/currency lookup functions, 4 definitions absent from source**. Removing the two internal helpers would leave 59 entries in the anonymous inventory if no other function grants change. Those 59 are not automatically vulnerabilities or completed checks.

## Next live verification

Apply `supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql`, then run `supabase/diagnostics/security_stage_0_currency_helpers_diagnostic.sql`. Expected: **12 rows — 10 PASS, 1 REVIEW, 1 CANNOT VERIFY**. The original 24-row baseline still retains its REVIEW/CANNOT VERIFY rows; do not treat every catalog inventory as a boolean completion gate.

Verify a legitimate recorded payment gets its expected currency conversion; owner settings and authorized manual conversion still work; and the next currency sync/backfill succeeds. Use controlled test records and normal application workflows. Production helper misuse must not be reproduced against real records. Native package, provider, staging, backup and real-device evidence are still pending.

References: [Supabase function security](https://supabase.com/docs/guides/database/functions), [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html).
