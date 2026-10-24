import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {buildEmailWorkers} from '../scripts/lib/build-fr-2-email-workers.mjs';
import {stage,modernWorker,verifyModernPackageSources,readCanonicalPublicZIP,configurationFromZIP,compareReplacementEntries,buildModernPublicCandidate,prepareModernReplacementZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const config=()=>Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_PACKAGE_ONLY',vapidPublicKey:''})+';\n');
const entries=()=>Array.from({length:44},(_,i)=>[i===0?'config.js':'asset'+i+'.js',i===0?config():Buffer.from('fixture '+i)]);
test('Actual new manifest matches every packaging input',()=>{const m=verifyModernPackageSources(root);assert.equal(m.stage_step,stage);assert.equal(Object.keys(m.file_sha256).length,m.source_file_count);});
test('Portable reader preserves all44 entries and data from actual ZIP writer',()=>{const source=entries(),zip=createPublicZIP(source);assert.deepEqual([...readCanonicalPublicZIP(zip)],source);});
test('Reader refuses truncated or compressed/noncanonical archive metadata',()=>{const zip=createPublicZIP(entries());for(const b of [zip.subarray(0,zip.length-1),Buffer.alloc(22),Buffer.alloc(8388609)])assert.throws(()=>readCanonicalPublicZIP(b));const modified=Buffer.from(zip);modified.writeUInt16LE(8,8);assert.throws(()=>readCanonicalPublicZIP(modified));});
test('Reader detects content corruption through canonical CRC and directory readback',()=>{const b=createPublicZIP(entries());b[50]^=1;assert.throws(()=>readCanonicalPublicZIP(b));});
test('Reader rejects archive comments, extra entries and Windows path substitutions',()=>{assert.throws(()=>readCanonicalPublicZIP(Buffer.concat([createPublicZIP(entries()),Buffer.from('x')])));assert.throws(()=>readCanonicalPublicZIP(createPublicZIP(entries().slice(1))));const b=createPublicZIP(entries());b[30]=92;assert.throws(()=>readCanonicalPublicZIP(b));});
test('Actual parser returns only exact staging public configuration',()=>{const c=configurationFromZIP(new Map(entries()));assert.equal(c.vapidPublicKey,'');assert.equal(c.supabasePublishableKey,'sb_publishable_SYNTHETIC_PACKAGE_ONLY');});
for(const [title,change]of [
  ['foreign backend',c=>{c.supabaseUrl='https://foreign.supabase.co';}],
  ['enabled push',c=>{c.vapidPublicKey='PUSH';}],
  ['secret in public slot',c=>{c.supabasePublishableKey='sb_secret_REJECT';}],
  ['unexpected secret field',c=>{c.secret='sb_secret_REJECT';}]
])test('Configuration rejects '+title,()=>{const c=configurationFromZIP(new Map(entries()));change(c);assert.throws(()=>configurationFromZIP(new Map([['config.js',Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(c)+';')]])));});
test('Executable suffix and missing config are rejected without evaluation',()=>{assert.throws(()=>configurationFromZIP(new Map()));assert.throws(()=>configurationFromZIP(new Map([['config.js',Buffer.concat([config(),Buffer.from('globalThis.__executed=true;')])]])));assert.equal(globalThis.__executed,undefined);});
test('Retained ZIP digest is required before creating any output',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'modern-package-reject-'));try{const old=path.join(d,'old.zip'),out=path.join(d,'out');fs.writeFileSync(old,createPublicZIP(entries()));fs.mkdirSync(out);await assert.rejects(prepareModernReplacementZIP({source:root,candidate:out,toolsRoot:path.join(root,'scripts/fixtures/email-worker-tools'),retainedZIP:old}),/RETAINED_ZIP_IDENTITY/);assert.deepEqual(fs.readdirSync(out),[]);}finally{fs.rmSync(d,{recursive:true,force:true});}});
test('Unrelated asset change, removed entry and stale Worker all fail comparison',()=>{const p=new Map(entries()),c=new Map(entries());c.get('asset1.js')[0]^=1;assert.throws(()=>compareReplacementEntries(c,p));c.delete('asset2.js');assert.throws(()=>compareReplacementEntries(c,p));const e=new Map(entries());e.delete('asset1.js');e.set('_worker.js',Buffer.from('stale'));assert.throws(()=>compareReplacementEntries(e,e));});
test('Actual new Worker and static exporter build44 files with preserved CSP, route and staging scope',async t=>{
  let phase='MODERN_WORKER_AND_STATIC_EXPORT';
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'modern-package-actual-'));try{
    const b=await buildModernPublicCandidate({source:root,candidate:d,toolsRoot:path.join(root,'scripts/fixtures/email-worker-tools'),configuration:config().toString()});
    phase='PUBLIC_SCOPE_HEADERS_AND_ZIP';
    assert.equal(b.entries.size,44);assert.equal(b.component.selected_source_inputs_verified,41);assert.equal(hash(b.entries.get('_worker.js')),modernWorker);
    assert.deepEqual(JSON.parse(b.entries.get('_routes.json')),{version:1,include:['/*'],exclude:[]});
    assert.match(b.entries.get('_headers').toString(),/application\/manifest\+json/);assert.match(b.entries.get('_headers').toString(),/sha256-/);
    const raw=Buffer.concat([...b.entries.values()]);assert(!raw.includes(Buffer.from('kttkospkblwvguuwnhjj')));
    assert.deepEqual(Object.keys(configurationFromZIP(b.entries)).sort(),['supabasePublishableKey','supabaseUrl','vapidPublicKey']);
    assert(![...b.entries.keys()].some(p=>/receipt|\.sql$|dpapi|package-lock|security-audit/.test(p)));
    const zip=createPublicZIP([...b.entries]),readback=readCanonicalPublicZIP(zip);for(const [p,v]of b.entries)assert(v.equals(readback.get(p)));
    // Reconstruct only the historical fixture adapter and require its original source/body identity.
    // This temporary copy never modifies current source or an owner artifact.
    phase='HISTORICAL_SOURCE_RECONSTRUCTION';
    const historical=path.join(d,'historical');fs.mkdirSync(historical);
    for(const name of ['crypto','http','zoho','gateway','rate-client','pages','rate-do']){
      const relative='supabase/functions/_shared/email-verification-'+name+'.mjs',target=path.join(historical,relative);
      fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,relative),target);
    }
    const gateway=path.join(historical,'supabase/functions/_shared/email-verification-gateway.mjs');
    const modernBlock="      // Modern secret keys authenticate through apikey; they are not bearer JWTs.\n      // Retain the legacy JWT transport for an existing service_role credential.\n      const headers = {apikey:serviceKey, 'content-type':'application/json'};\n      if (!serviceKey.startsWith('sb_secret_')) headers.authorization = 'Bearer ' + serviceKey;\n      return await upstreamJSON(fetcher, backend + '/rest/v1/rpc/email_gate_' + name, {\n        method:'POST', headers, body:JSON.stringify(args)";
    const oldBlock="      return await upstreamJSON(fetcher, backend + '/rest/v1/rpc/email_gate_' + name, {\n        method:'POST', headers:{apikey:serviceKey, authorization:'Bearer ' + serviceKey,\n          'content-type':'application/json'}, body:JSON.stringify(args)";
    const priorSource=fs.readFileSync(gateway,'utf8').replace(modernBlock,oldBlock);
    assert.equal(hash(Buffer.from(priorSource)),'f9c39c3d599f3834dea1d7e8c17d6819c4656213ed3292efcb970d9b00b1dc09');
    fs.writeFileSync(gateway,priorSource);
    const require=createRequire(path.join(root,'scripts/fixtures/email-worker-tools/package.json'));
    phase='HISTORICAL_BUNDLE_AND_43_FILE_COMPARISON';
    const oldBundles=await buildEmailWorkers(require('esbuild'),historical),previous=new Map(b.entries);
    previous.set('_worker.js',Buffer.from(oldBundles.pages));assert.equal(compareReplacementEntries(b.entries,previous),43);
    const changed=new Map(previous);changed.set('app.html',Buffer.from('unrelated change'));assert.throws(()=>compareReplacementEntries(b.entries,changed),/UNRELATED_PUBLIC_CHANGE/);
    // The portable suite requires only its pinned Node/esbuild tools.
    // Independent Windows .NET readback remains mandatory in the packaging wrapper.
    phase='COMPLETE';
  }finally{t.diagnostic('SAFE_PACKAGE_PHASE='+phase);fs.rmSync(d,{recursive:true,force:true});}
});
test('Existing output is never reused by actual exporter',async()=>{const d=fs.mkdtempSync(path.join(os.tmpdir(),'modern-package-existing-'));try{fs.writeFileSync(path.join(d,'keep'),'old');await assert.rejects(buildModernPublicCandidate({source:root,candidate:d,toolsRoot:path.join(root,'scripts/fixtures/email-worker-tools'),configuration:config().toString()}),/NEW_EMPTY/);assert.equal(fs.readFileSync(path.join(d,'keep'),'utf8'),'old');}finally{fs.rmSync(d,{recursive:true,force:true});}});
test('CLI errors emit a fixed safe receipt with no configuration or raw paths',()=>{const r=spawnSync(process.execPath,[path.join(root,'scripts/prepare-fr-2-email-modern-package.mjs')],{encoding:'utf8'});assert.equal(r.status,1);const j=JSON.parse(r.stdout);assert.equal(j.actual_hosted_requests,0);assert.equal(j.raw_exceptions_configuration_or_keys_printed,false);assert.equal(j.exit_code,1);assert(!r.stdout.includes(root));assert.equal(r.stderr,'');});
test('Windows wrapper retains PS5.1 array handling and independent44-entry readback without private files',()=>{const ps=fs.readFileSync(path.join(root,'scripts/package-fr-2-email-modern.ps1'),'utf8');assert.match(ps,/\$Manifest = @\(\$ParsedManifest\)/);assert.match(ps,/INDEPENDENT_DOTNET_ZIP_READBACK/);assert.match(ps,/ZIP_content_hashes_matched -NotePropertyValue 44/);assert.match(ps,/public_files_except_Worker_byte_identical_to_prior_ZIP -ne 43/);assert(!/Read-Host|ConvertFrom-SecureString|ConvertTo-SecureString|\.dpapi|CLOUDFLARE_API_TOKEN/.test(ps));});
