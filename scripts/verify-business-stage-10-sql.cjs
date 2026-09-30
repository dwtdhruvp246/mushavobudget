// Disposable PostgreSQL integration checks; never connects to the live Supabase project.
const {PGlite}=require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const {readFileSync}=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),schema=readFileSync(path.join(root,'supabase/schema.sql'),'utf8');
const migration=readFileSync(path.join(root,'supabase/migrations/20260930090000_business_stage_10_billing.sql'),'utf8');
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
    create table budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text,status text default 'active',name text);
    create table workspace_members(id uuid primary key default gen_random_uuid(),workspace_id uuid,user_id uuid,role text,status text default 'active',joined_at timestamptz default now());
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
    insert into budget_workspaces values('${ws}','${owner}','business','active','Test Company'),('${other}','${outsider}','business','active','Other Company'),('${personal}','${owner}','personal','active','Personal');
    insert into workspace_members(workspace_id,user_id,role) values('${ws}','${owner}','business_owner'),('${ws}','${staff}','staff'),('${other}','${outsider}','business_owner');
    insert into plans(id,code,display_name,workspace_type) values('${plan}','business','Business','business'),('${id(21)}','personal','Personal','personal');
    insert into workspace_subscriptions(workspace_id,plan_id,billing_period,entitlement_start_at,billing_anchor_at,paid_through_at,member_limit) values
      ('${ws}','${plan}','monthly',now()-interval '10 days',now()-interval '10 days',now()+interval '20 days',4),
      ('${other}','${plan}','annual',now()-interval '20 days',now()-interval '20 days',now()+interval '345 days',2),
      ('${personal}','${id(21)}','monthly',now()-interval '10 days',now()-interval '10 days',now()+interval '20 days',1);
    grant select on budget_workspaces to authenticated;grant usage on schema auth to authenticated;
  `);
  await db.exec(migration);
  // Production triggers already exist; install their actual replacements in the fixture.
  await db.exec(`create trigger launch_request before insert or update of requested_plan_id on subscription_renewal_requests for each row execute function enforce_business_subscription_request_launch_control();
    create trigger launch_payment before update of status on subscription_payments for each row execute function enforce_business_payment_approval_launch_control();
    create trigger member_limit after update of status on subscription_payments for each row execute function apply_approved_subscription_member_limit();`);
  const asUser=uid=>db.query("select set_config('fixture.uid',$1,false)",[uid]);
  const rpc=async(name,args=[])=> (await db.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as result`,args)).rows[0].result;
  const denied=(name,args,error)=>assert.rejects(rpc(name,args),new RegExp(error));
  const snapshot=()=>rpc('business_billing_snapshot',[ws]);
  const quote=(kind='extra_seats',period='monthly',quantity=1)=>rpc('business_subscription_quote',[ws,kind,period,quantity]);
  const submit=(q,n=100,extra=[])=>rpc('submit_business_subscription_payment',[ws,q.id,id(n),'Bank transfer','2026-09-30','PAY-'+n,'Testing',...extra]);
  await asUser(owner);await denied('business_subscription_quote',[ws,'extra_seats','monthly',1],'BUSINESS_BILLING_NOT_CONFIGURED');
  assert.equal((await snapshot()).settings.monthly_base,null);assert.equal((await snapshot()).settings.included_seats,null);
  await denied('save_business_billing_settings',[plan,1,true,2,'USD',10,100,5,50,'Pay by transfer'],'BUSINESS_BILLING_ADMIN_REQUIRED');
  await asUser(admin);await rpc('save_business_billing_settings',[plan,1,true,2,'USD',10,100,5,50,'Pay by transfer. Use the quoted currency and reference.']);
  await denied('save_business_billing_settings',[plan,1,true,2,'USD',10,100,5,50,'Pay by transfer'],'BUSINESS_BILLING_SETTINGS_CHANGED');
  assert.equal((await rpc('admin_business_billing_settings')).length,1);
  await asUser(staff);await denied('business_billing_snapshot',[ws],'BUSINESS_BILLING_OWNER_REQUIRED');await denied('business_subscription_quote',[ws,'renewal','monthly',4],'BUSINESS_BILLING_OWNER_REQUIRED');
  await asUser(outsider);await denied('business_billing_snapshot',[ws],'BUSINESS_BILLING_OWNER_REQUIRED');
  await asUser(owner);let q=await quote('extra_seats','monthly',2);
  assert.equal(q.total_seats,6);assert.equal(Number(q.amount),Math.round(2*5*Number(q.fraction)*100)/100);assert.equal(q.billing_period,'monthly');
  const original=(await snapshot()).subscription;
  await denied('admin_business_subscription_payment_detail',[id(100)],'FINANCE_REVIEW_ACCESS_REQUIRED');
  await denied('business_subscription_quote',[ws,'extra_seats','annual',1],'ACTIVE_BUSINESS_SUBSCRIPTION_REQUIRED');
  // Cross-workspace paths and nonexistent storage objects are rejected by actual server checks.
  await denied('submit_business_subscription_payment',[ws,q.id,id(100),'Bank','2026-09-30','REF','',`workspaces/${other}/${owner}/proof.pdf`,'proof.pdf','application/pdf',30],'INVALID_SUBSCRIPTION_PROOF_PATH');
  const proofPath=`workspaces/${ws}/${owner}/proof.pdf`;
  await denied('submit_business_subscription_payment',[ws,q.id,id(100),'Bank','2026-09-30','REF','',proofPath,'proof.pdf','application/pdf',30],'SUBSCRIPTION_PROOF_NOT_FOUND');
  await db.query('insert into storage.objects(bucket_id,name,metadata) values($1,$2,$3)',['subscription-proofs',proofPath,{mimetype:'application/pdf',size:30}]);
  await submit(q,100,[proofPath,'proof.pdf','application/pdf',30]);assert.equal(await submit(q,100),id(100));
  assert.equal((await snapshot()).current_limit,4);assert.equal((await snapshot()).pending,true);
  await denied('business_subscription_quote',[ws,'extra_seats','monthly',1],'SUBSCRIPTION_REVIEW_ALREADY_PENDING');
  await asUser(staff);await denied('review_subscription_payment',[id(100),'approved'],'FINANCE_REVIEW_ACCESS_REQUIRED');
  await asUser(reviewer);assert.equal((await rpc('admin_business_subscription_payment_detail',[id(100)])).id,q.id);assert.equal(await rpc('review_subscription_payment',[id(100),'approved']),'approved');assert.equal(await rpc('review_subscription_payment',[id(100),'approved']),'already_reviewed');
  await asUser(owner);let s=await snapshot();assert.equal(s.current_limit,6);assert.equal(s.subscription.paid_through_at,original.paid_through_at);
  assert.equal(s.history[0].status,'approved');assert.ok(s.history[0].receipt_number.startsWith('MBR-B-'));assert.equal(s.history[0].proofs[0].path,proofPath);
  assert.equal((await db.query('select count(*)::integer as n from subscription_payment_reviews')).rows[0].n,1);
  // A quote stays fixed, but must be submitted before expiry and before configuration changes.
  q=await quote();await db.query("update business_subscription_quotes set expires_at=now()-interval '1 minute' where id=$1",[q.id]);await denied('submit_business_subscription_payment',[ws,q.id,id(101),'Bank','2026-09-30','REF'],'BUSINESS_SUBSCRIPTION_QUOTE_CHANGED');
  q=await quote();await asUser(admin);await rpc('save_business_billing_settings',[plan,2,true,2,'USD',10,100,5,50,'Updated instructions']);await asUser(owner);
  await denied('submit_business_subscription_payment',[ws,q.id,id(101),'Bank','2026-09-30','REF'],'BUSINESS_SUBSCRIPTION_QUOTE_CHANGED');
  // Renewal reduction counts pending reservations, not only accepted members.
  await db.query('insert into workspace_invitations(workspace_id,invitee_email,role) values($1,$2,$3)',[ws,'pending@example.com','staff']);
  await denied('business_subscription_quote',[ws,'renewal','monthly',2],'BUSINESS_CAPACITY_BELOW_USAGE');
  q=await quote('renewal','annual',3);assert.equal(Number(q.amount),150);await submit(q,102);
  await asUser(reviewer);await rpc('review_subscription_payment',[id(102),'approved']);await asUser(owner);s=await snapshot();
  assert.equal(s.current_limit,6);assert.equal(s.invitation_limit,3);assert.equal(s.renewal_scheduled,true);assert.equal(s.subscription.business_next_member_limit,3);
  assert.equal(s.subscription.business_next_effective_at,original.paid_through_at);
  const anchorYear=(await db.query("select ($1::timestamptz+interval '1 year')::text as at",[original.paid_through_at])).rows[0].at;
  assert.equal(Date.parse(s.subscription.paid_through_at),Date.parse(anchorYear));
  await denied('business_subscription_quote',[ws,'extra_seats','annual',1],'BUSINESS_RENEWAL_ALREADY_SCHEDULED');
  const team=await rpc('business_team_snapshot',[ws]);assert.equal(team.capacity.limit,3);
  await denied('create_business_invitation',[ws,'new@example.com','staff',null],'BUSINESS_SEAT_LIMIT_REACHED');
  // Renewal boundary is evaluated at read time, without requiring a cron job.
  await db.query("update workspace_subscriptions set business_next_effective_at=now()-interval '1 second',billing_anchor_at=now()-interval '1 second' where workspace_id=$1",[ws]);
  assert.equal((await snapshot()).current_limit,3);
  // A subsequent admin manual grant clears a prior scheduled change and resets the term anchor.
  await db.query("insert into admin_subscription_grants(workspace_id,grant_kind) values($1,'business_test')",[ws]);s=await snapshot();assert.equal(s.subscription.business_next_member_limit,null);assert.equal(s.current_limit,3);
  // Annual proration uses the exact 365/366-day term; no half-month rounding.
  await db.query("update workspace_subscriptions set billing_period='annual',entitlement_start_at=now()-interval '40 days',billing_anchor_at=now()-interval '40 days',paid_through_at=now()+interval '325 days',version=version+1 where workspace_id=$1",[ws]);
  q=await quote('extra_seats','annual',1);assert.equal(Number(q.amount),Math.round(50*Number(q.fraction)*100)/100);
  const leap=(await db.query("select business_seat_proration('2027-03-01'::timestamptz,'2028-03-01'::timestamptz,'2028-02-01'::timestamptz) as fraction")).rows[0].fraction;
  assert.ok(Math.abs(Number(leap)-29/366)<1e-12);
  const half=(await db.query("select business_seat_proration('2026-05-20'::timestamptz,'2026-06-20'::timestamptz,'2026-06-04 12:00:00Z'::timestamptz) as fraction")).rows[0].fraction;assert.equal(Number(half),0.5);
  // Approval rechecks suspension and cannot activate a suspended subscription.
  await submit(q,103);await db.query("update budget_workspaces set status='suspended' where id=$1",[ws]);await asUser(reviewer);
  await denied('review_subscription_payment',[id(103),'approved'],'BUSINESS_BILLING_SUSPENDED');await rpc('review_subscription_payment',[id(103),'rejected','Workspace suspended; contact support']);
  await asUser(owner);assert.equal((await snapshot()).suspended,true);await denied('business_subscription_quote',[ws,'renewal','annual',3],'BUSINESS_BILLING_SUSPENDED');
  await db.query("update budget_workspaces set status='active' where id=$1",[ws]);
  // Expired owners retain billing; staff cannot use operational team data or billing.
  await db.query("update workspace_subscriptions set status='expired',paid_through_at=now()-interval '1 day',version=version+1 where workspace_id=$1",[ws]);
  s=await snapshot();assert.ok(s.history_count>=3);q=await quote('renewal','monthly',3);await submit(q,104);
  await asUser(staff);await denied('business_team_snapshot',[ws],'BUSINESS_MEMBERSHIP_REQUIRED');await denied('business_billing_snapshot',[ws],'BUSINESS_BILLING_OWNER_REQUIRED');
  await asUser(reviewer);await rpc('review_subscription_payment',[id(104),'approved']);await asUser(owner);s=await snapshot();assert.equal(s.subscription.status,'active');assert.equal(s.current_limit,3);assert.equal(s.renewal_scheduled,false);
  assert.equal(s.subscription.billing_period,'monthly');assert.ok(Date.parse(s.subscription.paid_through_at)>Date.now());
  // Zero-price seat requests still require review, cannot attach a fake payment proof,
  // cannot be self-approved, and retain their accepted price when settings change.
  await asUser(admin);await rpc('save_business_billing_settings',[plan,3,true,2,'USD',10,100,0,50,'No-charge seat pilot']);
  await denied('save_business_billing_settings',[plan,4,true,2,'USD','NaN',100,0,50,'Invalid'],'INVALID_BUSINESS_BILLING_SETTINGS');
  await asUser(owner);q=await quote();assert.equal(Number(q.amount),0);
  await denied('submit_business_subscription_payment',[ws,q.id,id(105),null,null,null,null,proofPath,'proof.pdf','application/pdf',30],'INVALID_SUBSCRIPTION_PROOF_PATH');
  await rpc('submit_business_subscription_payment',[ws,q.id,id(105)]);
  await db.query("update profiles set admin_role='super_admin' where id=$1",[owner]);
  await denied('review_subscription_payment',[id(105),'approved'],'BUSINESS_BILLING_SELF_REVIEW_FORBIDDEN');
  await db.query('update profiles set admin_role=null where id=$1',[owner]);
  await asUser(admin);await rpc('save_business_billing_settings',[plan,4,false,2,'USD',12,100,1,50,'Changed prices']);
  await asUser(reviewer);await rpc('review_subscription_payment',[id(105),'approved']);await asUser(owner);
  const noCharge=(await snapshot()).history.find(row=>row.id===id(105));assert.equal(Number(noCharge.amount),0);assert.equal(noCharge.payment_method,'No payment required');
  const paged=await rpc('business_billing_snapshot',[ws,1,2]);assert.equal(paged.history.length,2);assert.ok(paged.history_count>2);
  // Private read helpers/tables and legacy bypass are not accessible through client RPCs.
  await db.exec('set role authenticated');await denied('business_billing_usage',[ws],'permission denied');await denied('business_effective_member_limit',[ws],'permission denied');
  await denied('review_subscription_payment_before_business_stage10',[id(100),'approved'],'permission denied');
  await assert.rejects(db.query('select * from business_subscription_quotes'),/permission denied/);
  const result=await db.query('update subscription_payments set amount=1 where id=$1 returning id',[id(100)]);assert.equal(result.rows.length,0);
  await assert.rejects(db.query("insert into subscription_renewal_requests(workspace_id,invoice_id,requested_plan_id,requested_by) values($1,$2,$3,$4)",[ws,id(900),plan,owner]),/row-level security|BUSINESS_COMING_SOON/);
  await db.exec('reset role');
  // Existing non-Business review forwards to the unchanged legacy implementation.
  await db.query("insert into subscription_invoices(id,workspace_id,invoice_number,plan_code,plan_name,billing_period,currency,base_amount,total_amount,created_by) values($1,$2,'P-1','personal','Personal','monthly','USD',10,10,$3)",[id(200),personal,owner]);
  await db.query('insert into subscription_renewal_requests(id,workspace_id,invoice_id,requested_plan_id,requested_by) values($1,$2,$3,$4,$5)',[id(201),personal,id(200),id(21),owner]);
  await db.query("insert into subscription_payments(id,workspace_id,renewal_request_id,submitted_by,amount,currency,payment_method,payment_date,reference_number) values($1,$2,$3,$4,10,'USD','Bank',current_date,'P-1')",[id(202),personal,id(201),owner]);
  await asUser(reviewer);assert.equal(await rpc('review_subscription_payment',[id(202),'approved']),'legacy_approved');
  await db.exec("alter table plans add column available_for_purchase boolean default false;");
  const checks=await db.query(readFileSync(path.join(root,'supabase/diagnostics/business_stage_10_billing_diagnostic.sql'),'utf8'));
  assert.equal(checks.rows.length,25);assert.deepEqual(checks.rows.filter(row=>row.status!=='PASS'),[]);
  await asUser(owner);await db.query("update profiles set account_status='suspended' where id=$1",[owner]);await denied('business_billing_snapshot',[ws],'BUSINESS_BILLING_OWNER_REQUIRED');await denied('business_subscription_quote',[ws,'renewal','monthly',3],'BUSINESS_BILLING_OWNER_REQUIRED');
  console.log('PASS: Stage 10 actual SQL: unset prices, admin configuration, exact monthly/annual and leap-year proration, Owner-only billing, quote expiry/config guards, verified proofs, duplicate-safe submission/review, seats after approval, same expiry, future-effective renewal capacity, pending reservations, suspension/expiry, private RPCs and Personal/Family delegation.');
}finally{await db.close();}})().catch(error=>{console.error(error.message,error.detail || '',error.hint || '');process.exitCode=1;});
