import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { reconcileBusinessUploads } from "../supabase/functions/_shared/business-upload-cleanup.mjs";

const [host, pgPackage] = process.argv.slice(2);
assert.ok((host?.startsWith("/") || host === "127.0.0.1") && pgPackage,
  "Use a local test server and the path to the pg package");
const { Client } = createRequire(import.meta.url)(resolve(pgPackage));
const clients = [];
const connect = async () => {
  const client = new Client({host, port: 55432, database: "mushavo_lifecycle_test",
    statement_timeout: 5000, connectionTimeoutMillis: 4000});
  clients.push(client);
  await client.connect();
  return client;
};
const checks = [];
const pass = async (name, run) => { await run(); checks.push(name); };

try {
  const db = await connect(), first = await connect(), second = await connect();
  const scalar = async (q, args = [], client = db) => (await client.query(q,args)).rows[0]?.value;
  assert.equal(await scalar("select to_regclass('public.business_documents') is null as value"), true, "Empty test database required");
  await db.query(`
    create role anon;
    create role authenticated;
    create role service_role;
    create schema storage;
    create table storage.objects (bucket_id text not null, name text not null, metadata jsonb,
      primary key(bucket_id,name));
    create table public.business_documents (id uuid primary key, workspace_id uuid not null,
      uploaded_by uuid not null, storage_path text not null unique, mime_type text not null, size_bytes bigint not null,
      status text not null default 'active');
  `);
  const source = await readFile(new URL("../supabase/diagnostics/security_fr_3_2_business_ingestion_lifecycle_candidate.sql",import.meta.url),"utf8");
  await db.query(source);

  const ws = randomUUID(), outsider = randomUUID(), unknown = randomUUID(), scope = "mushavo_file_ingest";
  const uploader = randomUUID(), MIME = "application/pdf";
  const make = (bytes, workspace = ws) => {
    const id = randomUUID(), path = `workspaces/${workspace}/${uploader}/${id}/${randomUUID()}.pdf`;
    return {id,path,bytes,workspace};
  };
  const w = [ws,randomUUID(),randomUUID(),randomUUID(),randomUUID()];
  const setLimits = (workspace,count,bytes,flight) => db.query(
    `insert into ${scope}.workspace_limits(workspace_id,max_files,max_bytes,max_in_flight) values($1,$2,$3,$4)`,
    [workspace,count,bytes,flight]);
  await setLimits(w[0],2,1000,2);
  await setLimits(w[1],4,1000,1);
  await setLimits(w[2],4,1000,3);
  await setLimits(w[3],2,1000,2);
  await setLimits(w[4],3,1000,3);
  const reserve = (f, client, mime = MIME, user = uploader) => scalar(
    `select ${scope}.reserve_business_upload($1,$2,$3,$4,$5,$6) as value`,
    [f.workspace,user,f.id,f.path,mime,f.bytes],client);
  const verify = f => scalar(`select ${scope}.verify_business_upload($1) as value`,[f.path]);
  const claim = async (workspace,limit = 20,client = db) => (await client.query(
    `select * from ${scope}.claim_business_cleanup($1,$2)`, [workspace,limit])).rows;
  const finish = (path,token) => scalar(`select ${scope}.finish_business_cleanup($1,$2) as value`,[path,token]);
  const state = f => scalar(`select state as value from ${scope}.business_uploads where object_name=$1`,[f.path]);
  const pretendStore = (f,mime = MIME,bytes = f.bytes) => db.query(
    "insert into storage.objects values ('business-documents',$1,jsonb_build_object('mimetype',$2::text,'size',$3::int))",
    [f.path,mime,bytes]);
  const register = (f,client = db, user = uploader) => client.query(
    "insert into public.business_documents (id,workspace_id,uploaded_by,storage_path,mime_type,size_bytes) values($1,$2,$3,$4,$5,$6)",
    [f.id,f.workspace,user,f.path,MIME,f.bytes]);
  const age = (f, column = "expires_at") => db.query(
    `update ${scope}.business_uploads set ${column}=clock_timestamp()-interval '1 second' where object_name=$1`, [f.path]);
  const a = make(600), b = make(400), f = make(70,w[1]), e = make(60,w[1]);
  const forgotten = make(75,w[2]), unregistered = make(80,w[2]), committed = make(50,w[2]);

  await pass("service-only database functions and manifest", async () => {
    for (const role of ["anon","authenticated"]) {
      assert.equal(await scalar(`select has_schema_privilege($1,'${scope}','usage') as value`,[role]),false);
      assert.equal(await scalar(`select has_function_privilege($1,'${scope}.reserve_business_upload(uuid,uuid,uuid,text,text,integer)','execute') as value`,[role]),false);
    }
    assert.equal(await scalar(`select has_function_privilege('service_role','${scope}.reserve_business_upload(uuid,uuid,uuid,text,text,integer)','execute') as value`),true);
  });

  await pass("immutable reservation and exact quota boundary", async () => {
    assert.equal(await reserve(make(1,unknown)),false);
    assert.equal(await reserve(a),true);
    assert.equal(await reserve(a),true);
    assert.equal(await reserve({...a,bytes:599}),false);
    assert.equal(await reserve(a,db,"image/png"),false);
    assert.equal(await reserve(a,db,MIME,outsider),false);
    assert.equal(await reserve(make(401)),false);
    assert.equal(await reserve(b),true);
    assert.equal(await reserve(make(1)),false);
  });

  await pass("capacity blocks a second in-flight upload and permits it after registration", async () => {
    assert.equal(await reserve(f),true);
    assert.equal(await reserve(e),false);
    await assert.rejects(register(f), /VERIFIED_BUSINESS_UPLOAD_REQUIRED/);
    assert.equal(await verify(f),false);
    await pretendStore(f,"image/png");
    assert.equal(await verify(f),false);
    await db.query("update storage.objects set metadata=jsonb_build_object('mimetype',$1::text,'size',70) where name=$2",[MIME,f.path]);
    assert.equal(await verify(f),true);
    await assert.rejects(register(f,db,outsider), /VERIFIED_BUSINESS_UPLOAD_REQUIRED/);
    await register(f);
    assert.equal(await state(f),"registered");
    assert.equal(await reserve(e),true);
  });

  await pass("transaction rollback keeps an uncommitted registration eligible for cleanup", async () => {
    for (const proof of [forgotten,unregistered,committed]) assert.equal(await reserve(proof),true);
    for (const proof of [unregistered,committed]) {
      await pretendStore(proof);
      assert.equal(await verify(proof),true);
    }
    await first.query("begin");
    await register(unregistered,first);
    await first.query("rollback");
    assert.equal(await state(unregistered),"verified");
    await register(committed);
    await age(committed);
    await age(unregistered);
    await age(forgotten);
  });

  await pass("worker retains an unconfirmed removal and frees capacity only after absence is confirmed", async () => {
    const tasks = new Map();
    const adapters = {
      claim: async (workspace,limit) => {
        const rows = await claim(workspace,limit);
        for (const task of rows) tasks.set(task.object_name, task.cleanup_token);
        return rows;
      },
      remove: async (bucket,path) => {
        assert.equal(bucket,"business-documents");
        if (path === unregistered.path) return {data:[],error:null};
        assert.equal(path,forgotten.path);
        return {data:[],error:null};
      },
      finish,
    };
    assert.deepEqual(await reconcileBusinessUploads(w[2],adapters),{claimed:2,removed:1,retry:1});
    assert.equal(await state(forgotten),"removed");
    assert.equal(await state(unregistered),"removing");
    assert.equal(await state(committed),"registered");
    assert.equal(await scalar("select count(*)::int as value from storage.objects where name=$1",[committed.path]),1);
    assert.deepEqual(await claim(w[2]),[]);
    await assert.rejects(register(unregistered), /VERIFIED_BUSINESS_UPLOAD_REQUIRED/);
    await age(unregistered,"cleanup_lease_until");
    const old = tasks.get(unregistered.path);
    adapters.remove = async (_bucket,path) => {
      assert.equal(path,unregistered.path);
      assert.equal(await finish(path,old),false);
      // Models acknowledged Storage API removal in the disposable database.
      await db.query("delete from storage.objects where bucket_id='business-documents' and name=$1",[path]);
      return {data:[{name:path}],error:null};
    };
    assert.deepEqual(await reconcileBusinessUploads(w[2],adapters),{claimed:1,removed:1,retry:0});
    assert.equal(await state(unregistered),"removed");
    assert.equal(await reserve(unregistered),false);
    assert.equal(await scalar(`select cleanup_attempts as value from ${scope}.business_uploads where object_name=$1`,[unregistered.path]),2);
  });

  await pass("an older document reference prevents orphan cleanup", async () => {
    const legacy = make(81,unknown);
    await register(legacy);
    await setLimits(unknown,3,1000,3);
    assert.equal(await reserve(legacy),true);
    await age(legacy);
    assert.deepEqual(await claim(unknown),[]);
    assert.equal(await state(legacy),"reserved");
  });

  await pass("parallel PostgreSQL sessions serialize reservations for the same workspace", async () => {
    const one = make(700,w[3]), two = make(400,w[3]);
    await first.query("begin");
    assert.equal(await reserve(one,first),true);
    const secondReservation = reserve(two,second);
    let waiting = false;
    for (let attempt = 0; attempt < 40 && !waiting; attempt++) {
      waiting = await scalar("select coalesce(wait_event_type='Lock',false) as value from pg_stat_activity where pid=$1",
        [second.processID]);
      if (!waiting) await pause(25);
    }
    assert.equal(waiting,true);
    await first.query("commit");
    assert.equal(await secondReservation,false);
    assert.equal(await reserve(make(1,w[3])),true);
    assert.equal(await reserve(make(1,w[3])),false);
  });

  await pass("repeatable-read reservations fail closed on a stale snapshot", async () => {
    const one = make(700,w[4]), two = make(400,w[4]);
    await second.query("begin isolation level repeatable read");
    assert.equal(await scalar(`select max_files as value from ${scope}.workspace_limits where workspace_id=$1`,[w[4]],second),3);
    assert.equal(await reserve(one,first),true);
    await assert.rejects(reserve(two,second),{code:"40001"});
    await second.query("rollback");
  });

  await pass("cleanup workers skip a leased row while it is locked by another worker", async () => {
    const lease = make(50,w[4]);
    assert.equal(await reserve(lease),true);
    await age(lease);
    await first.query("begin");
    assert.equal((await claim(w[4],20,first))[0]?.object_name,lease.path);
    assert.deepEqual(await claim(w[4],20,second),[]);
    await first.query("commit");
    assert.deepEqual(await claim(w[4]),[]);
  });

  await pass("registration in progress is invisible to cleanup and survives commit", async () => {
    const item = make(99,w[2]);
    assert.equal(await reserve(item),true);
    await pretendStore(item);
    assert.equal(await verify(item),true);
    await db.query(`update ${scope}.business_uploads set expires_at=clock_timestamp()+interval '1.5 seconds' where object_name=$1`,[item.path]);
    await first.query("begin");
    await register(item,first);
    await pause(1600);
    assert.deepEqual(await claim(w[2],20,second),[]);
    await first.query("commit");
    assert.deepEqual(await claim(w[2]),[]);
    assert.equal(await state(item),"registered");
  });

  await pass("unsafe cleanup responses never reach the file removal adapter", async () => {
    const malformed = {claim:async () => [{object_name:f.path,cleanup_token:randomUUID()}],
      remove:async () => { assert.fail("unexpected removal"); },finish};
    await assert.rejects(reconcileBusinessUploads(w[0],malformed),/Invalid cleanup claim/);
  });

  console.log(JSON.stringify({result:"BUSINESS_UPLOAD_LIFECYCLE_DISPOSABLE_POSTGRES_PASS",
    postgres:await scalar("select current_setting('server_version') as value"),checks,exit_code:0},null,2));
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
}
