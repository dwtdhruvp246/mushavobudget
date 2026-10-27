import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {confirmationFiles,patchConfirmationEntries} from '../scripts/prepare-fr-2-batch-w-confirmation.mjs';
import {readCanonicalPublicZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
const root=new URL('../',import.meta.url),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function fixture(){
 const entries=new Map();
 for(const row of confirmationFiles){
  let source=fs.readFileSync(new URL(row.name,root),'utf8');
  if(row.name==='auth.html')source=source.replace('auth-flows.js?v=4','auth-flows.js?v=3');
  else source=source.replace("  const confirmationOnly = flow === 'confirm';\n  if (!confirmationOnly) prepareEmailEntry(isolated);\n  controller = createLinkController(isolated, material, confirmationOnly ? {} : {beforeApplication:id=>emailEntry.require(id)});", "  prepareEmailEntry(isolated);\n  controller = createLinkController(isolated, material, {beforeApplication:id=>emailEntry.require(id)});")
   .replace(/  if \(confirmationOnly\) \{\n[\s\S]*?\n  \}\n/,'')
   .replace("  if (flow === 'confirm') { await cancelSecurityFlow(); return; }\n",'');
  const bytes=Buffer.from(source);assert.equal(hash(bytes),row.before);entries.set(row.name,bytes);
 }
 for(const name of ['config.js','_worker.js','sw.js','app.js','auth-security.js','_headers','_routes.json'])entries.set(name,Buffer.from('SYNTHETIC_PRESERVE_'+name));
 for(let i=0;entries.size<44;i++)entries.set('fixture-'+i+'.js',Buffer.from('SYNTHETIC_PUBLIC_'+i));
 return entries;
}
test('confirmation package preserves all forty-two unrelated entries and the original input map',()=>{
 const previous=fixture(),saved=new Map([...previous].map(([n,b])=>[n,Buffer.from(b)])),next=patchConfirmationEntries(previous);
 for(const[name,bytes]of previous){assert(bytes.equals(saved.get(name)));const row=confirmationFiles.find(x=>x.name===name);if(row)assert.equal(hash(next.get(name)),row.after);else assert(bytes.equals(next.get(name)));}
 const decoded=readCanonicalPublicZIP(createPublicZIP([...next]));for(const[name,bytes]of next)assert(bytes.equals(decoded.get(name)));
});
test('missing entries, unreviewed prior source and archive corruption are refused',()=>{
 const missing=fixture();missing.delete('config.js');assert.throws(()=>patchConfirmationEntries(missing),/PUBLIC_SET_REQUIRED/);
 const unreviewed=fixture();unreviewed.set('auth-flows.js',Buffer.from('UNREVIEWED_SOURCE'));assert.throws(()=>patchConfirmationEntries(unreviewed),/PRIOR_CONFIRMATION_SOURCE_REQUIRED/);
 const damaged=createPublicZIP([...fixture()]);damaged[50]^=1;assert.throws(()=>readCanonicalPublicZIP(damaged));
});
test('actual CLI rejects an unrecognized retained ZIP before any output write and preserves its input',()=>{
 const temp=fs.mkdtempSync(path.join(tmpdir(),'mushavo-w-confirmation-'));
 try{
  const input=path.join(temp,'input.zip'),out=path.join(temp,'out'),bytes=createPublicZIP([...fixture()]);fs.writeFileSync(input,bytes);fs.mkdirSync(out);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-fr-2-batch-w-confirmation.mjs',root)),input,out],{encoding:'utf8'});
  assert.equal(result.status,1);const receipt=JSON.parse(result.stdout);assert.equal(receipt.problem_code,'RETAINED_CONCISE_COPY_ZIP_REQUIRED');
  assert.equal(receipt.actual_hosted_requests,0);assert.equal(receipt.real_email_requests,0);assert.deepEqual(fs.readdirSync(out),[]);assert(fs.readFileSync(input).equals(bytes));
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
