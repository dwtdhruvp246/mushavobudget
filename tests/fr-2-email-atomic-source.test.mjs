import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {componentBody,componentNames,installerMigration,renderAtomicInstaller} from '../scripts/lib/email-atomic-source.mjs';
const components=Object.fromEntries(await Promise.all(componentNames.map(async name=>[name,await readFile(new URL('../supabase/candidates/security_fr_2_4_email_'+name+'.sql',import.meta.url),'utf8')])));
test('Generated migration exactly registers the four reviewed components without calling activation',async()=>{
 const source=renderAtomicInstaller(components);assert.equal(source,await readFile(new URL('../supabase/migrations/'+installerMigration,import.meta.url),'utf8'));assert.equal((source.match(/-- COMPONENT /g)||[]).length,4);assert(!/SELECT\s+mushavo_email_install\.activate\s*\(/i.test(source));
});
test('Only component transaction/settings frames are removed; actual guarded SQL bodies are retained',()=>{
 for(const source of Object.values(components)){const body=componentBody(source);assert(!body.startsWith('BEGIN;'));assert(!body.endsWith('COMMIT;\n'));assert(body.includes('DO $'));assert.equal(body,componentBody(source.replace(/\n/g,'\r\n')));}
 const generated=renderAtomicInstaller(components);for(const source of Object.values(components))assert(generated.includes(componentBody(source)));
});
test('Missing, extra, malformed or executable-prefix components cannot generate an installer',()=>{
 assert.throws(()=>renderAtomicInstaller(null));assert.throws(()=>renderAtomicInstaller({...components,extra:'x'}));assert.throws(()=>renderAtomicInstaller({verification_backend:components.verification_backend}));
 for(const source of['','select 1;\n'+components.admin_status,components.admin_status.replace('COMMIT;','ROLLBACK;'),components.admin_status.replace("lock_timeout='3s'","lock_timeout='0'")])assert.throws(()=>componentBody(source));
});
test('Payload delimiter collisions are rejected instead of escaping the private function definition',()=>{
 for(const marker of['$email_component_3$','$email_activate$'])assert.throws(()=>renderAtomicInstaller({...components,admin_status:components.admin_status.replace('COMMIT;\n','-- '+marker+'\nCOMMIT;\n')}));
});
test('The source CLI is read-only and verifies the generated migration',async()=>{
 const file=new URL('../supabase/migrations/'+installerMigration,import.meta.url),before=await readFile(file);const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-fr-2-email-atomic-source.mjs',import.meta.url))],{encoding:'utf8'});assert.equal(run.status,0);assert.deepEqual(JSON.parse(run.stdout),{result:'ATOMIC_INSTALLER_MATCHES_REVIEWED_COMPONENTS',components:4,files_changed:false,activation_invoked:false});assert.deepEqual(await readFile(file),before);
});
test('Unknown source CLI options cannot write SQL or invoke activation',async()=>{
 const file=new URL('../supabase/migrations/'+installerMigration,import.meta.url),before=await readFile(file);const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-fr-2-email-atomic-source.mjs',import.meta.url)),'--activate'],{encoding:'utf8'});assert.equal(run.status,1);assert.deepEqual(await readFile(file),before);
});
