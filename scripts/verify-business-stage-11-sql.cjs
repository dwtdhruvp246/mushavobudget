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
  const asUser=uid=>db.query("select set_config('fixture.uid',$1,false)",[uid]);
  const rpc=async(name,args=[])=> (await db.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as result`,args)).rows[0].result;
  const denied=(name,args,error)=>assert.rejects(rpc(name,args),new RegExp(error));
  const status=(version,next='suspended',request=200,name='Test Company',reason='Verified support ticket 123')=>rpc('admin_business_set_status',[ws,next,version,name,reason,id(request)]);
  const support=()=>rpc('admin_business_support_snapshot',[ws]);
  const staffMember=(await db.query('select id from workspace_members where workspace_id=$1 and user_id=$2',[ws,staff])).rows[0].id;
  const transfer=(version,oldOwner=owner,member=staffMember,request=210,email='staff@example.com')=>rpc('admin_business_transfer_owner',[ws,member,oldOwner,version,'Test Company',email,'Verified ownership request ticket 456',id(request)]);
  await asUser(owner);await denied('admin_business_support_snapshot',[ws],'BUSINESS_SUPPORT_ADMIN_REQUIRED');
  await denied('admin_business_set_status',[ws,'suspended',1,'Test Company','Verified support ticket',id(200)],'BUSINESS_SUPPORT_STATUS_ADMIN_REQUIRED');
  await assert.rejects(db.query("update budget_workspaces set status='suspended' where id=$1",[ws]),/PROCEDURE_REQUIRED/);
  await assert.rejects(db.query('update budget_workspaces set owner_id=$1 where id=$2',[staff,ws]),/PROCEDURE_REQUIRED/);
  await assert.rejects(db.query("update workspace_members set role='business_owner' where id=$1",[staffMember]),/PROCEDURE_REQUIRED/);
  await assert.rejects(db.query("delete from workspace_members where workspace_id=$1 and role='business_owner'",[ws]),/PROCEDURE_REQUIRED/);
  await assert.rejects(db.query("insert into workspace_members(workspace_id,user_id,role) values($1,$2,'business_owner')",[ws,outsider]),/PROCEDURE_REQUIRED/);
  await asUser(reviewer);assert.equal((await support()).workspace.owner_id,owner);
  await denied('admin_business_set_status',[ws,'suspended',1,'Test Company','Verified support ticket',id(200)],'BUSINESS_SUPPORT_STATUS_ADMIN_REQUIRED');await assert.rejects(transfer(1),/SUPER_ADMIN_REQUIRED/);
  await db.query("update profiles set admin_role='support_staff' where id=$1",[reviewer]);assert.equal((await support()).workspace.name,'Test Company');await assert.rejects(status(1),/STATUS_ADMIN_REQUIRED/);
  await db.query("update profiles set admin_role='admin_staff' where id=$1",[reviewer]);await assert.rejects(transfer(1),/SUPER_ADMIN_REQUIRED/);
  await assert.rejects(status(1,'suspended',200,'Wrong company'),/STATE_CHANGED/);
  await assert.rejects(status(1,'suspended',200,'Test Company','short'),/INVALID_BUSINESS_SUPPORT_ACTION/);
  const before=(await support()).subscription;
  const action=await status(1);assert.equal(await status(1),action);
  assert.equal((await support()).workspace.status,'suspended');assert.equal((await support()).action_count,1);
  assert.equal((await support()).subscription.paid_through_at,before.paid_through_at);
  await assert.rejects(status(1,'active',201),/STATE_CHANGED/);
  await asUser(owner);await denied('business_subscription_quote',[ws,'renewal','monthly',4],'SUSPENDED');
  await asUser(reviewer);await status(2,'active',201);assert.equal((await support()).workspace.version,3);
  await db.query("update workspace_subscriptions set status='suspended' where workspace_id=$1",[ws]);
  await status(3,'suspended',202);await status(4,'active',203);assert.equal((await support()).subscription.status,'suspended');
  await db.query("update workspace_subscriptions set status='active',paid_through_at=now()-interval '1 day' where workspace_id=$1",[ws]);
  await status(5,'suspended',204);await status(6,'active',205);assert.ok(new Date((await support()).subscription.paid_through_at)<new Date());
  await asUser(admin);
  await assert.rejects(transfer(7,owner,staffMember,210,'incorrect@example.com'),/EMAIL_CONFIRMATION/);
  await db.query("update profiles set account_status='suspended' where id=$1",[staff]);await assert.rejects(transfer(7),/REGISTERED_ACTIVE_NON_PLATFORM/);await db.query("update profiles set account_status='active' where id=$1",[staff]);
  await db.query("insert into app_admins values($1,'support_staff')",[staff]);await assert.rejects(transfer(7),/REGISTERED_ACTIVE_NON_PLATFORM/);await db.query('delete from app_admins where user_id=$1',[staff]);
  await db.query("update profiles set signup_source='admin_invitation',admin_invitation_id=$1 where id=$2",[id(500),staff]);await assert.rejects(transfer(7),/REGISTERED_ACTIVE_NON_PLATFORM/);await db.query("update profiles set signup_source='self_signup' where id=$1",[staff]);
  await db.query('insert into business_member_permissions values($1,(select id from workspace_members where workspace_id=$1 and user_id=$2),$3)',[ws,owner,'reports.view']);
  await db.query("insert into business_subscription_quotes(id,workspace_id,owner_id,plan_id,kind,billing_period,currency,total_seats,additional_seats,included_seats,base_amount,seat_price,amount,fraction,term_start_at,term_end_at,original_expiry_at,original_limit,subscription_version,settings_version) values($1,$2,$3,$4,'renewal','monthly','USD',4,0,2,10,5,20,1,now(),now()+interval '1 month',now(),4,1,1)",[id(400),ws,owner,plan]);
  // A pending payment must be resolved before either ownership path can proceed.
  await rpc('save_business_billing_settings',[plan,1,true,2,'USD',10,100,5,50,'Verified test bank instructions']);
  await db.query("update workspace_subscriptions set paid_through_at=now()+interval '20 days' where workspace_id=$1",[ws]);
  await asUser(owner);const pendingQuote=await rpc('business_subscription_quote',[ws,'renewal','monthly',4]);
  await rpc('submit_business_subscription_payment',[ws,pendingQuote.id,id(600),'Bank','2026-09-30','SUPPORT-TEST','Pending review']);
  await denied('transfer_business_ownership',[ws,staffMember,'Test Company'],'RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST');
  await asUser(admin);await assert.rejects(transfer(7),/RESOLVE_PENDING_BUSINESS_PAYMENT_FIRST/);
  await rpc('review_subscription_payment',[id(600),'rejected','Rejected for verified ownership support test']);
  await db.query("update workspace_subscriptions set paid_through_at=now()-interval '1 day' where workspace_id=$1",[ws]);
  const changed=await transfer(7);assert.equal(await transfer(7),changed);assert.equal((await support()).workspace.owner_id,staff);assert.equal((await support()).workspace.version,8);
  assert.equal((await db.query('select role from workspace_members where workspace_id=$1 and user_id=$2',[ws,owner])).rows[0].role,'viewer');
  assert.equal((await db.query('select count(*)::int as n from business_member_permissions')).rows[0].n,0);
  assert.equal((await db.query('select status from business_subscription_quotes where id=$1',[id(400)])).rows[0].status,'cancelled');
  assert.equal((await db.query('select count(*)::int as n from business_support_permits')).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from workspace_members where workspace_id=$1 and user_id=$2',[ws,admin])).rows[0].n,0);
  await assert.rejects(transfer(8,owner,staffMember,211),/STATE_CHANGED/);
  await asUser(owner);await denied('business_billing_snapshot',[ws],'BUSINESS_BILLING_OWNER_REQUIRED');
  await asUser(staff);assert.equal((await rpc('business_billing_snapshot',[ws])).subscription.workspace_id,ws);
  await asUser(admin);
  const ownerMember=(await db.query('select id from workspace_members where workspace_id=$1 and user_id=$2',[ws,owner])).rows[0].id;
  // Recovery is allowed even if the old Owner is suspended; the account is never restored by this procedure.
  await db.query("update profiles set account_status='suspended' where id=$1",[staff]);
  await rpc('admin_business_transfer_owner',[ws,ownerMember,staff,8,'Test Company','owner@example.com','Verified recovery support ticket 789',id(212)]);
  assert.equal((await support()).actions[0].action,'recover');assert.equal((await support()).workspace.owner_id,owner);
  assert.equal((await db.query('select account_status from profiles where id=$1',[staff])).rows[0].account_status,'suspended');
  // Existing Owner transfer continues to work through protected permits.
  await db.query("update profiles set account_status='active' where id=$1",[staff]);
  await db.query("update workspace_subscriptions set paid_through_at=now()+interval '1 month' where workspace_id=$1",[ws]);
  await asUser(owner);assert.equal(await rpc('transfer_business_ownership',[ws,staffMember,'Test Company']),'transferred');
  await asUser(admin);assert.equal((await support()).workspace.version,10);
  await db.query("update profiles set account_status='suspended' where id=$1",[admin]);await denied('admin_business_support_snapshot',[ws],'SUPPORT_ADMIN_REQUIRED');await assert.rejects(status(10),/STATUS_ADMIN_REQUIRED/);await db.query("update profiles set account_status='active' where id=$1",[admin]);
  assert.equal((await rpc('admin_business_support_snapshot',[personal]).catch(e=>e.message)).includes('BUSINESS_WORKSPACE_NOT_FOUND'),true);
  assert.equal((await support()).members.length,2);
  await assert.rejects(db.query("update business_support_actions set reason='Changed support reason'"),/BUSINESS_AUDIT_IMMUTABLE/);
  await assert.rejects(db.query('delete from business_support_actions'),/BUSINESS_AUDIT_IMMUTABLE/);
  await db.exec('set role authenticated');
  await assert.rejects(db.query('select * from business_support_actions'),/permission denied/);
  await assert.rejects(db.query('insert into business_support_permits values(txid_current(),$1,$2,$3)',[ws,admin,'status']),/permission denied/);
  await assert.rejects(rpc('business_support_permitted',[ws,'status']),/permission denied/);
  await db.exec('reset role');
  const diagnostic=await db.query(readFileSync(path.join(root,'supabase/diagnostics/business_stage_11_admin_diagnostic.sql'),'utf8'));assert.equal(diagnostic.rows.length,24);assert.deepEqual(diagnostic.rows.filter(row=>row.result!=='PASS'),[]);
  console.log('PASS: Stage 11 actual SQL: role matrix, typed confirmations, stale state, private immutable audit, idempotent actions, protected direct writes, suspension restoration, ownership/recovery and legacy Owner transfer.');
}finally{await db.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
