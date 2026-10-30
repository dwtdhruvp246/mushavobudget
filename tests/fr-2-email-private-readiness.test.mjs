import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {preparePrivatePacket} from '../scripts/lib/fr-2-email-private-packet.mjs';
import {checkPrivateReadiness,validateReadinessPacket,verifyModernReadinessArtifact} from '../scripts/check-fr-2-email-private-readiness.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const clone=x=>JSON.parse(JSON.stringify(x));
const publicKey='sb_publishable_SYNTHETIC_READINESS_PUBLIC',secretKey='sb_secret_SYNTHETIC_READINESS_BACKEND';
function input(){let count=0;const packet=preparePrivatePacket({publishableKey:publicKey,secretKey,
  zoho:{schema_version:1,purpose:'MUSHAVO_STAGING_ZOHO_SENDER_ONLY',accountsOrigin:'https://accounts.zoho.com',mailOrigin:'https://mail.zoho.com',
    clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_ZOHO_SECRET',refreshToken:'SYNTHETIC_REFRESH_SECRET',from:'notifications@mushavobudget.com',accountId:'123',account_verified:true},
  recipients:['first@example.com','second@example.com'],configuration:'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:publicKey,vapidPublicKey:''})+';',
  expectedWorkerSHA:'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651'},
  {entropy:n=>Buffer.alloc(n,++count)}).private_configuration;
  return {account:'a'.repeat(32),token:'SYNTHETIC_CLOUDFLARE_TOKEN_ONLY',candidate:path.join(os.tmpdir(),'synthetic-readiness-candidate'),packet};
}
function fixture(change=()=>{},auth=()=>null){
  const channel=()=>({compatibility_date:'2026-07-01',always_use_latest_compatibility_date:false,fail_open:false,
    env_vars:{EMAIL_GATE_MODE:{type:'plain_text',value:'STAGING_CONTROLLED_ONLY'},EMAIL_GATE_PROJECT:{type:'plain_text',value:'dczlddwbtgvfdujgcitb'},EMAIL_GATE_ORIGIN:{type:'plain_text',value:'https://mushavo-budget-staging.pages.dev'}},
    durable_object_namespaces:{EMAIL_GATE_LIMITER_NS:{namespace_id:'synthetic_namespace'}}});
  const responses=[{name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev',deployment_configs:{production:channel(),preview:channel()}},
    [{id:'mushavo-email-rate-staging'}],[{id:'synthetic_namespace',script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',use_sqlite:true}],{enabled:false,previews_enabled:false}];
  change(responses);const calls=[];
  const transport=async(url,init)=>{
    const u=new URL(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.equal(init.body,undefined);calls.push({url,init});
    if(u.hostname==='api.cloudflare.com'){
      assert.equal(init.headers.Authorization,'Bearer SYNTHETIC_CLOUDFLARE_TOKEN_ONLY');
      assert(!Object.values(init.headers).includes(secretKey));const suffix=u.pathname.replace('/client/v4/accounts/'+'a'.repeat(32),'')+u.search;
      const index=['/pages/projects/mushavo-budget-staging','/workers/scripts','/workers/durable_objects/namespaces?per_page=1000','/workers/scripts/mushavo-email-rate-staging/subdomain'].indexOf(suffix);assert(index>=0);
      return new Response(JSON.stringify({success:true,errors:index===2?null:[],result:responses[index]}),{headers:{'content-type':'application/json'}});
    }
    assert.equal(u.href,'https://dczlddwbtgvfdujgcitb.supabase.co/auth/v1/settings');
    assert.equal(init.headers.Authorization,undefined);assert.equal(init.headers.authorization,undefined);
    const overridden=auth(init.headers.apikey);if(overridden)return overridden;
    if(init.headers.apikey==='sb_publishable_READINESS_NEGATIVE_CONTROL_20261020')return new Response('invalid',{status:401});
    assert([publicKey,secretKey].includes(init.headers.apikey));return new Response(JSON.stringify({external:{email:true},disable_signup:false,autoconfirm:false}),{headers:{'content-type':'application/json'}});
  };
  return {calls,transport,artifactCheck:async()=>({publishableKey:publicKey})};
}
test('Actual existing Cloudflare inspector and new key checks make exactly seven fixed GETs',async()=>{const f=fixture(),x=input(),before=clone(x),r=await checkPrivateReadiness(x,f);assert.equal(r.exit_code,0);assert.equal(r.requests_attempted,7);assert.equal(f.calls.length,7);assert.deepEqual(x,before);assert.equal(r.negative_API_key_control_rejected,true);assert.equal(r.modern_secret_key_accepted_by_staging_Auth_settings,true);assert.equal(r.publishable_key_accepted_by_staging_Auth_settings,true);assert.equal(r.Auth_sessions_created,0);assert.equal(r.application_routines_invoked,0);assert.equal(r.hosted_acceptance,false);assert.equal(r.Cloudflare_secrets_SQL_Auth_accounts_or_settings_changed,false);const text=JSON.stringify(r);for(const secret of [publicKey,secretKey,x.token,x.account,x.packet.env.EMAIL_GATE_RATE_PEPPER,'SYNTHETIC_REFRESH_SECRET','first@example.com','synthetic_namespace'])assert(!text.includes(secret));});
test('An invalid-key200 stops before sending either real configured key',async()=>{const f=fixture(()=>{},key=>key.includes('NEGATIVE_CONTROL')?new Response('{}',{headers:{'content-type':'application/json'}}):null),r=await checkPrivateReadiness(input(),f);assert.equal(r.problem_code,'NEGATIVE_API_KEY_CONTROL_REVIEW_REQUIRED');assert.equal(f.calls.length,5);assert(!f.calls.some(c=>[publicKey,secretKey].includes(c.init.headers.apikey)));});
test('Negative403 is an accepted rejection control',async()=>{const f=fixture(()=>{},key=>key.includes('NEGATIVE_CONTROL')?new Response('forbidden',{status:403}):null),r=await checkPrivateReadiness(input(),f);assert.equal(r.exit_code,0);});
for(const [name,key,code,count]of [['publishable',publicKey,'PUBLISHABLE_API_KEY_REVIEW_REQUIRED',6],['secret',secretKey,'SECRET_API_KEY_REVIEW_REQUIRED',7]])test('Rejected '+name+' key is bounded and never echoed',async()=>{const f=fixture(()=>{},k=>k===key?new Response('DO_NOT_PRINT_'+key,{status:401}):null),r=await checkPrivateReadiness(input(),f);assert.equal(r.problem_code,code);assert.equal(r.requests_attempted,count);assert(!JSON.stringify(r).includes('DO_NOT_PRINT'));});
for(const [name,mutate]of [
 ['foreign project',p=>{p.project='foreign';}],['foreign origin',p=>{p.origin='https://foreign.invalid';}],
 ['stale Worker',p=>{p.expected_modern_Pages_Worker_SHA256='0'.repeat(64);}],['legacy backend key',p=>{p.env.SUPABASE_SERVICE_ROLE_KEY='eyJlegacy';}],
 ['unknown variable',p=>{p.env.EXTRA='do not expose';}],['foreign Zoho origin',p=>{p.env.ZOHO_ACCOUNTS_ORIGIN='https://foreign.invalid';}],
 ['shared peppers',p=>{p.env.EMAIL_GATE_RATE_PEPPER=JSON.parse(p.env.EMAIL_GATE_PEPPERS_JSON).v1;}],['third recipient',p=>{p.env.ZOHO_TEST_RECIPIENTS_JSON='["one@example.com","two@example.com","three@example.com"]';}]
])test('Packet rejects '+name+' before any provider request',async()=>{const x=input(),f=fixture();mutate(x.packet);const r=await checkPrivateReadiness(x,f);assert.equal(r.exit_code,1);assert.equal(r.requests_attempted,0);assert.equal(f.calls.length,0);assert.equal(r.problem_code,'PACKET_SCOPE_REQUIRED');});
test('Public key mismatch against exact artifact refuses all provider requests',async()=>{const f=fixture();f.artifactCheck=async()=>({publishableKey:'sb_publishable_DIFFERENT'});const r=await checkPrivateReadiness(input(),f);assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);});
for(const [name,change]of [
 ['foreign Pages project',rows=>{rows[0].name='production';}],
 ['wrong date',rows=>{rows[0].deployment_configs.production.compatibility_date='2026-01-01';}],
 ['fail open',rows=>{rows[0].deployment_configs.preview.fail_open=true;}],
 ['wrong marker',rows=>{rows[0].deployment_configs.production.env_vars.EMAIL_GATE_PROJECT.value='foreign';}],
 ['wrong namespace',rows=>{rows[0].deployment_configs.preview.durable_object_namespaces.EMAIL_GATE_LIMITER_NS.namespace_id='wrong';}],
 ['already installed secret',rows=>{rows[0].deployment_configs.production.env_vars.SUPABASE_SERVICE_ROLE_KEY={type:'secret_text',value:'REDACTED'};}]
])test('Cloudflare '+name+' stops before any Supabase key check',async()=>{const f=fixture(change),r=await checkPrivateReadiness(input(),f);assert.equal(r.exit_code,1);assert(f.calls.every(c=>new URL(c.url).hostname==='api.cloudflare.com'));});
test('Malformed or unexpected Auth settings body fails safely',async()=>{for(const body of ['not JSON','{}','[]']){const f=fixture(()=>{},k=>k===publicKey?new Response(body,{headers:{'content-type':'application/json'}}):null),r=await checkPrivateReadiness(input(),f);assert.equal(r.problem_code,'AUTH_SETTINGS_RESPONSE_REVIEW_REQUIRED');}});
test('Bounded settings stream rejects oversized responses',async()=>{const f=fixture(()=>{},k=>k===publicKey?new Response('x'.repeat(262145),{headers:{'content-type':'application/json'}}):null),r=await checkPrivateReadiness(input(),f);assert.equal(r.problem_code,'RESPONSE_TOO_LARGE');});
test('Network exception containing a key or identifier becomes a fixed safe code',async()=>{const f=fixture();f.transport=async()=>{throw Error(secretKey);};const r=await checkPrivateReadiness(input(),f);assert.equal(r.exit_code,1);assert(!JSON.stringify(r).includes(secretKey));});
test('Wrong actual archive digest is refused without executing config',()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'readiness-archive-'));try{fs.writeFileSync(path.join(d,'mushavo-email-modern-review.zip'),'untrusted');assert.throws(()=>verifyModernReadinessArtifact(d),/ARTIFACT_IDENTITY/);}finally{fs.rmSync(d,{recursive:true,force:true});}});
test('Private CLI preflight makes no requests; missing mode or malformed payload is safe',()=>{const entry=path.join(root,'scripts/check-fr-2-email-private-readiness.mjs');const run=(args,text)=>spawnSync(process.execPath,[entry,...args],{input:text,encoding:'utf8',timeout:10000});const p=run(['--private-parent-pipe'],'{"preflight":true}');assert.equal(p.status,0);assert.equal(JSON.parse(p.stdout).requests_attempted,0);for(const [args,text]of [[[],'SECRET_INPUT'],[['--private-parent-pipe'],'bad'],[['--private-parent-pipe'],'x'.repeat(65537)]]){const c=run(args,text);assert.equal(c.status,1);assert.equal(JSON.parse(c.stdout).requests_attempted,0);assert(!c.stdout.includes('SECRET_INPUT'));assert.equal(c.stderr,'');}});
test('Windows wrapper decrypts only in private memory, sends a private pipe and rechecks unchanged files',()=>{const ps=fs.readFileSync(path.join(root,'scripts/run-fr-2-email-private-readiness.ps1'),'utf8');assert.match(ps,/ConvertTo-SecureString \(\[IO.File\]::ReadAllText\(\$PacketFile/);assert.match(ps,/\.BaseStream\.Write\(\$Bytes/);assert.match(ps,/\$PacketHash/);assert.match(ps,/DPAPI_packet_and_modern_ZIP_compared_unchanged/);assert(!/WriteAllText|ConvertFrom-SecureString|New-Item|SetEnvironmentVariable|CLOUDFLARE_API_TOKEN\s*=/.test(ps));assert.match(ps,/Read-Host 'Paste the Cloudflare API token[^\n]+-AsSecureString/);});
