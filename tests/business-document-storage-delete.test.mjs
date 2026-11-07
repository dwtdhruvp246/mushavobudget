import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = fs.readFileSync(new URL('../supabase/migrations/20261107070000_business_document_storage_delete_authorization.sql', import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111';
const uploader = '22222222-2222-4222-8222-222222222222';
const workspace = '33333333-3333-4333-8333-333333333333';
const path = `workspaces/${workspace}/${uploader}/44444444-4444-4444-8444-444444444444/receipt.png`;

test('archived Storage deletion preserves download and registration boundaries', async () => {
  const db = new PGlite();
  let assertions = 0;
  const equal = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const scalar = async sql => (await db.query(sql)).rows[0]?.value;
  const setting = async (name, value) => db.query('select set_config($1,$2,false)', [name, String(value)]);
  const role = async name => db.exec(`set role ${name}`);
  const access = async ({ user = owner, active = true, manage = true, create = true, parent = true, session = true } = {}) => {
    await role('none');
    for (const [name, value] of Object.entries({ 'request.jwt.claim.sub': user, 'test.active': active,
      'test.manage': manage, 'test.create': create, 'test.parent': parent, 'test.session': session })) await setting(name, value);
    await role('authenticated');
  };
  const visible = async operation => { await setting('storage.operation', operation); return scalar(`select count(*)::int as value from storage.objects where name='${path}'`); };
  const authorized = async () => scalar(`select public.business_storage_delete_authorized('${path}') as value`);
  try {
    // Real PostgreSQL RLS with modeled application/session predicates. No hosted
    // accounts, files, network requests or service credentials are used here.
    await db.exec(`
      create role authenticated; create role anon; create role service_role;
      create schema auth; create schema storage; create schema mushavo_email_auth;
      grant usage on schema public,auth,storage,mushavo_email_auth to authenticated,anon,service_role;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
      create function storage.allow_any_operation(text[]) returns boolean language sql stable as $$ select replace(coalesce(current_setting('storage.operation',true),''),'storage.','')=any($1) $$;
      create function mushavo_email_auth.require_application_session() returns void language plpgsql stable as $$ begin if current_setting('test.session',true)<>'true' then raise exception 'SESSION_REQUIRED'; end if; end $$;
      create function public.business_storage_workspace_id(text) returns uuid language sql immutable as $$ select case when (storage.foldername($1))[1]='workspaces' then (storage.foldername($1))[2]::uuid else null end $$;
      create function public.business_claims_active(uuid) returns boolean language sql stable as $$ select $1='${workspace}' and current_setting('test.active',true)='true' $$;
      create function public.business_has_permission(uuid,text) returns boolean language sql stable as $$ select public.business_claims_active($1) and case $2 when 'documents.manage' then current_setting('test.manage',true)='true' when 'documents.create' then current_setting('test.create',true)='true' else true end $$;
      create function public.business_can_view_claim(uuid,uuid) returns boolean language sql stable as $$ select current_setting('test.parent',true)='true' $$;
      create function public.business_can_view_bill_document(uuid,text,uuid) returns boolean language sql stable as $$ select current_setting('test.parent',true)='true' $$;
      create table public.business_documents(storage_path text primary key, workspace_id uuid, status text, parent_type text, parent_id uuid);
      create table storage.objects(name text primary key,bucket_id text);
      alter table public.business_documents enable row level security;
      alter table storage.objects enable row level security;
      grant select on public.business_documents to authenticated;
      grant select,delete on storage.objects to authenticated;
      create policy document_read on public.business_documents for select to authenticated using(status='active' and current_setting('test.parent',true)='true');
      create policy storage_read on storage.objects for select to authenticated using(exists(select 1 from public.business_documents d where d.storage_path=objects.name and d.status='active'));
      create policy "Business members can delete archived or unregistered private documents" on storage.objects for delete to authenticated using(not exists(select 1 from public.business_documents d where d.storage_path=objects.name and d.status='active'));
      insert into public.business_documents values('${path}','${workspace}','archived','expense_claim','55555555-5555-4555-8555-555555555555');
      insert into storage.objects values('${path}','business-documents');
    `);
    await access();
    equal(await visible('object.delete'), 0, 'reproduce archived file hidden from deletion selection');
    equal((await db.query(`delete from storage.objects where name='${path}' returning name`)).rows.length, 0, 'original policy cannot delete archived file');
    await role('none'); await db.exec(migration); await access();
    equal(await scalar('select count(*)::int as value from public.business_documents'), 0, 'archived metadata remains private');
    for (const operation of ['', 'object.get_authenticated', 'object.get_signed', 'object.sign', 'object.sign_many', 'object.list', 'object.copy', 'object.move']) {
      equal(await visible(operation), 0, `archive stays hidden during ${operation || 'unset operation'}`);
    }
    equal(await visible('object.delete'), 1, 'single deletion can select its authorized archive');
    equal(await visible('storage.object.delete_many'), 1, 'bulk deletion can select its authorized archive');
    equal(await authorized(), true, 'manager with parent access may delete archive');
    await access({ parent: false }); equal(await authorized(), false, 'out-of-scope parent denied');
    await access({ active: false }); equal(await visible('object.delete'), 0, 'removed, suspended or expired membership predicate denied');
    await access({ user: uploader, manage: false }); equal(await authorized(), false, 'uploader cannot delete registered archive without management permission');
    await access({ session: false }); await assert.rejects(authorized(), /SESSION_REQUIRED/); assertions++;
    await role('none'); await db.exec("update public.business_documents set status='active'");
    await access(); equal(await authorized(), false, 'registered active object protected from manager deletion');
    await access({ parent: false }); equal(await authorized(), false, 'RLS-hidden active document cannot be mistaken for an orphan');
    await role('none'); await db.exec("update public.business_documents set status='archived',workspace_id='66666666-6666-4666-8666-666666666666'");
    await access(); equal(await authorized(), false, 'cross-workspace registration denied');
    await role('none'); await db.exec('delete from public.business_documents');
    await access({ user: uploader, manage: false }); equal(await authorized(), true, 'creator may clean own unregistered upload');
    await access({ manage: false }); equal(await authorized(), false, 'creator cannot clean another user upload');
    await access(); equal(await authorized(), true, 'manager may clean workspace orphan');
    await role('none'); await db.exec(`insert into public.business_documents values('${path}','${workspace}','archived','business_bill','55555555-5555-4555-8555-555555555555')`);
    await access({ parent: false }); equal(await authorized(), false, 'bill parent access required');
    await access(); await setting('storage.operation','object.delete');
    equal((await db.query(`delete from storage.objects where name='${path}' returning name`)).rows.length, 1, 'authorized archive deleted through actual PostgreSQL RLS');
    await role('none');
    equal(await scalar("select has_function_privilege('anon','public.business_storage_delete_authorized(text)','EXECUTE') as value"), false, 'anonymous helper execution denied');
    equal(await scalar("select has_function_privilege('authenticated','public.business_storage_delete_authorized(text)','EXECUTE') as value"), true, 'authenticated policy execution retained');
    console.log(`PASS: ${assertions} Storage deletion and privacy assertions; modeled application/session dependencies`);
  } finally { await db.close(); }
});
