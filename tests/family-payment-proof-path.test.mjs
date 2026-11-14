import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const original = JSON.parse(fs.readFileSync(new URL('./fixtures/family-payment-proof-reviewed-policy.json', import.meta.url), 'utf8'));
const migration = fs.readFileSync(new URL('../supabase/remediation/security_fr_2_6_family_payment_proof_path_binding.sql', import.meta.url), 'utf8');
const owner = '11111111-1111-4111-8111-111111111111', member = '22222222-2222-4222-8222-222222222222';
const outsider = '33333333-3333-4333-8333-333333333333', family = '44444444-4444-4444-8444-444444444444';
const path = user => `families/${family}/${owner}/${user}/synthetic-proof.png`;

test('the exact installed Family path error is reproduced and the corrected RLS preserves isolation', async () => {
  const db = new PGlite(); let assertions = 0, sequence = 0;
  const check = (value, expected, label) => { assert.equal(value, expected, label); assertions++; };
  const actor = async (user, valid = true) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('test.session_valid',$2,false)", [user, String(valid)]);
    await db.exec('set role authenticated');
  };
  const upload = async (name, bucket = 'payment-proofs') => {
    try { await db.query('insert into storage.objects(id,bucket_id,name) values($1,$2,$3)', [++sequence, bucket, name]); return true; }
    catch (error) { if (error.code !== '42501') throw error; return false; }
  };
  try {
    await db.exec(`create role authenticated;create role anon;create schema auth;create schema storage;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
      create table public.families(id uuid primary key,owner_id uuid not null,name text not null);
      create table public.family_members(family_id uuid,user_id uuid,status text);
      insert into public.families values('${family}','${owner}','Ordinary family name');
      insert into public.family_members values('${family}','${member}','active');
      create function public.is_active_family_participant(uuid) returns boolean language sql stable security definer set search_path=pg_catalog as $$
        select exists(select 1 from public.families where id=$1 and owner_id=auth.uid())
          or exists(select 1 from public.family_members where family_id=$1 and user_id=auth.uid() and status='active')$$;
      create table storage.objects(id integer primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      grant usage on schema public,auth,storage to authenticated,anon;
      grant select on public.families to authenticated;
      grant insert on storage.objects to authenticated,anon;
      create policy "Users can upload permitted payment proofs" on storage.objects for insert to authenticated with check (${original.policy.with_check});
      create policy session_required on storage.objects as restrictive for all to authenticated using(current_setting('test.session_valid',true)='true') with check(current_setting('test.session_valid',true)='true');`);
    await actor(owner); check(await upload(path(owner)), false, 'installed policy rejects legitimate owner because it parses the family name');
    await actor(member); check(await upload(path(member)), false, 'installed policy also rejects legitimate active member');
    await db.exec('reset role'); await db.exec(migration);
    await actor(owner); check(await upload(path(owner)), true, 'owner own Family path allowed');
    await actor(member); check(await upload(path(member)), true, 'active member own uploader path allowed');
    check(await upload(path(owner)), false, 'member cannot impersonate owner uploader');
    check(await upload(path(member).replace('/'+owner+'/', '/'+outsider+'/')), false, 'Family owner path must match authoritative owner');
    check(await upload(path(member).replace('/'+family+'/', '/55555555-5555-4555-8555-555555555555/')), false, 'nonexistent Family denied');
    check(await upload(path(member), 'subscription-proofs'), false, 'other bucket is outside this grant');
    await actor(outsider); check(await upload(path(outsider)), false, 'ordinary outsider denied');
    await actor(owner, false); check(await upload(path(owner)), false, 'restrictive current-session gate still required');
    await actor(member); check(await upload(`personal/${member}/synthetic-proof.png`), true, 'own Personal proof remains allowed');
    check(await upload(`personal/${owner}/synthetic-proof.png`), false, 'foreign Personal path denied');
    await db.exec('reset role'); await db.exec("update public.family_members set status='inactive'");
    await actor(member); check(await upload(path(member)), false, 'removed member denied');
    await db.exec('reset role'); await db.exec('set role anon'); check(await upload(path(owner)), false, 'anonymous insert denied');
    await db.exec('reset role');
    const policy = (await db.query("select roles,cmd,permissive,with_check from pg_policies where schemaname='storage' and tablename='objects' and policyname='Users can upload permitted payment proofs'")).rows[0];
    check(policy.cmd, 'INSERT', 'operation unchanged'); check(policy.permissive, 'PERMISSIVE', 'policy composition unchanged');
    assert.deepEqual(policy.roles, ['authenticated']); assertions++;
    console.log(`PASS: ${assertions} actual PostgreSQL Family/Personal upload RLS assertions; modeled session helper`);
  } finally { await db.close(); }
});
