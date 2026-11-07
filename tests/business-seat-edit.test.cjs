const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
test('seat edits enforce authority, capacity and versions and preserve subscription terms',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;create schema mushavo_email_auth;
 create function auth.uid() returns uuid language sql as $$select '00000000-0000-0000-0000-000000000001'::uuid$$;
 create function mushavo_email_auth.require_application_session() returns void language plpgsql as $$begin if current_setting('test.session')<>'yes' then raise exception 'SESSION_REQUIRED';end if;end$$;
 create function public.my_account_suspended() returns boolean language sql as $$select current_setting('test.suspended')='yes'$$;
 create function public.is_platform_staff(text[]) returns boolean language sql as $$select current_setting('test.role')=any($1)$$;
 create table budget_workspaces(id uuid primary key,workspace_type text,status text,name text);
 create table workspace_subscriptions(id uuid,workspace_id uuid,member_limit int,version int,status text,paid_through_at timestamptz,business_next_member_limit int,business_next_effective_at timestamptz,updated_at timestamptz);
 create table subscription_payments(workspace_id uuid,status text);
 create table subscription_renewal_requests(workspace_id uuid,status text);
 create table business_subscription_quotes(workspace_id uuid,status text);
 create table subscription_audit_events(workspace_id uuid,actor_id uuid,action text,target_type text,target_id uuid,safe_details jsonb);
 create function business_billing_usage(uuid) returns integer language sql as $$select current_setting('test.usage')::integer$$;
 create function business_effective_member_limit(uuid) returns integer language sql as $$select case when business_next_effective_at<=now() then business_next_member_limit else member_limit end from public.workspace_subscriptions where workspace_id=$1$$;
 set test.session='yes';set test.suspended='no';set test.role='super_admin';set test.usage='1';
 insert into budget_workspaces values('00000000-0000-0000-0000-000000000002','business','active','Test business');
 insert into workspace_subscriptions values('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002',1,1,'active',now()+interval '30 days',null,null,now());
 `);
 const sql=fs.readFileSync(__dirname+'/../supabase/candidates/security_fr_2_5_business_seats.sql','utf8');
 await db.exec(`create schema mushavo_email_install;
 create table mushavo_email_install.rollout_control(singleton boolean,target_project text,mode text,catalog_sha256 text,changed_at timestamptz);
 create table mushavo_email_install.password_signin_policy(id int);
 create function mushavo_email_install.catalog_identity() returns text language sql as $$select 'fixture-catalog'::text$$;
 insert into mushavo_email_install.rollout_control values(true,'dczlddwbtgvfdujgcitb','ACTIVE','fixture-catalog',now());`.replaceAll('\n+','\n'));
 await db.exec(sql);
 const call=(seats=5,version=1,name='Test business')=>db.query("select admin_set_business_seats('00000000-0000-0000-0000-000000000002',$1,$2,$3,'Testing seat allowance') value",[seats,version,name]);
 for(const role of ['staff','admin_staff','support_staff']){
  await db.exec("set test.role='"+role+"'");
  await assert.rejects(call(),/SUPER_ADMIN_REQUIRED/);
 }
 await db.exec("set test.role='super_admin';set test.session='no'");
 await assert.rejects(call(),/SESSION_REQUIRED/);
 await db.exec("set test.session='yes';set test.suspended='yes'");
 await assert.rejects(call(),/SUPER_ADMIN_REQUIRED/);
 await db.exec("set test.suspended='no'");
 for(const value of [0,101,null])await assert.rejects(call(value),/INVALID_BUSINESS_SEAT_ALLOWANCE/);
 await assert.rejects(call(5,0),/SUBSCRIPTION_CHANGED/);
 await assert.rejects(call(5,1,'Wrong workspace'),/WORKSPACE_NAME/);
 await db.exec("set test.usage='3'");
 await assert.rejects(call(2),/CAPACITY_BELOW_USAGE/);
 await db.exec("insert into subscription_payments select id,'pending_review' from budget_workspaces");
 await assert.rejects(call(),/RESOLVE_PENDING/);
 await db.exec("delete from subscription_payments;update workspace_subscriptions set business_next_member_limit=2,business_next_effective_at=now()+interval '5 days'");
 await assert.rejects(call(),/SCHEDULED_SEAT_CHANGE/);
 await db.exec("update workspace_subscriptions set business_next_member_limit=null,business_next_effective_at=null");
 await db.exec("update budget_workspaces set workspace_type='personal'");
 await assert.rejects(call(),/ACTIVE_BUSINESS_WORKSPACE/);
 await db.exec("update budget_workspaces set workspace_type='business';update workspace_subscriptions set status='expired'");
 await assert.rejects(call(),/ACTIVE_BUSINESS_SUBSCRIPTION/);
 await db.exec("update workspace_subscriptions set status='active';insert into business_subscription_quotes select id,'quoted' from budget_workspaces");
 const before=(await db.query('select paid_through_at,status from workspace_subscriptions')).rows[0];
 assert.equal((await call()).rows[0].value,5);
 assert.deepEqual((await db.query('select paid_through_at,status from workspace_subscriptions')).rows[0],before);
 assert.equal((await db.query('select member_limit,version from workspace_subscriptions')).rows[0].version,2);
 assert.equal((await db.query('select status from business_subscription_quotes')).rows[0].status,'cancelled');
 await assert.rejects(call(),/SUBSCRIPTION_CHANGED/);
 await call(5,2);
 assert.equal((await db.query('select count(*)::int n from subscription_audit_events')).rows[0].n,1);
 assert.equal((await db.query("select has_function_privilege('anon','admin_set_business_seats(uuid,integer,integer,text,text)','execute') ok")).rows[0].ok,false);
 } finally {await db.close();}
});
