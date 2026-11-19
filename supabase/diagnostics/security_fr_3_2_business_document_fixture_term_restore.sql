-- Staging only. Restore the original term of the synthetic Business workspace.
begin;
set local search_path=pg_catalog;
set local statement_timeout='15s';
set local lock_timeout='3s';
do $restore$
begin
  if not exists(select 1 from mushavo_email_install.rollout_control where singleton and target_project='dczlddwbtgvfdujgcitb'
    and mode='ACTIVE' and catalog_sha256='aaa213527a13a8cc9f0f07bd03d2b1d4bce4ece61f7a5112a32decf7657e3f50' and catalog_sha256=mushavo_email_install.catalog_identity())
    or not exists(select 1 from public.budget_workspaces where id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2'
      and name='audit-fr3-logo-ingestion-20261112' and status='suspended' and business_support_version=24)
    or exists(select 1 from storage.objects where bucket_id='business-documents' and split_part(name,'/',2)='8d9307e6-aada-4c9a-a8f5-43c57e0865e2')
    or not exists(select 1 from public.business_documents where id='75e6c01e-e490-4e83-9774-618867654b24' and status='archived')
  then raise exception 'EXACT_BUSINESS_DOCUMENT_POST_RUN_REQUIRED'; end if;
  update public.workspace_subscriptions
  set paid_through_at='2026-11-14T00:00:00Z'
  where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2' and status='active' and version=1 and member_limit=1
    and paid_through_at='2026-11-14T15:40:51.000Z';
  if not found then raise exception 'EXACT_BUSINESS_DOCUMENT_TERM_RESTORE_REQUIRED'; end if;
end;
$restore$;
select version,paid_through_at from public.workspace_subscriptions where workspace_id='8d9307e6-aada-4c9a-a8f5-43c57e0865e2';
commit;
