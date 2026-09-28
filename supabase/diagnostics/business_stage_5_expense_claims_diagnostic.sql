begin;

do $$
declare v_signature text;
begin
  if to_regclass('public.business_expense_claims') is null then
    raise exception 'Business Stage 5 claim table is missing';
  end if;
  if not exists (select 1 from pg_class
    where oid = 'public.business_expense_claims'::regclass
      and relrowsecurity and relforcerowsecurity) then
    raise exception 'Business claims must force row level security';
  end if;
  if has_table_privilege('authenticated', 'public.business_expense_claims', 'INSERT,UPDATE,DELETE')
    or has_table_privilege('anon', 'public.business_expense_claims', 'SELECT,INSERT,UPDATE,DELETE')
    then raise exception 'Direct claim table writes or anonymous reads are exposed'; end if;
  foreach v_signature in array array[
    'public.business_claims_active(uuid)',
    'public.business_claim_in_scope(uuid,uuid)',
    'public.business_can_view_claim(uuid,uuid)',
    'public.create_business_claim(uuid,text,text,text,uuid,uuid,numeric,text,date)',
    'public.save_business_claim_draft(uuid,uuid,integer,text,text,uuid,uuid,numeric,text,date)',
    'public.submit_business_claim(uuid,uuid,integer)',
    'public.review_business_claim(uuid,uuid,integer,text,text)',
    'public.record_business_claim_payment(uuid,uuid,integer,timestamptz,text)',
    'public.business_claim_history(uuid,uuid)'
    ,'public.business_claim_summary(uuid)'
  ] loop
    if to_regprocedure(v_signature) is null then
      raise exception 'Missing Stage 5 function: %', v_signature;
    end if;
    if not (select prosecdef from pg_proc where oid = v_signature::regprocedure) then
      raise exception 'Stage 5 function is not protected: %', v_signature;
    end if;
    if has_function_privilege('anon', v_signature, 'EXECUTE') then
      raise exception 'Anonymous users can execute Stage 5 function: %', v_signature;
    end if;
  end loop;
  if not exists (select 1 from pg_policies
    where schemaname = 'public' and tablename = 'business_expense_claims'
      and cmd = 'SELECT' and qual like '%business_can_view_claim%') then
    raise exception 'Claim read policy is missing';
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Business members can read registered private documents'
      and qual like '%business_can_view_claim%') then
    raise exception 'Private receipt reads are not tied to claim visibility';
  end if;
  if not exists (select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'Business members can upload private documents'
      and with_check like '%business_claims_active%') then
    raise exception 'Expired workspaces could upload Business documents';
  end if;
  if not exists (select 1 from pg_constraint
    where conrelid = 'public.business_documents'::regclass
      and pg_get_constraintdef(oid) like '%expense_claim%') then
    raise exception 'Expense receipt parent type is missing';
  end if;
  if not exists (select 1 from pg_trigger
    where tgrelid = 'public.business_documents'::regclass
      and tgname = 'validate_business_document_parent_trigger' and not tgisinternal) then
    raise exception 'Cross-workspace receipt parent protection is missing';
  end if;
  if not exists (select 1 from pg_trigger
    where tgrelid = 'public.business_audit_events'::regclass
      and tgname = 'prevent_business_audit_mutation_trigger' and not tgisinternal) then
    raise exception 'Claim history audit events are mutable';
  end if;
  if not exists (select 1 from pg_trigger
    where tgrelid = 'public.workspace_settings'::regclass
      and tgname = 'lock_business_claim_reporting_currency_trigger' and not tgisinternal) then
    raise exception 'Business reporting currency is not locked after claim creation';
  end if;
  if public.product_customer_workspace_creation_enabled('business')
     or public.product_customer_purchase_enabled('business') then
    raise exception 'Public Business purchasing was opened by Stage 5';
  end if;
end $$;

rollback;
