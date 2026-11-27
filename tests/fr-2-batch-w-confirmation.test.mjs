// Historical preparer is intentionally frozen at its original source pin.
// Current seven-entry package coverage is in fr-2-browser-trust-package.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {confirmationFiles,patchConfirmationEntries} from '../scripts/prepare-fr-2-batch-w-confirmation.mjs';
const root=new URL('../',import.meta.url);
test('historical confirmation preparer retains its two-file contract and refuses unreviewed prior entries',()=>{
 assert.deepEqual(confirmationFiles.map(x=>x.name),['auth-flows.js','auth.html']);
 assert.throws(()=>patchConfirmationEntries(new Map()),/PUBLIC_SET_REQUIRED/);
 const entries=new Map(Array.from({length:44},(_,i)=>['fixture-'+i+'.js',Buffer.from('SYNTHETIC')]));
 assert.throws(()=>patchConfirmationEntries(entries),/PRIOR_CONFIRMATION_SOURCE_REQUIRED/);
});
test('historical confirmation CLI refuses newer source before writing a stale package',()=>{
 const temporary=fs.mkdtempSync(path.join(tmpdir(),'mushavo-old-confirmation-'));
 try{
  const input=path.join(temporary,'input.zip'),out=path.join(temporary,'out'),bytes=Buffer.from('SYNTHETIC_UNRECOGNIZED_ZIP');fs.writeFileSync(input,bytes);fs.mkdirSync(out);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-fr-2-batch-w-confirmation.mjs',root)),input,out],{encoding:'utf8'});
  assert.equal(result.status,1);const receipt=JSON.parse(result.stdout);assert.equal(receipt.problem_code,'CONFIRMATION_SOURCE_REQUIRED');
  assert.equal(receipt.actual_hosted_requests,0);assert.deepEqual(fs.readdirSync(out),[]);assert(fs.readFileSync(input).equals(bytes));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
