import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import {prepareEmailStaging,readStagingConfiguration,verifyPackageSources} from './prepare-fr-2-email-staging.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const toolsRoot=path.resolve(process.argv[2]||path.join(root,'scripts/fixtures/email-worker-tools'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-fr-2-email-staging-package-source-manifest.json')));
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-email-package-test-'));
const config={supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_PACKAGE_ONLY',vapidPublicKey:''};
let number=0;
function fixture(value=config) {
  const base=path.join(temp,String(number++));fs.mkdirSync(base);
  const configuration=path.join(base,'prior-config.js'),candidate=path.join(base,'candidate');fs.mkdirSync(candidate);
  fs.writeFileSync(configuration,'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(value)+';\n');
  return{source:root,configuration,candidate,toolsRoot};
}
function cloneSource() {
  const source=path.join(temp,'source-'+number++);fs.mkdirSync(source);
  for(const relative of [...Object.keys(manifest.file_sha256),'docs/security-audit/security-fr-2-email-staging-package-source-manifest.json']) {
    const target=path.join(source,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target);
  }
  return source;
}
try {
  await test('Current selected public/Worker/helper sources match the frozen package manifest',()=>{
    assert.equal(Object.keys(verifyPackageSources(root).file_sha256).length,Object.keys(manifest.file_sha256).length);
  });
  const valid=fixture();let result;
  await test('Actual preparation builds the accepted Worker and exact 44-file package without altering prior input',async()=>{
    const before=fs.readFileSync(valid.configuration);result=await prepareEmailStaging(valid);
    assert.equal(result.public_files,44);assert.equal(result.selected_public_and_header_source_identities_verified,41);
    assert.equal(result.Worker_SHA256,'fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99');
    assert.deepEqual(fs.readFileSync(valid.configuration),before);assert.equal(result.do_not_upload_yet,true);assert.equal(result.deployed,false);
    assert.deepEqual(readStagingConfiguration(path.join(valid.candidate,'public/config.js')),config);
    assert.equal(verifyPackageSources(root).stage_step,result.stage_step);
  });
  await test('Independent Python ZIP reader checks all names, CRCs, bytes and STORE entries',()=>{
    const checked=spawnSync('python3',['-c',`import sys,zipfile,pathlib
p=pathlib.Path(sys.argv[1]);z=zipfile.ZipFile(sys.argv[2]);names=z.namelist()
assert len(names)==len(set(names))==44
assert z.testzip() is None
assert all('\\\\' not in n and not n.endswith('/') and '..' not in n for n in names)
assert all(z.read(n)==(p/n).read_bytes() for n in names)
assert all(i.compress_type==zipfile.ZIP_STORED for i in z.infolist())
print('44')`,path.join(valid.candidate,'public'),result.ZIP_path],{encoding:'utf8'});
    assert.equal(checked.status,0,checked.stderr);assert.equal(checked.stdout.trim(),'44');
  });
  await test('Nested binary images remain byte-identical and no private receipt/tool/SQL enters the public allowlist',()=>{
    const assets=JSON.parse(fs.readFileSync(path.join(valid.candidate,'public-asset-manifest.json')));
    assert.equal(assets.length,43);assert.ok(!assets.some(x=>x.path==='config.js'));
    assert.ok(!assets.some(x=>/receipt|manifest\.json|\.sql|\.dpapi|\.env|email-rate-worker|node_modules/.test(x.path)));
    for(const row of assets)assert.equal(sha(fs.readFileSync(path.join(valid.candidate,'public',row.path))),row.sha256);
    for(const name of ['assets/pwa-icon-192.png','assets/mushavo-budget-logo.png'])assert.deepEqual(fs.readFileSync(path.join(root,name)),fs.readFileSync(path.join(valid.candidate,'public',name)));
  });
  await test('Final HTML drives unchanged CSP generation; manifest MIME and all-route advanced Worker routing are present',async()=>{
    const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);
    const {buildHeaders}=require(path.join(root,'scripts/prepare-stage-2-headers.cjs'));
    const contract=JSON.parse(fs.readFileSync(path.join(root,'docs/security-audit/security-fr-2-email-staging-package-contract.json')));
    const names=[...contract.static_preparation_contract.public_inputs.map(x=>x.path),'404.html'];
    const html=names.filter(n=>n.endsWith('.html')).map(n=>fs.readFileSync(path.join(valid.candidate,'public',n),'utf8'));
    assert.equal(fs.readFileSync(path.join(valid.candidate,'public/_headers'),'utf8'),buildHeaders('dczlddwbtgvfdujgcitb',html)+'\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n');
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(valid.candidate,'public/_routes.json'))),{version:1,include:['/*'],exclude:[]});
    for(const n of ['email-verification.js','session-entry.js'])assert.ok(fs.statSync(path.join(valid.candidate,'public',n)).size>100);
  });
  for(const [label,changed]of[
    ['foreign project',{...config,supabaseUrl:'https://kttkospkblwvguuwnhjj.supabase.co'}],
    ['secret key',{...config,supabasePublishableKey:'sb_secret_SYNTHETIC_SECRET'}],
    ['push enabled',{...config,vapidPublicKey:'SYNTHETIC_PUSH'}],
    ['extra configuration field',{...config,extra:true}]]) {
    await test('Reject '+label+' before any candidate writes',async()=>{
      const f=fixture(changed);await assert.rejects(prepareEmailStaging(f));assert.deepEqual(fs.readdirSync(f.candidate),[]);
    });
  }
  await test('JavaScript configuration is parsed as bounded JSON and never executed',async()=>{
    const f=fixture();fs.writeFileSync(f.configuration,'window.MUSHAVO_BUDGET_CONFIG = (() => { throw "SYNTHETIC_SECRET"; })();');
    await assert.rejects(prepareEmailStaging(f));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  await test('Reusing the source production publishable key is rejected before candidate writes',async()=>{
    const key=fs.readFileSync(path.join(root,'config.js'),'utf8').match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
    assert.ok(typeof key==='string');const f=fixture({...config,supabasePublishableKey:key});
    await assert.rejects(prepareEmailStaging(f));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  await test('Changed tools lock is rejected before bundle execution and candidate writes',async()=>{
    const f=fixture(),dir=path.join(temp,'tools-'+number++);fs.mkdirSync(dir);
    fs.copyFileSync(path.join(toolsRoot,'package.json'),path.join(dir,'package.json'));
    fs.writeFileSync(path.join(dir,'package-lock.json'),'{}');
    await assert.rejects(prepareEmailStaging({...f,toolsRoot:dir}));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  for(const selected of ['email-verification.js','scripts/prepare-stage-2-headers.cjs','supabase/functions/_shared/email-verification-pages.mjs']) {
    await test('Equal-length source tamper fails before output: '+selected,async()=>{
      const f={...fixture(),source:cloneSource()},file=path.join(f.source,selected),data=fs.readFileSync(file);data[0]^=1;fs.writeFileSync(file,data);
      await assert.rejects(prepareEmailStaging(f));assert.deepEqual(fs.readdirSync(f.candidate),[]);
    });
  }
  await test('Missing selected source fails before output',async()=>{
    const f={...fixture(),source:cloneSource()};fs.unlinkSync(path.join(f.source,'session-entry.js'));
    await assert.rejects(prepareEmailStaging(f));assert.deepEqual(fs.readdirSync(f.candidate),[]);
  });
  await test('Existing candidate data is retained and never overwritten',async()=>{
    const f=fixture();fs.writeFileSync(path.join(f.candidate,'retained.txt'),'UNCHANGED');
    await assert.rejects(prepareEmailStaging(f));assert.equal(fs.readFileSync(path.join(f.candidate,'retained.txt'),'utf8'),'UNCHANGED');
  });
  await test('Redirected configuration, source and candidate paths are rejected',async()=>{
    for(const field of ['configuration','source','candidate']) {
      const f=fixture(),redirect=path.join(temp,'link-'+number++);fs.symlinkSync(f[field],redirect,field==='configuration'?'file':'dir');
      await assert.rejects(prepareEmailStaging({...f,[field]:redirect}));assert.deepEqual(fs.readdirSync(f.candidate),[]);
    }
  });
  await test('ZIP writer rejects unsafe, duplicate, empty and oversized entries',()=>{
    for(const name of ['../bad.js','assets\\bad.svg','/bad.js','folder/sub/file.js','assets/../bad.js'])assert.throws(()=>createPublicZIP([[name,Buffer.from('x')]]));
    assert.throws(()=>createPublicZIP([['a.js',Buffer.from('x')],['a.js',Buffer.from('y')]]));
    assert.throws(()=>createPublicZIP([['a.js',Buffer.alloc(0)]]));assert.throws(()=>createPublicZIP([['a.js',Buffer.alloc(2097153)]]));
  });
  await test('Independent ZIP reader detects corrupted payload CRC',()=>{
    const bytes=createPublicZIP([['a.js',Buffer.from('PAYLOAD')]]);bytes[34]^=1;
    const file=path.join(temp,'corrupt.zip');fs.writeFileSync(file,bytes);
    const check=spawnSync('python3',['-c','import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is not None',file],{encoding:'utf8'});
    assert.equal(check.status,0,check.stderr);
  });
  await test('Actual CLI failure emits only a safe fixed receipt without configuration or exception text',()=>{
    const f=fixture({...config,supabasePublishableKey:'SYNTHETIC_SECRET_SENTINEL'});
    const run=spawnSync(process.execPath,[path.join(root,'scripts/prepare-fr-2-email-staging.mjs'),root,f.configuration,f.candidate,toolsRoot],{encoding:'utf8'});
    assert.equal(run.status,1);assert.ok(!run.stdout.includes('SYNTHETIC_SECRET_SENTINEL'));assert.equal(run.stderr,'');
    assert.equal(JSON.parse(run.stdout).problem_code,'SOURCE_TOOLS_CONFIG_OR_NEW_OUTPUT_REVIEW_REQUIRED');
  });
} finally {fs.rmSync(temp,{recursive:true,force:true});}
