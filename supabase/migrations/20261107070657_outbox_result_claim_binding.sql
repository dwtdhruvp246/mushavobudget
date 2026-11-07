begin;
-- A result may change only the still-current, unexpired claim.
create function public.record_notification_outbox_result(
  p_outbox_id uuid, p_succeeded boolean, p_permanent_failure boolean,
  p_error text, p_reference_time timestamptz,
  p_expected_attempt_count integer, p_expected_claimed_at timestamptz
)
returns public.notification_outbox language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  v_result public.notification_outbox%rowtype;
begin
  if p_expected_attempt_count is null or p_expected_attempt_count not between 1 and 3
    or p_expected_claimed_at is null or p_reference_time is null then
    raise exception 'OUTBOX_CLAIM_REQUIRED';
  end if;
  update public.notification_outbox as outbox
  set
    status = case
      when p_succeeded then 'sent'
      when p_permanent_failure or outbox.attempt_count >= 3 then 'failed'
      else 'retry'
    end,
    next_attempt_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.next_attempt_at
      when outbox.attempt_count = 1 then p_reference_time + interval '5 minutes'
      else p_reference_time + interval '30 minutes'
    end,
    claimed_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.claimed_at
      else null
    end,
    sent_at = case when p_succeeded then p_reference_time else null end,
    last_error = case
      when p_succeeded then null
      else left(regexp_replace(coalesce(nullif(btrim(p_error), ''), 'Push delivery failed.'), E'[\\r\\n\\t]+', ' ', 'g'), 500)
    end
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
    and outbox.attempt_count = p_expected_attempt_count
    and outbox.claimed_at = p_expected_claimed_at
    and p_reference_time >= outbox.claimed_at
    and p_reference_time < outbox.claimed_at + interval '15 minutes'
  returning outbox.* into v_result;

  return v_result;
end;
$function$;

-- Retain the legacy signature as a fail-closed compatibility boundary.
CREATE OR REPLACE FUNCTION public.record_notification_outbox_result(p_outbox_id uuid, p_succeeded boolean, p_permanent_failure boolean DEFAULT false, p_error text DEFAULT NULL::text, p_reference_time timestamp with time zone DEFAULT now())
 RETURNS public.notification_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'OUTBOX_CLAIM_REQUIRED';
end;
$function$;

revoke all on function public.record_notification_outbox_result(uuid,boolean,boolean,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_notification_outbox_result(uuid,boolean,boolean,text,timestamptz) to service_role;
revoke all on function public.record_notification_outbox_result(uuid,boolean,boolean,text,timestamptz,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.record_notification_outbox_result(uuid,boolean,boolean,text,timestamptz,integer,timestamptz) to service_role;
-- A result may change only the still-current, unexpired claim.
create function public.record_admin_notification_outbox_result(
  p_outbox_id uuid, p_succeeded boolean, p_permanent_failure boolean,
  p_error text, p_reference_time timestamptz,
  p_expected_attempt_count integer, p_expected_claimed_at timestamptz
)
returns public.admin_notification_outbox language plpgsql security definer
set search_path = public, pg_temp
as $function$
declare
  v_result public.admin_notification_outbox%rowtype;
begin
  if p_expected_attempt_count is null or p_expected_attempt_count not between 1 and 3
    or p_expected_claimed_at is null or p_reference_time is null then
    raise exception 'OUTBOX_CLAIM_REQUIRED';
  end if;
  update public.admin_notification_outbox as outbox
  set
    status = case
      when p_succeeded then 'sent'
      when p_permanent_failure or outbox.attempt_count >= 3 then 'failed'
      else 'retry'
    end,
    next_attempt_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.next_attempt_at
      when outbox.attempt_count = 1 then p_reference_time + interval '5 minutes'
      else p_reference_time + interval '30 minutes'
    end,
    claimed_at = case
      when p_succeeded or p_permanent_failure or outbox.attempt_count >= 3 then outbox.claimed_at
      else null
    end,
    sent_at = case when p_succeeded then p_reference_time else null end,
    last_error = case
      when p_succeeded then null
      else left(regexp_replace(coalesce(nullif(btrim(p_error), ''), 'Push delivery failed.'), E'[\\r\\n\\t]+', ' ', 'g'), 500)
    end
  where outbox.id = p_outbox_id
    and outbox.status = 'processing'
    and outbox.attempt_count = p_expected_attempt_count
    and outbox.claimed_at = p_expected_claimed_at
    and p_reference_time >= outbox.claimed_at
    and p_reference_time < outbox.claimed_at + interval '15 minutes'
  returning outbox.* into v_result;

  return v_result;
end;
$function$;

-- Retain the legacy signature as a fail-closed compatibility boundary.
CREATE OR REPLACE FUNCTION public.record_admin_notification_outbox_result(p_outbox_id uuid, p_succeeded boolean, p_permanent_failure boolean DEFAULT false, p_error text DEFAULT NULL::text, p_reference_time timestamp with time zone DEFAULT now())
 RETURNS public.admin_notification_outbox
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
  raise exception 'OUTBOX_CLAIM_REQUIRED';
end;
$function$;

revoke all on function public.record_admin_notification_outbox_result(uuid,boolean,boolean,text,timestamptz) from public, anon, authenticated;
grant execute on function public.record_admin_notification_outbox_result(uuid,boolean,boolean,text,timestamptz) to service_role;
revoke all on function public.record_admin_notification_outbox_result(uuid,boolean,boolean,text,timestamptz,integer,timestamptz) from public, anon, authenticated;
grant execute on function public.record_admin_notification_outbox_result(uuid,boolean,boolean,text,timestamptz,integer,timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
