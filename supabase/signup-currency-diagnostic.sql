-- Signup currency diagnostic. Returns aggregate checks only.
-- Run after 20260905120000_signup_currency_preferences.sql.

select
  to_regprocedure('public.get_public_signup_currencies()') is not null
    as signup_currency_function_exists,
  has_function_privilege('anon', 'public.get_public_signup_currencies()', 'EXECUTE')
    as anonymous_access_enabled,
  (
    select count(*)
    from public.get_public_signup_currencies()
  ) as active_signup_currencies,
  (
    select count(*) > 1
    from public.get_public_signup_currencies()
  ) as multiple_currency_choices_available;
