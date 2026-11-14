-- SUPERSEDED / NOT EXECUTED: deletion confirmation expired. Do not retry.
-- Use the reversible new-document parent correction and normal app archive instead.
-- Operator-only teardown of the one synthetic metadata row created by run42467355998.
-- This is not end-user paid-proof deletion acceptance. Keep all policies/triggers
-- and the original paid bill unchanged. Storage bytes are removed through API later.
begin;set local search_path=pg_catalog;set local lock_timeout='1500ms';set local statement_timeout='20s';
do $cleanup$
declare v_count integer;
begin
 if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
 and mode='ACTIVE' and catalog_sha256='cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f'
 and catalog_sha256=mushavo_email_install.catalog_identity()) then raise exception 'EXACT_STAGING_CATALOG_REQUIRED';end if;
 if not exists(select 1 from public.budget_workspaces where id='dcf3d122-e99f-4fe5-bbd1-03c3547629df'
 and name='audit-batch-x-receipt-d7be160c2026' and status='active' and business_support_version=19)
 or not exists(select 1 from public.workspace_subscriptions where workspace_id='dcf3d122-e99f-4fe5-bbd1-03c3547629df'
 and version=17 and member_limit=2 and paid_through_at='2026-11-09T00:00:00Z')
 or exists(select 1 from auth.sessions where user_agent like 'Mushavo-Staging-Runner/%')
 or (select count(*) from public.workspace_members where workspace_id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and status='active')<>1
 or not exists(select 1 from public.business_profiles where workspace_id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and version=3 and logo_storage_path is null)
 then raise exception 'EXACT_OWNED_FAILED_RUN_STATE_REQUIRED';end if;
 if not exists(select 1 from public.business_bills b where id='c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45'
 and encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex')='f55eef182e5f7e153e93362a51a90c881357149bf17745808d914dc0e9809a87') then raise exception 'ORIGINAL_PAID_BILL_REQUIRED';end if;
 delete from public.business_documents d where id='e8e09b54-76ed-477b-a266-fb88502bcb40'
 and workspace_id='dcf3d122-e99f-4fe5-bbd1-03c3547629df' and parent_type='business_bill'
 and parent_id='c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45' and status='active' and original_name='Synthetic broker proof.png'
 and uploaded_by='ca7bdcf2-e69d-42e2-8ae8-79cac6de2184' and size_bytes=68 and mime_type='image/png'
 and created_at='2026-11-08T09:29:17.847174Z'
 and encode(sha256(convert_to(to_jsonb(d)::text,'UTF8')),'hex')='348d9c475b11bb33be236c3068fb113de4623de72ee628ae313d42fe17169c9f';
 get diagnostics v_count=row_count;
 if v_count<>1 then raise exception 'EXACT_ONE_NEW_SYNTHETIC_DOCUMENT_REQUIRED';end if;
 if not exists(select 1 from public.business_bills b where id='c88a0a8c-fae6-4452-bdf0-b9ce7bf71b45'
 and encode(sha256(convert_to(to_jsonb(b)::text,'UTF8')),'hex')='f55eef182e5f7e153e93362a51a90c881357149bf17745808d914dc0e9809a87') then raise exception 'PAID_BILL_CHANGED_ROLLBACK';end if;
end;$cleanup$;
select jsonb_build_object('exact_new_test_document_removed',true,'Storage_rows_changed',0,'financial_ledger_rows_changed',0,'Auth_rows_changed',0,'ordinary_API_acceptance',false) safe_result;
commit;
