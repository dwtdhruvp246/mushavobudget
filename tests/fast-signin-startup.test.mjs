import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const part=(start,end)=>{const a=source.indexOf(start),b=source.indexOf(end,a);assert(a>=0&&b>a);return source.slice(a,b);};
const A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
function fixture(options={}){
 const calls=[],overrides=new Map(Object.entries(options.responses||{})),workspace={id:'personal',workspace_type:'personal',owner_id:A,status:'active',currency:'USD'};
 const defaults={'workspace load':[workspace],'workspace load after provision':[workspace],'plan catalogue load':[{code:'free'}],
  'workspace subscription load':[{workspace_id:'personal',member_limit:1}],'workspace entitlement load':[{plan_code:'free'}],
  'workspace seat usage load':1,'workspace member capacity load':[{member_limit:1}],
  'workspace currency settings load':{default_payment_currency:'USD'},'exchange rate status load':{},
  'personal payment plan access':[{payment_item_id:'item',plan_paused:false}],
  'payment items load':[{id:'item',visibility:'personal'}],'payment records load':[{id:'record'}]};
 const request=new Proxy({}, {get:()=>()=>request});let allowed=options.allowed!==false;
 const c={Promise,Error,URL,performance:{now:()=>0},console:{info(){},warn(){}},authDataEpoch:0,
  startupWorkspacePreference:null,startupWorkspaceUnavailable:false,
  state:{session:{user:{id:A,email:'owner@example.invalid'},access_token:'synthetic-token'},isAdmin:!!options.admin,
   family:null,workspaces:[],headApproval:null,familyTab:'dashboard',adminTab:'dashboard',plans:[]},
  window:{location:{href:'https://mushavo-budget-staging.pages.dev/app.html',replace:()=>calls.push('navigate'),assign:()=>calls.push('navigate')},
   localStorage:{getItem:()=>null},history:{replaceState(){}},MushavoWorkspace:{
    hydrate:async()=>{calls.push('hydrate');return options.hydrate;},startup:()=>null}},
  supabase:{from:()=>request,rpc:()=>request},assertSupabase(){},
  emailEntry:{async ensure(){calls.push('session-check');return allowed;},ticket(){const epoch=c.authDataEpoch,token=c.state.session?.access_token;return()=>allowed&&c.authDataEpoch===epoch&&c.state.session?.access_token===token;}},
  adminSession:{authorized:options.adminAllowed!==false},
  async blockUnfinishedAdminInvitationSession(){calls.push('invitation-check');return options.invitation??false;},
  async query(label){calls.push(label);const result=overrides.has(label)?overrides.get(label):label==='account status load'?false:defaults[label]??[];if(result instanceof Error)throw result;return await result;},
  ensureProfile:async()=>calls.push('profile'),loadInvitations:async()=>calls.push('invitations'),
  loadAccess:async()=>{calls.push('role-check');return true;},loadNotifications:async()=>calls.push('notifications'),
  ensureAdminAssurance:async()=>{calls.push('admin-check');return options.adminAllowed!==false;},loadAdminData:async()=>calls.push('admin-data'),
  persistSelectedFamily:()=>calls.push('family-selected'),selectedFamilyStorageKey:()=> 'synthetic-family',
  currentBudgetWorkspace:()=>c.state.workspaces.find(x=>x.id===(c.state.family?.id||'personal')),
  populateWorkspaceCreationCurrencySelects:()=>calls.push('catalogue-committed'),
  routeFromHash:()=>({area:'personal'}),syncRouteForWorkspace:()=>calls.push('route'),
  setView:x=>calls.push('view:'+x),renderFamilyApp:()=>calls.push('render'),renderAdmin:()=>calls.push('admin-render'),
  handleNotificationDeepLink:async()=>{},startRealtime:()=>calls.push('realtime'),schedulePushNotificationRefresh(){},recordVisibleActivity:async()=>{},
  rememberBudgetWorkspace(){},renderNotifications(){},renderInvitations(){},showToast(){},
  loadCashbookData:async()=>{},loadUserSupportData:async()=>{}}
 ;
 vm.createContext(c);
 for(const [start,end]of [
  ['async function loadApp()','async function ensureProfile()'],
  ['async function loadFamily()','function selectedFamilyStorageKey()'],
  ['async function loadFamilyFinancialData(','function isPlanPaused('],
  ['async function loadPaymentRecords()','async function loadInvitations()'],
  ['async function loadWorkspaceSubscriptionData(','async function loadAdminData(']
 ])vm.runInContext(part(start,end),c);
 return{c,calls,overrides,deny(){allowed=false;},replaceToken(){c.state.session={...c.state.session,access_token:'replacement-token'};c.authDataEpoch++;}};
}
test('no startup request runs before a valid server session',async()=>{
 const h=fixture({allowed:false});await h.c.loadApp();assert.deepEqual(h.calls,['session-check']);
});
test('invitation, account status and local preference checks overlap but gate every application load',async()=>{
 const invite=deferred(),status=deferred(),preference=deferred();
 const h=fixture({invitation:invite.promise,hydrate:preference.promise,responses:{'account status load':status.promise}}),opening=h.c.loadApp();await tick();
 for(const label of ['invitation-check','account status load','hydrate'])assert(h.calls.includes(label));
 assert(!h.calls.includes('role-check'));assert(!h.calls.includes('workspace load'));
 invite.resolve(false);status.resolve(false);await tick();assert(!h.calls.includes('role-check'));
 preference.resolve();await opening;assert(h.calls.includes('view:app'));
});
test('unfinished invitation or suspended account cannot reach workspace reads or provisioning',async()=>{
 for(const options of [{invitation:true},{responses:{'account status load':true}}]){
  const h=fixture(options);await h.c.loadApp();assert(!h.calls.includes('role-check'));assert(!h.calls.includes('workspace load'));assert(!h.calls.includes('view:app'));
 }
});
test('a failed parallel gate still fails closed before protected startup',async()=>{
 const h=fixture({responses:{'account status load':new Error('STATUS_FAILED')}});await assert.rejects(h.c.loadApp(),/STATUS_FAILED/);
 assert(!h.calls.includes('workspace load'));assert(!h.calls.includes('view:app'));
});
test('catalogue reads start while families are loading, and reconciliation waits for family selection',async()=>{
 const families=deferred();const h=fixture({responses:{'families load':families.promise}}),opening=h.c.loadApp();await tick();
 assert(h.calls.includes('workspace load'));assert(h.calls.includes('plan catalogue load'));
 assert(!h.calls.includes('catalogue-committed'));assert(!h.calls.includes('workspace subscription load'));assert(!h.calls.includes('view:app'));
 families.resolve([]);await opening;assert(h.calls.indexOf('family-selected')<h.calls.indexOf('workspace subscription load'));assert(h.calls.includes('view:app'));
});
test('one personal-plan check runs alongside subscriptions and dashboard waits for all essential data',async()=>{
 const subscription=deferred(),plan=deferred(),records=deferred();const h=fixture({responses:{'workspace subscription load':subscription.promise,'personal payment plan access':plan.promise,'payment records load':records.promise}}),opening=h.c.loadApp();await tick();
 assert.equal(h.calls.filter(x=>x==='personal payment plan access').length,1);assert(h.calls.includes('workspace subscription load'));assert(!h.calls.includes('view:app'));
 plan.resolve([{payment_item_id:'item',plan_paused:true}]);subscription.resolve([{workspace_id:'personal'}]);await tick();assert(!h.calls.includes('view:app'));
 records.resolve([{id:'fresh-record'}]);await opening;assert(h.calls.includes('view:app'));assert.equal(h.c.state.personalPlanAccess[0].plan_paused,true);assert.equal(h.c.state.paymentRecords[0].id,'fresh-record');assert.equal(h.calls.filter(x=>x==='personal payment plan access').length,1);
});
test('failed family selection cannot provision a workspace after catalogue prefetch completes',async()=>{
 const families=deferred();const h=fixture({responses:{'families load':families.promise,'workspace load':[]}}),opening=h.c.loadApp();await tick();families.reject(Error('FAMILY_FAILED'));
 await assert.rejects(opening,/FAMILY_FAILED/);await tick();assert(!h.calls.includes('personal workspace provision'));assert(!h.calls.includes('catalogue-committed'));assert(!h.calls.includes('view:app'));
});
test('missing Personal workspace is provisioned only after successful family selection',async()=>{
 const families=deferred();const h=fixture({responses:{'families load':families.promise,'workspace load':[]}}),opening=h.c.loadApp();await tick();assert(!h.calls.includes('personal workspace provision'));
 families.resolve([]);await opening;assert.equal(h.calls.filter(x=>x==='personal workspace provision').length,1);assert(h.calls.indexOf('family-selected')<h.calls.indexOf('personal workspace provision'));assert(h.calls.includes('view:app'));
});
test('account or token replacement during family wait discards the prefetched catalogue',async()=>{
 const family=deferred();const h=fixture();const opening=h.c.loadWorkspaceSubscriptionData({familyReady:family.promise,includePersonalPlanAccess:true});await tick();h.replaceToken();family.resolve();
 await assert.rejects(opening,error=>error.code==='session_changed');assert.equal(h.c.state.workspaces.length,0);assert(!h.calls.includes('personal workspace provision'));assert(!h.calls.includes('workspace subscription load'));
});
test('subscription failure and mid-load revocation never reveal a dashboard',async()=>{
 const h=fixture({responses:{'workspace subscription load':new Error('SUBSCRIPTION_FAILED')}});await assert.rejects(h.c.loadApp(),/SUBSCRIPTION_FAILED/);assert(!h.calls.includes('view:app'));
 const waiting=deferred(),g=fixture({responses:{'workspace subscription load':waiting.promise}}),opening=g.c.loadApp();await tick();g.deny();waiting.resolve([]);await assert.rejects(opening,error=>error.code==='session_changed');assert(!g.calls.includes('view:app'));
});
test('Admin startup still requires its separate current server-role check',async()=>{
 const h=fixture({admin:true,adminAllowed:false});await h.c.loadApp();assert(h.calls.includes('admin-check'));assert(!h.calls.includes('admin-data'));assert(!h.calls.includes('view:admin'));
 const g=fixture({admin:true});await g.c.loadApp();assert(g.calls.indexOf('admin-check')<g.calls.indexOf('admin-data'));assert(g.calls.includes('view:admin'));assert(!g.calls.includes('workspace load'));
});
test('ordinary payment refreshes retain their plan check while startup can supply the parallel check',async()=>{
 const h=fixture();h.c.state.workspaces=[{id:'personal',owner_id:A,workspace_type:'personal',status:'active'}];
 await h.c.loadPaymentItems();assert.equal(h.calls.filter(x=>x==='personal payment plan access').length,1);
 await h.c.loadPaymentItems({includePlanAccess:false});assert.equal(h.calls.filter(x=>x==='personal payment plan access').length,1);
});
