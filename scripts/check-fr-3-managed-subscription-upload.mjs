import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db=new PGlite();
const workspace="0c6cf14c-5f54-46b0-8fc1-6026153ef3ba";
const owner="8d7a00f4-68da-478c-8759-779e4ecc9958";
const payment="7f861fe7-052a-4b23-8e17-91ddae2b280d";
const nonce="ef0ef55b-526a-4f60-9d01-5342cab3e47f";
const file=n=>["workspaces",workspace,owner,"managed-proof-v1",
  "120222fa-8efb-4bdc-bc3f-6904758c663b","bc2c80ed-4bfa-45af-bd67-"+String(n).padStart(12,"0")+".pdf"].join("/");
const get=async (q,args=[]) => (await db.query(q,args)).rows[0]?.value;
const reserve=(p,size,verify=false)=>get("select public.record_managed_subscription_upload($1,'application/pdf',$2,$3) as value",[p,size,verify]);
const state=p=>get("select state as value from mushavo_file_ingest.subscription_uploads where path=$1",[p]);

try {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema mushavo_file_ingest; create schema storage; create schema auth;
    create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
    create table public.profiles(id uuid primary key,account_status text);
    create table public.budget_workspaces(id uuid primary key,owner_id uuid,status text);
    create table public.subscription_payments(id uuid primary key,workspace_id uuid,submitted_by uuid);
    create table public.subscription_payment_proofs(payment_id uuid,storage_path text,mime_type text,size_bytes bigint,uploaded_by uuid);
    create table storage.objects(bucket_id text,name text,metadata jsonb);`);
  const ddl=await readFile(new URL("../supabase/diagnostics/security_fr_3_2_managed_subscription_upload_staging.sql",import.meta.url),"utf8");
  await db.exec(ddl.slice(ddl.indexOf("create table mushavo_file_ingest.subscription_uploads"),
    ddl.indexOf("update mushavo_email_install.rollout_control")));
  await db.query("insert into public.profiles values($1,'active')",[owner]);
  await db.query("insert into public.budget_workspaces values($1,$2,'active')",[workspace,owner]);
  await db.query("insert into public.subscription_payments values($1,$2,$3)",[payment,workspace,owner]);
  await db.query("select set_config('test.uid',$1,false)",[owner]);
  for (const n of [1,2,3]) assert.equal(await reserve(file(n),10485760),true);
  assert.equal(await reserve(file(4),3145728),false);
  assert.equal(await reserve(file(1),10485760),true);
  assert.equal(await reserve(file(1),10485759),false);
  assert.equal(await reserve(file(1),10485760,true),false);

  const link=p=>db.query("insert into public.subscription_payment_proofs values($1,$2,'application/pdf',10485760,$3)",[payment,p,owner]);
  await assert.rejects(link(file(1)),/MANAGED_SUBSCRIPTION_PROOF_NOT_READY/);
  await db.query("insert into storage.objects values('subscription-proofs',$1,jsonb_build_object('mimetype','application/pdf','size',10485760))",[file(1)]);
  assert.equal(await reserve(file(1),10485760,true),true);
  await link(file(1));
  assert.equal(await state(file(1)),"linked");
  assert.equal(await reserve(file(4),3145728),true);
  await db.exec("update mushavo_file_ingest.subscription_uploads set expires_at=now()-interval '1 minute'");
  const claim=()=>get("select public.claim_managed_subscription_cleanup($1,extract(epoch from now())::bigint,5) as value",[nonce]);
  const first=await claim();
  assert.deepEqual(first.map(x=>x.object_name).sort(),[file(2),file(3),file(4)]);
  assert.equal(await state(file(1)),"linked");
  assert.equal(await claim(),null);
  await assert.rejects(link(file(2)),/MANAGED_SUBSCRIPTION_PROOF_NOT_READY/);
  assert.equal(await get("select public.finish_managed_subscription_cleanup($1,$2) as value",
    [first[0].object_name,first[0].cleanup_token]),true);
  assert.equal(await state(first[0].object_name),"removed");
  assert.equal(await get("select has_function_privilege('authenticated','public.record_managed_subscription_upload(text,text,integer,boolean)','execute') as value"),false);
  console.log("Managed subscription reservations, linking, quota, and cleanup state verified");
} finally { await db.close(); }
