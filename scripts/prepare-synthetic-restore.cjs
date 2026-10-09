// 1.4.3: private local package inspection/SQL generation; no network/database calls.
const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
class AuditError extends Error{}
function need(ok,code){if(!ok)throw new AuditError(code);}
const names=['staging-public.dump','source-before.json','source-after.json','staging-public.toc.txt','synthetic-attachment.txt'];
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const roles=['postgres','anon','authenticated','service_role','authenticator','dashboard_user','pgbouncer','supabase_admin','supabase_auth_admin','supabase_storage_admin','supabase_realtime_admin','supabase_read_only_user','supabase_replication_admin','supabase_functions_admin','supabase_etl_admin'];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
function inspect(source){
 const receipt=path.join(source,'source-manifest.json');need(fs.lstatSync(receipt).isFile()&&!fs.lstatSync(receipt).isSymbolicLink(),'MANIFEST_NOT_ORDINARY_FILE');
 const m=json(receipt);need(m.summary?.stage_step==='1.4.2'&&m.summary.result==='SYNTHETIC_PUBLIC_EXPORT_AND_OFFLINE_READ_PASS'&&m.summary.project==='dczlddwbtgvfdujgcitb','SOURCE_RECEIPT_SCOPE_MISMATCH');
 need(path.resolve(m.summary.run_directory)===path.resolve(source)&&path.resolve(m.restore_target.root)===path.dirname(path.resolve(source)),'SOURCE_PATH_RECEIPT_MISMATCH');
 need(Array.isArray(m.files)&&m.files.length===names.length&&new Set(m.files.map(f=>f.name)).size===names.length,'SOURCE_FILE_SET_MISMATCH');
 for(const f of m.files){need(names.includes(f.name)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&/^[0-9a-f]{64}$/i.test(f.sha256),'SOURCE_FILE_RECORD_INVALID');const p=path.join(source,f.name);const st=fs.lstatSync(p);need(st.isFile()&&!st.isSymbolicLink()&&st.size===f.bytes&&hash(p)===f.sha256.toLowerCase(),'SOURCE_HASH_OR_SIZE_MISMATCH');}
 need(hash(path.join(source,'source-before.json'))===hash(path.join(source,'source-after.json')),'SOURCE_PROBES_DIFFER');
 const e=json(path.join(source,'source-before.json'));
 need(e.project==='dczlddwbtgvfdujgcitb'&&e.synthetic_guard_passed===true&&e.included_auth_passwords===false,'SOURCE_METADATA_SCOPE_MISMATCH');
 need(e.auth_identities?.length===2&&new Set(e.auth_identities.map(x=>x.id)).size===2&&e.auth_identities.every(x=>uuid.test(x.id)&&Object.keys(x).sort().join(',')==='email,id')&&['audit.owner@example.com','audit.outsider@example.com'].every(email=>e.auth_identities.some(x=>x.email===email)),'SYNTHETIC_IDENTITIES_INVALID');
 const owner=e.auth_identities.find(x=>x.email==='audit.owner@example.com').id;
 need(e.payment_items?.length===1&&e.payment_records?.length===1&&e.workspaces?.length===2,'SYNTHETIC_ROW_COUNTS_INVALID');
 const i=e.payment_items[0],r=e.payment_records[0];
 need(uuid.test(i.id)&&uuid.test(r.id)&&uuid.test(i.workspace_id)&&i.name==='AUDIT-S135-OWNER-ONLY'&&i.owner_id===owner&&i.created_by===owner&&i.visibility==='personal'&&i.family_id===null&&Number(i.amount)===20&&i.currency==='USD','SYNTHETIC_ITEM_SCOPE_INVALID');
 need(r.payment_item_id===i.id&&r.owner_id===owner&&r.recorded_by===owner&&r.visibility==='personal'&&r.family_id===null&&Number(r.amount)===20&&r.currency==='USD','SYNTHETIC_RECORD_SCOPE_INVALID');
 need(new Set(e.workspaces.map(w=>w.owner_id)).size===2&&e.workspaces.every(w=>uuid.test(w.id)&&w.workspace_type==='personal'&&e.auth_identities.some(u=>u.id===w.owner_id))&&e.workspaces.some(w=>w.id===i.workspace_id&&w.owner_id===owner),'SYNTHETIC_WORKSPACES_INVALID');
 need(Array.isArray(e.public_relations)&&e.public_relations.length>0&&e.policy_roles?.every(r=>r==='PUBLIC'||roles.includes(r)),'RELATION_OR_POLICY_ROLE_METADATA_INVALID');
 const toc=fs.readFileSync(path.join(source,'staging-public.toc.txt'),'utf8').replace(/^\uFEFF/,'');let excluded=0;
 const selected=toc.split(/\r?\n/).map(line=>{
  const entry=line.match(/^\d+;\s+\d+\s+\d+\s+(.*)$/);if(!entry)return line;
  const desc=entry[1];
  need(!/^(DATABASE(?: PROPERTIES)?|EXTENSION|FOREIGN TABLE|SERVER|FOREIGN DATA WRAPPER|USER MAPPING|SUBSCRIPTION)\b/.test(desc),'UNSUPPORTED_ARCHIVE_DEPENDENCY');
  need(!/^TABLE DATA (?!public )/.test(desc),'NON_PUBLIC_ARCHIVE_DATA_REJECTED');
  // Public already exists in initdb. Realtime/event triggers are provider scope.
  if(/^SCHEMA - public /.test(desc)||/^(PUBLICATION|EVENT TRIGGER)\b/.test(desc)){excluded++;return '; excluded for native drill: '+line;}
  return line;
 }).join('\n');
 for(const t of ['payment_items','payment_records','budget_workspaces'])need(new RegExp('TABLE DATA public '+t+' ').test(selected),'SELECTED_TABLE_DATA_MISSING');
 return {manifest:m,expected:e,toc:selected,excluded};
}
const bootstrap=`-- 1.4.3 native adapter: no hosted Auth/Storage service or production credentials.
SET LOCAL statement_timeout='120s'; SET LOCAL lock_timeout='5s';
DO $target$ BEGIN
 IF current_user <> 'mushavo_restore_admin' OR current_database()<>'postgres'
 OR current_setting('data_directory')<>current_setting('mushavo.restore.expected_data')
 OR current_setting('port')<>'55439' OR inet_server_addr()<>inet '127.0.0.1'
 OR current_setting('listen_addresses')<>'127.0.0.1'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170011 AND 179999
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','storage')) THEN
 RAISE EXCEPTION 'LOCAL_TARGET_IDENTITY_OR_EMPTY_SCOPE_MISMATCH'; END IF;
END $target$;
${roles.map(r=>`CREATE ROLE "${r}" NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;`).join('\n')}
CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}',created_at timestamptz DEFAULT now(),last_sign_in_at timestamptz);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'sub','')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$ SELECT nullif(auth.jwt()->>'role','') $$;
GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text,owner uuid,owner_id text,metadata jsonb,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)] $$;
CREATE TEMP TABLE mushavo_restore_expected(data jsonb) ON COMMIT DROP;
CREATE TEMP TABLE mushavo_restore_result(data jsonb) ON COMMIT DROP;
`;
const validation=`-- 1.4.3 selected restored-data and effective grant/RLS checks.
SET LOCAL statement_timeout='120s'; SET LOCAL TIME ZONE 'UTC';
DO $checks$
DECLARE e jsonb; actual jsonb; owner_id uuid; outsider_id uuid; item_id uuid; record_id uuid; workspace_id uuid;
 label text; db_role text; uid uuid; mail text; n bigint; denied boolean; check_count int:=0;
BEGIN
 SELECT data INTO STRICT e FROM mushavo_restore_expected;
 SELECT (v->>'id')::uuid INTO owner_id FROM jsonb_array_elements(e->'auth_identities') v WHERE v->>'email'='audit.owner@example.com';
 SELECT (v->>'id')::uuid INTO outsider_id FROM jsonb_array_elements(e->'auth_identities') v WHERE v->>'email'='audit.outsider@example.com';
 item_id:=(e->'payment_items'->0->>'id')::uuid; record_id:=(e->'payment_records'->0->>'id')::uuid; workspace_id:=(e->'payment_items'->0->>'workspace_id')::uuid;
 SELECT jsonb_agg(jsonb_build_object('name',c.relname,'kind',c.relkind,'rls_enabled',c.relrowsecurity,'rls_forced',c.relforcerowsecurity) ORDER BY c.relname)
 INTO actual FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m','S','f')
 AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_class'::regclass AND d.objid=c.oid AND d.deptype='e');
 IF actual IS DISTINCT FROM e->'public_relations' THEN RAISE EXCEPTION 'RESTORED_RELATION_OR_RLS_FLAGS_MISMATCH'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('anon','authenticated') AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN RAISE EXCEPTION 'TEST_ROLE_PRIVILEGE_MISMATCH'; END IF;
 IF NOT has_table_privilege('authenticated','public.payment_items','SELECT') OR NOT has_table_privilege('authenticated','public.payment_items','UPDATE') OR NOT has_table_privilege('authenticated','public.payment_records','SELECT') THEN RAISE EXCEPTION 'RESTORED_POSITIVE_CONTROL_GRANTS_MISSING'; END IF;
 FOREACH label IN ARRAY ARRAY['owner','outsider','anonymous'] LOOP
   db_role:=CASE WHEN label='anonymous' THEN 'anon' ELSE 'authenticated' END;
   uid:=CASE WHEN label='owner' THEN owner_id WHEN label='outsider' THEN outsider_id ELSE NULL END;
   mail:=CASE WHEN label='owner' THEN 'audit.owner@example.com' WHEN label='outsider' THEN 'audit.outsider@example.com' ELSE NULL END;
   PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role',db_role,'email',mail)::text,true);
   EXECUTE format('SET LOCAL ROLE %I',db_role);
   IF current_user<>db_role OR auth.uid() IS DISTINCT FROM uid OR auth.role() IS DISTINCT FROM db_role THEN RAISE EXCEPTION 'EMULATED_IDENTITY_MISMATCH'; END IF;
   BEGIN SELECT count(*) INTO n FROM public.payment_items WHERE id=item_id; EXCEPTION WHEN insufficient_privilege THEN IF label='owner' THEN RAISE; END IF; n:=0; END;
   IF n<>(CASE WHEN label='owner' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'RESTORED_ITEM_READ_BOUNDARY_FAILED'; END IF; check_count:=check_count+1;
   BEGIN SELECT count(*) INTO n FROM public.payment_records WHERE id=record_id; EXCEPTION WHEN insufficient_privilege THEN IF label='owner' THEN RAISE; END IF; n:=0; END;
   IF n<>(CASE WHEN label='owner' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'RESTORED_RECORD_READ_BOUNDARY_FAILED'; END IF; check_count:=check_count+1;
   BEGIN SELECT count(*) INTO n FROM public.budget_workspaces WHERE id=workspace_id; EXCEPTION WHEN insufficient_privilege THEN IF label='owner' THEN RAISE; END IF; n:=0; END;
   IF n<>(CASE WHEN label='owner' THEN 1 ELSE 0 END) THEN RAISE EXCEPTION 'RESTORED_WORKSPACE_READ_BOUNDARY_FAILED'; END IF; check_count:=check_count+1;
   -- Always roll back the no-op write and any trigger/audit/timestamp effects.
   denied:=false;
   BEGIN
     BEGIN UPDATE public.payment_items SET name='AUDIT-S135-OWNER-ONLY' WHERE id=item_id; GET DIAGNOSTICS n=ROW_COUNT;
     EXCEPTION WHEN insufficient_privilege THEN denied:=true; n:=0; END;
     IF label='owner' AND (denied OR n<>1) THEN RAISE EXCEPTION 'RESTORED_OWNER_UPDATE_CONTROL_FAILED'; END IF;
     IF label<>'owner' AND n<>0 THEN RAISE EXCEPTION 'RESTORED_OUTSIDER_UPDATE_BOUNDARY_FAILED'; END IF;
     RAISE EXCEPTION USING ERRCODE='MZ001',MESSAGE='ROLLBACK_SYNTHETIC_NOOP_ONLY';
   EXCEPTION WHEN SQLSTATE 'MZ001' THEN NULL; END;
   check_count:=check_count+1;
   IF label='outsider' THEN
     SELECT count(*) INTO n FROM public.budget_workspaces w WHERE w.owner_id=uid AND w.workspace_type='personal';
     IF n<>1 THEN RAISE EXCEPTION 'OUTSIDER_OWN_WORKSPACE_CONTROL_FAILED'; END IF; check_count:=check_count+1;
   END IF;
   RESET ROLE;
 END LOOP;
 PERFORM set_config('request.jwt.claims','{}',true);
 SELECT jsonb_agg(to_jsonb(i) ORDER BY id) INTO actual FROM public.payment_items i;
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(actual->0) k) IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e->'payment_items'->0) k) THEN RAISE EXCEPTION 'RESTORED_ITEM_COLUMNS_MISMATCH'; END IF;
 IF actual IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM jsonb_populate_recordset(NULL::public.payment_items,e->'payment_items') x) THEN RAISE EXCEPTION 'RESTORED_ITEM_VALUES_MISMATCH'; END IF;
 SELECT jsonb_agg(to_jsonb(r) ORDER BY id) INTO actual FROM public.payment_records r;
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(actual->0) k) IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e->'payment_records'->0) k) THEN RAISE EXCEPTION 'RESTORED_RECORD_COLUMNS_MISMATCH'; END IF;
 IF actual IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM jsonb_populate_recordset(NULL::public.payment_records,e->'payment_records') x) THEN RAISE EXCEPTION 'RESTORED_RECORD_VALUES_MISMATCH'; END IF;
 SELECT jsonb_agg(to_jsonb(w) ORDER BY id) INTO actual FROM public.budget_workspaces w;
 IF (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(actual->0) k) IS DISTINCT FROM (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(e->'workspaces'->0) k) THEN RAISE EXCEPTION 'RESTORED_WORKSPACE_COLUMNS_MISMATCH'; END IF;
 IF actual IS DISTINCT FROM (SELECT jsonb_agg(to_jsonb(x) ORDER BY id) FROM jsonb_populate_recordset(NULL::public.budget_workspaces,e->'workspaces') x) THEN RAISE EXCEPTION 'RESTORED_WORKSPACE_VALUES_MISMATCH'; END IF;
 INSERT INTO mushavo_restore_result VALUES(jsonb_build_object('stage_step','1.4.3','result','SELECTED_RESTORED_VALUES_AND_ROLE_BOUNDARIES_PASS','effective_access_checks',check_count,'relation_and_rls_flags_match',true,'selected_payment_and_workspace_values_match',true,'noop_updates_rolled_back',true,'auth_identity_is_sql_emulation',true,'full_platform_recovery_verified',false));
END $checks$;
SELECT data FROM mushavo_restore_result;
`;
function prepare(source,run){
 need(path.dirname(path.resolve(run))===path.dirname(path.resolve(source)),'RESTORE_RUN_PARENT_MISMATCH');
 need(fs.lstatSync(run).isDirectory()&&!fs.lstatSync(run).isSymbolicLink(),'RESTORE_RUN_DIRECTORY_INVALID');
 const x=inspect(source);const payload=Buffer.from(JSON.stringify(x.expected),'utf8').toString('base64');
 fs.writeFileSync(path.join(run,'restore-bootstrap.sql'),bootstrap+`INSERT INTO mushavo_restore_expected VALUES(convert_from(decode('${payload}','base64'),'UTF8')::jsonb);\nINSERT INTO auth.users(id,email) SELECT (v->>'id')::uuid,v->>'email' FROM mushavo_restore_expected CROSS JOIN LATERAL jsonb_array_elements(data->'auth_identities') v;\n`,{flag:'wx'});
 fs.writeFileSync(path.join(run,'restore-validation.sql'),validation,{flag:'wx'});
 fs.writeFileSync(path.join(run,'restore.toc.txt'),x.toc,{flag:'wx'});
 return {stage_step:'1.4.3',result:'PRIVATE_SYNTHETIC_RESTORE_INPUTS_PREPARED',files_checked:names.length,excluded_schema_or_provider_toc_entries:x.excluded,source_hashes_verified:true,sql_identity_adapter:true,placeholder_roles_have_login:false,full_platform_recovery_verified:false};
}
module.exports={inspect,prepare,bootstrap,validation,roles,AuditError};
if(require.main===module){try{const s=process.env.MUSHAVO_SYNTHETIC_SOURCE;need(!!s,'SOURCE_DIRECTORY_REQUIRED');const out=process.argv[2]==='verify'?{stage_step:'1.4.3',result:'PRIVATE_SOURCE_HASHES_RECHECKED',files_checked:inspect(s).manifest.files.length}:prepare(s,process.env.MUSHAVO_RESTORE_RUN);console.log(JSON.stringify(out));}catch(e){console.log(JSON.stringify({stage_step:'1.4.3',result:'SYNTHETIC_RESTORE_PREPARATION_REVIEW',problem_code:e instanceof AuditError?e.message:'LOCAL_INPUT_OR_FILE_ERROR'}));process.exitCode=1;}}
