-- Run after 20260927103000_personal_cashbook_private_test.sql.
-- One row should return with every boolean true and both policy counts = 1.
select
  to_regclass('public.cashbook_accounts') is not null as accounts_table_ready,
  to_regclass('public.cashbook_entries') is not null as entries_table_ready,
  to_regclass('public.cashbook_account_balances') is not null as balances_view_ready,
  to_regprocedure('public.create_cashbook_account(uuid,text,text,text,numeric,date)') is not null as account_rpc_ready,
  to_regprocedure('public.create_cashbook_entry(uuid,uuid,text,numeric,date,text,text,text)') is not null as entry_rpc_ready,
  to_regprocedure('public.create_cashbook_payment_entry(uuid,uuid,uuid,text,uuid)') is not null as payment_link_rpc_ready,
  to_regprocedure('public.create_cashbook_transfer(uuid,uuid,uuid,numeric,numeric,date,text,text)') is not null as transfer_rpc_ready,
  to_regprocedure('public.reverse_cashbook_entry(uuid,text)') is not null as reversal_rpc_ready,
  to_regprocedure('public.cashbook_report(uuid,date,date)') is not null as report_rpc_ready,
  has_function_privilege('authenticated', 'public.create_cashbook_payment_entry(uuid,uuid,uuid,text,uuid)', 'execute') as authenticated_can_link,
  not has_function_privilege('anon', 'public.create_cashbook_payment_entry(uuid,uuid,uuid,text,uuid)', 'execute') as anonymous_cannot_link,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'cashbook_accounts') as account_policy_count,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'cashbook_entries') as entry_policy_count;
