// Local PostgreSQL-shaped source exercise. Never contacts hosted services.
import assert from 'node:assert/strict';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url);
const {run}=require('./check-stage-3-business-api.cjs');
const {PGlite}=await import(pathToFileURL(process.argv[2]));
const db=new PGlite();
const users=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'];
const emails=['audit.owner@example.com','audit.outsider@example.com'];
const tests=[];
const result=(status,data,raw=false)=>({status,text:async()=>raw?data:JSON.stringify(data)});
const ident=value=>{assert.match(value,/^[a-z][a-z0-9_]*$/);return '"'+value+'"';};
async function context(role,i){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true),set_config('request.jwt.claims',$3,true)",[i===undefined?'':users[i],role,JSON.stringify(i===undefined?{role}:{sub:users[i],email:emails[i],role})]);
 await db.exec('set local role '+ident(role));
}
function adapter(fault){
 let calls=0,logouts=0,fired=false;
 async function fetcher(raw,options={}){
  calls++;
  if(raw==='https://mushavo-budget-staging.pages.dev/config.js')return result(200,'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_LOCAL_ONLY',vapidPublicKey:''})+';',true);
  const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  const token=options.headers?.Authorization?.replace('Bearer ',''),i=token?Number(token.slice(-1)):undefined;
  if(url.pathname==='/auth/v1/token'){const account=emails.indexOf(body.email);assert.notEqual(account,-1);return result(200,{access_token:'LOCAL_FAKE_TOKEN_'+account,user:{id:users[account],email:emails[account]}});}
  if(url.pathname==='/auth/v1/user')return result(200,{id:users[i],email:emails[i]});
  if(url.pathname==='/auth/v1/logout'){logouts++;return result(fault==='logout'?500:204,null);}
  await db.exec('savepoint api_request');
  try{
   await context(i===undefined?'anon':'authenticated',i);
   let response;
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.slice('/rest/v1/rpc/'.length),entries=Object.entries(body);
    const args=entries.map(([key],index)=>ident(key)+' => $'+(index+1)).join(',');
    const meta=(await db.query('select p.proretset,t.typtype from pg_proc p join pg_type t on t.oid=p.prorettype join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.proname=$2',['public',name])).rows[0];
    if(!meta)throw Object.assign(new Error('missing function'),{code:'PGRST202'});
    const rows=(await db.query(meta.proretset?'select * from public.'+ident(name)+'('+args+')':'select to_jsonb(public.'+ident(name)+'('+args+')) as value',entries.map(x=>x[1]))).rows;
    response=result(200,meta.proretset?rows:rows[0].value);
   }else{
    const table=url.pathname.slice('/rest/v1/'.length),params=[],cols=(url.searchParams.get('select')||'*').split(',').map(x=>x==='*'?'*':ident(x)).join(',');
    const filters=[...url.searchParams].filter(([key])=>!['select','limit','order'].includes(key));
    const where=method!=='POST'&&filters.length?' where '+filters.map(([key,value])=>{assert(value.startsWith('eq.'));params.push(value.slice(3));return ident(key)+' = $'+params.length;}).join(' and '):'';
    let sql;
    if(method==='GET')sql='select '+cols+' from public.'+ident(table)+where;
    if(method==='DELETE')sql='delete from public.'+ident(table)+where+' returning '+cols;
    if(method==='PATCH'){const sets=Object.entries(body).map(([key,value])=>{params.push(value);return ident(key)+' = $'+params.length;});sql='update public.'+ident(table)+' set '+sets.join(',')+where+' returning '+cols;}
    if(method==='POST'){const entries=Object.entries(body);sql='insert into public.'+ident(table)+'('+entries.map(([key])=>ident(key)).join(',')+') values ('+entries.map(([,value])=>{params.push(value);return '$'+params.length;}).join(',')+') returning '+cols;}
    if(method==='GET'&&url.searchParams.has('order'))sql+=' order by '+url.searchParams.get('order').split(',').map(x=>{const [c,d]=x.split('.');return ident(c)+(d==='desc'?' desc':' asc');}).join(',');
    if(method==='GET'&&url.searchParams.has('limit'))sql+=' limit '+Number(url.searchParams.get('limit'));
    const dates=['payment_date','expense_date','due_date','period_start','start_date','starts_on','ends_on','planned_on'];
    const rows=(await db.query(sql,params)).rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?(dates.includes(k)?v.toISOString().slice(0,10):v.toISOString()):v])));
    response=result(method==='POST'?201:200,rows);
    if(!fired&&fault==='foreign_read'&&i===1&&table==='business_expense_claims'&&method==='GET'){
     await db.exec('reset role');const privileged=(await db.query('select '+cols+' from public.'+ident(table)+where,params)).rows;
     if(privileged.length&&privileged[0].submitted_by===users[0]){response=result(200,privileged);fired=true;}
    }
   }
   await db.exec('reset role; release savepoint api_request');return response;
  }catch(error){
   await db.exec('rollback to savepoint api_request; reset role; release savepoint api_request');
   if(!fired&&fault==='missing_function'&&url.pathname.endsWith('/save_business_role')){fired=true;return result(404,{code:'PGRST202'});}
   if(!fired&&fault==='false_denial'&&error.code==='P0001'){fired=true;return result(400,{code:'23503',message:'Synthetic FK failure'});}
   if(!fired&&fault==='hidden_write'&&url.pathname.endsWith('/save_business_role')){
    await db.query("update public.business_profiles set trading_name='UNAUTHORIZED' where workspace_id=$1",[body.p_workspace_id]);fired=true;
   }
   return result(error.code==='42501'?403:400,{code:error.code,message:error.message});
  }
 }
 return {fetcher,counters:()=>({calls,logouts,fired})};
}
async function batch(fault,expected){
 await db.exec('begin');
 try{
  const api=adapter(fault),receipt=await run({fetcher:api.fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
  assert.equal(receipt.problem_code,expected,JSON.stringify(receipt));
  assert.equal(api.counters().logouts,2);
  assert(!JSON.stringify(receipt).includes(users[0])&&!JSON.stringify(receipt).includes('LOCAL_FAKE_TOKEN_'));
  tests.push({test:fault||'real ordered source lifecycle',status:'PASS',checks:receipt.checks.filter(x=>x.status==='PASS').length,requests:api.counters().calls,blocked:receipt.checks.filter(x=>x.status==='BLOCKED').length});
 }finally{await db.exec('rollback');}
}
try{
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
 if(process.argv.includes('--write-guard')){
  const functions=(await db.query("select p.proname,md5(p.prosrc) as hash from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by p.proname,hash")).rows;
  const triggers=(await db.query("select c.relname,t.tgname,p.proname,t.tgtype::integer as kind,encode(t.tgargs,'hex') as args,t.tgattr::text as attrs from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal and t.tgenabled<>'D' order by c.relname,t.tgname")).rows;
  const checker=await readFile(path.join(root,'scripts/check-stage-3-business-api.cjs'),'utf8');
  const roots=[...new Set([...checker.matchAll(/(?:rpc|ok|deny)\('([a-z_]+)'/g)].map(x=>x[1]).concat(['business_public_provision_permit','business_team_permit']))];
  const relations=['budget_workspaces','workspace_subscriptions','workspace_settings','workspace_members','business_profiles','business_roles','business_role_permissions','business_member_permissions','business_member_scopes','workspace_invitations','business_invitation_scopes','business_categories','business_dimensions','business_expense_claims','business_budgets','business_spending_requests','business_bills','business_bill_schedules','business_bill_payments','business_documents','business_audit_events','business_change_signals','notifications','notification_outbox','admin_notification_outbox','business_public_provision_permits','business_team_operation_permits'];
  const selected=relations.map(x=>"'"+x+"'").join(',');
  const guard=`-- Selected trigger and static public-function call closure must match ordered source bodies.
CREATE TEMP TABLE mushavo_s332_bodies(name text,body_md5 text) ON COMMIT DROP;
INSERT INTO mushavo_s332_bodies VALUES\n${functions.map(x=>"('"+x.proname+"','"+x.hash+"')").join(',\n')};
CREATE TEMP TABLE mushavo_s332_triggers(relation_name text,trigger_name text,function_name text,kind integer,args text,attrs text) ON COMMIT DROP;
INSERT INTO mushavo_s332_triggers VALUES\n${triggers.map(x=>"('"+x.relname+"','"+x.tgname+"','"+x.proname+"',"+x.kind+",'"+x.args+"','"+x.attrs+"')").join(',\n')};
DO $guard$
DECLARE v_pending oid[];v_seen oid[]:='{}';v_oid oid;v_name text;v_body text;v_hash text;v_child oid;
BEGIN
 IF EXISTS(SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace f ON f.oid=p.pronamespace
  WHERE n.nspname='public' AND c.relname=ANY(ARRAY[${selected}]) AND NOT t.tgisinternal AND t.tgenabled<>'D'
  AND (f.nspname<>'public' OR NOT EXISTS(SELECT 1 FROM mushavo_s332_bodies b WHERE b.name=p.proname AND b.body_md5=md5(p.prosrc))
   OR NOT EXISTS(SELECT 1 FROM mushavo_s332_triggers x WHERE x.relation_name=c.relname AND x.trigger_name=t.tgname
    AND x.function_name=p.proname AND x.kind=t.tgtype AND x.args=encode(t.tgargs,'hex') AND x.attrs=t.tgattr::text)))
 THEN RAISE EXCEPTION 'UNREVIEWED_PUBLIC_TRIGGER_BODY';END IF;
 SELECT array_agg(DISTINCT p.oid) INTO v_pending FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND (p.proname=ANY(ARRAY[${roots.map(x=>"'"+x+"'").join(',')}])
  OR p.oid IN(SELECT tgfoid FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace
    WHERE ns.nspname='public' AND c.relname=ANY(ARRAY[${selected}]) AND NOT t.tgisinternal AND t.tgenabled<>'D'));
 WHILE coalesce(array_length(v_pending,1),0)>0 LOOP
  v_oid:=v_pending[1];v_pending:=v_pending[2:];
  IF v_oid=ANY(v_seen) THEN CONTINUE;END IF;v_seen:=array_append(v_seen,v_oid);
  SELECT proname,prosrc,md5(prosrc) INTO v_name,v_body,v_hash FROM pg_proc WHERE oid=v_oid;
  IF NOT EXISTS(SELECT 1 FROM mushavo_s332_bodies b WHERE b.name=v_name AND b.body_md5=v_hash)
   THEN RAISE EXCEPTION 'SELECTED_PUBLIC_FUNCTION_BODY_DIFFERS_FROM_SOURCE';END IF;
  IF v_body ~* '(net[.]|http_(get|post|request)[(]|dblink|COPY.*PROGRAM)'
   THEN RAISE EXCEPTION 'OUTBOUND_FUNCTION_REQUIRES_SEPARATE_REVIEW';END IF;
  FOR v_child IN SELECT p.oid FROM regexp_matches(v_body,'public[.]([a-z_][a-z0-9_]*)[[:space:]]*[(]','gi') m
   JOIN pg_proc p ON p.proname=m[1] JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'
   LOOP IF NOT v_child=ANY(v_seen) THEN v_pending:=array_append(v_pending,v_child);END IF;END LOOP;
 END LOOP;
END $guard$;
-- END_SOURCE_BODY_GUARD`;
  const filename=path.join(root,'supabase/diagnostics/security_stage_3_business_fixture.sql');
  const source=await readFile(filename,'utf8');
  await writeFile(filename,source.replace(/-- SOURCE_BODY_GUARD[\s\S]*?-- END_SOURCE_BODY_GUARD|-- SOURCE_BODY_GUARD/,'-- SOURCE_BODY_GUARD\n'+guard));
 }
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[users[0],emails[0],users[1],emails[1]]);
 const fixture=await readFile(path.join(root,'supabase/diagnostics/security_stage_3_business_fixture.sql'),'utf8');
 for(const [label,ddl] of [
  ['Unknown trigger rejected before fixture writes',"create function public.audit_unknown_trigger() returns trigger language plpgsql as $$begin return new;end$$;create trigger audit_unknown_trigger before insert on public.notifications for each row execute function public.audit_unknown_trigger();"],
  ['Reattached known function rejected before fixture writes',"create trigger audit_unknown_trigger before insert on public.notifications for each row execute function public.guard_suspended_account_write();"],
  ['Changed source trigger body rejected before fixture writes',"create or replace function public.sync_business_invitation_notification() returns trigger language plpgsql as $$begin return new;end$$;"]
 ]){
  await db.exec('begin');try{await db.exec(ddl);await assert.rejects(db.exec(fixture),/UNREVIEWED_PUBLIC_TRIGGER_BODY/);tests.push({test:label,status:'PASS'});}finally{await db.exec('rollback');}
 }
 // Preserve completed Family/member-removal/manual-conversion fixtures locally as well.
 await db.exec(await readFile(path.join(root,'supabase/diagnostics/security_stage_3_family_fixture.sql'),'utf8'));
 await db.exec('begin');
 const family=await require('./check-stage-3-family-api.cjs').run({fetcher:adapter(null).fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
 assert.equal(family.result,'STAGING_FAMILY_API_SCOPED_PASS');await db.exec('commit');
 await db.exec('begin');
 const currency=await require('./check-stage-3-currency-api.cjs').run({fetcher:adapter(null).fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
 assert.equal(currency.result,'STAGING_CURRENCY_API_SCOPED_PASS',JSON.stringify(currency));await db.exec('commit');
 tests.push({test:'Completed Family removal and two manual conversions established as preservation controls',status:'PASS'});
 await db.exec(fixture);
 await assert.rejects(db.exec(fixture),/BUSINESS_FIXTURE_REQUIRES_NO_EXISTING_BUSINESSES/);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::integer n from public.budget_workspaces where workspace_type='business'")).rows[0].n,2);
 tests.push({test:'Repeated setup rejected without another business or entitlement',status:'PASS'});
 await batch(null,null);
 await batch('false_denial','ROLE_DENIAL_NOT_AUTHORIZATION');
 await batch('missing_function','ROLE_DENIAL_NOT_AUTHORIZATION');
 await batch('hidden_write','PROTECTED_BUSINESS_CHANGED');
 await batch('foreign_read','FOREIGN_CLAIM_EXPOSED');
 await batch('logout','TEST_SESSION_LOGOUT_FAILED');
 console.log(JSON.stringify({stage_step:'3.3.2',result:'LOCAL_BUSINESS_SOURCE_AND_CHECKER_PASS',migration_count:migrations.length,tests,provider_auth_storage_and_http_adapters_used:true,hosted_PostgREST_or_real_file_or_dispatch_verified:false,production_staging_or_native_changed:false},null,2));
}finally{await db.close();}
