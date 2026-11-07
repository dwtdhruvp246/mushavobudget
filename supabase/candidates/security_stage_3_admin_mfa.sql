-- 3.4.2 REVIEW CANDIDATE ONLY. Not an ordered migration; do not paste as readiness SQL.
-- Source parent 9703bcac1731c1f5b68b7c3537ab0e27b3a2ae72; no Auth/user/factor/history mutation.
-- Operator must review recovery, baseline drift, effective grants and isolated staging actor first.
begin;
set local search_path=public,pg_temp;
do $guard$
begin
 if current_setting('mushavo.admin_mfa_recovery_reviewed',true) is distinct from 'yes' then raise exception 'ADMIN_MFA_RECOVERY_REVIEW_REQUIRED'; end if;
 if to_regprocedure('public.admin_mfa_satisfied()') is not null then raise exception 'ADMIN_MFA_ALREADY_INSTALLED'; end if;
 if not exists(select 1 from public.app_admins a join public.profiles p on p.id=a.user_id join auth.mfa_factors f on f.user_id=a.user_id where a.role='super_admin' and p.account_status='active' and f.factor_type='totp' and f.status='verified') then raise exception 'ADMIN_MFA_CONTROLLED_OPERATOR_REQUIRED'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_analytics_foundation' and pg_get_function_identity_arguments(p.oid)='p_from date, p_to date' and md5(p.prosrc) in ('99ef14370afce2b0ff25c12bf3d17cd3','600fe33921647b5dfb2694148a8c96f3') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='5fb39f35e1d1cb476424d33492ddb8d2') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_analytics_foundation'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_analytics_page' and pg_get_function_identity_arguments(p.oid)='p_from date, p_to date, p_country text, p_plan text, p_workspace_type text, p_subscription_status text, p_billing_period text, p_currency text' and md5(p.prosrc) in ('55957503f7d2b0cea488ddafeea7ce27','38650056226b47d18a77cf8ee381e72b') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='e31ff95af582cbf1060da575242f2d07') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_analytics_page'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_business_billing_settings' and pg_get_function_identity_arguments(p.oid)='' and md5(p.prosrc) in ('4ad0f4db75fcbd7788e56552fcb94512','076495aaad938193083738b917eb586d') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='5117af4b14c6510b391eae5ba76d4e19') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_business_billing_settings'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_business_set_status' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid, p_status text, p_expected_version integer, p_confirmation_name text, p_reason text, p_request_id uuid' and md5(p.prosrc) in ('8d7029a14bc6b711e8d8ae916f5b1521','d8fe0c77da484ea3c195ccf214610157') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='4010c052a99b998ec165111c34a6c9c6') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_business_set_status'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_business_subscription_payment_detail' and pg_get_function_identity_arguments(p.oid)='p_payment_id uuid' and md5(p.prosrc) in ('c24c804f6a2049e4792aeea819892c58','3d9bc1693140b742873c63aaad36d89f') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='3622b61c0f9aa4ea37623a043c34d45d') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_business_subscription_payment_detail'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_business_support_snapshot' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid, p_offset integer' and md5(p.prosrc) in ('031fca5c3b890d6221f69f3b0f59825b','f3e42a8d9df90ef57dd121c2887095fe') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='a9e9eca997c5b628d26e2d37c1eaa936') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_business_support_snapshot'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_business_transfer_owner' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid, p_new_owner_member_id uuid, p_expected_owner_id uuid, p_expected_version integer, p_confirmation_name text, p_confirmation_email text, p_reason text, p_request_id uuid' and md5(p.prosrc) in ('175ef8648601700db626cdacb6fb0294','5ba455df17200a39bbb0ac1c35b48be1') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='d39740818f223876f45f339396719bbd') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_business_transfer_owner'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_cancel_scheduled_plan_price' and pg_get_function_identity_arguments(p.oid)='p_plan_id uuid, p_price_id uuid, p_edit_token text' and md5(p.prosrc) in ('94f7097ba883f093303ce92d07d49aba','2de5e82bb3b66e21886813d66f70d973') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='bf3b2a4054a0c08531b78d2d2ebd4e0a') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_cancel_scheduled_plan_price'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_grant_manual_subscription' and pg_get_function_identity_arguments(p.oid)='p_owner_id uuid, p_workspace_id uuid, p_plan_id uuid, p_billing_period text, p_starts_on date, p_ends_on date, p_reason text, p_new_business_name text' and md5(p.prosrc) in ('e5de74ee9405c3bc6765346201ff1b8a','58391fb3507bceacfabd1246a76d1bd0') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='b0f9abb71e1cf8151d76ab1223c8d1f5') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_grant_manual_subscription'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_plan_calculation_preview' and pg_get_function_identity_arguments(p.oid)='p_workspace_type text, p_base numeric, p_seat_price numeric, p_included integer, p_total integer, p_extra integer, p_start timestamp with time zone, p_end timestamp with time zone, p_at timestamp with time zone, p_period text' and md5(p.prosrc) in ('d21112de384008ebeecc1e82d267954f','2afa85c55aa47ec989ff58a3c23de233') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='ffc27e1f92aa6d6269d01a9f3b322ca5') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_plan_calculation_preview'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_plan_workbench_snapshot' and pg_get_function_identity_arguments(p.oid)='p_plan_id uuid' and md5(p.prosrc) in ('05e562d9eeaf540c96daeb1cf516e1dd','59b96379d8d45ce159073b475261c103') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='f2ba84340d9c200819312b376604cc7a') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_plan_workbench_snapshot'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_save_plan_workbench' and pg_get_function_identity_arguments(p.oid)='p_plan_id uuid, p_edit_token text, p_definition jsonb, p_business jsonb, p_price jsonb' and md5(p.prosrc) in ('d39e7c1f5bd71b3e6ec4bee24a53e56b','0e4c32c08f26e34f4b7756796accfc90') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='5d82d8fa5d8097f54e78e18a1dabaffb') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_save_plan_workbench'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='admin_subscription_monitor' and pg_get_function_identity_arguments(p.oid)='' and md5(p.prosrc) in ('946b83d1d33388628eff3798a6a84455','a680a12697e14f036949558bdfebbcb5') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='49352b8b26c8872c7634e0b4d9c19f29') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: admin_subscription_monitor'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='backfill_currency_conversions' and pg_get_function_identity_arguments(p.oid)='' and md5(p.prosrc) in ('37870f1342cdc68a3eae523511ab5374','8dcfbe24b59de68273bae49d6267fbeb') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='5a7a27654a47edeb8c543a77f2196199') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: backfill_currency_conversions'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='business_admin_test_permit' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid, p_owner_id uuid' and md5(p.prosrc) in ('45fdae49edde60e8282c63184908fe98','b9567252671bc68b43e5edbc39bb7398') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='c8384fab0c8ecabef8956cca6c5dd457') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: business_admin_test_permit'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='business_subscription_proof_access' and pg_get_function_identity_arguments(p.oid)='p_path text, p_write boolean' and md5(p.prosrc) in ('29384de40e5d5a2dd1f336727a254040','1c3243572ec569fcccbf0f753bcc53f8') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='e425214221e9b1dc3e9564f8278238f3') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: business_subscription_proof_access'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='enqueue_admin_event_notification' and pg_get_function_identity_arguments(p.oid)='p_event_type text, p_source_id uuid, p_actor_id uuid' and md5(p.prosrc) in ('304a36476209573a56a42035987ec6d8','3add245d905f928c3f9e72e98e6dfd9e') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='d9ca5b9e727cd7c499574e909b3865c5') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: enqueue_admin_event_notification'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='exchange_rate_status' and pg_get_function_identity_arguments(p.oid)='p_include_admin_details boolean' and md5(p.prosrc) in ('1e8f16389c6331922aa7f5a5ecfad445','43a92c038b595f0f4030435a4a7dd40e') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='48e278280d90cdce5123505194d345a5') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: exchange_rate_status'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='guard_account_status_change' and pg_get_function_identity_arguments(p.oid)='' and md5(p.prosrc) in ('4d7d6eda05706cb4915ac6d09f0f55c8','57728168fc2568f3ffd2b54be64ad545') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='f2072cfb4a3ddc5c6370191a378f6400') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: guard_account_status_change'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_active_family_participant' and pg_get_function_identity_arguments(p.oid)='p_family_id uuid' and md5(p.prosrc) in ('3ea90b1679ba5298ca9c182f3656b93f','09c5e7e274bd6004bc9fc757b0d829e1') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='3d2384df7f3ca6fc2e905c2946a0d296') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: is_active_family_participant'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_app_admin' and pg_get_function_identity_arguments(p.oid)='' and md5(p.prosrc) in ('25e2e8eddc2262f5a8857809d86e1f75','d126543df6f2e475332b00037823b1d2') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='5387a31fcee9b0ba281c9f16adceee8e') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: is_app_admin'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_platform_staff' and pg_get_function_identity_arguments(p.oid)='p_roles text[]' and md5(p.prosrc) in ('5b2bc442c06de5c432a089b0a7d894e6','65e4f7b647e129dc66eaa8aa94d0bd2c') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='e622d5d525e328c3c2e03214f3212a25') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: is_platform_staff'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_workspace_member' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid' and md5(p.prosrc) in ('51a764e62edf69ab00d434dca89a18bd','acc85d80b2780bb8827098b5a04bac82') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='28d23b2a21b141869a2cc5e18458ec43') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: is_workspace_member'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='is_workspace_owner' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid' and md5(p.prosrc) in ('d2d732726b25ce9dfd7c909bae3ce571','63c2d745568eeca04de11628da8851d9') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='9a5980e7c62b802e09484d9994d40af3') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: is_workspace_owner'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='reserve_admin_user_invitation' and pg_get_function_identity_arguments(p.oid)='p_actor_id uuid, p_email text, p_full_name text, p_country_code text, p_plan_id uuid, p_workspace_name text, p_billing_period text, p_subscription_currency text, p_entitlement_start_date date, p_paid_through_date date, p_enabled_currencies text[], p_default_currency text, p_family_limit integer, p_can_add_members boolean, p_payment_received boolean, p_payment_amount numeric, p_payment_currency text, p_payment_date date, p_payment_method text, p_payment_reference text, p_payment_notes text' and md5(p.prosrc) in ('75fbf8b7d3e4e6a383d659716de857e4','dc262400133a59a2f5a074d1bc30d15f') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='fefb6ad0ba496525360955d3d0485c42') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: reserve_admin_user_invitation'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_subscription_payment' and pg_get_function_identity_arguments(p.oid)='p_payment_id uuid, p_decision text, p_reason text' and md5(p.prosrc) in ('0659e5f3461f9041cce1cd90dc6cf7cc','42770f079019e2a4494882b3c634b9b1') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='81ecee082da548657354dae90e180a29') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: review_subscription_payment'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_subscription_payment_before_business_public' and pg_get_function_identity_arguments(p.oid)='p_payment_id uuid, p_decision text, p_reason text' and md5(p.prosrc) in ('5292be8cf33b27c0ade130e1dd0ac121','b2786310727d9eb1c41038f2e356f851') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='15056e1d35f24b2cbdc49e2ae24b381b') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: review_subscription_payment_before_business_public'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='review_subscription_payment_before_business_stage10' and pg_get_function_identity_arguments(p.oid)='p_payment_id uuid, p_decision text, p_reason text' and md5(p.prosrc) in ('a86977601ab5825790cd38957fc998f9','f786734a6ca38a44ef725a1fba84855e') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='8016005b073a7b3fc7bb492707ccd909') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: review_subscription_payment_before_business_stage10'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_admin_finance_currency_settings' and pg_get_function_identity_arguments(p.oid)='p_reporting_currency text, p_enabled_receipt_currencies text[], p_conversion_enabled boolean' and md5(p.prosrc) in ('ade932dfb2ae1ab036f15651fc4411d6','ce8905e9686f18d4d18cfe8fe1ae8f41') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='9780b1dbfe21ebd2dde3542719a5fb16') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: save_admin_finance_currency_settings'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_business_billing_settings' and pg_get_function_identity_arguments(p.oid)='p_plan_id uuid, p_expected_version integer, p_pilot_enabled boolean, p_included_seats integer, p_currency text, p_monthly_base numeric, p_annual_base numeric, p_monthly_seat numeric, p_annual_seat numeric, p_payment_instructions text' and md5(p.prosrc) in ('09cda50ebcb51cabbc6627718c1da675','8ef85214e2a315627c2866bdaf5079b9') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='c5afa289622506cc1a8d350eff19fef0') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: save_business_billing_settings'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_manual_payment_conversion' and pg_get_function_identity_arguments(p.oid)='p_entity_type text, p_entity_id uuid, p_reporting_currency text, p_exchange_rate numeric, p_converted_amount numeric' and md5(p.prosrc) in ('413e75353fb5cdd3a00daa0b1878a638','c261f72280d7bfe79e8f344bbfede6e6') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='fa3a8660710c91985b89dcb88b398dde') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: save_manual_payment_conversion'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_plan_definition' and pg_get_function_identity_arguments(p.oid)='p_plan_id uuid, p_code text, p_display_name text, p_description text, p_marketing_summary text, p_workspace_type text, p_included_member_seats integer, p_active_payment_limit integer, p_is_active boolean, p_is_public boolean, p_is_featured boolean, p_available_for_purchase boolean, p_cta_label text, p_sort_order integer, p_feature_codes text[]' and md5(p.prosrc) in ('c94a23a0e53b5027ae021366acf8fab9','87371c9148deade303c41f96eefb5baf') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='79ed08545feef06b3a18d0b3d1c6f260') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: save_plan_definition'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='save_plan_price' and pg_get_function_identity_arguments(p.oid)='p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_extra_member_amount numeric' and md5(p.prosrc) in ('d6327f9346043296987cc7c0bcba440a','ed027a01bf05b9012f5db4c36f9a30c6') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='32d2812e91775f2e9182003a3c87861b') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: save_plan_price'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='set_user_account_status' and pg_get_function_identity_arguments(p.oid)='p_user_id uuid, p_status text' and md5(p.prosrc) in ('3dfcdad3f784e843f67f94eb71de2501','458cdbf31a813ee88be1b9b3305aa67d') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='28ee395799dc3e639f6792eff5eb0285') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: set_user_account_status'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='transfer_business_ownership' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid, p_new_owner_member_id uuid, p_confirmation_name text' and md5(p.prosrc) in ('070281c6f66cf6114b9032196079d746','b8bd1d62e031f4007220a877d6260fb3') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='572d6b0b4239181d7c5af362b21733ec') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: transfer_business_ownership'; end if;
 if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='workspace_member_usage' and pg_get_function_identity_arguments(p.oid)='p_workspace_id uuid' and md5(p.prosrc) in ('6e6518e57c9ad8dc6a220bb5390aa1ce','1c9fd57d6ea64ca1746fa4dba47963bd') and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))='27624176bba510dbd5a92312e5fdb37e') then raise exception 'ADMIN_MFA_SOURCE_DRIFT: workspace_member_usage'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_audit_logs'::regclass and p.polname='Admins can manage audit logs' and p.polcmd='*' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((actor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_audit_logs / Admins can manage audit logs'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_finance_settings'::regclass and p.polname='Finance staff can read admin currency settings' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_finance_settings / Finance staff can read admin currency settings'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_subscription_grants'::regclass and p.polname='Super admins can read manual grants' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_platform_staff(ARRAY[''super_admin''::text]) AND (NOT my_account_suspended()))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_subscription_grants / Super admins can read manual grants'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_support_notes'::regclass and p.polname='Admins can manage support notes' and p.polcmd='*' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_support_notes / Admins can manage support notes'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_user_invitation_audit'::regclass and p.polname='Authorized admins can read user invitation audit' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_user_invitation_audit / Authorized admins can read user invitation audit'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.admin_user_invitations'::regclass and p.polname='Authorized admins can read user invitations' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: admin_user_invitations / Authorized admins can read user invitations'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.category_budgets'::regclass and p.polname='Owners and admins can create category budgets' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: category_budgets / Owners and admins can create category budgets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.category_budgets'::regclass and p.polname='Owners and admins can delete category budgets' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: category_budgets / Owners and admins can delete category budgets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.category_budgets'::regclass and p.polname='Owners and admins can read category budgets' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: category_budgets / Owners and admins can read category budgets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.category_budgets'::regclass and p.polname='Owners and admins can update category budgets' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: category_budgets / Owners and admins can update category budgets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.countries'::regclass and p.polname='Staff can read countries' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: countries / Staff can read countries'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.enquiries'::regclass and p.polname='Staff can read enquiries' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: enquiries / Staff can read enquiries'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.enquiries'::regclass and p.polname='Staff can update enquiries' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])') then raise exception 'ADMIN_MFA_POLICY_DRIFT: enquiries / Staff can update enquiries'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.exchange_rate_sync_runs'::regclass and p.polname='Finance staff can read rate sync diagnostics' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: exchange_rate_sync_runs / Finance staff can read rate sync diagnostics'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.expenses'::regclass and p.polname='Approved heads and admins can create expenses' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: expenses / Approved heads and admins can create expenses'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.expenses'::regclass and p.polname='Approved heads and admins can delete expenses' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: expenses / Approved heads and admins can delete expenses'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.expenses'::regclass and p.polname='Approved heads and admins can read expenses' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: expenses / Approved heads and admins can read expenses'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.expenses'::regclass and p.polname='Approved heads and admins can update expenses' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: expenses / Approved heads and admins can update expenses'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.families'::regclass and p.polname='Approved heads and admins can update families' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid)))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid)))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: families / Approved heads and admins can update families'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.families'::regclass and p.polname='Owners and admins can delete families' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: families / Owners and admins can delete families'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_heads'::regclass and p.polname='Admins and matching heads can read head approvals' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((lower(email) = lower(( SELECT (auth.jwt() ->> ''email''::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_heads / Admins and matching heads can read head approvals'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_heads'::regclass and p.polname='Admins can create head approvals' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_heads / Admins can create head approvals'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_heads'::regclass and p.polname='Admins can delete head approvals' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_heads / Admins can delete head approvals'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_heads'::regclass and p.polname='Admins can update head approvals' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_heads / Admins can update head approvals'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_invitations'::regclass and p.polname='Invitation participants can read invitations' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((invited_by = ( SELECT auth.uid() AS uid)) OR (lower(invitee_email) = lower(( SELECT (auth.jwt() ->> ''email''::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_invitations / Invitation participants can read invitations'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_members'::regclass and p.polname='Approved heads and admins can delete family members' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_members / Approved heads and admins can delete family members'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.family_members'::regclass and p.polname='Approved heads and admins can update family members' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: family_members / Approved heads and admins can update family members'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.notifications'::regclass and p.polname='Users can create relevant notifications' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (email IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: notifications / Users can create relevant notifications'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname='Owners and finance staff can read subscription proofs' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((bucket_id = ''subscription-proofs''::text) AND (is_workspace_owner(((storage.foldername(name))[2])::uuid) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text])))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: objects / Owners and finance staff can read subscription proofs'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname='Owners can delete payment proofs' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((bucket_id = ''payment-proofs''::text) AND ((((storage.foldername(name))[1] = ''personal''::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = ''families''::text) AND ((storage.foldername(name))[3] = (( SELECT auth.uid() AS uid))::text)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: objects / Owners can delete payment proofs'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='storage.objects'::regclass and p.polname='Users can read permitted payment proofs' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((bucket_id = ''payment-proofs''::text) AND ((((storage.foldername(name))[1] = ''personal''::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = ''families''::text) AND is_active_family_participant(((storage.foldername(name))[2])::uuid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: objects / Users can read permitted payment proofs'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payment_conversions'::regclass and p.polname='Authorized users can read payment conversions' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id)) OR ((workspace_id IS NULL) AND is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text])))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payment_conversions / Authorized users can read payment conversions'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payment_items'::regclass and p.polname='Household owners can delete payment items' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payment_items / Household owners can delete payment items'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payment_items'::regclass and p.polname='Household owners can update payment items' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = ''family''::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = ''personal''::text) AND (family_id IS NULL) AND (responsible_member_id IS NULL)) OR ((visibility = ''family''::text) AND is_active_family_participant(family_id))) AND ((responsible_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = payment_items.responsible_member_id) AND (family_members.family_id = payment_items.family_id))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payment_items / Household owners can update payment items'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payment_records'::regclass and p.polname='Household owners can delete payment records' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payment_records / Household owners can delete payment records'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payment_records'::regclass and p.polname='Household owners can update payment records' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(((visibility = ''personal''::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = ''family''::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = ''personal''::text) AND (family_id IS NULL)) OR ((visibility = ''family''::text) AND is_active_family_participant(family_id))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payment_records / Household owners can update payment records'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payments'::regclass and p.polname='Admins can create payments' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payments / Admins can create payments'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payments'::regclass and p.polname='Admins can delete payments' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payments / Admins can delete payments'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payments'::regclass and p.polname='Admins can read payments' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payments / Admins can read payments'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.payments'::regclass and p.polname='Admins can update payments' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE (app_admins.user_id = ( SELECT auth.uid() AS uid)))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: payments / Admins can update payments'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.plan_prices'::regclass and p.polname='Authenticated users can read active plan prices' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_active OR is_platform_staff(NULL::text[]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: plan_prices / Authenticated users can read active plan prices'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.plans'::regclass and p.polname='Authenticated users can read active plans' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_active OR is_platform_staff(NULL::text[]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: plans / Authenticated users can read active plans'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.profiles'::regclass and p.polname='Users and admins can read profiles' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((( SELECT auth.uid() AS uid) = id) OR ( SELECT is_app_admin() AS is_app_admin))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: profiles / Users and admins can read profiles'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.public_enquiry_events'::regclass and p.polname='Support staff can read public enquiry events' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: public_enquiry_events / Support staff can read public enquiry events'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_audit_events'::regclass and p.polname='business_subscription_audit_owner_guard' and p.polcmd='r' and p.polpermissive=false and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_audit_events.workspace_id) AND (budget_workspaces.workspace_type = ''business''::text))))) OR business_billing_owner(workspace_id) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_audit_events / business_subscription_audit_owner_guard'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_entitlement_history'::regclass and p.polname='business_entitlement_history_owner_guard' and p.polcmd='r' and p.polpermissive=false and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_entitlement_history.workspace_id) AND (budget_workspaces.workspace_type = ''business''::text))))) OR business_billing_owner(workspace_id) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_entitlement_history / business_entitlement_history_owner_guard'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_invoices'::regclass and p.polname='Owners can read subscription invoices' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_invoices / Owners can read subscription invoices'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_payment_proofs'::regclass and p.polname='Owners can read subscription proofs' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((uploaded_by = auth.uid()) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_payment_proofs / Owners can read subscription proofs'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_payment_reviews'::regclass and p.polname='Finance staff can read reviews' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''finance_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_payment_reviews / Finance staff can read reviews'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_payments'::regclass and p.polname='Owners can read subscription payments' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_payments / Owners can read subscription payments'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.subscription_renewal_requests'::regclass and p.polname='Owners can read renewal requests' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_workspace_owner(workspace_id) OR is_platform_staff(ARRAY[''finance_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: subscription_renewal_requests / Owners can read renewal requests'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_ticket_messages'::regclass and p.polname='Customers and support staff can add ticket messages' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((author_id = ( SELECT auth.uid() AS uid)) AND (is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid)) AND (support_tickets.status <> ''closed''::text)))))))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_ticket_messages / Customers and support staff can add ticket messages'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_ticket_messages'::regclass and p.polname='Customers and support staff can read ticket messages' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid)))))))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_ticket_messages / Customers and support staff can read ticket messages'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_tickets'::regclass and p.polname='Administrators can delete tickets' and p.polcmd='d' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_tickets / Administrators can delete tickets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_tickets'::regclass and p.polname='Customers and support staff can create tickets' and p.polcmd='a' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='((created_by = ( SELECT auth.uid() AS uid)) AND (((customer_id = ( SELECT auth.uid() AS uid)) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)) AND (assigned_admin_id IS NULL) AND (status = ''open''::text) AND (resolved_at IS NULL)) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])))') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_tickets / Customers and support staff can create tickets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_tickets'::regclass and p.polname='Customers and support staff can read tickets' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='((customer_id = ( SELECT auth.uid() AS uid)) OR is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_tickets / Customers and support staff can read tickets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.support_tickets'::regclass and p.polname='Support staff can update tickets' and p.polcmd='w' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='is_platform_staff(ARRAY[''super_admin''::text, ''admin_staff''::text, ''support_staff''::text])') then raise exception 'ADMIN_MFA_POLICY_DRIFT: support_tickets / Support staff can update tickets'; end if;
 if not exists(select 1 from pg_policy p where p.polrelid='public.supported_currencies'::regclass and p.polname='Authenticated users can read supported currencies' and p.polcmd='r' and p.polpermissive=true and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)='authenticated' and coalesce(pg_get_expr(p.polqual,p.polrelid),'')='(is_active OR is_platform_staff(NULL::text[]))' and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')='') then raise exception 'ADMIN_MFA_POLICY_DRIFT: supported_currencies / Authenticated users can read supported currencies'; end if;
end $guard$;

create function public.admin_mfa_satisfied() returns boolean language sql stable security definer set search_path=public,pg_temp as $mfa$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2'
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active')
 and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified');
$mfa$;
create function public.platform_admin_authorized(p_roles text[] default null) returns boolean language sql stable security definer set search_path=public,pg_temp as $mfa$
 select public.is_platform_staff(p_roles) and public.admin_mfa_satisfied();
$mfa$;
create function public.admin_mfa_status() returns jsonb language sql stable security definer set search_path=public,pg_temp as $mfa$
 select jsonb_build_object('staff',public.is_platform_staff(null),'authorized',public.platform_admin_authorized(null),
 'active',exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active'),
 'has_verified_factor',exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified'));
$mfa$;
revoke all on function public.admin_mfa_satisfied(),public.platform_admin_authorized(text[]),public.admin_mfa_status() from public,anon;
grant execute on function public.admin_mfa_satisfied(),public.platform_admin_authorized(text[]),public.admin_mfa_status() to authenticated,service_role;

-- Existing routine ACLs/security settings remain those returned by pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.admin_analytics_foundation(p_from date DEFAULT (CURRENT_DATE - 29), p_to date DEFAULT CURRENT_DATE)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_result jsonb;
begin
  if not public.platform_admin_authorized(null) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to > current_date
     or p_to - p_from > 365 then
    raise exception 'INVALID_ANALYTICS_DATE_RANGE';
  end if;

  with eligible_users as (
    select p.id, p.country_code, p.signup_source,
      case when p.signup_source = 'admin_invitation' then i.completed_at else p.created_at end as joined_at
    from public.profiles p
    left join public.admin_user_invitations i on i.id = p.admin_invitation_id
    where p.signup_source <> 'admin_invitation'
       or (i.status = 'provisioned' and i.provisioned_workspace_id is not null and i.completed_at is not null)
  ), active_users as (
    select distinct a.user_id
    from public.analytics_activity_hours a
    where a.hour_start >= (p_from::timestamp at time zone 'UTC')
      and a.hour_start < ((p_to + 1)::timestamp at time zone 'UTC')
  ), approved_revenue as (
    select sp.id, sp.amount, sp.currency, sp.workspace_id,
      coalesce(r.created_at, sp.updated_at) as recognized_at
    from public.subscription_payments sp
    left join public.subscription_payment_reviews r on r.payment_id = sp.id and r.decision = 'approved'
    where sp.status = 'approved'
  ), current_plan_counts as (
    select plan.code, plan.display_name, count(*)::integer as workspace_count
    from public.workspace_subscriptions s
    join public.budget_workspaces w on w.id = s.workspace_id and w.status = 'active'
    join public.plans plan on plan.id = s.plan_id
    where s.status = 'active'
      and (plan.code = 'free' or s.paid_through_at is null or s.paid_through_at::date >= current_date)
    group by plan.code, plan.display_name
  ), monthly_run_rate as (
    select paid_invoice.currency, sum(case when s.billing_period = 'annual'
      then paid_invoice.amount / 12 else paid_invoice.amount end)::numeric(14, 2) as amount
    from public.workspace_subscriptions s
    join public.budget_workspaces w on w.id = s.workspace_id and w.status = 'active'
    join public.plans plan on plan.id = s.plan_id and plan.code <> 'free'
    join lateral (
      select i.total_amount as amount, i.currency from public.subscription_invoices i
      where i.workspace_id = s.workspace_id and i.status = 'paid'
        and i.plan_code = plan.code and i.billing_period = s.billing_period
      order by i.paid_at desc nulls last, i.issued_at desc
      limit 1
    ) paid_invoice on true
    where s.status = 'active' and s.billing_period in ('monthly', 'annual')
      and s.paid_through_at::date >= current_date
    group by paid_invoice.currency
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from eligible_users),
      'new', (select count(*) from eligible_users
        where joined_at >= (p_from::timestamp at time zone 'UTC')
          and joined_at < ((p_to + 1)::timestamp at time zone 'UTC')),
      'active_in_range', (select count(*) from active_users),
      'active_last_24_hours', (select count(distinct a.user_id)
        from public.analytics_activity_hours a join eligible_users u on u.id = a.user_id
        where a.last_seen_at >= now() - interval '24 hours')
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'date', days.day::date, 'signups', (select count(*) from eligible_users u
        where u.joined_at >= (days.day::date::timestamp at time zone 'UTC')
          and u.joined_at < ((days.day::date + 1)::timestamp at time zone 'UTC')),
      'active_users', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join eligible_users u on u.id = a.user_id
        where a.hour_start >= (days.day::date::timestamp at time zone 'UTC')
          and a.hour_start < ((days.day::date + 1)::timestamp at time zone 'UTC'))
    ) order by days.day)
      from generate_series(p_from, p_to, interval '1 day') as days(day)), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object(
      'code', country, 'users', users) order by users desc, country)
      from (select coalesce(country_code, 'unknown') country, count(*) users
        from eligible_users group by 1) by_country), '[]'::jsonb),
    'signup_sources', coalesce((select jsonb_agg(jsonb_build_object(
      'source', signup_source, 'users', users) order by signup_source)
      from (select signup_source, count(*) users from eligible_users group by signup_source) by_source), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(to_jsonb(c) order by c.workspace_count desc, c.code)
      from current_plan_counts c), '[]'::jsonb),
    'workspaces', coalesce((select jsonb_agg(jsonb_build_object(
      'type', workspace_type, 'status', status, 'count', total) order by workspace_type, status)
      from (select workspace_type, status, count(*) total from public.budget_workspaces
        group by workspace_type, status) w), '[]'::jsonb),
    'revenue_by_currency', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', currency, 'collected', collected, 'payments', payments) order by currency)
      from (select currency, sum(amount)::numeric(14, 2) collected, count(*) payments
        from approved_revenue where recognized_at >= (p_from::timestamp at time zone 'UTC')
          and recognized_at < ((p_to + 1)::timestamp at time zone 'UTC') group by currency) r), '[]'::jsonb),
    'monthly_run_rate_by_currency', coalesce((select jsonb_agg(to_jsonb(m) order by m.currency)
      from monthly_run_rate m), '[]'::jsonb),
    'workspace_default_currencies', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', currency, 'workspaces', workspaces) order by currency)
      from (select ws.default_payment_currency currency, count(*) workspaces
        from public.workspace_settings ws join public.budget_workspaces w on w.id = ws.workspace_id
        where w.status = 'active' group by ws.default_payment_currency) c), '[]'::jsonb),
    'operations', jsonb_build_object(
      'invitations_waiting', (select count(*) from public.admin_user_invitations
        where status in ('pending_delivery', 'sent', 'accepted')),
      'invitations_failed', (select count(*) from public.admin_user_invitations where status = 'failed'),
      'payments_pending_review', (select count(*) from public.subscription_payments where status = 'pending_review'),
      'last_exchange_rate_success_at', (select max(completed_at) from public.exchange_rate_sync_runs
        where status = 'success'),
      'expired_subscriptions', (select count(*) from public.workspace_subscriptions s
        join public.plans p on p.id = s.plan_id
        where p.code <> 'free' and (s.status = 'expired' or s.paid_through_at < now()))
    )
  ) into v_result;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_analytics_page(p_from date, p_to date, p_country text DEFAULT NULL::text, p_plan text DEFAULT NULL::text, p_workspace_type text DEFAULT NULL::text, p_subscription_status text DEFAULT NULL::text, p_billing_period text DEFAULT NULL::text, p_currency text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_today date := (now() at time zone 'UTC')::date;
  v_monthly boolean;
  v_report_currency text;
  v_result jsonb;
begin
  if not public.platform_admin_authorized(null) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_from is null or p_to is null or p_from > p_to or p_to > v_today
      or p_from < date '2020-01-01' then
    raise exception 'INVALID_ANALYTICS_DATE_RANGE';
  end if;
  if (p_country is not null and p_country <> 'unknown' and p_country !~ '^[A-Z]{2}$')
    or (p_plan is not null and p_plan !~ '^[a-z][a-z0-9_]*$')
    or (p_workspace_type is not null and p_workspace_type not in ('personal', 'household', 'business'))
    or (p_subscription_status is not null and p_subscription_status not in ('active', 'suspended', 'expired'))
    or (p_billing_period is not null and p_billing_period not in ('monthly', 'annual'))
    or (p_currency is not null and p_currency !~ '^[A-Z]{3}$') then
    raise exception 'INVALID_ANALYTICS_FILTER';
  end if;

  v_monthly := p_to - p_from > 90;
  select coalesce((select reporting_currency from public.admin_finance_settings where id = 1), 'USD')
    into v_report_currency;

  with eligible_users as (
    select p.id, p.country_code, p.signup_source,
      case when p.signup_source = 'admin_invitation' then i.completed_at else p.created_at end as joined_at
    from public.profiles p
    left join public.admin_user_invitations i on i.id = p.admin_invitation_id
    where p.signup_source <> 'admin_invitation'
       or (i.status = 'provisioned' and i.provisioned_workspace_id is not null and i.completed_at is not null)
  ), candidates as (
    select w.id, w.owner_id, w.workspace_type, w.status as workspace_status,
      s.status as subscription_status, s.billing_period, s.paid_through_at,
      plan.code as plan_code, plan.display_name as plan_name,
      coalesce(invoice.currency, settings.default_payment_currency) as billing_currency
    from public.budget_workspaces w
    join eligible_users owner on owner.id = w.owner_id
    join public.workspace_subscriptions s on s.workspace_id = w.id
    join public.plans plan on plan.id = s.plan_id
    left join public.workspace_settings settings on settings.workspace_id = w.id
    left join lateral (
      select i.currency from public.subscription_invoices i
      where i.workspace_id = w.id order by i.issued_at desc, i.id desc limit 1
    ) invoice on true
    where (p_country is null or coalesce(owner.country_code, 'unknown') = p_country)
      and (p_plan is null or plan.code = p_plan)
      and (p_workspace_type is null or w.workspace_type = p_workspace_type)
      and (p_subscription_status is null or s.status = p_subscription_status)
      and (p_billing_period is null or s.billing_period = p_billing_period)
      and (p_currency is null or coalesce(invoice.currency, settings.default_payment_currency) = p_currency
        or exists (select 1 from public.subscription_payments cp
          where cp.workspace_id = w.id and cp.status = 'approved' and cp.currency = p_currency))
  ), users_in_scope as (
    select u.* from eligible_users u
    where (p_country is null or coalesce(u.country_code, 'unknown') = p_country)
      and ((p_plan is null and p_workspace_type is null and p_subscription_status is null
            and p_billing_period is null and p_currency is null)
        or exists (select 1 from candidates w where w.owner_id = u.id))
  ), activity as (
    select a.user_id, a.hour_start, a.last_seen_at
    from public.analytics_activity_hours a join users_in_scope u on u.id = a.user_id
    where a.hour_start >= (p_from::timestamp at time zone 'UTC')
      and a.hour_start < ((p_to + 1)::timestamp at time zone 'UTC')
  ), revenue as (
    select sp.id, sp.workspace_id, sp.amount, sp.currency,
      coalesce(r.created_at, sp.updated_at) as received_at, w.plan_code,
      coalesce(owner.country_code, 'unknown') as country_code,
      case when sp.currency = v_report_currency then sp.amount
        else conversion.converted_amount end as converted_amount
    from public.subscription_payments sp
    join candidates w on w.id = sp.workspace_id
    join eligible_users owner on owner.id = w.owner_id
    left join public.subscription_payment_reviews r on r.payment_id = sp.id and r.decision = 'approved'
    left join public.payment_conversions conversion on conversion.entity_type = 'subscription_payment'
      and conversion.entity_id = sp.id and conversion.reporting_currency = v_report_currency
      and conversion.is_locked and conversion.original_currency = sp.currency
    where sp.status = 'approved'
      and (p_currency is null or sp.currency = p_currency)
      and coalesce(r.created_at, sp.updated_at) >= (p_from::timestamp at time zone 'UTC')
      and coalesce(r.created_at, sp.updated_at) < ((p_to + 1)::timestamp at time zone 'UTC')
  ), months as (
    select series::date as date
    from generate_series(
      case when v_monthly then date_trunc('month', p_from::timestamp) else p_from::timestamp end,
      p_to::timestamp,
      case when v_monthly then interval '1 month' else interval '1 day' end
    ) series
  ), paid_workspaces as (
    select distinct w.id, w.owner_id, w.plan_code, w.billing_period, w.paid_through_at
    from candidates w where w.workspace_status = 'active' and w.subscription_status = 'active'
      and w.plan_code <> 'free' and w.paid_through_at::date >= v_today
  ), run_rate as (
    select invoice.currency,
      sum(case when w.billing_period = 'annual' then invoice.total_amount / 12
        else invoice.total_amount end)::numeric(14,2) as amount
    from paid_workspaces w
    join lateral (
      select i.currency, i.total_amount from public.subscription_invoices i
      where i.workspace_id = w.id and i.status = 'paid' and i.plan_code = w.plan_code
        and i.billing_period = w.billing_period
      order by i.paid_at desc nulls last, i.issued_at desc, i.id desc limit 1
    ) invoice on true
    where p_currency is null or invoice.currency = p_currency
    group by invoice.currency
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'generated_at', now(),
    'granularity', case when v_monthly then 'month' else 'day' end,
    'reporting_currency', v_report_currency,
    'filters', jsonb_build_object(
      'countries', coalesce((select jsonb_agg(code order by code) from (
        select distinct coalesce(country_code, 'unknown') as code from eligible_users
      ) c), '[]'::jsonb),
      'plans', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'name', display_name)
        order by sort_order, code) from public.plans), '[]'::jsonb),
      'currencies', coalesce((select jsonb_agg(code order by code)
        from public.supported_currencies where is_active), '[]'::jsonb)
    ),
    'users', jsonb_build_object(
      'total', (select count(*) from users_in_scope),
      'new', (select count(*) from users_in_scope where joined_at >= (p_from::timestamp at time zone 'UTC')
        and joined_at < ((p_to + 1)::timestamp at time zone 'UTC')),
      'active', (select count(distinct user_id) from activity),
      'never_active', (select count(*) from users_in_scope u where not exists
        (select 1 from public.analytics_activity_hours a where a.user_id = u.id)),
      'active_last_7_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '7 days'),
      'active_last_30_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '30 days'),
      'active_last_90_days', (select count(distinct a.user_id) from public.analytics_activity_hours a
        join users_in_scope u on u.id = a.user_id where a.last_seen_at >= now() - interval '90 days')
    ),
    'paid_customers', (select count(distinct owner_id) from paid_workspaces),
    'owner_users', (select count(distinct owner_id) from candidates where workspace_status = 'active'),
    'active_workspaces', (select count(*) from candidates where workspace_status = 'active'),
    'renewals_due', (select count(*) from paid_workspaces
      where paid_through_at < now() + interval '30 days'),
    'pending_reviews', (select count(*) from public.subscription_payments sp
      join candidates w on w.id = sp.workspace_id where sp.status = 'pending_review'
        and (p_currency is null or sp.currency = p_currency)),
    'trend', coalesce((select jsonb_agg(jsonb_build_object(
      'date', m.date,
      'signups', (select count(*) from users_in_scope u
        where u.joined_at >= (m.date::timestamp at time zone 'UTC')
          and u.joined_at < ((m.date + case when v_monthly then interval '1 month' else interval '1 day' end)::timestamp at time zone 'UTC')),
      'active', (select count(distinct a.user_id) from activity a
        where a.hour_start >= (m.date::timestamp at time zone 'UTC')
          and a.hour_start < ((m.date + case when v_monthly then interval '1 month' else interval '1 day' end)::timestamp at time zone 'UTC'))
      ) order by m.date) from months m), '[]'::jsonb),
    'countries', coalesce((select jsonb_agg(jsonb_build_object(
      'code', c.country_code, 'users', c.users, 'new', c.new_users, 'paying', c.paying)
      order by c.users desc, c.country_code) from (
        select coalesce(u.country_code, 'unknown') country_code, count(*) users,
          count(*) filter (where u.joined_at >= (p_from::timestamp at time zone 'UTC')
            and u.joined_at < ((p_to + 1)::timestamp at time zone 'UTC')) as new_users,
          count(*) filter (where exists (select 1 from paid_workspaces w where w.owner_id = u.id)) as paying
        from users_in_scope u group by 1
      ) c), '[]'::jsonb),
    'signup_sources', coalesce((select jsonb_agg(jsonb_build_object('source', source,
      'users', total) order by source) from (
      select signup_source source, count(*) total from users_in_scope group by 1
    ) s), '[]'::jsonb),
    'plans', coalesce((select jsonb_agg(jsonb_build_object('code', plan_code,
      'count', total) order by total desc, plan_code) from (
      select plan_code, count(*) total from candidates where workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'subscription_statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status,
      'count', total) order by status) from (
      select subscription_status status, count(*) total from candidates group by 1
    ) s), '[]'::jsonb),
    'billing_periods', coalesce((select jsonb_agg(jsonb_build_object('period', billing_period,
      'count', total) order by billing_period) from (
      select billing_period, count(*) total from candidates group by 1
    ) s), '[]'::jsonb),
    'workspace_types', coalesce((select jsonb_agg(jsonb_build_object('type', workspace_type,
      'count', total) order by workspace_type) from (
      select workspace_type, count(*) total from candidates where workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'revenue_by_currency', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'amount', amount, 'payments', payments) order by currency) from (
      select currency, sum(amount)::numeric(14,2) amount, count(*) payments from revenue group by currency
    ) s), '[]'::jsonb),
    'revenue_by_month', coalesce((select jsonb_agg(jsonb_build_object('date', date,
      'currency', currency, 'amount', amount) order by date, currency) from (
      select date_trunc('month', received_at at time zone 'UTC')::date date, currency,
        sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'revenue_by_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', plan_code,
      'currency', currency, 'amount', amount) order by plan_code, currency) from (
      select plan_code, currency, sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'revenue_by_country', coalesce((select jsonb_agg(jsonb_build_object('country', country_code,
      'currency', currency, 'amount', amount) order by country_code, currency) from (
      select country_code, currency, sum(amount)::numeric(14,2) amount from revenue group by 1, 2
    ) s), '[]'::jsonb),
    'run_rate_by_currency', coalesce((select jsonb_agg(to_jsonb(s) order by currency)
      from run_rate s), '[]'::jsonb),
    'reporting_total', (select coalesce(sum(converted_amount), 0)::numeric(14,2)
      from revenue where converted_amount is not null),
    'reporting_missing', (select count(*) from revenue where converted_amount is null),
    'workspace_currencies', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'workspaces', total) order by total desc, currency) from (
      select settings.default_payment_currency currency, count(*) total
      from candidates w join public.workspace_settings settings on settings.workspace_id = w.id
      where w.workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'enabled_currencies', coalesce((select jsonb_agg(jsonb_build_object('currency', currency,
      'workspaces', total) order by total desc, currency) from (
      select codes.currency, count(distinct w.id) total
      from candidates w join public.workspace_settings settings on settings.workspace_id = w.id
      cross join lateral unnest(settings.enabled_currencies) as codes(currency)
      where w.workspace_status = 'active' group by 1
    ) s), '[]'::jsonb),
    'workspace_engagement', jsonb_build_object(
      'payment_items', (select count(*) from public.payment_items item
        join candidates w on w.id = item.workspace_id where w.workspace_status = 'active'),
      'active_members', (select count(*) from public.workspace_members member
        join candidates w on w.id = member.workspace_id
        where w.workspace_status = 'active' and member.status = 'active'),
      'without_payments', (select count(*) from candidates w
        where w.workspace_status = 'active' and not exists
          (select 1 from public.payment_items item where item.workspace_id = w.id))
    ),
    'payment_statuses', coalesce((select jsonb_agg(jsonb_build_object('status', status,
      'count', total) order by status) from (
      select sp.status, count(*) total from public.subscription_payments sp
      join candidates w on w.id = sp.workspace_id
      where p_currency is null or sp.currency = p_currency group by 1
    ) s), '[]'::jsonb),
    'operations', jsonb_build_object(
      'invitations_waiting', (select count(*) from public.admin_user_invitations
        where status in ('pending_delivery', 'sent', 'accepted')),
      'invitations_failed', (select count(*) from public.admin_user_invitations where status = 'failed'),
      'invitations_sent', (select count(*) from public.admin_user_invitations
        where sent_at is not null and status <> 'cancelled'),
      'invitations_accepted', (select count(*) from public.admin_user_invitations
        where accepted_at is not null and status in ('accepted', 'provisioned')),
      'pending_reviews_global', (select count(*) from public.subscription_payments where status = 'pending_review'),
      'support_open', (select count(*) from public.support_tickets where status in ('open', 'in_progress', 'waiting_customer')),
      'enquiries_open', (select count(*) from public.enquiries where status in ('new', 'in_progress')),
      'last_exchange_rate_success_at', (select max(completed_at) from public.exchange_rate_sync_runs where status = 'success')
    )
  ) into v_result;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_business_billing_settings()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'BUSINESS_BILLING_ADMIN_REQUIRED'; end if;
  return coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('plan_name',p.display_name) order by p.sort_order)
    from public.business_billing_settings s join public.plans p on p.id=s.plan_id where p.workspace_type='business'),'[]'::jsonb);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_business_set_status(p_workspace_id uuid, p_status text, p_expected_version integer, p_confirmation_name text, p_reason text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare w public.budget_workspaces%rowtype;a public.business_support_actions%rowtype;v_id uuid;v_action text;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff'])
    then raise exception 'BUSINESS_SUPPORT_STATUS_ADMIN_REQUIRED'; end if;
  if p_request_id is null or p_status is null or p_status not in ('active','suspended')
    or char_length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'INVALID_BUSINESS_SUPPORT_ACTION'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business' for update;
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  v_action:=case when p_status='active' then 'restore' else 'suspend' end;
  select * into a from public.business_support_actions where workspace_id=w.id and request_id=p_request_id;
  if a.id is not null then
    if a.actor_id<>auth.uid() or a.action<>v_action then raise exception 'SUPPORT_REQUEST_ALREADY_USED'; end if;
    return a.id;
  end if;
  if w.status='closed' then raise exception 'CLOSED_BUSINESS_WORKSPACE'; end if;
  if p_expected_version is distinct from w.business_support_version or btrim(coalesce(p_confirmation_name,''))<>w.name
    then raise exception 'BUSINESS_SUPPORT_STATE_CHANGED'; end if;
  if w.status=p_status then raise exception 'BUSINESS_STATUS_ALREADY_SET'; end if;
  insert into public.business_support_permits values(txid_current(),w.id,auth.uid(),'status') on conflict do nothing;
  update public.budget_workspaces set status=p_status,suspension_reason=case when p_status='suspended' then btrim(p_reason) else null end,
    business_support_version=business_support_version+1,updated_at=now() where id=w.id;
  insert into public.business_support_actions(workspace_id,request_id,actor_id,action,reason,before_summary,after_summary)
    values(w.id,p_request_id,auth.uid(),v_action,btrim(p_reason),jsonb_build_object('status',w.status,'version',w.business_support_version),
      jsonb_build_object('status',p_status,'version',w.business_support_version+1)) returning id into v_id;
  delete from public.business_support_permits where transaction_id=txid_current() and workspace_id=w.id and operation='status';
  insert into public.notifications(user_id,created_by,type,title,body,url) values(w.owner_id,auth.uid(),'account',
    case when p_status='active' then 'Business workspace restored' else 'Business workspace suspended' end,
    case when p_status='active' then 'Workspace access was restored. Account and subscription restrictions still apply.' else 'Your Business workspace was suspended. Contact platform support.' end,'/business.html#business/subscription');
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_business_subscription_payment_detail(p_payment_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff','finance_staff','support_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  return (select to_jsonb(q) from public.subscription_payments p join public.subscription_renewal_requests r on r.id=p.renewal_request_id
    join public.business_subscription_quotes q on q.id=r.business_quote_id where p.id=p_payment_id and q.workspace_id=p.workspace_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_business_support_snapshot(p_workspace_id uuid, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare w public.budget_workspaces%rowtype;s public.workspace_subscriptions%rowtype;v_members jsonb;v_actions jsonb;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff','finance_staff','support_staff'])
    then raise exception 'BUSINESS_SUPPORT_ADMIN_REQUIRED'; end if;
  if p_offset is null or p_offset<0 or p_offset>100000 then raise exception 'INVALID_SUPPORT_OFFSET'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business';
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  select * into s from public.workspace_subscriptions where workspace_id=w.id;
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'user_id',m.user_id,'role',m.role,'name',p.full_name,
    'email',p.email,'account_status',p.account_status,'platform_staff',exists(select 1 from public.app_admins a where a.user_id=m.user_id))
    order by m.role,m.joined_at,m.id),'[]') into v_members from public.workspace_members m
    left join public.profiles p on p.id=m.user_id where m.workspace_id=w.id and m.status='active';
  select coalesce(jsonb_agg(to_jsonb(rows) order by rows.created_at desc,rows.id),'[]') into v_actions from
    (select a.id,a.actor_id,p.email as actor_email,a.action,a.reason,a.before_summary,a.after_summary,a.created_at
      from public.business_support_actions a left join public.profiles p on p.id=a.actor_id
      where a.workspace_id=w.id order by a.created_at desc,a.id offset p_offset limit 20) rows;
  return jsonb_build_object('workspace',jsonb_build_object('id',w.id,'name',w.name,'status',w.status,'owner_id',w.owner_id,
    'suspension_reason',w.suspension_reason,'version',w.business_support_version),'subscription',to_jsonb(s),
    'owner', (select jsonb_build_object('id',p.id,'name',p.full_name,'email',p.email,'account_status',p.account_status) from public.profiles p where p.id=w.owner_id),
    'plan_name',(select display_name from public.plans where id=s.plan_id),
    'current_limit',public.business_effective_member_limit(w.id),'invitation_limit',public.business_effective_member_limit(w.id,true),
    'usage',public.business_billing_usage(w.id),'members',v_members,'actions',v_actions,
    'action_count',(select count(*) from public.business_support_actions where workspace_id=w.id),
    'pending_payment',exists(select 1 from public.subscription_payments where workspace_id=w.id and status='pending_review'),
    'can_suspend',public.platform_admin_authorized(array['super_admin','admin_staff']),
    'can_transfer',public.platform_admin_authorized(array['super_admin']));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_business_transfer_owner(p_workspace_id uuid, p_new_owner_member_id uuid, p_expected_owner_id uuid, p_expected_version integer, p_confirmation_name text, p_confirmation_email text, p_reason text, p_request_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare w public.budget_workspaces%rowtype;m public.workspace_members%rowtype;p public.profiles%rowtype;
declare a public.business_support_actions%rowtype;v_id uuid;v_action text;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin']) then raise exception 'SUPER_ADMIN_REQUIRED'; end if;
  if p_request_id is null or char_length(btrim(coalesce(p_reason,''))) not between 8 and 1000 then raise exception 'INVALID_BUSINESS_SUPPORT_ACTION'; end if;
  select * into w from public.budget_workspaces where id=p_workspace_id and workspace_type='business' for update;
  if w.id is null then raise exception 'BUSINESS_WORKSPACE_NOT_FOUND'; end if;
  select * into a from public.business_support_actions where workspace_id=w.id and request_id=p_request_id;
  if a.id is not null then
    if a.actor_id<>auth.uid() or a.action not in ('transfer','recover') or a.after_summary->>'member_id' is distinct from p_new_owner_member_id::text
      then raise exception 'SUPPORT_REQUEST_ALREADY_USED'; end if;
    return a.id;
  end if;
  if w.status='closed' then raise exception 'CLOSED_BUSINESS_WORKSPACE'; end if;
  if p_expected_version is distinct from w.business_support_version or p_expected_owner_id is distinct from w.owner_id
    or btrim(coalesce(p_confirmation_name,''))<>w.name then raise exception 'BUSINESS_SUPPORT_STATE_CHANGED'; end if;
  perform 1 from public.workspace_subscriptions where workspace_id=w.id for update;
  if exists(select 1 from public.subscription_payments where workspace_id=w.id and status='pending_review')
    then raise exception 'RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST'; end if;
  select * into m from public.workspace_members where id=p_new_owner_member_id and workspace_id=w.id and status='active' for update;
  if m.id is null or m.user_id=w.owner_id or m.role='business_owner' then raise exception 'ACTIVE_EXISTING_BUSINESS_MEMBER_REQUIRED'; end if;
  select * into p from public.profiles where id=m.user_id for update;
  if p.id is null or p.account_status<>'active' or not exists(select 1 from auth.users where id=p.id)
    or exists(select 1 from public.app_admins where user_id=p.id )
    or (p.signup_source='admin_invitation' and not exists(select 1 from public.admin_user_invitations where id=p.admin_invitation_id and status='provisioned'))
    then raise exception 'REGISTERED_ACTIVE_NON_PLATFORM_OWNER_REQUIRED'; end if;
  if lower(btrim(coalesce(p_confirmation_email,'')))<>lower(p.email) or p.email is null then raise exception 'NEW_OWNER_EMAIL_CONFIRMATION_REQUIRED'; end if;
  v_action:=case when exists(select 1 from public.workspace_members where workspace_id=w.id and user_id=w.owner_id and role='business_owner' and status='active')
    and exists(select 1 from public.profiles where id=w.owner_id and account_status='active') then 'transfer' else 'recover' end;
  insert into public.business_support_permits values(txid_current(),w.id,auth.uid(),'ownership') on conflict do nothing;
  -- Remove old Owner privileges, including any member overrides, without rewriting history.
  delete from public.business_member_permissions where workspace_id=w.id and member_id in
    (select id from public.workspace_members where workspace_id=w.id and (user_id=w.owner_id or role='business_owner'));
  delete from public.business_member_scopes where workspace_id=w.id and member_id in
    (select id from public.workspace_members where workspace_id=w.id and (user_id=w.owner_id or role='business_owner'));
  update public.workspace_members set role='viewer',updated_at=now() where workspace_id=w.id and (user_id=w.owner_id or role='business_owner');
  update public.workspace_members set role='business_owner',updated_at=now() where id=m.id;
  update public.budget_workspaces set owner_id=m.user_id,business_support_version=business_support_version+1,updated_at=now() where id=w.id;
  update public.business_subscription_quotes set status='cancelled' where workspace_id=w.id and status='quoted';
  insert into public.business_support_actions(workspace_id,request_id,actor_id,action,reason,before_summary,after_summary)
    values(w.id,p_request_id,auth.uid(),v_action,btrim(p_reason),jsonb_build_object('owner_id',w.owner_id,'version',w.business_support_version),
      jsonb_build_object('owner_id',m.user_id,'member_id',m.id,'previous_owner_role','viewer','version',w.business_support_version+1)) returning id into v_id;
  perform public.business_record_audit_event(w.id,'support.ownership_changed','workspace',w.id,
    jsonb_build_object('owner_id',w.owner_id),jsonb_build_object('owner_id',m.user_id,'previous_owner_role','viewer'),btrim(p_reason));
  delete from public.business_support_permits where transaction_id=txid_current() and workspace_id=w.id and operation='ownership';
  insert into public.notifications(user_id,created_by,type,title,body,url)
    select uid,auth.uid(),'account','Business ownership changed','Platform support changed the Business Owner. Account and subscription restrictions still apply.','/business.html#business/subscription'
    from (select w.owner_id as uid union select m.user_id) recipients;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_cancel_scheduled_plan_price(p_plan_id uuid, p_price_id uuid, p_edit_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_price public.plan_prices%rowtype;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  perform 1 from public.plans where id=p_plan_id for update;
  if p_edit_token is distinct from public.admin_plan_workbench_snapshot(p_plan_id)->>'edit_token' then raise exception 'PLAN_SETTINGS_CHANGED'; end if;
  select * into v_price from public.plan_prices where id=p_price_id and plan_id=p_plan_id for update;
  if v_price.id is null or not v_price.is_active or v_price.effective_from<=now() then raise exception 'SCHEDULED_PRICE_REQUIRED'; end if;
  update public.plan_prices set is_active=false,updated_at=clock_timestamp() where id=v_price.id;
  update public.plan_prices set effective_until=null,updated_at=clock_timestamp()
    where plan_id=p_plan_id and billing_period=v_price.billing_period and currency=v_price.currency and is_active and effective_until=v_price.effective_from;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'plan.scheduled_price_cancelled','plan_price',v_price.id,jsonb_build_object('effective_from',v_price.effective_from));
  return public.admin_plan_workbench_snapshot(p_plan_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_grant_manual_subscription(p_owner_id uuid, p_workspace_id uuid, p_plan_id uuid, p_billing_period text, p_starts_on date, p_ends_on date, p_reason text, p_new_business_name text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_owner public.profiles%rowtype;
  v_plan public.plans%rowtype;
  v_workspace public.budget_workspaces%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_grant_id uuid;
  v_end_at timestamptz;
  v_new_business boolean := p_workspace_id is null;
begin
  if not public.platform_admin_authorized(array['super_admin'])
     or public.my_account_suspended() then
    raise exception 'SUPER_ADMIN_REQUIRED';
  end if;
  if p_owner_id is null
     or p_billing_period is null
     or p_billing_period not in ('monthly', 'annual')
     or p_starts_on is null or p_ends_on is null
     or p_starts_on > current_date
     or p_ends_on <= current_date
     or p_ends_on > p_starts_on + 366
     or char_length(btrim(coalesce(p_reason, ''))) not between 8 and 500 then
    raise exception 'INVALID_MANUAL_GRANT';
  end if;

  select * into v_owner from public.profiles where id = p_owner_id for update;
  if not found or v_owner.account_status <> 'active'
     or not exists (select 1 from auth.users where id = p_owner_id)
     or (v_owner.signup_source = 'admin_invitation' and not exists (
       select 1 from public.admin_user_invitations
       where id = v_owner.admin_invitation_id and status = 'provisioned'
     )) then
    raise exception 'REGISTERED_ACTIVE_OWNER_REQUIRED';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;
  if not found or not v_plan.is_active or v_plan.code = 'free' then
    raise exception 'ACTIVE_PAID_PLAN_REQUIRED';
  end if;

  if v_new_business then
    if v_plan.workspace_type <> 'business'
       or char_length(btrim(coalesce(p_new_business_name, ''))) not between 2 and 120
       or not exists (
         select 1 from public.budget_workspaces
         where owner_id = p_owner_id and workspace_type = 'personal' and status = 'active'
       ) then
      raise exception 'BUSINESS_TEST_WORKSPACE_REQUIRED';
    end if;

    v_workspace.id := gen_random_uuid();
    insert into public.business_admin_test_provisioning (
      workspace_id, owner_id, admin_id, transaction_id
    ) values (v_workspace.id, p_owner_id, auth.uid(), txid_current());

    insert into public.budget_workspaces (id, owner_id, workspace_type, name)
    values (v_workspace.id, p_owner_id, 'business', btrim(p_new_business_name))
    returning * into v_workspace;

    insert into public.workspace_members (workspace_id, user_id, role, status)
    values (v_workspace.id, p_owner_id, 'business_owner', 'active');

    insert into public.workspace_settings (
      workspace_id, base_currency, locale, timezone,
      default_payment_currency, enabled_currencies,
      reporting_currency, conversion_enabled
    )
    select v_workspace.id, settings.base_currency, settings.locale,
           settings.timezone, settings.default_payment_currency,
           settings.enabled_currencies, settings.reporting_currency,
           settings.conversion_enabled
    from public.budget_workspaces as personal
    join public.workspace_settings as settings on settings.workspace_id = personal.id
    where personal.owner_id = p_owner_id
      and personal.workspace_type = 'personal'
      and personal.status = 'active'
    limit 1;
    if not found then raise exception 'PERSONAL_WORKSPACE_SETTINGS_REQUIRED'; end if;
    delete from public.business_admin_test_provisioning
    where workspace_id = v_workspace.id and transaction_id = txid_current();
  else
    select * into v_workspace from public.budget_workspaces
    where id = p_workspace_id for update;
    if not found or v_workspace.owner_id <> p_owner_id
       or v_workspace.status <> 'active'
       or v_workspace.workspace_type <> v_plan.workspace_type then
      raise exception 'OWNED_ACTIVE_WORKSPACE_PLAN_REQUIRED';
    end if;
    if v_workspace.workspace_type = 'business' and not exists (
      select 1 from public.admin_subscription_grants
      where workspace_id = v_workspace.id and grant_kind = 'business_test'
    ) then
      raise exception 'BUSINESS_TEST_WORKSPACE_REQUIRED';
    end if;
  end if;

  if exists (
    select 1 from public.subscription_renewal_requests
    where workspace_id = v_workspace.id and status = 'pending_review'
  ) then
    raise exception 'PENDING_SUBSCRIPTION_REVIEW';
  end if;

  v_end_at := ((p_ends_on + 1)::timestamp at time zone 'UTC');

  insert into public.workspace_subscriptions (
    workspace_id, plan_id, status, billing_period,
    entitlement_start_at, paid_through_at
  ) values (
    v_workspace.id, v_plan.id, 'active', p_billing_period,
    p_starts_on::timestamp at time zone 'UTC', v_end_at
  )
  on conflict (workspace_id) do update set
    plan_id = excluded.plan_id,
    status = 'active',
    billing_period = excluded.billing_period,
    entitlement_start_at = excluded.entitlement_start_at,
    paid_through_at = excluded.paid_through_at,
    suspended_at = null,
    suspension_reason = null,
    version = public.workspace_subscriptions.version + 1,
    updated_at = now()
  returning * into v_subscription;

  -- Legacy Family access still consults family_heads. This marks entitlement
  -- active but does not invent a platform payment or a receipt.
  if v_plan.workspace_type = 'household' then
    insert into public.family_heads (
      user_id, email, full_name, created_by, status, billing_status,
      can_add_members, family_limit, paid_until
    ) values (
      p_owner_id, lower(v_owner.email), v_owner.full_name, auth.uid(),
      'active', 'paid', true, 1, p_ends_on
    )
    on conflict (lower(email)) do update set
      user_id = excluded.user_id,
      status = 'active',
      billing_status = 'paid',
      can_add_members = true,
      family_limit = greatest(public.family_heads.family_limit, 1),
      paid_until = p_ends_on;
  end if;

  insert into public.admin_subscription_grants (
    workspace_id, owner_id, plan_id, billing_period,
    starts_on, ends_on, grant_kind, reason, granted_by
  ) values (
    v_workspace.id, p_owner_id, v_plan.id, p_billing_period,
    p_starts_on, p_ends_on,
    case when v_plan.workspace_type = 'business' then 'business_test' else 'manual' end,
    btrim(p_reason), auth.uid()
  ) returning id into v_grant_id;

  insert into public.subscription_entitlement_history (
    workspace_id, subscription_id, plan_id, status,
    effective_from, effective_until, reason, actor_id
  ) values (
    v_workspace.id, v_subscription.id, v_plan.id, 'active',
    now(), v_end_at, 'Admin manual grant ' || v_grant_id::text, auth.uid()
  );
  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_workspace.id, auth.uid(), 'subscription.manual_grant',
    'admin_subscription_grant', v_grant_id,
    jsonb_build_object('plan_code', v_plan.code, 'billing_period', p_billing_period,
      'starts_on', p_starts_on, 'ends_on', p_ends_on, 'business_test', v_plan.workspace_type = 'business')
  );
  if v_plan.workspace_type = 'business' then
    perform public.business_record_audit_event(
      v_workspace.id, 'business.test_subscription_granted', 'workspace', v_workspace.id,
      '{}'::jsonb, jsonb_build_object('grant_id', v_grant_id, 'ends_on', p_ends_on)
    );
  end if;
  insert into public.notifications (user_id, created_by, type, title, body)
  values (
    p_owner_id, auth.uid(), 'subscription', 'Manual plan access granted',
    case when v_plan.workspace_type = 'business'
      then 'A Business test workspace is ready. Open Business to explore your workspace.'
      else 'An administrator has updated your workspace subscription. Open Subscription to see your plan and expiry.'
    end
  );
  return v_workspace.id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_plan_calculation_preview(p_workspace_type text, p_base numeric, p_seat_price numeric, p_included integer, p_total integer, p_extra integer, p_start timestamp with time zone, p_end timestamp with time zone, p_at timestamp with time zone, p_period text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_factor numeric;v_family jsonb;v_full numeric;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_workspace_type not in('personal','household','business') or p_period not in('monthly','annual') or p_base is null or p_base<0 or p_seat_price is null or p_seat_price<0
    or p_included is null or p_included not between 1 and 100 or p_total is null or p_total not between 1 and 100 or p_extra is null or p_extra not between 1 and 100
    or p_base::text in('NaN','Infinity','-Infinity') or p_seat_price::text in('NaN','Infinity','-Infinity') then raise exception 'INVALID_PREVIEW_VALUES'; end if;
  v_full:=round(p_base+greatest(p_total-p_included,0)*p_seat_price*case when p_workspace_type='household' and p_period='annual' then 12 else 1 end,2);
  if p_workspace_type='business' then v_factor:=public.business_seat_proration(p_start,p_end,p_at);
  elsif p_workspace_type='household' then v_family:=public.family_extra_place_proration(p_start,p_end,p_at);v_factor:=(v_family->>'factor')::numeric;
  else v_factor:=0;end if;
  return jsonb_build_object('subscription_total',v_full,'extra_seat_total',round(p_extra*p_seat_price*v_factor,2),'factor',v_factor,'family',v_family,'expiry',p_end,'preview_only',true);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_plan_workbench_snapshot(p_plan_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_data jsonb; v_history jsonb;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  select jsonb_build_object('plan',to_jsonb(p),
    'prices',coalesce((select jsonb_agg(to_jsonb(x) order by x.effective_from,x.id) from public.plan_prices x where x.plan_id=p.id),'[]'::jsonb),
    'features',coalesce((select jsonb_agg(to_jsonb(x) order by x.feature_code) from public.plan_features x where x.plan_id=p.id),'[]'::jsonb),
    'limits',coalesce((select jsonb_agg(to_jsonb(x) order by x.limit_code) from public.plan_limits x where x.plan_id=p.id),'[]'::jsonb),
    'business',case when p.workspace_type='business' then (select to_jsonb(x) from public.business_billing_settings x where x.plan_id=p.id) else null end)
    into v_data from public.plans p where p.id=p_plan_id;
  if v_data is null then raise exception 'PLAN_NOT_FOUND'; end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]'::jsonb) into v_history from (
    select a.id,a.action,a.created_at,a.actor_id,a.safe_details from public.subscription_audit_events a
    where (a.target_type='plan' and a.target_id=p_plan_id)
      or (a.target_type='plan_price' and a.target_id in(select id from public.plan_prices where plan_id=p_plan_id))
    order by a.created_at desc limit 50) x;
  return v_data||jsonb_build_object('edit_token',md5(v_data::text),'history',v_history,
    'subscriber_count',(select count(*) from public.workspace_subscriptions where plan_id=p_plan_id),
    'purchase_enabled',public.product_customer_purchase_enabled('business'),
    'creation_enabled',public.product_customer_workspace_creation_enabled('business'));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_save_plan_workbench(p_plan_id uuid, p_edit_token text, p_definition jsonb, p_business jsonb DEFAULT NULL::jsonb, p_price jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_old public.plans%rowtype; v_id uuid; v_seats integer; v_price_id uuid; v_start timestamptz; v_now timestamptz:=clock_timestamp(); v_period text; v_currency text; v_amount numeric; v_extra numeric; v_business public.business_billing_settings%rowtype; v_features text[];
begin
  if auth.uid() is null or public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_definition is null or jsonb_typeof(p_definition)<>'object' then raise exception 'INVALID_PLAN_DEFINITION'; end if;
  if p_plan_id is not null then
    select * into v_old from public.plans where id=p_plan_id for update;
    if v_old.id is null then raise exception 'PLAN_NOT_FOUND'; end if;
    if p_edit_token is distinct from public.admin_plan_workbench_snapshot(p_plan_id)->>'edit_token' then raise exception 'PLAN_SETTINGS_CHANGED'; end if;
    if p_definition->>'workspace_type' is distinct from v_old.workspace_type then raise exception 'PLAN_WORKSPACE_TYPE_CANNOT_CHANGE'; end if;
  end if;
  if p_definition->>'workspace_type'='business' and coalesce((p_definition->>'available_for_purchase')::boolean,false)
    and not public.product_customer_purchase_enabled('business') then raise exception 'BUSINESS_PUBLIC_PURCHASE_CLOSED'; end if;
  if p_definition->>'code'='free' and (p_definition->>'workspace_type'<>'personal' or (p_definition->>'active_payment_limit')::integer is distinct from 5) then raise exception 'FREE_PLAN_LIMIT_REQUIRED'; end if;
  if p_business is not null and p_definition->>'workspace_type'<>'business' then raise exception 'BUSINESS_PLAN_REQUIRED'; end if;
  if p_price is not null and (p_definition->>'workspace_type'='business' or p_definition->>'code'='free') then raise exception 'PLAN_PRICE_NOT_APPLICABLE'; end if;
  v_seats:=coalesce((p_definition->>'included_member_seats')::integer,1);
  -- Business capacity has one authoritative editor: the private billing settings.
  if p_definition->>'workspace_type'='business' and p_plan_id is not null then
    select * into v_business from public.business_billing_settings where plan_id=p_plan_id for update;
    v_seats:=coalesce(v_business.included_seats,1);
  end if;
  if p_definition->'feature_codes' is null or jsonb_typeof(p_definition->'feature_codes')<>'array' then raise exception 'INVALID_PLAN_FEATURES'; end if;
  select coalesce(array_agg(value),array[]::text[]) into v_features from jsonb_array_elements_text(p_definition->'feature_codes');
  v_id:=public.save_plan_definition(p_plan_id,p_definition->>'code',p_definition->>'display_name',p_definition->>'description',p_definition->>'marketing_summary',
    p_definition->>'workspace_type',v_seats,(p_definition->>'active_payment_limit')::integer,(p_definition->>'is_active')::boolean,
    (p_definition->>'is_public')::boolean,(p_definition->>'is_featured')::boolean,(p_definition->>'available_for_purchase')::boolean,
    p_definition->>'cta_label',(p_definition->>'sort_order')::integer,v_features);
  if p_definition->>'workspace_type'='business' then
    if p_business is not null then
      perform public.save_business_billing_settings(v_id,coalesce(v_business.version,1),(p_business->>'pilot_enabled')::boolean,(p_business->>'included_seats')::integer,
        p_business->>'currency',(p_business->>'monthly_base')::numeric,(p_business->>'annual_base')::numeric,(p_business->>'monthly_seat')::numeric,
        (p_business->>'annual_seat')::numeric,p_business->>'payment_instructions');
    else
      -- A descriptive edit must not replace unset/approved Business seat configuration.
      insert into public.plan_limits(plan_id,limit_code,limit_value) values(v_id,'included_member_seats',v_business.included_seats)
        on conflict(plan_id,limit_code) do update set limit_value=excluded.limit_value;
    end if;
  end if;
  if p_price is not null then
    v_period:=p_price->>'billing_period';v_currency:=upper(btrim(p_price->>'currency'));
    v_amount:=(p_price->>'amount')::numeric;v_extra:=(p_price->>'extra_member_amount')::numeric;
    if v_period not in('monthly','annual') or v_period is null or not exists(select 1 from public.supported_currencies where code=v_currency and is_active)
      or v_amount is null or v_amount<=0 or v_amount::text in('NaN','Infinity','-Infinity') or v_extra is null or v_extra<0 or v_extra::text in('NaN','Infinity','-Infinity')
      then raise exception 'INVALID_PLAN_PRICE'; end if;
    v_start:=coalesce(nullif(p_price->>'effective_from','')::timestamptz,v_now);
    if not isfinite(v_start) or v_start<v_now-interval '1 minute' or v_start>v_now+interval '366 days' then raise exception 'INVALID_PRICE_START'; end if;
    v_start:=greatest(v_start,v_now);
    if exists(select 1 from public.plan_prices where plan_id=v_id and currency=v_currency and billing_period=v_period and is_active and effective_from>v_now) then raise exception 'SCHEDULED_PRICE_EXISTS'; end if;
    update public.plan_prices set effective_until=v_start,updated_at=v_now
      where plan_id=v_id and currency=v_currency and billing_period=v_period and is_active and effective_from<=v_start and (effective_until is null or effective_until>v_start);
    insert into public.plan_prices(plan_id,billing_period,currency,amount,extra_member_amount,effective_from)
      values(v_id,v_period,v_currency,v_amount,v_extra,v_start) returning id into v_price_id;
    insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
      values(auth.uid(),'plan.price_saved','plan_price',v_price_id,jsonb_build_object('plan_code',p_definition->>'code','effective_from',v_start,'amount',v_amount,'currency',v_currency,'billing_period',v_period));
  end if;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'plan.workbench_saved','plan',v_id,jsonb_build_object('before',case when p_plan_id is null then null else to_jsonb(v_old) end,'after',(select to_jsonb(p) from public.plans p where id=v_id),'subscriber_effect','Features and payment limits apply on access refresh; paid dates, existing workspace seats and issued invoices are preserved.'));
  return public.admin_plan_workbench_snapshot(v_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_subscription_monitor()
 RETURNS TABLE(workspace_id uuid, family_id uuid, workspace_name text, workspace_type text, owner_id uuid, owner_email text, plan_code text, plan_name text, subscription_status text, billing_period text, paid_through_at timestamp with time zone, member_limit integer, active_member_count integer, pending_invitation_count integer, used_member_count integer, available_member_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    workspaces.id,
    workspaces.legacy_family_id,
    workspaces.name,
    workspaces.workspace_type,
    workspaces.owner_id,
    profiles.email,
    plans.code,
    plans.display_name,
    subscriptions.status,
    subscriptions.billing_period,
    subscriptions.paid_through_at,
    greatest(1, coalesce(subscriptions.member_limit, 1)),
    coalesce(member_totals.active_count, 0),
    coalesce(invitation_totals.pending_count, 0),
    coalesce(member_totals.active_count, 0) + coalesce(invitation_totals.pending_count, 0),
    greatest(
      0,
      greatest(1, coalesce(subscriptions.member_limit, 1))
        - coalesce(member_totals.active_count, 0)
        - coalesce(invitation_totals.pending_count, 0)
    )
  from public.budget_workspaces as workspaces
  left join public.profiles on profiles.id = workspaces.owner_id
  left join public.workspace_subscriptions as subscriptions
    on subscriptions.workspace_id = workspaces.id
  left join public.plans on plans.id = subscriptions.plan_id
  left join lateral (
    select count(*)::integer as active_count
    from public.workspace_members
    where workspace_members.workspace_id = workspaces.id
      and workspace_members.status = 'active'
  ) as member_totals on true
  left join lateral (
    select count(*)::integer as pending_count
    from public.workspace_invitations
    where workspace_invitations.workspace_id = workspaces.id
      and workspace_invitations.status = 'pending'
  ) as invitation_totals on true
  where public.platform_admin_authorized(null);
$function$
;

CREATE OR REPLACE FUNCTION public.backfill_currency_conversions()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_count integer := 0; v_row record;
begin
  if auth.role() <> 'service_role' and not public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED';
  end if;
  for v_row in
    select records.*, settings.reporting_currency
    from public.payment_records as records
    join public.workspace_settings as settings on settings.workspace_id = records.workspace_id
    where settings.conversion_enabled
  loop
    perform public.store_api_payment_conversion('payment_record', v_row.id, v_row.workspace_id,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  for v_row in select payments.*, settings.reporting_currency
    from public.payments cross join public.admin_finance_settings as settings
    where settings.id = 1 and settings.conversion_enabled
  loop
    perform public.store_api_payment_conversion('platform_payment', v_row.id, null,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  for v_row in select payments.*, settings.reporting_currency
    from public.subscription_payments as payments cross join public.admin_finance_settings as settings
    where settings.id = 1 and settings.conversion_enabled and payments.status = 'approved'
  loop
    perform public.store_api_payment_conversion('subscription_payment', v_row.id, null,
      v_row.amount, v_row.currency, v_row.reporting_currency,
      v_row.payment_date::timestamptz + interval '23 hours 59 minutes');
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.business_subscription_proof_access(p_path text, p_write boolean DEFAULT false)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_workspace uuid;v_type text;
begin
  if split_part(p_path,'/',1)<>'workspaces' or split_part(p_path,'/',2) !~ '^[0-9a-fA-F-]{36}$' then return false; end if;
  begin v_workspace:=split_part(p_path,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  select workspace_type into v_type from public.budget_workspaces where id=v_workspace;
  if v_type is distinct from 'business' then return true; end if;
  if public.my_account_suspended() then return false; end if;
  if not p_write and public.platform_admin_authorized(array['super_admin','admin_staff','finance_staff','support_staff']) then return true; end if;
  return public.business_billing_owner(v_workspace) and (not p_write or
    (split_part(p_path,'/',3)=auth.uid()::text and exists(select 1 from public.budget_workspaces where id=v_workspace and status='active')
      and exists(select 1 from public.workspace_subscriptions s join public.business_billing_settings c on c.plan_id=s.plan_id
        where s.workspace_id=v_workspace and s.status<>'suspended' and c.pilot_enabled)));
end;
$function$
;

CREATE OR REPLACE FUNCTION public.exchange_rate_status(p_include_admin_details boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_last_attempt public.exchange_rate_sync_runs%rowtype;
  v_last_success public.exchange_rate_sync_runs%rowtype;
  v_admin boolean := public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']);
begin
  select * into v_last_attempt from public.exchange_rate_sync_runs
  where provider = 'currencyapi' order by started_at desc limit 1;
  select * into v_last_success from public.exchange_rate_sync_runs
  where provider = 'currencyapi' and status in ('success', 'partial_failure')
  order by completed_at desc nulls last limit 1;
  return jsonb_build_object(
    'provider', 'currencyapi',
    'last_attempt_at', v_last_attempt.started_at,
    'last_attempt_status', v_last_attempt.status,
    'last_success_at', v_last_success.completed_at,
    'provider_effective_at', v_last_success.provider_effective_at,
    'currencies_updated', coalesce(v_last_success.rates_stored, 0),
    'stale_hours', case when v_last_success.completed_at is null then null else extract(epoch from (now() - v_last_success.completed_at)) / 3600 end,
    'safe_error_summary', case when p_include_admin_details and v_admin then v_last_attempt.safe_error_summary else null end,
    'next_schedule_utc', '00:15 and 12:15 UTC'
  );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_account_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if old.account_status is distinct from new.account_status
     and not public.platform_admin_authorized(array['super_admin', 'admin_staff'])
     and auth.role() <> 'service_role' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_active_family_participant(p_family_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    auth.uid() is not null
    and (
      exists (
        select 1
        from public.app_admins
        where app_admins.user_id = auth.uid() and public.admin_mfa_satisfied()
      )
      or exists (
        select 1
        from public.families
        where families.id = p_family_id
          and families.owner_id = auth.uid()
      )
      or exists (
        select 1
        from public.family_members
        where family_members.family_id = p_family_id
          and family_members.status = 'active'
          and (
            family_members.user_id = auth.uid()
            or lower(family_members.email) = lower(auth.jwt() ->> 'email')
          )
      )
    );
$function$
;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is not null and (
    public.platform_admin_authorized(null)
    or exists (
      select 1 from public.workspace_members
      where workspace_members.workspace_id = p_workspace_id
        and workspace_members.user_id = auth.uid()
        and workspace_members.status = 'active'
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.is_workspace_owner(p_workspace_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select auth.uid() is not null and (
    public.platform_admin_authorized(array['super_admin', 'admin_staff'])
    or exists (
      select 1 from public.budget_workspaces
      where budget_workspaces.id = p_workspace_id
        and budget_workspaces.owner_id = auth.uid()
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.review_subscription_payment(p_payment_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare x public.business_public_purchases%rowtype;p public.subscription_payments%rowtype;r public.subscription_renewal_requests%rowtype;
 i public.subscription_invoices%rowtype;s public.workspace_subscriptions%rowtype;w public.budget_workspaces%rowtype;
 v_workspace uuid:=gen_random_uuid();v_quote uuid:=gen_random_uuid();v_start timestamptz;v_end timestamptz;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff','finance_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  select * into x from public.business_public_purchases where payment_id=p_payment_id;
  if not found then return public.review_subscription_payment_before_business_public(p_payment_id,p_decision,p_reason); end if;
  select * into w from public.budget_workspaces where id=x.source_workspace_id for update;
  select * into x from public.business_public_purchases where payment_id=p_payment_id for update;
  select * into p from public.subscription_payments where id=p_payment_id for update;
  if p.status<>'pending_review' then return 'already_reviewed'; end if;
  select * into r from public.subscription_renewal_requests where id=x.request_id for update;
  select * into i from public.subscription_invoices where id=r.invoice_id for update;
  if x.status<>'pending_review' or x.owner_id<>w.owner_id or w.workspace_type<>'personal' or x.owner_id<>p.submitted_by
    or p.renewal_request_id<>x.request_id or p.workspace_id<>x.source_workspace_id or r.workspace_id<>x.source_workspace_id
    or r.requested_plan_id<>x.plan_id or not r.provision_workspace_on_approval or i.workspace_id<>x.source_workspace_id
    or i.total_amount<>p.amount or i.currency<>p.currency or i.billable_member_count not between 1 and 100
  then raise exception 'INVALID_BUSINESS_SUBSCRIPTION_PAYMENT'; end if;
  if p_decision='rejected' then
    if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.business_public_purchases set status='rejected',reviewed_at=now() where request_id=x.request_id;
    update public.subscription_payments set status='rejected',updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='rejected',rejection_reason=left(btrim(p_reason),2000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='rejected' where id=i.id;
  else
    if auth.uid()=x.owner_id then raise exception 'BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN'; end if;
    if w.status<>'active' or not exists(select 1 from public.profiles where id=x.owner_id and account_status='active') then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
    if (select count(*) from public.budget_workspaces where owner_id=x.owner_id and workspace_type='business')>=100 then raise exception 'BUSINESS_ACCOUNT_CAP_REACHED'; end if;
    -- A previously submitted invoice remains reviewable when new sales close.
    insert into public.business_public_provision_permits values(txid_current(),v_workspace,x.owner_id,auth.uid());
    insert into public.budget_workspaces(id,owner_id,workspace_type,name) values(v_workspace,x.owner_id,'business',x.workspace_name);
    insert into public.workspace_members(workspace_id,user_id,role,status) values(v_workspace,x.owner_id,'business_owner','active');
    insert into public.workspace_settings(workspace_id,base_currency,locale,timezone,default_payment_currency,enabled_currencies,reporting_currency,conversion_enabled)
    select v_workspace,i.currency,coalesce(locale,'en'),coalesce(timezone,'Africa/Harare'),i.currency,array[i.currency],i.currency,true
      from public.workspace_settings where workspace_id=x.source_workspace_id;
    if not found then raise exception 'PERSONAL_WORKSPACE_SETTINGS_REQUIRED'; end if;
    v_start:=clock_timestamp();v_end:=((v_start at time zone 'UTC')+case when i.billing_period='annual' then interval '1 year' else interval '1 month' end) at time zone 'UTC';
    insert into public.workspace_subscriptions(workspace_id,plan_id,status,billing_period,entitlement_start_at,billing_anchor_at,paid_through_at,member_limit)
      values(v_workspace,x.plan_id,'active',i.billing_period,v_start,v_start,v_end,i.billable_member_count) returning * into s;
    insert into public.business_subscription_quotes(id,workspace_id,owner_id,plan_id,kind,billing_period,currency,total_seats,additional_seats,included_seats,
      base_amount,seat_price,amount,fraction,term_start_at,term_end_at,original_expiry_at,original_limit,subscription_version,settings_version,status,payment_id)
      values(v_quote,v_workspace,x.owner_id,x.plan_id,'purchase',i.billing_period,i.currency,i.billable_member_count,i.extra_member_count,i.included_member_count,
      i.base_amount,i.extra_member_amount,i.total_amount,1,v_start,v_end,null,i.billable_member_count,s.version,x.settings_version,'approved',p.id);
    update public.subscription_invoices set workspace_id=v_workspace,status='paid',paid_at=now() where id=i.id;
    update public.subscription_renewal_requests set workspace_id=v_workspace,business_quote_id=v_quote,provisioned_workspace_id=v_workspace,
      status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_payments set workspace_id=v_workspace,status='approved',receipt_number='MBR-B-'||upper(replace(p.id::text,'-','')),updated_at=now() where id=p.id;
    update public.business_public_purchases set status='approved',provisioned_workspace_id=v_workspace,reviewed_at=now() where request_id=x.request_id;
    insert into public.subscription_entitlement_history(workspace_id,subscription_id,plan_id,status,effective_from,effective_until,reason,actor_id)
      values(v_workspace,s.id,x.plan_id,'active',v_start,v_end,'Approved Business purchase on '||i.invoice_number,auth.uid());
    delete from public.business_public_provision_permits where transaction_id=txid_current() and workspace_id=v_workspace;
  end if;
  insert into public.subscription_payment_reviews(payment_id,reviewer_id,decision,reason) values(p.id,auth.uid(),p_decision,nullif(btrim(p_reason),''));
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(case when p_decision='approved' then v_workspace else x.source_workspace_id end,auth.uid(),'business.public_purchase_'||p_decision,'subscription_payment',p.id,jsonb_build_object('request_id',x.request_id,'total_seats',i.billable_member_count));
  insert into public.notifications(user_id,created_by,type,title,body,url) values(x.owner_id,auth.uid(),'subscription',
    case when p_decision='approved' then 'Business plan approved' else 'Business payment rejected' end,
    case when p_decision='approved' then x.workspace_name||' is ready. Open your Business workspace to complete setup.' else 'Open Subscription to view the review reason.' end,
    case when p_decision='approved' then '/business.html?workspace='||v_workspace||'#business/dashboard' else '#personal/subscription' end);
  return p_decision;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_subscription_payment_before_business_public(p_payment_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare p public.subscription_payments%rowtype;r public.subscription_renewal_requests%rowtype;i public.subscription_invoices%rowtype;
declare q public.business_subscription_quotes%rowtype;s public.workspace_subscriptions%rowtype;w public.budget_workspaces%rowtype;
declare v_start timestamptz;v_end timestamptz;v_receipt text;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff','finance_staff']) then raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED'; end if;
  if p_decision is null or p_decision not in ('approved','rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;
  select * into p from public.subscription_payments where id=p_payment_id;
  if p.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  select * into w from public.budget_workspaces where id=p.workspace_id;
  if w.workspace_type<>'business' then return public.review_subscription_payment_before_business_stage10(p_payment_id,p_decision,p_reason); end if;
  select * into w from public.budget_workspaces where id=p.workspace_id for update;
  select * into s from public.workspace_subscriptions where workspace_id=w.id for update;
  select * into p from public.subscription_payments where id=p_payment_id for update;
  if p.status<>'pending_review' then return 'already_reviewed'; end if;
  select * into r from public.subscription_renewal_requests where id=p.renewal_request_id for update;
  select * into i from public.subscription_invoices where id=r.invoice_id for update;
  select * into q from public.business_subscription_quotes where id=r.business_quote_id for update;
  if q.id is null or q.status<>'submitted' or q.payment_id<>p.id or q.workspace_id<>w.id or r.workspace_id<>w.id
    or i.workspace_id<>w.id or p.amount<>q.amount or p.currency<>q.currency or i.total_amount<>q.amount
    or i.currency<>q.currency or i.billable_member_count<>q.total_seats or r.requested_plan_id<>q.plan_id
  then raise exception 'INVALID_BUSINESS_SUBSCRIPTION_PAYMENT'; end if;
  if p_decision='rejected' then
    if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.business_subscription_quotes set status='rejected' where id=q.id;
    update public.subscription_payments set status='rejected',updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='rejected',rejection_reason=left(btrim(p_reason),2000),reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='rejected' where id=i.id;
  else
    if p.submitted_by=auth.uid() then raise exception 'BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN'; end if;
    if w.status<>'active' or s.status='suspended' or exists(select 1 from public.profiles where id=w.owner_id and account_status<>'active')
    then raise exception 'BUSINESS_BILLING_SUSPENDED'; end if;
    if w.owner_id<>q.owner_id or s.plan_id<>q.plan_id or s.version<>q.subscription_version or s.paid_through_at is distinct from q.original_expiry_at
      or public.business_effective_member_limit(w.id)<>q.original_limit or s.business_next_effective_at>now()
    then raise exception 'BUSINESS_SUBSCRIPTION_QUOTE_CHANGED'; end if;
    if q.total_seats<public.business_billing_usage(w.id) then raise exception 'BUSINESS_CAPACITY_BELOW_USAGE'; end if;
    if q.kind='extra_seats' then
      if s.status<>'active' or s.paid_through_at<=now() then raise exception 'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED'; end if;
      v_start:=q.term_start_at;v_end:=q.term_end_at;
      update public.workspace_subscriptions set member_limit=q.total_seats,version=version+1,updated_at=now() where workspace_id=w.id;
    else
      v_start:=greatest(now(),coalesce(s.paid_through_at,now()));
      v_end:=((v_start at time zone 'UTC')+case when q.billing_period='annual' then interval '1 year' else interval '1 month' end) at time zone 'UTC';
      update public.workspace_subscriptions set status='active',paid_through_at=v_end,billing_period=q.billing_period,
        member_limit=case when v_start>now() then public.business_effective_member_limit(w.id) else q.total_seats end,
        business_next_member_limit=case when v_start>now() then q.total_seats end,business_next_effective_at=case when v_start>now() then v_start end,
        billing_anchor_at=v_start,version=version+1,updated_at=now() where workspace_id=w.id;
    end if;
    -- Store the actual approved term on the receipt, while preserving the original quotation time/amount.
    update public.business_subscription_quotes set status='approved',term_start_at=v_start,term_end_at=v_end where id=q.id;
    v_receipt:='MBR-B-'||upper(replace(p.id::text,'-',''));
    update public.subscription_payments set status='approved',receipt_number=v_receipt,updated_at=now() where id=p.id;
    update public.subscription_renewal_requests set status='approved',reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=r.id;
    update public.subscription_invoices set status='paid',paid_at=now() where id=i.id;
    insert into public.subscription_entitlement_history(workspace_id,subscription_id,plan_id,status,effective_from,effective_until,reason,actor_id)
      values(w.id,s.id,q.plan_id,'active',v_start,v_end,'Approved Business '||q.kind||' on '||i.invoice_number,auth.uid());
  end if;
  insert into public.subscription_payment_reviews(payment_id,reviewer_id,decision,reason) values(p.id,auth.uid(),p_decision,nullif(btrim(p_reason),''));
  insert into public.subscription_audit_events(workspace_id,actor_id,action,target_type,target_id,safe_details)
    values(w.id,auth.uid(),'business.billing_'||p_decision,'subscription_payment',p.id,jsonb_build_object('quote_id',q.id,'kind',q.kind,'seats',q.total_seats,'term_start',v_start,'term_end',v_end));
  insert into public.notifications(user_id,created_by,type,title,body,url) values(w.owner_id,auth.uid(),'subscription',
    case when p_decision='approved' then 'Business subscription payment approved' else 'Business subscription payment rejected' end,
    case when p_decision='approved' then 'View your subscription dates, purchased capacity and receipt in Business Billing.' else 'View the review reason in Business Billing.' end,'/business.html?workspace='||w.id||'#business/subscription');
  return p_decision;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.review_subscription_payment_before_business_stage10(p_payment_id uuid, p_decision text, p_reason text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_payment public.subscription_payments%rowtype;
  v_request public.subscription_renewal_requests%rowtype;
  v_invoice public.subscription_invoices%rowtype;
  v_subscription public.workspace_subscriptions%rowtype;
  v_start timestamptz;
  v_paid_through timestamptz;
  v_plan_id uuid;
  v_owner_id uuid;
  v_target_workspace_id uuid;
  v_family_id uuid;
  v_owned_count integer := 0;
  v_owner_email text;
  v_owner_name text;
  v_family_currency text;
begin
  if not public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_REVIEW_ACCESS_REQUIRED';
  end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'INVALID_REVIEW_DECISION'; end if;

  select * into v_payment
  from public.subscription_payments
  where id = p_payment_id
  for update;
  if v_payment.id is null then raise exception 'SUBSCRIPTION_PAYMENT_NOT_FOUND'; end if;
  if v_payment.status <> 'pending_review' then return 'already_reviewed'; end if;

  select * into v_request
  from public.subscription_renewal_requests
  where id = v_payment.renewal_request_id
  for update;
  select * into v_invoice
  from public.subscription_invoices
  where id = v_request.invoice_id
  for update;
  select owner_id into v_owner_id
  from public.budget_workspaces
  where id = v_payment.workspace_id
  for update;
  v_target_workspace_id := v_payment.workspace_id;

  if v_request.purchase_kind = 'extra_places' then
    if v_invoice.workspace_id <> v_payment.workspace_id
       or v_invoice.total_amount <> v_payment.amount
       or v_invoice.extra_member_count <> v_request.seat_count
       or v_invoice.billable_member_count <> v_request.seat_original_limit + v_request.seat_count
    then raise exception 'INVALID_EXTRA_PLACE_INVOICE'; end if;

    if p_decision = 'rejected' then
      if nullif(btrim(p_reason),'') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
      update public.subscription_payments set status = 'rejected', updated_at = now()
      where id = v_payment.id;
      update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason),
          reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
      update public.subscription_invoices set status = 'rejected' where id = v_invoice.id;
    else
      select * into v_subscription from public.workspace_subscriptions
      where workspace_id = v_payment.workspace_id for update;
      if v_subscription.status <> 'active'
         or v_subscription.paid_through_at <= now()
         or v_subscription.paid_through_at is distinct from v_request.seat_expiry_at
         or v_subscription.member_limit is distinct from v_request.seat_original_limit
         or v_subscription.plan_id <> v_request.requested_plan_id
         or exists (select 1 from public.budget_workspaces
           where id = v_payment.workspace_id and status <> 'active')
         or exists (select 1 from public.profiles
           where id = v_owner_id and account_status <> 'active')
      then raise exception 'FAMILY_SEAT_PURCHASE_CHANGED'; end if;

      -- The existing approval trigger sets member_limit from the invoice.
      -- In particular, paid_through_at and billing_anchor_at do not change.
      update public.subscription_payments
      set status = 'approved',
          receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
          updated_at = now()
      where id = v_payment.id;
      update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
      update public.subscription_invoices set status = 'paid', paid_at = now()
      where id = v_invoice.id;
      insert into public.subscription_entitlement_history (
        workspace_id, subscription_id, plan_id, status,
        effective_from, effective_until, reason, actor_id
      ) values (
        v_payment.workspace_id, v_subscription.id, v_subscription.plan_id, 'active',
        now(), v_subscription.paid_through_at,
        'Approved ' || v_request.seat_count || ' additional Family place(s) on ' || v_invoice.invoice_number,
        auth.uid()
      );
    end if;
    insert into public.subscription_payment_reviews (payment_id, reviewer_id, decision, reason)
    values (v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason),''));
    insert into public.notifications (user_id, created_by, type, title, body, url)
    values (v_owner_id, auth.uid(), 'subscription',
      case when p_decision = 'approved' then 'Family places approved' else 'Family places request rejected' end,
      case when p_decision = 'approved'
        then v_request.seat_count || ' more Family place(s) are ready. You can invite members now.'
        else 'Your Family places request needs attention. View the reason in Subscription.' end,
      case when p_decision = 'approved' then '#family/members' else '#family/subscription' end);
    insert into public.subscription_audit_events (
      workspace_id, actor_id, action, target_type, target_id, safe_details
    ) values (v_payment.workspace_id, auth.uid(), 'family.places_' || p_decision,
      'subscription_payment', v_payment.id,
      jsonb_build_object('added_places', v_request.seat_count,
        'total_places', v_invoice.billable_member_count,
        'same_expiry', v_request.seat_expiry_at));
    return p_decision;
  end if;

  if p_decision = 'rejected' then
    if nullif(btrim(p_reason), '') is null then raise exception 'REJECTION_REASON_REQUIRED'; end if;
    update public.subscription_payments
      set status = 'rejected', updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'rejected', rejection_reason = btrim(p_reason),
          reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'rejected'
      where id = v_invoice.id;
  else
    if v_request.provision_workspace_on_approval then
      if not exists (select 1 from public.plans where id = v_request.requested_plan_id and workspace_type = 'household')
         or nullif(btrim(v_request.requested_workspace_name), '') is null
      then
        raise exception 'INVALID_FAMILY_PLAN_REQUEST';
      end if;

      select lower(profiles.email),
             coalesce(nullif(btrim(profiles.full_name), ''), split_part(profiles.email, '@', 1), 'Family owner')
      into v_owner_email, v_owner_name
      from public.profiles
      where profiles.id = v_owner_id;
      if v_owner_email is null then raise exception 'OWNER_PROFILE_REQUIRED'; end if;

      -- Lock the head row too, serializing against direct family creation.
      perform 1 from public.family_heads
      where user_id = v_owner_id or lower(email) = v_owner_email
      for update;

      select count(*)::integer into v_owned_count
      from public.families
      where owner_id = v_owner_id;
      if v_owned_count >= 100 then raise exception 'FAMILY_ACCOUNT_CAP_REACHED'; end if;

      v_family_currency := v_invoice.currency;

      insert into public.families (
        owner_id, owner_email, name, monthly_budget, currency
      ) values (
        v_owner_id, v_owner_email, btrim(v_request.requested_workspace_name), 0, v_family_currency
      ) returning id into v_family_id;

      insert into public.family_members (
        family_id, user_id, created_by, name, role, email, avatar_color, status
      ) values (
        v_family_id, v_owner_id, auth.uid(), v_owner_name, 'Owner',
        v_owner_email, '#2563EB', 'active'
      );

      select id into v_target_workspace_id
      from public.budget_workspaces
      where legacy_family_id = v_family_id;
      if v_target_workspace_id is null then raise exception 'FAMILY_WORKSPACE_PROVISION_FAILED'; end if;

      update public.subscription_invoices
        set workspace_id = v_target_workspace_id
        where id = v_invoice.id;
      update public.subscription_payments
        set workspace_id = v_target_workspace_id, updated_at = now()
        where id = v_payment.id;
      update public.subscription_renewal_requests
        set workspace_id = v_target_workspace_id,
            provisioned_workspace_id = v_target_workspace_id,
            updated_at = now()
        where id = v_request.id;
      update public.subscription_audit_events
        set workspace_id = v_target_workspace_id
        where target_type = 'renewal_request'
          and target_id = v_request.id;
    end if;

    select * into v_subscription
    from public.workspace_subscriptions
    where workspace_id = v_target_workspace_id
    for update;
    v_plan_id := v_request.requested_plan_id;
    v_start := greatest(now(), coalesce(v_subscription.paid_through_at, now()));
    v_paid_through := case
      when v_invoice.billing_period = 'annual' then v_start + interval '1 year'
      else v_start + interval '1 month'
    end;

    insert into public.workspace_subscriptions (
      workspace_id, plan_id, status, billing_period, entitlement_start_at, paid_through_at, billing_anchor_at
    ) values (
      v_target_workspace_id, v_plan_id, 'active', v_invoice.billing_period, now(), v_paid_through, now()
    )
    on conflict (workspace_id) do update
    set plan_id = excluded.plan_id,
        status = 'active',
        billing_period = excluded.billing_period,
        paid_through_at = excluded.paid_through_at,
        billing_anchor_at = case
          when public.workspace_subscriptions.paid_through_at is null
            or public.workspace_subscriptions.paid_through_at <= now()
          then excluded.billing_anchor_at
          else coalesce(public.workspace_subscriptions.billing_anchor_at, excluded.billing_anchor_at)
        end,
        suspended_at = null,
        suspension_reason = null,
        version = public.workspace_subscriptions.version + 1,
        updated_at = now()
    returning * into v_subscription;

    update public.subscription_payments
      set status = 'approved',
          receipt_number = 'MBR-' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSMS'),
          updated_at = now()
      where id = v_payment.id;
    update public.subscription_renewal_requests
      set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(), updated_at = now()
      where id = v_request.id;
    update public.subscription_invoices
      set status = 'paid', paid_at = now()
      where id = v_invoice.id;

    insert into public.subscription_entitlement_history (
      workspace_id, subscription_id, plan_id, status,
      effective_from, effective_until, reason, actor_id
    ) values (
      v_target_workspace_id, v_subscription.id, v_plan_id, 'active', now(), v_paid_through,
      'Approved subscription payment ' || v_invoice.invoice_number, auth.uid()
    );

    if exists (select 1 from public.plans where id = v_plan_id and workspace_type = 'household') then
      update public.family_heads as heads
      set status = 'active',
          billing_status = 'paid',
          can_add_members = true,
          family_limit = greatest(heads.family_limit, 1, case when v_request.provision_workspace_on_approval then v_owned_count + 1 else 1 end),
          paid_until = (v_paid_through at time zone 'Africa/Harare')::date,
          last_payment_at = now(),
          monthly_fee = case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else heads.monthly_fee end,
          fee_currency = v_invoice.currency,
          user_id = v_owner_id
      where lower(heads.email) = lower((select email from public.profiles where id = v_owner_id));

      if not found then
        insert into public.family_heads (
          user_id, email, full_name, created_by, status, billing_status,
          monthly_fee, fee_currency, can_add_members, family_limit,
          paid_until, last_payment_at
        )
        select v_owner_id, lower(profiles.email), profiles.full_name, auth.uid(), 'active', 'paid',
               case when v_invoice.billing_period = 'monthly' then v_invoice.base_amount else 0 end,
               v_invoice.currency, true, greatest(1, v_owned_count + 1),
               (v_paid_through at time zone 'Africa/Harare')::date, now()
        from public.profiles
        where profiles.id = v_owner_id;
      end if;
    end if;
  end if;

  insert into public.subscription_payment_reviews (
    payment_id, reviewer_id, decision, reason
  ) values (
    v_payment.id, auth.uid(), p_decision, nullif(btrim(p_reason), '')
  );

  insert into public.notifications (
    user_id, created_by, type, title, body, url
  ) values (
    v_owner_id, auth.uid(), 'subscription',
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval then 'Family plan approved'
      when p_decision = 'approved' then 'Subscription payment approved'
      else 'Subscription payment rejected'
    end,
    case
      when p_decision = 'approved' and v_request.provision_workspace_on_approval
        then btrim(v_request.requested_workspace_name) || ' is ready. Open the workspace switcher to start using it.'
      when p_decision = 'approved'
        then 'Your subscription is active. Your receipt is available in Subscription.'
      else 'Your subscription payment needs attention. Open Subscription to view the review reason.'
    end,
    '#family/subscription'
  );

  insert into public.subscription_audit_events (
    workspace_id, actor_id, action, target_type, target_id, safe_details
  ) values (
    v_target_workspace_id, auth.uid(), 'subscription.payment_' || p_decision,
    'subscription_payment', v_payment.id,
    jsonb_build_object(
      'decision', p_decision,
      'provisioned_family', p_decision = 'approved' and v_request.provision_workspace_on_approval
    )
  );
  return p_decision;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_admin_finance_currency_settings(p_reporting_currency text, p_enabled_receipt_currencies text[], p_conversion_enabled boolean)
 RETURNS admin_finance_settings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_reporting text := upper(btrim(p_reporting_currency));
  v_enabled text[];
  v_result public.admin_finance_settings%rowtype;
begin
  if not public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']) then
    raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED';
  end if;
  select array_agg(distinct upper(btrim(code)) order by upper(btrim(code)))
  into v_enabled from unnest(coalesce(p_enabled_receipt_currencies, array[]::text[])) as code;
  if v_enabled is null or cardinality(v_enabled) = 0 or not (v_reporting = any(v_enabled)) then
    raise exception 'INVALID_ENABLED_CURRENCIES';
  end if;
  if exists (
    select 1 from unnest(v_enabled) as requested(code)
    left join public.supported_currencies on supported_currencies.code = requested.code and supported_currencies.is_active
    where supported_currencies.code is null
  ) then raise exception 'UNSUPPORTED_CURRENCY'; end if;
  update public.admin_finance_settings
  set reporting_currency = v_reporting,
      enabled_receipt_currencies = v_enabled,
      conversion_enabled = coalesce(p_conversion_enabled, true),
      updated_by = auth.uid(),
      updated_at = now()
  where id = 1
  returning * into v_result;
  return v_result;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_business_billing_settings(p_plan_id uuid, p_expected_version integer, p_pilot_enabled boolean, p_included_seats integer, p_currency text, p_monthly_base numeric, p_annual_base numeric, p_monthly_seat numeric, p_annual_seat numeric, p_payment_instructions text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_old public.business_billing_settings%rowtype; v_new public.business_billing_settings%rowtype;
begin
  if public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin','admin_staff']) then raise exception 'BUSINESS_BILLING_ADMIN_REQUIRED'; end if;
  if not exists(select 1 from public.plans where id=p_plan_id and workspace_type='business' and is_active)
    or p_currency is null or p_currency !~ '^[A-Z]{3}$' or not exists(select 1 from public.supported_currencies where code=p_currency and is_active)
    or p_included_seats is not null and p_included_seats not between 1 and 100
    or exists(select 1 from unnest(array[p_monthly_base,p_annual_base,p_monthly_seat,p_annual_seat]) price where price<0 or price::text='NaN')
    or char_length(coalesce(p_payment_instructions,''))>4000
    or (p_pilot_enabled and (p_included_seats is null or nullif(btrim(p_payment_instructions),'') is null
      or not ((p_monthly_base is not null and p_monthly_seat is not null) or (p_annual_base is not null and p_annual_seat is not null))))
  then raise exception 'INVALID_BUSINESS_BILLING_SETTINGS'; end if;
  insert into public.business_billing_settings(plan_id) values(p_plan_id) on conflict do nothing;
  select * into v_old from public.business_billing_settings where plan_id=p_plan_id for update;
  if p_expected_version is distinct from v_old.version then raise exception 'BUSINESS_BILLING_SETTINGS_CHANGED'; end if;
  update public.business_billing_settings set pilot_enabled=coalesce(p_pilot_enabled,false),included_seats=p_included_seats,currency=p_currency,
    monthly_base=p_monthly_base,annual_base=p_annual_base,monthly_seat=p_monthly_seat,annual_seat=p_annual_seat,
    payment_instructions=btrim(coalesce(p_payment_instructions,'')),version=version+1,updated_by=auth.uid(),updated_at=now()
    where plan_id=p_plan_id returning * into v_new;
  insert into public.plan_limits(plan_id,limit_code,limit_value) values(p_plan_id,'included_member_seats',p_included_seats)
    on conflict(plan_id,limit_code) do update set limit_value=excluded.limit_value;
  insert into public.subscription_audit_events(actor_id,action,target_type,target_id,safe_details)
    values(auth.uid(),'business.billing_settings_saved','plan',p_plan_id,jsonb_build_object('before',to_jsonb(v_old),'after',to_jsonb(v_new)));
  return to_jsonb(v_new);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_manual_payment_conversion(p_entity_type text, p_entity_id uuid, p_reporting_currency text, p_exchange_rate numeric, p_converted_amount numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_workspace_id uuid;
  v_amount numeric;
  v_currency text;
  v_id uuid;
begin
  if p_exchange_rate <= 0 or p_converted_amount <= 0 then raise exception 'INVALID_MANUAL_RATE'; end if;
  if p_entity_type = 'payment_record' then
    select workspace_id, amount, currency into v_workspace_id, v_amount, v_currency
    from public.payment_records where id = p_entity_id;
    if not public.is_workspace_owner(v_workspace_id)
       and not exists (select 1 from public.workspace_members where workspace_id = v_workspace_id and user_id = auth.uid() and status = 'active' and role in ('business_owner', 'business_admin', 'finance_manager'))
    then raise exception 'CURRENCY_SETTINGS_ACCESS_REQUIRED'; end if;
  elsif p_entity_type = 'platform_payment' then
    if not public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']) then raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED'; end if;
    select amount, currency into v_amount, v_currency from public.payments where id = p_entity_id;
  elsif p_entity_type = 'subscription_payment' then
    if not public.platform_admin_authorized(array['super_admin', 'admin_staff', 'finance_staff']) then raise exception 'FINANCE_CURRENCY_ACCESS_REQUIRED'; end if;
    select amount, currency into v_amount, v_currency from public.subscription_payments where id = p_entity_id and status = 'approved';
  else raise exception 'INVALID_CONVERSION_ENTITY'; end if;
  if v_amount is null then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if abs(round(v_amount * p_exchange_rate, 4) - round(p_converted_amount, 4)) > 0.01 then
    raise exception 'MANUAL_CONVERSION_INCONSISTENT';
  end if;
  insert into public.payment_conversions (
    entity_type, entity_id, workspace_id, original_amount, original_currency,
    reporting_currency, exchange_rate, converted_amount, rate_effective_at,
    rate_provider, rate_source, is_locked, entered_by
  ) values (
    p_entity_type, p_entity_id, v_workspace_id, v_amount, upper(v_currency),
    upper(p_reporting_currency), p_exchange_rate, p_converted_amount, now(),
    'manual', 'manual', true, auth.uid()
  ) on conflict (entity_type, entity_id, reporting_currency) do update
  set exchange_rate = excluded.exchange_rate,
      converted_amount = excluded.converted_amount,
      rate_effective_at = excluded.rate_effective_at,
      rate_provider = 'manual', rate_source = 'manual', is_locked = true,
      entered_by = auth.uid(), entered_at = now(), updated_at = now()
  returning id into v_id;
  return v_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_plan_definition(p_plan_id uuid, p_code text, p_display_name text, p_description text, p_marketing_summary text, p_workspace_type text, p_included_member_seats integer, p_active_payment_limit integer, p_is_active boolean, p_is_public boolean, p_is_featured boolean, p_available_for_purchase boolean, p_cta_label text, p_sort_order integer, p_feature_codes text[] DEFAULT ARRAY[]::text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_plan_id uuid; v_code text := lower(btrim(p_code)); v_name text := nullif(btrim(p_display_name), '');
begin
  if not public.platform_admin_authorized(array['super_admin', 'admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if v_code !~ '^[a-z][a-z0-9_]*$' then raise exception 'INVALID_PLAN_CODE'; end if;
  if v_name is null or char_length(v_name) > 80 then raise exception 'INVALID_PLAN_NAME'; end if;
  if p_workspace_type not in ('personal', 'household', 'business') then raise exception 'INVALID_WORKSPACE_TYPE'; end if;
  if p_included_member_seats is null or p_included_member_seats < 1 or p_included_member_seats > 100 then raise exception 'INVALID_INCLUDED_MEMBER_SEATS'; end if;
  if p_active_payment_limit is not null and (p_active_payment_limit < 1 or p_active_payment_limit > 100000) then raise exception 'INVALID_PAYMENT_LIMIT'; end if;
  if char_length(coalesce(p_description, '')) > 500 or char_length(coalesce(p_marketing_summary, '')) > 500 then raise exception 'PLAN_DESCRIPTION_TOO_LONG'; end if;
  if char_length(coalesce(p_cta_label, '')) > 60 then raise exception 'PLAN_CTA_TOO_LONG'; end if;
  if p_plan_id is null then
    insert into public.plans (code, display_name, description, marketing_summary, workspace_type, is_active, is_public, is_featured, available_for_purchase, cta_label, sort_order)
    values (v_code, v_name, coalesce(btrim(p_description), ''), coalesce(btrim(p_marketing_summary), ''), p_workspace_type, coalesce(p_is_active, true), coalesce(p_is_public, false), coalesce(p_is_featured, false), coalesce(p_available_for_purchase, true), coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'), coalesce(p_sort_order, 0)) returning id into v_plan_id;
  else
    select id into v_plan_id from public.plans where id = p_plan_id for update;
    if v_plan_id is null then raise exception 'PLAN_NOT_FOUND'; end if;
    if exists (select 1 from public.plans where id = v_plan_id and code <> v_code) then raise exception 'PLAN_CODE_CANNOT_CHANGE'; end if;
    update public.plans set display_name = v_name, description = coalesce(btrim(p_description), ''), marketing_summary = coalesce(btrim(p_marketing_summary), ''), workspace_type = p_workspace_type, is_active = coalesce(p_is_active, true), is_public = coalesce(p_is_public, false), is_featured = coalesce(p_is_featured, false), available_for_purchase = coalesce(p_available_for_purchase, true), cta_label = coalesce(nullif(btrim(p_cta_label), ''), 'Choose plan'), sort_order = coalesce(p_sort_order, 0), updated_at = now() where id = v_plan_id;
  end if;
  if coalesce(p_is_featured, false) then update public.plans set is_featured = false, updated_at = now() where workspace_type = p_workspace_type and id <> v_plan_id and is_featured; end if;
  insert into public.plan_limits (plan_id, limit_code, limit_value) values (v_plan_id, 'included_member_seats', p_included_member_seats) on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value;
  if p_active_payment_limit is null then delete from public.plan_limits where plan_id = v_plan_id and limit_code = 'active_planned_payments'; else insert into public.plan_limits (plan_id, limit_code, limit_value) values (v_plan_id, 'active_planned_payments', p_active_payment_limit) on conflict (plan_id, limit_code) do update set limit_value = excluded.limit_value; end if;
  update public.plan_features set enabled = false where plan_id = v_plan_id;
  insert into public.plan_features (plan_id, feature_code, enabled) select v_plan_id, selected.feature_code, true from unnest(coalesce(p_feature_codes, array[]::text[])) as selected(feature_code) where selected.feature_code ~ '^[a-z][a-z0-9_.-]*$' on conflict (plan_id, feature_code) do update set enabled = true;
  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details) values (auth.uid(), 'plan.definition_saved', 'plan', v_plan_id, jsonb_build_object('plan_code', v_code));
  return v_plan_id;
end; $function$
;

CREATE OR REPLACE FUNCTION public.save_plan_price(p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_extra_member_amount numeric DEFAULT 0)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_plan_id uuid;
  v_price_id uuid;
begin
  if auth.uid() is null or public.my_account_suspended() or not public.platform_admin_authorized(array['super_admin', 'admin_staff']) then raise exception 'PLAN_MANAGEMENT_ACCESS_REQUIRED'; end if;
  if p_billing_period is null or p_billing_period not in ('monthly', 'annual') then raise exception 'INVALID_BILLING_PERIOD'; end if;
  if p_amount is null or p_extra_member_amount is null or p_amount <= 0 or p_extra_member_amount < 0 or p_amount::text in ('NaN','Infinity','-Infinity') or p_extra_member_amount::text in ('NaN','Infinity','-Infinity') or not exists(select 1 from public.supported_currencies where code=upper(p_currency) and is_active) then raise exception 'INVALID_PLAN_PRICE'; end if;
  select id into v_plan_id from public.plans where code = lower(p_plan_code) and code <> 'free' and workspace_type<>'business' for update;
  if v_plan_id is null then raise exception 'PAID_PLAN_NOT_FOUND'; end if;

  if exists(select 1 from public.plan_prices where plan_id=v_plan_id and billing_period=p_billing_period and currency=upper(p_currency) and is_active and effective_from>now()) then raise exception 'SCHEDULED_PRICE_EXISTS'; end if;

  update public.plan_prices set is_active = false, effective_until = now(), updated_at = now()
  where plan_id = v_plan_id and billing_period = p_billing_period and currency = upper(p_currency) and is_active;

  insert into public.plan_prices (plan_id, billing_period, currency, amount, extra_member_amount)
  values (v_plan_id, p_billing_period, upper(p_currency), p_amount, p_extra_member_amount)
  returning id into v_price_id;

  insert into public.subscription_audit_events (actor_id, action, target_type, target_id, safe_details)
  values (auth.uid(), 'plan.price_saved', 'plan_price', v_price_id,
          jsonb_build_object('plan_code', lower(p_plan_code), 'billing_period', p_billing_period, 'currency', upper(p_currency)));
  return v_price_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_user_account_status(p_user_id uuid, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  if not public.platform_admin_authorized(array['super_admin', 'admin_staff']) then raise exception 'ADMIN_REQUIRED'; end if;
  if p_status not in ('active', 'suspended') or p_user_id = auth.uid()
     or exists (select 1 from public.app_admins where user_id = p_user_id)
  then raise exception 'INVALID_ACCOUNT_STATUS'; end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then raise exception 'USER_NOT_FOUND'; end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.workspace_member_usage(p_workspace_id uuid)
 RETURNS TABLE(workspace_id uuid, active_member_count integer, pending_invitation_count integer, used_member_count integer, member_limit integer, available_member_count integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_active integer := 0;
  v_pending integer := 0;
  v_limit integer := 1;
begin
  if not public.is_workspace_member(p_workspace_id)
     and not public.platform_admin_authorized(null)
  then
    return;
  end if;

  select count(*)::integer into v_active
  from public.workspace_members
  where workspace_members.workspace_id = p_workspace_id
    and workspace_members.status = 'active';

  select count(*)::integer into v_pending
  from public.workspace_invitations
  where workspace_invitations.workspace_id = p_workspace_id
    and workspace_invitations.status = 'pending';

  select coalesce(subscriptions.member_limit, 1) into v_limit
  from public.workspace_subscriptions as subscriptions
  where subscriptions.workspace_id = p_workspace_id;
  v_limit := greatest(1, coalesce(v_limit, 1));

  return query select
    p_workspace_id,
    v_active,
    v_pending,
    v_active + v_pending,
    v_limit,
    greatest(0, v_limit - v_active - v_pending);
end;
$function$
;
-- Change reviewed administrative branches of existing policies, preserving policy roles/type/owner alternatives.
alter policy "Admins can manage audit logs" on "public"."admin_audit_logs" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))) with check (((actor_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Finance staff can read admin currency settings" on "public"."admin_finance_settings" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text]));

alter policy "Super admins can read manual grants" on "public"."admin_subscription_grants" using ((public.platform_admin_authorized(ARRAY['super_admin'::text]) AND (NOT my_account_suspended())));

alter policy "Admins can manage support notes" on "public"."admin_support_notes" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Authorized admins can read user invitation audit" on "public"."admin_user_invitation_audit" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text]));

alter policy "Authorized admins can read user invitations" on "public"."admin_user_invitations" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text]));

alter policy "Owners and admins can create category budgets" on "public"."category_budgets" with check (((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))));

alter policy "Owners and admins can delete category budgets" on "public"."category_budgets" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Owners and admins can read category budgets" on "public"."category_budgets" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Owners and admins can update category budgets" on "public"."category_budgets" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((created_by = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = category_budgets.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))));

alter policy "Staff can read countries" on "public"."countries" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]));

alter policy "Staff can read enquiries" on "public"."enquiries" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]));

alter policy "Staff can update enquiries" on "public"."enquiries" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text])) with check (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]));

alter policy "Finance staff can read rate sync diagnostics" on "public"."exchange_rate_sync_runs" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text]));

alter policy "Approved heads and admins can create expenses" on "public"."expenses" with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id)))))));

alter policy "Approved heads and admins can delete expenses" on "public"."expenses" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Approved heads and admins can read expenses" on "public"."expenses" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Approved heads and admins can update expenses" on "public"."expenses" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((user_id = ( SELECT auth.uid() AS uid)) AND ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = expenses.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))) AND ((member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.member_id) AND (family_members.family_id = expenses.family_id))))) AND ((paid_by_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = expenses.paid_by_member_id) AND (family_members.family_id = expenses.family_id)))))));

alter policy "Approved heads and admins can update families" on "public"."families" using (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid)))) with check (((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (owner_id = ( SELECT auth.uid() AS uid))));

alter policy "Owners and admins can delete families" on "public"."families" using (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Admins and matching heads can read head approvals" on "public"."family_heads" using (((lower(email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Admins can create head approvals" on "public"."family_heads" with check (((created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Admins can delete head approvals" on "public"."family_heads" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Admins can update head approvals" on "public"."family_heads" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))) with check ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Invitation participants can read invitations" on "public"."family_invitations" using (((invited_by = ( SELECT auth.uid() AS uid)) OR (lower(invitee_email) = lower(( SELECT (auth.jwt() ->> 'email'::text)))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Approved heads and admins can delete family members" on "public"."family_members" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Approved heads and admins can update family members" on "public"."family_members" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))) with check ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Users can create relevant notifications" on "public"."notifications" with check (((created_by = ( SELECT auth.uid() AS uid)) AND ((user_id = ( SELECT auth.uid() AS uid)) OR (email IS NOT NULL) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))))));

alter policy "Owners and finance staff can read subscription proofs" on "storage"."objects" using (((bucket_id = 'subscription-proofs'::text) AND (is_workspace_owner(((storage.foldername(name))[2])::uuid) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text, 'support_staff'::text]))));

alter policy "Owners can delete payment proofs" on "storage"."objects" using (((bucket_id = 'payment-proofs'::text) AND ((((storage.foldername(name))[1] = 'personal'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = 'families'::text) AND ((storage.foldername(name))[3] = (( SELECT auth.uid() AS uid))::text)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))))));

alter policy "Users can read permitted payment proofs" on "storage"."objects" using (((bucket_id = 'payment-proofs'::text) AND ((((storage.foldername(name))[1] = 'personal'::text) AND ((storage.foldername(name))[2] = (( SELECT auth.uid() AS uid))::text)) OR (((storage.foldername(name))[1] = 'families'::text) AND is_active_family_participant(((storage.foldername(name))[2])::uuid)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))))));

alter policy "Authorized users can read payment conversions" on "public"."payment_conversions" using ((((workspace_id IS NOT NULL) AND is_workspace_member(workspace_id)) OR ((workspace_id IS NULL) AND public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text]))));

alter policy "Household owners can delete payment items" on "public"."payment_items" using ((((visibility = 'personal'::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Household owners can update payment items" on "public"."payment_items" using ((((visibility = 'personal'::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = 'family'::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_items.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = 'personal'::text) AND (family_id IS NULL) AND (responsible_member_id IS NULL)) OR ((visibility = 'family'::text) AND is_active_family_participant(family_id))) AND ((responsible_member_id IS NULL) OR (EXISTS ( SELECT 1
   FROM family_members
  WHERE ((family_members.id = payment_items.responsible_member_id) AND (family_members.family_id = payment_items.family_id)))))));

alter policy "Household owners can delete payment records" on "public"."payment_records" using ((((visibility = 'personal'::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid)))))));

alter policy "Household owners can update payment records" on "public"."payment_records" using ((((visibility = 'personal'::text) AND (owner_id = ( SELECT auth.uid() AS uid))) OR ((visibility = 'family'::text) AND (owner_id = ( SELECT auth.uid() AS uid)) AND is_active_family_participant(family_id)) OR (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))) OR (EXISTS ( SELECT 1
   FROM families
  WHERE ((families.id = payment_records.family_id) AND (families.owner_id = ( SELECT auth.uid() AS uid))))))) with check (((owner_id = ( SELECT auth.uid() AS uid)) AND (((visibility = 'personal'::text) AND (family_id IS NULL)) OR ((visibility = 'family'::text) AND is_active_family_participant(family_id)))));

alter policy "Admins can create payments" on "public"."payments" with check (((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Admins can delete payments" on "public"."payments" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Admins can read payments" on "public"."payments" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid)))));

alter policy "Admins can update payments" on "public"."payments" using ((EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))) with check (((recorded_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM app_admins
  WHERE ((CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END) = ( SELECT auth.uid() AS uid))))));

alter policy "Authenticated users can read active plan prices" on "public"."plan_prices" using ((is_active OR public.platform_admin_authorized(NULL::text[])));

alter policy "Authenticated users can read active plans" on "public"."plans" using ((is_active OR public.platform_admin_authorized(NULL::text[])));

alter policy "Users and admins can read profiles" on "public"."profiles" using (((( SELECT auth.uid() AS uid) = id) OR ( SELECT public.platform_admin_authorized(null) AS is_app_admin)));

alter policy "Support staff can read public enquiry events" on "public"."public_enquiry_events" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]));

alter policy "business_subscription_audit_owner_guard" on "public"."subscription_audit_events" using (((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_audit_events.workspace_id) AND (budget_workspaces.workspace_type = 'business'::text))))) OR business_billing_owner(workspace_id) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text, 'support_staff'::text])));

alter policy "business_entitlement_history_owner_guard" on "public"."subscription_entitlement_history" using (((NOT (EXISTS ( SELECT 1
   FROM budget_workspaces
  WHERE ((budget_workspaces.id = subscription_entitlement_history.workspace_id) AND (budget_workspaces.workspace_type = 'business'::text))))) OR business_billing_owner(workspace_id) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text, 'support_staff'::text])));

alter policy "Owners can read subscription invoices" on "public"."subscription_invoices" using ((is_workspace_owner(workspace_id) OR public.platform_admin_authorized(ARRAY['finance_staff'::text, 'support_staff'::text])));

alter policy "Owners can read subscription proofs" on "public"."subscription_payment_proofs" using (((uploaded_by = auth.uid()) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text, 'support_staff'::text])));

alter policy "Finance staff can read reviews" on "public"."subscription_payment_reviews" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'finance_staff'::text, 'support_staff'::text]));

alter policy "Owners can read subscription payments" on "public"."subscription_payments" using ((is_workspace_owner(workspace_id) OR public.platform_admin_authorized(ARRAY['finance_staff'::text, 'support_staff'::text])));

alter policy "Owners can read renewal requests" on "public"."subscription_renewal_requests" using ((is_workspace_owner(workspace_id) OR public.platform_admin_authorized(ARRAY['finance_staff'::text, 'support_staff'::text])));

alter policy "Customers and support staff can add ticket messages" on "public"."support_ticket_messages" with check (((author_id = ( SELECT auth.uid() AS uid)) AND (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid)) AND (support_tickets.status <> 'closed'::text))))))));

alter policy "Customers and support staff can read ticket messages" on "public"."support_ticket_messages" using ((public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]) OR ((NOT is_internal) AND (EXISTS ( SELECT 1
   FROM support_tickets
  WHERE ((support_tickets.id = support_ticket_messages.ticket_id) AND (support_tickets.customer_id = ( SELECT auth.uid() AS uid))))))));

alter policy "Administrators can delete tickets" on "public"."support_tickets" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text]));

alter policy "Customers and support staff can create tickets" on "public"."support_tickets" with check (((created_by = ( SELECT auth.uid() AS uid)) AND (((customer_id = ( SELECT auth.uid() AS uid)) AND ((workspace_id IS NULL) OR is_workspace_member(workspace_id)) AND (assigned_admin_id IS NULL) AND (status = 'open'::text) AND (resolved_at IS NULL)) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]))));

alter policy "Customers and support staff can read tickets" on "public"."support_tickets" using (((customer_id = ( SELECT auth.uid() AS uid)) OR public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text])));

alter policy "Support staff can update tickets" on "public"."support_tickets" using (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text])) with check (public.platform_admin_authorized(ARRAY['super_admin'::text, 'admin_staff'::text, 'support_staff'::text]));

alter policy "Authenticated users can read supported currencies" on "public"."supported_currencies" using ((is_active OR public.platform_admin_authorized(NULL::text[])));
commit;
