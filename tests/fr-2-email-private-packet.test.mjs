import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrivatePacket} from '../scripts/lib/fr-2-email-private-packet.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const project = 'dczlddwbtgvfdujgcitb';
const sentinel = 'PRIVATE_SENTINEL_NEVER_PRINT';
const pub = 'sb_publishable_' + sentinel;
const secret = 'sb_secret_' + sentinel;
function fixture() {
  return {publishableKey:pub,secretKey:secret,expectedWorkerSHA:'a'.repeat(64),recipients:['controlled@example.invalid'],
    configuration:'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify({supabaseUrl:'https://' + project + '.supabase.co',supabasePublishableKey:pub,vapidPublicKey:''}) + ';',
    zoho:{schema_version:1,purpose:'MUSHAVO_STAGING_ZOHO_SENDER_ONLY',accountsOrigin:'https://accounts.zoho.com',mailOrigin:'https://mail.zoho.com',
      clientId:sentinel+'_CLIENT',clientSecret:sentinel+'_CLIENT_SECRET',refreshToken:sentinel+'_REFRESH',from:'notifications@mushavobudget.com',accountId:'12345678',account_verified:true}};
}
const runCLI = (input, args=['--private-parent-pipe']) => spawnSync(process.execPath,
  ['--require',path.join(root,'scripts/offline-test-network.cjs'),path.join(root,'scripts/fr-2-email-private-packet.mjs'),...args],
  {input:typeof input === 'string'?input:JSON.stringify(input),encoding:'utf8',timeout:10000,maxBuffer:262144});
test('Actual gateway validates all 16 mapped variables without calling Auth, SQL, mail or a limiter', () => {
  const input=fixture(), {receipt,private_configuration:p}=preparePrivatePacket(input);
  assert.equal(receipt.exit_code,0);assert.equal(Object.keys(p.env).length,16);
  assert.equal(p.env.SUPABASE_SERVICE_ROLE_KEY,secret);assert.equal(p.env.SUPABASE_PUBLISHABLE_KEY,pub);
  assert.equal(p.env.ZOHO_REFRESH_TOKEN,input.zoho.refreshToken);assert.equal(p.env.EMAIL_GATE_KEY_VERSION,'v1');
  assert.equal(p.project,project);assert.equal(p.requires_new_reviewed_Worker_upload,true);
  assert.equal(p.retained_ZIP_is_configuration_source_only,true);
  assert.equal(receipt.actual_hosted_requests,0);assert.equal(receipt.Supabase_key_ownership_independently_verified,false);
  assert.ok(!JSON.stringify(receipt).includes(sentinel));
});
test('Independent secure random material has exactly 32 bytes per pepper and is never exposed in the receipt', () => {
  const one=preparePrivatePacket(fixture()), two=preparePrivatePacket(fixture());
  const code=JSON.parse(one.private_configuration.env.EMAIL_GATE_PEPPERS_JSON).v1;
  const rate=one.private_configuration.env.EMAIL_GATE_RATE_PEPPER;
  assert.match(code,/^[a-f0-9]{64}$/);assert.match(rate,/^[a-f0-9]{64}$/);assert.notEqual(code,rate);
  assert.notEqual(code,JSON.parse(two.private_configuration.env.EMAIL_GATE_PEPPERS_JSON).v1);
  assert.ok(!JSON.stringify(one.receipt).includes(code));assert.ok(!JSON.stringify(one.receipt).includes(rate));
});
test('Short, wrong-type and reused entropy cannot silently create a credential packet', () => {
  for(const entropy of [()=>new Uint8Array(31),()=>null,()=>new Uint8Array(32)])assert.throws(()=>preparePrivatePacket(fixture(),{entropy}));
});
test('Preparation never mutates the caller retained configuration or Zoho snapshot', () => {
  const input=fixture(),before=JSON.stringify(input);preparePrivatePacket(input);assert.equal(JSON.stringify(input),before);
});
for(const [label,mutate] of [
  ['legacy service token',x=>{x.secretKey='eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c3ludGhldGlj';}],
  ['Secret key in public slot',x=>{x.publishableKey=secret;}],
  ['public key in Secret slot',x=>{x.secretKey=pub;}],
  ['foreign archived key',x=>{x.publishableKey=pub+'_FOREIGN';}],
  ['non-staging configuration',x=>{x.configuration=x.configuration.replace(project,'kttkospkblwvguuwnhjj');}],
  ['push enabled',x=>{x.configuration=x.configuration.replace('"vapidPublicKey":""','"vapidPublicKey":"PUSH_ENABLED"');}],
  ['configuration with executable suffix',x=>{x.configuration+='\nthrow new Error("'+sentinel+'");';}],
  ['foreign mail region',x=>{x.zoho.mailOrigin='https://mail.zoho.eu';}],
  ['unverified sender snapshot',x=>{x.zoho.account_verified=false;}],
  ['different sender',x=>{x.zoho.from='other@example.invalid';}],
  ['missing Zoho client secret',x=>{delete x.zoho.clientSecret;}],
  ['empty recipient list',x=>{x.recipients=[];}],
  ['too many recipients',x=>{x.recipients=Array.from({length:11},(_,i)=>'a'+i+'@example.invalid');}],
  ['recipient header injection',x=>{x.recipients=['a@example.invalid\r\nBcc:other@example.invalid'];}],
  ['duplicate recipient by case',x=>{x.recipients=['a@example.invalid','A@example.invalid'];}],
  ['stale reviewed Worker',x=>{x.expectedWorkerSHA='fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99';}],
  ['unexpected input field',x=>{x.outputFile=sentinel;}]
]) test('Private packet refuses '+label,()=>{const input=fixture();mutate(input);assert.throws(()=>preparePrivatePacket(input));});
test('Actual CLI private-pipe preflight returns no configuration and makes no network call',()=>{
  const c=runCLI({preflight:true});assert.equal(c.status,0);assert.equal(c.stderr,'');
  const a=JSON.parse(c.stdout);assert.equal(a.private_configuration,null);assert.equal(a.receipt.result,'PRIVATE_PIPE_PREFLIGHT_PASS');
});
test('Valid private child output is only available in the explicit parent-pipe mode and its receipt is safe',()=>{
  const c=runCLI(fixture());assert.equal(c.status,0);assert.equal(c.stderr,'');const a=JSON.parse(c.stdout);
  assert.equal(a.private_configuration.env.SUPABASE_SERVICE_ROLE_KEY,secret);assert.ok(!JSON.stringify(a.receipt).includes(sentinel));
  const rejected=runCLI(fixture(),[]);assert.equal(rejected.status,1);assert.equal(rejected.stderr,'');
  assert.equal(JSON.parse(rejected.stdout).private_configuration,null);assert.ok(!rejected.stdout.includes(sentinel));
});
test('Malformed, oversized or extra-field CLI input never prints original values or raw exceptions',()=>{
  for(const input of ['{'+sentinel,' '.repeat(65537),{...fixture(),preflight:true}]){
    const c=runCLI(input);assert.equal(c.status,1);assert.equal(c.stderr,'');assert.ok(!c.stdout.includes(sentinel));
    assert.equal(JSON.parse(c.stdout).private_configuration,null);
  }
});
test('Wrong existing publishable key returns a fixed actionable code without a key or key hash',()=>{
  const input=fixture();input.publishableKey+='DIFFERENT';const c=runCLI(input);
  assert.equal(c.status,1);const a=JSON.parse(c.stdout);assert.equal(a.receipt.problem_code,'RETAINED_PUBLIC_KEY_MISMATCH');
  assert.equal(a.private_configuration,null);assert.ok(!c.stdout.includes(sentinel));assert.equal(c.stderr,'');
});
test('PowerShell source keeps credentials in a private UTF8 pipe and uses exclusive DPAPI output and safe failure receipts',()=>{
  const ps=readFileSync(path.join(root,'scripts/prepare-fr-2-email-private-packet.ps1'),'utf8');
  assert.match(ps,/Read-Host[^\n]*Publishable[^\n]*-AsSecureString/);
  assert.match(ps,/Read-Host[^\n]*Secret[^\n]*-AsSecureString/);
  assert.match(ps,/StandardInput.BaseStream.Write/);assert.match(ps,/ZeroFreeBSTR/);
  assert.match(ps,/FileMode\]::CreateNew/);assert.match(ps,/ConvertFrom-SecureString \$PacketSecure/);
  assert.match(ps,/ConvertTo-SecureString \(\[IO.File\]::ReadAllText\(\$OutputPath/);
  assert.match(ps,/\$CreatedThisRun -and -not \$Saved/);
  assert.match(ps,/OpenRead\(\$ZipPath\)/);assert.match(ps,/\.FullName -ceq 'config.js'/);
  assert.ok(ps.indexOf('PRIVATE_PIPE_PREFLIGHT_PASS')<ps.indexOf("Read-Host 'Paste the staging Publishable"));
  assert.ok(!ps.includes('Write-Host $PrivateJson'));assert.ok(!ps.includes('Invoke-RestMethod'));assert.ok(!ps.includes('Invoke-WebRequest'));
});
