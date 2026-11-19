-- Production stores conversion references directly as (entity_type, entity_id).
-- The staged generated payment_record_ref column is derived from the same pair.
DO $fr33_conversion_port$
DECLARE
  executor text := pg_get_functiondef('mushavo_account_deletion.execute_confirmed_request(uuid)'::regprocedure);
  archiver text := pg_get_functiondef('mushavo_account_deletion.archive_owned_workspace_billing(uuid,uuid[])'::regprocedure);
  reference text := 'conversion.payment_record_ref = payment.id';
  staging_only text := 'conversion.payment_record_ref IS NOT NULL OR';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_attribute
    WHERE attrelid='public.payment_conversions'::regclass AND attname='payment_record_ref' AND NOT attisdropped)
    OR cardinality(string_to_array(executor,reference))<>2
    OR cardinality(string_to_array(archiver,staging_only))<>2
  THEN RAISE EXCEPTION 'FR33_PRODUCTION_CONVERSION_SCHEMA_CHANGED'; END IF;
  EXECUTE replace(executor,reference,
    'conversion.entity_type = ''payment_record'' AND conversion.entity_id = payment.id');
  -- This expression is inside a subscription_payment condition, so the
  -- staged CASE expression could never produce a non-null payment reference.
  EXECUTE replace(archiver,staging_only,'');
END;
$fr33_conversion_port$;
