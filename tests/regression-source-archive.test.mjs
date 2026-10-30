// Real Git export under Windows-style EOL settings. No remote or existing checkout is used.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const repo=fileURLToPath(new URL('../',import.meta.url));
const manifest=JSON.parse(await readFile(path.join(repo,'docs/security-audit/security-fr-2-email-regression-source-manifest.json'),'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
async function fixture(t,legacy=false){
 const base=await mkdtemp(path.join(tmpdir(),'mushavo-archive-eol-'));t.after(()=>rm(base,{recursive:true,force:true}));
 const source=path.join(base,'source'),output=path.join(base,'output'),empty=path.join(base,'empty');
 for(const p of[source,output,empty])await mkdir(p);
 const config=path.join(base,'empty-gitconfig');await writeFile(config,'');
 const env={GIT_CONFIG_NOSYSTEM:'1',GIT_ATTR_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:config};
 const allowed=new Set(['PATH','HOME','TMPDIR','TMP','TEMP','SYSTEMROOT','COMSPEC','PATHEXT','LANG','LC_ALL','USERPROFILE','APPDATA','LOCALAPPDATA']);
 for(const [k,v]of Object.entries(process.env))if(allowed.has(k.toUpperCase()))env[k]=v;
 function run(cmd,args){const r=spawnSync(cmd,args,{env,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});assert(!r.error&&!r.signal,'Local archive command must complete');assert.equal(r.status,0,'Local archive command must succeed');return r;}
 const git=(...args)=>run('git',['-C',source,'-c','core.autocrlf=false','-c','core.attributesFile='+config,'-c','core.hooksPath='+empty,'-c','init.templateDir='+empty,'-c','commit.gpgsign=false',...args]);
 if(legacy){await writeFile(path.join(source,'.gitattributes'),'* text=auto\n');await writeFile(path.join(source,'.assetsignore'),'first\nsecond\n');}
 else for(const [name,expected]of Object.entries(manifest.file_sha256)){
  const b=await readFile(path.join(repo,name));assert.equal(sha(b),expected,'Source pin: '+name);
  const p=path.join(source,name);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,b);
 }
 git('init','-q');git('add','--all');git('-c','user.name=Archive Fixture','-c','user.email=archive@example.invalid','commit','-qm','isolated fixture');
 return {base,source,output,git,run};
}
test('legacy auto text reproduces the first Windows archive hash mismatch',async t=>{
 const f=await fixture(t,true),archive=path.join(f.base,'legacy.tar');
 f.git('-c','core.eol=crlf','archive','--format=tar','--output='+archive,'HEAD');f.run('tar',['-xf',archive,'-C',f.output]);
 const b=await readFile(path.join(f.output,'.assetsignore'));assert.equal(b.toString(),'first\r\nsecond\r\n');assert.notEqual(sha(b),sha(Buffer.from('first\nsecond\n')));
});
for(const eol of['crlf','lf'])test('current attributes preserve every pinned source and binary byte with core.eol='+eol,async t=>{
 const f=await fixture(t),archive=path.join(f.base,'current.tar');
 f.git('-c','core.eol='+eol,'archive','--format=tar','--output='+archive,'HEAD');f.run('tar',['-xf',archive,'-C',f.output]);
 for(const [name,expected]of Object.entries(manifest.file_sha256))assert.equal(sha(await readFile(path.join(f.output,name))),expected,'Export pin: '+name);
});
