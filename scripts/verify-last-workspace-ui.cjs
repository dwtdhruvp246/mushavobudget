const { readFileSync } = require('node:fs');
const path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules', 'playwright'));
const root = path.join(__dirname, '..');
const ids = { personal: '11111111-1111-4111-8111-111111111111', family: '22222222-2222-4222-8222-222222222222', business: '33333333-3333-4333-8333-333333333333', legacy: '44444444-4444-4444-8444-444444444444' };
const mock = `export function createClient(){
 const user={id:'owner',email:'owner@example.test',user_metadata:{full_name:'Test Owner'}},session={user,access_token:'fixture'};
 const workspaces=[{id:'${ids.personal}',workspace_type:'personal',owner_id:'owner',name:'Personal',status:'active'},{id:'${ids.family}',workspace_type:'household',owner_id:'owner',legacy_family_id:'${ids.legacy}',name:'Test Family',status:'active'},{id:'${ids.business}',workspace_type:'business',owner_id:'owner',name:'Test Company',status:'active'}];
 const fixtures={profiles:[{id:'owner',email:user.email,full_name:'Test Owner',account_status:'active'}],budget_workspaces:workspaces,families:[{id:'${ids.legacy}',owner_id:'owner',owner_email:user.email,name:'Test Family',currency:'USD'}],workspace_subscriptions:workspaces.map(w=>({workspace_id:w.id,plan_id:'free',status:'active',paid_through_at:'2099-01-01T00:00:00Z'})),workspace_settings:workspaces.map(w=>({workspace_id:w.id,default_payment_currency:'USD',reporting_currency:'USD',enabled_currencies:['USD'],timezone:'Africa/Harare'})),supported_currencies:[{code:'USD',name:'US Dollar',is_active:true}],plans:[{id:'free',code:'free',display_name:'Free',workspace_type:'personal',is_active:true}],workspace_members:[{workspace_id:'${ids.business}',user_id:'owner',role:'business_owner',status:'active'}],business_profiles:[{workspace_id:'${ids.business}',trading_name:'Test Company',onboarding_status:'complete'}]};
 function from(table){let single=false,filters=[];const q=new Proxy({}, {get(_t,name){if(name==='then')return (resolve,reject)=>{let data=fixtures[table]||[];for(const [column,value] of filters)data=data.filter(row=>row[column]===value);return Promise.resolve({data:single?(data[0]||null):data,error:null}).then(resolve,reject);};return (...args)=>{if(name==='maybeSingle'||name==='single')single=true;if(name==='eq')filters.push(args);return q;};}});return q;}
 const rpc=async(name,args)=>({error:null,data:name==='my_account_suspended'?false:name==='effective_workspace_entitlement'?[{plan_code:'free',effective_status:'active',read_only:false,member_limit:4}]:name==='business_team_snapshot'?{members:[],invitations:[],usage:1,member_limit:4}:name==='business_effective_permissions'?[{permission_code:'overview.view',allowed:true},{permission_code:'activity.view',allowed:true}]:name==='business_billing_snapshot'?{history:[],subscription:{status:'active',paid_through_at:'2099-01-01T00:00:00Z'},usage:1,current_limit:4}:name==='workspace_billable_member_count'?1:[]});
 const channel={on(){return this;},subscribe(){return this;}};
 return {auth:{getSession:async()=>({data:{session:window.fixtureSignedOut?null:session}}),getUser:async()=>({data:{user}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from,rpc,realtime:{setAuth(){}},channel:()=>channel,removeChannel(){},functions:{invoke:async()=>({data:{}})}};
}`;
(async () => {
 const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file = pathname === '/app-entry' ? 'app-entry.html' : pathname.slice(1) || 'index.html';
  if (file.includes('..')) {res.writeHead(403).end();return;}
  try {const content=readFileSync(path.join(root,file));const type=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html';res.writeHead(200,{'Content-Type':type});res.end(content);}catch(_){res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});
  for(const width of [390,1366]){
   const context=await browser.newContext({viewport:{width,height:800},serviceWorkers:'block'});
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:mock}));
   await context.route('https://**',route=>route.abort());
   // Last-installed route uses actual session launcher, application DOM and loaders.
   await context.unroute('https://cdn.jsdelivr.net/**');
   await context.route('https://cdn.jsdelivr.net/**',route=>route.fulfill({contentType:'text/javascript',body:mock}));
   let page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/app.html');await page.waitForSelector('#appView:not(.hidden)',{timeout:15000});
   await page.evaluate(id=>{window.MushavoWorkspace.remember('owner',{id,workspace_type:'personal'});},ids.personal);
   await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/app-entry?source=pwa');await page.waitForURL('**/app.html?source=pwa#personal/dashboard');
   await page.waitForSelector('#appView:not(.hidden)');assert.equal(await page.locator('[data-family-selector]').first().inputValue(),'__personal__');
   // Explicit navigation switches and remembers the selected Family; a new page restores it.
   await page.locator('[data-family-selector]').first().selectOption(ids.legacy);
   await page.waitForFunction(id=>window.MushavoWorkspace.read('owner')?.familyId===id,ids.legacy);
   await page.close();page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(origin+'/app-entry?source=pwa');await page.waitForURL('**/app.html?source=pwa#family/dashboard');
   await page.waitForSelector('#appView:not(.hidden)');assert.equal(await page.locator('[data-family-selector]').first().inputValue(),ids.legacy);
   await page.evaluate(id=>window.MushavoWorkspace.remember('owner',{id,workspace_type:'business'}),ids.business);
   await page.goto(origin+'/app-entry?source=pwa');await page.waitForURL('**/business.html?workspace='+ids.business+'#business/overview');
   await page.waitForSelector('#businessApp:not(.hidden)');assert.equal(await page.locator('[data-business-name]').first().innerText(),'Test Company');
   // A notification destination wins over the remembered company.
   await page.goto(origin+'/app.html?source=push#personal/payments');await page.waitForSelector('#appView:not(.hidden)');
   assert.equal(await page.locator('[data-family-selector]').first().inputValue(),'__personal__');
   assert.deepEqual(errors,[]);
   console.log('PASS '+width+'px: real launcher/DOM restores Personal, exact Family and Business across closed pages; explicit Personal link wins');
   await context.close();
  }
 } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
