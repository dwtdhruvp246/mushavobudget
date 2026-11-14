import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
import {updates,replaceEntries,verifySources,stagingPublicBytes,acceptedEntryHashes} from '../scripts/prepare-fr-2-batch-w-smooth-signin.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';import {readCanonicalPublicZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){const previous=new Map(),replacements=new Map();for(const row of updates){const b=Buffer.from('OLD_'+row.name);previous.set(row.name,b);replacements.set(row.name,{before:hash(b),bytes:Buffer.from('NEW_'+row.name)});}for(const n of ['_worker.js','_headers','_routes.json','config.js','sw.js'])previous.set(n,Buffer.from('PRESERVE_'+n));for(let n=0;previous.size<44;n++)previous.set('fixture-'+n+'.js',Buffer.from('PUBLIC_'+n));return{previous,replacements};}
test('manifest verifies the actual updated page and its transitive package inputs',()=>{assert(verifySources()>=12);});
test('patch changes only ten entries and preserves all thirty-four remaining entries and the input',()=>{const{previous,replacements}=fixture(),saved=new Map([...previous].map(([n,b])=>[n,Buffer.from(b)])),next=replaceEntries(previous,replacements);for(const[n,b]of previous){assert(b.equals(saved.get(n)));assert(next.get(n).equals(replacements.get(n)?.bytes||b));}assert.equal(next.size,44);const decoded=readCanonicalPublicZIP(createPublicZIP([...next]));for(const[n,b]of next)assert(b.equals(decoded.get(n)));});
test('missing public entries, unexpected replacements and wrong prior bytes refuse',()=>{const a=fixture();a.previous.delete('config.js');assert.throws(()=>replaceEntries(a.previous,a.replacements));const b=fixture();b.replacements.delete('auth.html');b.replacements.set('_worker.js',{before:'0'.repeat(64),bytes:Buffer.from('WRONG')});assert.throws(()=>replaceEntries(b.previous,b.replacements));const c=fixture();c.previous.set('auth-flows.js',Buffer.from('UNREVIEWED'));assert.throws(()=>replaceEntries(c.previous,c.replacements),/PRIOR_AUTO_ENTRY_SOURCE_REQUIRED/);});
test('corrupted archives are rejected by the reused canonical reader',()=>{const bytes=createPublicZIP([...fixture().previous]);bytes[40]^=1;assert.throws(()=>readCanonicalPublicZIP(bytes));});
test('actual CLI rejects an unknown ZIP without modifying its input or output directory',()=>{const d=fs.mkdtempSync(path.join(tmpdir(),'mushavo-smooth-signin-'));try{const input=path.join(d,'old.zip'),output=path.join(d,'out'),bytes=createPublicZIP([...fixture().previous]);fs.writeFileSync(input,bytes);fs.mkdirSync(output);const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-fr-2-batch-w-smooth-signin.mjs',import.meta.url)),input,output],{encoding:'utf8'});assert.equal(result.status,1);assert.equal(JSON.parse(result.stdout).problem_code,'ACCEPTED_AUTO_SIGNIN_ZIP_REQUIRED');assert(fs.readFileSync(input).equals(bytes));assert.deepEqual(fs.readdirSync(output),[]);}finally{fs.rmSync(d,{recursive:true,force:true});}});

test('all ten prior identities come from the accepted archive chain including staging-specific HTML',()=>{
 const accepted=acceptedEntryHashes();for(const row of updates)assert.equal(row.before,accepted[row.name]);
 assert.equal(updates.find(r=>r.name==='app.html').before,'b50e425dc471a26bef18569fd48f748221a6af3ae06ff2584a20b03124dfbdfd');
 assert.equal(updates.find(r=>r.name==='business.html').before,'bac1e75d04dd55cb4adbac5b074a77ceaaf311a3ffff0570f9280b6fd63d6183');
});
test('real retained staging HTML is accepted and patched without restoring production references',()=>{
 const {previous,replacements}=fixture();
 for(const name of ['app.html','business.html']){
  const raw=fs.readFileSync(new URL('../'+name,import.meta.url)),row=updates.find(r=>r.name===name);
  const old=raw.toString('utf8').replace('styles.css?v=81','styles.css?v=79').replace('app.js?v=118','app.js?v=117').replace('business.css?v=14','business.css?v=13').replace('business.js?v=23','business.js?v=22');
  // Independent fixture transformation mirrors the established staging exporter.
  const prior=Buffer.from(old.split('kttkospkblwvguuwnhjj').join('dczlddwbtgvfdujgcitb'));
  assert.equal(hash(prior),row.before);assert.notEqual(hash(Buffer.from(old)),row.before);
  previous.set(name,prior);replacements.set(name,{before:row.before,bytes:stagingPublicBytes(raw)});
 }
 const next=replaceEntries(previous,replacements),decoded=readCanonicalPublicZIP(createPublicZIP([...next]));
 for(const name of ['app.html','business.html']){const row=updates.find(r=>r.name===name),b=decoded.get(name);assert.equal(hash(b),row.after);assert(!b.includes(Buffer.from('kttkospkblwvguuwnhjj')));assert(b.includes(Buffer.from('dczlddwbtgvfdujgcitb')));}
 for(const [name,b]of previous)if(!replacements.has(name))assert(b.equals(next.get(name)));
});
test('source and exported identities stay distinct and every changed output stays on staging',()=>{
 for(const row of updates){const raw=fs.readFileSync(new URL('../'+row.name,import.meta.url)),saved=Buffer.from(raw),out=stagingPublicBytes(raw);assert.equal(hash(raw),row.sourceSHA256);assert.equal(hash(out),row.after);assert(raw.equals(saved));assert(!out.includes(Buffer.from('kttkospkblwvguuwnhjj')));if(row.name==='app.html'||row.name==='business.html')assert.notEqual(row.sourceSHA256,row.after);}
});
test('a prior-content failure identifies only the selected public filename',()=>{
 const {previous,replacements}=fixture();previous.set('app.html',Buffer.from('WRONG'));
 assert.throws(()=>replaceEntries(previous,replacements),error=>error.message==='PRIOR_AUTO_ENTRY_SOURCE_REQUIRED'&&error.problem_file==='app.html');
});
