-- 2.2.3: one read-only result set after the controlled staging form batch.
-- Owner verifies Dashboard reference dczlddwbtgvfdujgcitb before running.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '3s';
with selected as (
  select * from public.enquiries
  where message like 'AUDIT-S223-FORM-20261010 enquiry %'
), findings as (
  select '01 Read-only staging review context'::text as check_name, 'INFO'::text as status,
    jsonb_build_object('intended_staging_reference', 'dczlddwbtgvfdujgcitb',
      'production_reference_to_avoid', 'kttkospkblwvguuwnhjj',
      'checked_at', current_timestamp, 'transaction_read_only', current_setting('transaction_read_only'),
      'project_identity', 'Owner Dashboard confirmation; SQL does not establish hosted identity') as details
  union all
  select '02 Controlled form batch saved-row counts',
    case when count(*) = 3 and count(distinct email) = 1 and
      count(*) filter (where status = 'new' and source = 'website' and user_id is null and
        handled_by is null and handled_at is null and country_code = 'ZW' and country_name = 'Zimbabwe') = 3
      then 'PASS' else 'REVIEW' end,
    jsonb_build_object('matching_test_enquiries', count(*), 'distinct_test_emails', count(distinct email),
      'expected_test_enquiries', 3,
      'expected_new_website_enquiries', count(*) filter (where status = 'new' and source = 'website' and
        user_id is null and handled_by is null and handled_at is null and country_code = 'ZW' and country_name = 'Zimbabwe'),
      'browser_fourth_attempt_denial_requires_owner_confirmation', true,
      'actual_concurrency_or_rollback_verified', false)
  from selected
  union all
  select '03 Test-review boundary', 'INFO', jsonb_build_object(
    'sql_modified_schema_or_rows', false, 'raw_enquiry_fields_or_identifiers_returned', false,
    'staff_app_access_or_email_push_dispatch_verified', false,
    'production_changed_by_this_check', false,
    'unavailable_cases_carried_to_final_remediation', true)
)
select check_name, status, details from findings order by check_name;
rollback;
