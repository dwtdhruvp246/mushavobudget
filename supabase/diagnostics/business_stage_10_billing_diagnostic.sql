-- Read-only. Run after Stage 10 migration. Expect all 25 rows to say PASS.
with functions as (
  select proname,oid,prosecdef,proconfig,prosrc from pg_proc where pronamespace='public'::regnamespace
), rpc_checks as (
  select 'RPC: '||e.signature as check_name,case when p.oid is not null and p.prosecdef
    and p.proconfig @> array['search_path=public, pg_temp'] and has_function_privilege('authenticated',p.oid,'EXECUTE')
    and not has_function_privilege('anon',p.oid,'EXECUTE') then 'PASS' else 'FAIL' end as status
  from (values ('admin_business_billing_settings()'),('admin_business_subscription_payment_detail(uuid)'),
    ('save_business_billing_settings(uuid,integer,boolean,integer,text,numeric,numeric,numeric,numeric,text)'),
    ('business_billing_snapshot(uuid,integer,integer)'),('business_subscription_quote(uuid,text,text,integer)'),
    ('submit_business_subscription_payment(uuid,uuid,uuid,text,date,text,text,text,text,text,bigint)'),
    ('review_subscription_payment(uuid,text,text)')) e(signature)
  left join functions p on p.oid=to_regprocedure('public.'||e.signature)
), fixed_checks as (
  select * from (values
    ('Private billing tables use forced RLS with no client writes',case when
      (select count(*) from pg_class where oid in ('public.business_billing_settings'::regclass,'public.business_subscription_quotes'::regclass)
        and relrowsecurity and relforcerowsecurity and not has_table_privilege('authenticated',oid,'INSERT,UPDATE,DELETE'))=2
      then 'PASS' else 'FAIL' end),
    ('Internal helpers and legacy-review bypass are not callable by clients',case when
      (select count(*) from functions where oid in (to_regprocedure('public.business_effective_member_limit(uuid,boolean)'),
        to_regprocedure('public.business_billing_usage(uuid)'),to_regprocedure('public.business_seat_proration(timestamptz,timestamptz,timestamptz)'),
        to_regprocedure('public.review_subscription_payment_before_business_stage10(uuid,text,text)'))
        and not has_function_privilege('authenticated',oid,'EXECUTE') and not has_function_privilege('anon',oid,'EXECUTE'))=4
      then 'PASS' else 'FAIL' end),
    ('Pilot billing defaults disabled and quotes bind to their workspace',case when
      exists(select 1 from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
        where d.adrelid='public.business_billing_settings'::regclass and a.attname='pilot_enabled' and pg_get_expr(d.adbin,d.adrelid)='false')
      and exists(select 1 from pg_constraint where conname='business_request_quote_workspace_fk' and contype='f') then 'PASS' else 'FAIL' end),
    ('Billing is restricted to the current active Owner account and membership',case when exists(select 1 from functions
      where proname='business_billing_owner' and prosrc like '%my_account_suspended%' and prosrc like '%w.owner_id=auth.uid()%'
        and prosrc like '%m.role=''business_owner''%' and prosrc like '%m.status=''active''%') then 'PASS' else 'FAIL' end),
    ('Admin settings validate supported currency and compare versions',case when exists(select 1 from functions
      where proname='save_business_billing_settings' and prosrc like '%BUSINESS_BILLING_ADMIN_REQUIRED%'
        and prosrc like '%supported_currencies%' and prosrc like '%BUSINESS_BILLING_SETTINGS_CHANGED%') then 'PASS' else 'FAIL' end),
    ('Mid-term quotes use exact seconds and match the current billing cycle',case when exists(select 1 from functions
      where proname='business_seat_proration' and prosrc like '%extract(epoch from(p_end-p_at))/extract(epoch from(p_end-p_start))%')
      and exists(select 1 from functions where proname='business_subscription_quote' and prosrc like '%p_billing_period is distinct from s.billing_period%'
        and prosrc like '%business_seat_proration%') then 'PASS' else 'FAIL' end),
    ('Quote submission locks the subscription and rejects expired or changed quotes',case when exists(select 1 from functions
      where proname='submit_business_subscription_payment' and prosrc like '%for update%'
        and prosrc like '%q.expires_at<=now()%' and prosrc like '%c.version<>q.settings_version%'
        and prosrc like '%s.version<>q.subscription_version%') then 'PASS' else 'FAIL' end),
    ('Payment proof must match a real private storage object and metadata',case when exists(select 1 from functions
      where proname='submit_business_subscription_payment' and prosrc like '%from storage.objects%'
        and prosrc like '%v_size is distinct from p_proof_size_bytes%' and prosrc like '%v_mime is distinct from p_proof_mime_type%'
        and prosrc like '%p_workspace_id::text%') then 'PASS' else 'FAIL' end),
    ('Submission retries return the same payment and one pending review is enforced',case when exists(select 1 from functions
      where proname='submit_business_subscription_payment' and prosrc like '%q.status=''submitted'' and q.payment_id=p_payment_id%'
        and prosrc like '%SUBSCRIPTION_REVIEW_ALREADY_PENDING%') then 'PASS' else 'FAIL' end),
    ('Approval rechecks suspension, Owner, term, capacity and subscription version',case when exists(select 1 from functions
      where proname='review_subscription_payment' and prosrc like '%BUSINESS_BILLING_SUSPENDED%'
        and prosrc like '%w.owner_id<>q.owner_id%' and prosrc like '%s.version<>q.subscription_version%'
        and prosrc like '%s.paid_through_at is distinct from q.original_expiry_at%' and prosrc like '%BUSINESS_CAPACITY_BELOW_USAGE%')
      then 'PASS' else 'FAIL' end),
    ('Payment review prevents self-review and preserves receipts and audit history',case when exists(select 1 from functions
      where proname='review_subscription_payment' and prosrc like '%BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN%'
        and prosrc like '%subscription_payment_reviews%' and prosrc like '%receipt_number=v_receipt%'
        and prosrc like '%business.billing_%') then 'PASS' else 'FAIL' end),
    ('Extra-seat approval leaves the existing paid-through date unchanged',case when exists(select 1 from functions
      where proname='review_subscription_payment' and prosrc like '%v_start:=q.term_start_at;v_end:=q.term_end_at;%'
        and prosrc like '%set member_limit=q.total_seats,version=version+1%') then 'PASS' else 'FAIL' end),
    ('Early renewal schedules capacity and reserves the lower future limit',case when exists(select 1 from functions
      where proname='review_subscription_payment' and prosrc like '%business_next_member_limit=case when v_start>now() then q.total_seats end%')
      and exists(select 1 from functions where proname='business_effective_member_limit' and prosrc like '%s.business_next_effective_at<=now()%'
        and prosrc like '%least(s.member_limit,s.business_next_member_limit)%') then 'PASS' else 'FAIL' end),
    ('Team snapshot and invitation functions use purchased capacity, without a test-seat floor',case when
      (select count(*) from functions where proname in ('business_team_snapshot','create_business_invitation','respond_business_invitation')
        and prosrc like '%business_effective_member_limit%' and prosrc not like '%greatest(member_limit, 10)%')=3
      and exists(select 1 from functions where proname='business_team_snapshot' and prosrc like '%business_claims_active%')
      then 'PASS' else 'FAIL' end),
    ('Usage includes live pending invitations and manual grants reset scheduled capacity',case when exists(select 1 from functions
      where proname='business_billing_usage' and prosrc like '%workspace_invitations%' and prosrc like '%expires_at>now()%')
      and exists(select 1 from pg_trigger where tgname='reset_business_capacity_after_manual_grant_trigger' and not tgisinternal and tgenabled<>'D')
      then 'PASS' else 'FAIL' end),
    ('Business direct-write and storage guards remain restrictive',case when
      (select count(*) from pg_policy where polname in ('business_billing_direct_write_guard','business_billing_direct_update_guard') and not polpermissive)=6
      and (select count(*) from pg_policy where polname in ('business_subscription_proof_read_guard','business_subscription_proof_upload_guard','business_subscription_proof_delete_guard') and not polpermissive)=3
      then 'PASS' else 'FAIL' end),
    ('Personal and Family review delegates to the preserved implementation',case when exists(select 1 from functions
      where proname='review_subscription_payment' and prosrc like '%w.workspace_type<>''business''%'
        and prosrc like '%review_subscription_payment_before_business_stage10(p_payment_id,p_decision,p_reason)%') then 'PASS' else 'FAIL' end),
    ('Public Business purchase and customer provisioning remain closed',case when not public.product_customer_purchase_enabled('business')
      and not public.product_customer_workspace_creation_enabled('business')
      and not exists(select 1 from public.plans where workspace_type='business' and available_for_purchase)
      then 'PASS' else 'FAIL' end)
  ) checks(check_name,status)
)
select * from rpc_checks union all select * from fixed_checks order by check_name;
