-- Preserve payment history when an Auth account is removed. Workspace and
-- payment-item deletion keep their existing cascades. The erasure process must
-- resolve account links before removing the login.
DO $protect_payment_history$
DECLARE
  reviewed integer;
  cascading integer;
  restrictive integer;
BEGIN
  SET LOCAL lock_timeout = '3s';
  LOCK TABLE public.payment_items, public.payment_records IN ACCESS EXCLUSIVE MODE;

  SELECT count(*), count(*) FILTER (WHERE fk.confdeltype = 'c'),
    count(*) FILTER (WHERE fk.confdeltype = 'r')
  INTO reviewed, cascading, restrictive
  FROM (VALUES
    ('public.payment_items'::regclass, 'payment_items_owner_id_fkey', 'owner_id'),
    ('public.payment_items'::regclass, 'payment_items_created_by_fkey', 'created_by'),
    ('public.payment_records'::regclass, 'payment_records_owner_id_fkey', 'owner_id'),
    ('public.payment_records'::regclass, 'payment_records_recorded_by_fkey', 'recorded_by')
  ) AS expected(relation, constraint_name, column_name)
  JOIN pg_catalog.pg_constraint fk
    ON fk.conrelid = expected.relation AND fk.conname = expected.constraint_name
  JOIN pg_catalog.pg_attribute actor
    ON actor.attrelid = fk.conrelid AND actor.attname = expected.column_name
  JOIN pg_catalog.pg_attribute account
    ON account.attrelid = fk.confrelid AND account.attname = 'id'
  WHERE fk.contype = 'f' AND fk.confrelid = 'auth.users'::regclass
    AND fk.conkey = ARRAY[actor.attnum] AND fk.confkey = ARRAY[account.attnum]
    AND fk.convalidated AND NOT fk.condeferrable AND fk.confupdtype = 'a'
    AND actor.attnotnull AND fk.confmatchtype = 's';

  IF reviewed = 4 AND restrictive = 4 THEN
    RETURN;
  END IF;
  IF reviewed <> 4 OR cascading <> 4 THEN
    RAISE EXCEPTION 'FR33_UNEXPECTED_PAYMENT_ACCOUNT_LINKS';
  END IF;

  ALTER TABLE public.payment_items
    DROP CONSTRAINT payment_items_owner_id_fkey,
    DROP CONSTRAINT payment_items_created_by_fkey,
    ADD CONSTRAINT payment_items_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT payment_items_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE RESTRICT;

  ALTER TABLE public.payment_records
    DROP CONSTRAINT payment_records_owner_id_fkey,
    DROP CONSTRAINT payment_records_recorded_by_fkey,
    ADD CONSTRAINT payment_records_owner_id_fkey
      FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE RESTRICT,
    ADD CONSTRAINT payment_records_recorded_by_fkey
      FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE RESTRICT;
END;
$protect_payment_history$;
