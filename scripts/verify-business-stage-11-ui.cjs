// Runs actual support rendering/action code with offline server responses.
const {readFileSync,mkdirSync}=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));
const root=path.join(__dirname,'..'),source=readFileSync(path.join(root,'app.js'),'utf8'),html=readFileSync(path.join(root,'app.html'),'utf8');
const start=html.indexOf('<dialog id="adminDetailsDialog"'),fragment=html.slice(start,html.indexOf('</dialog>',start)+9);
const rows=source.slice(source.indexOf('function adminDetailRows('),source.indexOf('let adminDetailsSequence'));
const controls=source.slice(source.indexOf('let adminDetailsSequence'),source.indexOf('function openAdminUserDetails('));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});try{
  for(const width of [1366,390,320]){
    const page=await browser.newPage({viewport:{width,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://localhost/**',route=>route.fulfill({contentType:'text/html',body:fragment}));await page.goto('http://localhost/app.html');
    await page.addStyleTag({content:readFileSync(path.join(root,'styles.css'),'utf8')});
    await page.addScriptTag({content:`const $=s=>document.querySelector(s),escapeHtml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
      const titleCase=v=>String(v),formatAdminDate=v=>v?new Date(v).toLocaleDateString():'Not set',adminExpiryCountdown=v=>v?'20 days left':'Not set',showToast=()=>{};
      const state={session:{user:{id:'platform-admin'}},isAdmin:true,adminRole:'super_admin'};window.calls=[];window.delaySupport=false;window.resolveSupport=null;
      window.fixture={workspace:{id:'company',name:'Test Company',owner_id:'owner',status:'active',version:1},subscription:{status:'active',billing_period:'monthly',entitlement_start_at:new Date().toISOString(),paid_through_at:new Date(Date.now()+20*86400000).toISOString()},owner:{name:'Original owner',email:'owner@example.com',account_status:'active'},plan_name:'Business',current_limit:4,invitation_limit:3,usage:2,can_suspend:true,can_transfer:true,pending_payment:false,action_count:22,actions:[{action:'restore',actor_email:'admin@example.com',created_at:new Date().toISOString(),reason:'<img src=x onerror=alert(1)> Verified support history with a long reference '+ 'x'.repeat(100),before_summary:{status:'suspended'},after_summary:{status:'active'}}],members:[{id:'member',user_id:'next',name:'New Owner',email:'next@example.com',account_status:'active',platform_staff:false,role:'staff'}]};
      const supabase={rpc:(name,args)=>{calls.push({name,args});if(name==='admin_business_support_snapshot')return delaySupport?new Promise(resolve=>resolveSupport=()=>resolve(structuredClone(fixture))):Promise.resolve(structuredClone(fixture));if(name==='admin_business_set_status'){fixture.workspace.status=args.p_status;fixture.workspace.version++;return Promise.resolve('action');}if(name==='admin_business_transfer_owner'){fixture.workspace.owner_id='next';fixture.workspace.version++;return Promise.resolve('action');}throw Error(name);}};
      const query=async(label,result)=>await result;${rows}${controls}
      openAdminBusinessSupport('company');`});
    await page.waitForFunction(()=>adminBusinessSupport);assert.equal(await page.locator('#adminDetailsBody img').count(),0);
    assert.ok(await page.evaluate(()=>{const d=document.querySelector('#adminDetailsDialog');return d.scrollWidth<=d.clientWidth+1;}),'support dialog horizontal overflow');
    await page.evaluate(()=>{const d=document.querySelector('#adminDetailsDialog');d.scrollTop=d.scrollHeight;});
    assert.ok(await page.evaluate(()=>{const d=document.querySelector('#adminDetailsDialog');return d.scrollHeight>d.clientHeight && d.scrollTop>0;}),'support dialog must scroll');
    if(process.env.MUSHAVO_UI_SCREENSHOT_DIR){mkdirSync(process.env.MUSHAVO_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MUSHAVO_UI_SCREENSHOT_DIR,`support-${width}.png`)});}
    const status=page.locator('[data-business-support-form="status"]');await status.locator('[name="confirmation_name"]').fill('Test Company');await status.locator('[name="reason"]').fill('Verified support ticket ABC-123');await status.locator('button').click();
    await page.waitForFunction(()=>adminBusinessSupport?.snapshot.workspace.status==='suspended'&&!adminBusinessSupportBusy);
    const call=await page.evaluate(()=>calls.find(c=>c.name==='admin_business_set_status'));assert.equal(call.args.p_expected_version,1);assert.equal(call.args.p_status,'suspended');assert.ok(call.args.p_request_id);
    assert.match(await page.locator('#adminDetailsBody').innerText(),/Restoration keeps account suspensions and subscription expiry in force/);
    const ownership=page.locator('[data-business-support-form="ownership"]');await ownership.locator('[name="member_id"]').selectOption('member');await ownership.locator('[name="confirmation_email"]').fill('next@example.com');await ownership.locator('[name="confirmation_name"]').fill('Test Company');await ownership.locator('[name="reason"]').fill('Verified transfer ticket DEF-456');await ownership.locator('button').click();
    await page.waitForFunction(()=>adminBusinessSupport?.snapshot.workspace.owner_id==='next'&&!adminBusinessSupportBusy);const transfer=await page.evaluate(()=>calls.find(c=>c.name==='admin_business_transfer_owner'));assert.equal(transfer.args.p_expected_owner_id,'owner');assert.equal(transfer.args.p_expected_version,2);assert.equal(transfer.args.p_new_owner_member_id,'member');
    await page.locator('[data-business-support-page="20"]').click();await page.waitForFunction(()=>adminBusinessSupport?.offset===20);
    await page.evaluate(()=>{fixture.pending_payment=true;fixture.workspace.owner_id='owner';renderAdminBusinessSupport(fixture);});assert.equal(await page.locator('[data-business-support-form="ownership"]').count(),0);assert.match(await page.locator('#adminDetailsBody').innerText(),/Resolve the pending subscription payment/);
    for(const role of ['support_staff','finance_staff']){await page.evaluate(role=>{state.adminRole=role;renderAdminBusinessSupport(fixture);},role);assert.equal(await page.locator('[data-business-support-form]').count(),0);}
    await page.evaluate(()=>{state.adminRole='admin_staff';fixture.pending_payment=false;renderAdminBusinessSupport(fixture);});assert.equal(await page.locator('[data-business-support-form="ownership"]').count(),0);assert.equal(await page.locator('[data-business-support-form="status"]').count(),1);
    // A late support response cannot reopen an unrelated details panel.
    await page.evaluate(()=>{delaySupport=true;void openAdminBusinessSupport('company');showAdminDetails({eyebrow:'User',title:'Other details',body:'<p>Other details</p>'});resolveSupport();});await page.waitForFunction(()=>document.querySelector('#adminDetailsDialogTitle').textContent==='Other details');assert.equal(await page.evaluate(()=>adminBusinessSupport),null);
    assert.deepEqual(errors,[]);console.log('PASS '+width+'px: actual support UI, safe audit text, dialog scrolling, role controls, confirmations, paging and stale-response isolation');await page.close();
  }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
