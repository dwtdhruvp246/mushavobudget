import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import * as claims from '../supabase/functions/_shared/outbox-claim.mjs';
import {activeNotificationRecipient,prepareReminderPayload} from '../supabase/functions/_shared/notification-recipient.mjs';

const NOW=Date.parse('2026-11-07T20:00:00Z');
const UUID='11111111-1111-4111-8111-111111111111';
const sourceId='22222222-2222-4222-8222-222222222222';
const sources={};
for(const name of ['dispatch-push-reminders','dispatch-admin-notifications']) {
  sources[name]=stripTypeScriptTypes(await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8'),{mode:'strip'}).replace(/^import[^;]*;\s*/gm,'');
}

async function run(kind,{onLookup,onSend,alterClaim,claimError=false,devices=2}={}) {
  let clock=NOW,serve;
  class Clock extends Date { constructor(...args){super(...(args.length?args:[clock]));} static now(){return clock;} }
  const admin=kind==='admin', table=admin?'admin_notification_outbox':'notification_outbox';
  const job={id:UUID,user_id:'actor-A',workspace_id:'workspace-A',source_id:sourceId,notification_id:'notice-A',
    attempt_count:1,claimed_at:new Date(NOW-60000).toISOString(),status:'processing',
    source_type:admin?'public_enquiry_created':kind==='business'?'business_bill':'payment',
    notification_type:'payment_due_today',title:'PRIVATE TITLE',body:'PRIVATE AMOUNT',target_url:'/app.html',
    idempotency_key:kind==='business'?`business_bill:${sourceId}:due:2026-11-07:reminder:2026-11-07`:`payment:${sourceId}:due-date:2026-11-07:reminder-date:2026-11-07`};
  const state={profile:{account_status:'active'},membership:{id:'member-A'},admin:{role:'super_admin'},
    businessAllowed:true,paymentAllowed:true,settings:{reminder_enabled:true,detailed_notification_previews:true},
    item:{id:sourceId,workspace_id:job.workspace_id,family_id:null,owner_id:job.user_id,visibility:'personal',
      responsible_member_id:null,amount:20,recurrence_type:'monthly',status:'active'},errors:{},
    claim:{...job},deliveries:[],calls:[],rpcCalls:[],logs:[],queueWrites:[],
    advance(ms){clock+=ms;}};
  if(alterClaim)alterClaim(state);
  const dataFor=tableName=>({profiles:state.profile,workspace_members:state.membership,app_admins:state.admin,
    workspace_settings:state.settings,payment_items:state.item,payment_records:[],
    notifications:{id:job.notification_id,user_id:job.user_id,read_at:null},enquiries:{status:'new'},
    business_bills:{id:sourceId,workspace_id:job.workspace_id,due_on:'2026-11-07',status:'open',amount:20,paid_amount:0},
    push_subscriptions:Array.from({length:devices},(_,i)=>({id:`device-${i}`,endpoint:`https://synthetic.invalid/${i}`,p256dh:'synthetic',auth:'synthetic',failure_count:0})),
    [table]:state.claim})[tableName];
  const matches=filters=>state.claim&&filters.every(([op,key,value])=>op==='eq'?state.claim[key]===value:op==='gt'?Date.parse(state.claim[key])>Date.parse(value):op==='lte'?Date.parse(state.claim[key])<=Date.parse(value):true);
  const db={
    from(tableName){
      let update;const filters=[];
      const result=async()=>{
        state.calls.push({table:tableName,update,filters});
        if(tableName==='push_subscriptions'&&!update&&onLookup)await onLookup(state);
        if(tableName===table&&!update&&claimError)return {data:null,error:{code:'SAFE_DB_ERROR'}};
        if(state.errors[tableName])return {data:null,error:{code:'SAFE_DB_ERROR',message:'PRIVATE DB ERROR'}};
        if(update){
          if(tableName===table){if(!matches(filters))return {data:null,error:null};Object.assign(state.claim,update);state.queueWrites.push({...update});return {data:{id:job.id},error:null};}
          return {data:null,error:null};
        }
        return {data:dataFor(tableName),error:null};
      };
      const q={select(){return q;},eq(k,v){filters.push(['eq',k,v]);return q;},is(){return q;},
        gt(k,v){filters.push(['gt',k,v]);return q;},lte(k,v){filters.push(['lte',k,v]);return q;},
        update(v){update=v;return q;},maybeSingle:result,then(a,b){return result().then(a,b);}};
      return q;
    },
    async rpc(name,args){
      state.rpcCalls.push({name,args});
      if(name.startsWith('claim_')&&name.includes('outbox'))return {data:[{...job}],error:null};
      if(name==='payment_reminder_allowed')return {data:state.paymentAllowed,error:null};
      if(name==='business_bill_reminder_allowed')return {data:state.businessAllowed,error:null};
      if(name.startsWith('record_')&&name.endsWith('_result')){
        if(!state.claim||state.claim.status!=='processing'||state.claim.attempt_count!==args.p_expected_attempt_count||state.claim.claimed_at!==args.p_expected_claimed_at)return {data:null,error:null};
        const status=args.p_succeeded?'sent':args.p_permanent_failure?'failed':'retry';
        state.claim.status=status;state.queueWrites.push({status});return {data:{...state.claim},error:null};
      }
      return {data:0,error:null};
    }
  };
  const env={CRON_SECRET:'synthetic-cron',SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
    VAPID_PUBLIC_KEY:'synthetic-public',VAPID_PRIVATE_KEY:'synthetic-private',VAPID_SUBJECT:'mailto:synthetic@example.com'};
  const execute=new Function('createClient','webpush','createGuardedPushSender','isBlockedPushDestination',
    'activeNotificationRecipient','prepareReminderPayload','cancelClaimedOutboxJob','recordClaimedOutboxResult',
    'requireCurrentOutboxClaim','isOutboxClaimLost','Deno','console','Date',sources[admin?'dispatch-admin-notifications':'dispatch-push-reminders']);
  execute(()=>db,{setVapidDetails(){}},()=>async(device,payload)=>{state.deliveries.push(JSON.parse(payload));if(onSend)await onSend(state);},
    ()=>false,activeNotificationRecipient,prepareReminderPayload,claims.cancelClaimedOutboxJob,claims.recordClaimedOutboxResult,
    claims.requireCurrentOutboxClaim,claims.isOutboxClaimLost,{env:{get:k=>env[k]},serve:f=>{serve=f;}},
    {warn:(...x)=>state.logs.push(x),error:(...x)=>state.logs.push(x)},Clock);
  const response=await serve(new Request('https://synthetic.invalid/dispatch',{method:'POST',headers:{'x-mushavo-cron-secret':env.CRON_SECRET,'Content-Type':'application/json'},body:'{"source":"cron"}'}));
  state.result=await response.json();state.status=response.status;
  return state;
}

for(const kind of ['personal','business','admin'])test(`Y_SEND_ACTIVE_${kind.toUpperCase()}: current authorized claim delivers to both devices`,async()=>{
  const s=await run(kind);assert.equal(s.deliveries.length,2);assert.equal(s.result.sent,1);assert.equal(s.claim.status,'sent');
});
const lookupCases=[
 ['Y_SEND_PERSONAL_SUSPENDED','personal',s=>{s.profile={account_status:'suspended'};}],
 ['Y_SEND_MEMBER_REMOVED','personal',s=>{s.membership=null;}],
 ['Y_SEND_ASSIGNMENT_CHANGED','personal',s=>{s.item.owner_id='actor-B';}],
 ['Y_SEND_BUSINESS_ACCESS_ENDED','business',s=>{s.businessAllowed=false;}],
 ['Y_SEND_ADMIN_ROLE_ENDED','admin',s=>{s.admin=null;}],
 ['Y_SEND_ADMIN_SUSPENDED','admin',s=>{s.profile={account_status:'suspended'};}]
];
for(const [id,kind,onLookup] of lookupCases)test(`${id}: a change during device lookup cancels before sending`,async()=>{
  const s=await run(kind,{onLookup});assert.equal(s.deliveries.length,0);assert.equal(s.result.cancelled,1);assert.equal(s.claim.status,'cancelled');
});
for(const [id,kind,change] of [
 ['Y_SEND_ADMIN_BETWEEN_DEVICES','admin',s=>{s.admin=null;}],
 ['Y_SEND_MEMBER_BETWEEN_DEVICES','personal',s=>{s.membership=null;}],
 ['Y_SEND_BUSINESS_BETWEEN_DEVICES','business',s=>{s.businessAllowed=false;}]
])test(`${id}: accepted first delivery does not authorize the next device`,async()=>{
  const s=await run(kind,{onSend:change});assert.equal(s.deliveries.length,1);assert.equal(s.result.sent,1);assert.equal(s.claim.status,'sent');
});
test('Y_SEND_PREVIEW_BETWEEN_DEVICES: the second payload uses the current privacy setting',async()=>{
  const s=await run('personal',{onSend:s=>{s.settings.detailed_notification_previews=false;}});
  assert.equal(s.deliveries.length,2);assert.equal(s.deliveries[0].body,'PRIVATE AMOUNT');assert.equal(s.deliveries[1].body.includes('PRIVATE'),false);
});
test('Y_SEND_AUTH_LOOKUP_ERROR: failed final authorization lookup sends nothing and retries safely',async()=>{
  const s=await run('personal',{onLookup:s=>{s.errors.profiles=true;}});assert.equal(s.deliveries.length,0);assert.equal(s.result.retry,1);assert.equal(JSON.stringify(s.logs).includes('PRIVATE DB ERROR'),false);
});
test('Y_SEND_PARTIAL_LOOKUP_ERROR: failed revalidation stops remaining devices and preserves accepted delivery',async()=>{
  const s=await run('personal',{onSend:s=>{s.errors.profiles=true;}});assert.equal(s.deliveries.length,1);assert.equal(s.result.sent,1);assert.equal(s.result.retry,0);
});
for(const kind of ['personal','admin'])test(`Y_SEND_SUPERSEDED_${kind.toUpperCase()}: a newer claim blocks provider and queue mutation`,async()=>{
  const s=await run(kind,{onLookup:s=>{s.claim.attempt_count=2;}});assert.equal(s.deliveries.length,0);assert.equal(s.queueWrites.length,0);assert.equal(s.result.skipped,1);
});
for(const kind of ['personal','admin'])test(`Y_SEND_EXPIRED_${kind.toUpperCase()}: an expired claim blocks provider and queue mutation`,async()=>{
  const s=await run(kind,{onLookup:s=>s.advance(20*60*1000)});assert.equal(s.deliveries.length,0);assert.equal(s.queueWrites.length,0);assert.equal(s.result.skipped,1);
});
test('Y_SEND_RECLAIM_BETWEEN_DEVICES: the old worker stops without modifying the new claim',async()=>{
  const s=await run('personal',{onSend:s=>{s.claim.attempt_count=2;}});assert.equal(s.deliveries.length,1);assert.equal(s.queueWrites.length,0);assert.equal(s.result.skipped,1);
});
test('Y_SEND_TERMINAL_CLAIM: terminal rows are never used to send',async()=>{
  for(const status of ['sent','cancelled','failed']){
    const s=await run('admin',{onLookup:s=>{s.claim.status=status;}});assert.equal(s.deliveries.length,0);assert.equal(s.queueWrites.length,0);
  }
});
test('Y_SEND_MISSING_CLAIM: a removed row cannot authorize delivery',async()=>{
  const s=await run('personal',{onLookup:s=>{s.claim=null;}});assert.equal(s.deliveries.length,0);assert.equal(s.queueWrites.length,0);
});
test('Y_SEND_CLAIM_LOOKUP_ERROR: database uncertainty stops provider delivery',async()=>{
  const s=await run('personal',{claimError:true});assert.equal(s.deliveries.length,0);assert.equal(s.result.retry,1);
});
