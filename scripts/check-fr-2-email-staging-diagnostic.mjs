import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {diagnoseEmailStaging} from './diagnose-fr-2-email-staging.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-worker-tools'));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-package-diagnostic-tests-'));
const config={supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_DIAGNOSTIC_SYNTHETIC_ONLY',vapidPublicKey:''};
const manifest='docs/security-audit/security-fr-2-email-staging-package-source-manifest.json';let number=0;
function fixture(value=config){const base=path.join(temp,String(number++));fs.mkdirSync(base);const configuration=path.join(base,'config.js');fs.writeFileSync(configuration,'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(value)+';\n');return{source:root,configuration,toolsRoot};}
function clone(){const source=path.join(temp,'source-'+number++);fs.mkdirSync(source);for(const name of [manifest,...Object.keys(JSON.parse(fs.readFileSync(path.join(root,manifest))).file_sha256)]){const target=path.join(source,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,name),target);}return source;}
try {
  await test('Original 57-input preparer builds 44 temporary files with accepted Worker, cleans output and preserves caller config',async()=>{
    const f=fixture(),before=fs.readFileSync(f.configuration),beforeNames=fs.readdirSync(os.tmpdir()).filter(x=>x.startsWith('mushavo-email-package-diagnostic-'));
    const r=await diagnoseEmailStaging(f);assert.equal(r.exit_code,0);assert.equal(r.source_hashes_verified,57);assert.equal(r.original_preparer_completed,true);assert.equal(r.public_files_verified,44);assert.equal(r.temporary_output_removed,true);
    assert.deepEqual(fs.readFileSync(f.configuration),before);assert.deepEqual(fs.readdirSync(os.tmpdir()).filter(x=>x.startsWith('mushavo-email-package-diagnostic-')),beforeNames);
  });
  await test('Missing retained configuration gives safe ENOENT and exact configuration checkpoint',async()=>{
    const f=fixture();fs.unlinkSync(f.configuration);const r=await diagnoseEmailStaging(f);assert.equal(r.exit_code,1);assert.equal(r.checkpoint,'ORIGINAL_RETAINED_CONFIGURATION_CHECK');assert.equal(r.system_error_code,'ENOENT');assert.equal(r.temporary_output_created,false);
  });
  await test('Invalid configuration gives fixed CONFIG_SCOPE without sentinel value or path',async()=>{
    const r=await diagnoseEmailStaging(fixture({...config,supabasePublishableKey:'SECRET_SENTINEL_NEVER_PRINT'}));assert.equal(r.problem_code,'CONFIG_SCOPE');assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL_NEVER_PRINT'));assert.equal(r.temporary_output_created,false);
  });
  await test('Malformed JSON never returns parser excerpts',async()=>{
    const f=fixture();fs.writeFileSync(f.configuration,'window.MUSHAVO_BUDGET_CONFIG = {"SECRET_SENTINEL_NEVER_PRINT":};');const r=await diagnoseEmailStaging(f);assert.equal(r.exception_type,'SyntaxError');assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL_NEVER_PRINT'));
  });
  await test('Exact pinned manifest is required before importing the original preparer',async()=>{
    const f={...fixture(),source:clone()};fs.appendFileSync(path.join(f.source,manifest),' ');const r=await diagnoseEmailStaging(f);assert.equal(r.problem_code,'DIAGNOSTIC_MANIFEST_IDENTITY');assert.equal(r.source_hashes_verified,0);
  });
  await test('Source tamper returns only the manifest allowlisted relative path and refuses execution',async()=>{
    const f={...fixture(),source:clone()};fs.appendFileSync(path.join(f.source,'scripts/prepare-fr-2-email-staging.mjs'),'\nthrow Error("SECRET_SENTINEL_NEVER_PRINT");');const r=await diagnoseEmailStaging(f);assert.equal(r.problem_code,'DIAGNOSTIC_SOURCE_IDENTITY');assert.equal(r.selected_source_path,'scripts/prepare-fr-2-email-staging.mjs');assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL_NEVER_PRINT'));
  });
  await test('Tools failure from the original preparer is surfaced as a fixed code and temporary output is removed',async()=>{
    const f=fixture(),tools=path.join(temp,'bad-tools');fs.mkdirSync(tools);fs.writeFileSync(path.join(tools,'package.json'),'{}');const r=await diagnoseEmailStaging({...f,toolsRoot:tools});assert.equal(r.problem_code,'TOOLS_LOCK');assert.equal(r.temporary_output_removed,true);
  });
  await test('Redirected configuration remains rejected by the original path guard',async()=>{
    const f=fixture(),linked=path.join(temp,'linked.js');fs.symlinkSync(f.configuration,linked);const r=await diagnoseEmailStaging({...f,configuration:linked});assert.equal(r.problem_code,'ORDINARY_PATH_REQUIRED');assert.equal(r.temporary_output_created,false);
  });
  await test('Actual stdin invocation returns a safe fixed JSON receipt and exit code',()=>{
    const f=fixture({...config,vapidPublicKey:'SECRET_SENTINEL_NEVER_PRINT'}),code=fs.readFileSync(path.join(root,'scripts/diagnose-fr-2-email-staging.mjs'),'utf8');
    const child=spawnSync(process.execPath,['--input-type=module','-',f.source,f.configuration,toolsRoot],{input:code,encoding:'utf8'});assert.equal(child.status,1);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).problem_code,'CONFIG_SCOPE');assert.ok(!child.stdout.includes('SECRET_SENTINEL_NEVER_PRINT'));
  });
  await test('Actual successful stdin invocation completes and removes its temporary package',()=>{
    const f=fixture(),code=fs.readFileSync(path.join(root,'scripts/diagnose-fr-2-email-staging.mjs'),'utf8');
    const child=spawnSync(process.execPath,['--input-type=module','-',f.source,f.configuration,toolsRoot],{input:code,encoding:'utf8'});
    assert.equal(child.status,0);assert.equal(child.stderr,'');const r=JSON.parse(child.stdout);
    assert.equal(r.original_preparer_completed,true);assert.equal(r.temporary_output_removed,true);assert.equal(r.ZIP_retained_for_upload,false);
    assert.ok(!child.stdout.includes(config.supabasePublishableKey));assert.ok(!child.stdout.includes(f.configuration));
  });
}finally{fs.rmSync(temp,{recursive:true,force:true});}
