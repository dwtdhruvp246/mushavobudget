DO $migration$
DECLARE
  definition text := pg_get_functiondef('public.fr33_shared_proof_handoff_step(uuid,uuid,text,text)'::regprocedure);
  anchor text := 'CASE WHEN plan.bucket = ''business-documents'' THEN plan.record_id END,';
BEGIN
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_JOURNAL_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,'plan.record_id,');
END;
$migration$;
