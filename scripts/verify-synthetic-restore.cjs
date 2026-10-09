// Embedded application replay and private-package failure fixtures; no native restore claim.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.MUSHAVO_PGLITE_MODULE||'@electric-sql/pglite');
const helper=require('./prepare-synthetic-restore.cjs');
const owner='11111111-1111-4111-8111-111111111111',outsider='22222222-2222-4222-8222-222222222222';
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
 const db=new PGlite();let expected;let migrations=0;
 try{
  // Native target/version/path guard and pgcrypto installation cannot run in
  // PostgreSQL 18 embedded fixtures. Published native SQL is not altered.
  const setup=helper.bootstrap.replace(/DO \$target\$[\s\S]*?END \$target\$;/,'-- Native target guard requires owner Windows run.')
    .replace('CREATE ROLE "postgres" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;','-- Embedded admin already exists.')
    .replace('CREATE EXTENSION pgcrypto WITH SCHEMA extensions;','-- Embedded gen_random_uuid is built in; pgcrypto is not installed here.')
    .replace(/CREATE TEMP TABLE mushavo_restore_\w+\(data jsonb\) ON COMMIT DROP;/g,'');
  await db.exec(setup);
  // Hosted public-table grants are supplied by Supabase defaults, absent from
  // a migration-only embedded database. The native restore uses archived ACLs.
  await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated;');
  await db.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon,authenticated,service_role;');
  for(const f of fs.readdirSync(path.join(__dirname,'../supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()){
   let sql=fs.readFileSync(path.join(__dirname,'../supabase/migrations',f),'utf8').replace(/create extension if not exists pgcrypto;/i,'-- Embedded extension adapter.');
   await db.exec(sql);migrations++;
  }
  assert.equal(migrations,51);
  await db.exec(`INSERT INTO auth.users(id,email) VALUES ('${owner}','audit.owner@example.com'),('${outsider}','audit.outsider@example.com');`);
  await db.query("SELECT set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:owner,role:'authenticated',email:'audit.owner@example.com'})]);
  const workspace=(await db.query('SELECT id FROM public.budget_workspaces WHERE owner_id=$1 AND workspace_type=\'personal\'',[owner])).rows[0]?.id;assert.ok(workspace);
  await db.query(`SELECT * FROM public.create_completed_one_time_payment($1,'AUDIT-S135-OWNER-ONLY','Other',20,'USD',current_date,'Cash',NULL,NULL,NULL,NULL,NULL,NULL,NULL)`,[workspace]);
  const source=fs.readFileSync(path.join(__dirname,'../supabase/diagnostics/security_stage_1_synthetic_export.sql'),'utf8').replace('::integer / 10000 <> 17','::integer / 10000 <> 18');
  expected=(await db.exec(source)).find(r=>r.rows?.[0]?.jsonb_build_object)?.rows[0].jsonb_build_object;assert.ok(expected);
  async function check(mutation,code){
   await db.exec('BEGIN; CREATE TEMP TABLE mushavo_restore_expected(data jsonb) ON COMMIT DROP; CREATE TEMP TABLE mushavo_restore_result(data jsonb) ON COMMIT DROP;');
   await db.query('INSERT INTO mushavo_restore_expected VALUES($1::jsonb)',[JSON.stringify(expected)]);
   if(mutation)await db.exec(mutation);
   let error,results;try{results=await db.exec(helper.validation);}catch(e){error=e;}
   if(code){assert.equal(error?.message,code);}else{if(error)throw Error('valid restored state: '+error.message);const r=results.find(x=>x.rows?.[0]?.data)?.rows[0].data;assert.equal(r.result,'SELECTED_RESTORED_VALUES_AND_ROLE_BOUNDARIES_PASS');assert.equal(r.effective_access_checks,13);assert.equal(r.noop_updates_rolled_back,true);}
   await db.exec('ROLLBACK');
  }
  await check('',null);
  // Demonstrate that a real broad policy fails, rather than treating a broken
  // positive control or invalid identity as denial evidence.
  await check('CREATE POLICY audit_leak ON public.payment_items FOR SELECT TO authenticated USING(true);','RESTORED_ITEM_READ_BOUNDARY_FAILED');
  await check('REVOKE UPDATE ON public.payment_items FROM authenticated;','RESTORED_POSITIVE_CONTROL_GRANTS_MISSING');
  await check('ALTER TABLE public.payment_items DISABLE ROW LEVEL SECURITY;','RESTORED_RELATION_OR_RLS_FLAGS_MISMATCH');
  await check("SET LOCAL session_replication_role=replica; UPDATE public.payment_records SET amount=21; SET LOCAL session_replication_role=origin;",'RESTORED_RECORD_VALUES_MISMATCH');
  await check('ALTER ROLE authenticated BYPASSRLS;','TEST_ROLE_PRIVILEGE_MISMATCH');
  await check('ALTER TABLE public.payment_items ADD COLUMN audit_fixture_extra text;','RESTORED_ITEM_COLUMNS_MISMATCH');
 }finally{await db.close();}
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-restore-fixture-'));const source=path.join(root,'SyntheticSource-fixture'),run=path.join(root,'SyntheticRestore-fixture');fs.mkdirSync(source);fs.mkdirSync(run);
 try{
  fs.writeFileSync(path.join(source,'staging-public.dump'),'SYNTHETIC ARCHIVE PLACEHOLDER; native format deliberately not tested');
  for(const n of ['source-before.json','source-after.json'])fs.writeFileSync(path.join(source,n),JSON.stringify(expected));
  fs.writeFileSync(path.join(source,'synthetic-attachment.txt'),'Public dummy only');
  fs.writeFileSync(path.join(source,'staging-public.toc.txt'),'1; 2615 2200 SCHEMA - public postgres\n2; 0 1 TABLE DATA public payment_items postgres\n3; 0 2 TABLE DATA public payment_records postgres\n4; 0 3 TABLE DATA public budget_workspaces postgres\n5; 0 4 PUBLICATION TABLE public payment_items postgres\n');
  const names=['staging-public.dump','source-before.json','source-after.json','staging-public.toc.txt','synthetic-attachment.txt'];
  const manifest={summary:{stage_step:'1.4.2',result:'SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS',project:'dczlddwbtgvfdujgcitb',run_directory:source},restore_target:{root},files:names.map(name=>({name,bytes:fs.statSync(path.join(source,name)).size,sha256:sha(path.join(source,name))}))};
  const receipt=path.join(source,'source-manifest.json');fs.writeFileSync(receipt,JSON.stringify(manifest));
  const result=helper.prepare(source,run);assert.equal(result.files_checked,5);assert.equal(result.excluded_schema_or_provider_toc_entries,2);
  assert.ok(fs.readFileSync(path.join(run,'restore.toc.txt'),'utf8').includes('; excluded for native drill: 5;'));
  fs.appendFileSync(path.join(source,'synthetic-attachment.txt'),'changed');assert.throws(()=>helper.inspect(source),/SOURCE_HASH_OR_SIZE_MISMATCH/);
  fs.writeFileSync(path.join(source,'synthetic-attachment.txt'),'Public dummy only');
  manifest.files[0].name='../outside';fs.writeFileSync(receipt,JSON.stringify(manifest));assert.throws(()=>helper.inspect(source),/SOURCE_FILE_RECORD_INVALID/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
 console.log(JSON.stringify({stage_step:'1.4.3',result:'SYNTHETIC_RESTORE_FIXTURES_PASS',application_migrations_replayed:migrations,effective_access_checks_in_positive_fixture:13,application_failure_cases:6,private_source_hash_and_path_failure_cases:2,noop_effects_rolled_back:true,embedded_native_guard_and_extension_adapted:true,embedded_hosted_default_acl_adapted:true,native_archive_or_windows_execution_verified:false,hosted_connection:false}));
})().catch(e=>{console.error(e.message);process.exitCode=1;});
