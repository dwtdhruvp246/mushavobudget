-- Staging only. Keep the rejected synthetic ledger and close its upload gates.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '35s';
select pg_advisory_xact_lock(20261017, 2411);

do $preflight$
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
      and mode='ACTIVE' and catalog_sha256='439a60fb5eb19a0c0ea7b5e515faeffb9358aa94ece6e4d6de3db5dea38bb280' and catalog_sha256=mushavo_email_install.catalog_identity()
  ) or not exists (
    select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and status='suspended' and business_support_version=54
  ) or (
    select count(*) from public.fr32_subscription_flow_files f
      join public.subscription_payment_proofs pr on pr.storage_path=f.path
      join public.subscription_payments p on p.id=pr.payment_id
      join public.subscription_renewal_requests r on r.id=p.renewal_request_id
      join public.subscription_invoices i on i.id=r.invoice_id
      join storage.objects ob on ob.bucket_id='subscription-proofs' and ob.name=f.path
      where f.state='linked' and p.reference_number='FR32-SYNTHETIC-20261115-'||f.lane
        and p.status='rejected' and r.status='rejected' and i.status='rejected' and p.submitted_by='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184'
        and exists (select 1 from public.subscription_payment_reviews rev where rev.payment_id=p.id and rev.decision='rejected')
  )<>5 or (
    select count(*) from storage.objects where bucket_id='subscription-proofs'
      and split_part(name,'/',4) like 'fr32-billing-%'
  )<>5 then raise exception 'FR32_STAGED_SUBSCRIPTION_CLOSEOUT_REQUIRED'; end if;
end;
$preflight$;

do $extend$
declare
  v_proc regprocedure;
  v_source text;
  v_old text;
  v_new text;
begin
  for v_proc in
    select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace
      and proname in ('submit_subscription_renewal','submit_family_plan_request','family_extra_place_quote','notify_admins_on_subscription_payment')
  loop
    v_source := pg_get_functiondef(v_proc);
    case (select proname from pg_proc where oid=v_proc)
      when 'submit_subscription_renewal' then
        v_old := 'if v_plan.id is null then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
        v_new := v_old || '
  if v_plan.code in (''audit_fr32_personal'',''audit_fr32_household'') and (
    public.fr32_subscription_scope_allowed(case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end,p_workspace_id,v_plan.id) is not true
    or p_reference_number is distinct from (''FR32-SYNTHETIC-20261115-''||case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end)
    or split_part(coalesce(p_proof_path,''''),''/'',4) is distinct from (''fr32-billing-''||case when v_plan.code=''audit_fr32_personal'' then ''personal'' else ''family-renewal'' end)
  ) then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
      when 'submit_family_plan_request' then
        v_old := 'if v_plan.id is null then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
        v_new := v_old || '
  if v_plan.code=''audit_fr32_household'' and (
    public.fr32_subscription_scope_allowed(''family-plan'',p_personal_workspace_id,v_plan.id) is not true
    or p_reference_number is distinct from ''FR32-SYNTHETIC-20261115-family-plan''
    or split_part(coalesce(p_proof_path,''''),''/'',4) <> ''fr32-billing-family-plan''
  ) then raise exception ''PLAN_NOT_AVAILABLE''; end if;';
      when 'family_extra_place_quote' then
        v_old := 'id = v_subscription.plan_id and code = ''household''';
        v_new := 'id = v_subscription.plan_id and (code = ''household'' or
      (code=''audit_fr32_household'' and public.fr32_subscription_scope_allowed(''family-extra'',p_workspace_id,id) is true))';
      when 'notify_admins_on_subscription_payment' then
        v_old := 'if new.status = ''pending_review'' then';
        v_new := 'if new.status = ''pending_review'' and not (
    new.submitted_by=''ca7bdcf2-e69d-42e2-8ae8-79cac6de2184''::uuid and exists (
      select 1 from public.fr32_subscription_flow_scope s
      join public.subscription_renewal_requests r on r.id=new.renewal_request_id and r.requested_plan_id=s.plan_id
      where s.workspace_id=new.workspace_id and new.reference_number=''FR32-SYNTHETIC-20261115-''||s.lane
    )
  ) then';
    end case;
    if (length(v_source)-length(replace(v_source,v_new,'')))/length(v_new)<>1 then raise exception 'EXPECTED_BILLING_ROUTINE_SOURCE_REQUIRED'; end if;
    execute replace(v_source,v_new,v_old);
  end loop;
  if (select count(*) from public.fr32_subscription_flow_scope)<>5 or not exists (
    select 1 from public.business_billing_settings where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and pilot_enabled and included_seats=1
  ) then raise exception 'FR32_BILLING_FIXTURES_INCOMPLETE'; end if;
end;
$extend$;

do $family$
declare
  old_fragment text := $old$entitlement.plan_code = 'household'$old$;
  stage_fragment text := $new$(entitlement.plan_code = 'household' or (
          entitlement.plan_code = 'audit_fr32_household'
          and public.fr32_subscription_scope_allowed('family-extra',workspaces.id,'d840e33d-01f3-44cb-bbac-59be071c3139') is true
        ))$new$;
  v_source text := pg_get_functiondef('public.can_manage_family_members(uuid)'::regprocedure);
begin
  if (length(v_source)-length(replace(v_source,stage_fragment,'')))/length(stage_fragment)<>1 then
    raise exception 'EXPECTED_SCOPED_FAMILY_ENTITLEMENT_CHECK_REQUIRED';
  end if;
  execute replace(v_source,stage_fragment,old_fragment);
end;
$family$;

do $archive$
begin
  update public.fr32_subscription_flow_scope set expires_at=least(expires_at,now());
  update public.business_billing_settings set pilot_enabled=false
    where plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a' and pilot_enabled;
  if not found then raise exception 'EXACT_TEST_BILLING_PILOT_REQUIRED'; end if;

  update public.workspace_subscriptions set plan_id='0ccf35bb-43c7-4c1b-9148-0f352b85bd2a'
    where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and version=1 and plan_id='0b8eacc8-eae9-4b83-89f8-d8684fe05c9a'
      and paid_through_at='2026-11-14 00:00:00+00' and member_limit=1;
  if not found then raise exception 'EXACT_BUSINESS_FIXTURE_SUBSCRIPTION_REQUIRED'; end if;

  update public.workspace_subscriptions set plan_id='4b2a9d87-f309-4a99-9715-048faeaabaf1',
    status='expired',paid_through_at=now()
    where workspace_id='50e06a1d-734a-45d7-9d17-3bf46c8e9d71' and plan_id='d840e33d-01f3-44cb-bbac-59be071c3139' and member_limit=4;
  if not found then raise exception 'EXACT_FAMILY_FIXTURE_SUBSCRIPTION_REQUIRED'; end if;

  update public.workspace_members set status='inactive',removed_at=now()
    where workspace_id='50e06a1d-734a-45d7-9d17-3bf46c8e9d71' and user_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and role='family_head' and status='active';
  if not found then raise exception 'EXACT_FAMILY_FIXTURE_WORKSPACE_MEMBER_REQUIRED'; end if;
  update public.family_members set status='inactive'
    where family_id='4851a173-3f8d-4d30-b841-cb57d3613c54' and user_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and role='Owner' and status='active';
  if not found then raise exception 'EXACT_FAMILY_FIXTURE_MEMBER_REQUIRED'; end if;
  update public.budget_workspaces set status='closed'
    where id='50e06a1d-734a-45d7-9d17-3bf46c8e9d71' and owner_id='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and legacy_family_id='4851a173-3f8d-4d30-b841-cb57d3613c54' and status='active';
  if not found then raise exception 'EXACT_FAMILY_FIXTURE_WORKSPACE_REQUIRED'; end if;

  update public.plan_prices set is_active=false where plan_id in ('166ec33c-162d-4f47-8c2b-d5d462491707','d840e33d-01f3-44cb-bbac-59be071c3139');
  update public.plans set is_active=false,available_for_purchase=false
    where id in ('166ec33c-162d-4f47-8c2b-d5d462491707','d840e33d-01f3-44cb-bbac-59be071c3139','0b8eacc8-eae9-4b83-89f8-d8684fe05c9a') and not is_public;

  if exists (select 1 from public.fr32_subscription_flow_scope s where public.fr32_subscription_flow_ready(s.lane) is not null)
    or exists (select 1 from public.business_billing_settings where pilot_enabled and plan_id in ('0b8eacc8-eae9-4b83-89f8-d8684fe05c9a','0ccf35bb-43c7-4c1b-9148-0f352b85bd2a'))
  then raise exception 'FR32_SUBSCRIPTION_GATES_MUST_CLOSE'; end if;

  update mushavo_email_install.rollout_control set catalog_sha256=mushavo_email_install.catalog_identity(),changed_at=clock_timestamp()
    where singleton and target_project='dczlddwbtgvfdujgcitb' and mode='ACTIVE' and catalog_sha256='439a60fb5eb19a0c0ea7b5e515faeffb9358aa94ece6e4d6de3db5dea38bb280';
  if not found then raise exception 'EXACT_SUBSCRIPTION_TRIAL_CATALOG_REQUIRED'; end if;
end;
$archive$;
notify pgrst,'reload schema';
commit;
