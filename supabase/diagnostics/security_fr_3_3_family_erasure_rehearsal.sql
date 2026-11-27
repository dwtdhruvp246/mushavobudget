-- Disposable staging-only acceptance. The transaction always rolls back.
BEGIN;
SET LOCAL lock_timeout='1500ms';
SET LOCAL statement_timeout='25s';
DO $trial$
DECLARE owner_user uuid:=gen_random_uuid(); departing_user uuid:=gen_random_uuid(); test_family uuid:=gen_random_uuid();
 test_workspace uuid; test_item uuid:=gen_random_uuid(); test_payment uuid:=gen_random_uuid();
 request_uuid uuid:=gen_random_uuid(); owner_session uuid:=gen_random_uuid(); before_item jsonb; before_payment jsonb; receipt jsonb; test_member uuid:=gen_random_uuid(); child_member uuid:=gen_random_uuid(); child_before jsonb;
BEGIN
 IF NOT EXISTS(SELECT FROM mushavo_email_install.rollout_control WHERE target_project='dczlddwbtgvfdujgcitb') THEN RAISE EXCEPTION 'STAGING_ONLY'; END IF;
 INSERT INTO auth.users(id,email,raw_user_meta_data,email_confirmed_at,created_at,updated_at)
 VALUES (owner_user,'owner-'||owner_user||'@fr33familydetach.example.invalid','{"signup_source":"admin_invitation","full_name":"Synthetic Family Owner"}',now(),now(),now()),
        (departing_user,'member-'||departing_user||'@fr33familydetach.example.invalid','{"signup_source":"admin_invitation","full_name":"Synthetic Retained Family Person"}',now(),now(),now());
 INSERT INTO public.families(id,owner_id,name,currency) VALUES(test_family,owner_user,'Synthetic Family Detachment','USD');
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
 INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal) VALUES(owner_session,owner_user,now(),now(),'aal1');
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
 PERFORM set_config('request.jwt.claims','{}',true);
 INSERT INTO mushavo_account_deletion.requests(id,subject_id,workspace_impact_confirmed_at,workspace_impact_token)
 VALUES(request_uuid,departing_user,now(),mushavo_account_deletion.owned_workspace_impact(departing_user)->>'impact_token');
 receipt:=mushavo_account_deletion.detach_retained_family_memberships(request_uuid);
 IF receipt <> '{"family_payment_items_detached":1,"family_payments_detached":1,"family_memberships_detached":1,"family_member_creators_transferred":1,"family_access_rows_removed":1}' THEN RAISE EXCEPTION 'DETACH_COUNTS %',receipt; END IF;
 IF EXISTS(SELECT FROM mushavo_account_deletion.family_payment_update_permits) THEN RAISE EXCEPTION 'PERMIT_LEAK'; END IF;
 DELETE FROM auth.users WHERE id=departing_user AND email LIKE '%@fr33familydetach.example.invalid';
 IF NOT FOUND THEN RAISE EXCEPTION 'DISPOSABLE_AUTH_USER_MISSING'; END IF;
 IF NOT EXISTS(SELECT FROM public.payment_items i WHERE id=test_item AND owner_id=owner_user AND created_by IS NULL AND to_jsonb(i)-'owner_id'-'created_by'=before_item)
    OR NOT EXISTS(SELECT FROM public.payment_records p WHERE id=test_payment AND owner_id=owner_user AND recorded_by IS NULL AND to_jsonb(p)-'owner_id'-'recorded_by'=before_payment)
    OR NOT EXISTS(SELECT FROM public.fr33_family_payment_names WHERE payment_id=test_payment AND recorder_name='Synthetic Retained Family Person' AND payer_name='Synthetic Retained Family Person')
 THEN RAISE EXCEPTION 'FAMILY_HISTORY_CHANGED_OR_NAME_MISSING'; END IF;
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
 RESET ROLE;
 IF has_function_privilege('authenticated','mushavo_account_deletion.detach_retained_family_memberships(uuid)','EXECUTE') THEN
   RAISE EXCEPTION 'FAMILY_MEMBERSHIP_HELPER_PUBLIC';
 END IF;
 IF has_function_privilege('authenticated','mushavo_account_deletion.detach_retained_family_payment_actors(uuid)','EXECUTE')
    OR has_function_privilege('service_role','mushavo_account_deletion.detach_retained_family_payment_actors(uuid)','EXECUTE')
    OR has_table_privilege('authenticated','mushavo_account_deletion.family_payment_update_permits','INSERT')
 THEN RAISE EXCEPTION 'ORDINARY_USER_HAS_DETACH_GRANT'; END IF;
END;
$trial$;
ROLLBACK;
SELECT 'PASS' AS rolled_back_family_membership_detachment,
  NOT EXISTS(SELECT FROM auth.users WHERE email LIKE '%@fr33familydetach.example.invalid') AS disposable_accounts_clean;
