-- Staging rehearsal. All inserted records, holds, changes and outcomes are rolled back.
BEGIN;
DO $fixture$
DECLARE
  expired_ticket uuid:=gen_random_uuid();
  held_ticket uuid:=gen_random_uuid();
  recent_ticket uuid:=gen_random_uuid();
  open_ticket uuid:=gen_random_uuid();
  late_message_ticket uuid:=gen_random_uuid();
  unknown_ticket uuid:=gen_random_uuid();
  closed_later_ticket uuid:=gen_random_uuid();
  expired_receipt uuid:=gen_random_uuid();
  held_receipt uuid:=gen_random_uuid();
  recent_receipt uuid:=gen_random_uuid();
  pending_request uuid:=gen_random_uuid();
  fixture_message uuid:=gen_random_uuid();
  late_message uuid:=gen_random_uuid();
  baseline record;
  result jsonb;
BEGIN
  IF (mushavo_account_deletion.process_retention_batch(10)->>'status') IS DISTINCT FROM 'disabled'
  THEN RAISE EXCEPTION 'FR33_RETENTION_FIXTURE_REQUIRES_DISABLED_PROCESSOR'; END IF;

  SELECT * INTO STRICT baseline FROM mushavo_account_deletion.anonymous_support_totals WHERE singleton;
  INSERT INTO mushavo_account_deletion.retained_support_records(record_type,record_id,ticket_id,record)
  SELECT 'ticket',data.id,data.id,jsonb_build_object('id',data.id,'customer_id',gen_random_uuid(),
    'status',data.status,'subject','synthetic support','description','disposable@example.invalid',
    'created_at',statement_timestamp()-interval '27 months',
    'resolved_at',statement_timestamp()-data.age,
    'updated_at',statement_timestamp()-data.updated_age) || data.extension
  FROM (VALUES
    (expired_ticket,'closed',interval '25 months',interval '25 months','{}'::jsonb),
    (held_ticket,'closed',interval '25 months',interval '25 months','{}'::jsonb),
    (recent_ticket,'closed',interval '23 months',interval '23 months','{}'::jsonb),
    (open_ticket,'in_progress',interval '25 months',interval '25 months','{}'::jsonb),
    (late_message_ticket,'closed',interval '25 months',interval '25 months','{}'::jsonb),
    (unknown_ticket,'closed',interval '25 months',interval '25 months','{"attachment":"unknown-shape"}'::jsonb),
    (closed_later_ticket,'closed',interval '25 months',interval '23 months','{}'::jsonb)
  ) AS data(id,status,age,updated_age,extension);
  INSERT INTO mushavo_account_deletion.retained_support_records(record_type,record_id,ticket_id,record) VALUES
    ('message',fixture_message,expired_ticket,jsonb_build_object('id',fixture_message,'ticket_id',expired_ticket,
      'body','Synthetic customer details','author_id',gen_random_uuid(),'created_at',statement_timestamp()-interval '26 months')),
    ('message',late_message,late_message_ticket,jsonb_build_object('id',late_message,'ticket_id',late_message_ticket,
      'body','Synthetic case resumed','author_id',gen_random_uuid(),'created_at',statement_timestamp()-interval '23 months'));

  INSERT INTO mushavo_account_deletion.requests(id,created_at,completed_at) VALUES
    (expired_receipt,statement_timestamp()-interval '14 months',statement_timestamp()-interval '13 months'),
    (held_receipt,statement_timestamp()-interval '14 months',statement_timestamp()-interval '13 months'),
    (recent_receipt,statement_timestamp()-interval '8 months',statement_timestamp()-interval '7 months'),
    (pending_request,statement_timestamp()-interval '14 months',NULL);
  INSERT INTO mushavo_account_deletion.processor_attempts(request_id,confirmed_at,attempted_at,attempt_count)
  SELECT id,statement_timestamp()-interval '14 months',statement_timestamp()-interval '6 months',1
  FROM unnest(ARRAY[expired_receipt,held_receipt,recent_receipt,pending_request]) AS fixture(id);
  INSERT INTO mushavo_account_deletion.retention_holds(record_kind,record_id,reason,recorded_at,review_at) VALUES
    ('support_case',held_ticket,'Synthetic open dispute',statement_timestamp()-interval '1 year',statement_timestamp()-interval '1 day'),
    ('erasure_receipt',held_receipt,'Synthetic open complaint',statement_timestamp()-interval '1 year',statement_timestamp()-interval '1 day');

  UPDATE mushavo_account_deletion.retention_control SET enabled=true,
    fixture_support_ids=ARRAY[expired_ticket,held_ticket,recent_ticket,open_ticket,late_message_ticket,unknown_ticket,closed_later_ticket],
    fixture_request_ids=ARRAY[expired_receipt,held_receipt,recent_receipt,pending_request] WHERE singleton;
  result:=mushavo_account_deletion.process_retention_batch(10);
  IF result <> '{"status":"processed","support_tickets":1,"support_messages":1,"deletion_processing_logs":2,"deletion_receipts":1}'::jsonb
    OR EXISTS(SELECT FROM mushavo_account_deletion.retained_support_records where ticket_id=expired_ticket)
    OR (SELECT count(*) FROM mushavo_account_deletion.retained_support_records WHERE record_id=ANY(
      ARRAY[held_ticket,recent_ticket,open_ticket,late_message_ticket,unknown_ticket,late_message,closed_later_ticket])) <> 7
    OR EXISTS(SELECT FROM mushavo_account_deletion.requests WHERE id=expired_receipt)
    OR (SELECT count(*) FROM mushavo_account_deletion.requests WHERE id=ANY(ARRAY[held_receipt,recent_receipt,pending_request])) <> 3
    OR EXISTS(SELECT FROM mushavo_account_deletion.processor_attempts WHERE request_id=ANY(ARRAY[expired_receipt,recent_receipt]))
    OR (SELECT count(*) FROM mushavo_account_deletion.processor_attempts WHERE request_id=ANY(ARRAY[held_receipt,pending_request])) <> 2
    OR NOT EXISTS(SELECT FROM mushavo_account_deletion.anonymous_support_totals totals WHERE singleton
      AND totals.ticket_count=baseline.ticket_count+1 AND totals.message_count=baseline.message_count+1)
  THEN RAISE EXCEPTION 'FR33_RETENTION_FIXTURE_UNEXPECTED_OUTCOME %',result; END IF;

  result:=mushavo_account_deletion.process_retention_batch(10);
  IF result <> '{"status":"processed","support_tickets":0,"support_messages":0,"deletion_processing_logs":0,"deletion_receipts":0}'::jsonb
  THEN RAISE EXCEPTION 'FR33_RETENTION_FIXTURE_REPLAY_CHANGED_RECORDS %',result; END IF;
END;
$fixture$;
DO $staff_fixture$
#variable_conflict use_variable
DECLARE
  manager uuid := gen_random_uuid();
  assigned uuid := gen_random_uuid();
  unassigned uuid := gen_random_uuid();
  outside_user uuid := gen_random_uuid();
  ticket_id uuid := gen_random_uuid();
  message_id uuid := gen_random_uuid();
  current_actor uuid;
  session_id uuid;
  user_row record;
  reply jsonb;
BEGIN
  FOR user_row IN
    SELECT * FROM (VALUES (manager,'super_admin'),(assigned,'support_staff'),(unassigned,'support_staff'),(outside_user,NULL))
      AS fake(id,staff_role)
  LOOP
    INSERT INTO auth.users (id,email,email_confirmed_at,raw_user_meta_data,aud,role)
    VALUES (user_row.id,'fr33-support-'||user_row.id||'@example.invalid',statement_timestamp(),
      '{"full_name":"FR33 Disposable Support","signup_source":"admin_invitation"}'::jsonb,'authenticated','authenticated');
    IF user_row.staff_role IS NOT NULL THEN
      INSERT INTO public.app_admins(user_id,email,role) VALUES
      (user_row.id,'fr33-support-'||user_row.id||'@example.invalid',user_row.staff_role);
    END IF;
  END LOOP;

  INSERT INTO mushavo_account_deletion.retained_support_records(record_type,record_id,ticket_id,record)
    VALUES
    ('ticket',ticket_id,ticket_id,jsonb_build_object('id',ticket_id,'status','in_progress',
      'created_at',statement_timestamp()-interval '1 day','assigned_admin_id',NULL,'description','Synthetic case')),
    ('message',message_id,ticket_id,jsonb_build_object('id',message_id,'ticket_id',ticket_id,'body','Synthetic message',
      'created_at',statement_timestamp()-interval '1 hour'));

  FOREACH current_actor IN ARRAY ARRAY[manager,unassigned,outside_user,assigned]
  LOOP
    session_id := gen_random_uuid();
    INSERT INTO auth.sessions(id,user_id,created_at,updated_at,aal)
      VALUES(session_id,current_actor,statement_timestamp(),statement_timestamp(),'aal2');
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_actor,'session_id',session_id,
      'aal','aal2','exp',extract(epoch FROM statement_timestamp()+interval '5 minutes')::bigint)::text,true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    IF current_actor=manager THEN
      IF public.fr33_assigned_support_archive(ticket_id) IS NOT NULL
        OR NOT public.fr33_assign_support_archive(ticket_id,assigned)
      THEN RAISE EXCEPTION 'FR33_ARCHIVE_ASSIGNMENT_NOT_SCOPED'; END IF;
    ELSIF current_actor=unassigned THEN
      IF public.fr33_assigned_support_archive(ticket_id) IS NOT NULL OR public.fr33_close_support_archive(ticket_id)
      THEN RAISE EXCEPTION 'FR33_UNASSIGNED_SUPPORT_ACCESSED_ARCHIVE'; END IF;
    ELSIF current_actor=outside_user THEN
      BEGIN
        PERFORM public.fr33_assigned_support_archive(ticket_id);
        RAISE EXCEPTION 'FR33_CUSTOMER_ACCESSED_ARCHIVE';
      EXCEPTION WHEN insufficient_privilege THEN
        IF SQLERRM <> 'FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED' THEN RAISE; END IF;
      END;
    ELSE
      reply := public.fr33_assigned_support_archive(ticket_id);
      IF reply->'ticket'->>'id' IS DISTINCT FROM ticket_id::text
        OR reply->'messages'->0->>'id' IS DISTINCT FROM message_id::text
        OR NOT public.fr33_close_support_archive(ticket_id)
        OR public.fr33_close_support_archive(ticket_id)
      THEN RAISE EXCEPTION 'FR33_ASSIGNED_SUPPORT_READ_OR_CLOSE_FAILED'; END IF;
    END IF;
    EXECUTE 'RESET ROLE';
  END LOOP;
  PERFORM set_config('request.jwt.claims','{}',true);
  IF NOT EXISTS (SELECT 1 FROM mushavo_account_deletion.retained_support_records row
    WHERE row.record_type='ticket' AND row.record_id=ticket_id AND row.record->>'status'='closed'
      AND mushavo_account_deletion.support_archive_closed_at(row.record)=statement_timestamp())
  THEN RAISE EXCEPTION 'FR33_ARCHIVE_CLOSE_DID_NOT_START_RETENTION'; END IF;
END;
$staff_fixture$;

SELECT 'PASS' AS assigned_staff_archive_access_and_closure,
  'PASS' AS closed_support_and_anonymous_totals,
  'PASS' AS completion_receipts_and_logs,
  'PASS' AS preserved_holds_open_unknown_and_newer_records,
  'PASS' AS idempotent_replay;
ROLLBACK;
