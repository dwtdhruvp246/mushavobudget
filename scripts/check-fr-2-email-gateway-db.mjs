import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {createBackendAdapter,createEmailGateway,STAGING_PROJECT,STAGING_ORIGIN} from '../supabase/functions/_shared/email-verification-gateway.mjs';
import {createZohoCodeMailer} from '../supabase/functions/_shared/email-verification-zoho.mjs';
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const A=id(801),B=id(802),A1=id(811),A2=id(812),A3=id(813),B1=id(821),B2=id(822);
const {db,migrations}=await localDatabase(process.env.MUSHAVO_EMAIL_GATEWAY_PGLITE);
const origin='https://'+STAGING_PROJECT+'.supabase.co',pepper=new Uint8Array(32).fill(42);
const sendState={fail:false},calls=[];let latestCode,latestChallenge,cookie;
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
const rpcShape={begin_challenge:['p_user','p_session','p_challenge','p_code_mac','p_key_version','p_remember'],
 set_delivery:['p_user','p_session','p_challenge','p_delivered'],challenge_context:['p_user','p_session','p_challenge'],
 verify_challenge:['p_user','p_session','p_challenge','p_code_mac','p_device_digest'],restore_device:['p_user','p_session','p_device_digest'],
 revoke_device:['p_user','p_session','p_device_digest'],revoke_all:['p_user','p_session'],session_status:['p_user','p_session']};
const fetcher=async(url,init)=>{
 calls.push(url);assert.equal(init.redirect,'manual');
 if(url===origin+'/auth/v1/user') {
  // Explicit synthetic Auth port. This test does not establish provider JWT validation.
  const c=JSON.parse(Buffer.from(init.headers.authorization.slice(7).split('.')[1],'base64url').toString());
  return json({id:c.sub,email:c.sub===A?'primary@example.invalid':'secondary@example.invalid',email_confirmed_at:new Date().toISOString()});
 }
 if(url.startsWith(origin+'/rest/v1/rpc/email_gate_')) {
  const name=url.split('email_gate_')[1],body=JSON.parse(init.body),keys=rpcShape[name];assert(keys);
  assert.deepEqual(Object.keys(body).sort(),keys.slice().sort());assert.equal(init.headers.apikey,'sb_secret_SYNTHETIC');
  await db.exec('set role service_role');
  try {return json((await db.query('select public.email_gate_'+name+'('+keys.map((_,i)=>'$'+(i+1)).join(',')+') value',keys.map(k=>body[k]))).rows[0].value);}
  catch {return json({message:'SANITIZED_LOCAL_SQL_REFUSAL'},400);}
  finally {await db.exec('reset role');}
 }
 if(url==='https://accounts.zoho.com/oauth/v2/token')return json({access_token:'SYNTHETIC_ZOHO_TOKEN',expires_in:3600});
 if(url==='https://mail.zoho.com/api/accounts/12345678/messages') {
  latestCode=JSON.parse(init.body).content.match(/is (\d{6})\./)[1];
  return json({status:{code:sendState.fail?500:200}});
 }
 throw Error('NETWORK_OUTSIDE_FIXED_PORTS');
};
const adapter=createBackendAdapter({fetcher,publishableKey:'sb_publishable_SYNTHETIC',serviceKey:'sb_secret_SYNTHETIC'});
const mailer=createZohoCodeMailer({fetcher,config:{mailOrigin:'https://mail.zoho.com',accountsOrigin:'https://accounts.zoho.com',
 accountId:'12345678',from:'notification@example.invalid',clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_CLIENT_SECRET',
 refreshToken:'SYNTHETIC_REFRESH_TOKEN',allowedRecipients:['primary@example.invalid','secondary@example.invalid']}});
const handle=createEmailGateway({adapter,mailer,keyring:new Map([['v1',pepper]]),currentKeyVersion:'v1',limit:async()=>({success:true})});
function request(user,session,route,body={},credential) {
 const c={sub:user,session_id:session,role:'authenticated',aud:'authenticated',iss:origin+'/auth/v1',exp:Math.floor(Date.now()/1000)+3600};
 const token=Buffer.from('{"alg":"HS256"}').toString('base64url')+'.'+Buffer.from(JSON.stringify(c)).toString('base64url')+'.c3ludGhldGlj';
 const headers={'content-type':'application/json',origin:STAGING_ORIGIN,'x-mushavo-csrf':'email-v1','cf-connecting-ip':'192.0.2.2',authorization:'Bearer '+token};
 if(credential)headers.cookie=credential;
 return new Request(STAGING_ORIGIN+'/api/email-verification/'+route,{method:'POST',headers,body:JSON.stringify(body)});
}
const budget=async user=>{
 // Privileged synthetic fixture clock/budget changes only, never a user API.
 await db.query("update mushavo_email_auth.account_state set next_send_at=now()-interval '1 minute' where user_id=$1",[user]);
 await db.query('delete from mushavo_email_auth.send_events where user_id=$1',[user]);
};
const status=async(user,session)=>(await(await handle(request(user,session,'status'))).json()).verified;
test('Gateway/database integration uses full54 unchanged migrations plus actual candidate SQL with modeled Auth',async()=>{
 assert.equal(migrations.length,54);
 await db.exec(`alter table auth.users add column email_confirmed_at timestamptz,add column encrypted_password text,add column banned_until timestamptz;
 create table auth.sessions(id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,not_after timestamptz);`);
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'primary@example.invalid',now()),($2,'secondary@example.invalid',now())",[A,B]);
 for(const [session,user]of [[A1,A],[A2,A],[A3,A],[B1,B],[B2,B]])await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[session,user]);
 await db.exec("set mushavo.email_backend_review='OFFLINE_SOURCE_CANDIDATE'");
 await db.exec(await readFile(path.join(root,'supabase/candidates/security_fr_2_4_email_verification_backend.sql'),'utf8'));
 assert.equal(await status(A,A1),false);
});
test('Real SQL challenge becomes ready only after actual mail adapter accepts its synthetic provider response',async()=>{
 const r=await handle(request(A,A1,'begin',{remember:true}));assert.equal(r.status,200);latestChallenge=(await r.json()).challengeId;
 const row=(await db.query('select state,remember_device from mushavo_email_auth.challenges where id=$1',[latestChallenge])).rows[0];
 assert.equal(row.state,'ready');assert.equal(row.remember_device,true);assert.equal(await status(A,A1),false);
});
test('Provider code verified through the gateway creates actual SQL proof and the cookie stores no database digest',async()=>{
 const r=await handle(request(A,A1,'verify',{challengeId:latestChallenge,code:latestCode}));assert.equal(r.status,200);
 cookie=r.headers.get('set-cookie').split(';')[0];assert.equal(await status(A,A1),true);
 const row=(await db.query('select credential_digest,extract(epoch from(expires_at-verified_at)) seconds from mushavo_email_auth.devices where user_id=$1',[A])).rows[0];
 assert.equal(row.seconds,'604800.000000');assert(!cookie.includes(row.credential_digest));
});
test('Actual consumed-code replay is rejected and creates no second device',async()=>{
 const r=await handle(request(A,A1,'verify',{challengeId:latestChallenge,code:latestCode}));assert.equal(r.status,400);
 assert.equal((await db.query('select count(*)::int n from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].n,1);
});
test('A new matching Auth session restores the actual credential without sliding SQL or cookie expiry',async()=>{
 const before=(await db.query('select expires_at::text v from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].v;
 const r=await handle(request(A,A2,'restore',{},cookie));assert.equal((await r.json()).result,'APPROVED');assert.equal(r.headers.get('set-cookie'),null);
 assert.equal(await status(A,A2),true);assert.equal((await db.query('select expires_at::text v from mushavo_email_auth.devices where user_id=$1',[A])).rows[0].v,before);
});
test('Renaming an owner device cookie for another account cannot cross actual SQL ownership',async()=>{
 const renamed=cookie.replace(A.replaceAll('-',''),B.replaceAll('-',''));
 const r=await handle(request(B,B1,'restore',{},renamed));assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await status(B,B1),false);
});
test('Actual day7 expiry preserves open verified sessions while the next fresh sign-in requires a code',async()=>{
 // Preserve the604800-second check constraint while moving both endpoints into the past.
 await db.query("update mushavo_email_auth.devices set verified_at=now()-interval '8 days',expires_at=now()-interval '1 day' where user_id=$1",[A]);
 assert.equal(await status(A,A1),true);assert.equal(await status(A,A2),true);
 const r=await handle(request(A,A3,'restore',{},cookie));assert.equal((await r.json()).result,'CODE_REQUIRED');assert.equal(await status(A,A3),false);
});
test('Mail failure leaves actual challenge failed and no SQL proof or verification context',async()=>{
 sendState.fail=true;await budget(B);const r=await handle(request(B,B2,'begin',{remember:false}));assert.equal(r.status,503);sendState.fail=false;
 const row=(await db.query('select id,state from mushavo_email_auth.challenges where user_id=$1 order by issued_at desc limit 1',[B])).rows[0];assert.equal(row.state,'failed');
 assert.equal((await handle(request(B,B2,'verify',{challengeId:row.id,code:latestCode}))).status,400);assert.equal(await status(B,B2),false);
});
test('Five wrong codes through the real adapter persist actual attempt lockout; correct code cannot replay',async()=>{
 await budget(B);const r=await handle(request(B,B2,'begin',{remember:false}));const c=(await r.json()).challengeId,correct=latestCode;
 const wrong=correct==='000000'?'999999':'000000';for(let i=0;i<5;i++)assert.equal((await handle(request(B,B2,'verify',{challengeId:c,code:wrong}))).status,400);
 const row=(await db.query('select state,attempts from mushavo_email_auth.challenges where id=$1',[c])).rows[0];assert.equal(row.state,'locked');assert.equal(row.attempts,5);
 assert.equal((await handle(request(B,B2,'verify',{challengeId:c,code:correct}))).status,400);assert.equal(await status(B,B2),false);
});
test('Remember-off actual verification grants only a session proof and zero remembered rows',async()=>{
 await budget(B);const r=await handle(request(B,B2,'begin',{remember:false}));const c=(await r.json()).challengeId;
 const verified=await handle(request(B,B2,'verify',{challengeId:c,code:latestCode}));assert.equal(verified.status,200);assert(verified.headers.get('set-cookie').includes('Max-Age=0'));
 assert.equal(await status(B,B2),true);assert.equal((await db.query('select count(*)::int n from mushavo_email_auth.devices where user_id=$1',[B])).rows[0].n,0);
});
test('Actual device revocation removes device-derived proofs while the other account remains verified',async()=>{
 assert.equal((await handle(request(A,A1,'forget',{},cookie))).status,200);assert.equal(await status(A,A1),false);assert.equal(await status(A,A2),false);assert.equal(await status(B,B2),true);
});
test('Actual credential callback revokes proof even when the synthetic Auth port still accepts the bearer',async()=>{
 await db.query("update auth.users set encrypted_password='SYNTHETIC_NEW_HASH' where id=$1",[B]);assert.equal(await status(B,B2),false);
});
test('All integration requests stayed in fixed synthetic ports and private fixture database is closed',async()=>{
 assert(calls.every(url=>url.startsWith(origin+'/auth/v1/user')||url.startsWith(origin+'/rest/v1/rpc/email_gate_')||url==='https://accounts.zoho.com/oauth/v2/token'||url==='https://mail.zoho.com/api/accounts/12345678/messages'));
 await db.close();
});
