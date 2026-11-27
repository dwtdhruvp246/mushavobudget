import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import tool from '../scripts/security-stage-1-storage-backup.cjs';
const KEY = 'sb_secret_SYNTHETIC_ONLY_NOT_A_REAL_KEY_12345';
const buckets = ['business-documents','business-logos','payment-proofs','subscription-proofs'].map(id => ({id,public:false,type:'STANDARD'}));
const obj = {name:'logo.png',id:'synthetic-object',metadata:{size:3},updated_at:'2026-10-08T00:00:00Z'};
function temp(t) { const p=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-storage-fixture-')); t.after(()=>fs.rmSync(p,{recursive:true,force:true})); return p; }
function mock(options={}) {
  const calls=[]; let snapshot=0;
  const fetcher=async (url,init) => {
    calls.push({url:String(url),...init}); const u=new URL(url);
    if(u.pathname.endsWith('/bucket')) {snapshot++; return Response.json(buckets);}
    if(init.method==='POST') {
      const body=JSON.parse(init.body);
      if(u.pathname.endsWith('/business-logos') && body.prefix==='') return Response.json(options.drift && snapshot>1 ? [{...obj,updated_at:'changed'}] : options.empty ? [] : [obj]);
      return Response.json([]);
    }
    if(options.denied) return new Response('PRIVATE_RAW_ERROR_'+KEY,{status:403});
    return new Response(options.bytes || 'abc',{headers:{'content-length':String((options.bytes || 'abc').length)}});
  }; return {fetcher,calls};
}
// Fixture packager records hashes; it is explicitly NOT native 7-Zip/encryption proof.
function fixturePackager(run) {
  return {file:'synthetic.7z',bytes:1,sha256:'fixture-only',source_files:fs.readdirSync(path.join(run,'payload')).map(name=>{
    const b=fs.readFileSync(path.join(run,'payload',name));return {name,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')};
  })};
}
test('privileged key headers reject public/session/wrong-project inputs',()=>{
  assert.deepEqual(tool.keyHeaders(KEY),{apikey:KEY});
  const jwt=claims=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.signature';
  assert.equal(tool.keyHeaders(jwt({role:'service_role',ref:tool.PROJECT})).Authorization.startsWith('Bearer '),true);
  for(const k of ['sb_publishable_example',jwt({role:'authenticated',ref:tool.PROJECT}),jwt({role:'service_role',ref:'other'}),KEY+'\n']) assert.throws(()=>tool.keyHeaders(k),/PRIVILEGED_KEY_REQUIRED/);
});
test('recursive folder traversal and full-page pagination retain private paths',async()=>{
  const req=async(route,body)=>{
    if(!body) return Response.json(route.includes('offset=0')?[{id:'b'}]:[]);
    if(!body.prefix) return Response.json(body.offset===0?[{name:'folder',id:null,metadata:null}]:[]);
    return Response.json(body.offset===0?[{...obj,name:'a #%.png'}]:[]);
  };
  const inv=await tool.inventory(req,{...tool.LIMITS,page:1});
  assert.equal(inv.objects[0].name,'folder/a #%.png');
  assert.equal(tool.objectRoute('b',inv.objects[0].name),'/object/authenticated/b/folder/a%20%23%25.png');
  assert.throws(()=>tool.objectRoute('b','../private'),/REMOTE_NAME_REVIEW/);
});
test('repeated pages, invalid metadata and nonstandard buckets stop coverage claims',async()=>{
  await assert.rejects(tool.inventory(async()=>Response.json([{id:'b'}]),{...tool.LIMITS,page:1}),/PAGINATION_OR_SCOPE_REVIEW/);
  for(const o of [{...obj,metadata:null},{...obj,metadata:{size:'3'}},{...obj,name:'../x'}]) {
    await assert.rejects(tool.inventory(async(_,body)=>Response.json(body?[o]:[{id:'b'}])),/REVIEW/);
  }
  await assert.rejects(tool.inventory(async()=>Response.json([{id:'b',type:'VECTOR'}])),/NONSTANDARD_BUCKET_REVIEW/);
});
test('requests stay at fixed HTTPS origin, refuse redirects, use read-only list POST',async()=>{
  let seen;
  const request=tool.client(KEY,async(u,i)=>{seen={u,i};return new Response('',{status:302,headers:{location:'https://evil.invalid'}});});
  await assert.rejects(request('/bucket'),/REDIRECT_REFUSED/);
  assert.equal(seen.u.origin,tool.ORIGIN);assert.equal(seen.i.redirect,'manual');assert.equal(seen.i.headers.apikey,KEY);
  await assert.rejects(request('/object/upload',{x:1}),/ENDPOINT_REVIEW/);
  const bounded=tool.client(KEY,async()=>Response.json([]),{...tool.LIMITS,requests:1});
  await bounded('/bucket');await assert.rejects(bounded('/bucket'),/PASS_LIMIT_REACHED/);
});
test('short, oversized and header-mismatched downloads cannot verify',async t=>{
  const root=temp(t);
  for(const [i,b,expected,header] of [[1,'ab',3,null],[2,'abcd',3,null],[3,'abc',3,'4']]) {
    await assert.rejects(tool.download(new Response(b,{headers:header?{'content-length':header}:undefined}),path.join(root,String(i)),expected,10),/DOWNLOAD_SIZE_MISMATCH/);
  }
});
test('consolidated synthetic success maps numbered files, keeps hashes and names private',async t=>{
  const root=temp(t),api=mock();
  const s=await tool.runPass(root,KEY,'dummy',{fetcher:api.fetcher,packager:fixturePackager});
  assert.equal(s.result,'STORAGE_CURRENT_COMPONENT_LOCAL_PASS');assert.equal(s.downloaded_bytes,3);
  assert.equal(s.snapshot_is_atomic,false);assert.equal(s.complete_platform_backup_verified,false);
  const receipt=fs.readFileSync(path.join(s.run_directory,'verification.json'),'utf8');
  assert.match(receipt,/logo.png/);assert.doesNotMatch(JSON.stringify(s),/logo.png|sha256|sb_secret/);assert.doesNotMatch(receipt,/sb_secret/);
  assert.deepEqual(fs.readFileSync(path.join(s.run_directory,'payload','object-000001.bin')),Buffer.from('abc'));
  assert(api.calls.every(c=>c.method==='GET'||c.method==='POST'&&c.url.includes('/object/list/')));
});
test('source drift and denied file reads produce bounded REVIEW with preserved evidence',async t=>{
  for(const options of [{drift:true},{denied:true}]) {
    const api=mock(options),s=await tool.runPass(temp(t),KEY,'dummy',{fetcher:api.fetcher,packager:fixturePackager});
    assert.equal(s.result,'STORAGE_COMPONENT_REVIEW');
    assert(s.problem_codes.includes(options.drift?'SOURCE_INVENTORY_CHANGED':'ACCESS_DENIED'));
    assert.doesNotMatch(JSON.stringify(s),/PRIVATE_RAW_ERROR|sb_secret/);
  }
});
test('capacity and archive failures remain REVIEW; no silent successful package claim',async t=>{
  const api=mock();
  const capped=await tool.runPass(temp(t),KEY,'dummy',{fetcher:api.fetcher,limits:{totalBytes:1},packager:fixturePackager});
  assert(capped.problem_codes.includes('DOWNLOAD_CAPACITY_LIMIT'));assert.equal(capped.all_downloaded_sizes_and_local_hashes_match,false);
  const s=await tool.runPass(temp(t),KEY,'dummy',{fetcher:mock().fetcher,packager:()=>{throw new Error('PRIVATE '+KEY);}});
  assert.equal(s.encrypted_package_and_extracted_hashes_verified,false);assert.equal(s.result,'STORAGE_COMPONENT_REVIEW');
});
test('packaging rejects corrupted extraction and plaintext header listing using native-runner fixtures',t=>{
  const root=temp(t),exe=path.join(root,'dummy.exe');fs.writeFileSync(exe,'synthetic, not executable');
  for(const mode of ['corrupt','header']) {
    const run=path.join(root,mode);fs.mkdirSync(path.join(run,'payload'),{recursive:true});fs.writeFileSync(path.join(run,'payload','manifest.json'),'{}');
    const runner=(_,args)=>{
      if(args[0]==='a') fs.writeFileSync(path.join(run,'storage-component.partial.7z'),'synthetic');
      if(args[0]==='l') return {status:2,stdout:mode==='header'?'manifest.json':'denied'};
      if(args[0]==='x') {fs.mkdirSync(path.join(run,'verified-files','payload'));fs.writeFileSync(path.join(run,'verified-files','payload','manifest.json'),'CORRUPTED');}
      return {status:0};
    };
    assert.throws(()=>tool.packageFiles(run,exe,runner),mode==='header'?/ENCRYPTED_HEADER_CHECK_FAILED/:/EXTRACTED_HASH_MISMATCH/);
    assert.equal(fs.existsSync(path.join(run,'storage-component.7z')),false);
  }
});
test('CLI public-key rejection exposes no key or remote content and never launches archive tool',t=>{
  const root=temp(t),bad='sb_publishable_SYNTHETIC_PUBLIC_KEY_123';
  const r=spawnSync(process.execPath,[path.resolve('scripts/security-stage-1-storage-backup.cjs'),root,'not-an-executable'],{env:{...process.env,MUSHAVO_STORAGE_BACKUP_KEY:bad},encoding:'utf8'});
  assert.equal(r.status,2);assert.doesNotMatch(r.stdout+r.stderr,new RegExp(bad));
  const s=JSON.parse(r.stdout);assert(s.problem_codes.includes('PRIVILEGED_KEY_REQUIRED'));assert(s.problem_codes.includes('ARCHIVE_NOT_ATTEMPTED_NO_COMPLETE_INVENTORY'));
});
