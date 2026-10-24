const test = require('node:test');
const assert = require('node:assert/strict');
const {run, deleteDenied} = require('../scripts/check-fr-2-personal-deletion.cjs');
const uid = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const reply = (status,data) => ({status,text:async()=>data===undefined?'':JSON.stringify(data)});
const familyNames=['AUDIT-S322-FAMILY-PRIMARY','AUDIT-S322-FAMILY-SECONDARY'];
const copy=x=>JSON.parse(JSON.stringify(x));
function fixture(mode='good') {
 const items=new Map(),records=new Map(),convs=new Map(),log=[],logout=[];let seq=1000,cseq=5000,deletes=0;
 for(let i=1;i<=2;i++) {
  items.set(uid(20+i),{id:uid(20+i),owner_id:uid(i),workspace_id:uid(10+i),name:'OLD_ITEM',status:'inactive',amount:1,currency:'USD'});
  records.set(uid(30+i),{id:uid(30+i),owner_id:uid(i),workspace_id:uid(10+i),payment_item_id:uid(20+i),amount:1,currency:'USD'});
  for(const [n,w,kind,entity]of [[90+i,60+i,'manual',80+i],[93+i,10+i,'identity',30+i],[96+i,10+i,'identity',990+i]])convs.set(uid(n),{id:uid(n),entity_type:'payment_record',entity_id:uid(entity),payment_record_ref:uid(entity),workspace_id:uid(w),entered_by:kind==='manual'?uid(i):null,rate_provider:kind,rate_source:kind,original_amount:1,converted_amount:1,original_currency:'USD',reporting_currency:'USD',exchange_rate:1,is_locked:true,updated_at:'2026-10-14T00:00:00Z'});
 }
 const sorted=(store,actor)=>[...store.values()].filter(x=>store===convs?[uid(10+actor),uid(60+actor)].includes(x.workspace_id):x.owner_id===uid(actor)).sort((a,b)=>a.id.localeCompare(b.id)).map(copy);
 const fetcher=async(url,opt={})=>{
  const u=new URL(url),method=opt.method||'GET',body=opt.body?JSON.parse(opt.body):undefined,actor=opt.headers?.Authorization?.slice(7);
  log.push({path:u.pathname,method,query:u.search,body,actor});
  if(u.pathname==='/config.js'){assert.equal(u.origin,'https://mushavo-budget-staging.pages.dev');return {status:200,text:async()=> 'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:mode==='production'?'https://kttkospkblwvguuwnhjj.supabase.co':'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_TEST_ONLY',vapidPublicKey:mode==='push'?'unexpected':''})+';'};}
  assert.equal(u.origin,'https://dczlddwbtgvfdujgcitb.supabase.co');assert.equal(opt.redirect,'error');
  if(u.pathname==='/auth/v1/token'){let i=body.email==='audit.owner@example.com'?1:2;if(mode==='second_login'&&i===2)return reply(400,{});return reply(200,{access_token:uid(i),user:{id:uid(i),email:body.email}});}
  const index=actor===uid(1)?1:actor===uid(2)?2:0;
  if(u.pathname==='/auth/v1/user')return reply(200,{id:mode==='identity'?uid(999):actor,email:index===1?'audit.owner@example.com':'audit.outsider@example.com'});
  if(u.pathname==='/auth/v1/logout'){logout.push(actor);assert.equal(u.searchParams.get('scope'),'local');return reply(mode==='logout'?500:204);}
  if(u.pathname.endsWith('/is_platform_staff'))return reply(200,mode==='staff');
  if(u.pathname.endsWith('/my_account_suspended'))return reply(200,mode==='suspended');
  if(u.pathname.endsWith('/budget_workspaces')){const fam=u.searchParams.get('legacy_family_id');return reply(200,[{id:uid(fam?60+index:10+index),owner_id:actor,workspace_type:fam?'household':'personal',status:'active',...(fam?{legacy_family_id:uid(50+index)}:{})}]);}
  if(u.pathname.endsWith('/workspace_settings'))return reply(200,[{workspace_id:uid(10+index),base_currency:mode==='different_default'?'INR':'USD',default_payment_currency:mode==='different_default'?'INR':'USD',enabled_currencies:mode==='different_default'?['INR','USD']:['USD'],reporting_currency:mode==='settings'?'INR':'USD',conversion_enabled:mode!=='conversion_disabled',reminder_enabled:false}]);
  if(u.pathname.endsWith('/families'))return reply(200,[{id:uid(50+index),owner_id:actor,name:familyNames[index-1]}]);
  const table=u.pathname.split('/').pop(),store=table==='payment_items'?items:table==='payment_records'?records:table==='payment_conversions'?convs:null;assert(store);
  const id=u.searchParams.get('id')?.slice(3),row=store.get(id),fields=u.searchParams.get('select');
  const project=x=>fields==='*'?copy(x):Object.fromEntries(fields.split(',').map(k=>[k,x[k]]));
  if(method==='GET') {
   if(u.searchParams.get('limit')==='0')return reply(mode==='schema_cache'?400:200,mode==='schema_cache'?{code:'42703'}:[]);
   if(id)return reply(200,row&&sorted(store,index).some(x=>x.id===id)?[project(row)]:[]);
   let data=sorted(store,index);
   if(u.searchParams.get('entity_id'))data=data.filter(c=>c.entity_type==='payment_record'&&c.entity_id===u.searchParams.get('entity_id').slice(3));
   if(mode==='large_baseline'&&!u.searchParams.get('entity_id'))data=Array.from({length:101},(_,i)=>({...data[0],id:uid(8000+i)}));
   if(mode==='reference_shape'&&table==='payment_conversions')data=data.map(c=>({...c,payment_record_ref:null}));
   if(mode==='manual_baseline'&&table==='payment_conversions')data=data.map(c=>c.rate_provider==='manual'?{...c,converted_amount:2}:c);
   if(mode==='created_conversion_changed'&&table==='payment_conversions'&&deletes>0)data=data.map(c=>Number(c.id.slice(-12))>5000?{...c,converted_amount:2}:c);
   return reply(200,data.map(project));
  }
  if(method==='POST') {
   assert(index);assert(['payment_items','payment_records'].includes(table));assert(Number(body.id.slice(-12))>1000);assert.equal(body.owner_id,actor);
   const fresh={...body,created_at:'2026-10-14T12:00:00Z'};store.set(body.id,fresh);
   if(table==='payment_items'){assert.equal(body.status,'inactive');assert.equal(body.recurrence_type,'once');}
   if(table==='payment_records'&&mode!=='missing_new_conversion'){
    const cid=uid(++cseq);convs.set(cid,{id:cid,entity_type:'payment_record',entity_id:body.id,payment_record_ref:mode==='wrong_new_reference'?uid(9999):body.id,workspace_id:body.workspace_id,entered_by:null,rate_provider:'identity',rate_source:'identity',original_amount:1,converted_amount:1,original_currency:'USD',reporting_currency:'USD',exchange_rate:1,is_locked:true,updated_at:'2026-10-14T12:00:00Z'});
    if(mode==='multiple_new_conversions'){const c=copy(convs.get(cid));c.id=uid(++cseq);convs.set(c.id,c);}
   }
   if(mode==='post_unknown')throw Error('PRIVATE_TRANSPORT_SENTINEL');
   return reply(201,[project(fresh)]);
  }
  assert.equal(method,'DELETE');assert(id);assert(row);assert(Number(id.slice(-12))>1000,'checker must not delete any old ID');deletes++;
  const own=table==='payment_conversions'?row.workspace_id===uid(10+index):row.owner_id===actor;
  if(!own||table==='payment_conversions'){
   if(mode==='denial_500')return reply(500,[]);
   if(mode==='denial_bad_jwt')return reply(401,{code:'invalid_jwt'});
   if(mode==='denial_transport')throw Error('PRIVATE_TRANSPORT_SENTINEL');
   if(mode==='denial_malformed')return {status:200,text:async()=> 'PRIVATE_RAW_RESPONSE_SENTINEL'};
   if(mode==='denial_success')return reply(200,[project(row)]);
   if(mode==='denial_effect')row.amount=2;
   if(mode==='direct_conversion_effect'&&table==='payment_conversions')row.converted_amount=2;
   if(mode==='owner_direct_effect'&&table==='payment_conversions'&&own)row.converted_amount=2;
   return mode==='permission_code'?reply(index?403:401,{code:'42501'}):reply(200,[]);
  }
  if(mode==='owner_delete_500')return reply(500,{});
  if(mode==='owner_delete_empty')return reply(200,[]);
  const old=project(row);
  if(mode!=='owner_delete_ignored'){
   store.delete(id);
   const recordIds=table==='payment_records'?[id]:[...records.values()].filter(x=>x.payment_item_id===id).map(x=>x.id);
   for(const rid of recordIds){
    if(mode!=='item_record_remains'||table==='payment_records')records.delete(rid);
    if(mode!=='cascade_missing')for(const c of [...convs.values()])if(c.entity_type==='payment_record'&&c.entity_id===rid)convs.delete(c.id);
   }
   if(mode==='old_conversion_changed')convs.get(uid(91)).updated_at='2026-10-14T13:00:00Z';
   if(mode==='old_record_changed')records.get(uid(31)).amount=2;
   if(mode==='old_item_changed')items.get(uid(21)).amount=2;
  }
  if(mode==='delete_response_changed')old.amount=2;
  return reply(200,[old]);
 };
 return {fetcher,uuid:()=>uid(++seq),items,records,convs,log,logout};
}
async function execute(mode){
 const f=fixture(mode),before={items:copy([...f.items]),records:copy([...f.records]),convs:copy([...f.convs])};
 const r=await run({...f,ownerPassword:'PRIVATE_OWNER_SENTINEL',outsiderPassword:'PRIVATE_OUTSIDER_SENTINEL',today:'2026-10-14'});
 const text=JSON.stringify(r);
 for(const s of ['PRIVATE_OWNER_SENTINEL','PRIVATE_OUTSIDER_SENTINEL','PRIVATE_TRANSPORT_SENTINEL','PRIVATE_RAW_RESPONSE_SENTINEL','sb_publishable_TEST_ONLY',uid(1),uid(2),uid(11),uid(61),uid(91)])assert(!text.includes(s));
 assert(f.log.filter(e=>e.method==='POST'&&e.path.endsWith('/payment_items')).every(e=>e.body.status==='inactive'));
 assert(!f.log.some(e=>e.method==='PATCH'));
 assert(!f.log.some(e=>e.path.endsWith('/workspace_settings')&&e.method!=='GET'));
 assert(f.log.filter(e=>e.method==='DELETE').every(e=>Number(new URLSearchParams(e.query).get('id').slice(-12))>1000));
 return {r,before,...f};
}
test('actual checker uses both actors and both cascade paths; all four new triples absent and old rows unchanged',async()=>{
 const f=await execute('good');assert.equal(f.r.result,'STAGING_PERSONAL_DELETION_AND_CONVERSION_CASCADE_SCOPED_PASS');assert.equal(f.r.checks.length,30);assert.equal(f.r.new_inactive_items_created,4);assert.equal(f.r.new_paid_records_created,4);assert.equal(f.r.new_identity_conversions_verified,4);assert.equal(f.r.derived_conversion_rows_cleanup_verified,true);assert.equal(f.r.incomplete_new_fixture_effects_may_remain,false);assert.equal(f.r.preexisting_visible_payment_and_conversion_rows_unchanged,true);assert.equal(f.r.hosted_acceptance,false);assert(f.r.requests_attempted<=240);assert.deepEqual([...f.items],f.before.items);assert.deepEqual([...f.records],f.before.records);assert.deepEqual([...f.convs],f.before.convs);assert.deepEqual(f.logout,[uid(1),uid(2)]);
});
for(const mode of ['permission_code','different_default'])test('accepts reviewed '+mode+' and preserves baselines',async()=>{assert.equal((await execute(mode)).r.result,'STAGING_PERSONAL_DELETION_AND_CONVERSION_CASCADE_SCOPED_PASS');});
const failures={production:'CONFIG_NOT_STAGING',push:'CONFIG_PRODUCTION_REFERENCE_OR_PUSH_KEY',second_login:'SYNTHETIC_SIGN_IN_FAILED',identity:'SESSION_IDENTITY_MISMATCH',staff:'ORDINARY_ACTIVE_ACCOUNT_REQUIRED',suspended:'ORDINARY_ACTIVE_ACCOUNT_REQUIRED',settings:'EXISTING_USD_REPORTING_AND_ENABLED_CONVERSION_REQUIRED_NO_SETTINGS_CHANGED',conversion_disabled:'EXISTING_USD_REPORTING_AND_ENABLED_CONVERSION_REQUIRED_NO_SETTINGS_CHANGED',schema_cache:'GENERATED_REFERENCE_NOT_VISIBLE_IN_API_SCHEMA_CACHE',reference_shape:'GENERATED_REFERENCE_BASELINE_SHAPE_MISMATCH',large_baseline:'CONVERSION_BASELINE_UNAVAILABLE_OR_TOO_LARGE',manual_baseline:'RETAINED_MANUAL_BASELINE_MISMATCH',missing_new_conversion:'NEW_IDENTITY_CONVERSION_REQUIRED',wrong_new_reference:'NEW_IDENTITY_CONVERSION_REFERENCE_OR_SCOPE_MISMATCH',multiple_new_conversions:'NEW_IDENTITY_CONVERSION_REQUIRED',post_unknown:'NETWORK_OR_LOCAL_ERROR',denial_500:'UNAUTHORIZED_RECORD_DELETE_NOT_DENIED',denial_bad_jwt:'UNAUTHORIZED_RECORD_DELETE_NOT_DENIED',denial_malformed:'UNAUTHORIZED_RECORD_DELETE_NOT_DENIED',denial_success:'UNAUTHORIZED_RECORD_DELETE_NOT_DENIED',denial_effect:'PROTECTED_FIXTURE_CHANGED',direct_conversion_effect:'PROTECTED_CONVERSION_CHANGED',owner_direct_effect:'PROTECTED_CONVERSION_CHANGED',created_conversion_changed:'PROTECTED_CONVERSION_CHANGED',denial_transport:'NETWORK_OR_LOCAL_ERROR',owner_delete_500:'OWNER_RECORD_DELETE_FAILED',owner_delete_empty:'OWNER_RECORD_DELETE_FAILED',owner_delete_ignored:'DELETED_ROW_STILL_VISIBLE_OR_UNCHECKABLE',cascade_missing:'DELETED_ROW_STILL_VISIBLE_OR_UNCHECKABLE',item_record_remains:'DELETED_ROW_STILL_VISIBLE_OR_UNCHECKABLE',delete_response_changed:'OWNER_RECORD_DELETE_RETURN_MISMATCH',old_conversion_changed:'PREEXISTING_VISIBLE_CONVERSIONS_CHANGED_OR_NEW_CONVERSIONS_REMAIN',old_record_changed:'PREEXISTING_VISIBLE_RECORDS_CHANGED_OR_NEW_RECORDS_REMAIN',old_item_changed:'PREEXISTING_VISIBLE_ITEMS_CHANGED_OR_NEW_ITEMS_REMAIN',logout:'TEST_SESSION_LOGOUT_FAILED'};
for(const [mode,code]of Object.entries(failures))test('fails closed: '+mode,async()=>{
 const f=await execute(mode);assert.equal(f.r.result,'STAGING_PERSONAL_DELETION_REVIEW');assert.equal(f.r.problem_code,code);assert(f.r.checks.some(x=>x.status==='REVIEW'));if(mode!=='production'&&mode!=='push')assert(f.logout.length>0);if(['schema_cache','conversion_disabled','manual_baseline','reference_shape'].includes(mode))assert(!f.log.some(x=>x.method==='POST'&&x.path.endsWith('/payment_items')));
});
test('missing credentials do not start transport',async()=>{let calls=0;const r=await run({fetcher:()=>{calls++;throw Error('forbidden transport');}});assert.equal(calls,0);assert.equal(r.problem_code,'TWO_STAGING_APP_PASSWORDS_REQUIRED');});
test('only structured permission denial or empty successful DELETE is accepted',()=>{assert(deleteDenied({status:403,data:{code:'42501'}}));assert(deleteDenied({status:200,data:[]}));for(const r of [{status:500,data:[]},{status:204,data:null},{status:401,data:{code:'invalid_jwt'}},{status:200,data:[{}]},{status:200,data:null}])assert.equal(deleteDenied(r),false);});
test('pinned PowerShell driver compiles and refuses absent passwords with default network disabled',()=>{
 const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
 const ps=fs.readFileSync(path.join(__dirname,'../scripts/run-fr-2-personal-deletion.ps1'),'utf8');
 const driver=ps.match(/\$DriverCode = @'\n([\s\S]*?)\n'@/)[1];const env={...process.env};delete env.MUSHAVO_FR2_OWNER_PASSWORD;delete env.MUSHAVO_FR2_SECOND_PASSWORD;
 const child=spawnSync(process.execPath,['--require',path.join(__dirname,'../scripts/offline-test-network.cjs'),'-e',driver],{cwd:path.join(__dirname,'../scripts'),encoding:'utf8',env});
 assert.equal(child.status,1);assert.equal(child.stderr,'');assert.equal(JSON.parse(child.stdout).problem_code,'TWO_STAGING_APP_PASSWORDS_REQUIRED');assert(!/[^\x00-\x7F]/.test(ps));
});
