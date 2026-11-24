-- Run against the verified production project as the operator.
-- Every fixture, grant, and status update is rolled back before this returns.
BEGIN;
SET LOCAL search_path = pg_catalog;
SET LOCAL lock_timeout = '1500ms';
SET LOCAL statement_timeout = '15s';

DO $rehearsal$
DECLARE
  assignee constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96490';
  other_staff constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96491';
  outsider constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96492';
  ticket constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96493';
  other_ticket constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96494';
  message constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96495';
  fixture_object_id constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96496';
  assignee_session constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96497';
  other_staff_session constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96498';
  outsider_session constant uuid := 'b033d31a-5806-4df0-8a3d-6357b3e96499';
  object_name constant text := 'personal/' || assignee || '/fr33-rollback-fixture.png';
  expires constant timestamptz := statement_timestamp() + interval '5 minutes';
  exp_claim constant bigint := floor(extract(epoch FROM expires))::bigint;
  archive_detail jsonb;
BEGIN
  IF has_function_privilege('authenticated','public.fr33_submit_account_deletion(text)','EXECUTE')
    OR has_function_privilege('authenticated','public.fr33_list_assigned_support_archive(uuid)','EXECUTE')
    OR has_function_privilege('authenticated','public.fr33_assigned_support_archive(uuid,integer)','EXECUTE')
    OR has_function_privilege('authenticated','public.fr33_close_support_archive(uuid)','EXECUTE')
    OR EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_support_records)
    OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id='payment-proofs' AND public=false)
  THEN RAISE EXCEPTION 'FR33_CLOSED_PRODUCTION_BASELINE_REQUIRED'; END IF;

  INSERT INTO auth.users(id,aud,role,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  SELECT id, 'authenticated','authenticated',id || '@example.invalid',statement_timestamp(),
         '{"provider":"email","providers":["email"]}'::jsonb,
         '{"full_name":"FR33 Rollback Fixture"}'::jsonb, statement_timestamp(), statement_timestamp()
  FROM unnest(ARRAY[assignee,other_staff,outsider]) AS f(id);
  INSERT INTO public.app_admins(user_id,email,role)
  VALUES (assignee,assignee || '@example.invalid','support_staff'),
         (other_staff,other_staff || '@example.invalid','support_staff');
  INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal,not_after,user_agent)
  VALUES (assignee_session,assignee,statement_timestamp(),statement_timestamp(),'aal1',expires,'FR33 rollback fixture'),
         (other_staff_session,other_staff,statement_timestamp(),statement_timestamp(),'aal1',expires,'FR33 rollback fixture'),
         (outsider_session,outsider,statement_timestamp(),statement_timestamp(),'aal1',expires,'FR33 rollback fixture');

  INSERT INTO mushavo_account_deletion.retained_support_records(record_type,record_id,ticket_id,record)
  VALUES ('ticket',ticket,ticket,jsonb_build_object('assigned_admin_id',assignee,'subject','Synthetic assigned case','status','open')),
         ('ticket',other_ticket,other_ticket,jsonb_build_object('assigned_admin_id',other_staff,'subject','Synthetic neighboring case','status','open')),
         ('message',message,ticket,jsonb_build_object('body','Synthetic archived message','created_at',statement_timestamp()));
  -- Database metadata only. The hosted HTTP test must upload real synthetic bytes.
  INSERT INTO storage.objects(id,bucket_id,name,owner_id,version,metadata)
  VALUES (fixture_object_id,'payment-proofs',object_name,assignee::text,'fr33-rollback-fixture',
          '{"size":68,"mimetype":"image/png","eTag":"fixture"}'::jsonb);

  GRANT EXECUTE ON FUNCTION public.fr33_list_assigned_support_archive(uuid),
    public.fr33_assigned_support_archive(uuid,integer),public.fr33_close_support_archive(uuid) TO authenticated;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',assignee,
    'session_id',assignee_session,'aal','aal1','exp',exp_claim)::text,true);
  SET LOCAL ROLE authenticated;

  IF (SELECT count(*) FROM public.fr33_list_assigned_support_archive(NULL)) <> 1
    OR NOT EXISTS (SELECT 1 FROM public.fr33_list_assigned_support_archive(NULL) AS page
                   WHERE page.ticket_id=ticket AND page.status='open')
  THEN RAISE EXCEPTION 'FR33_ASSIGNED_LIST_SCOPE_FAILED'; END IF;
  archive_detail := public.fr33_assigned_support_archive(ticket,0);
  IF jsonb_array_length(archive_detail->'messages') IS DISTINCT FROM 1
    OR archive_detail->'ticket'->>'subject' IS DISTINCT FROM 'Synthetic assigned case'
    OR public.fr33_assigned_support_archive(other_ticket,0) IS NOT NULL
    OR public.fr33_close_support_archive(other_ticket) IS DISTINCT FROM false
  THEN RAISE EXCEPTION 'FR33_ARCHIVE_DETAIL_OR_CLOSE_SCOPE_FAILED'; END IF;
  IF public.fr33_close_support_archive(ticket) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'FR33_ARCHIVE_CLOSE_FAILED'; END IF;
  IF public.fr33_close_support_archive(ticket) IS DISTINCT FROM false
    OR (public.fr33_assigned_support_archive(ticket,0)->'ticket'->>'status') IS DISTINCT FROM 'closed'
  THEN RAISE EXCEPTION 'FR33_ARCHIVE_CLOSE_READBACK_FAILED'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.private_file_download_context('payment-proofs',object_name) AS proof
                 WHERE proof.object_id=fixture_object_id AND proof.size_bytes=68 AND proof.mime_type='image/png')
  THEN RAISE EXCEPTION 'FR33_PROOF_OWNER_CONTEXT_FAILED'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',other_staff,
    'session_id',other_staff_session,'aal','aal1','exp',exp_claim)::text,true);
  IF public.fr33_assigned_support_archive(ticket,0) IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM public.fr33_list_assigned_support_archive(NULL) AS page
                   WHERE page.ticket_id=other_ticket AND page.status='open')
  THEN RAISE EXCEPTION 'FR33_OTHER_STAFF_SCOPE_FAILED'; END IF;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',outsider,
    'session_id',outsider_session,'aal','aal1','exp',exp_claim)::text,true);
  IF EXISTS (SELECT 1 FROM public.private_file_download_context('payment-proofs',object_name))
  THEN RAISE EXCEPTION 'FR33_PROOF_OUTSIDER_DENIAL_FAILED'; END IF;
  BEGIN
    PERFORM public.fr33_list_assigned_support_archive(NULL);
    RAISE EXCEPTION 'FR33_NONSTAFF_ARCHIVE_DENIAL_FAILED';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED' THEN RAISE; END IF;
  END;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',assignee,
    'session_id','00000000-0000-0000-0000-000000000000','aal','aal1','exp',exp_claim)::text,true);
  IF EXISTS (SELECT 1 FROM public.private_file_download_context('payment-proofs',object_name))
  THEN RAISE EXCEPTION 'FR33_INACTIVE_PROOF_SESSION_DENIAL_FAILED'; END IF;
  BEGIN
    PERFORM public.fr33_assigned_support_archive(ticket,0);
    RAISE EXCEPTION 'FR33_INACTIVE_ARCHIVE_SESSION_DENIAL_FAILED';
  EXCEPTION WHEN insufficient_privilege THEN
    IF SQLERRM <> 'EMAIL_VERIFICATION_REQUIRED' THEN RAISE; END IF;
  END;

  RESET ROLE;
  SET LOCAL ROLE service_role;
  IF public.reserve_private_file_download(assignee,'payment-proofs',object_name,67) IS DISTINCT FROM false
    OR public.reserve_private_file_download(assignee,'payment-proofs',object_name,68) IS DISTINCT FROM true
  THEN RAISE EXCEPTION 'FR33_PROOF_QUOTA_REHEARSAL_FAILED'; END IF;
  RESET ROLE;
END;
$rehearsal$;

SELECT jsonb_build_object('stage',3,'fr','3.3','batch','production-authorization-rehearsal',
  'result','ARCHIVE_AND_PRIVATE_FILE_DATABASE_RULES_PASS','archive_assignment_and_close',true,
  'proof_context_and_quota',true,'outsider_and_inactive_sessions_denied',true,
  'hosted_file_bytes_tested',false,'hosted_archive_rpc_tested',false) AS safe_receipt;
ROLLBACK;
