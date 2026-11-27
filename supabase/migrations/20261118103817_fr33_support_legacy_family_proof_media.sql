ALTER TABLE mushavo_account_deletion.shared_proof_handoffs
  DROP CONSTRAINT shared_proof_handoffs_mime_type_check,
  ADD CONSTRAINT shared_proof_handoffs_mime_type_check CHECK (
    mime_type IN ('application/pdf','image/png') OR (bucket = 'payment-proofs' AND mime_type IN ('image/jpeg','image/webp'))
  );

DO $migration$
DECLARE
  definition text := pg_get_functiondef('mushavo_account_deletion.queue_shared_proof_handoffs(uuid,uuid)'::regprocedure);
  anchor text;
BEGIN
  anchor := 'CASE right(links.path,4) WHEN ''.pdf'' THEN ''application/pdf'' WHEN ''.png'' THEN ''image/png'' END';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_FORMAT_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,anchor,
    E'CASE substring(links.path from ''[.][a-z]+$'')\n' ||
    E'        WHEN ''.pdf'' THEN ''application/pdf'' WHEN ''.png'' THEN ''image/png''\n' ||
    E'        WHEN ''.jpg'' THEN ''image/jpeg'' WHEN ''.jpeg'' THEN ''image/jpeg'' WHEN ''.webp'' THEN ''image/webp'' END');
  anchor := $anchor$|| p_subject || '/' || uuid_pattern || '[.](pdf|png)$')$anchor$;
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_FAMILY_PATH_ANCHOR_CHANGED'; END IF;
  definition := replace(definition,anchor,replace(anchor,'(pdf|png)','(pdf|png|jpe?g|webp)'));
  anchor := 'right(candidate.path,4)';
  IF cardinality(string_to_array(definition,anchor)) <> 2 THEN RAISE EXCEPTION 'FR33_SHARED_PROOF_EXTENSION_ANCHOR_CHANGED'; END IF;
  EXECUTE replace(definition,anchor,'substring(candidate.path from ''[.][a-z]+$'')');
END;
$migration$;
