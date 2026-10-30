-- 3.4.3 READ-ONLY STAGING METADATA. No installation, enrollment, role change or provider call.
-- Owner must select project dczlddwbtgvfdujgcitb in Supabase before running.
-- SQL cannot prove which dashboard/project the owner selected. No token/secret/UUID output.
begin read only;
set local search_path=public,pg_temp;
with expected_routines(name,args,lf_md5,crlf_md5,shape_md5) as (values
('admin_analytics_foundation','p_from date, p_to date','99ef14370afce2b0ff25c12bf3d17cd3','600fe33921647b5dfb2694148a8c96f3','5fb39f35e1d1cb476424d33492ddb8d2'),
('admin_analytics_page','p_from date, p_to date, p_country text, p_plan text, p_workspace_type text, p_subscription_status text, p_billing_period text, p_currency text','55957503f7d2b0cea488ddafeea7ce27','38650056226b47d18a77cf8ee381e72b','e31ff95af582cbf1060da575242f2d07'),
('admin_business_billing_settings','','4ad0f4db75fcbd7788e56552fcb94512','076495aaad938193083738b917eb586d','5117af4b14c6510b391eae5ba76d4e19'),
('admin_business_set_status','p_workspace_id uuid, p_status text, p_expected_version integer, p_confirmation_name text, p_reason text, p_request_id uuid','8d7029a14bc6b711e8d8ae916f5b1521','d8fe0c77da484ea3c195ccf214610157','4010c052a99b998ec165111c34a6c9c6'),
('admin_business_subscription_payment_detail','p_payment_id uuid','c24c804f6a2049e4792aeea819892c58','3d9bc1693140b742873c63aaad36d89f','3622b61c0f9aa4ea37623a043c34d45d'),
('admin_business_support_snapshot','p_workspace_id uuid, p_offset integer','031fca5c3b890d6221f69f3b0f59825b','f3e42a8d9df90ef57dd121c2887095fe','a9e9eca997c5b628d26e2d37c1eaa936'),
('admin_business_transfer_owner','p_workspace_id uuid, p_new_owner_member_id uuid, p_expected_owner_id uuid, p_expected_version integer, p_confirmation_name text, p_confirmation_email text, p_reason text, p_request_id uuid','175ef8648601700db626cdacb6fb0294','5ba455df17200a39bbb0ac1c35b48be1','d39740818f223876f45f339396719bbd'),
('admin_cancel_scheduled_plan_price','p_plan_id uuid, p_price_id uuid, p_edit_token text','94f7097ba883f093303ce92d07d49aba','2de5e82bb3b66e21886813d66f70d973','bf3b2a4054a0c08531b78d2d2ebd4e0a'),
('admin_grant_manual_subscription','p_owner_id uuid, p_workspace_id uuid, p_plan_id uuid, p_billing_period text, p_starts_on date, p_ends_on date, p_reason text, p_new_business_name text','e5de74ee9405c3bc6765346201ff1b8a','58391fb3507bceacfabd1246a76d1bd0','b0f9abb71e1cf8151d76ab1223c8d1f5'),
('admin_plan_calculation_preview','p_workspace_type text, p_base numeric, p_seat_price numeric, p_included integer, p_total integer, p_extra integer, p_start timestamp with time zone, p_end timestamp with time zone, p_at timestamp with time zone, p_period text','d21112de384008ebeecc1e82d267954f','2afa85c55aa47ec989ff58a3c23de233','ffc27e1f92aa6d6269d01a9f3b322ca5'),
('admin_plan_workbench_snapshot','p_plan_id uuid','05e562d9eeaf540c96daeb1cf516e1dd','59b96379d8d45ce159073b475261c103','f2ba84340d9c200819312b376604cc7a'),
('admin_save_plan_workbench','p_plan_id uuid, p_edit_token text, p_definition jsonb, p_business jsonb, p_price jsonb','d39e7c1f5bd71b3e6ec4bee24a53e56b','0e4c32c08f26e34f4b7756796accfc90','5d82d8fa5d8097f54e78e18a1dabaffb'),
('admin_subscription_monitor','','946b83d1d33388628eff3798a6a84455','a680a12697e14f036949558bdfebbcb5','49352b8b26c8872c7634e0b4d9c19f29'),
('backfill_currency_conversions','','37870f1342cdc68a3eae523511ab5374','8dcfbe24b59de68273bae49d6267fbeb','5a7a27654a47edeb8c543a77f2196199'),
('business_admin_test_permit','p_workspace_id uuid, p_owner_id uuid','45fdae49edde60e8282c63184908fe98','b9567252671bc68b43e5edbc39bb7398','c8384fab0c8ecabef8956cca6c5dd457'),
('business_subscription_proof_access','p_path text, p_write boolean','29384de40e5d5a2dd1f336727a254040','1c3243572ec569fcccbf0f753bcc53f8','e425214221e9b1dc3e9564f8278238f3'),
('enqueue_admin_event_notification','p_event_type text, p_source_id uuid, p_actor_id uuid','304a36476209573a56a42035987ec6d8','3add245d905f928c3f9e72e98e6dfd9e','d9ca5b9e727cd7c499574e909b3865c5'),
('exchange_rate_status','p_include_admin_details boolean','1e8f16389c6331922aa7f5a5ecfad445','43a92c038b595f0f4030435a4a7dd40e','48e278280d90cdce5123505194d345a5'),
('guard_account_status_change','','4d7d6eda05706cb4915ac6d09f0f55c8','57728168fc2568f3ffd2b54be64ad545','f2072cfb4a3ddc5c6370191a378f6400'),
('is_active_family_participant','p_family_id uuid','3ea90b1679ba5298ca9c182f3656b93f','09c5e7e274bd6004bc9fc757b0d829e1','3d2384df7f3ca6fc2e905c2946a0d296'),
('is_app_admin','','25e2e8eddc2262f5a8857809d86e1f75','d126543df6f2e475332b00037823b1d2','5387a31fcee9b0ba281c9f16adceee8e'),
('is_platform_staff','p_roles text[]','5b2bc442c06de5c432a089b0a7d894e6','65e4f7b647e129dc66eaa8aa94d0bd2c','e622d5d525e328c3c2e03214f3212a25'),
('is_workspace_member','p_workspace_id uuid','51a764e62edf69ab00d434dca89a18bd','acc85d80b2780bb8827098b5a04bac82','28d23b2a21b141869a2cc5e18458ec43'),
('is_workspace_owner','p_workspace_id uuid','d2d732726b25ce9dfd7c909bae3ce571','63c2d745568eeca04de11628da8851d9','9a5980e7c62b802e09484d9994d40af3'),
('reserve_admin_user_invitation','p_actor_id uuid, p_email text, p_full_name text, p_country_code text, p_plan_id uuid, p_workspace_name text, p_billing_period text, p_subscription_currency text, p_entitlement_start_date date, p_paid_through_date date, p_enabled_currencies text[], p_default_currency text, p_family_limit integer, p_can_add_members boolean, p_payment_received boolean, p_payment_amount numeric, p_payment_currency text, p_payment_date date, p_payment_method text, p_payment_reference text, p_payment_notes text','75fbf8b7d3e4e6a383d659716de857e4','dc262400133a59a2f5a074d1bc30d15f','fefb6ad0ba496525360955d3d0485c42'),
('review_subscription_payment','p_payment_id uuid, p_decision text, p_reason text','0659e5f3461f9041cce1cd90dc6cf7cc','42770f079019e2a4494882b3c634b9b1','81ecee082da548657354dae90e180a29'),
('review_subscription_payment_before_business_public','p_payment_id uuid, p_decision text, p_reason text','5292be8cf33b27c0ade130e1dd0ac121','b2786310727d9eb1c41038f2e356f851','15056e1d35f24b2cbdc49e2ae24b381b'),
('review_subscription_payment_before_business_stage10','p_payment_id uuid, p_decision text, p_reason text','a86977601ab5825790cd38957fc998f9','f786734a6ca38a44ef725a1fba84855e','8016005b073a7b3fc7bb492707ccd909'),
('save_admin_finance_currency_settings','p_reporting_currency text, p_enabled_receipt_currencies text[], p_conversion_enabled boolean','ade932dfb2ae1ab036f15651fc4411d6','ce8905e9686f18d4d18cfe8fe1ae8f41','9780b1dbfe21ebd2dde3542719a5fb16'),
('save_business_billing_settings','p_plan_id uuid, p_expected_version integer, p_pilot_enabled boolean, p_included_seats integer, p_currency text, p_monthly_base numeric, p_annual_base numeric, p_monthly_seat numeric, p_annual_seat numeric, p_payment_instructions text','09cda50ebcb51cabbc6627718c1da675','8ef85214e2a315627c2866bdaf5079b9','c5afa289622506cc1a8d350eff19fef0'),
('save_manual_payment_conversion','p_entity_type text, p_entity_id uuid, p_reporting_currency text, p_exchange_rate numeric, p_converted_amount numeric','413e75353fb5cdd3a00daa0b1878a638','c261f72280d7bfe79e8f344bbfede6e6','fa3a8660710c91985b89dcb88b398dde'),
('save_plan_definition','p_plan_id uuid, p_code text, p_display_name text, p_description text, p_marketing_summary text, p_workspace_type text, p_included_member_seats integer, p_active_payment_limit integer, p_is_active boolean, p_is_public boolean, p_is_featured boolean, p_available_for_purchase boolean, p_cta_label text, p_sort_order integer, p_feature_codes text[]','c94a23a0e53b5027ae021366acf8fab9','87371c9148deade303c41f96eefb5baf','79ed08545feef06b3a18d0b3d1c6f260'),
('save_plan_price','p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_extra_member_amount numeric','d6327f9346043296987cc7c0bcba440a','ed027a01bf05b9012f5db4c36f9a30c6','32d2812e91775f2e9182003a3c87861b'),
('set_user_account_status','p_user_id uuid, p_status text','3dfcdad3f784e843f67f94eb71de2501','458cdbf31a813ee88be1b9b3305aa67d','28ee395799dc3e639f6792eff5eb0285'),
('transfer_business_ownership','p_workspace_id uuid, p_new_owner_member_id uuid, p_confirmation_name text','070281c6f66cf6114b9032196079d746','b8bd1d62e031f4007220a877d6260fb3','572d6b0b4239181d7c5af362b21733ec'),
('workspace_member_usage','p_workspace_id uuid','6e6518e57c9ad8dc6a220bb5390aa1ce','1c9fd57d6ea64ca1746fa4dba47963bd','27624176bba510dbd5a92312e5fdb37e')),
routine_checks as (
 select e.name,p.oid,p.proacl,
 coalesce(md5(p.prosrc)=e.lf_md5,false) lf_match,
 coalesce(md5(p.prosrc)=e.crlf_md5,false) crlf_match,
 coalesce(md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))=e.shape_md5,false) shape_match
 from expected_routines e left join pg_proc p on p.proname=e.name and p.pronamespace='public'::regnamespace and pg_get_function_identity_arguments(p.oid)=e.args),
expected_policies(schema_name,relation_name,name,command,permissive,roles,using_expression,check_expression) as (values
('public','admin_audit_logs','Admins can manage audit logs','*',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))','((actor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))'),
('public','admin_finance_settings','Finance staff can read admin currency settings','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])',''),
('public','admin_subscription_grants','Super admins can read manual grants','r',true,'authenticated','(is_platform_staff(ARRAY[''super_admin''::text]) AND (NOT my_account_suspended()))',''),
('public','admin_support_notes','Admins can manage support notes','*',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))','((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))'),
('public','admin_user_invitation_audit','Authorized admins can read user invitation audit','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])',''),
('public','admin_user_invitations','Authorized admins can read user invitations','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])',''),
('public','category_budgets','Owners and admins can create category budgets','a',true,'authenticated','','((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))))'),
('public','category_budgets','Owners and admins can delete category budgets','d',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','category_budgets','Owners and admins can read category budgets','r',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','category_budgets','Owners and admins can update category budgets','w',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))','((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))))'),
('public','countries','Staff can read countries','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])',''),
('public','enquiries','Staff can read enquiries','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])',''),
('public','enquiries','Staff can update enquiries','w',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])'),
('public','exchange_rate_sync_runs','Finance staff can read rate sync diagnostics','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])',''),
('public','expenses','Approved heads and admins can create expenses','a',true,'authenticated','','((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id))))))'),
('public','expenses','Approved heads and admins can delete expenses','d',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','expenses','Approved heads and admins can read expenses','r',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','expenses','Approved heads and admins can update expenses','w',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))','((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id))))))'),
('public','families','Approved heads and admins can update families','w',true,'authenticated','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid)))','((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid)))'),
('public','families','Owners and admins can delete families','d',true,'authenticated','((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))',''),
('public','family_heads','Admins and matching heads can read head approvals','r',true,'authenticated','((lower(email) = lower(( SELECT (auth.jwt() ->> ''email''::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))',''),
('public','family_heads','Admins can create head approvals','a',true,'authenticated','','((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))'),
('public','family_heads','Admins can delete head approvals','d',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))',''),
('public','family_heads','Admins can update head approvals','w',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))'),
('public','family_invitations','Invitation participants can read invitations','r',true,'authenticated','((invited_by = ( SELECT auth.uid() AS uid)) OR (lower(invitee_email) = lower(( SELECT (auth.jwt() ->> ''email''::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))',''),
('public','family_members','Approved heads and admins can delete family members','d',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))',''),
('public','family_members','Approved heads and admins can update family members','w',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))'),
('public','notifications','Users can create relevant notifications','a',true,'authenticated','','((created_by = ( SELECT auth.uid() AS uid)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (email IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))'),
('storage','objects','Owners and finance staff can read subscription proofs','r',true,'authenticated','((bucket_id = ''subscription-proofs''::text) AND (is_workspace_owner(((storage.foldername(name))[2])::uuid) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text])))',''),
('storage','objects','Owners can delete payment proofs','d',true,'authenticated','((bucket_id = ''payment-proofs''::text) AND ((((storage.foldername(name))[1] = ''personal''::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = ''families''::text) AND ((storage.foldername(name))[3] = (( SELECT auth.uid() AS uid))::text)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))',''),
('storage','objects','Users can read permitted payment proofs','r',true,'authenticated','((bucket_id = ''payment-proofs''::text) AND ((((storage.foldername(name))[1] = ''personal''::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = ''families''::text) AND is_active_family_participant(((storage.foldername(name))[2])::uuid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))',''),
('public','payment_conversions','Authorized users can read payment conversions','r',true,'authenticated','(((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id)) OR ((workspace_id IS NULL) AND is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])))',''),
('public','payment_items','Household owners can delete payment items','d',true,'authenticated','(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','payment_items','Household owners can update payment items','w',true,'authenticated','(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = ''family''::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))','((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = ''personal''::text) AND (family_id IS NULL) AND (responsible_member_id IS NULL)) OR ((visibility = ''family''::text) AND is_active_family_participant(family_id))) AND ((responsible_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = payment_items.responsible_member_id) AND (family_members.family_id = payment_items.family_id))))))'),
('public','payment_records','Household owners can delete payment records','d',true,'authenticated','(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))',''),
('public','payment_records','Household owners can update payment records','w',true,'authenticated','(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = ''family''::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))','((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = ''personal''::text) AND (family_id IS NULL)) OR ((visibility = ''family''::text) AND is_active_family_participant(family_id))))'),
('public','payments','Admins can create payments','a',true,'authenticated','','((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))'),
('public','payments','Admins can delete payments','d',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))',''),
('public','payments','Admins can read payments','r',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))',''),
('public','payments','Admins can update payments','w',true,'authenticated','(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))','((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))'),
('public','plan_prices','Authenticated users can read active plan prices','r',true,'authenticated','(is_active OR is_platform_staff(NULL::text[]))',''),
('public','plans','Authenticated users can read active plans','r',true,'authenticated','(is_active OR is_platform_staff(NULL::text[]))',''),
('public','profiles','Users and admins can read profiles','r',true,'authenticated','((( SELECT auth.uid() AS uid) = id) OR ( SELECT is_app_admin() AS is_app_admin))',''),
('public','public_enquiry_events','Support staff can read public enquiry events','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])',''),
('public','subscription_audit_events','business_subscription_audit_owner_guard','r',false,'authenticated','((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_audit_events.workspace_id) AND (budget_workspaces.workspace_type = ''business''::text))))) OR business_billing_owner(workspace_id) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))',''),
('public','subscription_entitlement_history','business_entitlement_history_owner_guard','r',false,'authenticated','((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_entitlement_history.workspace_id) AND (budget_workspaces.workspace_type = ''business''::text))))) OR business_billing_owner(workspace_id) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))',''),
('public','subscription_invoices','Owners can read subscription invoices','r',true,'authenticated','(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))',''),
('public','subscription_payment_proofs','Owners can read subscription proofs','r',true,'authenticated','((uploaded_by = auth.uid()) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))',''),
('public','subscription_payment_reviews','Finance staff can read reviews','r',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text])',''),
('public','subscription_payments','Owners can read subscription payments','r',true,'authenticated','(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))',''),
('public','subscription_renewal_requests','Owners can read renewal requests','r',true,'authenticated','(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))',''),
('public','support_ticket_messages','Customers and support staff can add ticket messages','a',true,'authenticated','','((author_id = ( SELECT auth.uid() AS uid)) AND (is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid)) AND (support_tickets.status <> ''closed''::text)))))))'),
('public','support_ticket_messages','Customers and support staff can read ticket messages','r',true,'authenticated','(is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid)))))))',''),
('public','support_tickets','Administrators can delete tickets','d',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])',''),
('public','support_tickets','Customers and support staff can create tickets','a',true,'authenticated','','((created_by = ( SELECT auth.uid() AS uid)) AND (((customer_id = ( SELECT auth.uid() AS uid)) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)) AND (assigned_admin_id IS NULL) AND (status = ''open''::text) AND (resolved_at IS NULL)) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])))'),
('public','support_tickets','Customers and support staff can read tickets','r',true,'authenticated','((customer_id = ( SELECT auth.uid() AS uid)) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]))',''),
('public','support_tickets','Support staff can update tickets','w',true,'authenticated','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])','is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])'),
('public','supported_currencies','Authenticated users can read supported currencies','r',true,'authenticated','(is_active OR is_platform_staff(NULL::text[]))','')),
policy_checks as (
 select e.schema_name,e.relation_name,e.name,coalesce(p.polcmd=e.command and p.polpermissive=e.permissive
 and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)=e.roles
 and coalesce(pg_get_expr(p.polqual,p.polrelid),'')=e.using_expression
 and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')=e.check_expression,false) matches
 from expected_policies e left join pg_policy p on p.polrelid=to_regclass(e.schema_name||'.'||e.relation_name) and p.polname=e.name),
staff_counts as (select role,count(*) n from public.app_admins group by role),
operators as (select count(distinct a.user_id) n from public.app_admins a join public.profiles p on p.id=a.user_id
 join auth.mfa_factors f on f.user_id=a.user_id where a.role='super_admin' and p.account_status='active' and f.factor_type='totp' and f.status='verified')
select jsonb_build_object(
 'stage_step','3.4.3','scope','READ_ONLY_SELECTED_METADATA','project_selection','OWNER_MUST_CONFIRM_STAGING',
 'selected_routines',(select count(*) from routine_checks),
 'routine_lf_body_matches',(select count(*) from routine_checks where lf_match),
 'routine_crlf_body_matches',(select count(*) from routine_checks where crlf_match),
 'routine_body_or_shape_mismatches',(select count(*) from routine_checks where not ((lf_match or crlf_match) and shape_match)),
 'routine_mismatch_names',(select coalesce(jsonb_agg(name order by name),'[]'::jsonb) from routine_checks where not ((lf_match or crlf_match) and shape_match)),
 'modeled_source_not_hosted_grants',false,
 'selected_anonymous_executable_routines',(select count(*) from routine_checks where oid is not null and has_function_privilege('anon',oid,'execute')),
 'selected_authenticated_executable_routines',(select count(*) from routine_checks where oid is not null and has_function_privilege('authenticated',oid,'execute')),
 'selected_policies',(select count(*) from policy_checks),
 'policy_mismatches',(select count(*) from policy_checks where not matches),
 'policy_mismatch_names',(select coalesce(jsonb_agg(schema_name||'.'||relation_name||' / '||name order by schema_name,relation_name,name),'[]'::jsonb) from policy_checks where not matches),
 'platform_role_counts',(select coalesce(jsonb_object_agg(role,n),'{}'::jsonb) from staff_counts),
 'active_super_users_with_verified_totp',(select n from operators),
 'candidate_helpers_present',(select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('admin_mfa_satisfied','platform_admin_authorized','admin_mfa_status')),
 'readiness',case when (select n from operators)=0 then 'BLOCKED_NO_VERIFIED_SUPER_OPERATOR' else 'VERIFIED_SUPER_EXISTS_CONTROLLED_IDENTITY_AND_RECOVERY_UNVERIFIED' end,
 'auth_settings_verified',false,'recovery_verified',false,'hosted_acceptance',false
) as admin_mfa_readiness;
commit;
