-- Staging only. Calls the installed renewal function with a modeled database
-- session. Every account/session/finance/notification change is rolled back.
begin;
set local search_path = pg_catalog;
set local lock_timeout = '3s';
set local statement_timeout = '20s';

do $probe$
declare
  owner_id constant uuid := 'ca7bdcf2-e69d-42e2-8ae8-79cac6de2184';
  fixture_workspace constant uuid := '017513c6-ce57-48af-b902-9552faeb83dd';
  fixture_plan_id constant uuid := '21a10bd8-46c8-4b2c-9f04-783164611fa1';
  fixture_plan constant text := 'audit_fr3_subscription_proof';
  fixture_ref constant text := 'AUDIT-FR3-SUBSCRIPTION-PROOF-20261114';
  proof_path constant text := 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/e3ed1247-a347-1064-e02f-f45f417fec60.pdf';
  missing_path constant text := 'workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr3-subscription-proof/00000000-0000-4000-8000-000000000000.pdf';
  session_id uuid := gen_random_uuid();
  payment uuid;
  got_error text;
  cases integer := 0;
  candidate record;
  baseline_count bigint;
begin
  if not exists (
    select 1 from mushavo_email_install.rollout_control where singleton and mode = 'ACTIVE'
      and target_project = 'dczlddwbtgvfdujgcitb'
      and catalog_sha256 = 'd24dd762582191f53351bda17d4501193acf81f751d40d5406aad0a441f5bc6e'
      and catalog_sha256 = mushavo_email_install.catalog_identity()
  ) or not public.fr3_subscription_proof_gate_ready()
    or (select md5(prosrc) from pg_proc where oid =
      'public.submit_subscription_renewal(uuid,text,integer,text,text,numeric,text,date,text,text,text,text,text,bigint)'::regprocedure)
       is distinct from 'eba948bce02157a78f8cc19d9b33f157'
    or not exists (
      select 1 from storage.objects where bucket_id = 'subscription-proofs' and name = proof_path
      and metadata->>'mimetype' = 'application/pdf'
      and coalesce(metadata->>'size',metadata->>'contentLength') = '791'
    )
    or exists (select 1 from storage.objects where bucket_id = 'subscription-proofs' and name = missing_path)
    or exists (select 1 from public.subscription_payments sp where sp.reference_number = fixture_ref)
    or exists (select 1 from public.plan_prices pp where pp.plan_id = fixture_plan_id)
  then raise exception 'EXACT_SUBSCRIPTION_ROLLBACK_FIXTURE_REQUIRED'; end if;

  select count(*) into baseline_count from public.subscription_payments sp where sp.workspace_id = fixture_workspace;
  update public.plans set is_active = true where id = fixture_plan_id and not is_public and not available_for_purchase;
  if not found then raise exception 'EXACT_SUBSCRIPTION_TEST_PLAN_REQUIRED'; end if;
  insert into public.plan_prices (plan_id,billing_period,currency,amount,effective_from)
  values (fixture_plan_id,'monthly','USD',1,now()-interval '1 minute');
  insert into auth.sessions(id,user_id,created_at,updated_at,aal,not_after,user_agent)
  values(session_id,owner_id,now(),now(),'aal1',now()+interval '5 minutes','Mushavo-FR3-Subscription-Proof-Rollback');
  perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner_id,
    'session_id',session_id,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
  execute 'set local role authenticated';
  if (public.app_session_status()->>'session_valid')::boolean is distinct from true then
    raise exception 'MODELED_SUBSCRIPTION_SESSION_REQUIRED';
  end if;
  for candidate in select * from (values
     (missing_path,'application/pdf',791::bigint,'FR3_SUBSCRIPTION_STORAGE_METADATA_MISMATCH'),
     (proof_path,'application/pdf',792::bigint,'FR3_SUBSCRIPTION_STORAGE_METADATA_MISMATCH'),
     (proof_path,'image/png',791::bigint,'FR3_SUBSCRIPTION_PROOF_SCOPE_REQUIRED'),
     (replace(proof_path,'/fr3-subscription-proof/','/legacy-proof/'),'application/pdf',791::bigint,'FR3_SUBSCRIPTION_PROOF_SCOPE_REQUIRED')
  ) expected(path,mime,bytes,error) loop
    got_error := null;
    begin
      perform public.submit_subscription_renewal(fixture_workspace,fixture_plan,1,'monthly','USD',1,
        'Other',current_date,fixture_ref,null,candidate.path,'test.pdf',candidate.mime,candidate.bytes);
    exception when others then
      get stacked diagnostics got_error = message_text;
    end;
    if got_error is distinct from candidate.error then
      raise exception 'SUBSCRIPTION_PROOF_REJECTION_MISMATCH: %', coalesce(got_error,'accepted');
    end if;
    cases := cases + 1;
  end loop;
  payment := public.submit_subscription_renewal(fixture_workspace,fixture_plan,1,'monthly','USD',1,
    'Other',current_date,fixture_ref,null,proof_path,'test.pdf','application/pdf',791);
  execute 'reset role';

  if (select count(*) from public.subscription_payments sp where sp.workspace_id = fixture_workspace) <> baseline_count + 1
    or not exists (
      select 1 from public.subscription_payments sp
      join public.subscription_renewal_requests req on req.id = sp.renewal_request_id
      join public.subscription_invoices inv on inv.id = req.invoice_id
      join public.subscription_payment_proofs pr on pr.payment_id = sp.id
      where sp.id = payment and sp.workspace_id = fixture_workspace and sp.submitted_by = owner_id
        and sp.status = 'pending_review' and sp.reference_number = fixture_ref and sp.amount = 1
        and req.requested_plan_id = fixture_plan_id and inv.total_amount = 1 and pr.storage_path = proof_path
        and pr.uploaded_by = owner_id and pr.mime_type = 'application/pdf' and pr.size_bytes = 791
    ) then raise exception 'EXACT_RENEWAL_PROOF_LINK_REQUIRED'; end if;
  perform set_config('mushavo.subscription_proof.result',jsonb_build_object(
    'rejections',cases,'exact_payment_and_proof_linked',true,'notification_rows_in_transaction',
    (select count(*) from public.admin_notification_outbox where source_id = payment),
    'live_postgrest_submission',false,'transaction_disposition','rollback')::text,true);
end;
$probe$;
select current_setting('mushavo.subscription_proof.result')::jsonb as safe_result;
rollback;
