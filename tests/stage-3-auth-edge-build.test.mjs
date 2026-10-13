import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const edge=await readFile(new URL('../supabase/functions/invite-business-member/index.ts',import.meta.url),'utf8');
const runnable=stripTypeScriptTypes(edge.replace(/^import .*;\s*$/m,''));
async function delivery(existing=false,reserveDenied=false) {
  const calls=[];let handler;const invitation='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const settings={APP_ORIGIN:'https://staging.example.test',SUPABASE_URL:'https://project.supabase.co',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'};
  const context={Request,Response,URL,JSON,Set,String,Boolean,encodeURIComponent,Deno:{env:{get:key=>settings[key]},serve:fn=>handler=fn},
    createClient(_url,key) {calls.push(['client',key]);return {auth:{
      async getUser(){return {data:{user:{id:'actor'}}};},
      async signInWithOtp(args){calls.push(['otp',args]);return {error:null};},
      admin:{async inviteUserByEmail(email,args){calls.push(['invite',email,args]);return {data:{user:{id:'new-recipient'}}};}}
    },async rpc(name,args){calls.push(['rpc',name,args]);return name==='create_business_invitation'?reserveDenied?{error:{message:'BUSINESS_TEAM_ACCESS_REQUIRED'}}:{data:{invitation_id:invitation,email:'recipient@example.test',invitee_user_id:existing?'existing-recipient':null}}:{error:null};}};}};
  vm.runInNewContext(runnable,context);
  const response=await handler(new Request('https://edge.example.test',{method:'POST',headers:{Authorization:'Bearer synthetic-user-token',Origin:settings.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({workspace_id:'workspace',email:'recipient@example.test',role:'staff',scope_ids:[]})}));
  return {calls,response};
}
test('actual Business Edge handler sends new identities to first-password callback',async()=>{
  const h=await delivery();assert.equal(h.response.status,200);const invite=h.calls.find(c=>c[0]==='invite');const url=new URL(invite[2].redirectTo);assert.equal(url.pathname,'/auth.html');assert.equal(url.searchParams.get('flow'),'business-new');assert.ok(url.searchParams.get('invitation'));assert.equal(h.calls.filter(c=>c[0]==='otp').length,0);
});
test('actual Business Edge handler sends existing identities through OTP without account creation',async()=>{
  const h=await delivery(true);assert.equal(h.response.status,200);const otp=h.calls.find(c=>c[0]==='otp')[1];assert.equal(new URL(otp.options.emailRedirectTo).searchParams.get('flow'),'business-existing');assert.equal(otp.options.shouldCreateUser,false);assert.equal(h.calls.filter(c=>c[0]==='invite').length,0);
});
test('actual Business Edge handler retains caller reservation denial before service dispatch',async()=>{
  const h=await delivery(false,true);assert.equal(h.response.status,403);assert.equal(h.calls.filter(c=>c[0]==='invite'||c[0]==='otp').length,0);assert.equal(h.calls.filter(c=>c[0]==='client'&&c[1]==='synthetic-service').length,0);
});

const builder=fileURLToPath(new URL('../scripts/build-stage-3-auth-staging.cjs',import.meta.url));
async function fixture(action,missing=false) {
  const root=await mkdtemp(path.join(tmpdir(),'mushavo-auth-build-'));
  try {
    const repo=path.join(root,'repo');await mkdir(repo);execFileSync('git',['init','-q'],{cwd:repo});
    const script=await readFile(builder,'utf8');const list=script.match(/const required = new Set\(\[([\s\S]*?)\]\);/)[1];const names=[...list.matchAll(/'([^']+)'/g)].map(m=>m[1]);
    for(const name of names) {if(missing&&name==='auth-security.js')continue;await writeFile(path.join(repo,name),name==='config.js'?'window.MUSHAVO_BUDGET_CONFIG={supabaseUrl:"https://kttkospkblwvguuwnhjj.supabase.co",supabasePublishableKey:"sb_publishable_production"};':'synthetic public asset kttkospkblwvguuwnhjj');}
    await mkdir(path.join(repo,'assets'));await writeFile(path.join(repo,'assets','logo.png'),Buffer.from([1,2,3]));
    execFileSync('git',['add','.'],{cwd:repo});execFileSync('git',['-c','user.name=Local test','-c','user.email=local@example.test','commit','-qm','Synthetic fixture'],{cwd:repo});
    const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
    const out=path.join(root,'out');const env={...process.env,MUSHAVO_STAGING_PROJECT_CONFIRMED:'dczlddwbtgvfdujgcitb',MUSHAVO_STAGING_PUBLISHABLE_KEY:'sb_publishable_syntheticstaging'};
    await action({root,repo,sha,out,env});
  } finally {await rm(root,{recursive:true,force:true});}
}
test('staging builder includes new Auth and existing MFA assets, strips production references and disables push',async()=>fixture(async f=>{
  const result=spawnSync(process.execPath,[builder,f.sha,f.out],{cwd:f.repo,env:f.env,encoding:'utf8'});assert.equal(result.status,0,result.stderr);
  const receipt=JSON.parse(result.stdout);assert.equal(receipt.source_commit,f.sha);assert.equal(receipt.hosted_acceptance,false);
  for(const name of ['auth.html','auth-security.js','auth-flows.js','admin-mfa.js'])assert.equal((await readFile(path.join(f.out,name),'utf8')).includes('kttkospkblwvguuwnhjj'),false);
  const config=await readFile(path.join(f.out,'config.js'),'utf8');assert.match(config,/dczlddwbtgvfdujgcitb/);assert.match(config,/"vapidPublicKey": ""/);
}));
test('staging builder rejects secret keys, missing project confirmation and production config key',async()=>fixture(async f=>{
  for(const changes of [{MUSHAVO_STAGING_PUBLISHABLE_KEY:'sb_secret_test'},{MUSHAVO_STAGING_PROJECT_CONFIRMED:''},{MUSHAVO_STAGING_PUBLISHABLE_KEY:'sb_publishable_production'}]) {
    const result=spawnSync(process.execPath,[builder,f.sha,f.out],{cwd:f.repo,env:{...f.env,...changes},encoding:'utf8'});assert.notEqual(result.status,0);
  }
}));
test('incomplete candidate source fails before creating a staging output',async()=>fixture(async f=>{
  const result=spawnSync(process.execPath,[builder,f.sha,f.out],{cwd:f.repo,env:f.env,encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/Missing candidate public asset: auth-security.js/);
},true));
