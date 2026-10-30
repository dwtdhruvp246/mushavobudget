import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {prepareEdgePackage,inspectPreparedPackage,sourceSnapshot,preparationRoot,preparationManifest,edgeNames,renderedStagingConfig} from '../scripts/prepare-fr-2-email-edge-package.mjs';
function fixture(fn){const root=fs.mkdtempSync(path.join(os.tmpdir(),'edge-prep-test-'));try{return fn(root);}finally{fs.rmSync(root,{recursive:true,force:true});}}
function sourceCopy(root){
 const out=path.join(root,'source');fs.mkdirSync(out);const m=JSON.parse(fs.readFileSync(path.join(preparationRoot,preparationManifest),'utf8'));
 for(const file of [preparationManifest,...Object.keys(m.file_sha256)]){const dest=path.join(out,file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(path.join(preparationRoot,file),dest);}
 return out;
}
test('Prepared package contains exactly four unchanged entrypoints, their shared imports, frozen dependencies and explicit staging config',()=>fixture(root=>{
 const out=path.join(root,'package'),s=prepareEdgePackage(out);assert.equal(s.files.size,12);
 for(const slug of edgeNames)assert(fs.readFileSync(path.join(out,'supabase/functions',slug,'index.ts')).equals(fs.readFileSync(path.join(preparationRoot,'supabase/functions',slug,'index.ts'))));
 assert.equal(fs.readFileSync(path.join(out,'supabase/config.toml'),'utf8'),renderedStagingConfig());
 assert.deepEqual(s.plan.selected_functions.map(f=>f.verify_jwt),[true,true,false,false]);
 assert.equal(s.plan.deployable_now,false);assert.equal(s.plan.hosted_write_approved,false);assert(Object.values(s.plan.readiness).every(v=>v===false));
}));
test('Identical sources produce identical package identities across fresh directories',()=>fixture(root=>{
 const a=prepareEdgePackage(path.join(root,'one')),b=prepareEdgePackage(path.join(root,'two'));assert.equal(a.packageIdentity,b.packageIdentity);assert.match(a.packageIdentity,/^[a-f0-9]{64}$/);
}));
test('Existing output directories and their contents are never overwritten',()=>fixture(root=>{
 const out=path.join(root,'existing');fs.mkdirSync(out);fs.writeFileSync(path.join(out,'keep.txt'),'UNCHANGED');assert.throws(()=>prepareEdgePackage(out),/FRESH_OUTPUT/);assert.equal(fs.readFileSync(path.join(out,'keep.txt'),'utf8'),'UNCHANGED');
}));
test('Relative output and deployment flags are refused without creating a package',()=>{
 assert.throws(()=>prepareEdgePackage('relative-output'),/LOCAL_PATH/);
 const p=spawnSync(process.execPath,[path.join(preparationRoot,'scripts/prepare-fr-2-email-edge-package.mjs'),'--deploy','ignored'],{encoding:'utf8',timeout:5000});assert.equal(p.status,1);assert.equal(JSON.parse(p.stdout).problem_code,'LOCAL_PREPARATION_ARGUMENTS_REQUIRED');
});
test('Tampered source fails identity validation before an output directory is created',()=>fixture(root=>{
 const source=sourceCopy(root);fs.appendFileSync(path.join(source,'supabase/functions/invite-admin-user/index.ts'),'\n// altered\n');
 const out=path.join(root,'package');assert.throws(()=>prepareEdgePackage(out,{sourceRoot:source}),/SOURCE_IDENTITY/);assert.equal(fs.existsSync(out),false);
}));
test('Staging config tampering fails source validation while the repository config remains unchanged',()=>fixture(root=>{
 const baseline=fs.readFileSync(path.join(preparationRoot,'supabase/config.toml'));const source=sourceCopy(root);
 const cfg=path.join(source,'deployment/candidates/email-edge-staging.config.toml');fs.writeFileSync(cfg,renderedStagingConfig().replace('verify_jwt = true','verify_jwt = false'));
 assert.throws(()=>prepareEdgePackage(path.join(root,'package'),{sourceRoot:source}),/SOURCE_IDENTITY/);assert(fs.readFileSync(path.join(preparationRoot,'supabase/config.toml')).equals(baseline));
}));
test('Extra files in the source tree, including fake private files, are not copied',()=>fixture(root=>{
 const source=sourceCopy(root);fs.writeFileSync(path.join(source,'.env'),'PRIVATE_SYNTHETIC_DO_NOT_COPY');
 const s=prepareEdgePackage(path.join(root,'package'),{sourceRoot:source});assert(![...s.files.values()].some(b=>b.includes('PRIVATE_SYNTHETIC_DO_NOT_COPY')));assert(!s.files.has('.env'));
}));
test('An extra file in a prepared package invalidates inspection',()=>fixture(root=>{
 const out=path.join(root,'package');prepareEdgePackage(out);fs.writeFileSync(path.join(out,'.env'),'PRIVATE_SYNTHETIC');assert.throws(()=>inspectPreparedPackage(out),/PACKAGE_CONTENT/);
}));
test('Modified entrypoint bytes invalidate inspection',()=>fixture(root=>{
 const out=path.join(root,'package');prepareEdgePackage(out);fs.appendFileSync(path.join(out,'supabase/functions/send-test-push/index.ts'),'x');assert.throws(()=>inspectPreparedPackage(out),/PACKAGE_CONTENT/);
}));
test('Readiness and recovery assertions in the preparation plan cannot be edited into acceptance',()=>fixture(root=>{
 const out=path.join(root,'package');prepareEdgePackage(out);const p=path.join(out,'preparation-plan.json');const plan=JSON.parse(fs.readFileSync(p,'utf8'));plan.deployable_now=true;plan.recovery.after_database_activation.enforcement_and_application_rows_retained=false;fs.writeFileSync(p,JSON.stringify(plan));assert.throws(()=>inspectPreparedPackage(out),/PACKAGE_CONTENT/);
}));
test('Deletion of a required shared dependency invalidates inspection',()=>fixture(root=>{
 const out=path.join(root,'package');prepareEdgePackage(out);fs.unlinkSync(path.join(out,'supabase/functions/_shared/email-session-assurance.mjs'));assert.throws(()=>inspectPreparedPackage(out),/PACKAGE_CONTENT/);
}));
test('Directory redirection is rejected for both output and inspection',()=>fixture(root=>{
 const real=path.join(root,'real'),link=path.join(root,'link');fs.mkdirSync(real);fs.symlinkSync(real,link,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>prepareEdgePackage(path.join(link,'package')),/LOCAL_PATH/);
 const out=path.join(root,'package');prepareEdgePackage(out);const redirect=path.join(root,'redirect');fs.symlinkSync(out,redirect,process.platform==='win32'?'junction':'dir');assert.throws(()=>inspectPreparedPackage(redirect),/LOCAL_PATH/);
}));
test('The artifact contains no unrelated Edge route, SQL, credential file or deployment executable',()=>{
 const s=sourceSnapshot();for(const name of s.files.keys())assert(!/\.sql$|\.env$|\.ps1$|submit-enquiry|dispatch-push|dispatch-admin/.test(name));
 for(const phase of Object.values(s.plan.recovery))assert.equal(phase.automatic_delete,false);
 assert.equal(s.plan.selected_functions.every(f=>f.first_deployment&&f.previous_deployment_version===null),true);
});
test('Inspection CLI reports an offline-only identity and rejects unexpected arguments',()=>fixture(root=>{
 const out=path.join(root,'package');prepareEdgePackage(out);const file=path.join(preparationRoot,'scripts/prepare-fr-2-email-edge-package.mjs');
 const r=spawnSync(process.execPath,[file,'--inspect',out],{encoding:'utf8',timeout:5000});assert.equal(r.status,0);const receipt=JSON.parse(r.stdout);assert.equal(receipt.actual_hosted_requests,0);assert.equal(receipt.credentials_requested,false);assert.equal(receipt.uploaded_or_deployed,false);
 const bad=spawnSync(process.execPath,[file,'--inspect',out,'extra'],{encoding:'utf8',timeout:5000});assert.equal(bad.status,1);
}));
test('Every relative source import resolves inside the exact prepared file set',()=>{
 const s=sourceSnapshot();for(const[name,bytes]of s.files){if(!/\.(ts|mjs)$/.test(name))continue;
  for(const match of bytes.toString().matchAll(/from\s+["'](\.[^"']+)["']/g)){const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));assert(s.files.has(resolved),name+':'+resolved);}
 }
});
test('Local source preparation preserves the earlier absence receipt and all original source bytes',()=>fixture(root=>{
 const m=JSON.parse(fs.readFileSync(path.join(preparationRoot,preparationManifest),'utf8'));const before=new Map(Object.keys(m.file_sha256).map(n=>[n,fs.readFileSync(path.join(preparationRoot,n))]));
 prepareEdgePackage(path.join(root,'package'));for(const[n,b]of before)assert(fs.readFileSync(path.join(preparationRoot,n)).equals(b));
}));
