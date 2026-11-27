// Disposable SQL fixtures only; never access a hosted or owner database.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {PGlite}=require(process.env.MUSHAVO_PGLITE_MODULE||'@electric-sql/pglite');
const sql=fs.readFileSync(require('node:path').join(__dirname,'../supabase/diagnostics/security_stage_1_synthetic_export.sql'),'utf8');
const owner='11111111-1111-4111-8111-111111111111';
const outsider='22222222-2222-4222-8222-222222222222';
const w1='33333333-3333-4333-8333-333333333333';
const w2='44444444-4444-4444-8444-444444444444';
const item='55555555-5555-4555-8555-555555555555';
const seed=`CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,encrypted_password text);
CREATE TABLE public.budget_workspaces(id uuid PRIMARY KEY,owner_id uuid,workspace_type text);
CREATE TABLE public.payment_items(id uuid PRIMARY KEY,workspace_id uuid,name text,owner_id uuid,created_by uuid,visibility text,family_id uuid,amount numeric,currency text);
CREATE TABLE public.payment_records(id uuid PRIMARY KEY,payment_item_id uuid,owner_id uuid,recorded_by uuid,visibility text,family_id uuid,amount numeric,currency text);
INSERT INTO auth.users VALUES ('${owner}','audit.owner@example.com','PRIVATE_PASSWORD_SENTINEL'),('${outsider}','audit.outsider@example.com','PRIVATE_PASSWORD_SENTINEL');
INSERT INTO public.budget_workspaces VALUES ('${w1}','${owner}','personal'),('${w2}','${outsider}','personal');
INSERT INTO public.payment_items VALUES ('${item}','${w1}','AUDIT-S135-OWNER-ONLY','${owner}','${owner}','personal',NULL,20,'USD');
INSERT INTO public.payment_records VALUES ('66666666-6666-4666-8666-666666666666','${item}','${owner}','${owner}','personal',NULL,20,'USD');`;
(async()=>{
 const cases=[
  ['matching_seed','',null],
  ['missing_item','DELETE FROM public.payment_items','EXPECTED_SYNTHETIC_PAYMENT_ITEM_REQUIRED'],
  ['extra_user',"INSERT INTO auth.users VALUES ('77777777-7777-4777-8777-777777777777','other@example.com','secret')",'EXPECTED_TWO_SYNTHETIC_AUTH_USERS_REQUIRED'],
  ['wrong_amount','UPDATE public.payment_items SET amount=21','EXPECTED_SYNTHETIC_PAYMENT_ITEM_REQUIRED'],
  ['wrong_workspace_owner',`UPDATE public.budget_workspaces SET owner_id='${outsider}' WHERE id='${w1}'`,'EXPECTED_SYNTHETIC_PAYMENT_ITEM_REQUIRED'],
  ['wrong_record_owner',`UPDATE public.payment_records SET owner_id='${outsider}'`,'EXPECTED_SYNTHETIC_PAID_RECORD_REQUIRED'],
  ['missing_workspace',`DELETE FROM public.budget_workspaces WHERE id='${w2}'`,'EXPECTED_TWO_PERSONAL_WORKSPACES_REQUIRED']
 ];
 let passed=0;
 for(const [name,mutation,expected] of cases){
  const db=new PGlite({database:'postgres'});
  try{
   await db.exec(seed);if(mutation)await db.exec(mutation);
   const runtime=(await db.query("SELECT current_database() AS db, current_setting('server_version_num')::integer / 10000 AS major")).rows[0];
   // Embedded PostgreSQL may use another database/major; keep the owner SQL's
   // native target guard unchanged and explicitly report this fixture adapter.
   const fixtureSql=sql.replace("current_database() <> 'postgres'", "current_database() <> '"+runtime.db.replace(/'/g,"''")+"'")
      .replace("::integer / 10000 <> 17", "::integer / 10000 <> "+runtime.major);
   let results,error;
   try{results=await db.exec(fixtureSql);}catch(e){error=e;await db.exec('ROLLBACK');}
   if(expected){assert.equal(error?.message,expected,name);}
   else{
    if(error)throw Error(name+': '+error.message);
    const json=results.find(r=>r.rows?.[0]?.jsonb_build_object)?.rows[0].jsonb_build_object;
    assert.equal(json.project,'dczlddwbtgvfdujgcitb');assert.equal(json.auth_identities.length,2);
    assert.equal(json.payment_items.length,1);assert.equal(json.payment_records.length,1);
    assert.equal(JSON.stringify(json).includes('PRIVATE_PASSWORD_SENTINEL'),false);
    assert.equal(JSON.stringify(json).includes('encrypted_password'),false);
    assert.equal(json.included_auth_passwords,false);
    const repeated=await db.exec(fixtureSql);assert.deepEqual(repeated.find(r=>r.rows?.[0]?.jsonb_build_object)?.rows[0].jsonb_build_object,json);
    let targetRejected=false;try{await db.exec(fixtureSql.replace("current_database() <> '"+runtime.db+"'", "current_database() <> 'wrong_database'"));}catch(e){targetRejected=e.message==='STAGING_DATABASE_OR_VERSION_MISMATCH';await db.exec('ROLLBACK');}assert.equal(targetRejected,true);
    let blocked=false;try{await db.exec('BEGIN READ ONLY; DELETE FROM public.payment_items;');}catch{blocked=true;await db.exec('ROLLBACK');}assert.equal(blocked,true);
   }
   passed++;
  }finally{await db.close();}
 }
 console.log(JSON.stringify({stage_step:'1.4.2',result:'SYNTHETIC_EXPORT_SQL_FIXTURES_PASS',cases_passed:passed,auth_password_values_omitted:true,repeatable_private_metadata:true,read_only_write_rejection:true,wrong_database_guard_rejection:true,fixture_runtime_database_and_major_adapted:true,hosted_connection:false,native_pg_dump_or_windows_verified:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
