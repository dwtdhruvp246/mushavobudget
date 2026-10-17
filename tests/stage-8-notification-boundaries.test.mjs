import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {activeNotificationRecipient, prepareReminderPayload} from '../supabase/functions/_shared/notification-recipient.mjs';
import {requireEmailVerifiedSession,emailVerificationFailure} from '../supabase/functions/_shared/email-session-assurance.mjs';

const user = 'actor-A', workspace = 'workspace-A', sourceId = '11111111-1111-4111-8111-111111111111';
const job = {id:'job-A', user_id:user, workspace_id:workspace, source_id:sourceId, source_type:'payment',
  notification_type:'payment_due_today', notification_id:'notification-A', title:'PRIVATE_WORKSPACE',
  body:'PRIVATE_PAYMENT USD 999.00', target_url:'/app.html?source=push#family/payments',
  idempotency_key:`payment:${sourceId}:due-date:2026-10-12:reminder-date:2026-10-12`};
function database(patch = {}, errors = {}) {
  const data = {profiles:{account_status:'active'}, workspace_settings:{reminder_enabled:true,detailed_notification_previews:false},
    app_admins:{role:'super_admin'}, notifications:{id:job.notification_id,user_id:user,read_at:null}, enquiries:{status:'new'},
    payment_items:{id:sourceId,workspace_id:workspace,family_id:null,owner_id:user,visibility:'personal',responsible_member_id:null,
      amount:20,recurrence_type:'monthly',status:'active'}, payment_records:[],workspace_members:{id:'member-A'},
    business_bills:{id:sourceId,workspace_id:workspace,due_on:'2026-10-12',status:'open',amount:20,paid_amount:0},
    push_subscriptions:[{id:'device-A',endpoint:'https://synthetic.invalid/push',p256dh:'PRIVATE_KEY',auth:'PRIVATE_AUTH',failure_count:0}],...patch};
  const calls = [], rpcs = [], updates = [];
  return {data,calls,rpcs,updates,auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    from(table) {
      const filters = []; let update;
      const value = () => typeof data[table] === 'function' ? data[table]() : data[table];
      const result = () => {calls.push({table,filters,update});if(update)updates.push({table,filters,update});
        return {data:update ? null : value(),error:errors[table] ?? null};};
      const q = {select(){return q;},eq(...a){filters.push(a);return q;},is(...a){filters.push(a);return q;},
        update(v){update=v;return q;},maybeSingle:async()=>result(),then:(a,b)=>Promise.resolve(result()).then(a,b)};
      return q;
    },
    async rpc(name, params) {rpcs.push({name,params});return {data:name.startsWith('claim_')&&name.includes('outbox') ? [this.job] :
      ['email_gate_current_session_verified','payment_reminder_allowed','business_bill_reminder_allowed','claim_push_test_rate_limit'].includes(name) ? true : 0,error:null};}
  };
}
async function handler(name, {patch={},errors={},row=job,body={source:'cron'}} = {}) {
  const db = database(patch,errors); db.job = row;
  const deliveries = [], logs = []; let serve;
  const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
  const js = stripTypeScriptTypes(source,{mode:'strip'}).replace(/^import[^;]*;\s*/gm,'');
  const env = {APP_ORIGIN:'https://synthetic.invalid',SUPABASE_URL:'https://db.invalid',SUPABASE_ANON_KEY:'synthetic-public',
    SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',VAPID_PUBLIC_KEY:'synthetic-public',VAPID_PRIVATE_KEY:'synthetic-private',
    VAPID_SUBJECT:'mailto:synthetic@example.com',CRON_SECRET:'synthetic-cron'};
  const execute = new Function('createClient','webpush','createGuardedPushSender','isBlockedPushDestination',
    'activeNotificationRecipient','prepareReminderPayload','requireEmailVerifiedSession','emailVerificationFailure','Deno','console',js);
  execute(()=>db,{setVapidDetails(){}},()=>async(subscription,payload)=>{deliveries.push({subscription,payload:JSON.parse(payload)});},
    ()=>false,activeNotificationRecipient,prepareReminderPayload,requireEmailVerifiedSession,emailVerificationFailure,{env:{get:k=>env[k]},serve:f=>{serve=f;}},
    {warn:(...a)=>logs.push(a),error:(...a)=>logs.push(a)});
  const response = await serve(new Request('https://synthetic.invalid/send',{method:'POST',
    headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer synthetic-session','x-mushavo-cron-secret':env.CRON_SECRET,'Content-Type':'application/json'},
    body:JSON.stringify(body)}));
  return {status:response.status,body:await response.json(),db,deliveries,logs};
}
const businessSource = await readFile(new URL('../business.js',import.meta.url),'utf8');
const cleanupSource = businessSource.slice(businessSource.indexOf('let businessSignOutInProgress = false;'),businessSource.indexOf('\nfunction leaveBusiness('));
function business({supported=true,registration=true,subscription=true,dbError=null,unsubscribeError=null,authError=null,
  badgeError=false,storageError=false,onRegistration=null,onSubscription=null,onDelete=null,onAuth=null}={}) {
  const calls = [], timers = new Map(); let nextTimer = 0;
  const state = {session:{user:{id:user}}}, message = {textContent:''};
  const sub = {endpoint:'synthetic-endpoint-A',async unsubscribe(){calls.push('unsubscribe');if(unsubscribeError)throw unsubscribeError;return true;}};
  const reg = {pushManager:{async getSubscription(){calls.push('getSubscription');if(onSubscription)await onSubscription(context);return subscription ? sub : null;}}};
  const navigator = {async clearAppBadge(){calls.push('badge');if(badgeError)throw Error('badge');}};
  if(supported)navigator.serviceWorker={async getRegistration(){calls.push('getRegistration');if(onRegistration)await onRegistration(context);return registration ? reg : null;}};
  const window = {location:{replace:v=>calls.push(['navigate',v])},alert:v=>calls.push(['warning',v]),
    localStorage:{removeItem:v=>{calls.push(['forget',v]);if(storageError)throw Error('storage');}},
    setTimeout:f=>{const id=++nextTimer;timers.set(id,f);return id;},clearTimeout:id=>timers.delete(id)};
  if(supported)window.PushManager=function(){};
  const client = {auth:{async signOut(options){calls.push(['auth',options]);if(onAuth)await onAuth(context);return {error:authError};}},
    from(table){const filters=[];return {delete(){calls.push(['delete',table,filters]);return this;},eq(...a){filters.push(a);return this;},
      then(a,b){return Promise.resolve().then(async()=>{if(onDelete)await onDelete(context);return {error:dbError};}).then(a,b);}};}};
  const context = vm.createContext({state,navigator,window,supabase:client,businessAuthEpoch:1,
    clearBusinessWorkspaceState(){calls.push('clear');state.session=null;},$:()=>message,showOnly:v=>calls.push(['view',v]),Promise,Error});
  vm.runInContext(cleanupSource+'\nglobalThis.runSignOut = signOut;',context);
  return {context,calls,timers,message,run:()=>context.runSignOut()};
}
function deferred() {let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
const flush = async()=>{for(let i=0;i<12;i++)await Promise.resolve();};

test('active-recipient helper rejects missing/suspended/unknown profiles',async()=>{
  for(const profile of [null,{account_status:'suspended'},{account_status:'unknown'}])assert.equal(await activeNotificationRecipient(database({profiles:profile}),user),false);
  assert.equal(await activeNotificationRecipient(database(),user),true);
});
test('recipient lookup failures have no active fallback or private DB error leak',async()=>{
  await assert.rejects(activeNotificationRecipient(database({}, {profiles:{message:'PRIVATE_DB_CONTENT'}}),user),{message:'recipient_status:database_error'});
});
test('recipient query binds the server-selected UUID',async()=>{
  const db=database();await activeNotificationRecipient(db,user);assert.deepEqual(db.calls[0].filters,[['id',user]]);
});
test('payment generic preview redacts each stored detailed window',async()=>{
  for(const type of ['payment_due_today','payment_due_tomorrow','payment_due_soon']){
    const p=await prepareReminderPayload(database(),{...job,notification_type:type},'time');
    assert.equal(p.title,'Mushavo Budget');assert.equal(JSON.stringify(p).includes('PRIVATE_'),false);assert.equal(p.target_url,job.target_url);
  }
});
test('Business generic preview redacts queued bill amount/title',async()=>{
  const p=await prepareReminderPayload(database(),{...job,source_type:'business_bill'},'time');
  assert.equal(p.title,'Business bill reminder');assert.equal(p.body,'A Business bill has an outstanding balance and is due soon.');
});
test('currently enabled detailed preview preserves accepted queued copy and route',async()=>{
  const p=await prepareReminderPayload(database({workspace_settings:{reminder_enabled:true,detailed_notification_previews:true}}),job,'time');
  assert.equal(p.title,job.title);assert.equal(p.body,job.body);assert.equal(p.target_url,job.target_url);assert.equal(p.sent_at,'time');
});
test('null or nonboolean preview authority fails to generic copy',async()=>{
  for(const flag of [null,undefined,'true',1]){
    const p=await prepareReminderPayload(database({workspace_settings:{reminder_enabled:true,detailed_notification_previews:flag}}),job,'time');
    assert.equal(JSON.stringify(p).includes('PRIVATE_'),false);
  }
});
test('missing or disabled current reminder settings yield no payload',async()=>{
  for(const settings of [null,{reminder_enabled:false},{reminder_enabled:'true'}])assert.equal(await prepareReminderPayload(database({workspace_settings:settings}),job,'time'),null);
});
test('preview query error cannot fall back to stored private copy',async()=>{
  await assert.rejects(prepareReminderPayload(database({}, {workspace_settings:{message:'PRIVATE_DB_CONTENT'}}),job,'time'),{message:'preview_settings:database_error'});
});
test('unsupported reminder source cannot produce a payload',async()=>{
  await assert.rejects(prepareReminderPayload(database(),{...job,source_type:'foreign'},'time'),/unsupported/);
});
test('actual reminder handler rereads settings and redacts both Personal and Business queued copy',async()=>{
  for(const source_type of ['payment','business_bill']){
    const row={...job,source_type,idempotency_key:source_type==='payment'?job.idempotency_key:`business_bill:${sourceId}:due:2026-10-12:reminder:2026-10-12`};
    let reads=0;
    const r=await handler('dispatch-push-reminders',{row,patch:{workspace_settings:()=>({reminder_enabled:true,detailed_notification_previews:++reads===1&&source_type==='payment'})}});
    assert.equal(r.deliveries.length,1);assert.equal(JSON.stringify(r.deliveries[0].payload).includes('PRIVATE_'),false);
    assert.ok(r.db.calls.some(c=>c.table==='workspace_settings'&&c.filters.some(f=>f[0]==='workspace_id'&&f[1]===workspace)));
  }
});
test('actual reminder privacy-read failure retries without a send',async()=>{
  const row={...job,source_type:'business_bill',idempotency_key:`business_bill:${sourceId}:due:2026-10-12:reminder:2026-10-12`};
  const r=await handler('dispatch-push-reminders',{row,errors:{workspace_settings:{message:'PRIVATE_DB_CONTENT'}}});
  assert.equal(r.deliveries.length,0);assert.equal(r.body.retry,1);assert.equal(JSON.stringify(r.logs).includes('PRIVATE_DB_CONTENT'),false);
});
test('actual reminder disabled-current setting cancels without sending',async()=>{
  const row={...job,source_type:'business_bill',idempotency_key:`business_bill:${sourceId}:due:2026-10-12:reminder:2026-10-12`};
  const r=await handler('dispatch-push-reminders',{row,patch:{workspace_settings:{reminder_enabled:false}}});
  assert.equal(r.deliveries.length,0);assert.equal(r.body.cancelled,1);
});
test('actual active reminder with detailed preference retains payload',async()=>{
  const r=await handler('dispatch-push-reminders',{patch:{workspace_settings:{reminder_enabled:true,detailed_notification_previews:true}}});
  assert.equal(r.deliveries[0].payload.body,job.body);assert.equal(r.body.sent,1);
});
test('actual test sender denies inactive/missing profiles before subscriptions or cooldown',async()=>{
  for(const profile of [null,{account_status:'suspended'}]){
    const r=await handler('send-test-push',{patch:{profiles:profile}});assert.equal(r.status,403);assert.equal(r.deliveries.length,0);
    assert.deepEqual(r.db.rpcs.map(c=>c.name),['email_gate_current_session_verified']);assert.equal(r.db.calls.some(c=>c.table==='push_subscriptions'),false);
  }
});
test('actual test sender lookup error fails closed with safe status',async()=>{
  const r=await handler('send-test-push',{errors:{profiles:{message:'PRIVATE_DB_CONTENT'}}});
  assert.equal(r.status,500);assert.equal(r.body.error,'PUSH_RECIPIENT_STATUS_CHECK_FAILED');assert.equal(r.deliveries.length,0);
});
test('actual Admin sender cancels inactive/missing recipients',async()=>{
  for(const profiles of [null,{account_status:'suspended'}]){
    const r=await handler('dispatch-admin-notifications',{row:{...job,source_type:'public_enquiry_created'},patch:{profiles}});
    assert.equal(r.body.cancelled,1);assert.equal(r.deliveries.length,0);
  }
});
test('actual Admin profile-read error retries without a send',async()=>{
  const r=await handler('dispatch-admin-notifications',{row:{...job,source_type:'public_enquiry_created'},errors:{profiles:{message:'PRIVATE_DB_CONTENT'}}});
  assert.equal(r.body.retry,1);assert.equal(r.deliveries.length,0);assert.equal(JSON.stringify(r.logs).includes('PRIVATE_DB_CONTENT'),false);
});
test('actual inadequate Admin role cancels before recipient lookup',async()=>{
  const r=await handler('dispatch-admin-notifications',{row:{...job,source_type:'public_enquiry_created'},patch:{app_admins:{role:'finance_staff'}}});
  assert.equal(r.body.cancelled,1);assert.equal(r.db.calls.some(c=>c.table==='profiles'),false);
});
test('actual active test sender ignores caller recipient/settings and preserves cooldown',async()=>{
  const r=await handler('send-test-push',{body:{user_id:'actor-B',verified:true,detailed_notification_previews:true}});
  assert.equal(r.status,200);assert.equal(r.deliveries.length,1);assert.equal(r.db.rpcs.find(c=>c.name==='claim_push_test_rate_limit').params.p_user_id,user);
  assert.deepEqual(r.db.calls.find(c=>c.table==='profiles').filters,[['id',user]]);
});
test('actual Admin sender preserves valid alerts and rejects read/foreign/closed source',async()=>{
  assert.equal((await handler('dispatch-admin-notifications',{row:{...job,source_type:'public_enquiry_created'}})).body.sent,1);
  for(const patch of [{notifications:{user_id:user,read_at:'time'}},{notifications:{user_id:'actor-B',read_at:null}},{enquiries:{status:'closed'}}]){
    const r=await handler('dispatch-admin-notifications',{row:{...job,source_type:'public_enquiry_created'},patch});assert.equal(r.deliveries.length,0);
  }
});
test('actual Business sign-out retires only current device before Auth and redirect',async()=>{
  const h=business();await h.run();const d=h.calls.find(c=>Array.isArray(c)&&c[0]==='delete');
  assert.equal(d[1],'push_subscriptions');assert.deepEqual(d[2],[['user_id',user],['endpoint','synthetic-endpoint-A']]);
  assert.ok(h.calls.indexOf('unsubscribe')<h.calls.findIndex(c=>Array.isArray(c)&&c[0]==='auth'));
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='forget'&&c[1]===`mushavo-budget:push-enabled:${user}`));
  assert.equal(h.calls.filter(c=>Array.isArray(c)&&c[0]==='warning').length,0);assert.equal(h.timers.size,0);
});
test('actual Business sign-out works with unsupported browser/no worker/no subscription',async()=>{
  for(const options of [{supported:false},{registration:false},{subscription:false}]){
    const h=business(options);await h.run();assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='auth'));
    assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='delete'),false);
  }
});
test('database cleanup outage permits Auth sign-out and warns without unsubscribing',async()=>{
  const h=business({dbError:Error('private DB')});await h.run();assert.equal(h.calls.includes('unsubscribe'),false);
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='auth'));assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='warning'));
  assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='forget'),false);
});
test('browser unsubscribe outage permits Auth sign-out and retains recovery opt-in',async()=>{
  const h=business({unsubscribeError:Error('private provider')});await h.run();
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='warning'));assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='forget'),false);
});
test('Auth sign-out failure preserves session and avoids successful navigation',async()=>{
  const h=business({authError:Error('Auth unavailable')});await h.run();assert.equal(h.context.state.session.user.id,user);
  assert.equal(h.calls.includes('clear'),false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='navigate'),false);
});
test('account/epoch change during registration or subscription lookup cannot mutate or sign out new account',async()=>{
  for(const name of ['onRegistration','onSubscription']){
    const h=business({[name]:async c=>{c.state.session.user.id='actor-B';c.businessAuthEpoch++;}});await h.run();
    assert.equal(h.calls.some(c=>Array.isArray(c)&&['delete','auth','navigate'].includes(c[0])),false);
  }
  const h=business({onSubscription:async c=>{c.businessAuthEpoch+=2;}});await h.run();assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='delete'),false);
});
test('account change after database cleanup prevents new-account browser unsubscribe/Auth',async()=>{
  const h=business({onDelete:async c=>{c.state.session.user.id='actor-B';c.businessAuthEpoch++;}});await h.run();
  assert.equal(h.calls.includes('unsubscribe'),false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='auth'),false);
});
test('cleanup deadline permits sign-out; late lookup cannot delete or unsubscribe',async()=>{
  const wait=deferred(),h=business({onRegistration:()=>wait.promise});const pending=h.run();await flush();
  assert.equal(h.timers.size,1);[...h.timers.values()][0]();await pending;wait.resolve();await flush();
  assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='auth'));assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='delete'),false);
  assert.equal(h.calls.includes('unsubscribe'),false);assert.equal(h.timers.size,0);
});
test('repeated Business sign-out while cleanup is pending executes one Auth action',async()=>{
  const wait=deferred(),h=business({onRegistration:()=>wait.promise});const p=h.run();await h.run();wait.resolve();await p;
  assert.equal(h.calls.filter(c=>Array.isArray(c)&&c[0]==='auth').length,1);
});
test('optional badge/storage failures do not block successful sign-out',async()=>{
  const h=business({badgeError:true,storageError:true});await h.run();assert.ok(h.calls.some(c=>Array.isArray(c)&&c[0]==='navigate'));
  assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='warning'),false);
});
test('late Auth completion cannot clear or navigate a different signed-in identity',async()=>{
  const h=business({onAuth:async c=>{c.state.session.user.id='actor-B';c.businessAuthEpoch++;}});await h.run();
  assert.equal(h.calls.includes('clear'),false);assert.equal(h.calls.some(c=>Array.isArray(c)&&c[0]==='navigate'),false);
});
