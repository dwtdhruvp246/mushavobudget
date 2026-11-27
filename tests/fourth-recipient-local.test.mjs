import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {planRecipientAddition,stage} from '../scripts/plan-fr-2-batch-w-fourth-recipient.mjs';
const secret='SYNTHETIC_PROVIDER_CREDENTIAL_NEVER_OUTPUT';
function packet(list=['first@example.test','second@example.test','third@example.test']){return {schema_version:1,purpose:'MUSHAVO_STAGING_EMAIL_GATEWAY_CONFIGURATION_ONLY',project:'dczlddwbtgvfdujgcitb',origin:'https://mushavo-budget-staging.pages.dev',created_UTC:'2026-10-01T00:00:00Z',env:{EMAIL_GATE_MODE:'STAGING_CONTROLLED_ONLY',EMAIL_GATE_PROJECT:'dczlddwbtgvfdujgcitb',EMAIL_GATE_ORIGIN:'https://mushavo-budget-staging.pages.dev',EMAIL_GATE_PEPPERS_JSON:secret,EMAIL_GATE_KEY_VERSION:'v1',EMAIL_GATE_RATE_PEPPER:secret,SUPABASE_PUBLISHABLE_KEY:secret,SUPABASE_SERVICE_ROLE_KEY:secret,ZOHO_MAIL_ORIGIN:'https://mail.zoho.com',ZOHO_ACCOUNTS_ORIGIN:'https://accounts.zoho.com',ZOHO_ACCOUNT_ID:secret,ZOHO_FROM_ADDRESS:secret,ZOHO_CLIENT_ID:secret,ZOHO_CLIENT_SECRET:secret,ZOHO_REFRESH_TOKEN:secret,ZOHO_TEST_RECIPIENTS_JSON:JSON.stringify(list)}};}
const input=(p=packet(),recipient='fourth@example.test')=>({packet_json:JSON.stringify(p),recipient});
function checkSafe(result){assert(!JSON.stringify(result).includes(secret));assert(!JSON.stringify(result.receipt).includes('@'));assert.equal(result.receipt.actual_hosted_requests,0);assert.equal(result.receipt.real_email_requests,0);assert.equal(result.receipt.Cloudflare_settings_or_SQL_or_account_writes,0);assert.equal(result.receipt.password_save_requested,false);}
function child(text,args=['--private-parent-pipe']){const env={...process.env};for(const k of Object.keys(env))if(/^(NODE_OPTIONS|NODE_DEBUG|NODE_DEBUG_NATIVE|NODE_TLS_REJECT_UNAUTHORIZED|SSLKEYLOGFILE|CLOUDFLARE_|CF_|WRANGLER_|SUPABASE_|ZOHO_|EMAIL_GATE_)/.test(k))delete env[k];return spawnSync(process.execPath,['--require',fileURLToPath(new URL('../scripts/offline-test-network.cjs',import.meta.url)),fileURLToPath(new URL('../scripts/plan-fr-2-batch-w-fourth-recipient.mjs',import.meta.url)),...args],{input:text,encoding:'utf8',timeout:5000,env});}
test('preflight passes no private value and performs no mutation',()=>{const r=planRecipientAddition({preflight:true});assert.equal(r.receipt.result,'PRIVATE_PIPE_PREFLIGHT_PASS');assert.equal(r.recipient_json,null);checkSafe(r);});
test('prepares exactly one addition while retaining all three existing values and order',()=>{const p=packet(),data=input(p),original=JSON.stringify(data);const r=planRecipientAddition(data);assert.equal(r.receipt.exit_code,0);assert.equal(r.receipt.original_recipient_count,3);assert.equal(r.receipt.prepared_recipient_count,4);assert.deepEqual(JSON.parse(r.recipient_json),['first@example.test','second@example.test','third@example.test','fourth@example.test']);assert.equal(JSON.stringify(data),original);assert.deepEqual(p,packet());checkSafe(r);});
test('preserves original recipient case and normalizes only the added request',()=>{const r=planRecipientAddition(input(packet(['FIRST@example.test','Second@example.test','Third@example.test']),' FOURTH@EXAMPLE.TEST '));assert.deepEqual(JSON.parse(r.recipient_json),['FIRST@example.test','Second@example.test','Third@example.test','fourth@example.test']);checkSafe(r);});
test('a plus alias is added explicitly rather than equated with its base inbox',()=>{const r=planRecipientAddition(input(packet(),'first+fourth@example.test'));assert.deepEqual(JSON.parse(r.recipient_json),['first@example.test','second@example.test','third@example.test','first+fourth@example.test']);checkSafe(r);});
test('a four-recipient pending packet can restore clipboard content without adding a duplicate',()=>{const r=planRecipientAddition(input(packet(['first@example.test','second@example.test','third@example.test','FOURTH@example.test'])));assert.equal(r.receipt.recipient_value_changed,false);assert.equal(r.receipt.original_recipient_count,4);assert.deepEqual(JSON.parse(r.recipient_json),['first@example.test','second@example.test','third@example.test','FOURTH@example.test']);checkSafe(r);});
test('unexpected counts or already-allowed three-address input refuse a new value',()=>{
 for(const [list,to]of [
  [['a@example.test','b@example.test'],'fourth@example.test'],
  [['a@example.test','b@example.test','c@example.test'],'a@example.test'],
  [['a@example.test','b@example.test','c@example.test','d@example.test'],'fourth@example.test'],
  [['a@example.test','b@example.test','c@example.test','d@example.test','fourth@example.test'],'fourth@example.test']
 ]){
  const r=planRecipientAddition(input(packet(list),to));assert.equal(r.receipt.problem_code,'THREE_RECIPIENT_BASELINE_OR_PREPARED_FOUR_REQUIRED');assert.equal(r.recipient_json,null);checkSafe(r);
 }
});
test('foreign project, origin or runtime markers never produce recipient JSON',()=>{for(const edit of [p=>p.project='other',p=>p.origin='https://other.invalid',p=>p.env.EMAIL_GATE_MODE='ACTIVE',p=>delete p.env.SUPABASE_SERVICE_ROLE_KEY]){const p=packet();edit(p);const r=planRecipientAddition(input(p));assert.equal(r.receipt.exit_code,1);assert.equal(r.recipient_json,null);checkSafe(r);}});
test('malformed recipient lists and injected target strings cannot be copied',()=>{for(const data of [input(packet([null,null])),input(packet(),'a@example.test\r\nBcc:b@example.test'),{packet_json:secret,recipient:'fourth@example.test'}, {...input(),debug:secret}]){const r=planRecipientAddition(data);assert.equal(r.receipt.exit_code,1);assert.equal(r.recipient_json,null);checkSafe(r);}});
test('private plan output contains recipient JSON and safe receipt, never the gateway packet or provider credentials',()=>{const r=planRecipientAddition(input());assert.deepEqual(Object.keys(r).sort(),['receipt','recipient_json']);assert(!JSON.stringify(r).includes('SUPABASE_SERVICE_ROLE_KEY'));assert(!Object.hasOwn(r,'packet'));assert(!Object.hasOwn(r,'private_configuration'));checkSafe(r);});
test('actual private child returns a bounded four-address plan with networking disabled',()=>{const c=child(JSON.stringify(input()));assert.equal(c.status,0);assert.equal(c.stderr,'');const r=JSON.parse(c.stdout);assert.equal(r.receipt.stage_step,stage);assert.equal(JSON.parse(r.recipient_json).length,4);checkSafe(r);});
test('actual child preflight and malformed-private-input paths disclose no packet or stack trace',()=>{for(const data of [{preflight:true},secret]){const c=child(typeof data==='string'?data:JSON.stringify(data));assert.equal(c.stderr,'');assert.equal(c.stdout.trim().split('\n').length,1);const r=JSON.parse(c.stdout);assert.equal(r.recipient_json,null);checkSafe(r);}});
test('incorrect CLI flags return only a fixed private-input error',()=>{const c=child(JSON.stringify(input()),[]);assert.equal(c.status,1);assert.equal(c.stderr,'');const r=JSON.parse(c.stdout);assert.equal(r.receipt.problem_code,'LOCAL_PRIVATE_INPUT_REQUIRED');assert.equal(r.recipient_json,null);checkSafe(r);});


test('case-insensitive duplicate retained recipients refuse preparation',()=>{
 const r=planRecipientAddition(input(packet(['FIRST@example.test','first@example.test','third@example.test'])));
 assert.equal(r.receipt.problem_code,'UNIQUE_RETAINED_RECIPIENTS_REQUIRED');assert.equal(r.recipient_json,null);checkSafe(r);
});
test('Windows wrapper pins current planner/reader and accepted smooth ZIP without copying provider credentials',()=>{
 const source=fs.readFileSync(new URL('../scripts/prepare-fr-2-batch-w-fourth-recipient.ps1',import.meta.url),'utf8');
 for(const name of ['scripts/plan-fr-2-batch-w-fourth-recipient.mjs','scripts/check-fr-2-batch-w-recovery-recipient.mjs']){
  assert(source.includes(createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex')),name);
 }
 assert(source.includes('e49c866aa56aa3d634ef78cf8ea37c77e5a19143e7a5e0a5e63f67e28c8cb05e'));
 assert(source.includes('prepared_recipient_count -ne 4'));assert(source.includes('Set-Clipboard -Value $RecipientJSON'));
 assert(source.includes('CreateNew'));assert(source.includes('PENDING_PACKET_READBACK_REQUIRED'));
 assert(source.includes('only_recipient_setting_value_changed_in_pending_packet'));
});
test('manifest matches each actual preparation and test source',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../docs/security-audit/security-fr-2-batch-w-fourth-recipient-source-manifest.json',import.meta.url),'utf8'));
 assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);
 for(const [name,digest]of Object.entries(m.file_sha256))assert.equal(createHash('sha256').update(fs.readFileSync(new URL('../'+name,import.meta.url))).digest('hex'),digest,name);
});
