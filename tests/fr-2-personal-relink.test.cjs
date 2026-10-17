const test = require('node:test');
const assert = require('node:assert/strict');
const {run, missingDenied} = require('../scripts/check-fr-2-personal-relink.cjs');
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const reply = (status,data) => ({status,text:async()=>data===undefined?'':JSON.stringify(data)});
const names=['AUDIT-S322-FAMILY-PRIMARY','AUDIT-S322-FAMILY-SECONDARY'];
function fixture(mode='good') {
 const items=new Map(),records=new Map(),convs=new Map(),log=[],logout=[];let seq=1000,cseq=5000,patches=0;
 for(let i=1;i<=2;i++)for(const [n,w,kind,entity]of [[90+i,60+i,'manual',80+i],[93+i,10+i,'identity',30+i],[96+i,10+i,'identity',990+i]])convs.set(uid(n),{id:uid(n),entity_type:'payment_record',entity_id:uid(entity),workspace_id:uid(w),entered_by:kind==='manual'?uid(i):null,rate_provider:kind,rate_source:kind,original_amount:1,converted_amount:1,original_currency:'USD',reporting_currency:'USD',exchange_rate:1,is_locked:true,updated_at:'2026-10-14T00:00:00Z'});
 const sorted=(s)=>[...convs.values()].filter(c=>[uid(10+s),uid(60+s)].includes(c.workspace_id)).sort((a,b)=>a.id.localeCompare(b.id)).map(c=>({...c}));
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),method=opt.method||'GET',body=opt.body?JSON.parse(opt.body):undefined,actor=opt.headers?.Authorization?.slice(7);log.push({path:u.pathname,method,query:u.search,body});
  if(u.pathname==='/config.js'){assert.equal(u.origin,'https://mushavo-budget-staging.pages.dev');return {status:200,text:async()=> 'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:mode==='production'?'https://kttkospkblwvguuwnhjj.supabase.co':'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_TEST_ONLY',vapidPublicKey:''})+';'};}
  assert.equal(u.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');
  if(u.pathname==='/auth/v1/token'){let i=body.email==='audit.owner@example.com'?1:2;if(mode==='second_login'&&i===2)return reply(400,{});return reply(200,{access_token:uid(i),user:{id:uid(i),email:body.email}});}
  const index=actor===uid(1)?1:actor===uid(2)?2:0;assert(index);
  if(u.pathname==='/auth/v1/user')return reply(200,{id:actor,email:index===1?'audit.owner@example.com':'audit.outsider@example.com'});
  if(u.pathname==='/auth/v1/logout'){logout.push(actor);assert.equal(u.searchParams.get('scope'),'local');return reply(mode==='logout'?500:204);}
  if(u.pathname.endsWith('/is_platform_staff'))return reply(200,mode==='staff');
  if(u.pathname.endsWith('/my_account_suspended'))return reply(200,false);
  if(u.pathname.endsWith('/budget_workspaces')){const fam=u.searchParams.get('legacy_family_id');return reply(200,[{id:uid(fam?60+index:10+index),owner_id:actor,workspace_type:fam?'household':'personal',status:'active',...(fam?{legacy_family_id:uid(50+index)}:{})}]);}
  if(u.pathname.endsWith('/workspace_settings'))return reply(200,[{workspace_id:uid(10+index),base_currency:mode==='different_default'?'INR':'USD',default_payment_currency:mode==='different_default'?'INR':'USD',enabled_currencies:mode==='different_default'?['INR','USD']:['USD'],reporting_currency:mode==='settings'?'INR':'USD',conversion_enabled:mode!=='conversion_disabled',reminder_enabled:false}]);
  if(u.pathname.endsWith('/families'))return reply(200,[{id:uid(50+index),owner_id:actor,name:names[index-1]}]);
  if(u.pathname.endsWith('/payment_conversions')){if(mode==='large_baseline')return reply(200,Array.from({length:101},(_,i)=>({...sorted(index)[0],id:uid(8000+i)})));return reply(200,sorted(index));}
  const table=u.pathname.split('/').pop(),store=table==='payment_items'?items:table==='payment_records'?records:null;assert(store);
  const fields=u.searchParams.get('select').split(','),project=x=>Object.fromEntries(fields.map(k=>[k,x[k]]));
  const id=u.searchParams.get('id')?.slice(3);const row=store.get(id);
  if(method==='POST') {
   const fresh={...body};store.set(body.id,fresh);
   if(table==='payment_records'&&mode!=='conversion_disabled'){
    const cid=uid(++cseq);convs.set(cid,{id:cid,entity_type:'payment_record',entity_id:body.id,workspace_id:body.workspace_id,entered_by:null,rate_provider:'identity',rate_source:'identity',original_amount:1,converted_amount:1,original_currency:'USD',reporting_currency:'USD',exchange_rate:1,is_locked:true,updated_at:'2026-10-14T00:00:00Z'});
   }
   return reply(201,[project(fresh)]);
  }
  if(method==='GET')return reply(200,row&&row.owner_id===actor?[project(row)]:[]);
  assert.equal(method,'PATCH');assert.equal(table,'payment_records');assert(id);assert.deepEqual(Object.keys(body),['payment_item_id']);assert.equal(row.owner_id,actor);
  const parent=items.get(body.payment_item_id);
  if(!parent){
   if(mode==='missing_effect')row.payment_item_id=body.payment_item_id;
   if(mode==='missing_success'){Object.assign(row,body);return reply(200,[project(row)]);}
   if(mode==='missing_500')return reply(500,[]);
   return reply(400,{code:'P0001',message:'WORKSPACE_ACCESS_REQUIRED'});
  }
  assert.equal(parent.owner_id,actor);patches++;
  if(mode==='valid_ignored')return reply(200,[project(row)]);
  Object.assign(row,body);
  if(mode==='changed_workspace')row.workspace_id=uid(9000);
  if(mode==='restore_fail'&&patches===2)row.amount=2;
  if(mode==='old_conversion_changed')convs.get(uid(90+index)).updated_at='2026-10-14T01:00:00Z';
  if(mode==='new_conversion_changed')for(const c of convs.values())if(c.entity_id===row.id)c.converted_amount=2;
  if(mode==='transport')throw Error('PRIVATE_TRANSPORT_SENTINEL');
  return reply(200,[project(row)]);
 };
 return {fetcher,uuid:()=>uid(++seq),items,records,convs,log,logout};
}
async function execute(mode){const f=fixture(mode);const r=await run({...f,ownerPassword:'PRIVATE_OWNER_SENTINEL',outsiderPassword:'PRIVATE_OUTSIDER_SENTINEL',today:'2026-10-14'});const text=JSON.stringify(r);for(const s of ['PRIVATE_OWNER_SENTINEL','PRIVATE_OUTSIDER_SENTINEL','PRIVATE_TRANSPORT_SENTINEL','sb_publishable_TEST_ONLY',uid(1),uid(2),uid(11),uid(61)])assert(!text.includes(s));assert(!f.log.some(e=>e.method==='DELETE'));assert(f.log.filter(e=>e.method==='POST'&&e.path.endsWith('/payment_items')).every(e=>e.body.status==='inactive'));return {r,...f};}
test('actual checker completes sixteen scoped groups and retains exact four inactive items and two records',async()=>{const f=await execute('good');assert.equal(f.r.result,'STAGING_PERSONAL_RELINK_SCOPED_PASS');assert.equal(f.r.checks.length,16);assert.equal(f.items.size,4);assert.equal(f.records.size,2);assert.equal(f.r.preexisting_visible_conversion_rows_unchanged,true);assert.deepEqual(f.logout,[uid(1),uid(2)]);for(const record of f.records.values())assert(f.items.get(record.payment_item_id).name.endsWith('-A'));assert.equal(f.r.derived_conversion_rows_cleanup_verified,false);});
test('disabled conversion setting permits no new derived rows and remains unchanged',async()=>{assert.equal((await execute('conversion_disabled')).r.result,'STAGING_PERSONAL_RELINK_SCOPED_PASS');});
const failures={production:'CONFIG_NOT_STAGING',second_login:'SYNTHETIC_SIGN_IN_FAILED',staff:'ORDINARY_ACTIVE_ACCOUNT_REQUIRED',settings:'USD_IDENTITY_SETTINGS_REQUIRED_NO_SETTINGS_CHANGED',large_baseline:'CONVERSION_BASELINE_UNAVAILABLE_OR_TOO_LARGE',valid_ignored:'VALID_RELINK_SCOPE_OR_VALUE_CHANGED',changed_workspace:'VALID_RELINK_SCOPE_OR_VALUE_CHANGED',missing_success:'MISSING_PARENT_RELINK_NOT_REJECTED',missing_effect:'RECORD_READBACK_CHANGED',missing_500:'MISSING_PARENT_RELINK_NOT_REJECTED',restore_fail:'ORIGINAL_PARENT_RESTORE_CHANGED_VALUES',old_conversion_changed:'PREEXISTING_VISIBLE_CONVERSIONS_CHANGED',new_conversion_changed:'NEW_CONVERSIONS_CHANGED_DURING_RELINK',transport:'NETWORK_OR_LOCAL_ERROR',logout:'TEST_SESSION_LOGOUT_FAILED'};
for(const [mode,code]of Object.entries(failures))test('rejects '+mode,async()=>{const f=await execute(mode);assert.equal(f.r.result,'STAGING_PERSONAL_RELINK_REVIEW');assert.equal(f.r.problem_code,code);assert(f.r.checks.some(x=>x.status==='REVIEW'));});
test('missing credentials start no transport',async()=>{let calls=0;const r=await run({fetcher:()=>{calls++;throw Error('transport should not run');}});assert.equal(calls,0);assert.equal(r.problem_code,'TWO_STAGING_APP_PASSWORDS_REQUIRED');});
test('missing-parent rejection distinguishes reviewed constraint/access failures from generic transport or success',()=>{for(const x of [{status:500,data:[]},{status:200,data:[]},{status:400,data:{code:'P0001',message:'UNREVIEWED'}},{status:401,data:{code:'invalid_jwt'}}])assert.equal(missingDenied(x),false);assert(missingDenied({status:400,data:{code:'23503'}}));assert(missingDenied({status:400,data:{code:'P0001',message:'WORKSPACE_NOT_PROVISIONED'}}));});

test('pinned PowerShell driver compiles and missing credentials fail without default network',()=>{
 const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const ps=fs.readFileSync(path.join(__dirname,'../scripts/run-fr-2-personal-relink.ps1'),'utf8');
 const driver=ps.match(/\$DriverCode = @'\n([\s\S]*?)\n'@/)[1];
 const env={...process.env};delete env.MUSHAVO_FR2_OWNER_PASSWORD;delete env.MUSHAVO_FR2_SECOND_PASSWORD;
 const child=spawnSync(process.execPath,['--require',path.join(__dirname,'../scripts/offline-test-network.cjs'),'-e',driver],{cwd:path.join(__dirname,'../scripts'),encoding:'utf8',env});
 assert.equal(child.status,1);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).problem_code,'TWO_STAGING_APP_PASSWORDS_REQUIRED');
 assert(!/[^\x00-\x7F]/.test(ps));
});

test('existing INR base and default settings are preserved while USD reporting uses identity conversion',async()=>{assert.equal((await execute('different_default')).r.result,'STAGING_PERSONAL_RELINK_SCOPED_PASS');});
