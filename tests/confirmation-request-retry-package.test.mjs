import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {patchConfirmationRequestEntries} from '../scripts/prepare-confirmation-request-retry.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {readPublicZIP} from '../scripts/lib/read-public-zip.mjs';

const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=name=>fs.readFileSync(new URL(name,root));
const newBlock="    const requestError = result.error;\n    if (requestError && (\n      requestError.status === 429\n      || requestError.code?.startsWith('over_')\n      || requestError.status === 0\n      || requestError.status >= 500\n      || requestError.name === 'AuthRetryableFetchError'\n    )) throw requestError;";
const oldLine="    if (result.error && (result.error.status === 429 || result.error.code?.startsWith('over_'))) throw result.error;";
function fixture(){
 const previous=new Map([
  ['auth-flows.js',Buffer.from(read('auth-flows.js').toString().replace(newBlock,oldLine))],
  ['auth.html',Buffer.from(read('auth.html').toString().replace('auth-flows.js?v=9','auth-flows.js?v=8'))],
  ...Array.from({length:40},(_,i)=>['fixture-'+i+'.js',Buffer.from('PUBLIC_FIXTURE_'+i)])
 ]);
 const replacements=new Map(['auth-flows.js','auth.html'].map(name=>[name,read(name)]));
 return {previous,replacements};
}
test('patch changes exactly two reviewed entries and preserves forty through real ZIP readback',()=>{
 const h=fixture(),original=new Map([...h.previous].map(([name,bytes])=>[name,Buffer.from(bytes)]));
 const patched=patchConfirmationRequestEntries(h.previous,h.replacements);
 const actual=readPublicZIP(createPublicZIP([...patched]),42);
 assert.equal(actual.size,42);
 for(const [name,bytes]of original){
  assert(h.previous.get(name).equals(bytes));
  assert(actual.get(name).equals(h.replacements.get(name)||bytes));
 }
 assert(!actual.get('auth-flows.js').equals(h.previous.get('auth-flows.js')));
 assert(!actual.get('auth.html').equals(h.previous.get('auth.html')));
});
test('unknown or edited prior entry and unexpected public sets are refused',()=>{
 const h=fixture();
 h.previous.set('auth-flows.js',Buffer.concat([h.previous.get('auth-flows.js'),Buffer.from('EDITED')]));
 assert.throws(()=>patchConfirmationRequestEntries(h.previous,h.replacements),/PRIOR_CONFIRMATION_SOURCE_REQUIRED/);
 assert.throws(()=>patchConfirmationRequestEntries(new Map(),h.replacements),/PUBLIC_SET_REQUIRED/);
 const g=fixture();g.replacements.set('config.js',Buffer.from('EDITED'));
 assert.throws(()=>patchConfirmationRequestEntries(g.previous,g.replacements),/PUBLIC_SET_REQUIRED/);
});
test('all manifest inputs match and source changes stop CLI before output',()=>{
 const manifest=JSON.parse(read('scripts/confirmation-request-feedback-manifest.json'));
 assert.equal(Object.keys(manifest.sources).length,7);
 for(const [name,digest]of Object.entries(manifest.sources))assert.equal(hash(read(name)),digest,name);
 const temp=fs.mkdtempSync(path.join(tmpdir(),'mushavo-confirmation-package-'));
 try{
  for(const name of ['scripts/confirmation-request-feedback-manifest.json',...Object.keys(manifest.sources)]){
   const destination=path.join(temp,name);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.writeFileSync(destination,read(name));
  }
  fs.appendFileSync(path.join(temp,'auth-flows.js'),'\nEDITED');
  const input=path.join(temp,'input.zip'),out=path.join(temp,'out');fs.writeFileSync(input,'UNCHANGED_INPUT');fs.mkdirSync(out);
  const r=spawnSync(process.execPath,[path.join(temp,'scripts/prepare-confirmation-request-retry.mjs'),input,out],{encoding:'utf8'});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).problem_code,'SOURCE_HASH_MISMATCH');
  assert.deepEqual(fs.readdirSync(out),[]);assert.equal(fs.readFileSync(input,'utf8'),'UNCHANGED_INPUT');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
test('CLI refuses an unaccepted ZIP without modifying the input or creating an output',()=>{
 const temp=fs.mkdtempSync(path.join(tmpdir(),'mushavo-confirmation-unknown-'));
 try{
  const input=path.join(temp,'input.zip'),out=path.join(temp,'out');fs.writeFileSync(input,'UNCHANGED_INPUT');fs.mkdirSync(out);
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-confirmation-request-retry.mjs',root)),input,out],{encoding:'utf8'});
  assert.equal(r.status,1);assert.equal(JSON.parse(r.stdout).problem_code,'ACCEPTED_SIMPLE_SEATS_ZIP_REQUIRED');
  assert.deepEqual(fs.readdirSync(out),[]);assert.equal(fs.readFileSync(input,'utf8'),'UNCHANGED_INPUT');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});

