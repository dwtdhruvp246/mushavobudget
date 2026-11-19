import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
createRequire(import.meta.url)('./offline-test-network.cjs');

const sourcePath='supabase/candidates/security_fr_2_4_email_session_predicate.sql';
const manifestPath='docs/security-audit/security-fr-2-email-session-source-manifest.json';
const cases=[];
let db,migrations,failure,verifiedFiles=0;
const check=async(title,fn)=>{
  try{await fn();cases.push({title,result:'PASS'});}
  catch(error){cases.push({title,result:'FAIL'});throw error;}
};
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const [A,B,C]=[id(701),id(702),id(703)];
const [A1,A2,B1,C1]=[id(711),id(712),id(713),id(714)];
const claims=(user=A,session=A1,extra={})=>({
  sub:user,session_id:session,role:'authenticated',
  exp:Math.floor(Date.now()/1000)+3600,...extra
});
async function request(value,role='authenticated',action){
  await db.query("select set_config('request.jwt.claims',$1,false)",[
    typeof value==='string'?value:JSON.stringify(value)
  ]);
  await db.exec(`set role ${role}`);
  try{return await action();}
  finally{await db.exec('reset role');}
}
const predicate=value=>request(value,'authenticated',async()=>
  (await db.query('select public.email_gate_current_session_verified() value')).rows[0].value);
const service=async(name,args)=>{
  await db.exec('set role service_role');
  try{return(await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args)).rows[0].value;}
  finally{await db.exec('reset role');}
};
async function verify(user,session,remember=false){
  await db.query("update mushavo_email_auth.account_state set next_send_at='-infinity' where user_id=$1",[user]);
  await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[user]);
  const challenge=randomUUID();
  assert.equal((await service('email_gate_begin_challenge',[user,session,challenge,'1'.repeat(64),'review_v1',remember])).result,'PENDING_DELIVERY');
  assert.equal((await service('email_gate_set_delivery',[user,session,challenge,true])).result,'READY');
  assert.equal((await service('email_gate_verify_challenge',[user,session,challenge,'1'.repeat(64),remember?'2'.repeat(64):null])).result,'VERIFIED');
}
async function catalog(){return(await db.query(`select
  (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p
    where p.pronamespace='public'::regnamespace
    and p.proname not in('email_gate_current_session_verified','email_gate_require_current_session')) functions,
  (select jsonb_agg(to_jsonb(p) order by p.oid) from pg_policy p) policies,
  (select jsonb_agg(to_jsonb(t) order by t.oid) from pg_trigger t) triggers`)).rows[0];}
try{
  const manifest=JSON.parse(await readFile(path.join(root,manifestPath),'utf8'));
  assert.equal(Object.keys(manifest.file_sha256).length,61);
  for(const [file,expected] of Object.entries(manifest.file_sha256)){
    assert(!path.isAbsolute(file)&&!file.split('/').includes('..'));
    assert.equal(createHash('sha256').update(await readFile(path.join(root,file))).digest('hex'),expected,'Pinned source mismatch: '+file);
    verifiedFiles++;
  }
  const toolRoot=path.join(root,'scripts/fixtures/email-session-review-tools');
  const tools=JSON.parse(await readFile(path.join(toolRoot,'package.json'),'utf8'));
  const lock=JSON.parse(await readFile(path.join(toolRoot,'package-lock.json'),'utf8'));
  const entry=lock.packages['node_modules/@electric-sql/pglite'];
  assert.equal(tools.dependencies['@electric-sql/pglite'],'0.5.8');
  assert.equal(Object.keys(lock.packages).length,2);
  assert.equal(entry.version,'0.5.8');
  assert.equal(entry.resolved,'https://registry.npmjs.org/@electric-sql/pglite/-/pglite-0.5.8.tgz');
  assert.equal(entry.integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
  const modulePath=process.argv[2]||path.join(toolRoot,'node_modules/@electric-sql/pglite/dist/index.js');
  const installed=JSON.parse(await readFile(path.resolve(path.dirname(modulePath),'../package.json'),'utf8'));
  assert.equal(installed.name,'@electric-sql/pglite');assert.equal(installed.version,'0.5.8');
  ({db,migrations}=await localDatabase(modulePath));
  assert.deepEqual(migrations,manifest.migration_paths.map(p=>path.basename(p)));
  assert.equal(migrations.length,54);
  const sql=await readFile(path.join(root,sourcePath),'utf8');
  const apply=()=>db.exec(sql);
  await check('Missing offline acknowledgement refuses new predicate before any change',async()=>{
    await assert.rejects(apply(),/EMAIL_SESSION_OFFLINE_REVIEW_ACK_REQUIRED/);await db.exec('rollback');
  });
  await db.exec("set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE'");
  await check('Backend prerequisite must exist; the session candidate cannot install an incomplete gate',async()=>{
    await assert.rejects(apply(),/EMAIL_SESSION_BACKEND_REQUIRED/);await db.exec('rollback');
  });
  // Explicit local stand-ins for provider-managed Auth fields; never migrate Auth here.
  await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,
    add column encrypted_password text,add column banned_until timestamptz;
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';`);
  await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_verification_backend.sql'),'utf8'));
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'session.a@example.invalid',now()),($2,'session.b@example.invalid',now()),($3,'session.admin@example.invalid',now())",[A,B,C]);
  for(const [s,u]of[[A1,A],[A2,A],[B1,B],[C1,C]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[s,u]);
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'session.admin@example.invalid','super_admin')",[C]);
  const before=await catalog();
  await check('Actual no-argument session functions compile without changing prior public routines, RLS or triggers',async()=>{
    await apply();assert.deepEqual(await catalog(),before);
  });
  await check('Existing predicate names or overloads are never overwritten by a second candidate installation',async()=>{
    await assert.rejects(apply(),/EMAIL_SESSION_ENTRYPOINT_ALREADY_EXISTS/);await db.exec('rollback');
  });
  await check('Only authenticated can execute the two public wrappers; all API roles lack the private helper',async()=>{
    const rows=(await db.query(`select p.oid,p.proname,n.nspname,p.pronargs,p.prosecdef,p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where (n.nspname='mushavo_email_auth' and p.proname='current_session_verified')
        or(n.nspname='public' and p.proname in('email_gate_current_session_verified','email_gate_require_current_session'))`)).rows;
    assert.equal(rows.length,3);
    for(const row of rows){
      assert.equal(row.pronargs,0);assert.equal(row.prosecdef,true);assert.deepEqual(row.proconfig,['search_path=pg_catalog']);
      for(const role of['anon','authenticated','service_role'])assert.equal(
        (await db.query("select has_function_privilege($1,$2::oid,'EXECUTE') value",[role,row.oid])).rows[0].value,
        row.nspname==='public'&&role==='authenticated'
      );
    }
  });
  await check('Password-only ordinary and platform Admin sessions both fail without stored verification',async()=>{
    assert.equal(await predicate(claims()),false);assert.equal(await predicate(claims(C,C1)),false);
  });
  await check('Forged email-verified, AAL2, Admin-role and remembered-until claims do not create a proof',async()=>{
    assert.equal(await predicate(claims(A,A1,{email_verified:true,email_gate_verified:true,aal:'aal2',platform_role:'super_admin',remembered_until:'2099-01-01'})),false);
  });
  await check('Proof established by the actual service challenge/verify SQL authorizes only its exact session',async()=>{
    await verify(A,A1,true);
    assert.equal(await predicate(claims()),true);assert.equal(await predicate(claims(A,A2)),false);
    assert.equal(await predicate(claims(B,B1)),false);assert.equal(await predicate(claims(C,C1)),false);
  });
  await check('Foreign-account session substitution and nonexistent session are denied',async()=>{
    assert.equal(await predicate(claims(B,A1)),false);assert.equal(await predicate(claims(A,B1)),false);
    assert.equal(await predicate(claims(A,id(799))),false);
  });
  await check('Missing, malformed, wrong-type and null request claims safely return false',async()=>{
    for(const value of['','not-json','[]','null','{}',claims(A,null),claims(A,[]),claims('bad-uuid'),claims(null)])
      assert.equal(await predicate(value),false);
  });
  await check('Expired, missing, string, fractional, oversized and negative JWT expiry are denied',async()=>{
    for(const exp of[0,Math.floor(Date.now()/1000)-1,null,'9999999999',12.5,1e30,-1])
      assert.equal(await predicate(claims(A,A1,{exp})),false);
    const c=claims();delete c.exp;assert.equal(await predicate(c),false);
  });
  await check('Service/anonymous token roles cannot become a user proof through the callable wrapper',async()=>{
    for(const role of['service_role','anon',null])assert.equal(await predicate(claims(A,A1,{role})),false);
    for(const role of['anon','service_role'])await request(claims(),role,async()=>{
      await assert.rejects(db.exec('select public.email_gate_current_session_verified()'),/permission denied/);
    });
  });
  await check('Conflicting legacy Auth sub/role settings cannot borrow a valid proof',async()=>{
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[B]);
    assert.equal(await predicate(claims()),false);await db.exec('reset request.jwt.claim.sub');
    await db.exec("set request.jwt.claim.role='service_role'");
    assert.equal(await predicate(claims()),false);await db.exec('reset request.jwt.claim.role');
  });
  await check('Assertion returns a fixed permission denial for an unverified session and accepts the verified one',async()=>{
    await request(claims(A,A2),'authenticated',async()=>{
      await assert.rejects(db.exec('select public.email_gate_require_current_session()'),e=>e.code==='42501'&&e.message==='EMAIL_VERIFICATION_REQUIRED');
    });
    await request(claims(),'authenticated',()=>db.exec('select public.email_gate_require_current_session()'));
  });
  await check('A restrictive policy on actual profiles denies password-only reads while preserving existing owner rules',async()=>{
    await db.exec(`create policy email_session_review_guard on public.profiles as restrictive for select to authenticated
      using((select public.email_gate_current_session_verified()));`);
    const read=async c=>request(c,'authenticated',async()=>(await db.query('select id from public.profiles order by id')).rows);
    assert.deepEqual(await read(claims(A,A2)),[]);assert.deepEqual(await read(claims()),[{id:A}]);
  });
  await check('A guarded definer still checks the request session and keeps an independent target-ownership check',async()=>{
    // Representative local integration, not a replacement of any application RPC.
    await db.exec(`create function public.email_session_review_profile(p_user uuid) returns uuid
      language plpgsql security definer set search_path=pg_catalog as $test$
      begin
        perform public.email_gate_require_current_session();
        if p_user is distinct from auth.uid() then raise exception using errcode='42501',message='OWNER_REQUIRED';end if;
        return(select id from public.profiles where id=p_user);
      end;$test$;
      revoke all on function public.email_session_review_profile(uuid) from public,anon,service_role;
      grant execute on function public.email_session_review_profile(uuid) to authenticated;`);
    await request(claims(A,A2),'authenticated',async()=>{
      await assert.rejects(db.query('select public.email_session_review_profile($1)',[A]),/EMAIL_VERIFICATION_REQUIRED/);
    });
    await request(claims(),'authenticated',async()=>{
      assert.equal((await db.query('select public.email_session_review_profile($1) value',[A])).rows[0].value,A);
      await assert.rejects(db.query('select public.email_session_review_profile($1)',[B]),/OWNER_REQUIRED/);
    });
  });
  await check('A platform Admin gets the same verification gate, then retains only its existing Admin authorization',async()=>{
    const read=()=>db.query('select id from public.profiles order by id');
    assert.deepEqual(await request(claims(C,C1),'authenticated',async()=>(await read()).rows),[]);
    await verify(C,C1);assert.equal(await predicate(claims(C,C1)),true);
    assert.equal((await request(claims(C,C1),'authenticated',read)).rows.length,3);
    assert.equal((await db.query('select count(*)::int value from public.app_admins where user_id=$1',[A])).rows[0].value,0);
  });
  await check('Day-seven device expiry does not expire an open approved session or approve a fresh session',async()=>{
    await db.query("update mushavo_email_auth.devices set verified_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1",[A]);
    assert.equal(await predicate(claims()),true);assert.equal(await predicate(claims(A,A2)),false);
    assert.equal((await service('email_gate_restore_device',[A,A2,'2'.repeat(64)])).result,'CODE_REQUIRED');
  });
  await check('Real session timebox invalidates an existing proof and restoring the timebox preserves other checks',async()=>{
    await db.query("update auth.sessions set not_after=now()-interval '1 minute' where id=$1",[A1]);
    assert.equal(await predicate(claims()),false);
    await db.query('update auth.sessions set not_after=null where id=$1',[A1]);
    assert.equal(await predicate(claims()),true);
  });
  await check('Security-version mismatch denies a stored proof without trusting client verification flags',async()=>{
    await db.query('update mushavo_email_auth.account_state set security_version=security_version+1 where user_id=$1',[A]);
    assert.equal(await predicate(claims()),false);await verify(A,A1);assert.equal(await predicate(claims()),true);
  });
  await check('Password changes invalidate the current proof without changing another approved account',async()=>{
    await db.query("update auth.users set encrypted_password='SYNTHETIC_CHANGED' where id=$1",[A]);
    assert.equal(await predicate(claims()),false);assert.equal(await predicate(claims(C,C1)),true);
  });
  await check('Profile suspension invalidates proof, and reactivation does not revive it',async()=>{
    await verify(A,A1);
    await db.exec("set request.jwt.claim.role='service_role'");
    await db.query("update public.profiles set account_status='suspended' where id=$1",[A]);
    await db.exec('reset request.jwt.claim.role');assert.equal(await predicate(claims()),false);
    await db.exec("set request.jwt.claim.role='service_role'");
    await db.query("update public.profiles set account_status='active' where id=$1",[A]);
    await db.exec('reset request.jwt.claim.role');assert.equal(await predicate(claims()),false);
  });
  await check('Deleting the real modeled Auth session cascades its proof and leaves another account approved',async()=>{
    await verify(A,A1);await db.query('delete from auth.sessions where id=$1',[A1]);
    assert.equal(await predicate(claims()),false);assert.equal(await predicate(claims(C,C1)),true);
    assert.equal((await db.query('select count(*)::int value from mushavo_email_auth.session_proofs where session_id=$1',[A1])).rows[0].value,0);
  });
  await check('Application policies and synthetic definer used for integration are removed before final metadata comparison',async()=>{
    await db.exec('drop policy email_session_review_guard on public.profiles;drop function public.email_session_review_profile(uuid)');
    assert.deepEqual(await catalog(),before);
  });
}catch(error){failure={code:error.code||'ASSERTION',problem:'LOCAL_SOURCE_OR_SQL_CHECK_REVIEW_REQUIRED'};}
finally{if(db)await db.close();}
const ok=!failure&&cases.length===24;
console.log(JSON.stringify({
  stage_step:'FR.2.4.E4.2_SESSION_PREDICATE',
  result:ok?'OFFLINE_ACTUAL_SESSION_PREDICATE_AND_REPRESENTATIVE_GUARDS_SCOPED_PASS':'OFFLINE_SESSION_PREDICATE_REVIEW_REQUIRED',
  scope:'FULL54_MIGRATIONS_E2_BACKEND_NEW_SELF_SESSION_SQL_AND_LOCAL_PROFILE_RLS_SYNTHETIC_DEFINER_NOT_APPLICATIONWIDE_GUARDS',
  node_version:process.version,pglite_version:'0.5.8',migration_count:migrations?.length,
  source_files_SHA256_verified:verifiedFiles,tests:cases.length,
  pass:cases.filter(c=>c.result==='PASS').length,fail:cases.filter(c=>c.result==='FAIL').length,
  cases,failure,exit_code:ok?0:1,
  modeled_Auth_claims_not_actual_JWT_signature_validation:true,
  actual_provider_Auth_JWT_or_hosted_SQL_verified:false,
  complete_application_RLS_RPC_Storage_Edge_Admin_UI_guards_integrated:false,
  canonical_schema_or_versioned_migration_integrated:false,
  actual_hosted_requests:0,email_dispatched:false,
  hosted_enforcement_installed:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]
},null,2));
process.exitCode=ok?0:1;
