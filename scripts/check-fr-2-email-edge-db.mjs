// Actual SQL proof checks behind real Edge entrypoints; provider/SDK transport is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {edgeHarness,guardedNames,validAdminBody,validBusinessBody,actor} from '../tests/helpers/fr-2-email-edge-harness.mjs';
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_EDGE_PGLITE);
const session='00000000-0000-4000-8000-000000000911';
const freshSession='00000000-0000-4000-8000-000000000912';
let selectedSession=session;
const noEffects=c=>{
  for(const k of['reads','writes','userRPC','serviceRPC','mail','push','provider'])assert.equal(c[k].length,0,k);
};
async function context(role,claims,fn){
  await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(claims)]);await db.exec('set role '+role);
  try{return await fn();}finally{await db.exec('reset role;reset request.jwt.claims');}
}
async function proofRPC(name,args){
  assert.equal(name,'email_gate_current_session_verified');assert.equal(args,undefined);
  return await context('authenticated',{sub:actor,session_id:selectedSession,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600},async()=>{
    try{return {data:(await db.query('select public.email_gate_current_session_verified() value')).rows[0].value,error:null};}
    catch{return {data:null,error:{code:'SYNTHETIC_SQL_DENIAL'}};}
  });
}
const body=name=>name==='invite-admin-user'?validAdminBody:name==='invite-business-member'?validBusinessBody:{};
test('Full54 plus actual E2, self-session and application guards compile before Edge integration',async()=>{
  assert.equal(migrations.length,54);
  await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;
    create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);
    set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_session_review='OFFLINE_SOURCE_CANDIDATE';set mushavo.email_data_guard_review='OFFLINE_SOURCE_CANDIDATE';`);
  for(const file of['security_fr_2_4_email_verification_backend.sql','security_fr_2_4_email_session_predicate.sql'])await db.exec(await readFile(path.join(root,'supabase/candidates',file),'utf8'));
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'edge.actor@example.invalid',now())",[actor]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$3),($2,$3)',[session,freshSession,actor]);
  await db.query("insert into public.app_admins(user_id,email,role) values($1,'edge.actor@example.invalid','super_admin')",[actor]);
  await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_data_guards.sql'),'utf8'));
});
test('All four actual handlers reject the actual SQL password-only proof before every privileged port',async()=>{
  for(const name of guardedNames){
    const h=await edgeHarness(name,{proofRPC});assert.equal((await h.request({body:body(name)})).status,403);noEffects(h.calls);
  }
});
test('Actual challenge/verification SQL permits all four selected legitimate handler controls',async()=>{
  const challenge=randomUUID();
  const call=(name,args)=>context('service_role',{role:'service_role'},async()=>(await db.query('select public.'+name+'('+args.map((_,i)=>'$'+(i+1)).join(',')+') value',args)).rows[0].value);
  assert.equal((await call('email_gate_begin_challenge',[actor,session,challenge,'1'.repeat(64),'edge_v1',false])).result,'PENDING_DELIVERY');
  assert.equal((await call('email_gate_set_delivery',[actor,session,challenge,true])).result,'READY');
  assert.equal((await call('email_gate_verify_challenge',[actor,session,challenge,'1'.repeat(64),null])).result,'VERIFIED');
  for(const name of guardedNames){const h=await edgeHarness(name,{proofRPC});assert.equal((await h.request({body:body(name)})).status,200);assert.equal(h.calls.proof.length,1);}
});
test('A second genuine modeled session cannot reuse the same account first-session proof',async()=>{
  selectedSession=freshSession;
  for(const name of guardedNames){const h=await edgeHarness(name,{proofRPC});assert.equal((await h.request({body:body(name)})).status,403);noEffects(h.calls);}
  selectedSession=session;
});
test('Actual password invalidation removes proof while the synthetic provider still accepts identity',async()=>{
  await db.query("update auth.users set encrypted_password='SYNTHETIC_NEW_HASH' where id=$1",[actor]);
  for(const name of guardedNames){const h=await edgeHarness(name,{proofRPC});assert.equal((await h.request({body:body(name)})).status,403);noEffects(h.calls);}
});
test('An unavailable actual user RPC grant fails503 instead of falling back to service authorization',async()=>{
  await db.exec('revoke execute on function public.email_gate_current_session_verified() from authenticated');
  try{
    for(const name of guardedNames){const h=await edgeHarness(name,{proofRPC});assert.equal((await h.request({body:body(name)})).status,503);noEffects(h.calls);}
  }finally{await db.exec('grant execute on function public.email_gate_current_session_verified() to authenticated');await db.close();}
});
