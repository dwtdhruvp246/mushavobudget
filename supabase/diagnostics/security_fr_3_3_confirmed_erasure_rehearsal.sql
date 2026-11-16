-- Staging-only owned Business erasure regression with disposable accounts.
BEGIN;
SET LOCAL lock_timeout='1500ms';
SET LOCAL statement_timeout='25s';
DO $trial$
DECLARE
  owner_user uuid := gen_random_uuid();
  departing_user uuid := gen_random_uuid();
  test_family uuid := gen_random_uuid();
  test_workspace uuid;
  test_item uuid := gen_random_uuid();
  test_payment uuid := gen_random_uuid();
  request_uuid uuid := gen_random_uuid();
  owner_session uuid := gen_random_uuid();
  before_item jsonb;
  before_payment jsonb;
  receipt jsonb;
  test_member uuid := gen_random_uuid();
  child_member uuid := gen_random_uuid();
  child_before jsonb;
  owned_family uuid := gen_random_uuid();
  owned_workspace uuid;
  owned_item uuid := gen_random_uuid();
  owned_record uuid := gen_random_uuid();
  personal_workspace uuid;
  personal_item uuid := gen_random_uuid();
  personal_record uuid := gen_random_uuid();
  departing_session uuid := gen_random_uuid();
  departing_claims text;
  guarded_budget uuid := gen_random_uuid();
  staff_user uuid := gen_random_uuid();
  staff_session uuid := gen_random_uuid();
  staff_claims text;
  surviving_business uuid := gen_random_uuid();
  owned_business uuid := gen_random_uuid();
  plan_uuid uuid;
  supplier_uuid uuid := gen_random_uuid();
  category_uuid uuid := gen_random_uuid();
  bill_uuid uuid := gen_random_uuid();
  bill_payment_uuid uuid := gen_random_uuid();
  bill_before jsonb;
  blocker text;
  owned_supplier uuid := gen_random_uuid();
  owned_category uuid := gen_random_uuid();
  owned_schedule uuid := gen_random_uuid();
  owned_bill uuid := gen_random_uuid();
  owned_claim uuid := gen_random_uuid();
  surviving_event uuid := gen_random_uuid();
  audit_snapshot jsonb;
  surviving_audit_snapshot jsonb;
  billing_grant uuid := gen_random_uuid();
BEGIN
 IF NOT EXISTS(SELECT FROM mushavo_email_install.rollout_control WHERE target_project='dczlddwbtgvfdujgcitb') THEN RAISE EXCEPTION 'STAGING_ONLY'; END IF;
 INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
 VALUES (owner_user,'owner-'||owner_user||'@fr33familydetach.example.invalid','{"signup_source":"admin_invitation","full_name":"Synthetic Family Owner"}',now(),now(),now()),
        (departing_user,'member-'||departing_user||'@fr33familydetach.example.invalid','{"signup_source":"self_signup","full_name":"Synthetic Retained Family Person"}',now(),now(),now());

 SELECT id INTO STRICT personal_workspace FROM public.budget_workspaces WHERE owner_id=departing_user AND workspace_type='personal';
 INSERT INTO public.families(id,owner_id,name,currency) VALUES
  (test_family,owner_user,'Synthetic Family Detachment','USD'),
  (owned_family,departing_user,'Synthetic Owned Active Family','USD');
 SELECT id INTO STRICT owned_workspace FROM public.budget_workspaces WHERE legacy_family_id=owned_family;
 UPDATE public.workspace_subscriptions SET entitlement_start_at=now()-interval '1 minute',
  paid_through_at=now()+interval '1 hour',member_limit=2 WHERE workspace_id=owned_workspace;
 SELECT id INTO STRICT test_workspace FROM public.budget_workspaces WHERE legacy_family_id=test_family;
 UPDATE public.workspace_subscriptions SET entitlement_start_at=now()-interval '1 minute',
  paid_through_at=now()+interval '1 hour',member_limit=2 WHERE workspace_id=test_workspace;
 IF NOT FOUND THEN RAISE EXCEPTION 'FIXTURE_ENTITLEMENT_MISSING'; END IF;
 INSERT INTO public.family_members(id,family_id,user_id,created_by,name,role,email,phone)
 VALUES(test_member,test_family,departing_user,owner_user,'Synthetic Retained Family Person','Adult',
  'contact@fr33familydetach.example.invalid','+12025550120');
 INSERT INTO public.family_members(id,family_id,created_by,name,role)
 VALUES(child_member,test_family,departing_user,'Other synthetic family member','Child');
 SELECT to_jsonb(m)-'created_by' INTO STRICT child_before FROM public.family_members m WHERE id=child_member;

 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal)
 VALUES(owner_session,owner_user,now(),now(),'aal1'),(departing_session,departing_user,now(),now(),'aal1');

 INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
 VALUES(staff_user,'staff-'||staff_user||'@fr33familydetach.example.invalid',
   '{"signup_source":"admin_invitation","full_name":"Synthetic Business Provisioner"}',now(),now(),now());
 INSERT INTO public.app_admins(user_id,email,role)
 VALUES(staff_user,'staff-'||staff_user||'@fr33familydetach.example.invalid','super_admin');
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal) VALUES(staff_session,staff_user,now(),now(),'aal2');
 staff_claims := jsonb_build_object('role','authenticated','sub',staff_user::text,
  'session_id',staff_session::text,'aal','aal2','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text;
 PERFORM set_config('request.jwt.claims',staff_claims,true);
 INSERT INTO public.business_admin_test_provisioning(workspace_id,owner_id,admin_id,transaction_id)
 VALUES(surviving_business,owner_user,staff_user,txid_current());
 INSERT INTO public.budget_workspaces(id,owner_id,workspace_type,name)
 VALUES(surviving_business,owner_user,'business','Other Owner Synthetic Business');
 INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
 VALUES(surviving_business,owner_user,'business_owner','active');
 DELETE FROM public.business_admin_test_provisioning WHERE workspace_id=surviving_business;
 SELECT id INTO STRICT plan_uuid FROM public.plans WHERE workspace_type='business' ORDER BY code LIMIT 1;
 INSERT INTO public.workspace_subscriptions(workspace_id,plan_id,status,billing_period,entitlement_start_at,paid_through_at)
 VALUES(surviving_business,plan_uuid,'active','monthly',now()-interval '1 minute',now()+interval '1 hour');
 INSERT INTO public.business_team_operation_permits(transaction_id,workspace_id,operation)
 VALUES(txid_current(),surviving_business,'member_write');
 INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
 VALUES(surviving_business,departing_user,'finance_manager','active');
 DELETE FROM public.business_team_operation_permits WHERE workspace_id=surviving_business;
 INSERT INTO public.business_suppliers(id,workspace_id,name)
 VALUES(supplier_uuid,surviving_business,'Synthetic Supplier');
 INSERT INTO public.business_categories(id,workspace_id,category_type,name)
 VALUES(category_uuid,surviving_business,'expense','Synthetic Expense Category');
 INSERT INTO public.business_bills(id,workspace_id,supplier_id,category_id,title,amount,currency,reporting_amount,
  reporting_currency,exchange_rate,rate_effective_at,rate_provider,due_on,paid_amount,status)
 VALUES(bill_uuid,surviving_business,supplier_uuid,category_uuid,'Synthetic Bill',43,'USD',43,'USD',1,now(),'identity',current_date,43,'paid');
 INSERT INTO public.business_bill_payments(id,workspace_id,bill_id,amount,currency,reporting_amount,reporting_currency,
   exchange_rate,rate_effective_at,rate_provider,paid_at,reference,recorded_by)
 VALUES(bill_payment_uuid,surviving_business,bill_uuid,43,'USD',43,'USD',1,now(),'identity',now(),'synthetic bill',departing_user);
 SELECT to_jsonb(payment)-'recorded_by' INTO STRICT bill_before FROM public.business_bill_payments payment WHERE id=bill_payment_uuid;

 PERFORM set_config('request.jwt.claims',staff_claims,true);
 INSERT INTO public.business_admin_test_provisioning(workspace_id,owner_id,admin_id,transaction_id)
 VALUES(owned_business,departing_user,staff_user,txid_current());
 INSERT INTO public.budget_workspaces(id,owner_id,workspace_type,name)
 VALUES(owned_business,departing_user,'business','Owned Synthetic Business');
 INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
 VALUES(owned_business,departing_user,'business_owner','active');
 DELETE FROM public.business_admin_test_provisioning WHERE workspace_id=owned_business;
 INSERT INTO public.business_team_operation_permits(transaction_id,workspace_id,operation)
 VALUES(txid_current(),owned_business,'member_write');
 INSERT INTO public.workspace_members(workspace_id,user_id,role,status)
 VALUES(owned_business,owner_user,'viewer','active');
 DELETE FROM public.business_team_operation_permits WHERE workspace_id=owned_business;
 INSERT INTO public.business_suppliers(id,workspace_id,name)
 VALUES(owned_supplier,owned_business,'Owned synthetic supplier');
 INSERT INTO public.business_categories(id,workspace_id,category_type,name)
 VALUES(owned_category,owned_business,'both','Owned synthetic category');
 INSERT INTO public.business_bill_schedules(id,workspace_id,supplier_id,title,category_id,amount,currency,frequency,starts_on)
 VALUES(owned_schedule,owned_business,owned_supplier,'Owned synthetic schedule',owned_category,23,'USD','monthly',current_date);
 INSERT INTO public.business_expense_claims(id,workspace_id,submitted_by,kind,title,category_id,amount,currency,
   reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,expense_date)
 VALUES(owned_claim,owned_business,departing_user,'company_expense','Owned synthetic claim',owned_category,23,'USD',
   'USD',23,1,now(),'identity',current_date);
 INSERT INTO public.business_spending_requests(id,workspace_id,submitted_by,title,description,category_id,amount,currency,
  reporting_currency,reporting_amount,exchange_rate,rate_effective_at,rate_provider,planned_on)
 VALUES(gen_random_uuid(),owned_business,departing_user,'Owned synthetic request','Fixture',owned_category,23,'USD',
  'USD',23,1,now(),'identity',current_date);
 INSERT INTO public.business_income_receipts(id,workspace_id,title,reference,category_id,amount,currency,reporting_currency,
   reporting_amount,exchange_rate,rate_effective_at,rate_provider,received_on,payment_source,recorded_by)
 VALUES(gen_random_uuid(),owned_business,'Owned synthetic income','Fixture',owned_category,41,'USD','USD',
   41,1,now(),'identity',current_date,'cash',departing_user);
 INSERT INTO public.business_budgets(id,workspace_id,name,starts_on,ends_on,period_type,planned_amount,reporting_currency,created_by)
 VALUES(gen_random_uuid(),owned_business,'Owned synthetic budget',current_date,current_date+30,'custom',61,'USD',departing_user);
 INSERT INTO public.business_bills(id,workspace_id,supplier_id,category_id,title,amount,currency,reporting_amount,
  reporting_currency,exchange_rate,rate_effective_at,rate_provider,due_on,paid_amount,status,schedule_id,occurrence_number,source_claim_id)
 VALUES(owned_bill,owned_business,owned_supplier,owned_category,'Owned synthetic bill',23,'USD',23,'USD',1,now(),
 'identity',current_date,23,'paid',owned_schedule,1,owned_claim);
 INSERT INTO public.business_bill_payments(id,workspace_id,bill_id,amount,currency,reporting_amount,reporting_currency,
  exchange_rate,rate_effective_at,rate_provider,paid_at,reference,recorded_by)
 VALUES(gen_random_uuid(),owned_business,owned_bill,23,'USD',23,'USD',1,now(),'identity',now(),'fixture',departing_user);
 INSERT INTO public.business_audit_events(id,workspace_id,actor_id,action,target_type,target_id,after_summary)
 VALUES (gen_random_uuid(),owned_business,departing_user,'bill.payment_recorded','business_bill',owned_bill,'{"amount":23}'),
   (surviving_event,surviving_business,departing_user,'bill.payment_recorded','business_bill',bill_uuid,'{"amount":43}');
 BEGIN
   UPDATE public.business_audit_events SET actor_id=NULL WHERE id=surviving_event;
   RAISE EXCEPTION 'ORDINARY_AUDIT_EDIT_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'BUSINESS_AUDIT_IMMUTABLE' THEN RAISE; END IF;
 END;
 BEGIN
   DELETE FROM public.business_audit_events WHERE workspace_id=owned_business;
   RAISE EXCEPTION 'ORDINARY_AUDIT_DELETE_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'BUSINESS_AUDIT_IMMUTABLE' THEN RAISE; END IF;
 END;
 SELECT jsonb_agg(to_jsonb(audit) ORDER BY id) INTO audit_snapshot
 FROM public.business_audit_events audit WHERE workspace_id=owned_business;
 SELECT (to_jsonb(audit)-'actor_id') INTO STRICT surviving_audit_snapshot FROM public.business_audit_events audit WHERE id=surviving_event;
 INSERT INTO auth.mfa_amr_claims(id,session_id,created_at,updated_at,authentication_method)
 VALUES(gen_random_uuid(),departing_session,now(),now(),'password');
 departing_claims := jsonb_build_object('role','authenticated','sub',departing_user::text,
  'session_id',departing_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text;
 PERFORM set_config('request.jwt.claims',departing_claims,true);
 INSERT INTO public.payment_items(id,owner_id,created_by,name,amount,currency,visibility)
 VALUES(personal_item,departing_user,departing_user,'Personal record due',19,'USD','personal');
 INSERT INTO public.payment_records(id,owner_id,payment_item_id,period_start,due_date,amount,recorded_by,currency,visibility)
 VALUES(personal_record,departing_user,personal_item,date_trunc('month',current_date)::date,current_date,19,departing_user,'USD','personal');
 INSERT INTO public.payment_items(id,family_id,owner_id,created_by,name,amount,currency)
 VALUES(owned_item,owned_family,departing_user,departing_user,'Payment in an owned Family',31,'USD');
 INSERT INTO public.payment_records(id,family_id,owner_id,payment_item_id,period_start,due_date,amount,recorded_by,currency)
 VALUES(owned_record,owned_family,departing_user,owned_item,date_trunc('month',current_date)::date,current_date,31,departing_user,'USD');
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner_user::text,'session_id',owner_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
 INSERT INTO public.payment_items(id,family_id,owner_id,created_by,name,amount,currency)
 VALUES(test_item,test_family,departing_user,departing_user,'Synthetic recurring payment',17,'USD');
 INSERT INTO public.payment_records(id,family_id,owner_id,payment_item_id,period_start,due_date,amount,recorded_by,currency,paid_by_member_id)
 VALUES(test_payment,test_family,departing_user,test_item,date_trunc('month',current_date)::date,current_date,17,departing_user,'USD',test_member);
 SELECT to_jsonb(i)-'owner_id'-'created_by' INTO STRICT before_item FROM public.payment_items i WHERE id=test_item;
 SELECT to_jsonb(p)-'owner_id'-'recorded_by' INTO STRICT before_payment FROM public.payment_records p WHERE id=test_payment;
 BEGIN
  UPDATE public.payment_records SET recorded_by=NULL WHERE id=test_payment;
  RAISE EXCEPTION 'ORDINARY_NULL_RECORDER_WAS_ACCEPTED';
 EXCEPTION WHEN not_null_violation THEN
  IF SQLERRM <> 'FR33_FAMILY_PAYMENT_ACTOR_REQUIRED' THEN RAISE; END IF;
 END;

 PERFORM set_config('request.jwt.claims',departing_claims,true);
 SET LOCAL ROLE authenticated;
 IF public.app_session_status()->>'session_valid' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'FIXTURE_SESSION_INVALID'; END IF;
 IF NOT EXISTS (SELECT FROM jsonb_array_elements(public.fr33_account_deletion_impact()->'workspaces') entry
   WHERE entry->>'name'='Owned Synthetic Business')
 THEN RAISE EXCEPTION 'OWNED_BUSINESS_NOT_DISCLOSED'; END IF;
 request_uuid := (public.fr33_submit_account_deletion(public.fr33_account_deletion_impact()->>'impact_token')->>'request_id')::uuid;
 RESET ROLE;
 PERFORM set_config('request.jwt.claims','{}',true);

 UPDATE public.families SET name='Changed after confirmation' WHERE id=owned_family;
 BEGIN
   PERFORM mushavo_account_deletion.execute_confirmed_request(request_uuid);
   RAISE EXCEPTION 'STALE_WORKSPACE_CONFIRMATION_WAS_ACCEPTED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'FR33_WORKSPACE_IMPACT_CHANGED' THEN RAISE; END IF;
 END;
 UPDATE public.families SET name='Synthetic Owned Active Family' WHERE id=owned_family;

 -- Unclassified platform billing still blocks completion and rolls back both the archive and finance deletes.
 INSERT INTO public.admin_subscription_grants(id,workspace_id,owner_id,plan_id,billing_period,starts_on,
   ends_on,grant_kind,reason,granted_by)
 VALUES(billing_grant,owned_business,departing_user,plan_uuid,'monthly',current_date,current_date+30,
   'business_test','Synthetic billing retention test',staff_user);
 BEGIN
   PERFORM mushavo_account_deletion.execute_confirmed_request(request_uuid);
   RAISE EXCEPTION 'BILLING_RETENTION_DEPENDENCY_WAS_IGNORED';
 EXCEPTION WHEN raise_exception THEN
   GET STACKED DIAGNOSTICS blocker = PG_EXCEPTION_DETAIL;
   IF SQLERRM <> 'FR33_OWNED_WORKSPACE_DEPENDENCY_REVIEW_REQUIRED'
     OR blocker IS DISTINCT FROM 'public.admin_subscription_grants.workspace_id' THEN RAISE; END IF;
 END;
 IF EXISTS (SELECT 1 FROM mushavo_account_deletion.closed_business_audit_events WHERE workspace_id=owned_business)
   OR (SELECT jsonb_agg(to_jsonb(audit) ORDER BY id) FROM public.business_audit_events audit WHERE workspace_id=owned_business)
      IS DISTINCT FROM audit_snapshot
   OR NOT EXISTS (SELECT 1 FROM public.business_bills WHERE id=owned_bill)
   OR NOT EXISTS (SELECT 1 FROM public.business_audit_events WHERE id=surviving_event AND actor_id=departing_user)
 THEN RAISE EXCEPTION 'BUSINESS_BILLING_BLOCKER_DID_NOT_ROLL_BACK'; END IF;
 DELETE FROM public.admin_subscription_grants WHERE id=billing_grant;

 -- This legacy shared reference is unhandled. Execution must roll back every prior mutation.
 INSERT INTO public.category_budgets(id,family_id,category,created_by) VALUES(guarded_budget,test_family,'Synthetic retained budget',departing_user);
 BEGIN
   PERFORM mushavo_account_deletion.execute_confirmed_request(request_uuid);
   RAISE EXCEPTION 'UNCLASSIFIED_SHARED_CASCADE_WAS_ACCEPTED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'FR33_ACCOUNT_DEPENDENCY_REVIEW_REQUIRED' THEN RAISE; END IF;
 END;
 IF NOT EXISTS (SELECT FROM auth.users WHERE id=departing_user)
    OR NOT EXISTS (SELECT FROM public.payment_records WHERE id=owned_record)
    OR NOT EXISTS (SELECT FROM public.workspace_members WHERE workspace_id=test_workspace AND user_id=departing_user)
    OR NOT EXISTS (SELECT FROM public.payment_records WHERE id=test_payment AND recorded_by=departing_user)
    OR NOT EXISTS (SELECT FROM public.business_bill_payments WHERE id=bill_payment_uuid AND recorded_by=departing_user)
    OR EXISTS (SELECT FROM public.fr33_family_payment_names WHERE payment_id=test_payment)
 THEN RAISE EXCEPTION 'FAILED_EXECUTION_DID_NOT_ROLL_BACK'; END IF;
 DELETE FROM public.category_budgets WHERE id=guarded_budget;

 receipt:=mushavo_account_deletion.execute_confirmed_request(request_uuid);
 IF receipt->>'status' <> 'completed' OR receipt IS DISTINCT FROM mushavo_account_deletion.execute_confirmed_request(request_uuid)
    OR NOT EXISTS (SELECT FROM mushavo_account_deletion.requests WHERE id=request_uuid AND subject_id IS NULL
      AND completed_at IS NOT NULL AND workspace_impact_token IS NULL)
 THEN RAISE EXCEPTION 'EXECUTION_OR_REPLAY_RECEIPT_MISSING'; END IF;
 IF EXISTS (SELECT FROM auth.users WHERE id=departing_user) OR EXISTS (SELECT FROM auth.sessions WHERE id=departing_session)
    OR EXISTS (SELECT FROM public.profiles WHERE id=departing_user)
    OR EXISTS (SELECT FROM public.families WHERE id=owned_family)
    OR EXISTS (SELECT FROM public.budget_workspaces WHERE id=owned_workspace)
    OR EXISTS (SELECT FROM public.budget_workspaces WHERE id=personal_workspace)
    OR EXISTS (SELECT FROM public.payment_items WHERE id=personal_item)
    OR EXISTS (SELECT FROM public.payment_records WHERE id=personal_record)
    OR EXISTS (SELECT FROM public.payment_items WHERE id=owned_item)
    OR EXISTS (SELECT FROM public.payment_records WHERE id=owned_record)
    OR EXISTS (SELECT FROM mushavo_account_deletion.owned_payment_delete_permits)
 THEN RAISE EXCEPTION 'ACCOUNT_OR_OWNED_WORKSPACE_STATE_REMAINS'; END IF;
 PERFORM set_config('request.jwt.claims',departing_claims,true);
 SET LOCAL ROLE authenticated;
 IF public.app_session_status()->>'session_valid' = 'true' THEN RAISE EXCEPTION 'DELETED_ACCOUNT_SESSION_STILL_VALID'; END IF;
 RESET ROLE;
 IF has_function_privilege('authenticated','mushavo_account_deletion.execute_confirmed_request(uuid)','EXECUTE')
  OR has_function_privilege('service_role','mushavo_account_deletion.execute_confirmed_request(uuid)','EXECUTE')
  OR has_table_privilege('authenticated','mushavo_account_deletion.owned_payment_delete_permits','INSERT')
 THEN RAISE EXCEPTION 'PRIVATE_EXECUTION_EXPOSED'; END IF;
 IF NOT EXISTS(SELECT FROM public.payment_items i WHERE id=test_item AND owner_id=owner_user AND created_by IS NULL AND to_jsonb(i)-'owner_id'-'created_by'=before_item)
    OR NOT EXISTS(SELECT FROM public.payment_records p WHERE id=test_payment AND owner_id=owner_user AND recorded_by IS NULL AND to_jsonb(p)-'owner_id'-'recorded_by'=before_payment)
    OR NOT EXISTS(SELECT FROM public.fr33_family_payment_names WHERE payment_id=test_payment AND recorder_name='Synthetic Retained Family Person' AND payer_name='Synthetic Retained Family Person')
 THEN RAISE EXCEPTION 'FAMILY_HISTORY_CHANGED_OR_NAME_MISSING'; END IF;
 IF EXISTS (SELECT FROM public.budget_workspaces WHERE id=owned_business)
   OR EXISTS (SELECT FROM public.workspace_members WHERE workspace_id=owned_business)
   OR NOT EXISTS (SELECT FROM public.workspace_members WHERE workspace_id=surviving_business
       AND user_id=owner_user AND role='business_owner' AND status='active')
   OR EXISTS (SELECT FROM public.business_audit_events WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_bills WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_bill_payments WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_bill_schedules WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_expense_claims WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_spending_requests WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_income_receipts WHERE workspace_id=owned_business)
   OR EXISTS (SELECT FROM public.business_budgets WHERE workspace_id=owned_business)
   OR (SELECT jsonb_agg(event ORDER BY event_id) FROM mushavo_account_deletion.closed_business_audit_events WHERE workspace_id=owned_business)
      IS DISTINCT FROM audit_snapshot
   OR NOT EXISTS (SELECT FROM public.business_audit_events audit WHERE id=surviving_event AND actor_id IS NULL
      AND (to_jsonb(audit)-'actor_id')=surviving_audit_snapshot)
   OR EXISTS (SELECT FROM mushavo_account_deletion.business_audit_erasure_permits)
   OR has_table_privilege('authenticated','mushavo_account_deletion.closed_business_audit_events','SELECT')
   OR has_table_privilege('service_role','mushavo_account_deletion.closed_business_audit_events','SELECT')
   OR has_function_privilege('authenticated','mushavo_account_deletion.prepare_business_workspace_erasure(uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'OWNED_BUSINESS_OR_AUDIT_STATE_MISMATCH'; END IF;
 BEGIN
   DELETE FROM mushavo_account_deletion.closed_business_audit_events WHERE workspace_id=owned_business;
   RAISE EXCEPTION 'ARCHIVED_AUDIT_DELETE_ALLOWED';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM <> 'BUSINESS_AUDIT_IMMUTABLE' THEN RAISE; END IF;
 END;
 IF NOT EXISTS (SELECT FROM public.business_bill_payments payment WHERE id=bill_payment_uuid AND recorded_by IS NULL
      AND to_jsonb(payment)-'recorded_by'=bill_before)
    OR NOT EXISTS (SELECT FROM public.fr33_bill_payment_names WHERE payment_id=bill_payment_uuid
      AND recorder_name='Synthetic Retained Family Person')
    OR EXISTS (SELECT FROM public.workspace_members WHERE workspace_id=surviving_business AND user_id=departing_user)
 THEN RAISE EXCEPTION 'SHARED_BUSINESS_BILL_PAYMENT_OR_NAME_CHANGED'; END IF;
 IF EXISTS (SELECT FROM public.workspace_members WHERE workspace_id=test_workspace AND user_id=departing_user)
    OR NOT EXISTS (SELECT FROM public.family_members WHERE id=test_member AND user_id IS NULL
      AND status='inactive' AND email IS NULL AND phone IS NULL)
    OR NOT EXISTS (SELECT FROM public.family_members m WHERE id=child_member AND created_by=owner_user
      AND to_jsonb(m)-'created_by'=child_before) THEN RAISE EXCEPTION 'FAMILY_MEMBERSHIPS_CHANGED_UNEXPECTEDLY'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',owner_user::text,
  'session_id',owner_session::text,'aal','aal1','exp',floor(extract(epoch from now()+interval '5 minutes'))::bigint)::text,true);
 SET LOCAL ROLE authenticated;
 IF NOT EXISTS (SELECT FROM public.payment_records WHERE id=test_payment AND amount=17)
    OR NOT EXISTS (SELECT FROM public.fr33_family_payment_names WHERE payment_id=test_payment
      AND recorder_name='Synthetic Retained Family Person' AND payer_name='Synthetic Retained Family Person')
 THEN RAISE EXCEPTION 'SURVIVING_OWNER_CANNOT_READ_FAMILY_HISTORY'; END IF;
 IF NOT EXISTS (SELECT FROM public.business_bill_payments WHERE id=bill_payment_uuid AND amount=43)
    OR NOT EXISTS (SELECT FROM public.fr33_bill_payment_names WHERE payment_id=bill_payment_uuid
       AND recorder_name='Synthetic Retained Family Person')
 THEN RAISE EXCEPTION 'SURVIVING_OWNER_CANNOT_READ_BUSINESS_HISTORY'; END IF;
 RESET ROLE;
 IF has_function_privilege('authenticated','mushavo_account_deletion.detach_retained_family_memberships(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'FAMILY_MEMBERSHIP_HELPER_PUBLIC';
 END IF;
 IF has_function_privilege('authenticated','mushavo_account_deletion.detach_retained_family_payment_actors(uuid)','EXECUTE')
    OR has_function_privilege('service_role','mushavo_account_deletion.detach_retained_family_payment_actors(uuid)','EXECUTE')
    OR has_table_privilege('authenticated','mushavo_account_deletion.family_payment_update_permits','INSERT')
 THEN RAISE EXCEPTION 'ORDINARY_USER_HAS_DETACH_GRANT'; END IF;
 RAISE NOTICE 'FR33_OWNED_BUSINESS_ERASURE_REHEARSAL_PASSED';
END;
$trial$;
ROLLBACK;
SELECT NOT EXISTS(SELECT FROM auth.users WHERE email LIKE '%@fr33familydetach.example.invalid') AS disposable_accounts_clean;
