// Disposable PostgreSQL, actual migration/RPC/policy source, synthetic identities.
// Team permission and billing helpers are fixture stubs; broader role tests run separately.
const { PGlite } = require(process.env.MUSHAVO_PGLITE_MODULE || '@electric-sql/pglite');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const schema = readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8');
const migration = readFileSync(path.join(root, 'supabase/migrations/20261006180000_business_invitation_notifications.sql'), 'utf8');
function fn(name) {
  const matches = [...schema.matchAll(new RegExp('create(?: or replace)? function public\\.' + name + '\\(', 'gi'))];
  const start = matches.at(-1)?.index;
  assert.notEqual(start, undefined, name);
  return schema.slice(start, schema.indexOf('$$;', start) + 3);
}
const id = n => '00000000-0000-0000-0000-' + String(n).padStart(12, '0');
const owner = id(1), viewer = id(2), outsider = id(3), workspace = id(10), personal = id(11);
(async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('fixture.uid',true),'')::uuid$$;
      create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('email',current_setting('fixture.email',true))$$;
      create function auth.role() returns text language sql stable as $$select current_setting('fixture.role',true)$$;
      create table auth.users(id uuid primary key);
      create table profiles(id uuid primary key,full_name text,email text);
      create table budget_workspaces(id uuid primary key,owner_id uuid,workspace_type text,status text,name text);
      create table business_roles(workspace_id uuid,code text,name text);
      create table workspace_subscriptions(workspace_id uuid,status text,paid_through_at timestamptz);
      create table workspace_members(id uuid primary key default gen_random_uuid(),workspace_id uuid,user_id uuid,role text,status text,
        invited_by uuid,joined_at timestamptz,removed_at timestamptz,updated_at timestamptz,unique(workspace_id,user_id));
      create table workspace_invitations(id uuid primary key default gen_random_uuid(),workspace_id uuid,invited_by uuid,invitee_user_id uuid,
        invitee_email text,role text,status text,expires_at timestamptz,delivery_status text,delivery_error_code text,last_sent_at timestamptz,
        created_at timestamptz default now(),updated_at timestamptz,responded_at timestamptz,version integer default 1);
      create table business_dimensions(id uuid,workspace_id uuid,name text,status text);
      create table business_invitation_scopes(invitation_id uuid,workspace_id uuid,dimension_id uuid);
      create table business_member_scopes(workspace_id uuid,member_id uuid,dimension_id uuid,assigned_by uuid);
      create table business_team_operation_permits(transaction_id bigint,workspace_id uuid,actor_id uuid,operation text,
        unique(transaction_id,workspace_id,actor_id,operation));
      create table notifications(id uuid primary key default gen_random_uuid(),user_id uuid,email text,created_by uuid,workspace_id uuid,
        invitation_id uuid,family_id uuid,type text,title text,body text,url text,read_at timestamptz,created_at timestamptz default now());
      alter table notifications enable row level security;
      grant select,insert,update on notifications to authenticated;
      create function business_team_can_manage(uuid) returns boolean language sql stable as $$select exists(select 1 from budget_workspaces where id=$1 and owner_id=auth.uid())$$;
      create function business_check_role_assignment(uuid,text,uuid[],uuid) returns void language plpgsql as $$begin
        if $2 <> 'viewer' then raise exception 'INVALID_BUSINESS_ROLE';end if;end;$$;
      create function my_account_suspended() returns boolean language sql stable as $$select false$$;
      create function business_effective_member_limit(uuid,boolean) returns integer language sql stable as $$select 10$$;
      create function business_record_audit_event(uuid,text,text,uuid,jsonb,jsonb) returns void language sql as $$select$$;
      insert into auth.users values('${owner}'),('${viewer}'),('${outsider}');
      insert into profiles values('${owner}','Example Owner','owner@example.com'),('${viewer}','Example Viewer','viewer@example.com'),('${outsider}','Outsider','outsider@example.com');
      insert into budget_workspaces values('${workspace}','${owner}','business','active','Example Business'),('${personal}','${owner}','personal','active','Personal');
      insert into business_roles values('${workspace}','viewer','Viewer');
      insert into workspace_subscriptions values('${workspace}','active',now()+interval '1 year');
      insert into workspace_members(workspace_id,user_id,role,status) values('${workspace}','${owner}','business_owner','active');
      insert into workspace_invitations(id,workspace_id,invited_by,invitee_email,role,status,expires_at) values
        ('${id(50)}','${workspace}','${owner}','future@example.com','viewer','pending',now()+interval '7 days'),
        ('${id(51)}','${workspace}','${owner}','expired@example.com','viewer','pending',now()-interval '1 day'),
        ('${id(52)}','${personal}','${owner}','personal@example.com','owner','pending',now()+interval '7 days'),
        ('${id(53)}','${workspace}','${owner}','accepted@example.com','viewer','accepted',now()+interval '7 days');`);
    for (const policy of ['Users can read own notifications', 'Users can update own notifications']) {
      const start = schema.indexOf('create policy "' + policy + '"');
      await db.exec(schema.slice(start, schema.indexOf(';', start) + 1));
    }
    await db.exec(`create policy fixture_legacy_notification_insert on notifications for insert to authenticated with check(created_by=auth.uid());`);
    for (const name of ['expire_business_invitations', 'create_business_invitation', 'get_my_business_invitations', 'respond_business_invitation', 'record_business_invitation_delivery']) await db.exec(fn(name));
    await db.exec(migration);
    await db.exec(migration);
    const diagnostics = (await db.query(readFileSync(path.join(root, 'supabase/diagnostics/business_invitation_notifications_diagnostic.sql'), 'utf8'))).rows;
    assert.equal(diagnostics.length, 8);
    assert.ok(diagnostics.every(row => row.status === 'PASS'), JSON.stringify(diagnostics));
    const rows = async sql => (await db.query(sql)).rows;
    const as = async (uid, email, role = 'authenticated') => db.exec(`reset role;select set_config('fixture.uid','${uid || ''}',false),set_config('fixture.email','${email}',false),set_config('fixture.role','${role}',false);set role ${role};`);
    const reject = async (sql, error) => assert.rejects(db.query(sql), new RegExp(error));
    assert.equal((await rows('select count(*)::int n from notifications'))[0].n, 1, 'only existing unexpired Business request backfilled, rerun deduplicated');
    for (const role of ['anon', 'authenticated']) {
      await as(outsider, 'outsider@example.com', role);
      await reject('select sync_business_invitation_notification()', 'permission denied');
    }
    await as(owner, 'owner@example.com');
    const created = (await rows(`select create_business_invitation('${workspace}','VIEWER@example.com','viewer') result`))[0].result;
    await as(outsider, 'outsider@example.com');
    assert.equal((await rows('select * from notifications')).length, 0, 'unrelated user cannot read request');
    await reject(`select respond_business_invitation('${created.invitation_id}',true)`, 'BUSINESS_INVITATION_NOT_AVAILABLE');
    await as(viewer, 'viewer@example.com');
    const notices = await rows('select * from notifications');
    assert.equal(notices.length, 1);
    assert.equal(notices[0].title, 'Business workspace invitation');
    assert.match(notices[0].body, /Example Owner.*Example Business.*Viewer/);
    assert.equal(notices[0].url, `/business.html?invitation=${created.invitation_id}#business/team`);
    await db.exec(`update notifications set read_at=now() where id='${notices[0].id}';`);
    await reject(`update notifications set body='forged' where id='${notices[0].id}'`, 'SERVER_MANAGED');
    await reject(`update notifications set business_invitation_id=null where id='${notices[0].id}'`, 'SERVER_MANAGED');
    await reject(`insert into notifications(created_by,business_invitation_id,title,body) values('${viewer}','${id(50)}','forged','forged')`, 'SERVER_MANAGED');
    await db.exec('reset role;');
    assert.equal((await rows(`select count(*)::int n from workspace_members where user_id='${viewer}'`))[0].n, 0, 'not a member before acceptance');
    await as(null, '', 'service_role');
    await rows(`select record_business_invitation_delivery('${created.invitation_id}','${viewer}',false,'SMTP_FAILED')`);
    await as(viewer, 'viewer@example.com');
    assert.equal((await rows('select * from notifications')).length, 1, 'email failure does not remove in-app request');
    assert.equal((await rows('select * from get_my_business_invitations()')).length, 1);
    await db.exec(`reset role;update workspace_invitations set expires_at=now()+interval '8 days' where id='${created.invitation_id}';`);
    await as(viewer, 'viewer@example.com');
    assert.equal((await rows('select * from notifications'))[0].read_at, null, 'resend refreshes same unread request');
    assert.equal((await rows(`select respond_business_invitation('${created.invitation_id}',true) workspace_id`))[0].workspace_id, workspace);
    const accepted = (await rows('select * from notifications'))[0];
    assert.match(accepted.title, /accepted/);
    assert.equal(accepted.url, null);
    assert.ok(accepted.read_at);
    await reject(`select respond_business_invitation('${created.invitation_id}',true)`, 'BUSINESS_INVITATION_NOT_AVAILABLE');
    await db.exec('reset role;');
    assert.equal((await rows(`select role from workspace_members where user_id='${viewer}'`))[0].role, 'viewer');
    await as(owner, 'owner@example.com');
    const declined = (await rows(`select create_business_invitation('${workspace}','outsider@example.com','viewer') result`))[0].result;
    await as(outsider, 'outsider@example.com');
    await rows(`select respond_business_invitation('${declined.invitation_id}',false)`);
    assert.equal((await rows('select * from get_my_business_invitations()')).length, 0);
    assert.equal((await rows('select * from notifications'))[0].url, null);
    await db.exec(`reset role;update workspace_invitations set status='cancelled' where id='${id(50)}';`);
    assert.equal((await rows(`select url from notifications where business_invitation_id='${id(50)}'`))[0].url, null);
    await as(owner, 'owner@example.com');
    const expired = (await rows(`select create_business_invitation('${workspace}','expired-now@example.com','viewer') result`))[0].result;
    await db.exec(`reset role;update workspace_invitations set expires_at=now()-interval '1 day' where id='${expired.invitation_id}';`);
    await as(viewer, 'viewer@example.com');
    await rows('select * from get_my_business_invitations()');
    await db.exec('reset role;');
    const expiry = (await rows(`select * from notifications where business_invitation_id='${expired.invitation_id}'`))[0];
    assert.match(expiry.title, /expired/);
    assert.equal(expiry.url, null);
    await as(outsider, 'future@example.com');
    assert.equal((await rows(`select * from notifications where business_invitation_id='${id(50)}'`)).length, 1, 'email-targeted request survives pending identity binding');
    console.log('PASS: actual migration/RPCs, idempotent backfill, RLS recipient isolation, metadata guard, email failure, resend deduplication, no premature membership, accept/replay/decline/cancel/expiry');
  } finally { await db.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
