// Offline source catalog inventory. No hosted requests, credentials or customer data.
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
if(!process.argv[2] || !process.argv[3])throw new Error('Provide an external PGlite module path and a local inventory output path.');
const {PGlite}=await import(pathToFileURL(path.resolve(process.argv[2])));
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const db=new PGlite();
try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 grant usage on schema auth,storage,public to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
 const migrations=(await readdir(path.join(root,'supabase/migrations'))).filter(n=>n.endsWith('.sql')).sort();
 for(const name of migrations)await db.exec((await readFile(path.join(root,'supabase/migrations',name),'utf8')).replace(/^create extension if not exists pgcrypto;\s*$/gim,''));

const routines=(await db.query(`select p.proname as name,pg_get_function_identity_arguments(p.oid) as args,p.prosecdef as security_definer,
 md5(p.prosrc) as body_md5, p.prosrc ~* '(is_app_admin|is_platform_staff|app_admins)' as direct_staff_reference,
 p.prosrc ~* '(aal2|auth[.]jwt[(][)]\s*->>\s*''aal'')' as assurance_reference,
 p.prosrc ~* 'my_account_suspended' as direct_suspension_reference,
 has_function_privilege('anon',p.oid,'EXECUTE') as modeled_anon_execute,
 has_function_privilege('authenticated',p.oid,'EXECUTE') as modeled_authenticated_execute
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (p.prosrc ~* '(is_app_admin|is_platform_staff|app_admins)' or p.proname like 'admin_%') order by p.proname,args`)).rows;
const policies=(await db.query(`select c.relname as relation_name,p.polname as name,p.polcmd as command,p.polpermissive as permissive,
 concat(pg_get_expr(p.polqual,p.polrelid),' ',pg_get_expr(p.polwithcheck,p.polrelid)) as expression
 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
 and concat(pg_get_expr(p.polqual,p.polrelid),' ',pg_get_expr(p.polwithcheck,p.polrelid)) ~* '(is_app_admin|is_platform_staff|app_admins)'
 order by c.relname,p.polname`)).rows;
await writeFile(path.resolve(process.argv[3]),JSON.stringify({stage_step:'3.4.1',scope:'LOCAL_ORDERED_SOURCE_CATALOG_WITH_MODELED_AUTH_STORAGE_DEFAULT_GRANTS',hosted_metadata_or_authorization_verified:false,migration_count:migrations.length,routines,policies},null,2)+'\n');
console.log(JSON.stringify({migration_count:migrations.length,selected_staff_reference_or_admin_named_routines:routines.length,staff_reference_policies:policies.length,routines_with_assurance_reference:routines.filter(r=>r.assurance_reference).length,policy_relations:[...new Set(policies.map(p=>p.relation_name))]},null,2));
} finally { await db.close(); }
