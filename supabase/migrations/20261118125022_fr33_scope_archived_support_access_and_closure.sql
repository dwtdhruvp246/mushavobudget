-- The live support trigger preserves resolved_at when a resolved case is later closed.
-- Use the final update as a conservative closure anchor for existing archived cases.
DO $migration$
DECLARE
  definition text := pg_get_functiondef('mushavo_account_deletion.support_archive_closed_at(jsonb)'::regprocedure);
  anchor text := '  closed_at := (p_record->>''resolved_at'')::timestamptz;';
BEGIN
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN
    RAISE EXCEPTION 'FR33_SUPPORT_CLOSURE_ANCHOR_CHANGED';
  END IF;
  EXECUTE replace(definition,anchor,$closure$  IF coalesce(p_record->>'updated_at','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T'
    OR NOT pg_input_is_valid(p_record->>'updated_at','timestamp with time zone')
  THEN RETURN NULL; END IF;
  closed_at := greatest((p_record->>'resolved_at')::timestamptz,(p_record->>'updated_at')::timestamptz);$closure$);
END;
$migration$;

CREATE FUNCTION public.fr33_assigned_support_archive(p_ticket_id uuid,p_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
  ticket jsonb;
  messages jsonb;
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN RAISE EXCEPTION 'FR33_SUPPORT_ARCHIVE_OFFSET_INVALID'; END IF;

  SELECT archived.record INTO ticket
  FROM mushavo_account_deletion.retained_support_records archived
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text;
  IF ticket IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(page.record ORDER BY page.created_at,page.record_id),'[]'::jsonb) INTO messages
  FROM (
    SELECT message.record,message.record->>'created_at' AS created_at,message.record_id
    FROM mushavo_account_deletion.retained_support_records message
    WHERE message.ticket_id=p_ticket_id AND message.record_type='message'
    ORDER BY message.record->>'created_at',message.record_id LIMIT 100 OFFSET p_offset
  ) page;
  RETURN jsonb_build_object('ticket',ticket,'messages',messages);
END;
$$;

CREATE FUNCTION public.fr33_assign_support_archive(p_ticket_id uuid,p_assignee uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF auth.uid() IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_MANAGER_REQUIRED';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.app_admins admin JOIN public.profiles profile ON profile.id=admin.user_id
    WHERE admin.user_id=p_assignee AND admin.role IN ('super_admin','admin_staff','support_staff')
      AND profile.account_status='active')
  THEN RETURN false; END IF;

  UPDATE mushavo_account_deletion.retained_support_records archived
  SET record=jsonb_set(archived.record,'{assigned_admin_id}',to_jsonb(p_assignee),true)
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND jsonb_typeof(archived.record)='object';
  RETURN FOUND;
END;
$$;

CREATE FUNCTION public.fr33_close_support_archive(p_ticket_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
  closed_at timestamptz := statement_timestamp();
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;

  UPDATE mushavo_account_deletion.retained_support_records archived
  SET record=archived.record || jsonb_build_object('status','closed','updated_at',closed_at,'resolved_at',closed_at)
  WHERE archived.record_type='ticket' AND archived.record_id=p_ticket_id AND archived.ticket_id=p_ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text
    AND archived.record->>'status' IN ('open','in_progress','waiting_customer','resolved');
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_assigned_support_archive(uuid,integer),public.fr33_assign_support_archive(uuid,uuid),
  public.fr33_close_support_archive(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.fr33_assigned_support_archive(uuid,integer),public.fr33_assign_support_archive(uuid,uuid),
  public.fr33_close_support_archive(uuid) TO authenticated;
