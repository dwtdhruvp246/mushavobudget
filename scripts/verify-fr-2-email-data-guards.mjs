import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
createRequire(import.meta.url)('./offline-test-network.cjs');
const cases=[];
let db,migrations,failure,sourceFiles=0,authenticatedProbes=0,anonymousProbes=0,sqlPositiveProbes=0;
const check=async(title,fn)=>{
  try{await fn();cases.push({title,result:'PASS'});}
  catch(error){cases.push({title,result:'FAIL'});throw error;}
};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C]=[id(801),id(802),id(803)];
const [A1,A2,B1,C1]=[id(811),id(812),id(813),id(814)];
const [BA,BB]=[id(821),id(822)];
const claims=(u=A,s=A1,extra={})=>({sub:u,session_id:s,role:'authenticated',email:u===A?'guard.a@example.invalid':u===B?'guard.b@example.invalid':'guard.admin@example.invalid',exp:Math.floor(Date.now()/1000)+3600,...extra});
async function request(c,role,action){
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(c)]);
  await db.exec(`set role ${role}`);
  try{return await action();}
  finally{await db.exec("reset role;reset request.jwt.claims;reset request.jwt.claim.sub;reset request.jwt.claim.role");}
}
const user=(u,s,action,extra={})=>request(claims(u,s,extra),'authenticated',action);
const service=action=>request({role:'service_role'},'service_role',action);
async function verify(u,s){
  const c=randomUUID();
  await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[u]);
  await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[u]);
  const call=(name,args)=>service(async()=>(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value);
  assert.equal((await call('email_gate_begin_challenge',[u,s,c,'1'.repeat(64),'guard_v1',false])).result,'PENDING_DELIVERY');
  assert.equal((await call('email_gate_set_delivery',[u,s,c,true])).result,'READY');
  assert.equal((await call('email_gate_verify_challenge',[u,s,c,'1'.repeat(64),null])).result,'VERIFIED');
}
const expectedDenial=e=>e.code==='42501'&&e.message==='EMAIL_VERIFICATION_REQUIRED';
async function deniedRead(action){
  try{assert.deepEqual((await action()).rows,[]);}
  catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.equal(e.code,'42501');}
}
let guardSQL,coverage,WA,WB,item,record,proofName;
const appSnapshot=async()=>(await db.query(`select
  (select jsonb_agg(to_jsonb(x) order by id) from auth.users x) users,
  (select jsonb_agg(to_jsonb(x) order by id) from public.payment_items x) items,
  (select jsonb_agg(to_jsonb(x) order by id) from public.payment_records x) records,
  (select jsonb_agg(to_jsonb(x) order by id) from public.payment_conversions x) conversions`)).rows[0];
try{
  const manifest=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-data-guard-source-manifest.json'),'utf8'));
  assert.equal(Object.keys(manifest.file_sha256).length,63);
  for(const [file,expected] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'Pinned input mismatch: '+file);sourceFiles++;
  }
  const modulePath=process.argv[2]||path.join(root,'scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js');
  const installed=JSON.parse(await readFile(path.resolve(path.dirname(modulePath),'../package.json'),'utf8'));
  assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
  const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));
  const dependency=lock.packages['node_modules/@electric-sql/pglite'];
  assert.equal(dependency.version,'0.5.8');
  assert.equal(dependency.resolved,'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz');
  assert.equal(dependency.integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
  ({db,migrations}=await localDatabase(modulePath));
  assert.equal(migrations.length,54);assert.deepEqual(migrations,manifest.migration_paths.map(p=>path.basename(p)));
  guardSQL=await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_data_guards.sql'),'utf8');
  coverage=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-email-data-guard-coverage.json'),'utf8'));
  const apply=()=>db.exec(guardSQL);
  await check('Offline acknowledgement is required before any guard change',async()=>{
    await assert.rejects(apply(),/EMAIL_DATA_GUARD_OFFLINE_REVIEW_ACK_REQUIRED/);await db.exec('rollback');
  });
  await db.exec("set mushavo.email_data_guard_review='OFFLINE_SOURCE_CANDIDATE'");
  await check('Missing E2 and self-session backend refuses partial guard installation',async()=>{
    await assert.rejects(apply(),/EMAIL_DATA_GUARD_SESSION_BACKEND_REQUIRED/);await db.exec('rollback');
  });
  await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';`);
  for(const f of['security_fr_2_4_email_verification_backend.sql','security_fr_2_4_email_session_predicate.sql'])
    await db.exec(await readFile(path.join(root,'supabase/candidates',f),'utf8'));
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'guard.a@example.invalid',now()),($2,'guard.b@example.invalid',now()),($3,'guard.admin@example.invalid',now())",[A,B,C]);
  for(const [s,u]of[[A1,A],[A2,A],[B1,B],[C1,C]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'guard.admin@example.invalid','super_admin')",[C]);
  WA=(await db.query("select id from public.budget_workspaces where owner_id=$1 and workspace_type='personal'",[A])).rows[0].id;
  WB=(await db.query("select id from public.budget_workspaces where owner_id=$1 and workspace_type='personal'",[B])).rows[0].id;
  await db.query("update public.workspace_settings set base_currency='USD',reporting_currency='USD',default_payment_currency='USD',enabled_currencies=array['USD'],conversion_enabled=true where workspace_id=$1",[WA]);
  for(const [w,u]of[[BA,A],[BB,B]]){
    await db.exec('begin');
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(u,u===A?A1:B1))]);
    await db.query('insert into public.business_public_provision_permits(transaction_id,workspace_id,owner_id,actor_id) values(txid_current(),$1,$2,$2)',[w,u]);
    await db.query("insert into public.budget_workspaces(id,owner_id,workspace_type,name) values($1,$2,'business','Synthetic guard business')",[w,u]);
    await db.query("insert into public.workspace_members(workspace_id,user_id,role) values($1,$2,'business_owner') on conflict(workspace_id,user_id) do update set role='business_owner'",[w,u]);
    await db.query('delete from public.business_public_provision_permits where transaction_id=txid_current() and workspace_id=$1',[w]);
    await db.query("insert into public.workspace_settings(workspace_id,reminder_enabled) values($1,false) on conflict(workspace_id) do update set reminder_enabled=false",[w]);
    await db.query("insert into public.workspace_subscriptions(workspace_id,plan_id,status,billing_period,paid_through_at) select $1,id,'active','monthly',now()+interval '7 days' from public.plans where workspace_type='business' order by code limit 1 on conflict(workspace_id) do update set status='active',paid_through_at=now()+interval '7 days'",[w]);
    await db.exec('commit');
  }
  await db.exec('reset request.jwt.claims');
  proofName='personal/'+A+'/synthetic-proof.pdf';
  await db.query("insert into storage.objects(bucket_id,name,owner,owner_id) values('payment-proofs',$1,$2,$3)",[proofName,A,A]);
  const before=await appSnapshot();
  await check('An ordinary API role cannot install the candidate even with its offline acknowledgement',async()=>{
    await db.exec('set role authenticated');
    try{await assert.rejects(apply(),/EMAIL_DATA_GUARD_POSTGRES_ORIGIN_REQUIRED/);await db.exec('rollback');}
    finally{await db.exec('reset role');}
  });
  await check('A changed routine grant stops installation before modifying any guarded function',async()=>{
    await db.exec('begin;revoke execute on function public.get_public_signup_currencies() from authenticated');
    await assert.rejects(apply(),/EMAIL_DATA_GUARD_UNREVIEWED_ROUTINE_BASELINE/);await db.exec('rollback');
  });
  const original=(await db.query(`select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosrc,p.proacl::text acl,p.proconfig,p.prosecdef,p.provolatile,p.prorettype::text,p.proretset,p.proargdefaults::text from pg_proc p where p.pronamespace='public'::regnamespace`)).rows;
  await check('Actual full-source integration installs 148 guards and 82 restrictive policies with protected metadata assertions',async()=>{
    await apply();assert.deepEqual(await appSnapshot(),before);
  });
  await check('Reinstallation refuses to stack guards or replace an existing integration',async()=>{
    await assert.rejects(apply(),/EMAIL_DATA_GUARD_ALREADY_PRESENT/);await db.exec('rollback');
  });
  await check('All 82 named policies are restrictive, authenticated-only and cover both USING and WITH CHECK',async()=>{
    const p=(await db.query("select schemaname,tablename,permissive,roles,cmd,qual,with_check from pg_policies where policyname='Email verified session required' order by schemaname,tablename")).rows;
    assert.equal(p.length,82);
    assert.deepEqual(p.map(x=>x.schemaname+'.'+x.tablename),coverage.restrictive_policy_relations.map(x=>x.schema+'.'+x.table).sort());
    for(const x of p){assert.equal(x.permissive,'RESTRICTIVE');assert.deepEqual(x.roles,['authenticated']);assert.equal(x.cmd,'ALL');assert.match(x.qual,/email_gate_current_session_verified/);assert.equal(x.qual,x.with_check);}
  });
  await check('Every original public function retains OID, ACL, arguments, defaults, result, volatility and settings',async()=>{
    const after=(await db.query(`select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) arguments,p.prosrc,p.proacl::text acl,p.proconfig,p.prosecdef,p.provolatile,p.prorettype::text,p.proretset,p.proargdefaults::text from pg_proc p where p.pronamespace='public'::regnamespace`)).rows;
    assert.equal(after.length,original.length);
    for(const prior of original){const next=after.find(x=>x.oid===prior.oid);const {prosrc:a,...metadataA}=prior;const {prosrc:b,...metadataB}=next;assert.deepEqual(metadataB,metadataA);}
  });
  const targets=(await db.query(`select p.oid,p.proname,p.proretset,l.lanname,pg_get_function_identity_arguments(p.oid) arguments,
    array(select format_type(t.type_oid,null) from unnest(p.proargtypes) with ordinality t(type_oid,ord) order by t.ord) types
    from pg_proc p join pg_language l on l.oid=p.prolang where p.pronamespace='public'::regnamespace
    and has_function_privilege('authenticated',p.oid,'EXECUTE') and p.prorettype<>'trigger'::regtype
    and left(p.proname,11)<>'email_gate_' and p.proname not in('get_public_plan_catalogue','get_public_signup_currencies','latest_exchange_rate','business_bill_occurrence_date','business_storage_workspace_id') order by p.proname`)).rows;
  const probe=x=>'select * from public.'+x.proname+'('+x.types.map(t=>'null::'+t).join(',')+')';
  await check('Every one of the 148 actual application entrypoints denies a password-only session before original logic',async()=>{
    assert.equal(targets.length,148);
    await user(A,A1,async()=>{for(const x of targets){assert.equal(x.lanname,'plpgsql');await assert.rejects(db.query(probe(x)),expectedDenial,x.proname);authenticatedProbes++;}});
  });
  await check('Every anonymously callable guarded entrypoint denies the actual anonymous role',async()=>{
    const names=new Set(coverage.base_functions.filter(x=>x.classification==='REQUIRE_VERIFIED_APPLICATION_SESSION_BEFORE_ORIGINAL_BODY'&&x.anon_execute).map(x=>x.name));
    await request({role:'anon'},'anon',async()=>{for(const x of targets.filter(x=>names.has(x.proname))){await assert.rejects(db.query(probe(x)),expectedDenial,x.proname);anonymousProbes++;}});
    assert.equal(anonymousProbes,names.size);assert(anonymousProbes>0);
  });
  await check('Unverified existing Personal rows, Business profiles, Admin directory and private file are not released',async()=>{
    await user(A,A1,async()=>{
      for(const q of['select id from public.profiles','select id from public.budget_workspaces','select workspace_id from public.business_profiles','select name from storage.objects'])await deniedRead(()=>db.query(q));
    });
    await user(C,C1,()=>deniedRead(()=>db.query('select id from public.profiles')));
  });
  await check('Forged service, Admin, AAL2 and client verification claims do not bypass the actual authenticated role',async()=>{
    for(const extra of[{role:'service_role'},{role:'supabase_auth_admin'},{aal:'aal2',email_gate_verified:true,platform_role:'super_admin'}])
      await user(A,A1,()=>assert.rejects(db.query('select public.is_app_admin()'),expectedDenial),extra);
  });
  await check('Public catalogue, signup currencies and market rates remain available to anonymous and unverified users',async()=>{
    for(const [role,c]of[['anon',{role:'anon'}],['authenticated',claims()]])await request(c,role,async()=>{
      assert((await db.query("select * from public.get_public_plan_catalogue('USD')")).rows.length>0);
      assert((await db.query('select * from public.get_public_signup_currencies()')).rows.length>0);
      assert.equal((await db.query("select * from public.latest_exchange_rate('USD','USD',now())")).rows[0].exchange_rate,'1');
    });
  });
  await check('The five reviewed public or pure exceptions retain their exact source bodies',async()=>{
    for(const name of Object.keys(coverage.public_or_pure_exceptions))assert.equal((await db.query('select prosrc from pg_proc where oid=$1::oid',[original.find(x=>x.proname===name).oid])).rows[0].prosrc,original.find(x=>x.proname===name).prosrc);
    await user(A,A1,async()=>{
      assert((await db.query("select public.business_bill_occurrence_date(current_date,'monthly',1,1) value")).rows[0].value);
      assert.equal((await db.query("select public.business_storage_workspace_id('not-a-workspace/file') value")).rows[0].value,null);
    });
  });
  await check('The service-only mail-challenge path can establish proof while application gates are enforced',async()=>{
    await verify(A,A1);assert.equal(await user(A,A1,async()=>(await db.query('select public.email_gate_current_session_verified() value')).rows[0].value),true);
  });
  await check('A different session of the same account remains denied after the first session verifies',async()=>{
    await user(A,A2,()=>assert.rejects(db.query('select public.provision_my_budget_workspace()'),expectedDenial));
  });
  await check('Verified Personal access retains ownership isolation and the actual provisioning RPC works',async()=>{
    await user(A,A1,async()=>{
      assert.equal((await db.query('select public.provision_my_budget_workspace() value')).rows[0].value,WA);
      assert.deepEqual((await db.query('select id from public.profiles')).rows,[{id:A}]);
      assert.deepEqual((await db.query('select id from public.budget_workspaces where id=$1',[WB])).rows,[]);
    });
  });
  await check('Verified one-time-payment RPC preserves its nested entitlement, ownership and finance checks',async()=>{
    const args=[WA,'Synthetic guarded payment','Other',1,'USD',new Date().toISOString().slice(0,10),'Cash',null,null,null,proofName,'synthetic-proof.pdf','application/pdf',10];
    const row=await user(A,A1,async()=>(await db.query('select * from public.create_completed_one_time_payment('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args)).rows[0]);
    item=row.payment_item_id;record=row.payment_record_id;assert(item&&record);
    assert.equal((await db.query('select count(*)::int value from public.payment_conversions where payment_record_ref=$1',[record])).rows[0].value,1);
    await user(A,A1,async()=>{assert.equal((await db.query('select id from public.payment_records where id=$1',[record])).rows[0].id,record);});
    args[0]=WB;await user(A,A1,()=>assert.rejects(db.query('select * from public.create_completed_one_time_payment('+args.map((_,i)=>'$'+(i+1)).join(',')+')',args),/COMPLETED_PAYMENT_WORKSPACE_REQUIRED/));
  });
  await check('Actual direct-table UPDATE works after proof and the unverified same-account session has no effect',async()=>{
    await user(A,A1,()=>db.query("update public.payment_items set name='Verified update',status='inactive' where id=$1",[item]));
    await user(A,A2,()=>deniedRead(()=>db.query("update public.payment_items set name='UNVERIFIED' where id=$1 returning id",[item])));
    assert.equal((await db.query('select name from public.payment_items where id=$1',[item])).rows[0].name,'Verified update');
  });
  await check('Unverified direct INSERT cannot use correct owner and workspace values to bypass WITH CHECK',async()=>{
    const beforeItems=(await db.query('select count(*)::int value from public.payment_items')).rows[0].value;
    await user(A,A2,()=>assert.rejects(db.query("insert into public.payment_items(workspace_id,owner_id,created_by,visibility,name,amount,currency,status) values($1,$2,$2,'personal','UNVERIFIED INSERT',1,'USD','inactive')",[WA,A]),e=>e.code==='42501'));
    assert.equal((await db.query('select count(*)::int value from public.payment_items')).rows[0].value,beforeItems);
  });
  await check('Private Storage metadata access requires proof and still enforces original path ownership',async()=>{
    assert.equal((await user(A,A1,()=>db.query('select name from storage.objects'))).rows[0].name,proofName);
    await verify(B,B1);await user(B,B1,()=>deniedRead(()=>db.query('select name from storage.objects where name=$1',[proofName])));
  });
  await check('Business owner permissions and role snapshot work after proof without granting the foreign Business',async()=>{
    await user(A,A1,async()=>{
      assert.equal((await db.query("select public.business_has_permission($1,'workspace.view') value",[BA])).rows[0].value,true);
      assert.equal((await db.query("select public.business_has_permission($1,'workspace.view') value",[BB])).rows[0].value,false);
      assert((await db.query('select public.business_roles_snapshot($1) value',[BA])).rows[0].value);
      await assert.rejects(db.query('select public.business_roles_snapshot($1)',[BB]));
    });
  });
  await check('All 36 converted SQL functions execute behind proof with original NULL-input semantics or purpose denials',async()=>{
    const names=coverage.base_functions.filter(x=>x.source_language==='sql'&&x.classification==='REQUIRE_VERIFIED_APPLICATION_SESSION_BEFORE_ORIGINAL_BODY').map(x=>x.name);
    await user(A,A1,async()=>{
      for(const x of targets.filter(x=>names.includes(x.proname))){
        try{await db.query(probe(x));}catch(e){assert.notEqual(e.message,'EMAIL_VERIFICATION_REQUIRED');assert(['P0001','42501'].includes(e.code),x.proname+': '+e.code);}
        sqlPositiveProbes++;
      }
    });assert.equal(sqlPositiveProbes,36);
  });
  await check('A verified ordinary account remains non-Admin and receives no rows from the Admin subscription monitor',async()=>{
    await user(A,A1,async()=>{assert.equal((await db.query('select public.is_app_admin() value')).rows[0].value,false);assert.deepEqual((await db.query('select * from public.admin_subscription_monitor()')).rows,[]);});
  });
  await check('A platform Admin must verify first and then retains its existing role-based directory access',async()=>{
    await user(C,C1,()=>assert.rejects(db.query('select public.admin_subscription_monitor()'),expectedDenial));
    await verify(C,C1);await user(C,C1,async()=>{
      assert.equal((await db.query('select public.is_app_admin() value')).rows[0].value,true);
      assert.equal((await db.query('select id from public.profiles')).rows.length,3);
      await db.query('select * from public.admin_subscription_monitor()');
    });
  });
  await check('A genuine modeled service SET ROLE and service JWT retain permitted helper and scheduler paths',async()=>{
    await service(async()=>{
      assert.equal((await db.query('select public.my_account_suspended() value')).rows[0].value,false);
      await db.query('select public.enqueue_due_business_bill_reminders(now())');
    });
    await db.query('select public.enqueue_due_business_bill_reminders(now())');
  });
  await check('Service-only scheduler ACL remains unavailable to authenticated and anonymous callers',async()=>{
    for(const [role,c]of[['authenticated',claims()],['anon',{role:'anon'}]])await request(c,role,()=>assert.rejects(db.query('select public.enqueue_due_business_bill_reminders(now())'),/permission denied/));
  });
  await check('The new private application-context helper is not directly callable by any API role',async()=>{
    for(const role of['anon','authenticated','service_role'])assert.equal((await db.query("select has_function_privilege($1,'mushavo_email_auth.require_application_session()','EXECUTE') value",[role])).rows[0].value,false);
  });
  await check('Password invalidation immediately denies actual application RPC and table access again',async()=>{
    await db.query("update auth.users set encrypted_password='SYNTHETIC_NEW_PASSWORD_HASH' where id=$1",[A]);
    await user(A,A1,()=>assert.rejects(db.query('select public.provision_my_budget_workspace()'),expectedDenial));
    await user(A,A1,()=>deniedRead(()=>db.query('select id from public.payment_records where id=$1',[record])));
    assert.equal((await user(C,C1,()=>db.query('select public.is_app_admin() value'))).rows[0].value,true);
  });
  await check('Verified owner deletion still cascades the selected record conversion through the existing FK',async()=>{
    await verify(A,A1);
    await user(A,A1,()=>db.query('delete from public.payment_items where id=$1',[item]));
    assert.equal((await db.query('select count(*)::int value from public.payment_records where id=$1',[record])).rows[0].value,0);
    assert.equal((await db.query('select count(*)::int value from public.payment_conversions where payment_record_ref=$1',[record])).rows[0].value,0);
  });
  await check('Modeled Auth middleware signup callback still creates an unverified new Personal account',async()=>{
    await db.exec('create role supabase_auth_admin login;grant usage on schema auth to supabase_auth_admin;grant insert on auth.users to supabase_auth_admin');
    await db.exec('begin;set local session authorization supabase_auth_admin');
    try{await db.query("insert into auth.users(id,email) values($1,'new.auth.callback@example.invalid')",[id(899)]);await db.exec('commit');}
    catch(error){await db.exec('rollback');throw error;}
    finally{await db.exec('set session authorization postgres;reset role');}
    assert.equal((await db.query('select count(*)::int value from public.profiles where id=$1',[id(899)])).rows[0].value,1);
    assert.equal((await db.query("select count(*)::int value from public.budget_workspaces where owner_id=$1 and workspace_type='personal'",[id(899)])).rows[0].value,1);
    assert.equal((await db.query('select count(*)::int value from mushavo_email_auth.session_proofs where user_id=$1',[id(899)])).rows[0].value,0);
  });
  await check('An unprivileged direct SQL pool identity receives no trusted-internal exemption',async()=>{
    await db.exec('create role authenticator login;grant usage on schema public to authenticator;grant execute on function public.is_app_admin() to authenticator');
    await db.exec('begin;set local session authorization authenticator');
    try{await assert.rejects(db.query('select public.is_app_admin()'),expectedDenial);}
    finally{await db.exec('rollback;set session authorization postgres;reset role');}
  });
}catch(error){
  failure={code:error.code||'ASSERTION',problem:'LOCAL_DATABASE_GUARD_CHECK_REVIEW_REQUIRED'};
}finally{if(db)await db.close();}
const ok=!failure&&cases.length===32;
console.log(JSON.stringify({
  stage_step:'FR.2.4.E4.3_DATABASE_GUARDS',
  result:ok?'OFFLINE_ACTUAL_APPLICATION_RLS_RPC_AND_MODELED_STORAGE_GUARDS_SCOPED_PASS':'OFFLINE_DATABASE_GUARD_REVIEW_REQUIRED',
  scope:'FULL54_SOURCE_E2_SELF_SESSION_COMPONENT_AND_ACTUAL148_RPC_82_POLICY_INTEGRATION_WITH_SYNTHETIC_AUTH_AND_STORAGE_MODEL',
  node_version:process.version,pglite_version:'0.5.8',migration_count:migrations?.length,
  source_files_SHA256_verified:sourceFiles,tests:cases.length,pass:cases.filter(x=>x.result==='PASS').length,
  fail:cases.filter(x=>x.result==='FAIL').length,cases,failure,
  actual_authenticated_RPC_denial_probes:authenticatedProbes,
  actual_anonymous_RPC_denial_probes:anonymousProbes,
  converted_SQL_verified_session_NULL_input_probes:sqlPositiveProbes,
  guarded_application_RPCs:148,restrictive_policy_relations:82,
  every_RPC_full_positive_operation_lifecycle_verified:false,
  actual_JWT_or_hosted_Storage_provider_schema_verified:false,
  canonical_schema_versioned_migration_Edge_Admin_UI_and_Pages_integration_complete:false,
  actual_hosted_requests:0,actual_email_or_notification_dispatched:false,
  hosted_enforcement_installed:false,hosted_acceptance:false,findings_closed:[],
  production_or_native_changed:false,APK_update_deferred:true,exit_code:ok?0:1
},null,2));
process.exitCode=ok?0:1;
