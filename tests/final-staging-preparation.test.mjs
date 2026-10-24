import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareFinalStaging,MANIFEST_HEADERS} from '../scripts/prepare-final-staging.mjs';

import {historicalSource} from './helpers/historical-reviewed-source.mjs';
const frozen=historicalSource('FR1');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const contract=JSON.parse(fs.readFileSync(path.join(repo,'docs/security-audit/security-final-staging-source-contract.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const require=createRequire(import.meta.url);
const headerHelper=require(path.join(repo,'scripts/prepare-stage-2-headers.cjs'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>['PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','TEMP','TMP','TMPDIR','LANG','LC_ALL'].includes(k.toUpperCase())));
function fixture(action) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-fr-staging-'));
 try {
  const source=path.join(root,'source');fs.mkdirSync(source);
  for(const row of [...contract.public_inputs,contract.header_generator]) {const target=path.join(source,row.path);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(frozen,row.path),target);}
  const f={root,source,output:path.join(root,'public'),receipt:path.join(root,'receipt.json'),sourcePin:contract.source_commit,project:contract.staging_project,publishableKey:'sb_publishable_SYNTHETIC_FR_ONLY',contract:structuredClone(contract)};
  return action(f);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
}
function rejects(f,pattern) {assert.throws(()=>prepareFinalStaging(f),pattern);assert.equal(fs.existsSync(f.output),false);}
function replaceInput(f,name,text) {
 const data=Buffer.from(text);fs.writeFileSync(path.join(f.source,name),data);
 const row=f.contract.public_inputs.find(r=>r.path===name);row.sha256=sha(data);row.bytes=data.length;row.git_blob_sha=createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
}
function junction(target,alias) {fs.symlinkSync(target,alias,process.platform==='win32'?'junction':'dir');}
test('actual reviewed snapshot creates complete Auth/MFA and config-overlay candidate',()=>fixture(f=>{
 const r=prepareFinalStaging(f);assert.equal(r.selected_source_inputs_verified,39);assert.equal(r.public_files,40);assert.equal(r.deployed,false);assert.equal(r.hosted_acceptance,false);
 for(const name of ['auth.html','auth-flows.js','auth-security.js','admin-mfa.js']) assert.ok(fs.statSync(path.join(f.output,name)).size>0);
 const config=fs.readFileSync(path.join(f.output,'config.js'),'utf8');assert.match(config,/dczlddwbtgvfdujgcitb/);assert.match(config,/"vapidPublicKey": ""/);
}));
test('private sentinel and source contract never enter serving output; receipt stays separate',()=>fixture(f=>{
 fs.writeFileSync(path.join(f.source,'private-secret.key'),'synthetic-private-sentinel');prepareFinalStaging(f);
 assert.equal(fs.existsSync(path.join(f.output,'private-secret.key')),false);assert.equal(fs.existsSync(path.join(f.output,'docs')),false);assert.equal(fs.existsSync(path.join(f.output,'scripts')),false);assert.equal(fs.existsSync(path.join(f.output,'receipt.json')),false);assert.ok(fs.existsSync(f.receipt));
}));
test('final HTML regenerates exact baseline/report-only CSP and includes scriptless 404 candidate',()=>fixture(f=>{
 prepareFinalStaging(f);const html=fs.readdirSync(f.output).filter(n=>n.endsWith('.html')).map(n=>fs.readFileSync(path.join(f.output,n),'utf8'));
 assert.equal(fs.readFileSync(path.join(f.output,'_headers'),'utf8'),headerHelper.buildHeaders(contract.staging_project,html)+MANIFEST_HEADERS);assert.doesNotMatch(fs.readFileSync(path.join(f.output,'404.html'),'utf8'),/<script/i);
}));
test('source inputs are unchanged and reported artifact hashes match written files without key/config hash',()=>fixture(f=>{
 const before=contract.public_inputs.map(r=>sha(fs.readFileSync(path.join(f.source,r.path))));const r=prepareFinalStaging(f);
 assert.deepEqual(contract.public_inputs.map(row=>sha(fs.readFileSync(path.join(f.source,row.path)))),before);
 assert.equal(r.public_asset_manifest.length,39);assert.equal(r.public_asset_manifest.some(x=>x.path==='config.js'),false);
 for(const row of r.public_asset_manifest)assert.equal(sha(fs.readFileSync(path.join(f.output,row.path))),row.sha256);
 assert.equal(JSON.stringify(r).includes(f.publishableKey),false);
}));
test('wrong pin and wrong staging selection reject before output',()=>fixture(f=>{
 rejects({...f,sourcePin:'0'.repeat(40)},/exact reviewed/);rejects({...f,project:contract.production_project},/exact reviewed/);
}));
test('secret/service-role, empty and source-matching keys are rejected without output',()=>fixture(f=>{
 for(const key of ['','sb_secret_SYNTHETIC','eyJ_SYNTHETIC_SERVICE_ROLE'])rejects({...f,publishableKey:key},/publishable key/);
 const sourceKey=fs.readFileSync(path.join(f.source,'config.js'),'utf8').match(/sb_publishable_[A-Za-z0-9_-]+/)[0];
 rejects({...f,publishableKey:sourceKey},/matches the source/);
}));
test('missing selected Auth module rejects before output',()=>fixture(f=>{
 fs.unlinkSync(path.join(f.source,'auth-security.js'));rejects(f);
}));
test('changed source of equal size fails identity checks',()=>fixture(f=>{
 const file=path.join(f.source,'auth-security.js'),b=fs.readFileSync(file);b[0]=b[0]^1;fs.writeFileSync(file,b);rejects(f,/identity mismatch/);
}));
test('HTML in a selected JavaScript asset is rejected even with fixture identity updated',()=>fixture(f=>{
 replaceInput(f,'auth-flows.js','<!doctype html><html><body>Fallback</body></html>');rejects(f,/HTML at/);
}));
test('missing local module import is rejected before output',()=>fixture(f=>{
 replaceInput(f,'auth-flows.js',"import {x} from './absent-local.js?v=1';\n");rejects(f,/Missing local asset dependency/);
}));
test('missing script or stylesheet dependency is rejected before output',()=>fixture(f=>{
 replaceInput(f,'auth.html','<html><head><link rel="stylesheet" href="/absent.css"></head></html>');rejects(f,/Missing local asset dependency/);
 replaceInput(f,'auth.html','<html><script src="absent.js"></script></html>');rejects(f,/Missing local asset dependency/);
}));
test('existing output and receipt remain untouched',()=>fixture(f=>{
 fs.mkdirSync(f.output);const sentinel=path.join(f.output,'sentinel');fs.writeFileSync(sentinel,'preserve');
 assert.throws(()=>prepareFinalStaging(f),/new and nonexistent/);assert.equal(fs.readFileSync(sentinel,'utf8'),'preserve');fs.rmSync(f.output,{recursive:true});
 fs.writeFileSync(f.receipt,'preserve');rejects(f,/new and nonexistent/);assert.equal(fs.readFileSync(f.receipt,'utf8'),'preserve');
}));
test('output or receipt within source and receipt within serving tree are rejected',()=>fixture(f=>{
 rejects({...f,output:path.join(f.source,'candidate')},/outside source/);
 rejects({...f,receipt:path.join(f.source,'receipt.json')},/outside source/);
 const inside=path.join(f.output,'receipt.json');assert.throws(()=>prepareFinalStaging({...f,receipt:inside}));assert.equal(fs.existsSync(f.output),false);
}));
test('source directory alias is rejected on actual filesystem',()=>fixture(f=>{
 const alias=path.join(f.root,'alias');junction(f.source,alias);rejects({...f,source:alias},/ordinary directory/);
}));
test('redirected selected asset parent is rejected on actual filesystem',()=>fixture(f=>{
 const original=path.join(f.source,'assets'),elsewhere=path.join(f.root,'moved-assets');fs.renameSync(original,elsewhere);junction(elsewhere,original);rejects(f,/redirected selected/);
}));
test('output parent alias cannot write into source',()=>fixture(f=>{
 const alias=path.join(f.root,'alias');junction(f.source,alias);rejects({...f,output:path.join(alias,'candidate')},/ordinary directory/);
}));
test('unsafe or duplicate source contract entries reject before filesystem changes',()=>fixture(f=>{
 f.contract.public_inputs[0].path='../outside';rejects(f,/Invalid selected source/);
 f.contract=structuredClone(contract);f.contract.public_inputs.push(f.contract.public_inputs[0]);rejects(f,/Invalid selected source/);
}));
test('actual CLI emits only safe success receipt and sanitizes invalid/key-bearing inputs',()=>fixture(f=>{
 const builder=path.join(repo,'scripts/prepare-final-staging.mjs'),args=[builder,f.source,f.output,f.receipt,f.sourcePin];
 const result=spawnSync(process.execPath,args,{env:{...env,MUSHAVO_STAGING_PROJECT_CONFIRMED:f.project,MUSHAVO_STAGING_PUBLISHABLE_KEY:f.publishableKey},encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);assert.equal(JSON.parse(result.stdout).public_files,40);assert.equal(result.stdout.includes(f.publishableKey),false);
 const bad=spawnSync(process.execPath,args,{env:{...env,MUSHAVO_STAGING_PROJECT_CONFIRMED:f.project,MUSHAVO_STAGING_PUBLISHABLE_KEY:'sb_secret_SENTINEL_DO_NOT_PRINT'},encoding:'utf8'});
 assert.equal(bad.status,1);assert.equal(bad.stderr.includes('SENTINEL'),false);assert.equal(JSON.parse(bad.stderr).result,'PREPARATION_FAILED_NO_DEPLOYMENT');
 const missing=spawnSync(process.execPath,[builder],{env,encoding:'utf8'});assert.equal(missing.status,1);assert.doesNotThrow(()=>JSON.parse(missing.stderr));
}));
