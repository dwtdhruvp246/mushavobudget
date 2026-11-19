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
 let calls=0,logouts=0,fired=false,mutations=0;
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
   if(method!=='GET'&&url.pathname.startsWith('/rest/v1/')&&!['is_platform_staff','my_account_suspended','business_roles_snapshot','business_effective_permissions','business_has_permission','business_team_snapshot'].some(n=>url.pathname.endsWith('/'+n)))mutations++;
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.slice('/rest/v1/rpc/'.length),entries=Object.entries(body);
    const args=entries.map(([key],index)=>ident(key)+' => $'+(index+1)).join(',');
    const meta=(await db.query(`select p.proretset,t.typtype,p.prorettype='void'::regtype as is_void from pg_proc p join pg_type t on t.oid=p.prorettype join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.proname=$2`,['public',name])).rows[0];
    if(!meta)throw Object.assign(new Error('missing function'),{code:'PGRST202'});
    const rows=(await db.query(meta.proretset?'select * from public.'+ident(name)+'('+args+')':'select to_jsonb(public.'+ident(name)+'('+args+')) as value',entries.map(x=>x[1]))).rows;
    if(meta.is_void)response=result(204,'',true);else response=result(200,meta.proretset?rows:rows[0].value);
    if(['retained_member','retained_invitation'].includes(fault)&&name==='business_roles_snapshot'&&i===0){
     const value=rows[0].value,old=value.roles.find(x=>!x.is_system);
     if(old){old[fault==='retained_member'?'members':'invitations']=1;response=result(200,value);fired=true;}
    }
    if(fault==='retained_after'&&name==='archive_business_role')fired=true;
    if(!fired&&fault==='legacy_void'&&meta.is_void)response=result(200,null);
    if(!fired&&fault==='void_noeffect'&&name==='archive_business_role'){await db.exec('rollback to savepoint api_request');response=result(204,'',true);fired=true;}
    if(!fired&&fault==='void_body'&&name==='archive_business_role'){response=result(204,{unexpected:true});fired=true;}
    if(!fired&&fault==='nonvoid_204'&&name==='save_business_role'){response=result(204,'',true);fired=true;}
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
    const pgJSON=method==='GET'&&['business_roles','business_role_permissions','business_audit_events'].includes(table);
    if(pgJSON)sql='select to_jsonb(x) as value from ('+sql+') x';
    const dates=['payment_date','expense_date','due_date','period_start','start_date','starts_on','ends_on','planned_on'];
    const rows=(await db.query(sql,params)).rows.map(row=>pgJSON?row.value:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?(dates.includes(k)?v.toISOString().slice(0,10):v.toISOString()):v])));
    if(table==='business_role_permissions'&&url.searchParams.has('role')&&rows.length&&['retained_permission','retained_after'].includes(fault)&&(fault==='retained_permission'||fired)){rows[0].enabled=false;fired=true;}
    if(table==='business_audit_events'&&i===0&&fault==='retained_audit_actor'){
     const roleEvent=rows.find(x=>x.action==='business.role_saved');if(roleEvent){roleEvent.actor_id=users[1];fired=true;}
    }
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
 return {fetcher,counters:()=>({calls,logouts,fired,mutations})};
}
async function batch(fault,expected,retainedArchive=null,prewrite=false){
 await db.exec('begin');
 try{
  const api=adapter(fault),receipt=await run({fetcher:api.fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER',retainedArchive});
  assert.equal(receipt.problem_code,expected,JSON.stringify(receipt));
  assert.equal(api.counters().logouts,2);
  if(prewrite)assert.equal(api.counters().mutations,0);
  if(retainedArchive&&!expected){assert.equal(receipt.retained_archive_three_owner_fingerprints_matched,true);assert.equal(receipt.retained_archive_role_permissions_audit_and_usage_unchanged,true);}
  assert(!JSON.stringify(receipt).includes(users[0])&&!JSON.stringify(receipt).includes('LOCAL_FAKE_TOKEN_'));
  tests.push({test:(retainedArchive?'retained archive: ':'')+(fault||expected||'real ordered source lifecycle'),status:'PASS',checks:receipt.checks.filter(x=>x.status==='PASS').length,requests:api.counters().calls,blocked:receipt.checks.filter(x=>x.status==='BLOCKED').length});
 }finally{await db.exec('rollback');}
}
try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create schema extensions;
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,created_at timestamptz default now());
 create table auth.mfa_factors(id uuid primary key default gen_random_uuid(),user_id uuid references auth.users(id),status text,factor_type text);
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
 await db.exec("set time zone 'UTC'");
 await db.query('insert into auth.users(id,email) values($1,$2),($3,$4)',[users[0],emails[0],users[1],emails[1]]);
 const fixture=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_3_business_fixture.sql'),'utf8');
 const diagnostic=await readFile(path.join(root,'supabase/diagnostics/security_stage_3_business_trigger_review.sql'),'utf8');
 assert.match(diagnostic,/BEGIN READ ONLY;/);
 await db.exec(diagnostic);
 const diagnosticQuery=diagnostic.slice(diagnostic.indexOf('WITH reviewed_bodies'),diagnostic.lastIndexOf('COMMIT;')).trim();
 const cleanDiagnostic=(await db.query(diagnosticQuery)).rows[0];
 assert.equal(Number(cleanDiagnostic.mismatched_triggers),0);
 assert.equal(Number(cleanDiagnostic.synthetic_business_fixture_count),0);
 assert.deepEqual(cleanDiagnostic.mismatch_details,[]);
 tests.push({test:'Read-only trigger diagnostic accepts ordered source and discloses no raw bodies',status:'PASS'});
 for(const [label,ddl] of [
  ['Unknown trigger rejected before fixture writes',"create function public.audit_unknown_trigger() returns trigger language plpgsql as $$begin return new;end$$;create trigger audit_unknown_trigger before insert on public.notifications for each row execute function public.audit_unknown_trigger();"],
  ['Reattached known function rejected before fixture writes',"create trigger audit_unknown_trigger before insert on public.notifications for each row execute function public.guard_suspended_account_write();"],
  ['Changed source trigger body rejected before fixture writes',"create or replace function public.sync_business_invitation_notification() returns trigger language plpgsql as $$begin return new;end$$;"]
 ]){
  await db.exec('begin');try{
   await db.exec(ddl);
   const review=(await db.query(diagnosticQuery)).rows[0];
   assert.equal(Number(review.mismatched_triggers),1);
   const detail=review.mismatch_details[0];
   if(label.startsWith('Unknown')) {assert.equal(detail.exact_body_match,false);assert.equal(detail.association_match,false);}
   if(label.startsWith('Reattached')) {assert.equal(detail.exact_body_match,true);assert.equal(detail.association_match,false);}
   if(label.startsWith('Changed')) {assert.equal(detail.exact_body_match,false);assert.equal(detail.association_match,true);}
   assert.deepEqual(Object.keys(detail).sort(),['association_match','body_match_after_crlf_normalization','exact_body_match','function_name','function_schema','public_function','relation_name','trigger_name'].sort());
   tests.push({test:'Read-only diagnostic identifies '+label,status:'PASS'});
   await assert.rejects(db.exec(fixture),/CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE/);tests.push({test:label,status:'PASS'});
  }finally{await db.exec('rollback');}
 }
 // Preserve completed Family/member-removal/manual-conversion fixtures locally as well.
 await db.exec(await readFile(path.join(root,'supabase/diagnostics/security_stage_3_family_fixture.sql'),'utf8'));
 await db.exec('begin');
 const family=await require('./check-stage-3-family-api.cjs').run({fetcher:adapter(null).fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
 assert.equal(family.result,'STAGING_FAMILY_API_SCOPED_PASS',JSON.stringify(family));await db.exec('commit');
 await db.exec('begin');
 const currency=await require('./check-stage-3-currency-api.cjs').run({fetcher:adapter(null).fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER'});
 assert.equal(currency.result,'STAGING_CURRENCY_API_SCOPED_PASS',JSON.stringify(currency));await db.exec('commit');
 tests.push({test:'Completed Family removal and two manual conversions established as preservation controls',status:'PASS'});
 // Modeled historical orphans: seed while the FK is absent, restore NOT VALID.
 await db.exec(`alter table public.payment_conversions drop constraint payment_conversions_payment_record_ref_fkey;
 insert into public.payment_conversions(entity_type,entity_id,workspace_id,original_amount,original_currency,reporting_currency,exchange_rate,converted_amount,rate_effective_at,rate_provider,rate_source,is_locked)
 select 'payment_record',gen_random_uuid(),id,1,'USD','USD',1,1,now(),'identity','identity',true
 from public.budget_workspaces where workspace_type='personal' and owner_id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002');
 alter table public.payment_conversions add constraint payment_conversions_payment_record_ref_fkey foreign key(payment_record_ref) references public.payment_records(id) on delete cascade not valid;`);
 const priorConversions=(await db.query('select jsonb_agg(to_jsonb(c) order by id) as rows from public.payment_conversions c')).rows[0].rows;
 assert.equal((await db.query("select count(*)::integer n from public.payment_conversions c where entity_type='payment_record' and not exists(select 1 from public.payment_records r where r.id=c.entity_id)")).rows[0].n,2);
 for(const [label,ddl,error] of [
  ['Disabled expected trigger rejected',"alter table public.notification_outbox disable trigger set_payment_outbox_workspace_context_trigger",'CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE'],
  ['Missing expected trigger rejected',"drop trigger set_payment_outbox_workspace_context_trigger on public.notification_outbox",'CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE'],
  ['Changed direct function grant rejected',"grant execute on function public.set_payment_outbox_workspace_context() to anon",'CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE'],
  ['Added API overload rejected',"create function public.business_has_permission(uuid) returns boolean language sql as $$select true$$",'CURRENT_BUSINESS_CATALOG_DIFFERS_FROM_REVIEWED_SOURCE'],
  ['Unreviewed CHECK callback rejected',"create function public.audit_unreviewed_check() returns boolean language sql as $$select true$$; alter table public.business_categories add constraint audit_extra check(public.audit_unreviewed_check())",'UNREVIEWED_PUBLIC_CONSTRAINT_OR_DEFAULT_FUNCTION'],
  ['Active cron metadata blocks setup without running a job',"create schema cron;create table cron.job(active boolean);insert into cron.job values(true)",'ACTIVE_STAGING_CRON_REQUIRES_REVIEW'],
  ['Third Auth identity blocks setup',"insert into auth.users(id,email) values('00000000-0000-4000-8000-000000000099','audit.third@example.com')",'EXPECTED_TWO_SYNTHETIC_STAGING_AUTH_USERS'],
  ['Ordinary SQL role rejected','set local role anon','FIXTURE_REQUIRES_PRIVILEGED_SQL_EDITOR'],
  ['Non-origin replication role rejected',"set local session_replication_role='replica'",'FIXTURE_REQUIRES_ORIGIN']
 ]){
  await db.exec('begin');try{await db.exec(ddl);await assert.rejects(db.exec(fixture),new RegExp(error));tests.push({test:label,status:'PASS'});}finally{await db.exec('rollback;reset role');}
  assert.equal((await db.query("select count(*)::integer n from public.budget_workspaces where workspace_type='business'")).rows[0].n,0);
 }
 await db.exec('begin');try{
  const injected=fixture.replace(' FOREACH v_relation IN ARRAY v_preserve LOOP\n   v_filter'," update public.payment_conversions set converted_amount=converted_amount+1;\n FOREACH v_relation IN ARRAY v_preserve LOOP\n   v_filter");
  assert.notEqual(injected,fixture);await assert.rejects(db.exec(injected),/PREEXISTING_AUDIT_ROWS_CHANGED/);
  tests.push({test:'Injected prior-conversion mutation aborts entire fixture transaction',status:'PASS'});
 }finally{await db.exec('rollback');}
 // Synthetic raw-body mutation only inside the local model, never hosted SQL.
 await db.exec("update pg_proc set prosrc=replace(prosrc,chr(10),chr(13)||chr(10)) where pronamespace='public'::regnamespace");
 await db.exec(fixture);
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(c) order by id) as rows from public.payment_conversions c')).rows[0].rows,priorConversions);
 tests.push({test:'CRLF source catalog accepted with retained manual and two modeled orphan conversions unchanged',status:'PASS'});
 await assert.rejects(db.exec(fixture),/BUSINESS_FIXTURE_REQUIRES_NO_EXISTING_BUSINESSES/);await db.exec('rollback');
 assert.equal((await db.query("select count(*)::integer n from public.budget_workspaces where workspace_type='business'")).rows[0].n,2);
 tests.push({test:'Repeated setup rejected without another business or entitlement',status:'PASS'});
 await batch(null,null);
 await batch('false_denial','ROLE_DENIAL_NOT_AUTHORIZATION');
 await batch('missing_function','ROLE_DENIAL_NOT_AUTHORIZATION');
 await batch('hidden_write','PROTECTED_BUSINESS_CHANGED');
 await batch('foreign_read','FOREIGN_CLAIM_EXPOSED');
 await batch('logout','TEST_SESSION_LOGOUT_FAILED');
 await batch('legacy_void',null);
 await batch('void_noeffect','ROLE_ARCHIVE_READBACK_FAILED');
 await batch('void_body','POSITIVE_ARCHIVE_BUSINESS_ROLE_FAILED');
 await batch('nonvoid_204','POSITIVE_SAVE_BUSINESS_ROLE_FAILED');
 const stateSQL=await readFile(path.join(root,'supabase/diagnostics/security_fr_2_3_business_archive_state_review.sql'),'utf8');
 const reviewState=async()=>{const result=await db.exec(stateSQL);return result.flatMap(x=>x.rows||[]).find(x=>x.business_archive_state_review)?.business_archive_state_review;};
 await db.exec('begin');await context('authenticated',0);
 const primary=(await db.query("select id from public.budget_workspaces where name='AUDIT-S332-BUSINESS-PRIMARY'")).rows[0].id;
 const saved=(await db.query("select to_jsonb(public.save_business_role($1,null,'AUDIT-S333-ROLE','Synthetic audit','all',array['workspace.view','reports.view'],null)) as value",[primary])).rows[0].value;
 await db.query("select public.save_business_role($1,$2,'AUDIT-S333-ROLE-EDITED','Synthetic audit','all',array['workspace.view','reports.view'],1)",[primary,saved.code]);
 await db.exec('reset role;commit');
 const beforeState=(await db.query('select jsonb_agg(to_jsonb(r) order by workspace_id,code) as rows from public.business_roles r')).rows[0].rows;
 const activeState=await reviewState();
 assert.equal(activeState.transaction_read_only,'on');assert.equal(activeState.target_custom_roles,1);
 assert.equal(activeState.target_role_details[0].status,'active');assert.equal(activeState.target_role_details[0].version,2);
 assert.equal(activeState.role_saved_audit_events,2);assert.equal(activeState.role_archived_audit_events,0);
 assert.equal(activeState.routine_metadata[0].result_type,'void');assert.equal(activeState.routine_metadata[0].matches_reviewed_archive_body,true);
 tests.push({test:'Read-only diagnostic distinguishes edited active role from completed archive',status:'PASS'});
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(r) order by workspace_id,code) as rows from public.business_roles r')).rows[0].rows,beforeState);
 tests.push({test:'Read-only role state review preserves actual role rows',status:'PASS'});
 await db.exec('begin');
 const archived=await adapter(null).fetcher('https://dczlddwbtgvfdujgcitb.supabase.co/rest/v1/rpc/archive_business_role',{method:'POST',headers:{Authorization:'Bearer LOCAL_FAKE_TOKEN_0'},body:JSON.stringify({p_workspace_id:primary,p_code:saved.code,p_expected_version:2})});
 assert.equal(archived.status,204);await db.exec('commit');
 const archivedState=await reviewState();assert.equal(archivedState.target_role_details[0].status,'archived');assert.equal(archivedState.target_role_details[0].version,3);
 assert.equal(archivedState.role_archived_audit_events,1);assert.equal(archivedState.target_role_details[0].permission_rows,2);
 assert.equal(archivedState.target_role_details[0].active_members_using_role,0);assert.equal(archivedState.target_role_details[0].pending_valid_invitations_using_role,0);
 tests.push({test:'Read-only diagnostic reports archived version3 and its exact audit/unused permission scope after modeled204',status:'PASS'});

 const contract={role_sha256:archivedState.target_role_details[0].role_row_sha256,permissions_sha256:archivedState.target_role_details[0].permission_rows_sha256,audit_sha256:archivedState.target_audit_rows_sha256};
 const {retainedFingerprint,pgJsonb,utcTimestamp}=require('./check-stage-3-business-api.cjs');
 const rawRole=(await db.query('select to_jsonb(r) as value from public.business_roles r where workspace_id=$1 and code=$2',[primary,saved.code])).rows[0].value;
 assert.equal(retainedFingerprint(rawRole),contract.role_sha256);
 const rawPerms=(await db.query('select jsonb_agg(to_jsonb(p) order by permission_code) as value from public.business_role_permissions p where workspace_id=$1 and role=$2',[primary,saved.code])).rows[0].value;
 const rawAudit=(await db.query("select jsonb_agg(to_jsonb(a) order by id) as value from public.business_audit_events a where workspace_id=$1 and (before_summary->>'code'=$2 or after_summary->>'code'=$2)",[primary,saved.code])).rows[0].value;
 assert.equal(retainedFingerprint(rawPerms,['created_at','updated_at']),contract.permissions_sha256);
 assert.equal(retainedFingerprint(rawAudit,['created_at']),contract.audit_sha256);
 const timestampVariants=rawPerms.map(p=>({...p,created_at:p.created_at.replace('+00:00','Z'),updated_at:p.updated_at.replace('+00:00','Z')}));
 assert.equal(retainedFingerprint(timestampVariants,['created_at','updated_at']),contract.permissions_sha256);
 assert.equal(utcTimestamp('2026-10-14T23:17:46.683109+04:00'),'2026-10-14T19:17:46.683109+00:00');
 assert.equal(utcTimestamp('2026-10-14T19:17:46.100000Z'),'2026-10-14T19:17:46.1+00:00');
 const exotic={'aaa':2,'bb':true,'a':null,'nested':{'z':'value','long':'escaped " string'},'unicode':'\u00b7'};
 assert.equal(pgJsonb(exotic),(await db.query('select $1::jsonb::text as value',[exotic])).rows[0].value);
 tests.push({test:'All three fingerprint renderings match actual PostgreSQL jsonb/UTC with microseconds and equivalent offsets preserved',status:'PASS'});
 await batch(null,null,contract);
 await batch('legacy_void',null,contract);
 await batch('void_noeffect','ROLE_ARCHIVE_READBACK_FAILED',contract);
 await batch('false_denial','ROLE_DENIAL_NOT_AUTHORIZATION',contract);
 await batch('retained_member','RETAINED_ARCHIVE_SHAPE_MISMATCH',contract,true);
 await batch('retained_invitation','RETAINED_ARCHIVE_SHAPE_MISMATCH',contract,true);
 await batch('retained_permission','RETAINED_ARCHIVE_PERMISSION_SHAPE_MISMATCH',contract,true);
 await batch('retained_audit_actor','RETAINED_ARCHIVE_AUDIT_SHAPE_MISMATCH',contract,true);
 await batch('retained_after','RETAINED_ARCHIVE_CHANGED',contract);
 for(const [field,error] of [['role_sha256','RETAINED_ARCHIVE_ROW_HASH_MISMATCH'],['permissions_sha256','RETAINED_ARCHIVE_PERMISSION_HASH_MISMATCH'],['audit_sha256','RETAINED_ARCHIVE_AUDIT_HASH_MISMATCH']])await batch(null,error,{...contract,[field]:'0'.repeat(64)},true);
 await batch(null,'PRISTINE_BUILTIN_ROLES_REQUIRED');
 // Actual source constraints permit only the reviewed archived row; fresh mode
 // still rejects it, and the scoped mode rejects changed state before writes.
 for(const [label,patch,error] of [
  ['Version drift',"version=4",'RETAINED_ARCHIVE_SHAPE_MISMATCH'],
  ['Active instead of archived',"status='active'",'RETAINED_ARCHIVE_SHAPE_MISMATCH'],
  ['Name drift',"name='OTHER-ROLE'",'RETAINED_ARCHIVE_SHAPE_MISMATCH'],
  ['Scope drift',"scope_mode='own'",'RETAINED_ARCHIVE_SHAPE_MISMATCH']
 ]){
  await db.exec('begin');
  try{
   await db.query('update public.business_roles set '+patch+' where workspace_id=$1 and code=$2',[primary,saved.code]);
   // batch() owns a transaction: exercise the checker directly in this one.
   const api=adapter(null),receipt=await run({fetcher:api.fetcher,ownerPassword:'LOCAL_DUMMY_OWNER',outsiderPassword:'LOCAL_DUMMY_MEMBER',retainedArchive:contract});
   assert.equal(receipt.problem_code,error,JSON.stringify(receipt));assert.equal(api.counters().mutations,0);assert.equal(api.counters().logouts,2);
   tests.push({test:label+' on retained archive rejected before test mutations',status:'PASS'});
  }finally{await db.exec('rollback');}
 }
 const stateAfter=await reviewState();
 assert.deepEqual(stateAfter.target_role_details,archivedState.target_role_details);
 assert.equal(stateAfter.target_audit_rows_sha256,contract.audit_sha256);
 assert.deepEqual((await db.query('select jsonb_agg(to_jsonb(c) order by id) as rows from public.payment_conversions c')).rows[0].rows,priorConversions);
 tests.push({test:'Repeated scoped and failure runs preserve old archived role, both permission rows, three audit rows, manual and orphan conversions',status:'PASS'});
 const receipt={stage_step:'FR.2.3_BUSINESS_RETAINED_ARCHIVE_CONTINUATION',result:'LOCAL_RETAINED_ARCHIVE_CONTINUATION_AND_VOID_RPC_SCOPED_PASS',migration_count:migrations.length,tests,provider_auth_storage_and_http_adapters_used:true,hosted_PostgREST_or_real_file_or_dispatch_verified:false,production_staging_or_native_changed:false};
 receipt.local_tests=tests.length;receipt.local_PASS=tests.length;receipt.local_FAIL=0;receipt.exit_code=0;
 receipt.SQL_ASCII_only=!/[^\x00-\x7f]/.test(fixture);
 receipt.Business_fixture_rows_created_on_host=0;receipt.hosted_Business_API_checks_run=0;receipt.findings_closed=[];
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-business-retained-archive-local-checks.json'),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt,null,2));
}finally{await db.close();}
