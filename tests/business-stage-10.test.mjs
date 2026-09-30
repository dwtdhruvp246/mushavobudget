import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('business.js');
const extract=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
function nodes(){const map=new Map();return selector=>{if(!map.has(selector))map.set(selector,{disabled:false,textContent:'',children:[],classList:{toggle(){},add(){}},replaceChildren(...children){this.children=children;},append(...children){this.children.push(...children);}});return map.get(selector);};}

test('expired and suspended workspaces lock every role, with Owner-only billing and distinct suspension text',()=>{
  for(const role of ['business_owner','business_admin','finance_manager','team_manager','staff','viewer']){
    for(const status of ['expired','suspended','invalid']){
      const $=nodes(),button={};
      const context=vm.createContext({$, $$:()=>[button],Date,state:{workspace:{id:'w',owner_id:'owner',status:'active'},session:{user:{id:role==='business_owner'?'owner':'member'}},workspaceSubscription:{status:status==='invalid'?'active':status,paid_through_at:status==='invalid'?'bad-date':status==='expired'?'2000-01-01':'2100-01-01'},workspaceEntitlement:{effective_status:status==='invalid'?'active':status}},roleForWorkspace:()=>role});
      vm.runInContext(extract('function businessBillingOwner','\nfunction renderBusinessBilling')+'\n'+extract('function resolveWorkspaceLock','\nfunction renderRoute'),context);
      context.resolveWorkspaceLock();assert.equal(context.state.locked,true);assert.equal(button.disabled,true);
      assert.equal(context.state.lockOwner,role==='business_owner');
      if(role==='business_owner')assert.equal(context.state.tab,'subscription');
      if(status==='suspended')assert.match($('#businessLockMessage').textContent,/suspend|administrator|suspension/i);
      else if(role!=='business_owner')assert.match($('#businessLockMessage').textContent,/Contact the Business Owner/);
    }
  }
});
test('zero prices are configured prices; missing prices and non-Owners cannot use billing controls',()=>{
  const $=nodes(),context=vm.createContext({$,state:{workspace:{id:'w'},workspaceSubscription:{billing_period:'monthly'},billingSnapshot:{settings:{pilot_enabled:true,included_seats:1,monthly_base:0,monthly_seat:0,annual_base:null,annual_seat:null},subscription:{},current_limit:3,usage:1,history:[],history_count:0}},billingBusy:false,billingOffset:0,businessBillingOwner:()=>true,claimNode:(tag,css,text)=>({textContent:text}),formatDateTime:()=>'',money:()=>''});
  vm.runInContext(extract('function renderBusinessBilling','\nasync function refreshBusinessBilling'),context);
  context.renderBusinessBilling();assert.equal($('#businessRenewSubscription').disabled,false);assert.equal($('#businessBuySeats').disabled,false);
  context.state.workspaceSubscription.billing_period='annual';context.renderBusinessBilling();assert.equal($('#businessBuySeats').disabled,true);
  context.businessBillingOwner=()=>false;context.state.billingSnapshot.history=[{reference_number:'Private owner payment'}];context.renderBusinessBilling();
  assert.equal($('#businessRenewSubscription').disabled,true);assert.equal($('#businessBillingHistory').children.length,0);assert.match($('#businessBillingAvailability').textContent,/Only the Business Owner/);
});
test('an old billing response cannot overwrite another workspace',async()=>{
  let resolve;
  const pending=new Promise(done=>resolve=done);
  const context=vm.createContext({state:{workspace:{id:'first'},billingSnapshot:null},workspaceLoadSequence:1,billingSequence:0,billingOffset:0,businessBillingOwner:()=>true,supabase:{rpc:()=>({})},query:()=>pending});
  vm.runInContext(extract('async function refreshBusinessBilling','\nfunction invalidateBusinessBillingQuote'),context);
  const request=context.refreshBusinessBilling();context.workspaceLoadSequence=2;context.state.workspace={id:'second'};resolve({subscription:{workspace_id:'first'}});await request;
  assert.equal(context.state.billingSnapshot,null);assert.equal(context.state.workspace.id,'second');
});
test('the newest billing refresh wins when responses return out of order',async()=>{
  const pending=[];
  const context=vm.createContext({Date,state:{workspace:{id:'w'},billingSnapshot:null,locked:false,workspaceEntitlement:{effective_status:'active'}},workspaceLoadSequence:1,billingSequence:0,billingOffset:0,businessBillingOwner:()=>true,supabase:{rpc:()=>({})},query:()=>new Promise(resolve=>pending.push(resolve)),renderSubscription(){},resolveWorkspaceLock(){},renderRoute(){},setClaimMessage(){}});
  vm.runInContext(extract('async function refreshBusinessBilling','\nfunction invalidateBusinessBillingQuote'),context);
  const first=context.refreshBusinessBilling(),second=context.refreshBusinessBilling();
  pending[1]({subscription:{version:2,paid_through_at:'2100-01-01'}});await second;
  pending[0]({subscription:{version:1,paid_through_at:'2000-01-01'}});await first;
  assert.equal(context.state.workspaceSubscription.version,2);assert.equal(context.state.workspaceEntitlement.effective_status,'active');
});
test('the consolidated schema ends with the exact Stage 10 migration',()=>{
  assert.ok(read('supabase/schema.sql').endsWith(read('supabase/migrations/20260930090000_business_stage_10_billing.sql')));
});
