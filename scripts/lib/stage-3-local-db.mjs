// Modeled, in-memory database for candidate compilation/behavior checks only.
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
export const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
// Historical component regressions deliberately retain the pre-activation54 baseline.
// Current installer tests explicitly opt into the complete55 history.
export async function localDatabase(modulePath,{includeEmailInstaller=false,creationPath='migrations'}={}) {
 if(!['migrations','canonical'].includes(creationPath)||(creationPath==='canonical'&&!includeEmailInstaller))throw new Error('LOCAL_DATABASE_CREATION_PATH_INVALID');
 const {PGlite}=await import(pathToFileURL(resolve(modulePath)));
 const db=new PGlite();
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text,factor_type text);
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb)$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role')$$;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner uuid,owner_id text);
 alter table storage.objects enable row level security;
 create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1]$$;
 grant usage on schema auth,storage,public to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to authenticated;
 alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
 alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
 alter default privileges in schema public grant execute on functions to anon,authenticated,service_role;`);
 const migrations=(await readdir(resolve(root,'supabase/migrations'))).filter(n=>n.endsWith('.sql')&&(includeEmailInstaller||n!=='20261017000000_email_verification_atomic_installer.sql')).sort();
 if(creationPath==='canonical')await db.exec((await readFile(resolve(root,'supabase/schema.sql'),'utf8')).replace(/^create extension if not exists pgcrypto;\s*$/gim,''));
 else for(const name of migrations)await db.exec((await readFile(resolve(root,'supabase/migrations',name),'utf8')).replace(/^create extension if not exists pgcrypto;\s*$/gim,''));
 return {db,migrations,creationPath};
}
