// Runs against disposable PostgreSQL only; no live project credentials are used.
const {PGlite} = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const {readFileSync} = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.join(__dirname,'..');
const read = name => readFileSync(path.join(root,'supabase/migrations',name),'utf8');
const foundation = read('20260928070000_business_stage_2_security_foundation.sql'), team = read('20260928170000_business_stage_4_team.sql');
function fn(source,name) {const m=new RegExp('create(?: or replace)? function public\\.'+name+'\\(').exec(source);assert(m,name);return source.slice(m.index,source.indexOf('$$;',m.index)+3);}
function table(name) {const a=foundation.indexOf('create table if not exists public.'+name+' (');return foundation.slice(a,foundation.indexOf('\n);',a)+3);}
const id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0'), ws=id(1), other=id(2), personal=id(3), owner=id(10), staff=id(11), outsider=id(12), manager=id(13), member=id(21), branch=id(30), branch2=id(31);
(async()=>{const db=new PGlite();try {
  await db.exec(`create role authenticated;create role anon;create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email','owner@example.com')$$;
    create table budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text,status text,name text);
    create table profiles(id uuid primary key,full_name text,email text);
    create table workspace_members(id uuid primary key,workspace_id uuid,user_id uuid,role text,status text,updated_at timestamptz,
      unique(workspace_id,id),constraint workspace_members_role_check check(role in ('business_owner','business_admin','finance_manager','team_manager','staff','contributor','viewer','owner')));
    create table workspace_subscriptions(workspace_id uuid,status text,paid_through_at timestamptz,member_limit integer);
    create table workspace_settings(workspace_id uuid,reporting_currency text,timezone text,period_start_day integer);
    create table business_dimensions(id uuid,workspace_id uuid,status text);
    create table business_categories(id uuid,workspace_id uuid,status text);
    create table business_profiles(workspace_id uuid primary key);
    create table business_member_scopes(workspace_id uuid,member_id uuid,dimension_id uuid,assigned_by uuid);
    create table business_invitation_scopes(invitation_id uuid,workspace_id uuid,dimension_id uuid);
    create table business_team_operation_permits(transaction_id bigint,workspace_id uuid,actor_id uuid,operation text,unique(transaction_id,workspace_id,actor_id,operation));
    create table workspace_invitations(id uuid primary key default gen_random_uuid(),workspace_id uuid,invited_by uuid,invitee_email text,invitee_user_id uuid,
      role text,status text,expires_at timestamptz,delivery_status text,delivery_error_code text,last_sent_at timestamptz,updated_at timestamptz,responded_at timestamptz,version integer default 1);
    create table fixture_audit(action text,after_summary jsonb);
    create function business_record_audit_event(uuid,text,text,uuid,jsonb default '{}',jsonb default '{}',text default null,uuid default null,uuid default null)
      returns uuid language plpgsql as $$begin insert into fixture_audit values($2,$6);return gen_random_uuid();end;$$;
    create function my_account_suspended() returns boolean language sql stable as $$select coalesce(current_setting('fixture.suspended',true),'false')='true'$$;
    create function is_business_workspace_member(uuid) returns boolean language sql stable security definer as $$select not my_account_suspended()
      and exists(select 1 from workspace_members m join budget_workspaces w on w.id=m.workspace_id where m.workspace_id=$1 and m.user_id=auth.uid()
        and m.status='active' and w.workspace_type='business' and w.status='active')$$;
    create function business_claims_active(uuid) returns boolean language sql stable security definer as $$select is_business_workspace_member($1)
      and exists(select 1 from workspace_subscriptions where workspace_id=$1 and status='active' and paid_through_at>now())$$;
    create function business_effective_member_limit(uuid,boolean) returns integer language sql stable as $$select 10$$;
    create function emit_business_change_signal(uuid,boolean) returns void language sql as $$select$$;
    grant usage on schema public,auth to authenticated;grant execute on function auth.uid(),auth.jwt() to authenticated;
  `);
  for(const name of ['business_permission_definitions','business_role_permissions','business_member_permissions'])await db.exec(table(name));
  const start=foundation.indexOf('insert into public.business_permission_definitions'), end=foundation.indexOf('create table if not exists public.business_profiles');
  await db.exec(foundation.slice(start,end));
  await db.exec(fn(foundation,'business_has_permission'));
  await db.exec(fn(team,'business_team_can_manage'));await db.exec(fn(team,'expire_business_invitations'));
  await db.exec(fn(foundation,'enforce_business_member_role_compatibility'));
  await db.exec(`create trigger fixture_member_guard before insert or update of role,workspace_id on workspace_members for each row execute function enforce_business_member_role_compatibility();
    insert into auth.users values('${owner}'),('${staff}'),('${outsider}'),('${manager}');
    insert into budget_workspaces values('${ws}','${owner}','business','active','Company'),('${other}','${outsider}','business','active','Other'),('${personal}','${owner}','personal','active','Personal');
    insert into workspace_members values('${id(20)}','${ws}','${owner}','business_owner','active',now()),('${member}','${ws}','${staff}','staff','active',now()),
      ('${id(22)}','${other}','${outsider}','business_owner','active',now()),('${id(23)}','${ws}','${manager}','team_manager','active',now());
    insert into workspace_subscriptions values('${ws}','active',now()+interval '1 year',10),('${other}','active',now()+interval '1 year',10);
    insert into business_dimensions values('${branch}','${ws}','active'),('${branch2}','${ws}','active');
    insert into business_role_permissions(workspace_id,role,permission_code,enabled) values('${ws}','staff','workspace.view',true),('${ws}','staff','finance.create',true);
  `);
  await db.exec(read('20261004153000_business_custom_roles.sql'));
  const diagnostics=(await db.query(readFileSync(path.join(root,'supabase/diagnostics/business_custom_roles_diagnostic.sql'),'utf8'))).rows;
  assert.equal(diagnostics.length,20);assert(diagnostics.every(row=>row.passed),JSON.stringify(diagnostics.filter(row=>!row.passed)));
  const auth=async uid=>db.exec(`reset role;select set_config('fixture.uid','${uid}',false);set role authenticated;`);
  const rows=async sql=>(await db.query(sql)).rows;
  const reject=async(sql,code)=>{await assert.rejects(db.query(sql),new RegExp(code));};
  await auth(staff);assert.equal((await rows(`select business_has_permission('${ws}','finance.create') ok`))[0].ok,true);
  await auth(owner);
  let snapshot=(await rows(`select business_roles_snapshot('${ws}') s`))[0].s;
  assert.equal(snapshot.roles.length,6);assert.equal(snapshot.can_manage,true);
  const permissions="array['workspace.view','finance.create','approvals.view','approvals.review','reports.view','reports.export']";
  const create=await rows(`select * from save_business_role('${ws}',null,'Branch Supervisor','Review assigned branches','assigned',${permissions},null)`);
  const role=create[0].code;assert.match(role,/^custom_[0-9a-f]{32}$/);
  await reject(`select save_business_role('${ws}',null,'Branch Supervisor','','assigned',array['workspace.view'],null)`,'business_roles_name_unique');
  await reject(`select update_business_member_access('${ws}','${member}','${role}',array[]::uuid[])`,'BUSINESS_ASSIGNED_SCOPE_REQUIRED');
  await rows(`select update_business_member_access('${ws}','${member}','${role}',array['${branch}']::uuid[])`);
  await reject(`select archive_business_role('${ws}','${role}',1)`,'BUSINESS_ROLE_IN_USE');
  await reject(`select save_business_role('${ws}','${role}','Branch Supervisor','','all',${permissions},1)`,'BUSINESS_ROLE_SCOPE_IN_USE');
  await reject(`select save_business_role('${ws}','${role}','Changed','','assigned',${permissions},999)`,'BUSINESS_ROLE_CHANGED');
  await reject(`insert into business_roles(workspace_id,code,name,scope_mode) values('${ws}','custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Bypass','all')`,'permission denied');
  await auth(staff);
  assert.equal((await rows(`select business_has_permission('${ws}','reports.export') ok`))[0].ok,true);
  assert.equal((await rows(`select business_claim_in_scope('${ws}','${branch}') ok`))[0].ok,true);
  assert.equal((await rows(`select business_claim_in_scope('${ws}','${branch2}') ok`))[0].ok,false);
  assert.equal((await rows(`select business_report_scope('${ws}','${branch2}','${staff}') ok`))[0].ok,false);
  await reject(`select save_business_role('${ws}',null,'Escalation','','all',array['workspace.view'],null)`,'BUSINESS_OWNER_REQUIRED');
  await auth(owner);
  await rows(`select update_business_member_role_access('${ws}','${member}','${role}',array['${branch}']::uuid[], '[{"permission_code":"reports.view","effect":"deny"}]')`);
  await auth(staff);assert.equal((await rows(`select business_has_permission('${ws}','reports.export') ok`))[0].ok,false);
  await auth(owner);
  await reject(`select update_business_member_role_access('${ws}','${member}','staff',array[]::uuid[],'[{"permission_code":"subscription.manage","effect":"allow"}]')`,'INVALID_BUSINESS_PERMISSION');
  await db.exec('reset role');assert.equal((await rows(`select role from workspace_members where id='${member}'`))[0].role,role);
  await auth(outsider);await reject(`select update_business_member_access('${other}','${id(22)}','${role}',array[]::uuid[])`,'INVALID_BUSINESS_MEMBER|INVALID_BUSINESS_ROLE');
  await auth(owner);
  await reject(`select save_business_role('${ws}',null,'Own records','','own',array['workspace.view','finance.view_all'],null)`,'BUSINESS_OWN_RECORDS_PERMISSION_CONFLICT');
  const own=(await rows(`select (save_business_role('${ws}',null,'Own records','','own',array['workspace.view','reports.view'],null)).code code`))[0].code;
  await rows(`select update_business_member_role_access('${ws}','${member}','${own}',array[]::uuid[],'[{"permission_code":"reports.view","effect":null}]')`);
  await auth(staff);
  assert.equal((await rows(`select business_report_scope('${ws}','${branch}','${staff}') ok`))[0].ok,true);
  assert.equal((await rows(`select business_report_scope('${ws}','${branch}','${owner}') ok`))[0].ok,false);
  await auth(owner);
  const invite=(await rows(`select create_business_invitation('${ws}','new@example.com','${role}',array['${branch}']::uuid[]) s`))[0].s;
  assert(invite.invitation_id);await reject(`select archive_business_role('${ws}','${role}',1)`,'BUSINESS_ROLE_IN_USE');
  await db.exec(`reset role;update workspace_invitations set status='cancelled' where id='${invite.invitation_id}';`);await auth(owner);
  await rows(`select archive_business_role('${ws}','${role}',1)`);
  await reject(`select update_business_member_access('${ws}','${member}','${role}',array['${branch}']::uuid[])`,'INVALID_BUSINESS_ROLE');
  await reject(`select archive_business_role('${ws}','staff',1)`,'BUSINESS_SYSTEM_ROLE_PROTECTED');
  await db.exec(`reset role;insert into business_role_permissions(workspace_id,role,permission_code,enabled) values('${ws}','team_manager','team.view',true),('${ws}','team_manager','team.manage',true);`);
  await db.exec(`reset role;insert into business_role_permissions(workspace_id,role,permission_code,enabled) values('${ws}','finance_manager','finance.view_all',true);`);
  await auth(manager);await reject(`select update_business_member_access('${ws}','${member}','finance_manager',array[]::uuid[])`,'BUSINESS_PRIVILEGE_ESCALATION_BLOCKED');
  await auth(staff);await db.exec(`select set_config('fixture.suspended','true',false)`);
  assert.equal((await rows(`select business_has_permission('${ws}','reports.view') ok`))[0].ok,false);
  await db.exec(`select set_config('fixture.suspended','false',false)`);
  await auth(staff);await db.exec(`reset role;update workspace_subscriptions set paid_through_at=now()-interval '1 day' where workspace_id='${ws}';set role authenticated;`);
  assert.equal((await rows(`select business_has_permission('${ws}','reports.view') ok`))[0].ok,false);
  await auth(owner);await reject(`select save_business_role('${ws}',null,'Expired','','all',array['workspace.view'],null)`,'BUSINESS_OWNER_REQUIRED');
  console.log('PASS: full migration, role creation, unique names, owner controls, assignment, branch/own scopes, overrides, dependencies, rollback, stale edits, invitations, archives, isolation and expiry');
}finally{await db.close();}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
