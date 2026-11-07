import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const migration = fs.readFileSync(new URL('../supabase/migrations/20261107080000_outbox_result_claim_binding.sql', import.meta.url), 'utf8');
const claims = JSON.parse(fs.readFileSync(new URL('./fixtures/outbox-reviewed-claim-functions.json', import.meta.url), 'utf8'));
const id = '11111111-1111-4111-8111-111111111111';
const at = '1900-01-01T00:00:00Z';

test('both queues reject stale claim completions and preserve bounded retries', async () => {
  const db = new PGlite(); let assertions = 0;
  const eq = (actual, expected, message) => { assert.equal(actual, expected, message); assertions++; };
  const scalar = async sql => (await db.query(sql)).rows[0]?.value;
  try {
    await db.exec('create role anon; create role authenticated; create role service_role; grant usage on schema public to anon,authenticated,service_role;');
    for (const table of ['notification_outbox', 'admin_notification_outbox']) {
      await db.exec(`create table public.${table}(id uuid primary key,status text,attempt_count integer,claimed_at timestamptz,next_attempt_at timestamptz,sent_at timestamptz,last_error text,scheduled_for timestamptz,created_at timestamptz); grant all on public.${table} to service_role;`);
      await db.exec(claims[table]);
      await db.exec(`revoke all on function public.claim_${table}(integer,timestamptz) from public,anon,authenticated; grant execute on function public.claim_${table}(integer,timestamptz) to service_role;`);
    }
    await db.exec(migration);
    for (const table of ['notification_outbox', 'admin_notification_outbox']) {
      const fn = `public.record_${table}_result`;
      const reset = async (attempt = 0, status = 'pending', claimed = 'null') => {
        await db.exec(`reset role; truncate public.${table}; insert into public.${table}(id,status,attempt_count,claimed_at,next_attempt_at,scheduled_for,created_at) values('${id}','${status}',${attempt},${claimed},'${at}','${at}','${at}'); set role service_role;`);
      };
      const finish = async ({ attempt = 1, claimed = at, reference = '1900-01-01T00:01:00Z', succeeded = true, permanent = false, error = null } = {}) => {
        return (await db.query(`select result.* from ${fn}($1::uuid,$2,$3,$4,$5::timestamptz,$6,$7::timestamptz) as result`, [id,succeeded,permanent,error,reference,attempt,claimed])).rows[0];
      };
      await reset();
      eq(await scalar(`select count(*)::int as value from public.claim_${table}(1,'${at}')`),1,`${table}: first claim`);
      eq(await scalar(`select count(*)::int as value from public.claim_${table}(1,'${at}')`),0,`${table}: unexpired claim not repeated`);
      eq(await scalar(`select max(attempt_count) as value from public.claim_${table}(1,'1900-01-01T00:16:00Z')`),2,`${table}: expired claim advances attempt`);
      eq((await finish()).id,null,`${table}: old claim cannot complete newer lease`);
      eq((await finish({attempt:2,claimed:at,reference:'1900-01-01T00:17:00Z'})).id,null,`${table}: wrong claim timestamp denied`);
      eq((await finish({attempt:2,claimed:'1900-01-01T00:16:00Z',reference:'1900-01-01T00:17:00Z'})).status,'sent',`${table}: exact current claim succeeds`);
      eq((await finish({attempt:2,claimed:'1900-01-01T00:16:00Z',reference:'1900-01-01T00:17:00Z'})).id,null,`${table}: terminal replay no-op`);
      await reset(1,'processing',`'${at}'`);
      eq((await finish({reference:'1900-01-01T00:15:00Z'})).id,null,`${table}: expired matching lease denied`);
      eq((await finish({reference:'1899-12-31T23:59:00Z'})).id,null,`${table}: completion before claim denied`);
      await assert.rejects(finish({attempt:null}),/OUTBOX_CLAIM_REQUIRED/); assertions++;
      await assert.rejects(db.query(`select ${fn}($1::uuid,true,false,null,$2::timestamptz)`,[id,at]),/OUTBOX_CLAIM_REQUIRED/); assertions++;
      let row = await finish({succeeded:false,error:'temporary failure'});
      eq(row.status,'retry',`${table}: first transient error retries`);
      eq(await scalar(`select extract(epoch from (next_attempt_at-'1900-01-01T00:01:00Z'::timestamptz))::int as value from public.${table} where id='${id}'`),300,`${table}: first retry five minutes`);
      await scalar(`select count(*)::int as value from public.claim_${table}(1,'1900-01-01T00:06:00Z')`);
      row=await finish({attempt:2,claimed:'1900-01-01T00:06:00Z',reference:'1900-01-01T00:07:00Z',succeeded:false});
      eq(row.status,'retry',`${table}: second transient retry`);
      eq(await scalar(`select extract(epoch from (next_attempt_at-'1900-01-01T00:07:00Z'::timestamptz))::int as value from public.${table} where id='${id}'`),1800,`${table}: second retry thirty minutes`);
      await scalar(`select count(*)::int as value from public.claim_${table}(1,'1900-01-01T00:37:00Z')`);
      row=await finish({attempt:3,claimed:'1900-01-01T00:37:00Z',reference:'1900-01-01T00:38:00Z',succeeded:false,error:'x'.repeat(600)});
      eq(row.status,'failed',`${table}: third transient error fails closed`);
      eq(row.last_error.length,500,`${table}: bounded error text preserved`);
      eq(await scalar(`select count(*)::int as value from public.claim_${table}(1,'1900-01-02T00:00:00Z')`),0,`${table}: failed job not reclaimed`);
      await reset(1,'processing',`'${at}'`);
      eq((await finish({succeeded:false,permanent:true})).status,'failed',`${table}: permanent failure never retries`);
      for (const role of ['anon','authenticated']) {
        await db.exec(`reset role; set role ${role};`);
        await assert.rejects(finish(),/permission denied/); assertions++;
      }
      await db.exec('reset role');
    }
    console.log(`PASS: ${assertions} real PostgreSQL queue/lease assertions; no delivery/network calls`);
  } finally { await db.close(); }
});
