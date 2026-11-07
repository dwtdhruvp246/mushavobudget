const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawnSync}=require('node:child_process');
const {run,parseConfig,rpcDenied,rowDenied}=require('../scripts/check-stage-3-business-api.cjs');
const config=c=>'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify(c)+';';
const staging={supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_LOCAL_TEST',vapidPublicKey:''};
test('Production, secret keys and active push stop the Business checker',()=>{
 for(const c of [{...staging,supabaseUrl:'https://kttkospkblwvguuwnhjj.supabase.co'},{...staging,supabasePublishableKey:'sb_secret_LOCAL_TEST'},{...staging,vapidPublicKey:'LOCAL_PUSH'}])assert.throws(()=>parseConfig(config(c)));
});
test('Absent app passwords prevent any network request',async()=>{
 const r=await run({fetcher:async()=>{throw Error('Unexpected request');}});assert.equal(r.problem_code,'TWO_STAGING_APP_PASSWORDS_REQUIRED');
});
test('Foreign-key, JWT, missing-function, generic error and wrong-status errors are not authorization denials',()=>{
 for(const r of [{status:400,data:{code:'23503'}},{status:401,data:{code:'bad_jwt'}},{status:404,data:{code:'PGRST202'}},{status:500,data:{code:'42501'}},{status:400,data:{code:'P0001',message:'OTHER_ERROR'}}]){assert.equal(rowDenied(r),false);assert.equal(rpcDenied(r,['BUSINESS_OWNER_REQUIRED']),false);}
 assert(rpcDenied({status:400,data:{code:'P0001',message:'BUSINESS_OWNER_REQUIRED'}},['BUSINESS_OWNER_REQUIRED']));
});
test('Network errors return no original secret or stack',async()=>{
 const privateText='LOCAL_PRIVATE_PASSWORD_OR_TOKEN';const r=await run({ownerPassword:privateText,outsiderPassword:privateText,fetcher:async()=>{throw Error(privateText);}});assert.equal(r.problem_code,'NETWORK_OR_LOCAL_ERROR');assert(!JSON.stringify(r).includes(privateText));
});
const runner=fs.readFileSync(require.resolve('../scripts/run-stage-3-business-acceptance.ps1'),'utf8');
const checker=fs.readFileSync(require.resolve('../scripts/check-stage-3-business-api.cjs'),'utf8');
const expression=runner.match(/node -e '([^\n]+)'/)[1].replace(/''/g,"'");
test('Windows handoff pipes an ASCII pinned checker and wipes both password buffers',()=>{
 assert(!/[^\x00-\x7f]/.test(runner+checker));assert(runner.includes('$mushavoBusinessCode | node -e'));assert(!runner.includes('$env:MUSHAVO_BUSINESS_AUDIT_CODE'));assert.equal((runner.match(/not the database password/g)||[]).length,2);assert(runner.includes('ZeroFreeBSTR')&&runner.includes('Remove-Item Env:MUSHAVO_BUSINESS_MEMBER_PASSWORD'));
});
for(const [label,value,exit] of [['success','STAGING_BUSINESS_API_SCOPED_PASS_WITH_CARRY_FORWARD',0],['review','STAGING_BUSINESS_API_REVIEW',1]])test('Extracted runner expression preserves '+label+' and exit',()=>{
 const r=spawnSync(process.execPath,['-e',expression],{encoding:'utf8',input:'module.exports.run=async()=>({result:'+JSON.stringify(value)+'});'});assert.equal(r.status,exit);assert.equal(JSON.parse(r.stdout).result,value);assert.equal(r.stderr,'');
});
test('Extracted runner rejection stays generic',()=>{
 const r=spawnSync(process.execPath,['-e',expression],{encoding:'utf8',input:"module.exports.run=async()=>{throw Error('LOCAL_PRIVATE_SECRET');};"});assert.equal(r.status,1);assert(!r.stdout.includes('LOCAL_PRIVATE_SECRET'));assert.equal(r.stderr,'');
});
