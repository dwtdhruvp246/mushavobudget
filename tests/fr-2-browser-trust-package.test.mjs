import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {publicUpdates,replacePublicEntries,verifyBrowserTrustSources} from '../scripts/prepare-fr-2-batch-w-browser-trust.mjs';
import {readCanonicalPublicZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import pages from '../deployment/candidates/email-persistent-browser.pages.mjs';
const root=new URL('../',import.meta.url),hash=x=>createHash('sha256').update(x).digest('hex');
function fixture(){
 const previous=new Map(),replacements=new Map();
 for(const row of publicUpdates){const bytes=Buffer.from('SYNTHETIC_PREVIOUS_'+row.name);previous.set(row.name,bytes);replacements.set(row.name,{before:hash(bytes),bytes:Buffer.from('SYNTHETIC_REPLACEMENT_'+row.name)});}
 for(const name of ['config.js','sw.js','app.js','_headers','_routes.json'])previous.set(name,Buffer.from('SYNTHETIC_PRESERVE_'+name));
 for(let i=0;previous.size<44;i++)previous.set('fixture-'+i+'.js',Buffer.from('SYNTHETIC_PUBLIC_'+i));
 return{previous,replacements};
}
test('the current source manifest covers every public replacement and private SQL without changing historical pins',()=>{
 const manifest=verifyBrowserTrustSources();assert(manifest.source_file_count>=25);
 for(const row of publicUpdates)assert.equal(hash(fs.readFileSync(new URL(row.source,root))),manifest.file_sha256[row.source]);
 assert(manifest.file_sha256['supabase/candidates/security_fr_2_5_persistent_device_handoff.sql']);
});
test('archive patch replaces exactly seven approved entries, preserves thirty-seven and does not mutate its input',()=>{
 const {previous,replacements}=fixture(),saved=new Map([...previous].map(([n,b])=>[n,Buffer.from(b)])),next=replacePublicEntries(previous,replacements);
 for(const[name,bytes]of previous){assert(bytes.equals(saved.get(name)));assert(next.get(name).equals(replacements.get(name)?.bytes||bytes));}
 assert.equal(next.size,44);assert(![...next.keys()].some(x=>x.endsWith('.sql')));
 const decoded=readCanonicalPublicZIP(createPublicZIP([...next]));for(const[name,bytes]of next)assert(bytes.equals(decoded.get(name)));
});
test('a missing public entry, unexpected replacement or unreviewed prior bytes stop the patch',()=>{
 const f=fixture();f.previous.delete('config.js');assert.throws(()=>replacePublicEntries(f.previous,f.replacements),/PUBLIC_SET_REQUIRED/);
 const g=fixture();g.replacements.delete('styles.css');g.replacements.set('config.js',{before:'0'.repeat(64),bytes:Buffer.from('tampered')});assert.throws(()=>replacePublicEntries(g.previous,g.replacements),/PUBLIC_SET_REQUIRED/);
 const h=fixture();h.previous.set('_worker.js',Buffer.from('UNREVIEWED'));assert.throws(()=>replacePublicEntries(h.previous,h.replacements),/PRIOR_BROWSER_TRUST_SOURCE_REQUIRED/);
});
test('a corrupted canonical archive is refused before applying any entries',()=>{
 const {previous}=fixture(),bytes=createPublicZIP([...previous]);bytes[50]^=1;assert.throws(()=>readCanonicalPublicZIP(bytes));
});
test('the actual preparation CLI rejects an unknown retained ZIP and leaves the input and output unchanged',()=>{
 const temporary=fs.mkdtempSync(path.join(tmpdir(),'mushavo-browser-trust-'));
 try{
  const input=path.join(temporary,'input.zip'),out=path.join(temporary,'out'),bytes=createPublicZIP([...fixture().previous]);fs.writeFileSync(input,bytes);fs.mkdirSync(out);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-fr-2-batch-w-browser-trust.mjs',root)),input,out],{encoding:'utf8'});
  assert.equal(result.status,1);const receipt=JSON.parse(result.stdout);assert.equal(receipt.problem_code,'RETAINED_CONFIRMATION_ZIP_REQUIRED');
  assert.equal(receipt.actual_hosted_requests,0);assert.equal(receipt.real_email_requests,0);assert.equal(receipt.database_upgrade_applied,false);assert.deepEqual(fs.readdirSync(out),[]);assert(fs.readFileSync(input).equals(bytes));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
test('the packaged Worker retains credential stripping for assets and requires private API configuration',async()=>{
 let observed;const result=await pages.fetch(new Request('https://mushavo-budget-staging.pages.dev/auth.html',{headers:{authorization:'Bearer SYNTHETIC',cookie:'SYNTHETIC'}}),{ASSETS:{fetch:async request=>{observed=request;return new Response('synthetic-asset',{headers:{'x-synthetic':'preserved'}});}}});
 assert.equal(observed.headers.get('authorization'),null);assert.equal(observed.headers.get('cookie'),null);assert.equal(result.headers.get('x-synthetic'),'preserved');
 const denied=await pages.fetch(new Request('https://mushavo-budget-staging.pages.dev/api/email-verification/confirm-device',{method:'POST'}),{});assert.equal(denied.status,503);assert.equal(denied.headers.get('set-cookie'),null);
});
