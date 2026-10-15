import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {prepareZohoSender} from '../scripts/lib/fr-2-zoho-private-setup.mjs';

const sender = 'notifications@example.invalid';
const input = () => ({mode:'authorization_code', clientId:'1000.synthetic-client',
  clientSecret:'synthetic-client-secret', code:'1000.synthetic-code', sender});
const scope = 'ZohoMail.accounts.READ,ZohoMail.messages.CREATE';
const token = () => ({access_token:'synthetic-access-token', refresh_token:'synthetic-refresh-token',
  expires_in:3600, token_type:'Bearer', api_domain:'https://www.zohoapis.com', scope});
const account = () => ({accountId:'1234567890', type:'ZOHO_ACCOUNT', status:true, enabled:true,
  mailboxStatus:'enabled', outgoingBlocked:false, primaryEmailAddress:sender,
  emailAddress:[{mailId:sender,isPrimary:true,isConfirmed:true}]});
const json = value => new Response(JSON.stringify(value), {headers:{'content-type':'application/json'}});
const fixture = (options={}) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({url,init});
    if (calls.length === 1 && options.firstResponse) return options.firstResponse();
    if (url === 'https://mail.zoho.com/api/accounts') {
      if (options.accountResponse) return options.accountResponse();
      return json({status:{code:200},data:options.accounts || [account()]});
    }
    const t = calls.length === 1 ? (options.token || token()) : (options.refreshed || token());
    return json(t);
  };
  return {calls,fetcher};
};
const safe = answer => {
  const out = JSON.stringify(answer.receipt);
  for (const value of ['synthetic-client-secret','synthetic-refresh-token','synthetic-access-token',
    '1000.synthetic-client','1000.synthetic-code',sender,'1234567890']) assert(!out.includes(value));
  assert.equal(answer.receipt.email_dispatched,false);
  assert.equal(answer.receipt.send_mail_scope_or_delivery_verified,false);
};
test('actual code exchange, refresh proof and selected sender metadata use only three fixed requests', async()=>{
  const f=fixture(), a=await prepareZohoSender(input(),f.fetcher);safe(a);
  assert.equal(a.receipt.exit_code,0);assert.equal(a.receipt.requests_attempted,3);
  assert.equal(a.private_configuration.accountId,'1234567890');assert(a.private_configuration.account_verified);
  assert.deepEqual(f.calls.map(x=>x.url),['https://accounts.zoho.com/oauth/v2/token',
    'https://accounts.zoho.com/oauth/v2/token','https://mail.zoho.com/api/accounts']);
  for(const c of f.calls){assert.equal(c.init.redirect,'manual');assert(c.init.signal instanceof AbortSignal);assert(!c.url.includes('?'));}
  assert.equal(new URLSearchParams(f.calls[0].init.body).get('grant_type'),'authorization_code');
  assert.equal(new URLSearchParams(f.calls[1].init.body).get('refresh_token'),'synthetic-refresh-token');
  assert.equal(f.calls[2].init.headers.authorization,'Zoho-oauthtoken synthetic-access-token');
  assert(!f.calls.some(x=>/\/messages/.test(x.url)));
});
test('existing private refresh configuration can be checked without another code exchange',async()=>{
  const f=fixture(),i=input();delete i.code;i.mode='refresh';i.refreshToken='synthetic-refresh-token';
  const a=await prepareZohoSender(i,f.fetcher);safe(a);assert.equal(a.receipt.exit_code,0);
  assert.equal(a.receipt.requests_attempted,2);assert(!a.receipt.authorization_code_exchange_attempted);
});
test('missing scope metadata remains honestly unverified while account-read succeeds',async()=>{
  const t=token();delete t.scope;const a=await prepareZohoSender(input(),fixture({token:t,refreshed:t}).fetcher);
  assert.equal(a.receipt.exit_code,0);assert.equal(a.receipt.token_reported_exact_scopes,false);safe(a);
});
for(const [name,alter]of Object.entries({
  extra_endpoint:i=>i.url='https://elsewhere.invalid',
  malformed_client:i=>i.clientId='bad\nheader',
  oversized_secret:i=>i.clientSecret='a'.repeat(4097),
  wrong_mode:i=>i.mode='send',
  multiple_mailboxes:i=>i.sender='one@example.invalid,two@example.invalid'
}))test('invalid input refuses before any provider request: '+name,async()=>{
  const i=input();alter(i);const f=fixture(),a=await prepareZohoSender(i,f.fetcher);
  assert.equal(a.receipt.problem_code,'LOCAL_INPUT_INVALID');assert.equal(f.calls.length,0);safe(a);
});
test('redirect token response is not followed and private response body is not printed',async()=>{
  const f=fixture({firstResponse:()=>new Response('synthetic-client-secret',{status:302,
    headers:{location:'https://elsewhere.invalid'}})}),a=await prepareZohoSender(input(),f.fetcher);
  assert.equal(a.receipt.problem_code,'OAUTH_CODE_EXCHANGE_REJECTED_OR_UNAVAILABLE');
  assert.equal(a.receipt.requests_attempted,1);assert.equal(a.private_configuration,null);safe(a);
});
test('provider HTTP-200 invalid_grant gives only a safe problem code',async()=>{
  const a=await prepareZohoSender(input(),fixture({token:{error:'invalid_grant',description:'synthetic-client-secret'}}).fetcher);
  assert.equal(a.receipt.problem_code,'REFRESH_TOKEN_NOT_RETURNED');safe(a);
});
test('upstream HTML refuses without dumping its contents',async()=>{
  const a=await prepareZohoSender(input(),fixture({firstResponse:()=>new Response('synthetic-client-secret')}).fetcher);
  assert.equal(a.receipt.exit_code,1);safe(a);
});
test('token response stream size cap refuses oversized JSON',async()=>{
  const a=await prepareZohoSender(input(),fixture({firstResponse:()=>json({secret:'x'.repeat(65536)})}).fetcher);
  assert.equal(a.receipt.exit_code,1);safe(a);
});
test('account response stream size cap refuses oversized JSON but retains private grant for encryption',async()=>{
  const a=await prepareZohoSender(input(),fixture({accountResponse:()=>json({secret:'x'.repeat(1048576)})}).fetcher);
  assert.equal(a.receipt.problem_code,'ACCOUNT_READ_REJECTED_OR_UNAVAILABLE');
  assert.equal(a.private_configuration.refreshToken,'synthetic-refresh-token');safe(a);
});
test('foreign region token fails closed and preserves newly issued grant privately',async()=>{
  const t=token();t.api_domain='https://www.zohoapis.eu';const a=await prepareZohoSender(input(),fixture({token:t}).fetcher);
  assert.equal(a.receipt.problem_code,'OAUTH_REGION_REVIEW_REQUIRED');assert(a.private_configuration);safe(a);
});
test('broad or unexpected reported OAuth scopes refuse while keeping the grant recoverable',async()=>{
  const t=token();t.scope='ZohoMail.accounts.ALL,ZohoMail.messages.ALL';
  const a=await prepareZohoSender(input(),fixture({token:t}).fetcher);
  assert.equal(a.receipt.problem_code,'OAUTH_SCOPE_REVIEW_REQUIRED');assert(a.private_configuration);safe(a);
});
test('refresh rejection stops before account metadata and retains the issued grant',async()=>{
  const f=fixture({refreshed:{error:'invalid_client',details:'synthetic-client-secret'}}),a=await prepareZohoSender(input(),f.fetcher);
  assert.equal(a.receipt.problem_code,'OAUTH_TOKEN_SHAPE_REVIEW_REQUIRED');assert.equal(f.calls.length,2);
  assert(a.private_configuration);safe(a);
});
test('singular sender is not confused with plural sender mailbox',async()=>{
  const a=account();a.primaryEmailAddress='notification@example.invalid';
  const result=await prepareZohoSender(input(),fixture({accounts:[a]}).fetcher);
  assert.equal(result.receipt.problem_code,'SENDER_MAILBOX_NOT_MATCHED');safe(result);
});
test('duplicate matching accounts refuse ambiguity',async()=>{
  const a=await prepareZohoSender(input(),fixture({accounts:[account(),account()]}).fetcher);
  assert.equal(a.receipt.problem_code,'SENDER_MAILBOX_NOT_MATCHED');safe(a);
});
for(const [name,alter]of Object.entries({
  disabled:a=>a.enabled=false,
  outgoing_blocked:a=>a.outgoingBlocked=true,
  unconfirmed:a=>a.emailAddress[0].isConfirmed=false,
  unsafe_account_id:a=>a.accountId='../messages',
  imprecise_numeric_account_id:a=>a.accountId=1234567890
}))test('sender state refuses: '+name,async()=>{
  const row=account();alter(row);const a=await prepareZohoSender(input(),fixture({accounts:[row]}).fetcher);
  assert.equal(a.receipt.problem_code,'SENDER_MAILBOX_STATE_REVIEW_REQUIRED');safe(a);
});
test('raw transport exception never reaches the safe receipt',async()=>{
  const a=await prepareZohoSender(input(),async()=>{throw Error('synthetic-client-secret');});
  assert.equal(a.receipt.problem_code,'OAUTH_CODE_EXCHANGE_REJECTED_OR_UNAVAILABLE');safe(a);
});
test('internal CLI rejects invalid invocation and does not echo stdin',()=>{
  const c=spawnSync(process.execPath,['scripts/fr-2-zoho-private-setup.mjs'],{
    encoding:'utf8',input:'synthetic-client-secret',timeout:5000});
  assert.equal(c.status,1);assert.equal(c.stderr,'');assert(!c.stdout.includes('synthetic-client-secret'));
  assert.equal(JSON.parse(c.stdout).private_configuration,null);
});
test('internal CLI offline default transport returns safe failure without secrets or network',()=>{
  const c=spawnSync(process.execPath,['--require','./scripts/offline-test-network.cjs',
    'scripts/fr-2-zoho-private-setup.mjs','--private-parent-pipe'],{
    encoding:'utf8',input:JSON.stringify(input()),timeout:5000});
  assert.equal(c.status,1);assert.equal(c.stderr,'');const a=JSON.parse(c.stdout);safe(a);
  assert.equal(a.receipt.problem_code,'OAUTH_CODE_EXCHANGE_REJECTED_OR_UNAVAILABLE');
});
test('PowerShell source keeps secrets in hidden prompts and private pipes with DPAPI current-user storage',()=>{
  const p=readFileSync('scripts/setup-fr-2-zoho-private.ps1','utf8');
  assert.equal((p.match(/Read-Host [^\n]+-AsSecureString/g)||[]).length,3);
  for(const text of ['WINDOWS_DPAPI_CURRENT_USER','ConvertFrom-SecureString','ReadToEndAsync()',
    '$Child.StandardInput.BaseStream.Write($InputBytes','[IO.FileMode]::CreateNew',
    "'LocalApplicationData'",'$VaultStream.Flush($true)',"'NODE_OPTIONS'",'$PrivateAnswer = $null'])assert(p.includes(text));
  assert(!/Write-Host\s+\$(?:Private|NodeText|NodeErrorText|Cipher)/.test(p));
  assert(!p.includes('Set-ExecutionPolicy'));assert(!p.includes('Invoke-RestMethod'));
});
