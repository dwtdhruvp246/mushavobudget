begin read only;
set local statement_timeout='15s';
select jsonb_build_object(
'checked_at',clock_timestamp(),
'catalog_active',(select mode='ACTIVE' from mushavo_email_install.rollout_control where singleton),
'catalog_matches',(select catalog_sha256=mushavo_email_install.catalog_identity() from mushavo_email_install.rollout_control where singleton),
'normal_queue',(select count(*) from public.notification_outbox),
'admin_queue',(select count(*) from public.admin_notification_outbox),
'runner_sessions',(select count(*) from auth.sessions where user_id in ('ca7bdcf2-e69d-42e2-8ae8-79cac6de2184','660a1463-6589-4c4d-ab6c-8ee50161038f','8495c114-23c6-4d85-a643-fcb7a4781d74')
and user_agent ilike 'Mushavo-Staging-Runner/%'),
'generated_cache_objects',(select count(*) from storage.objects where bucket_id='payment-proofs' and name like 'personal/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/audit-cache-%'),
'business_fixture',(select jsonb_build_object('status',w.status,'seats',s.member_limit,'support_version',w.business_support_version,'subscription_version',s.version,'paid_through_at',s.paid_through_at)
 from public.budget_workspaces w join public.workspace_subscriptions s on s.workspace_id=w.id
 where w.name='audit-batch-x-receipt-d7be160c2026')
) as independent_readback;
rollback;