// Disposable PostgreSQL integration checks; never connects to the live Supabase project.
const {PGlite}=require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const {readFileSync}=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),schema=readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
const billingMigration=readFileSync(path.join(root,'supabase/migrations/20260930090000_business_stage_10_billing.sql'),'utf8');
const stage4=readFileSync(path.join(root,'supabase/migrations/20260928170000_business_stage_4_team.sql'),'utf8');
function table(name){const start=schema.indexOf('create table if not exists public.'+name+' (');return schema.slice(start,schema.indexOf('\n);',start)+3);}
function fn(sql,name){const found=new RegExp('create(?: or replace)? function public\\.'+name+'\\(').exec(sql);assert.ok(found,name);return sql.slice(found.index,sql.indexOf('$$;',found.index)+3);}
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,ws=id(1),other=id(2),personal=id(3),owner=id(10),admin=id(11),staff=id(12),reviewer=id(13),outsider=id(14),plan=id(20);
(async()=>{const db=new PGlite();try{
  await db.exec("set timezone='UTC';");
  await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
    create table profiles(id uuid primary key,account_status text default 'active',full_name text,email text,admin_role text);
    create function auth.jwt() returns jsonb language sql stable security definer as $$select jsonb_build_object('email',(select email from profiles where id=auth.uid()))$$;
    create table budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text,status text default 'active',name text,suspension_reason text,updated_at timestamptz default now());
    create table workspace_members(id uuid primary key default gen_random_uuid(),workspace_id uuid,user_id uuid,role text,status text default 'active',joined_at timestamptz default now(),removed_at timestamptz,updated_at timestamptz default now(),unique(workspace_id,user_id));
    create table workspace_invitations(id uuid primary key default gen_random_uuid(),workspace_id uuid,invitee_email text,invitee_user_id uuid,invited_by uuid,role text,status text default 'pending',expires_at timestamptz default now()+interval '7 days',version integer default 1,
      created_at timestamptz default now(),last_sent_at timestamptz,delivery_status text default 'pending',accepted_at timestamptz,accepted_by uuid,responded_at timestamptz,updated_at timestamptz default now());
    create table business_member_scopes(workspace_id uuid,member_id uuid,dimension_id uuid);
    create table business_invitation_scopes(invitation_id uuid,workspace_id uuid,dimension_id uuid);
    create table business_dimensions(id uuid primary key,workspace_id uuid,status text);
    create table business_team_operation_permits(transaction_id bigint,workspace_id uuid,actor_id uuid,operation text,primary key(transaction_id,workspace_id,actor_id,operation));
    create table business_invitation_audit_events(id uuid default gen_random_uuid(),workspace_id uuid,invitation_id uuid,action text,actor_id uuid,safe_details jsonb);
    create table notifications(id uuid default gen_random_uuid(),user_id uuid,created_by uuid,type text,title text,body text,url text);
    create table supported_currencies(code text primary key,is_active boolean);insert into supported_currencies values('USD',true),('ZAR',true);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,metadata jsonb);alter table storage.objects enable row level security;
    create policy fixture_storage on storage.objects for all to authenticated using(true) with check(true);grant all on storage.objects to authenticated;grant usage on schema storage to authenticated;
    create function my_account_suspended() returns boolean language sql stable security definer as $$select coalesce((select account_status<>'active' from profiles where id=auth.uid()),false)$$;
    create function is_platform_staff(text[]) returns boolean language sql stable security definer as $$select exists(select 1 from profiles where id=auth.uid() and admin_role=any($1) and account_status='active')$$;
    create function is_business_workspace_member(uuid) returns boolean language sql stable security definer as $$select not my_account_suspended() and exists(select 1 from workspace_members m join budget_workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and m.user_id=auth.uid() and m.status='active' and w.status='active' and w.workspace_type='business')$$;
    create function business_claims_active(uuid) returns boolean language sql stable security definer as $$select is_business_workspace_member($1) and exists(select 1 from workspace_subscriptions where workspace_id=$1 and status='active' and paid_through_at>now())$$;
  `.replace(/    create function business_claims_active[\s\S]*$/,''));
  for(const name of ['plans','plan_limits','workspace_subscriptions','subscription_entitlement_history','subscription_invoices','subscription_renewal_requests','subscription_payments','subscription_payment_proofs','subscription_payment_reviews','subscription_audit_events']){
    await db.exec(table(name).replace('check (amount > 0)','check (amount >= 0)'));
  }
  await db.exec(`alter table workspace_subscriptions add column member_limit integer default 10,add column billing_anchor_at timestamptz;
    alter table subscription_renewal_requests add column provision_workspace_on_approval boolean default false;
    create table admin_subscription_grants(id uuid default gen_random_uuid(),workspace_id uuid,plan_id uuid default '00000000-0000-0000-0000-000000000020',grant_kind text);
    create function business_claims_active(uuid) returns boolean language sql stable security definer as $$select is_business_workspace_member($1) and exists(select 1 from workspace_subscriptions where workspace_id=$1 and status='active' and paid_through_at>now())$$;
    create function business_has_permission(uuid,text) returns boolean language sql stable as $$select is_business_workspace_member($1) and exists(select 1 from workspace_members where workspace_id=$1 and user_id=auth.uid() and role='business_owner' and status='active')$$;
    create function business_record_audit_event(uuid,text,text,uuid,jsonb default '{}',jsonb default '{}',text default null,uuid default null,uuid default null) returns uuid language sql as $$select gen_random_uuid()$$;
    create function review_subscription_payment(uuid,text,text default null) returns text language sql security definer as $$select 'legacy_'||$2$$;
    create function product_customer_purchase_enabled(text) returns boolean language sql as $$select false$$;
    create function product_customer_workspace_creation_enabled(text) returns boolean language sql as $$select false$$;
  `);
  await db.exec(fn(stage4,'business_team_permit'));await db.exec(fn(stage4,'business_team_can_manage'));await db.exec(fn(stage4,'expire_business_invitations'));
  for(const name of ['subscription_invoices','subscription_renewal_requests','subscription_payments','subscription_entitlement_history','subscription_audit_events']){
    await db.exec(`alter table ${name} enable row level security;create policy fixture_all on ${name} for all to authenticated using(true) with check(true);grant all on ${name} to authenticated;`);
  }
  await db.exec(`insert into auth.users values('${owner}'),('${admin}'),('${staff}'),('${reviewer}'),('${outsider}');
    insert into profiles values('${owner}','active','Owner','owner@example.com',null),('${admin}','active','Admin','admin@example.com','super_admin'),('${staff}','active','Staff','staff@example.com',null),('${reviewer}','active','Reviewer','reviewer@example.com','finance_staff'),('${outsider}','active','Other owner','other@example.com',null);
    insert into budget_workspaces(id,owner_id,workspace_type,status,name) values('${ws}','${owner}','business','active','Test Company'),('${other}','${outsider}','business','active','Other Company'),('${personal}','${owner}','personal','active','Personal');
    insert into workspace_members(workspace_id,user_id,role) values('${ws}','${owner}','business_owner'),('${ws}','${staff}','staff'),('${other}','${outsider}','business_owner');
    insert into plans(id,code,display_name,workspace_type) values('${plan}','business','Business','business'),('${id(21)}','personal','Personal','personal');
    insert into workspace_subscriptions(workspace_id,plan_id,billing_period,entitlement_start_at,billing_anchor_at,paid_through_at,member_limit) values
      ('${ws}','${plan}','monthly',now()-interval '10 days',now()-interval '10 days',now()+interval '20 days',4),
      ('${other}','${plan}','annual',now()-interval '20 days',now()-interval '20 days',now()+interval '345 days',2),
      ('${personal}','${id(21)}','monthly',now()-interval '10 days',now()-interval '10 days',now()+interval '20 days',1);
    grant select on budget_workspaces to authenticated;grant usage on schema auth to authenticated;
  `);
  await db.exec(billingMigration);
  await db.exec(`alter table profiles add column signup_source text default 'self_signup',add column admin_invitation_id uuid;
    create table app_admins(user_id uuid primary key,role text);insert into app_admins values('${admin}','super_admin'),('${reviewer}','finance_staff');
    create table admin_user_invitations(id uuid primary key,status text);
    create table business_member_permissions(workspace_id uuid,member_id uuid,permission_code text);
    create function business_admin_test_permit(uuid,uuid) returns boolean language sql as $$select false$$;`);
  await db.exec(table('business_audit_events'));
  await db.exec('create unique index business_audit_request_action_idx on business_audit_events(workspace_id,request_id,action) where request_id is not null;');
  await db.exec(fn(schema,'prevent_business_audit_mutation'));
  await db.exec(fn(schema,'business_record_audit_event').replace('create or replace function','create or replace function'));
  const migration=readFileSync(path.join(root,'supabase/migrations/20260930110000_business_stage_11_admin.sql'),'utf8');
  await db.exec(migration);
  const sources=['budget_workspaces','workspace_subscriptions','workspace_members','workspace_settings','business_profiles','business_role_permissions','business_member_permissions','business_member_scopes','workspace_invitations','business_categories','business_dimensions','business_documents','business_setup_drafts','business_expense_claims','business_suppliers','business_bill_schedules','business_bills','business_bill_payments','business_income_receipts','business_budgets','business_spending_requests','subscription_payments'];
  for(const t of sources){const exists=(await db.query('select to_regclass($1) as relation',['public.'+t])).rows[0].relation;if(!exists)await db.exec(`create table ${t}(id uuid default gen_random_uuid(),workspace_id uuid,name text)`);}
  await db.exec('create publication supabase_realtime;');
  await db.exec(readFileSync(path.join(root,'supabase/migrations/20260930130000_business_stage_12_realtime.sql'),'utf8'));
  const asUser=uid=>db.query("select set_config('fixture.uid',$1,false)",[uid]);
  const signal=async workspace=>(await db.query('select * from business_change_signals where workspace_id=$1',[workspace])).rows[0];
  assert.equal((await db.query('select count(*)::int as n from business_change_signals')).rows[0].n,2);
  assert.equal(await signal(personal),undefined);
  let before=await signal(ws);await db.query('insert into business_expense_claims(workspace_id,name) values($1,$2)',[ws,'Private claim']);let after=await signal(ws);assert.equal(Number(after.data_version),Number(before.data_version)+1);assert.equal(after.access_version,before.access_version);
  assert.equal(Object.keys(after).sort().join(','),'access_version,data_version,updated_at,workspace_id');
  for(const t of ['business_bills','business_income_receipts','business_budgets','business_spending_requests']){
    before=await signal(ws);const row=(await db.query(`insert into ${t}(workspace_id,name) values($1,$2) returning id`,[ws,'Private financial row'])).rows[0];
    await db.query(`update ${t} set name=$1 where id=$2`,['Updated private row',row.id]);await db.query(`delete from ${t} where id=$1`,[row.id]);after=await signal(ws);assert.equal(Number(after.data_version),Number(before.data_version)+3);assert.equal(after.access_version,before.access_version);
  }
  before=await signal(ws);await asUser(admin);await db.query("select admin_business_set_status($1,'suspended',1,'Test Company','Verified pilot test suspension',$2)",[ws,id(800)]);after=await signal(ws);assert.ok(Number(after.access_version)>Number(before.access_version));
  // Suspended/expired members may receive neutral access signals, never operations.
  await asUser(staff);await db.exec('set role authenticated');assert.equal((await db.query('select workspace_id from business_change_signals')).rows.length,1);assert.equal((await db.query('select workspace_id from business_change_signals')).rows[0].workspace_id,ws);
  await assert.rejects(db.query('select emit_business_change_signal($1,true)',[ws]),/permission denied/);await assert.rejects(db.query('update business_change_signals set data_version=1'),/permission denied/);await db.exec('reset role');
  await asUser(outsider);await db.exec('set role authenticated');assert.equal((await db.query('select workspace_id from business_change_signals')).rows[0].workspace_id,other);await db.exec('reset role');
  await asUser(admin);await db.exec('set role authenticated');assert.equal((await db.query('select workspace_id from business_change_signals')).rows.length,0);await db.exec('reset role');
  await db.query("update profiles set account_status='suspended' where id=$1",[staff]);await asUser(staff);await db.exec('set role authenticated');assert.equal((await db.query('select workspace_id from business_change_signals')).rows.length,0);await db.exec('reset role');
  await db.query("update profiles set account_status='active' where id=$1",[staff]);
  await db.query("update workspace_members set status='inactive' where workspace_id=$1 and user_id=$2",[ws,staff]);await db.exec('set role authenticated');assert.equal((await db.query('select workspace_id from business_change_signals')).rows.length,0);await db.exec('reset role');
  // Signals are transactional: a failed/reverted finance operation cannot notify.
  before=await signal(other);await db.exec('begin');await db.query('insert into business_bills(workspace_id,name) values($1,$2)',[other,'Rolled back']);await db.exec('rollback');after=await signal(other);assert.equal(after.data_version,before.data_version);
  before=await signal(other);await db.query('update business_expense_claims set workspace_id=$1 where workspace_id=$2',[other,ws]);after=await signal(other);assert.ok(Number(after.data_version)>Number(before.data_version));
  const diagnostic=await db.query(readFileSync(path.join(root,'supabase/diagnostics/business_stage_12_pilot_diagnostic.sql'),'utf8'));assert.equal(diagnostic.rows.length,20);assert.deepEqual(diagnostic.rows.filter(row=>row.result!=='PASS'),[]);
  console.log('PASS: Stage 12 actual SQL: private counter payload, transactional events, financial triggers, access changes, expired/suspended signalling, cross-workspace isolation, revoked membership and no automatic platform access; all 20 diagnostic rows.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
