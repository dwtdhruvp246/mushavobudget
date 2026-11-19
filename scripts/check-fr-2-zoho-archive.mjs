import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const line='scripts/setup-fr-2-zoho-private.ps1 text eol=lf\n';
let temp=null,checks=0,problem=null,nested=null,cleaned=false;
const rows=[];
const run=(cmd,args,cwd)=>{
 const p=spawnSync(cmd,args,{cwd,encoding:'utf8',timeout:15000,maxBuffer:2*1024*1024,
   env:{...process.env,GIT_CONFIG_NOSYSTEM:'1'}});
 assert.equal(p.status,0,'LOCAL_FIXTURE_COMMAND_FAILED');return p.stdout;
};
try {
 const attrs=await readFile(path.join(root,'.gitattributes'),'utf8');assert(attrs.endsWith(line));
 const previous=attrs.replace('\n# Preserve the reviewed setup wrapper bytes in Git archives on Windows.\n'+line,'');
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-zoho-private-setup-source-manifest.json'),'utf8'));
 const inputs=[...Object.keys(m.file_sha256),'docs/security-audit/security-fr-2-zoho-private-setup-source-manifest.json'];
 temp=await mkdtemp(path.join(tmpdir(),'mushavo-zoho-archive-'));
 const repo=path.join(temp,'repo');await mkdir(repo);
 run('git',['init','--quiet'],repo);
 for(const f of inputs){const p=path.join(repo,f);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,await readFile(path.join(root,f)));}
 for(const[version,attributes]of [['previous',previous],['corrected',attrs]]){
   await writeFile(path.join(repo,'.gitattributes'),attributes);
   run('git',['-c','core.autocrlf=false','-c','core.attributesFile=','add','.'],repo);
   run('git',['-c','core.hooksPath=/dev/null','-c','user.name=Audit Fixture',
     '-c','user.email=audit@example.invalid','-c','commit.gpgsign=false','commit','--quiet','-m',version],repo);
   for(const value of ['true','false']){
     const out=path.join(temp,version+'-'+value);await mkdir(out);
     const archive=path.join(temp,version+'-'+value+'.tar');
     run('git',['-c','core.attributesFile=','-c','core.autocrlf='+value,'archive',
       '--format=tar','--output='+archive,'HEAD',...inputs],repo);
     run('tar',['-xf',archive,'-C',out],repo);
     const wrapper=await readFile(path.join(out,'scripts/setup-fr-2-zoho-private.ps1'));
     const matches=hash(wrapper)===m.file_sha256['scripts/setup-fr-2-zoho-private.ps1'];
     assert.equal(matches,version==='corrected'||value==='false');
     rows.push({attributes:version,core_autocrlf:value,wrapper_bytes:wrapper.length,
       wrapper_SHA256:hash(wrapper),wrapper_matches_manifest:matches});checks++;
     if(version==='corrected'&&value==='true'){
       for(const[f,h]of Object.entries(m.file_sha256))assert.equal(hash(await readFile(path.join(out,f))),h);
       checks++;
       nested=JSON.parse(run(process.execPath,[path.join(out,'scripts/verify-fr-2-zoho-private-setup.mjs')],out));
       assert.equal(nested.exit_code,0);assert.equal(nested.pass,30);checks++;
     }
   }
 }
}catch{problem='LOCAL_ARCHIVE_FIXTURE_REVIEW_REQUIRED';}
finally{if(temp){try{await rm(temp,{recursive:true,force:true});cleaned=true;}catch{problem='LOCAL_FIXTURE_CLEANUP_REVIEW_REQUIRED';}}}
console.log(JSON.stringify({stage_step:'FR.2.4.E3.3_ARCHIVE_CORRECTION',
 result:!problem?'ACTUAL_GIT_ARCHIVE_EOL_CORRECTION_SCOPED_PASS':'ARCHIVE_REVIEW_REQUIRED',
 scope:'REAL_TEMPORARY_GIT_ARCHIVES_WITH_PREVIOUS_AND_SCOPED_ATTRIBUTES_AND_AUTOCRLF_TRUE_FALSE',
 checks,pass:problem?0:checks,fail:problem?1:0,exit_code:problem?1:0,
 archive_results:rows,corrected_archive_nested_offline_result:nested,
 node_version:process.version,actual_Windows_execution_verified:false,
 owner_exported_wrapper_exact_bytes_received:false,owner_failure_cause_independently_proven:false,
 OAuth_Auth_Zoho_or_Cloudflare_requests:0,credential_prompts_or_email_dispatch:false,
 temporary_fixture_cleanup_completed:cleaned,hosted_acceptance:false,findings_closed:[],problem_code:problem},null,2));
process.exitCode=problem?1:0;
