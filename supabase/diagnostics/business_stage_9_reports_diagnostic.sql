-- Read-only. Run after the Stage 9 migration. Expect all 20 rows to be PASS.
with rpc_checks as (
  select 'RPC: '||e.signature as check_name,
    case when p.oid is not null and p.prosecdef and p.proconfig @> array['search_path=public, pg_temp']
      and has_function_privilege('authenticated',p.oid,'EXECUTE') and not has_function_privilege('anon',p.oid,'EXECUTE')
      then 'PASS' else 'FAIL' end as status
  from (values
    ('business_report_scope(uuid,uuid,uuid)'),('business_report_summary(uuid,date,date,text,text,uuid,uuid)'),
    ('business_report_records(uuid,text,text,date,date,text,text,uuid,uuid,text,uuid,uuid,integer,integer)'),
    ('business_report_export(uuid,text,text,uuid,text,date,date,text,text,uuid,uuid,text,uuid,uuid)')
  ) e(signature) left join pg_proc p on p.oid=to_regprocedure('public.'||e.signature)
), fixed_checks as (
  select * from (values
    ('Internal report helpers are not callable by clients',case when
      (select count(*) from pg_proc where oid in (to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)'),
        to_regprocedure('public.business_report_data(uuid,date,date,text,text,uuid,uuid)'),
        to_regprocedure('public.business_report_selection(jsonb,text,text,uuid,uuid)'),
        to_regprocedure('public.business_report_csv_cell(text,boolean)'))
        and not has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE'))=4
      then 'PASS' else 'FAIL' end),
    ('Report view and export permission definitions exist',case when
      (select count(*) from public.business_permission_definitions where permission_code in ('reports.view','reports.export'))=2
      then 'PASS' else 'FAIL' end),
    ('Active membership and report-view permission gate every report',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_data(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%business_claims_active%' and prosrc like '%reports.view%') then 'PASS' else 'FAIL' end),
    ('Staff remain own-only; other non-finance users require assigned tags',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_scope(uuid,uuid,uuid)') and prosrc like '%p_submitter_id=auth.uid()%'
        and prosrc like '%business_member_scopes%' and prosrc like '%role in (''staff'',''contributor'')%'
        and prosrc like '%role not in (''staff'',''contributor'')%') then 'PASS' else 'FAIL' end),
    ('Actual income excludes voided records',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%i.status=''received''%') then 'PASS' else 'FAIL' end),
    ('Paid claims and linked claim/bill exclusions are preserved',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%c.status=''paid''%' and prosrc like '%b.source_claim_id=c.id and b.status<>''cancelled''%')
      then 'PASS' else 'FAIL' end),
    ('Approved requests replace their commitment with a linked bill',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%r.status=''approved''%' and prosrc like '%b.source_request_id=r.id and b.status<>''cancelled''%')
      then 'PASS' else 'FAIL' end),
    ('Partial bill balances use stored conversions; payments retain their snapshots',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%b.amount-b.paid_amount%' and prosrc like '%p.reporting_amount%'
        and prosrc not like '%latest_exchange_rate%') then 'PASS' else 'FAIL' end),
    ('Payment dates use workspace timezone and date bounds are inclusive',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%timezone(s.timezone,p.paid_at)::date%' and prosrc like '%r.event_date>=p_from%'
        and prosrc like '%r.event_date<=p_to%') then 'PASS' else 'FAIL' end),
    ('Original-currency totals require exactly one currency',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_data(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%p_mode=''original'' and coalesce(p_currency,'''')=''''%') then 'PASS' else 'FAIL' end),
    ('Budgets respect report scope and remain in reporting currency',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_data(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%p_mode=''reporting''%' and prosrc like '%business_can_view_budget%'
        and prosrc like '%business_report_scope(p_workspace_id,b.dimension_id)%') then 'PASS' else 'FAIL' end),
    ('Receipt checks distinguish expense receipts, bill invoices and payment proofs',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_rows(uuid,date,date,text,text,uuid,uuid)')
        and prosrc like '%d.parent_type=''expense_claim''%' and prosrc like '%d.parent_type=''business_bill''%'
        and prosrc like '%d.parent_type=''business_bill_payment''%' and prosrc like '%d.status=''active''%')
      then 'PASS' else 'FAIL' end),
    ('Drill-downs and exports require the displayed report fingerprint',case when
      (select count(*) from pg_proc where oid in
        (to_regprocedure('public.business_report_records(uuid,text,text,date,date,text,text,uuid,uuid,text,uuid,uuid,integer,integer)'),
         to_regprocedure('public.business_report_export(uuid,text,text,uuid,text,date,date,text,text,uuid,uuid,text,uuid,uuid)'))
        and prosrc like '%p_expected_fingerprint%' and prosrc like '%BUSINESS_REPORT_CHANGED%')=2
      then 'PASS' else 'FAIL' end),
    ('CSV and print require export permission, cap rows and audit the action',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_export(uuid,text,text,uuid,text,date,date,text,text,uuid,uuid,text,uuid,uuid)')
        and prosrc like '%reports.export%' and prosrc like '%v_count>10000%'
        and prosrc like '%report.exported%' and prosrc like '%business_record_audit_event%') then 'PASS' else 'FAIL' end),
    ('CSV quotes and escapes cells and neutralizes spreadsheet formulas',case when exists(select 1 from pg_proc
      where oid=to_regprocedure('public.business_report_csv_cell(text,boolean)') and prosrc like '%replace(%'
        and prosrc like '%[=+@-]%' and prosrc like '%not p_numeric%') then 'PASS' else 'FAIL' end),
    ('Business customer purchase remains closed',case when not public.product_customer_purchase_enabled('business')
      and not public.product_customer_workspace_creation_enabled('business')
      and not exists(select 1 from public.plans where workspace_type='business' and available_for_purchase=true)
      then 'PASS' else 'FAIL' end)
  ) checks(check_name,status)
)
select * from rpc_checks union all select * from fixed_checks order by check_name;
