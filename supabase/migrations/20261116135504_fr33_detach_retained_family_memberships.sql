CREATE FUNCTION mushavo_account_deletion.detach_retained_family_memberships(p_request_id uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SET search_path TO pg_catalog SET row_security TO 'off'
AS $detach_family_memberships$
DECLARE
  subject uuid;
  payment_result jsonb;
  historical_members integer;
  remaining_members integer;
  access_rows integer;
BEGIN
  SELECT subject_id INTO subject FROM mushavo_account_deletion.requests
  WHERE id = p_request_id AND cancelled_at IS NULL AND workspace_impact_confirmed_at IS NOT NULL;
  IF subject IS NULL THEN RAISE EXCEPTION 'FR33_CONFIRMED_REQUEST_REQUIRED'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('fr33-account-deletion:' || subject::text, 0));
  -- Hold the Auth row through erasure so concurrent foreign-key inserts cannot restore access.
  PERFORM 1 FROM auth.users WHERE id = subject FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'FR33_DELETION_SUBJECT_MISSING'; END IF;
  payment_result := mushavo_account_deletion.detach_retained_family_payment_actors(p_request_id);

  -- Lock the surviving family's owner mapping before transferring creator references.
  PERFORM workspace.id FROM public.budget_workspaces workspace
  JOIN public.families family ON family.id = workspace.legacy_family_id AND family.owner_id = workspace.owner_id
  WHERE workspace.workspace_type IN ('family','household') AND workspace.owner_id <> subject
    AND (EXISTS (
      SELECT 1 FROM public.family_members member
      WHERE member.family_id = family.id AND (member.user_id = subject OR member.created_by = subject)
    ) OR EXISTS (
      SELECT 1 FROM public.workspace_members member
      WHERE member.workspace_id = workspace.id AND member.user_id = subject
    ))
  ORDER BY workspace.id FOR SHARE OF workspace,family;

  IF EXISTS (
    SELECT 1 FROM public.family_members member
    JOIN public.families family ON family.id = member.family_id
    WHERE family.owner_id <> subject AND (member.user_id = subject OR member.created_by = subject)
      AND (NOT EXISTS (
        SELECT 1 FROM public.budget_workspaces workspace WHERE workspace.legacy_family_id = family.id
          AND workspace.owner_id = family.owner_id AND workspace.workspace_type IN ('family','household')
      ) OR (member.user_id = subject AND member.role = 'Owner'))
  ) OR EXISTS (
    SELECT 1 FROM public.workspace_members member JOIN public.budget_workspaces workspace ON workspace.id = member.workspace_id
    WHERE member.user_id = subject AND workspace.owner_id <> subject AND workspace.workspace_type IN ('family','household')
      AND (member.role <> 'family_member' OR NOT EXISTS (
        SELECT 1 FROM public.families family WHERE family.id = workspace.legacy_family_id AND family.owner_id = workspace.owner_id
      ))
  ) THEN
    RAISE EXCEPTION 'FR33_FAMILY_MEMBERSHIP_SCOPE_REVIEW_REQUIRED';
  END IF;

  -- Preserve IDs referenced by payment history and clear contact information for this account.
  UPDATE public.family_members member SET user_id = NULL, status = 'inactive', email = NULL, phone = NULL,
    created_by = CASE WHEN member.created_by = subject THEN family.owner_id ELSE member.created_by END
  FROM public.families family
  JOIN public.budget_workspaces workspace ON workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
  WHERE member.family_id = family.id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.user_id = subject AND member.role <> 'Owner';
  GET DIAGNOSTICS historical_members = ROW_COUNT;

  -- These rows belong to other people and would otherwise cascade when the inviter is deleted.
  UPDATE public.family_members member SET created_by = family.owner_id
  FROM public.families family
  JOIN public.budget_workspaces workspace ON workspace.legacy_family_id = family.id AND workspace.owner_id = family.owner_id
  WHERE member.family_id = family.id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.created_by = subject;
  GET DIAGNOSTICS remaining_members = ROW_COUNT;

  DELETE FROM public.workspace_members member USING public.budget_workspaces workspace, public.families family
  WHERE member.workspace_id = workspace.id AND workspace.legacy_family_id = family.id
    AND workspace.owner_id = family.owner_id AND workspace.workspace_type IN ('family','household')
    AND family.owner_id <> subject AND member.user_id = subject AND member.role = 'family_member';
  GET DIAGNOSTICS access_rows = ROW_COUNT;

  RETURN payment_result || jsonb_build_object('family_memberships_detached',historical_members,
    'family_member_creators_transferred',remaining_members,'family_access_rows_removed',access_rows);
END;
$detach_family_memberships$;

REVOKE ALL ON FUNCTION mushavo_account_deletion.detach_retained_family_memberships(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
