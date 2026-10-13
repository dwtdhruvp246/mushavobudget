import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {prepareCorrection} from '../scripts/prepare-final-staging-correction.mjs';
import {prepareFinalStaging,MANIFEST_HEADERS} from '../scripts/prepare-final-staging.mjs';
const source=fileURLToPath(new URL('..',import.meta.url));
const contract=JSON.parse(fs.readFileSync(path.join(source,'docs/security-audit/security-final-staging-source-contract.json')));
const key='sb_publishable_SYNTHETIC_RETAINED_CORRECTION_TEST';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture(fn) {
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-correction-test-'));
 try {
  const previous=path.join(tmp,'previous'),candidate=path.join(tmp,'corrected');fs.mkdirSync(previous);fs.mkdirSync(candidate);
  const options={source,previous,candidate},publicRoot=path.join(previous,'public'),receiptPath=path.join(previous,'preparation-receipt.json');
  const receipt=prepareFinalStaging({source,output:publicRoot,receipt:receiptPath,sourcePin:contract.source_commit,project:contract.staging_project,publishableKey:key,contract});
  const header=path.join(publicRoot,'_headers');const old=fs.readFileSync(header,'utf8').slice(0,-MANIFEST_HEADERS.length);fs.writeFileSync(header,old);
  const row=receipt.public_asset_manifest.find(x=>x.path==='_headers');row.bytes=Buffer.byteLength(old);row.sha256=sha(old);fs.writeFileSync(receiptPath,JSON.stringify(receipt));
  return fn({options,tmp,publicRoot,receiptPath,receipt});
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
function rejected(f) {assert.throws(()=>prepareCorrection(f.options));assert.deepEqual(fs.readdirSync(f.options.candidate),[]);}
test('real retained 40-file candidate produces only the intended header addition and safe receipt',()=>fixture(f=>{
 const names=[...contract.public_inputs.map(x=>x.path),'404.html','_headers'];const before=names.map(n=>sha(fs.readFileSync(path.join(f.publicRoot,n))));
 const result=prepareCorrection(f.options);assert.equal(result.retained_non_header_file_bytes_matched,39);assert.equal(result.hosted_acceptance,false);
 assert.deepEqual(names.map(n=>sha(fs.readFileSync(path.join(f.publicRoot,n)))),before);
 for(const n of names.filter(n=>n!=='_headers'))assert.deepEqual(fs.readFileSync(path.join(f.options.candidate,'public',n)),fs.readFileSync(path.join(f.publicRoot,n)));
 assert.equal(fs.readFileSync(path.join(f.options.candidate,'public/_headers'),'utf8'),fs.readFileSync(path.join(f.publicRoot,'_headers'),'utf8')+MANIFEST_HEADERS);
 assert.equal(JSON.stringify(result).includes(key),false);assert.equal(result.deployed,false);
}));
test('changed old SVG is rejected before creating any corrected public output',()=>fixture(f=>{fs.appendFileSync(path.join(f.publicRoot,'assets/ledger-mark.svg'),'X');rejected(f);}));
test('tampered old receipt cannot legitimize altered source bytes',()=>fixture(f=>{
 const n='assets/pwa-icon.svg',file=path.join(f.publicRoot,n);fs.appendFileSync(file,'X');const b=fs.readFileSync(file),row=f.receipt.public_asset_manifest.find(x=>x.path===n);row.bytes=b.length;row.sha256=sha(b);fs.writeFileSync(f.receiptPath,JSON.stringify(f.receipt));rejected(f);
}));
test('unexpected private or extra public entry is rejected',()=>fixture(f=>{fs.writeFileSync(path.join(f.publicRoot,'private.key'),'SYNTHETIC');rejected(f);}));
test('redirected SVG entry is rejected before output',()=>fixture(f=>{
 const p=path.join(f.publicRoot,'assets/ledger-mark.svg'),target=path.join(f.tmp,'other-svg');fs.mkdirSync(target);fs.renameSync(p,path.join(target,'original.svg'));fs.symlinkSync(target,p,process.platform==='win32'?'junction':'dir');rejected(f);
}));
test('linked assets directory is rejected before output',()=>fixture(f=>{
 const p=path.join(f.publicRoot,'assets'),target=path.join(f.tmp,'other-assets');fs.renameSync(p,target);fs.symlinkSync(target,p,process.platform==='win32'?'junction':'dir');rejected(f);
}));
test('nonempty corrected parent is preserved and rejected',()=>fixture(f=>{
 fs.writeFileSync(path.join(f.options.candidate,'sentinel'),'preserve');assert.throws(()=>prepareCorrection(f.options));assert.equal(fs.readFileSync(path.join(f.options.candidate,'sentinel'),'utf8'),'preserve');
}));
test('production URL, secret key and source key reuse each reject before output',()=>fixture(f=>{
 const sourceKey=fs.readFileSync(path.join(source,'config.js'),'utf8').match(/sb_publishable_[A-Za-z0-9_-]+/)[0];
 for(const change of [{supabaseUrl:'https://kttkospkblwvguuwnhjj.supabase.co'},{supabasePublishableKey:'sb_secret_SENTINEL'},{supabasePublishableKey:sourceKey}]) {
  fs.writeFileSync(path.join(f.publicRoot,'config.js'),'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:key,vapidPublicKey:'',...change})+';');rejected(f);
 }
}));
test('duplicate old manifest names cannot hide missing identities',()=>fixture(f=>{
 f.receipt.public_asset_manifest[0]=f.receipt.public_asset_manifest[1];fs.writeFileSync(f.receiptPath,JSON.stringify(f.receipt));rejected(f);
}));
test('actual correction CLI success and failure omit config keys and raw exceptions',()=>fixture(f=>{
 const script=path.join(source,'scripts/prepare-final-staging-correction.mjs');
 const ok=spawnSync(process.execPath,[script,f.options.previous,f.options.candidate],{encoding:'utf8'});assert.equal(ok.status,0,ok.stderr);assert.equal(JSON.parse(ok.stdout).public_files,40);assert.equal(ok.stdout.includes(key),false);
 const bad=spawnSync(process.execPath,[script,'SYNTHETIC_PRIVATE_SENTINEL',f.options.candidate],{encoding:'utf8'});assert.equal(bad.status,1);assert.equal(bad.stderr.includes('SYNTHETIC_PRIVATE_SENTINEL'),false);assert.equal(JSON.parse(bad.stderr).result,'CORRECTION_PREPARATION_FAILED');
}));
