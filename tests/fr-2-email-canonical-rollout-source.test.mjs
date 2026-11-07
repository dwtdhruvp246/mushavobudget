import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadStagingInputs} from '../scripts/check-fr-2-email-staging-rollout-source.mjs';
import {renderCanonicalBridge,renderCanonicalRegistration,canonicalMigration,registrationBundle} from '../scripts/lib/email-canonical-rollout-source.mjs';
import {readCanonicalInputs,renderCanonicalSchema} from '../scripts/build-canonical-schema.mjs';
import {componentBody} from '../scripts/lib/email-atomic-source.mjs';
const root=new URL('../',import.meta.url),{components,baseline}=await loadStagingInputs();
const old=JSON.parse(await readFile(new URL('docs/security-audit/security-fr-2-email-staging-rollout-source-manifest.json',root),'utf8'));
const hash=s=>createHash('sha256').update(s).digest('hex');
test('Migration56 is generated exactly, registers a private invoker bridge and never calls activation or recovery',async()=>{
 const source=renderCanonicalBridge(components,baseline);assert.equal(source,await readFile(new URL('supabase/migrations/'+canonicalMigration,root),'utf8'));assert(source.indexOf('EMAIL_CANONICAL_DORMANT_INSTALLER_IDENTITY_REQUIRED')<source.indexOf('CREATE OR REPLACE FUNCTION mushavo_email_install.activate'));
 assert(source.indexOf('EMAIL_CANONICAL_STAGING_REGISTRATION_REQUIRED')<source.indexOf('CREATE FUNCTION mushavo_email_install.register_staging'));
 assert(!/SELECT\s+mushavo_email_install\.(activate|resume|quarantine)\s*\(/i.test(source));assert(!/DROP\s+(SCHEMA|FUNCTION)|SECURITY DEFINER/i.test(source.split('-- Disable the old offline activation path')[0]));assert(source.includes('SECURITY INVOKER'));
});
test('Original55 migration bytes and canonical55 prefix are preserved while the actual canonical file contains56',async()=>{
 const parts=await readCanonicalInputs();assert.equal(parts.length,56);assert.deepEqual(parts.slice(0,55).map(p=>p.name),old.migrations);
 for(const p of parts.slice(0,55))assert.equal(hash(p.sql),old.file_sha256['supabase/migrations/'+p.name]);
 const historical=renderCanonicalSchema(parts.slice(0,55));assert.equal(hash(historical),old.file_sha256['supabase/schema.sql']);
 const actual=await readFile(new URL('supabase/schema.sql',root),'utf8');assert(actual.startsWith(historical));assert.equal(actual,renderCanonicalSchema(parts));
});
test('Existing54 registration bundle contains the exact two migrations in one transaction and calls only registration',async()=>{
 const bundle=renderCanonicalRegistration(components,baseline),legacy=await readFile(new URL('supabase/migrations/20261017000000_email_verification_atomic_installer.sql',root),'utf8');
 assert.equal(bundle,await readFile(new URL(registrationBundle,root),'utf8'));assert(bundle.includes(componentBody(legacy)));assert(bundle.includes(componentBody(renderCanonicalBridge(components,baseline))));
 assert.equal((bundle.match(/^BEGIN;$/gm)||[]).length,1);assert.equal((bundle.match(/^COMMIT;$/gm)||[]).length,1);assert.equal((bundle.match(/^SELECT mushavo_email_install\.register_staging\(\)/gm)||[]).length,1);assert(!/SELECT\s+mushavo_email_install\.(activate|resume|quarantine)\s*\(/i.test(bundle));
});
test('Changed baseline anchors, delimiter collisions and missing components cannot render a bridge',()=>{
 assert.throws(()=>renderCanonicalBridge(components,baseline.replace('WITH routines AS (','WITH changed AS (')));
 assert.throws(()=>renderCanonicalBridge({...components,admin_status:components.admin_status.replace('COMMIT;\n','-- $canonical_registration_payload$\nCOMMIT;\n')},baseline));
 assert.throws(()=>renderCanonicalBridge({},baseline));assert.throws(()=>renderCanonicalRegistration(components,'invalid'));
});
test('Source CLI is check-only and rejects hosted, activation and write options without modifying SQL',async()=>{
 const file=new URL('supabase/migrations/'+canonicalMigration,root),before=await readFile(file),entry=fileURLToPath(new URL('scripts/check-fr-2-email-canonical-rollout-source.mjs',root));
 for(const [args,status]of [[[],0],[['--activate'],1],[['--write'],1],[['--hosted'],1]]){const r=spawnSync(process.execPath,[entry,...args],{encoding:'utf8'});assert.equal(r.status,status);assert.equal(JSON.parse(r.stdout).activation_invoked,false);assert.deepEqual(await readFile(file),before);}
});
