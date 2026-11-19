-- Keep another user's notice when its creator deletes their account.
-- The existing FK clears only created_by. Other notification links retain
-- their original review rules.
DO $allow_notification_creator_detachment$
DECLARE
  body text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  anchor text := E'      OR (dep->>''schema'' = ''public'' AND dep->>''relation'' = ''workspace_members''';
BEGIN
  IF (length(body) - length(replace(body,anchor,''))) <> length(anchor) THEN
    RAISE EXCEPTION 'FR33_EXPECTED_ACCOUNT_DEPENDENCY_ALLOWLIST';
  END IF;
  EXECUTE replace(body,anchor,
    E'      OR (dep->>''schema'' = ''public'' AND dep->>''relation'' = ''notifications''\n'
    || E'        AND dep->>''column'' = ''created_by'' AND dep->>''on_delete'' = ''SET NULL'')\n' || anchor);
END;
$allow_notification_creator_detachment$;
