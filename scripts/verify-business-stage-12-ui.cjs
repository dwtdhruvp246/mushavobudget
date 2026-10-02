// Two independent browser clients using actual realtime orchestration and styles.
const {readFileSync}=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));
const root=path.join(__dirname,'..'),source=readFileSync(path.join(root,'business.js'),'utf8');
const live=source.slice(source.indexOf('let businessLiveChannel='),source.indexOf('let businessAccessCheckBusy=false;'));
const html=readFileSync(path.join(root,'business.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});try{
for(const width of [1366,390,320]){
const clients=[];
for(const user of ['owner','staff']){
 const page=await browser.newPage({viewport:{width,height:720}});await page.route('http://localhost/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost/business.html');await page.addStyleTag({content:readFileSync(path.join(root,'business.css'),'utf8')});
 await page.addScriptTag({content:`const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];window.events=[];window.removed=[];window.loads=0;window.privateFixture='Initial permitted record';
 const state={workspace:{id:'company'},session:{user:{id:'${user}'}},locked:false,reportSnapshot:null};let workspaceLoadSequence=1,businessAccessCheckBusy=false;
 let brandingBusy=false,setupBusy=false,teamBusy=false,claimBusy=false,billBusy=false,incomeBusy=false,workflowBusy=false,billingBusy=false,reportExportBusy=false,setupOpen=false;
 const supabase={channel:name=>{const c={on(type,filter,callback){events.push({filter,callback});return c;},subscribe(callback){c.status=callback;return c;}};return c;},removeChannel:c=>{removed.push(c);},from:()=>{const q={select(){return q;},eq(){return q;},order(){return q;},maybeSingle(){return q;}};return q;}};
 const query=async()=>[],renderReportAccess=()=>{},refreshBusinessAccessState=async()=>{},selectBusinessWorkspace=async()=>{loads++;},businessBillingOwner=()=>false,refreshBusinessBilling=async()=>{},refreshClaims=async()=>{loads++;$('#businessActivityMessage').textContent=privateFixture;},refreshBills=async()=>{},refreshBusinessTeam=async()=>{},friendlyMessage=e=>e.message,showOnly=()=>{};
 ${live}
 $('#businessApp').classList.remove('hidden');$('#businessLoading').classList.add('hidden');startBusinessRealtime();businessLiveAccessVersion=1;`});clients.push(page);
}
// A change causes both independent devices to re-query; payload fields are ignored.
for(const page of clients)await page.evaluate(()=>{privateFixture='Permitted new record';events[0].callback({new:{access_version:1,amount:'UNTRUSTED FINANCE PAYLOAD'}});});
for(const page of clients){await page.waitForFunction(()=>document.querySelector('#businessActivityMessage').textContent==='Permitted new record');assert.doesNotMatch(await page.locator('#businessApp').innerText(),/UNTRUSTED FINANCE PAYLOAD/);}
const staff=clients[1];await staff.evaluate(()=>{document.querySelector('#businessClaimDialog').showModal();document.querySelector('#businessClaimTitle').value='Unsaved supermarket purchase';privateFixture='Later permitted record';events[0].callback({new:{access_version:1}});});await staff.waitForFunction(()=>businessLivePending&&!businessLiveBusy);assert.equal(await staff.locator('#businessClaimTitle').inputValue(),'Unsaved supermarket purchase');assert.match(await staff.locator('#businessLiveMessage').innerText(),/Open forms are kept/);await staff.evaluate(()=>document.querySelector('#businessClaimDialog').close());await staff.waitForFunction(()=>document.querySelector('#businessActivityMessage').textContent==='Later permitted record');
await staff.evaluate(()=>{stopBusinessRealtime();workspaceLoadSequence++;state.workspace={id:'second-company'};startBusinessRealtime();events[0].callback({new:{access_version:99}});});assert.equal(await staff.evaluate(()=>businessLivePending),false);assert.equal(await staff.evaluate(()=>removed.length),1);assert.equal(await staff.evaluate(()=>events.at(-1).filter.filter),'workspace_id=eq.second-company');
for(const page of clients)await page.close();console.log('PASS '+width+'px: two independent clients receive counter events, re-query permitted data, preserve drafts and reject old-workspace callbacks');
}
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
