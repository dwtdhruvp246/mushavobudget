import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {updates,verifySources,replaceRetryEntries,stagingBytes,prepareSignoutRetry} from '../scripts/prepare-fr-2-batch-w-signout-retry.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {readPublicZIP} from '../scripts/lib/read-public-zip.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const previous=new Map([['app.js',Buffer.from('OLD_JS')],['app.html',Buffer.from('OLD_HTML')],...['config.js','_worker.js','sw.js','_headers','_routes.json'].map(name=>[name,Buffer.from('KEEP_'+name)])]);
 for(let i=0;previous.size<42;i++)previous.set('fixture-'+i+'.js',Buffer.from('KEEP_'+i));
 return{previous,replacements:new Map([['app.js',Buffer.from('NEW_JS')],['app.html',Buffer.from('NEW_HTML')]]),expected:Object.fromEntries([...previous].map(([name,bytes])=>[name,hash(bytes)]))};
}
test('all current package and runtime source identities match the signout-retry manifest',()=>{
 const m=verifySources();assert.equal(Object.keys(m.retained_public_entry_sha256).length,42);assert(m.source_file_count>=5);
 for(const name of ['config.js','_worker.js','sw.js','_headers','_routes.json'])assert(m.retained_public_entry_sha256[name]);
 assert(!m.retained_public_entry_sha256['email-verification.js']);assert(!m.retained_public_entry_sha256['admin-mfa.js']);
});
test('only app.js and app.html change, with forty entries and original buffers preserved',()=>{
 const f=fixture(),saved=new Map([...f.previous].map(([name,bytes])=>[name,Buffer.from(bytes)])),out=replaceRetryEntries(f.previous,f.replacements,f.expected);
 assert.equal(out.size,42);for(const [name,bytes]of saved){assert(f.previous.get(name).equals(bytes));assert(out.get(name).equals(f.replacements.get(name)||bytes));}
});
test('canonical ZIP roundtrip verifies all entries and refuses corruption',()=>{
 const f=fixture(),out=replaceRetryEntries(f.previous,f.replacements,f.expected),bytes=createPublicZIP([...out]),decoded=readPublicZIP(bytes,42);
 for(const [name,data]of out)assert(data.equals(decoded.get(name)));const bad=Buffer.from(bytes);bad[40]^=1;assert.throws(()=>readPublicZIP(bad,42));assert.throws(()=>readPublicZIP(bytes,44));
});
test('changed configuration, Worker, service worker, headers or routes are never accepted',()=>{
 for(const name of ['config.js','_worker.js','sw.js','_headers','_routes.json']){const f=fixture();f.previous.set(name,Buffer.from('UNAPPROVED'));assert.throws(()=>replaceRetryEntries(f.previous,f.replacements,f.expected),/ACCEPTED_SHARED_TABS_ZIP_REQUIRED/);}
 const f=fixture();f.replacements.delete('app.js');f.replacements.set('config.js',Buffer.from('WRONG'));assert.throws(()=>replaceRetryEntries(f.previous,f.replacements,f.expected),/PUBLIC_SET_REQUIRED/);
});
test('staging bytes use app version 123 and retain the existing session module and auth policy',()=>{
 for(const row of updates){const bytes=stagingBytes(fs.readFileSync(new URL('../'+row.source,import.meta.url)));assert.equal(hash(bytes),row.after);assert(!bytes.includes(Buffer.from('kttkospkblwvguuwnhjj')));}
 const html=fs.readFileSync(new URL('../app.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');assert(html.includes('app.js?v=123'));assert(app.includes('session-entry.js?v=5'));assert(!app.includes('email-verification.js'));
});
test('actual CLI refuses an unknown canonical input without writing artifacts or changing the input',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'mushavo-signout-retry-package-'));
 try{const input=path.join(dir,'old.zip'),output=path.join(dir,'output'),bytes=createPublicZIP([...fixture().previous]);fs.writeFileSync(input,bytes);fs.mkdirSync(output);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-fr-2-batch-w-signout-retry.mjs',import.meta.url)),input,output],{encoding:'utf8'});
  assert.equal(result.status,1);assert.equal(result.stderr,'');assert.equal(JSON.parse(result.stdout).problem_code,'ACCEPTED_SHARED_TABS_ZIP_REQUIRED');assert(fs.readFileSync(input).equals(bytes));assert.deepEqual(fs.readdirSync(output),[]);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('occupied output and linked inputs refuse before changing existing files',()=>{
 const dir=fs.mkdtempSync(path.join(tmpdir(),'mushavo-signout-retry-paths-'));
 try{const input=path.join(dir,'input.zip'),output=path.join(dir,'output');fs.writeFileSync(input,'UNKNOWN');fs.mkdirSync(output);fs.writeFileSync(path.join(output,'KEEP'),'KEEP');
  assert.throws(()=>prepareSignoutRetry(input,output),/EMPTY_OUTPUT_REQUIRED/);assert.equal(fs.readFileSync(path.join(output,'KEEP'),'utf8'),'KEEP');
  const link=path.join(dir,'linked.zip');fs.symlinkSync(input,link);assert.throws(()=>prepareSignoutRetry(link,output),/PUBLIC_PATH_REQUIRED/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

