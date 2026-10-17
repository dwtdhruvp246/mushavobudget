-- FR.2.4.E4.3: OFFLINE SOURCE CANDIDATE ONLY. Not a hosted installation.
-- Integrates existing E2/E4.2 components with actual application RLS and RPCs.
-- Complete Edge/UI/canonical migration integration and coordinated rollout remain pending.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $integration$
DECLARE
  f record; relation record; v_oid oid; v_old text; v_body text;
  v_definition text; v_catalog text; v_targets oid[];
  v_before jsonb; v_after jsonb; v_count integer:=0; v_policy_count integer:=0;
BEGIN
  IF current_setting('mushavo.email_data_guard_review',true) IS DISTINCT FROM 'OFFLINE_SOURCE_CANDIDATE'
  THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_OFFLINE_REVIEW_ACK_REQUIRED'; END IF;
  IF current_user<>'postgres' OR current_setting('session_replication_role')<>'origin'
  THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_POSTGRES_ORIGIN_REQUIRED'; END IF;
  IF to_regprocedure('mushavo_email_auth.current_session_verified()') IS NULL
  THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_SESSION_BACKEND_REQUIRED'; END IF;
  IF EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='mushavo_email_auth'::regnamespace AND proname='require_application_session')
    OR EXISTS(SELECT 1 FROM pg_policy WHERE polname='Email verified session required')
  THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_ALREADY_PRESENT'; END IF;
  with r as(select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as arguments,l.lanname as language,md5(replace(p.prosrc,E'\r\n',E'\n')) as body_md5,pg_get_function_result(p.oid) as result,p.prosecdef as definer,p.provolatile as volatility,p.proconfig as settings,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname in('public','mushavo_email_auth') and p.prokind='f' and p.prorettype<>'event_trigger'::regtype) select md5(jsonb_agg(to_jsonb(r) order by schema,name,arguments)::text) into v_catalog from r;
  IF v_catalog<>'d16140f6067289d2c27a12395efd6ae3' THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_UNREVIEWED_ROUTINE_BASELINE'; END IF;
  SELECT array_agg(p.oid ORDER BY p.oid) INTO v_targets
    FROM pg_proc p WHERE p.pronamespace='public'::regnamespace
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
      AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype)
      AND left(p.proname,11)<>'email_gate_'
      AND p.proname NOT IN ('get_public_plan_catalogue','get_public_signup_currencies','latest_exchange_rate','business_bill_occurrence_date','business_storage_workspace_id');
  IF cardinality(v_targets)<>148 THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_TARGET_COUNT'; END IF;
  SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(
      CASE WHEN p.oid=ANY(v_targets) THEN to_jsonb(p)-ARRAY['prosrc','prolang'] ELSE to_jsonb(p) END ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','mushavo_email_auth')
      AND NOT(n.nspname='mushavo_email_auth' AND p.proname='require_application_session')),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname)
      FROM pg_policies p WHERE p.policyname<>'Email verified session required'),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t),
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl::text,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage','mushavo_email_auth'))
  ) INTO v_before;
  EXECUTE $helper_ddl$CREATE FUNCTION mushavo_email_auth.require_application_session() RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE active_role text:=current_setting('role',true);
BEGIN
  -- The actual SET ROLE context survives nested SECURITY DEFINER calls.
  -- A JWT claim alone never grants the service/internal bypass.
  IF active_role='authenticated' OR auth.role()='authenticated' THEN
    IF active_role='anon' THEN
      RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
    END IF;
    PERFORM public.email_gate_require_current_session();
    RETURN;
  END IF;
  IF active_role='service_role' AND auth.role()='service_role' THEN RETURN; END IF;
  -- Preserve existing Auth middleware trigger callbacks, not app Admin logins.
  IF coalesce(active_role,'none')='none' AND session_user='supabase_auth_admin'
    AND pg_trigger_depth()>0 THEN RETURN; END IF;
  IF coalesce(active_role,'none')='none' AND EXISTS(
    SELECT 1 FROM pg_roles WHERE rolname=session_user
      AND rolname<>'authenticator' AND (rolsuper OR rolbypassrls)
  ) THEN RETURN; END IF;
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='EMAIL_VERIFICATION_REQUIRED';
END;
$body$;$helper_ddl$;
  REVOKE ALL ON FUNCTION mushavo_email_auth.require_application_session() FROM PUBLIC,anon,authenticated,service_role;

  FOR f IN SELECT * FROM (VALUES
    ('admin_analytics_foundation','p_from date, p_to date','99ef14370afce2b0ff25c12bf3d17cd3','plpgsql'),
    ('admin_analytics_page','p_from date, p_to date, p_country text, p_plan text, p_workspace_type text, p_subscription_status text, p_billing_period text, p_currency text','55957503f7d2b0cea488ddafeea7ce27','plpgsql'),
    ('admin_business_billing_settings','','4ad0f4db75fcbd7788e56552fcb94512','plpgsql'),
    ('admin_business_set_status','p_workspace_id uuid, p_status text, p_expected_version integer, p_confirmation_name text, p_reason text, p_request_id uuid','8d7029a14bc6b711e8d8ae916f5b1521','plpgsql'),
    ('admin_business_subscription_payment_detail','p_payment_id uuid','c24c804f6a2049e4792aeea819892c58','plpgsql'),
    ('admin_business_support_snapshot','p_workspace_id uuid, p_offset integer','031fca5c3b890d6221f69f3b0f59825b','plpgsql'),
    ('admin_business_transfer_owner','p_workspace_id uuid, p_new_owner_member_id uuid, p_expected_owner_id uuid, p_expected_version integer, p_confirmation_name text, p_confirmation_email text, p_reason text, p_request_id uuid','175ef8648601700db626cdacb6fb0294','plpgsql'),
    ('admin_cancel_scheduled_plan_price','p_plan_id uuid, p_price_id uuid, p_edit_token text','94f7097ba883f093303ce92d07d49aba','plpgsql'),
    ('admin_grant_manual_subscription','p_owner_id uuid, p_workspace_id uuid, p_plan_id uuid, p_billing_period text, p_starts_on date, p_ends_on date, p_reason text, p_new_business_name text','e5de74ee9405c3bc6765346201ff1b8a','plpgsql'),
    ('admin_plan_calculation_preview','p_workspace_type text, p_base numeric, p_seat_price numeric, p_included integer, p_total integer, p_extra integer, p_start timestamp with time zone, p_end timestamp with time zone, p_at timestamp with time zone, p_period text','d21112de384008ebeecc1e82d267954f','plpgsql'),
    ('admin_plan_workbench_snapshot','p_plan_id uuid','05e562d9eeaf540c96daeb1cf516e1dd','plpgsql'),
    ('admin_save_plan_workbench','p_plan_id uuid, p_edit_token text, p_definition jsonb, p_business jsonb, p_price jsonb','d39e7c1f5bd71b3e6ec4bee24a53e56b','plpgsql'),
    ('admin_subscription_monitor','','946b83d1d33388628eff3798a6a84455','sql'),
    ('archive_business_document','p_workspace_id uuid, p_document_id uuid, p_reason text','e4ea840e736e83f6605de05fe3504efb','plpgsql'),
    ('archive_business_role','p_workspace_id uuid, p_code text, p_expected_version integer','a1415e0f07d24b1a6532f053380ab781','plpgsql'),
    ('archive_cashbook_account','p_account_id uuid','32bb4fa35e92811ca44dcd423b041dcf','plpgsql'),
    ('assign_business_member_scope','p_workspace_id uuid, p_member_id uuid, p_dimension_id uuid, p_assigned boolean','1d8ceb100bfcf1b403dd2f865e36f4a2','plpgsql'),
    ('backfill_currency_conversions','','37870f1342cdc68a3eae523511ab5374','plpgsql'),
    ('backfill_workspace_currency_conversions','p_workspace_id uuid','4387fc7c07ebb217e17910337cbb0a0b','plpgsql'),
    ('business_bill_summary','p_workspace_id uuid','cd5609c6d7d1246abbeff56cb2457d6c','plpgsql'),
    ('business_billing_owner','p_workspace_id uuid','ac845db4af5ee338ce8fe58d47d21aa6','sql'),
    ('business_billing_snapshot','p_workspace_id uuid, p_offset integer, p_limit integer','a0cc238cb4a02bd88ac120569ebdc317','plpgsql'),
    ('business_budget_detail','p_workspace_id uuid, p_budget_id uuid, p_offset integer, p_limit integer','806c43b20f8f9365301e0b6ef6dad21b','plpgsql'),
    ('business_budget_feed','p_workspace_id uuid, p_status text, p_offset integer, p_limit integer','23b1b051ccf9a9a8d849f4a18ab9447e','plpgsql'),
    ('business_budget_scope','p_workspace_id uuid, p_dimension_id uuid','0ca83596a3a2b0542988abcf4b68b2fe','sql'),
    ('business_can_view_bill','p_workspace_id uuid, p_bill_id uuid','2cef92599e782a6c25625798d708e297','sql'),
    ('business_can_view_bill_document','p_workspace_id uuid, p_parent_type text, p_parent_id uuid','26ecdaf043eec4a26dd754d063d408b2','sql'),
    ('business_can_view_budget','p_workspace_id uuid, p_budget_id uuid','84167717c1d584ecf97e3326357aa1f9','sql'),
    ('business_can_view_claim','p_workspace_id uuid, p_claim_id uuid','936a4584ed2226cf91690ef59306c64f','sql'),
    ('business_can_view_income','p_workspace_id uuid, p_income_id uuid','2552f92daf7089f441ccd305183ca47d','sql'),
    ('business_can_view_request','p_workspace_id uuid, p_request_id uuid','f3cd896de960bc751e273dcef88f91fa','sql'),
    ('business_claim_history','p_workspace_id uuid, p_claim_id uuid','49fc2a51fb076217ea14d4033690f499','sql'),
    ('business_claim_in_scope','p_workspace_id uuid, p_dimension_id uuid','f5f00254e15f96d93820862513235821','sql'),
    ('business_claim_summary','p_workspace_id uuid','0c46d6177cff540b34fb41df7b582abc','plpgsql'),
    ('business_claims_active','p_workspace_id uuid','937fbb190901555442f25a29e764e96c','sql'),
    ('business_effective_permissions','p_workspace_id uuid','58dd4df524ed8cadf9090a5b1f458e6a','sql'),
    ('business_has_permission','p_workspace_id uuid, p_permission_code text','3df7d3068b199e6746fca4f0b8f377a9','plpgsql'),
    ('business_logo_owner','p_name text','da0501db4ae77c8e43153835e101852c','sql'),
    ('business_logo_readable','p_name text','3b5ea0a807a0286761b3d1f42bdf2d10','sql'),
    ('business_report_export','p_workspace_id uuid, p_section text, p_expected_fingerprint text, p_export_id uuid, p_format text, p_from date, p_to date, p_mode text, p_currency text, p_category_id uuid, p_dimension_id uuid, p_group_type text, p_group_id uuid, p_budget_id uuid','f93a32f8532ba24c55bfa023f0dbe95b','plpgsql'),
    ('business_report_records','p_workspace_id uuid, p_section text, p_expected_fingerprint text, p_from date, p_to date, p_mode text, p_currency text, p_category_id uuid, p_dimension_id uuid, p_group_type text, p_group_id uuid, p_budget_id uuid, p_offset integer, p_limit integer','145dbaa5812f261f0b7e11e647db0246','plpgsql'),
    ('business_report_scope','p_workspace_id uuid, p_dimension_id uuid, p_submitter_id uuid','be8e402554c00916db47e30441027dfc','sql'),
    ('business_report_summary','p_workspace_id uuid, p_from date, p_to date, p_mode text, p_currency text, p_category_id uuid, p_dimension_id uuid','ae878d9106e3588b442ced70d96aa526','sql'),
    ('business_request_detail','p_workspace_id uuid, p_request_id uuid','431c17f9e01f75035f8d03cd4bc2688e','plpgsql'),
    ('business_request_feed','p_workspace_id uuid, p_search text, p_status text, p_offset integer, p_limit integer','be7b2ddc61c6c1becf8fbb82073ac118','plpgsql'),
    ('business_roles_snapshot','p_workspace_id uuid','0c19a0966bdc8052c54d577db6f0453d','plpgsql'),
    ('business_signal_member','p_workspace_id uuid','934a8bea81fe9dae04d1712bcc808774','sql'),
    ('business_subscription_proof_access','p_path text, p_write boolean','29384de40e5d5a2dd1f336727a254040','plpgsql'),
    ('business_subscription_quote','p_workspace_id uuid, p_kind text, p_billing_period text, p_quantity integer','0af1476baf6f2ae1298a49c860eaca00','plpgsql'),
    ('business_team_can_manage','p_workspace_id uuid','9d6fcab28f6ecf23f0ee5b67080c5885','sql'),
    ('business_team_snapshot','p_workspace_id uuid','c5a538ab21cf8075244597026265ff04','plpgsql'),
    ('business_transaction_feed','p_workspace_id uuid, p_search text, p_kind text, p_status text, p_currency text, p_category_id uuid, p_dimension_id uuid, p_from date, p_to date, p_payment_source text, p_offset integer, p_limit integer','1e533705e473e4fbd26b1b71720057fd','plpgsql'),
    ('can_manage_family_members','p_family_id uuid','b87a3326a0b4ba66d7d8bd2444023852','sql'),
    ('cancel_business_bill','p_workspace_id uuid, p_bill_id uuid','2efa22752e9d506f340a8dda73c981b9','plpgsql'),
    ('cancel_business_invitation','p_invitation_id uuid','f4ed218336ba313a4809e69563a1760b','plpgsql'),
    ('cancel_family_invitation','p_invitation_id uuid','bfb4c5f2353f7908bfd0065d7302917c','plpgsql'),
    ('cashbook_can_access','p_workspace_id uuid','e2c5b3418cccdd901ae6188e157975d7','sql'),
    ('cashbook_report','p_workspace_id uuid, p_start_date date, p_end_date date','d8c3f85b9f7d93fecb82f1a02813d8d8','plpgsql'),
    ('complete_admin_user_invitation','p_invitation_id uuid, p_enabled_currencies text[], p_default_currency text','fadc9ea614cea9793d0a2fdd47529698','plpgsql'),
    ('complete_business_onboarding','p_workspace_id uuid','50303a9fb1af9063686e9f9aa8a54a30','plpgsql'),
    ('complete_self_signup_from_admin_invitation','p_full_name text, p_enabled_currencies text[], p_default_currency text','c4720c42d58c9dc64a567189c5ac435b','plpgsql'),
    ('create_business_bill','p_workspace_id uuid, p_supplier_id uuid, p_title text, p_reference text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_due_on date, p_remind_days_before integer, p_source_claim_id uuid, p_allow_duplicate boolean','a1f2c53654df86e59b4754b0524e6288','plpgsql'),
    ('create_business_bill_from_request','p_workspace_id uuid, p_request_id uuid, p_supplier_id uuid, p_reference text, p_due_on date, p_remind_days_before integer','bd591364e818e10bbc83460ffa483fa9','plpgsql'),
    ('create_business_bill_schedule','p_workspace_id uuid, p_supplier_id uuid, p_title text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_frequency text, p_interval_count integer, p_starts_on date, p_ends_on date, p_remind_days_before integer','1e1e6cac76bb916357ab594cb121eca8','plpgsql'),
    ('create_business_claim','p_workspace_id uuid, p_kind text, p_title text, p_description text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_expense_date date','b0a842d41aeb5dfab66be010e8d91378','plpgsql'),
    ('create_business_invitation','p_workspace_id uuid, p_email text, p_role text, p_scope_ids uuid[]','9607d491833af1f7780ee48adc253964','plpgsql'),
    ('create_cashbook_account','p_workspace_id uuid, p_name text, p_account_type text, p_currency text, p_opening_balance numeric, p_opening_balance_date date','db86c83e3dbb9cc77f8386567dcf769b','plpgsql'),
    ('create_cashbook_entry','p_workspace_id uuid, p_account_id uuid, p_direction text, p_amount numeric, p_transaction_date date, p_description text, p_category text, p_notes text','8f6fc71895a9f257207d964e8b501069','plpgsql'),
    ('create_cashbook_payment_entry','p_workspace_id uuid, p_account_id uuid, p_payment_record_id uuid, p_notes text, p_replace_manual_entry_id uuid','1fc33ebcbe7c9c25c7add76eafeb1a83','plpgsql'),
    ('create_cashbook_transfer','p_workspace_id uuid, p_source_account_id uuid, p_destination_account_id uuid, p_source_amount numeric, p_destination_amount numeric, p_transaction_date date, p_description text, p_notes text','2af39623d1c3f9e511c7051af36f942e','plpgsql'),
    ('create_completed_one_time_payment','p_workspace_id uuid, p_name text, p_category text, p_amount numeric, p_currency text, p_payment_date date, p_payment_method text, p_paid_by_member_id uuid, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint','4e93e71b415d5e5eab2165dfac660ea5','plpgsql'),
    ('create_family_workspace','p_name text, p_monthly_budget numeric, p_currency text','9d35c872f63ea929da8920b8080908ee','plpgsql'),
    ('delete_family_workspace','p_family_id uuid','b5a0b7a9cc674c7e9610ad57ef2aa982','plpgsql'),
    ('edit_business_invitation','p_invitation_id uuid, p_role text, p_scope_ids uuid[], p_expected_version integer','5f127540bd1153b475734c2aeb17784f','plpgsql'),
    ('effective_workspace_entitlement','p_workspace_id uuid','2e5d472e273e9a37794bb227e46f40e9','sql'),
    ('exchange_rate_status','p_include_admin_details boolean','1e8f16389c6331922aa7f5a5ecfad445','plpgsql'),
    ('family_extra_place_quote','p_workspace_id uuid, p_count integer','47cd0f525b4027042e5424cbe2341750','plpgsql'),
    ('get_my_admin_user_invitation','p_invitation_id uuid','ef53b989bee9cce0f0ece22685225e88','plpgsql'),
    ('get_my_business_invitations','','55167164725a8300cbaac93019628e16','plpgsql'),
    ('has_active_family_plan','','49f83f9a6a12a4055d5d67ab4c9ba5cf','sql'),
    ('has_my_unfinished_admin_invitation','','2e8c4ebe821dbbc5fa2fb9dfa41da44a','sql'),
    ('invite_family_member','p_family_id uuid, p_email text, p_role text','f9a079fcfe74cdafdaa5204e50aca435','plpgsql'),
    ('is_active_family_participant','p_family_id uuid','3ea90b1679ba5298ca9c182f3656b93f','sql'),
    ('is_app_admin','','25e2e8eddc2262f5a8857809d86e1f75','sql'),
    ('is_business_workspace_member','p_workspace_id uuid','3c4261f684996e48fd268d1428dfe0ff','sql'),
    ('is_platform_staff','p_roles text[]','5b2bc442c06de5c432a089b0a7d894e6','sql'),
    ('is_workspace_member','p_workspace_id uuid','51a764e62edf69ab00d434dca89a18bd','sql'),
    ('is_workspace_owner','p_workspace_id uuid','d2d732726b25ce9dfd7c909bae3ce571','sql'),
    ('my_account_suspended','','50f09055187b53f43bd55219ffe28c97','sql'),
    ('payment_plan_paused','p_payment_item_id uuid','9320f1eb3d18333739fe322fe3ff419e','sql'),
    ('payment_reminder_allowed','p_payment_item_id uuid','515809258254f346ce3d2cbd1669d2b4','sql'),
    ('personal_payment_plan_access','p_workspace_id uuid','b0555a87c246a6bb5353ffdfe020c680','sql'),
    ('prepare_business_invitation_resend','p_invitation_id uuid','9797a4e3b37bda4813dd4ddef3d68578','plpgsql'),
    ('provision_my_budget_workspace','','f161d594668fd62d6e9769b8968db0b8','plpgsql'),
    ('public_business_checkout_terms','','3c77089bb6862e01a70c350708f9168e','plpgsql'),
    ('record_business_bill_payment','p_workspace_id uuid, p_bill_id uuid, p_payment_id uuid, p_amount numeric, p_paid_at timestamp with time zone, p_reference text','3ea17dc9bad94d37ddbefa6e894b15b2','plpgsql'),
    ('record_business_bill_payment_with_source','p_workspace_id uuid, p_bill_id uuid, p_payment_id uuid, p_amount numeric, p_paid_at timestamp with time zone, p_reference text, p_payment_source text','538a426072eb4c5d3504b5f22e6741bc','plpgsql'),
    ('record_business_claim_payment','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer, p_paid_at timestamp with time zone, p_payment_reference text','92f29cae2069eca9ddaebd6e2e5c4c78','plpgsql'),
    ('record_business_claim_payment_with_source','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer, p_paid_at timestamp with time zone, p_payment_reference text, p_payment_source text','2d9f8d779d249773a741732760343d53','plpgsql'),
    ('record_business_income','p_workspace_id uuid, p_income_id uuid, p_title text, p_received_from text, p_reference text, p_description text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_received_on date, p_payment_source text','e2d9dae85bc1be0ffe71366e1b9e6317','plpgsql'),
    ('record_my_analytics_activity','','656730ea5ffcec5270f9aa29c16b20a6','plpgsql'),
    ('register_business_document','p_document_id uuid, p_workspace_id uuid, p_parent_type text, p_parent_id uuid, p_storage_path text, p_original_name text, p_mime_type text, p_size_bytes bigint, p_checksum_sha256 text','a1c891133d5117ed74bd23f6851e1ee1','plpgsql'),
    ('remove_business_member','p_workspace_id uuid, p_member_id uuid','f4efe1898c99a8c9af76f8d2ee634a8c','plpgsql'),
    ('remove_family_member','p_family_id uuid, p_member_id uuid','8ae20c6cca07ae03c5699756f0a75425','plpgsql'),
    ('respond_business_invitation','p_invitation_id uuid, p_accept boolean','dc900e92defc33bbc6156a31450824aa','plpgsql'),
    ('respond_to_family_invitation','p_invitation_id uuid, p_accept boolean','fa7ee186e6bc0a3cb128af586d01819d','plpgsql'),
    ('reverse_cashbook_entry','p_entry_id uuid, p_reason text','6e5463536d7a097bdf93f6738719c6a7','plpgsql'),
    ('review_business_claim','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer, p_decision text, p_reason text','41805a9a2698d13dbf139f333070484e','plpgsql'),
    ('review_subscription_payment','p_payment_id uuid, p_decision text, p_reason text','0659e5f3461f9041cce1cd90dc6cf7cc','plpgsql'),
    ('save_admin_finance_currency_settings','p_reporting_currency text, p_enabled_receipt_currencies text[], p_conversion_enabled boolean','ade932dfb2ae1ab036f15651fc4411d6','plpgsql'),
    ('save_business_billing_settings','p_plan_id uuid, p_expected_version integer, p_pilot_enabled boolean, p_included_seats integer, p_currency text, p_monthly_base numeric, p_annual_base numeric, p_monthly_seat numeric, p_annual_seat numeric, p_payment_instructions text','09cda50ebcb51cabbc6627718c1da675','plpgsql'),
    ('save_business_branding','p_workspace_id uuid, p_trading_name text, p_logo_path text, p_expected_version integer','787c600d0894fc118d099bb4256ecf16','plpgsql'),
    ('save_business_budget','p_workspace_id uuid, p_budget_id uuid, p_expected_version integer, p_name text, p_category_id uuid, p_dimension_id uuid, p_starts_on date, p_ends_on date, p_period_type text, p_planned_amount numeric','883926a55ffd481a4a3743bab56b003f','plpgsql'),
    ('save_business_category','p_workspace_id uuid, p_category_id uuid, p_category_type text, p_name text, p_code text, p_description text, p_colour text, p_status text, p_expected_version integer','c2f0e952764e7dde5eae45cf17858ade','plpgsql'),
    ('save_business_claim_draft','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer, p_title text, p_description text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_expense_date date','4710fbc021a7f99ae2bf982141b8cc5d','plpgsql'),
    ('save_business_dimension','p_workspace_id uuid, p_dimension_id uuid, p_dimension_type text, p_name text, p_code text, p_description text, p_parent_id uuid, p_status text, p_expected_version integer','53f5b2c4e29c5ffb7c98bffc05d45ba1','plpgsql'),
    ('save_business_expense_entry','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer, p_kind text, p_title text, p_description text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_expense_date date, p_employee_payment_source text','f1d30a598e06a87aa64236eedce78823','plpgsql'),
    ('save_business_role','p_workspace_id uuid, p_code text, p_name text, p_description text, p_scope_mode text, p_permissions text[], p_expected_version integer','cf92543f99a2d931daf4ca93473a2266','plpgsql'),
    ('save_business_setup','p_workspace_id uuid, p_trading_name text, p_base_currency text, p_enabled_currencies text[], p_timezone text, p_financial_year_start_month integer, p_period_start_day integer, p_expected_profile_version integer, p_expected_settings_updated_at timestamp with time zone','330c03d92eaaabb28421812cc3dc2418','plpgsql'),
    ('save_business_setup_draft','p_workspace_id uuid, p_kind text, p_description text, p_amount numeric, p_currency text, p_record_date date, p_due_date date, p_category_id uuid, p_dimension_id uuid, p_expected_version integer','08d52f74163a21284f3d5c7236daa005','plpgsql'),
    ('save_business_setup_with_branding','p_workspace_id uuid, p_trading_name text, p_base_currency text, p_enabled_currencies text[], p_timezone text, p_financial_year_start_month integer, p_period_start_day integer, p_expected_profile_version integer, p_expected_settings_updated_at timestamp with time zone, p_logo_path text','53cf082c3edc7eea290018075d6ed52b','plpgsql'),
    ('save_business_spending_request','p_workspace_id uuid, p_request_id uuid, p_expected_version integer, p_title text, p_description text, p_category_id uuid, p_dimension_id uuid, p_amount numeric, p_currency text, p_planned_on date','f794d7bca58797f925155af13b9d3664','plpgsql'),
    ('save_business_supplier','p_workspace_id uuid, p_supplier_id uuid, p_name text, p_email text, p_notes text, p_expected_version integer','ab454692093f4ddbea6669399c368e8c','plpgsql'),
    ('save_manual_payment_conversion','p_entity_type text, p_entity_id uuid, p_reporting_currency text, p_exchange_rate numeric, p_converted_amount numeric','413e75353fb5cdd3a00daa0b1878a638','plpgsql'),
    ('save_plan_definition','p_plan_id uuid, p_code text, p_display_name text, p_description text, p_marketing_summary text, p_workspace_type text, p_included_member_seats integer, p_active_payment_limit integer, p_is_active boolean, p_is_public boolean, p_is_featured boolean, p_available_for_purchase boolean, p_cta_label text, p_sort_order integer, p_feature_codes text[]','c94a23a0e53b5027ae021366acf8fab9','plpgsql'),
    ('save_plan_price','p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_extra_member_amount numeric','d6327f9346043296987cc7c0bcba440a','plpgsql'),
    ('save_workspace_currency_settings','p_workspace_id uuid, p_default_payment_currency text, p_enabled_currencies text[], p_reporting_currency text, p_conversion_enabled boolean','8610e31021a13517ff7f92e6e18c831e','plpgsql'),
    ('set_business_member_permission','p_workspace_id uuid, p_member_id uuid, p_permission_code text, p_effect text','551da68d93e6ed868d253a81e492b15a','plpgsql'),
    ('set_business_role_permission','p_workspace_id uuid, p_role text, p_permission_code text, p_enabled boolean','e6aa71092e5ada59313d45d350141fe6','plpgsql'),
    ('set_business_workflow_permission','p_workspace_id uuid, p_role text, p_permission_code text, p_enabled boolean','9bd8a832fa8067d7b69166f6382d61fe','plpgsql'),
    ('set_personal_free_payment_selection','p_workspace_id uuid, p_payment_ids uuid[]','a12a57da0589e2dc9f06d12782479692','plpgsql'),
    ('set_user_account_status','p_user_id uuid, p_status text','3dfcdad3f784e843f67f94eb71de2501','plpgsql'),
    ('stop_business_bill_schedule','p_workspace_id uuid, p_schedule_id uuid','1f08840f2b3a5c174b2b3c862283355f','plpgsql'),
    ('submit_business_claim','p_workspace_id uuid, p_claim_id uuid, p_expected_version integer','b7ef82280664803d523d9b6b4039e086','plpgsql'),
    ('submit_business_plan_request','p_personal_workspace_id uuid, p_business_name text, p_total_member_count integer, p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_expected_settings_version integer, p_payment_method text, p_payment_date date, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint, p_submission_id uuid','a705dd064c2ffd72e98adaf583581d1b','plpgsql'),
    ('submit_business_subscription_payment','p_workspace_id uuid, p_quote_id uuid, p_payment_id uuid, p_payment_method text, p_payment_date date, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint','762f37a850cd86de756dec93388e5076','plpgsql'),
    ('submit_family_extra_places','p_workspace_id uuid, p_count integer, p_expected_amount numeric, p_payment_method text, p_payment_date date, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint','c79c8234977bad0e42a02a1ee846f015','plpgsql'),
    ('submit_family_plan_request','p_personal_workspace_id uuid, p_family_name text, p_total_member_count integer, p_plan_code text, p_billing_period text, p_currency text, p_amount numeric, p_payment_method text, p_payment_date date, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint','bea495a86d960580993b92ec89e17bc3','plpgsql'),
    ('submit_subscription_renewal','p_workspace_id uuid, p_plan_code text, p_total_member_count integer, p_billing_period text, p_currency text, p_amount numeric, p_payment_method text, p_payment_date date, p_reference_number text, p_notes text, p_proof_path text, p_proof_name text, p_proof_mime_type text, p_proof_size_bytes bigint','d042eaf44ee772e1e006dc4dcd1fde13','plpgsql'),
    ('transfer_business_ownership','p_workspace_id uuid, p_new_owner_member_id uuid, p_confirmation_name text','070281c6f66cf6114b9032196079d746','plpgsql'),
    ('transition_business_budget','p_workspace_id uuid, p_budget_id uuid, p_expected_version integer, p_status text, p_reason text','526f8debf463bae2cff9b5df81590488','plpgsql'),
    ('transition_business_request','p_workspace_id uuid, p_request_id uuid, p_expected_version integer, p_action text, p_reason text','fdc2031105345dca4defdf1248161a2e','plpgsql'),
    ('update_business_member_access','p_workspace_id uuid, p_member_id uuid, p_role text, p_scope_ids uuid[]','173c8da75afb37bacc75bd5db7d15267','plpgsql'),
    ('update_business_member_role_access','p_workspace_id uuid, p_member_id uuid, p_role text, p_scope_ids uuid[], p_overrides jsonb','f1bf669ce0722a2e204c312568943e55','plpgsql'),
    ('void_business_income','p_workspace_id uuid, p_income_id uuid, p_reason text','73b22ae56be8970efdc1ce0b36f09a77','plpgsql'),
    ('workspace_billable_member_count','p_workspace_id uuid','0b51b307a840884d60d18e729ebcf4a9','sql'),
    ('workspace_has_feature','p_workspace_id uuid, p_feature_code text','c69a319c6b014095af507159beb0e1be','sql'),
    ('workspace_member_usage','p_workspace_id uuid','6e6518e57c9ad8dc6a220bb5390aa1ce','plpgsql')
  ) expected(name,arguments,body_md5,language) LOOP
    SELECT p.oid,p.prosrc,pg_get_functiondef(p.oid) INTO STRICT v_oid,v_old,v_definition
      FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang
      WHERE p.pronamespace='public'::regnamespace AND p.proname=f.name
        AND pg_get_function_identity_arguments(p.oid)=f.arguments
        AND l.lanname=f.language AND p.prosecdef AND NOT p.proisstrict
        AND md5(replace(p.prosrc,E'\r\n',E'\n'))=f.body_md5;
    IF length(v_definition)-length(replace(v_definition,v_old,''))<>length(v_old)
    THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_SOURCE_OCCURRENCE'; END IF;
    IF f.language='plpgsql' THEN
      -- Outer block guards DECLARE initializers as well as the original body.
      v_body:=E'\nBEGIN\n  PERFORM mushavo_email_auth.require_application_session();\n'||v_old||E'\nEND;\n';
    ELSIF f.language='sql' THEN
      v_body:=regexp_replace(btrim(v_old),';[[:space:]]*$','');
      IF (SELECT proretset FROM pg_proc WHERE oid=v_oid) THEN
        v_body:=E'\n#variable_conflict use_column\nBEGIN\n  PERFORM mushavo_email_auth.require_application_session();\n  RETURN QUERY\n'||v_body||E';\nEND;\n';
      ELSE
        v_body:=E'\n#variable_conflict use_column\nBEGIN\n  PERFORM mushavo_email_auth.require_application_session();\n  RETURN (\n'||v_body||E'\n  );\nEND;\n';
      END IF;
      IF position(E'\n LANGUAGE sql\n' IN v_definition)=0
      THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_SQL_LANGUAGE_SHAPE'; END IF;
      v_definition:=replace(v_definition,E'\n LANGUAGE sql\n',E'\n LANGUAGE plpgsql\n');
    ELSE RAISE EXCEPTION 'EMAIL_DATA_GUARD_LANGUAGE_NOT_REVIEWED'; END IF;
    EXECUTE replace(v_definition,v_old,v_body);
    IF (SELECT prosrc FROM pg_proc WHERE oid=v_oid) IS DISTINCT FROM v_body
      OR (SELECT l.lanname FROM pg_proc p JOIN pg_language l ON l.oid=p.prolang WHERE p.oid=v_oid)<>'plpgsql'
    THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_BODY_NOT_INSTALLED'; END IF;
    v_count:=v_count+1;
  END LOOP;

  FOR relation IN SELECT * FROM (VALUES
    ('public','admin_audit_logs'),
    ('public','admin_finance_settings'),
    ('public','admin_notification_outbox'),
    ('public','admin_subscription_grants'),
    ('public','admin_support_notes'),
    ('public','admin_user_invitation_audit'),
    ('public','admin_user_invitations'),
    ('public','analytics_activity_hours'),
    ('public','app_admins'),
    ('public','budget_workspaces'),
    ('public','business_admin_test_provisioning'),
    ('public','business_audit_events'),
    ('public','business_bill_payments'),
    ('public','business_bill_schedules'),
    ('public','business_billing_settings'),
    ('public','business_bills'),
    ('public','business_budgets'),
    ('public','business_categories'),
    ('public','business_change_signals'),
    ('public','business_dimensions'),
    ('public','business_documents'),
    ('public','business_expense_claims'),
    ('public','business_income_receipts'),
    ('public','business_invitation_scopes'),
    ('public','business_member_permissions'),
    ('public','business_member_scopes'),
    ('public','business_permission_definitions'),
    ('public','business_profiles'),
    ('public','business_public_provision_permits'),
    ('public','business_public_purchases'),
    ('public','business_role_permissions'),
    ('public','business_roles'),
    ('public','business_setup_drafts'),
    ('public','business_spending_requests'),
    ('public','business_subscription_quotes'),
    ('public','business_suppliers'),
    ('public','business_support_actions'),
    ('public','business_support_permits'),
    ('public','business_team_operation_permits'),
    ('public','cashbook_accounts'),
    ('public','cashbook_entries'),
    ('public','category_budgets'),
    ('public','countries'),
    ('public','enquiries'),
    ('public','enquiry_submission_limits'),
    ('public','exchange_rate_snapshots'),
    ('public','exchange_rate_sync_runs'),
    ('public','expenses'),
    ('public','families'),
    ('public','family_heads'),
    ('public','family_invitations'),
    ('public','family_members'),
    ('public','notification_outbox'),
    ('public','notifications'),
    ('public','payment_conversions'),
    ('public','payment_items'),
    ('public','payment_records'),
    ('public','payments'),
    ('public','plan_features'),
    ('public','plan_limits'),
    ('public','plan_prices'),
    ('public','plans'),
    ('public','product_release_controls'),
    ('public','profiles'),
    ('public','public_enquiry_events'),
    ('public','push_subscriptions'),
    ('public','push_test_rate_limits'),
    ('public','subscription_audit_events'),
    ('public','subscription_entitlement_history'),
    ('public','subscription_invoices'),
    ('public','subscription_payment_proofs'),
    ('public','subscription_payment_reviews'),
    ('public','subscription_payments'),
    ('public','subscription_renewal_requests'),
    ('public','support_ticket_messages'),
    ('public','support_tickets'),
    ('public','supported_currencies'),
    ('public','workspace_invitations'),
    ('public','workspace_members'),
    ('public','workspace_settings'),
    ('public','workspace_subscriptions'),
    ('storage','objects')
  ) expected(schema_name,table_name) LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname=relation.schema_name AND c.relname=relation.table_name
      AND c.relkind='r' AND c.relrowsecurity)
    THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_EXPECTED_RLS_TABLE_MISSING'; END IF;
    EXECUTE format('CREATE POLICY %I ON %I.%I AS RESTRICTIVE FOR ALL TO authenticated USING ((SELECT public.email_gate_current_session_verified())) WITH CHECK ((SELECT public.email_gate_current_session_verified()))',
      'Email verified session required',relation.schema_name,relation.table_name);
    v_policy_count:=v_policy_count+1;
  END LOOP;
  SELECT jsonb_build_object(
    'functions',(SELECT jsonb_agg(
      CASE WHEN p.oid=ANY(v_targets) THEN to_jsonb(p)-ARRAY['prosrc','prolang'] ELSE to_jsonb(p) END ORDER BY p.oid)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('public','mushavo_email_auth')
      AND NOT(n.nspname='mushavo_email_auth' AND p.proname='require_application_session')),
    'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.schemaname,p.tablename,p.policyname)
      FROM pg_policies p WHERE p.policyname<>'Email verified session required'),
    'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t),
    'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relacl::text,c.relowner,c.relrowsecurity,c.relforcerowsecurity,c.reloptions) ORDER BY c.oid)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','storage','mushavo_email_auth'))
  ) INTO v_after;
  IF v_count<>148 OR v_policy_count<>82 OR v_after IS DISTINCT FROM v_before
  THEN RAISE EXCEPTION 'EMAIL_DATA_GUARD_PROTECTED_METADATA_CHANGED'; END IF;
END;
$integration$;
COMMIT;
