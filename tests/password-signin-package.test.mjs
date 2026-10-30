import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {updates,removedPublicFiles,SQLFiles,verifySources,replacePasswordEntries,stagingBytes,preparePasswordSignin} from '../scripts/prepare-fr-2-batch-w-password-signin.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {readPublicZIP} from '../scripts/lib/read-public-zip.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(){
 const previous=new Map(),replacements=new Map();
 for(const row of updates){previous.set(row.name,Buffer.from('OLD_'+row.name));replacements.set(row.name,Buffer.from('NEW_'+row.name));}
 for(const name of removedPublicFiles)previous.set(name,Buffer.from('RETIRED_'+name));
 for(const name of ['config.js','sw.js','_headers','_routes.json'])previous.set(name,Buffer.from('KEEP_'+name));
 for(let i=0;previous.size<44;i++)previous.set('fixture-'+i+'.js',Buffer.from('KEEP_'+i));
 return{previous,replacements,expected:Object.fromEntries([...previous].map(([name,b])=>[name,hash(b)]))};
}
test('source manifest matches all actual package, policy and checked runtime inputs',()=>{
 const m=verifySources();assert(m.source_file_count>=25);assert.equal(m.retained_ZIP_SHA256,'e7de4e1b90d46a1503be5cf77fe7974b32d650fd526cb473c39002fe8cf1675b');
 for(const row of updates)assert.equal(m.retained_public_entry_sha256[row.name],row.before);
});
test('patch changes exactly ten files, retires two, preserves thirty-two and leaves the input unchanged',()=>{
 const f=fixture(),saved=new Map([...f.previous].map(([n,b])=>[n,Buffer.from(b)])),out=replacePasswordEntries(f.previous,f.replacements,f.expected);
 assert.equal(out.size,42);for(const [name,b]of saved){assert(f.previous.get(name).equals(b));if(removedPublicFiles.includes(name))assert(!out.has(name));else assert(out.get(name).equals(f.replacements.get(name)||b));}
});
test('canonical reader verifies both old44 and new42 payloads and detects corruption and wrong counts',()=>{
 const f=fixture(),input=createPublicZIP([...f.previous]);assert.equal(readPublicZIP(input,44).size,44);
 const out=replacePasswordEntries(f.previous,f.replacements,f.expected),bytes=createPublicZIP([...out]);const decoded=readPublicZIP(bytes,42);for(const [name,b]of out)assert(b.equals(decoded.get(name)));assert.throws(()=>readPublicZIP(bytes,44));
 const bad=Buffer.from(bytes);bad[41]^=1;assert.throws(()=>readPublicZIP(bad,42));
});
test('missing inputs, unapproved replacements and changed preserved bytes refuse',()=>{
 const f=fixture();f.previous.delete('sw.js');assert.throws(()=>replacePasswordEntries(f.previous,f.replacements,f.expected));
 const g=fixture();g.replacements.delete('app.js');g.replacements.set('config.js',Buffer.from('WRONG'));assert.throws(()=>replacePasswordEntries(g.previous,g.replacements,g.expected));
 const h=fixture();h.previous.set('config.js',Buffer.from('MODIFIED'));assert.throws(()=>replacePasswordEntries(h.previous,h.replacements,h.expected),/PRIOR_PUBLIC_SOURCE_REQUIRED/);
});
test('source replacements keep staging references, new module versions and contain no custom trust/code entry',()=>{
 for(const row of updates){const b=stagingBytes(fs.readFileSync(new URL('../'+row.source,import.meta.url)));assert.equal(hash(b),row.after);assert(!b.includes(Buffer.from('kttkospkblwvguuwnhjj')));}
 const app=fs.readFileSync(new URL('../app.html',import.meta.url),'utf8'),business=fs.readFileSync(new URL('../business.html',import.meta.url),'utf8');
 assert(app.includes('app.js?v=120'));assert(business.includes('business.js?v=24'));
 for(const name of ['app.js','business.js','signup.html','auth-flows.js']){const s=fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');assert(s.includes('session-entry.js?v=5'));assert(!s.includes('email-verification.js'));}
});
test('both SQL outputs are pinned, include the owner-selected policy and an emergency quarantined rollback',()=>{
 assert.equal(SQLFiles.length,2);
 for(const row of SQLFiles)assert.equal(hash(fs.readFileSync(new URL('../'+row.source,import.meta.url))),row.sha256);
 const upgrade=fs.readFileSync(new URL('../'+SQLFiles[0].source,import.meta.url),'utf8'),rollback=fs.readFileSync(new URL('../'+SQLFiles[1].source,import.meta.url),'utf8');
 assert(upgrade.includes('ENABLE_PASSWORD_SIGNIN_ALL_USERS'));assert(upgrade.includes('PASSWORD_ONLY_ALL_USERS'));assert(upgrade.includes('PASSWORD_SIGNIN_PROTECTED_CATALOG_CHANGED'));assert(rollback.includes('PASSWORD_SIGNIN_ROLLED_BACK_QUARANTINED'));
});
test('actual CLI rejects an unknown archive without modifying input or writing any artifacts',()=>{
 const d=fs.mkdtempSync(path.join(tmpdir(),'mushavo-password-package-'));
 try{const input=path.join(d,'old.zip'),output=path.join(d,'output'),bytes=createPublicZIP([...fixture().previous]);fs.writeFileSync(input,bytes);fs.mkdirSync(output);
  const p=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/prepare-fr-2-batch-w-password-signin.mjs',import.meta.url)),input,output],{encoding:'utf8'});
  assert.equal(p.status,1);assert.equal(p.stderr,'');assert.equal(JSON.parse(p.stdout).problem_code,'ACCEPTED_SIGNOUT_ZIP_REQUIRED');assert(fs.readFileSync(input).equals(bytes));assert.deepEqual(fs.readdirSync(output),[]);
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});
test('preparer refuses occupied output folders and linked input paths',()=>{
 const d=fs.mkdtempSync(path.join(tmpdir(),'mushavo-password-paths-'));
 try{const input=path.join(d,'input.zip'),output=path.join(d,'output');fs.writeFileSync(input,'UNKNOWN');fs.mkdirSync(output);fs.writeFileSync(path.join(output,'KEEP'),'KEEP');
  assert.throws(()=>preparePasswordSignin(input,output),/EMPTY_OUTPUT_REQUIRED/);assert.equal(fs.readFileSync(path.join(output,'KEEP'),'utf8'),'KEEP');
  const link=path.join(d,'linked.zip');fs.symlinkSync(input,link);assert.throws(()=>preparePasswordSignin(link,output),/PUBLIC_PATH_REQUIRED/);
 }finally{fs.rmSync(d,{recursive:true,force:true});}
});

