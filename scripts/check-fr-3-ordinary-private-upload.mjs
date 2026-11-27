import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "./fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js";

const db=new PGlite();
const space="0c6cf14c-5f54-46b0-8fc1-6026153ef3ba";
const actor="8d7a00f4-68da-478c-8759-779e4ecc9958";
const document="6567c0ae-dc28-4add-b72b-353589cb43e3";
const nonce="ef0ef55b-526a-4f60-9d01-5342cab3e47f";
const object=n=>"bc2c80ed-4bfa-45af-bd67-"+String(n).padStart(12,"0");
const proof=n=>["personal",actor,"managed-upload-v1",object(n),object(n)+".png"].join("/");
const attachment=["workspaces",space,actor,document,"managed-upload-v1",object(99)+".png"].join("/");
const get=async (q,args=[]) => (await db.query(q,args)).rows[0]?.value;
const state=p=>get("select state as value from mushavo_file_ingest.ordinary_uploads where path=$1",[p]);
const reserve=(id,path,bytes,{verify=false,bucket="payment-proofs",type=null,parent=null}={})=>get(
  "select public.fr32_record_ordinary_upload($1,$2,$3,$4,$5,$6,$7,'image/png',$8,$9) as value",
  [bucket,path,space,actor,id,type,parent,bytes,verify]);
const metadata=(bucket,path,bytes)=>db.query("insert into storage.objects values($1,$2,jsonb_build_object('mimetype','image/png','size',$3::int))",[bucket,path,bytes]);
const link=(path,bytes)=>db.query("insert into payment_records values($1,$2,$3,'image/png',$4)",[space,actor,path,bytes]);

try{
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth;create schema storage;create schema mushavo_file_ingest;
    create function auth.uid() returns uuid language sql as $$select current_setting('test.uid',true)::uuid$$;
    create table public.budget_workspaces(id uuid,owner_id uuid,status text,workspace_type text,legacy_family_id uuid);
    create table public.payment_records(workspace_id uuid,recorded_by uuid,proof_path text,proof_mime_type text,proof_size_bytes bigint);
    create table public.business_documents(id uuid,workspace_id uuid,uploaded_by uuid,parent_type text,parent_id uuid,storage_path text,mime_type text,size_bytes bigint);
    create table public.business_profiles(workspace_id uuid,logo_storage_path text);
    create table storage.objects(bucket_id text,name text,metadata jsonb);`);
  const q=await readFile(new URL("../supabase/diagnostics/security_fr_3_2_ordinary_uploads_staging.sql",import.meta.url),"utf8");
  const first=q.indexOf("create function public.fr32_is_managed_ordinary_upload");
  const last=q.indexOf("CREATE OR REPLACE FUNCTION public.record_managed_subscription_upload");
  await db.exec(q.slice(first,last));
  await db.query("select set_config('test.uid',$1,false)",[actor]);
  for(const n of [1,2,3])assert.equal(await reserve(object(n),proof(n),10485760),true);
  assert.equal(await reserve(object(4),proof(4),3145728),false);
  assert.equal(await reserve(object(1),proof(1),10485760),true);
  assert.equal(await reserve(object(1),proof(1),10485760,{verify:true}),false);
  await assert.rejects(link(proof(1),10485760),/MANAGED_UPLOAD_NOT_READY_FOR_THIS_RECORD/);
  await metadata("payment-proofs",proof(1),10485760);
  assert.equal(await reserve(object(1),proof(1),10485760,{verify:true}),true);
  await assert.rejects(link(proof(1),10485759),/MANAGED_UPLOAD_NOT_READY_FOR_THIS_RECORD/);
  await link(proof(1),10485760);
  assert.equal(await state(proof(1)),"linked");

  const params={bucket:"business-documents",type:"workspace",parent:space};
  assert.equal(await reserve(document,attachment,100,params),true);
  await metadata("business-documents",attachment,100);
  assert.equal(await reserve(document,attachment,100,{...params,verify:true}),true);
  const register=parent=>db.query("insert into business_documents values($1,$2,$3,'workspace',$4,$5,'image/png',100)",[document,space,actor,parent,attachment]);
  await assert.rejects(register(document),/MANAGED_UPLOAD_NOT_READY_FOR_THIS_RECORD/);
  await register(space);
  assert.equal(await state(attachment),"linked");
  await db.query("delete from payment_records where proof_path=$1",[proof(1)]);
  assert.equal(await state(proof(1)),"ready");
  const claim=()=>get("select public.fr32_claim_ordinary_cleanup($1,extract(epoch from now())::bigint,5) as value",[nonce]);
  const [entry]=await claim();
  assert.equal(entry.object_name,proof(1));
  assert.equal(await claim(),null);
  const finished=()=>get("select public.fr32_finish_ordinary_cleanup($1,$2,$3) as value",[entry.bucket_id,entry.object_name,entry.cleanup_token]);
  assert.equal(await finished(),false);
  await db.query("delete from storage.objects where name=$1",[proof(1)]);
  assert.equal(await finished(),true);
  assert.equal(await state(proof(1)),"removed");
  assert.equal(await state(attachment),"linked");
  console.log("Ordinary upload capacity, metadata binding, deletion and cleanup claims passed");
}finally{await db.close();}
