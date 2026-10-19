import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';import assert from 'node:assert/strict';import test from 'node:test';
import {retryEmailStaging} from './retry-fr-2-email-staging.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-worker-tools'));
const base=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-retry-tests-')),outputs=[];
const config={supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_RETRY_ONLY',vapidPublicKey:''};
const manifest='docs/security-audit/security-fr-2-email-staging-package-source-manifest.json';let number=0;
function fixture(value=config){const dir=path.join(base,String(number++));fs.mkdirSync(dir);const configuration=path.join(dir,'config.js');fs.writeFileSync(configuration,'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(value)+';\n');const candidate=path.join(os.tmpdir(),'mushavo-email-staging-review-'+randomUUID().replaceAll('-',''));fs.mkdirSync(candidate);outputs.push(candidate);return{source:root,toolsRoot,configuration,candidate};}
function clone(){const source=path.join(base,'source with spaces '+number++);fs.mkdirSync(source);for(const file of [manifest,...Object.keys(JSON.parse(fs.readFileSync(path.join(root,manifest))).file_sha256)]){const target=path.join(source,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}return source;}
function stdin(f){return spawnSync(process.execPath,['--input-type=module','-',f.source,f.configuration,f.candidate,f.toolsRoot],{input:fs.readFileSync(path.join(root,'scripts/retry-fr-2-email-staging.mjs'),'utf8'),encoding:'utf8'});}
try {
  await test('Original API retains a new 44-file review ZIP, accepted Worker and safe saved receipt without modifying input',async()=>{
    const f=fixture(),before=fs.readFileSync(f.configuration),r=await retryEmailStaging(f);
    assert.equal(r.exit_code,0);assert.equal(r.public_files,44);assert.equal(r.Worker_SHA256,'fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99');
    assert.deepEqual(fs.readFileSync(f.configuration),before);assert.equal(r.wrapper_revision,'TEMP_FOLDER_DIRECT_API_SAVED_RECEIPT');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.candidate,'preparation-receipt.json'))),r);
    const p=spawnSync('python3',['-c',`import zipfile,sys,pathlib
p=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(p/'mushavo-email-staging-review.zip')
assert len(z.namelist())==len(set(z.namelist()))==44 and z.testzip() is None
assert all('\\\\' not in n and z.read(n)==(p/'public'/n).read_bytes() for n in z.namelist())
print(44)`,f.candidate],{encoding:'utf8'});assert.equal(p.status,0,p.stderr);assert.equal(p.stdout.trim(),'44');
  });
  await test('Exact owner stdin command creates a saved receipt and exits successfully',()=>{
    const f=fixture(),p=stdin(f);assert.equal(p.status,0,p.stderr);assert.equal(p.stderr,'');const r=JSON.parse(p.stdout);
    assert.equal(r.public_files,44);assert.equal(r.deployed,false);assert.equal(r.do_not_upload_yet,true);assert.equal(r.Windows_dotNET_ZIP_independent_readback_verified,false);
    assert.equal(JSON.parse(fs.readFileSync(path.join(f.candidate,'preparation-receipt.json'))).ZIP_path,r.ZIP_path);
  });
  await test('Original verified source under a path containing spaces remains supported',async()=>{
    const r=await retryEmailStaging({...fixture(),source:clone()});assert.equal(r.exit_code,0);assert.equal(r.source_files_SHA256_verified,57);
  });
  await test('Executable or invalid configuration fails safely before public output',async()=>{
    const f=fixture({...config,supabasePublishableKey:'SECRET_SENTINEL_NEVER_PRINT'}),r=await retryEmailStaging(f);assert.equal(r.problem_code,'CONFIG_SCOPE');assert.equal(r.checkpoint,'ORIGINAL_API_PREPARATION');assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL_NEVER_PRINT'));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  await test('Changed original source refuses execution and identifies only a pinned relative path',async()=>{
    const f={...fixture(),source:clone()};fs.appendFileSync(path.join(f.source,'email-verification.js'),'\nSECRET_SENTINEL_NEVER_PRINT');const r=await retryEmailStaging(f);
    assert.equal(r.problem_code,'RETRY_SOURCE_IDENTITY');assert.equal(r.selected_source_path,'email-verification.js');assert.ok(!JSON.stringify(r).includes('SECRET_SENTINEL_NEVER_PRINT'));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  await test('Changed original manifest refuses all preparation',async()=>{
    const f={...fixture(),source:clone()};fs.appendFileSync(path.join(f.source,manifest),' ');const r=await retryEmailStaging(f);assert.equal(r.problem_code,'RETRY_MANIFEST_IDENTITY');assert.equal(r.original_source_hashes_verified,0);
  });
  await test('Existing output content is preserved by the unchanged original guard',async()=>{
    const f=fixture();fs.writeFileSync(path.join(f.candidate,'retained.txt'),'UNCHANGED');const r=await retryEmailStaging(f);assert.equal(r.problem_code,'NEW_ISOLATED_EMPTY_CANDIDATE_REQUIRED');assert.equal(fs.readFileSync(path.join(f.candidate,'retained.txt'),'utf8'),'UNCHANGED');
  });
  await test('Retry refuses any output path outside its new ordinary temp naming scope',async()=>{
    const f=fixture(),candidate=path.join(base,'outside');fs.mkdirSync(candidate);const r=await retryEmailStaging({...f,candidate});assert.equal(r.problem_code,'RETRY_TEMP_OUTPUT_SCOPE');assert.deepEqual(fs.readdirSync(candidate),[]);
  });
  await test('Actual stdin failure prints fixed checkpoint/code without private configuration values',()=>{
    const f=fixture({...config,vapidPublicKey:'SECRET_SENTINEL_NEVER_PRINT'}),p=stdin(f);assert.equal(p.status,1);assert.equal(p.stderr,'');const r=JSON.parse(p.stdout);assert.equal(r.problem_code,'CONFIG_SCOPE');assert.equal(r.checkpoint,'ORIGINAL_API_PREPARATION');assert.ok(!p.stdout.includes('SECRET_SENTINEL_NEVER_PRINT'));
  });
} finally {for(const output of outputs)fs.rmSync(output,{recursive:true,force:true});fs.rmSync(base,{recursive:true,force:true});}
