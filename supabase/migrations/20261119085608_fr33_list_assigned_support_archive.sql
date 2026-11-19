-- List only the archived cases assigned to the current authorized staff member.
CREATE FUNCTION public.fr33_list_assigned_support_archive(p_after uuid DEFAULT NULL)
RETURNS TABLE (ticket_id uuid, subject text, status text, archived_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'pg_catalog'
SET row_security TO 'off'
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  PERFORM mushavo_email_auth.require_application_session();
  IF actor IS NULL OR NOT public.is_platform_staff(ARRAY['super_admin','admin_staff','support_staff']) THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='FR33_SUPPORT_ARCHIVE_STAFF_REQUIRED';
  END IF;

  -- Return one extra row so clients can show a next-page control without a total.
  RETURN QUERY
  SELECT archived.ticket_id, archived.record->>'subject', archived.record->>'status', archived.archived_at
  FROM mushavo_account_deletion.retained_support_records archived
  WHERE archived.record_type='ticket' AND archived.record_id=archived.ticket_id
    AND archived.record->>'assigned_admin_id'=actor::text
    AND (p_after IS NULL OR archived.record_id > p_after)
  ORDER BY archived.record_id
  LIMIT 21;
END;
$$;

REVOKE ALL ON FUNCTION public.fr33_list_assigned_support_archive(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fr33_list_assigned_support_archive(uuid) TO authenticated;
