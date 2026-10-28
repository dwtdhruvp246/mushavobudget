import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';
import {checkMailReadiness,stage} from '../scripts/check-fr-2-batch-w-mail-readiness.mjs';
import {readPrivateInput} from '../scripts/check-fr-2-batch-w-recovery-recipient.mjs';
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
function fixture(){
 const env={EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:'https://mushavo-budget-staging.pages.dev',EMAIL_GATE_PEPPERS_JSON:'{}',EMAIL_GATE_KEY_VERSION:'synthetic',EMAIL_GATE_RATE_PEPPER:'SYNTHETIC_PEPPER',SUPABASE_PUBLISHABLE_KEY:'SYNTHETIC_PUBLIC',SUPABASE_SERVICE_ROLE_KEY:'SYNTHETIC_SERVICE',ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:'12345',ZOHO_FROM_ADDRESS:'sender@example.invalid',ZOHO_CLIENT_ID:'SYNTHETIC_CLIENT',ZOHO_CLIENT_SECRET:'SYNTHETIC_SECRET',ZOHO_REFRESH_TOKEN:'SYNTHETIC_REFRESH',ZOHO_TEST_RECIPIENTS_JSON:'["primary@example.invalid","other@example.invalid"]'};
 const packet={schema_version:1,purpose:'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY',project:'dczlddwbtgvfdujgcitb',origin:'https://mushavo-budget-staging.pages.dev',env};
 const token={access_token:'SYNTHETIC_ACCESS',expires_in:3600,scope:'ZohoMail.accounts.READ,ZohoMail.messages.CREATE',token_type:'Bearer',api_domain:'https://www.zohoapis.com'};
 const account={primaryEmailAddress:env.ZOHO_FROM_ADDRESS,type:'ZOHO_ACCOUNT',status:true,enabled:true,mailboxStatus:'enabled',outgoingBlocked:false,accountId:'12345',emailAddress:[{isPrimary:true,isConfirmed:true,mailId:env.ZOHO_FROM_ADDRESS}]};
 const calls=[];
 const fetcher=async(url,init)=>{
  calls.push({url,init});assert.equal(init.redirect,'manual');assert(init.signal instanceof AbortSignal);
  if(url==='https://accounts.zoho.com/oauth/v2/token'){
   assert.equal(init.method,'POST');const p=new URLSearchParams(init.body);assert.equal(p.get('grant_type'),'refresh_token');assert.equal(p.get('refresh_token'),env.ZOHO_REFRESH_TOKEN);
   return json(token);
  }
  assert.equal(url,'https://mail.zoho.com/api/accounts');assert.equal(init.method,'GET');assert.equal(init.headers.authorization,'Zoho-oauthtoken SYNTHETIC_ACCESS');
  return json({status:{code:200},data:[account]});
 };
 const input=()=>({packet_json:JSON.stringify(packet),recipient:'PRIMARY@example.invalid'});
 return {env,packet,token,account,calls,fetcher,input};
}
test('private preflight is a fixed safe projection and makes no provider calls',async()=>{
 let calls=0;const r=await checkMailReadiness({preflight:true},()=>{calls++;});assert.equal(r.result,'PRIVATE_PIPE_PREFLIGHT_PASS');assert.equal(r.exit_code,0);assert.equal(r.stage_step,stage);assert.equal(calls,0);
});
test('actual refresh and account GET pass without sending mail or claiming live secret equality',async()=>{
 const f=fixture(),r=await checkMailReadiness(f.input(),f.fetcher);
 assert.equal(r.exit_code,0);assert.equal(r.provider_requests,2);assert.equal(r.provider_refresh_passed,true);assert.equal(r.provider_sender_enabled,true);assert.equal(r.retained_Zoho_account_matches,true);assert.equal(r.retained_packet_recipient_count,2);
 assert.equal(r.live_Cloudflare_secret_values_verified,false);assert.equal(r.live_message_create_or_delivery_verified,false);assert.equal(r.real_email_requests,0);assert.equal(r.settings_SQL_or_account_writes,0);assert(!f.calls.some(c=>c.url.includes('/messages')));
 const text=JSON.stringify(r);for(const value of ['SYNTHETIC','example.invalid','12345','private_configuration'])assert(!text.includes(value));
});
test('recipient absent from the selected retained packet stops before provider traffic',async()=>{
 const f=fixture(),input=f.input();input.recipient='missing@example.invalid';const r=await checkMailReadiness(input,f.fetcher);assert.equal(r.problem_code,'RECIPIENT_NOT_IN_SELECTED_PACKET');assert.equal(r.retained_packet_recipient_allowed,false);assert.equal(f.calls.length,0);
});
test('malformed, foreign or extra-key input refuses before reading provider credentials',async()=>{
 for(const change of [x=>{x.packet_json='{}';},x=>{x.extra='NEVER_PRINT_PRIVATE_PAYLOAD';},x=>{x.recipient='a@example.invalid,b@example.invalid';},x=>{x.packet_json=x.packet_json.replace('dczlddwbtgvfdujgcitb','foreign');}]){
  const f=fixture(),input=f.input();change(input);const r=await checkMailReadiness(input,f.fetcher);assert.equal(r.exit_code,1);assert.equal(f.calls.length,0);assert(!JSON.stringify(r).includes('NEVER_PRINT_PRIVATE_PAYLOAD'));
 }
});
test('foreign provider origins and invalid retained account ID refuse without traffic',async()=>{
 for(const [key,value]of [['ZOHO_MAIL_ORIGIN','https://foreign.invalid'],['ZOHO_ACCOUNTS_ORIGIN','https://accounts.zoho.eu'],['ZOHO_ACCOUNT_ID','../private']]){
  const f=fixture();f.env[key]=value;const r=await checkMailReadiness(f.input(),f.fetcher);assert.equal(r.problem_code,'RETAINED_ZOHO_SCOPE_REQUIRED');assert.equal(f.calls.length,0);
 }
});
test('revoked or rejected refresh returns one safe failed phase and no account request',async()=>{
 const f=fixture();let n=0;const r=await checkMailReadiness(f.input(),async()=>{n++;return json({error:'SYNTHETIC_PRIVATE_PROVIDER_BODY'},401);});
 assert.equal(n,1);assert.equal(r.provider_requests,1);assert.equal(r.problem_code,'REFRESH_CHECK_REJECTED_OR_UNAVAILABLE');assert(!JSON.stringify(r).includes('SYNTHETIC'));
});
test('HTTP200 OAuth error payload is sanitized and does not request account metadata',async()=>{
 const f=fixture();let n=0;const r=await checkMailReadiness(f.input(),async()=>{n++;return json({error:'SYNTHETIC_PRIVATE_PROVIDER_BODY'});});assert.equal(n,1);assert.equal(r.problem_code,'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED');
});
test('provider redirects and HTML cannot forward secrets or claim refresh success',async()=>{
 for(const reply of [()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}}),()=>new Response('<html>SYNTHETIC_SECRET</html>',{headers:{'content-type':'text/html'}})]){
  const f=fixture();let n=0;const r=await checkMailReadiness(f.input(),async(url,init)=>{n++;assert.equal(init.redirect,'manual');return reply();});assert.equal(n,1);assert.equal(r.exit_code,1);assert.equal(r.provider_refresh_passed,false);assert(!JSON.stringify(r).includes('SYNTHETIC'));
 }
});
test('unexpected reported OAuth scopes or data-centre are not accepted',async()=>{
 for(const patch of [{scope:'ZohoMail.accounts.ALL'},{api_domain:'https://www.zohoapis.eu'}]){
  const f=fixture();Object.assign(f.token,patch);const r=await checkMailReadiness(f.input(),f.fetcher);assert.equal(r.exit_code,1);assert.equal(f.calls.length,1);assert.match(r.problem_code,/OAUTH_(SCOPE|REGION)_REVIEW_REQUIRED/);
 }
});
test('missing scope metadata stays unknown while refresh and sender can pass',async()=>{
 const f=fixture();delete f.token.scope;const r=await checkMailReadiness(f.input(),f.fetcher);assert.equal(r.exit_code,0);assert.equal(r.provider_exact_scopes_reported,false);
});
test('disabled or outgoing-blocked mailbox is diagnosed without sending mail',async()=>{
 for(const patch of [{outgoingBlocked:true},{enabled:false},{mailboxStatus:'disabled'}]){
  const f=fixture();Object.assign(f.account,patch);const r=await checkMailReadiness(f.input(),f.fetcher);assert.equal(r.provider_refresh_passed,true);assert.equal(r.provider_sender_enabled,false);assert.equal(r.problem_code,'SENDER_MAILBOX_STATE_REVIEW_REQUIRED');assert.equal(f.calls.length,2);
 }
});
test('mismatched retained account ID and unmatched sender are distinguished',async()=>{
 const f=fixture();f.env.ZOHO_ACCOUNT_ID='99999';const r=await checkMailReadiness(f.input(),f.fetcher);assert.equal(r.problem_code,'RETAINED_ZOHO_ACCOUNT_ID_MISMATCH');assert.equal(r.retained_Zoho_account_matches,false);
 const g=fixture();g.account.primaryEmailAddress='different@example.invalid';assert.equal((await checkMailReadiness(g.input(),g.fetcher)).problem_code,'SENDER_MAILBOX_NOT_MATCHED');
});
test('provider network exceptions remain safe fixed phases',async()=>{
 const f=fixture(),r=await checkMailReadiness(f.input(),async()=>{throw Error('SYNTHETIC_TOKEN_AND_MAILBOX');});assert.equal(r.problem_code,'REFRESH_CHECK_REJECTED_OR_UNAVAILABLE');assert(!JSON.stringify(r).includes('SYNTHETIC'));
});
test('real private-pipe CLI preflight and malformed input emit only safe JSON',()=>{
 const entry=fileURLToPath(new URL('../scripts/check-fr-2-batch-w-mail-readiness.mjs',import.meta.url));
 for(const [input,status]of [['{"preflight":true}',0],['{"packet_json":"SYNTHETIC_PRIVATE","recipient":"user@example.invalid"}',1]]){
  const p=spawnSync(process.execPath,[entry,'--private-parent-pipe'],{input,encoding:'utf8'});assert.equal(p.status,status);assert.equal(p.stderr,'');const r=JSON.parse(p.stdout);assert.equal(r.stage_step,stage);assert.equal(r.actual_hosted_requests,0);assert(!p.stdout.includes('SYNTHETIC'));
 }
 const p=spawnSync(process.execPath,[entry],{input:'{}',encoding:'utf8'});assert.equal(p.status,1);assert.equal(p.stderr,'');
});
test('private input reader rejects oversized payloads',async()=>{
 await assert.rejects(()=>readPrivateInput(Readable.from([Buffer.alloc(262145)])),/PRIVATE_INPUT_REQUIRED/);
});
test('wrapper pins every actual execution dependency and contains no automatic credential write or mail call',()=>{
 const wrapper=fs.readFileSync(new URL('../scripts/run-fr-2-batch-w-mail-readiness.ps1',import.meta.url),'utf8');
 for(const name of ['scripts/check-fr-2-batch-w-mail-readiness.mjs','scripts/check-fr-2-batch-w-recovery-recipient.mjs','scripts/lib/fr-2-zoho-private-setup.mjs','supabase/functions/_shared/email-verification-http.mjs','supabase/functions/_shared/email-verification-zoho.mjs']){
  const b=fs.readFileSync(new URL('../'+name,import.meta.url)),h=createHash('sha256').update(b).digest('hex');assert(wrapper.includes(h),name);assert(wrapper.includes(name),name);
 }
 assert(!wrapper.includes('ConvertFrom-SecureString'));assert(!wrapper.includes('Set-Clipboard'));assert(wrapper.includes('25000'));assert(wrapper.includes('provider_requests'));assert(wrapper.includes('encrypted_packet_compared_unchanged'));
});
test('diagnostic source manifest matches all execution and test identities',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../docs/security-audit/security-fr-2-batch-w-mail-readiness-source-manifest.json',import.meta.url),'utf8'));assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [name,h]of Object.entries(m.file_sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex'),h,name);
});

