// Historical two-literal copy package must not run against newer Auth sources.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {copyChanges,replaceConfirmationCopy} from '../scripts/prepare-fr-2-batch-w-copy.mjs';
const root=new URL('../',import.meta.url);
test('historical copy preparer keeps its literal contract and refuses unknown source entries',()=>{
 assert.deepEqual(copyChanges.map(x=>x.name),['app.js','auth-security.js']);
 assert.throws(()=>replaceConfirmationCopy(new Map()),/PUBLIC_SET_REQUIRED/);
 const entries=new Map(Array.from({length:44},(_,i)=>['fixture-'+i+'.js',Buffer.from('SYNTHETIC')]));
 assert.throws(()=>replaceConfirmationCopy(entries),/PRIOR_COPY_SOURCE_REQUIRED/);
});
test('historical copy CLI refuses newer source instead of creating a stale package',()=>{
 const temporary=fs.mkdtempSync(path.join(tmpdir(),'mushavo-old-copy-'));
 try{
  const input=path.join(temporary,'input.zip'),out=path.join(temporary,'out'),bytes=Buffer.from('SYNTHETIC_UNRECOGNIZED_ZIP');fs.writeFileSync(input,bytes);fs.mkdirSync(out);
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('scripts/prepare-fr-2-batch-w-copy.mjs',root)),input,out],{encoding:'utf8'});
  assert.equal(result.status,1);const receipt=JSON.parse(result.stdout);assert.equal(receipt.problem_code,'BATCH_W_COPY_SOURCE_REQUIRED');
  assert.equal(receipt.actual_hosted_requests,0);assert.deepEqual(fs.readdirSync(out),[]);assert(fs.readFileSync(input).equals(bytes));
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
