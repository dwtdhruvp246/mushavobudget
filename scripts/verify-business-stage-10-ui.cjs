// Actual Business HTML/CSS/JavaScript with offline billing responses.
const {readFileSync,mkdirSync}=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules','playwright'));
const root=path.join(__dirname,'..'),html=readFileSync(path.join(root,'business.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const source=readFileSync(path.join(root,'business.js'),'utf8').replace(/^import .*;$/m,'').replace(/loadBusinessAccess\(\);\s*$/,'');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined,args:['--no-sandbox']});try{
  for(const width of [1366,390,320]){
    const page=await browser.newPage({viewport:{width,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('http://localhost/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost/business.html#business/subscription');
    await page.addStyleTag({content:readFileSync(path.join(root,'business.css'),'utf8')});
    await page.addScriptTag({content:`window.MUSHAVO_BUDGET_CONFIG={supabaseUrl:'http://localhost',supabasePublishableKey:'fixture'};
      window.calls=[];window.uploads=[];
      const future=new Date(Date.now()+20*86400000).toISOString(),past=new Date(Date.now()-10*86400000).toISOString();
      window.billingFixture={subscription:{id:'sub',workspace_id:'fixture',plan_id:'plan',status:'active',billing_period:'monthly',entitlement_start_at:past,billing_anchor_at:past,paid_through_at:future,member_limit:4,version:1},settings:{pilot_enabled:true,included_seats:2,currency:'USD',monthly_base:10,annual_base:100,monthly_seat:5,annual_seat:50,payment_instructions:'Bank transfer\\nReference: your invoice'},current_limit:4,invitation_limit:4,usage:2,history:[],history_count:0,suspended:false,pending:false,renewal_scheduled:false,plan_name:'Business'};
      window.createClient=()=>({rpc:async(name,a)=>{calls.push({name,args:a});let data=[];
        if(name==='business_billing_snapshot')data=structuredClone(billingFixture);
        if(name==='effective_workspace_entitlement')data=[{plan_name:'Business',effective_status:billingFixture.suspended?'suspended':billingFixture.subscription.status,paid_through_at:billingFixture.subscription.paid_through_at}];
        if(name==='business_subscription_quote')data={id:'quote-'+calls.length,workspace_id:'fixture',currency:'USD',kind:a.p_kind,billing_period:a.p_billing_period,total_seats:a.p_kind==='extra_seats'?billingFixture.current_limit+a.p_quantity:a.p_quantity,additional_seats:a.p_quantity,included_seats:2,base_amount:a.p_kind==='extra_seats'?0:10,seat_price:5,amount:a.p_kind==='extra_seats'?Number((5*a.p_quantity*2/3).toFixed(2)):15,fraction:2/3,term_start_at:past,term_end_at:future,remaining_seconds:20*86400,term_seconds:30*86400,expires_at:new Date(Date.now()+1800000).toISOString(),payment_instructions:billingFixture.settings.payment_instructions};
        if(name==='submit_business_subscription_payment'){billingFixture.pending=true;billingFixture.history=[{id:a.p_payment_id,invoice_number:'MB-B-TEST',status:'pending_review',created_at:new Date().toISOString(),payment_date:a.p_payment_date,payment_method:a.p_payment_method,reference_number:a.p_reference_number,amount:6.67,currency:'USD',billing_period:'monthly',kind:'extra_seats',total_seats:6,term_start_at:past,term_end_at:future,proofs:a.p_proof_path?[{path:a.p_proof_path,name:a.p_proof_name}]:[]}];billingFixture.history_count=1;data=a.p_payment_id;}
        if(name==='business_team_snapshot')data={members:[],invitations:[],capacity:{},can_manage:false};
        return{data,error:null};},storage:{from:()=>({upload:async(path,file)=>{uploads.push({path,size:file.size,type:file.type});return{data:{path},error:null}},remove:async()=>({data:[],error:null}),createSignedUrl:async(path)=>({data:{signedUrl:'http://localhost/proof'},error:null})})},from:table=>{calls.push({table});const q={select(){return this},eq(){return this},order(){return this},limit(){return this},maybeSingle(){return this},in(){return this},then(resolve){let data=table==='workspace_subscriptions'?[structuredClone(billingFixture.subscription)]:table==='business_profiles'?{onboarding_status:'complete',period_start_day:1,financial_year_start_month:1}:table==='workspace_settings'?{base_currency:'USD',reporting_currency:'USD',timezone:'UTC',enabled_currencies:['USD']}:[];return Promise.resolve({data,error:null}).then(resolve)}};return q;}});`});
    await page.addScriptTag({content:source});
    await page.evaluate(`state.session={user:{id:'owner',email:'owner@example.com'}};state.profile={full_name:'Owner'};state.workspace={id:'fixture',workspace_type:'business',owner_id:'owner',name:'Fixture business',status:'active'};state.workspaces=[state.workspace];state.memberships=[{id:'m',workspace_id:'fixture',user_id:'owner',role:'business_owner',status:'active'}];state.permissions=new Set();state.businessProfile={onboarding_status:'complete',period_start_day:1,financial_year_start_month:1};state.workspaceSettings={timezone:'UTC',reporting_currency:'USD',enabled_currencies:['USD']};state.workspaceSubscription=structuredClone(billingFixture.subscription);state.workspaceEntitlement={effective_status:'active'};showOnly('businessApp');renderBusinessWorkspace();refreshBusinessBilling();`);
    await page.waitForFunction(()=>state.billingSnapshot);await page.locator('#businessBuySeats').click();await page.locator('#businessBillingQuantity').fill('2');await page.locator('#getBusinessBillingQuote').click();
    await page.waitForFunction(()=>billingQuote&&!billingBusy);assert.match(await page.locator('#businessBillingQuoteDetails').innerText(),/\$6.67/);assert.match(await page.locator('#businessBillingQuoteDetails').innerText(),/66.6667%/);
    await page.locator('#businessBillingPaymentMethod').fill('Bank transfer');await page.locator('#businessBillingPaymentReference').fill('<img src=x onerror=alert(1)> payment');
    await page.locator('#businessBillingPaymentProof').setInputFiles({name:'proof.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4 fixture')});
    await page.evaluate(()=>{const d=document.querySelector('#businessBillingDialog');d.scrollTop=d.scrollHeight;});
    assert.ok(await page.evaluate(()=>{const d=document.querySelector('#businessBillingDialog');return d.scrollHeight>d.clientHeight&&d.scrollTop>0;}));
    const overflow=await page.evaluate(()=>{const d=document.querySelector('#businessBillingDialog');return {width:d.clientWidth,scroll:d.scrollWidth,nodes:[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>d.getBoundingClientRect().right).map(e=>[e.tagName,e.id,Math.round(e.getBoundingClientRect().width)])};});assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
    await page.locator('#submitBusinessBillingPayment').click();await page.waitForFunction(()=>state.billingSnapshot?.pending && !billingBusy);
    assert.equal(await page.locator('#businessBuySeats').isDisabled(),true);assert.match(await page.locator('#subscriptionSeats').innerText(),/^4 purchased/);
    assert.equal((await page.evaluate(()=>uploads)).length,1);assert.equal(await page.locator('#businessBillingHistory img').count(),0);
    await page.evaluate(()=>{billingFixture.pending=false;billingFixture.current_limit=6;billingFixture.subscription.member_limit=6;billingFixture.history[0].status='approved';billingFixture.history[0].receipt_number='MBR-B-FIXTURE';});
    await page.locator('#refreshBusinessBilling').click();await page.waitForFunction(()=>state.billingSnapshot.current_limit===6);
    assert.match(await page.locator('#businessBillingHistory').innerText(),/MBR-B-FIXTURE/);
    const popupPromise=page.waitForEvent('popup');await page.locator('[data-billing-receipt]').click();const popup=await popupPromise;await popup.waitForFunction(()=>document.body.textContent.includes('MBR-B-FIXTURE'));assert.equal(await popup.locator('img').count(),0);assert.match(await popup.locator('body').innerText(),/Print \/ Save PDF/);await popup.close();
    await page.locator('#businessBuySeats').click();await page.locator('#getBusinessBillingQuote').click();await page.waitForFunction(()=>billingQuote&&!billingBusy);await page.evaluate(()=>{billingQuote.expires_at=new Date(Date.now()-1000).toISOString();renderBusinessBillingQuote();});assert.equal(await page.locator('#submitBusinessBillingPayment').isDisabled(),true);await page.locator('[data-close-billing-dialog]').click();
    if(process.env.MUSHAVO_UI_SCREENSHOT_DIR){mkdirSync(process.env.MUSHAVO_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MUSHAVO_UI_SCREENSHOT_DIR,`billing-${width}.png`),fullPage:true});}
    // The actual workspace loader takes the locked metadata-only path.
    await page.evaluate(`billingFixture.subscription.status='expired';billingFixture.subscription.paid_through_at=new Date(Date.now()-86400000).toISOString();calls=[];selectBusinessWorkspace('fixture');`);
    await page.waitForFunction(()=>state.locked && state.billingSnapshot);assert.match(await page.locator('#businessLockMessage').innerText(),/operational finance remains locked/);
    assert.equal(await page.locator('[data-open-add]').first().isDisabled(),true);
    const expiredCalls=await page.evaluate(()=>calls);assert.equal(expiredCalls.some(call=>['business_profiles','business_expense_claims','business_categories','business_bills'].includes(call.table)),false);
    await page.evaluate(`state.session.user.id='staff';state.memberships=[{workspace_id:'fixture',user_id:'staff',role:'staff',status:'active'}];calls=[];selectBusinessWorkspace('fixture');`);
    await page.waitForFunction(()=>state.locked&&!state.lockOwner&&document.querySelector('#businessApp').classList.contains('hidden')===false);
    assert.equal((await page.evaluate(()=>calls)).some(call=>call.name==='business_billing_snapshot'),false);assert.equal(await page.locator('#businessBillingHistory').innerText(),'');assert.match(await page.locator('#businessLockMessage').innerText(),/This Business subscription has expired. Contact the Business Owner./);
    await page.evaluate(`state.session.user.id='owner';state.memberships=[{workspace_id:'fixture',user_id:'owner',role:'business_owner',status:'active'}];billingFixture.subscription.status='active';billingFixture.subscription.paid_through_at=new Date(Date.now()+86400000).toISOString();billingFixture.suspended=true;selectBusinessWorkspace('fixture');`);
    await page.waitForFunction(()=>state.lockOwner&&state.billingSnapshot?.suspended);assert.match(await page.locator('#businessLockMessage').innerText(),/cannot remove suspension/);assert.equal(await page.locator('#businessRenewSubscription').isDisabled(),true);
    await page.evaluate(()=>clearBusinessWorkspaceState());assert.equal(await page.locator('#businessBillingHistory').innerText(),'');assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: Owner quotes/payment/proof, unchanged pending capacity, receipt PDF and safe text, expiry lock and metadata-only load, Staff billing privacy, suspension, scrolling and workspace clearing`);await page.close();
  }

  // Admin configuration uses the actual Plans form and its client functions.
  const adminHtml=readFileSync(path.join(root,'app.html'),'utf8'),adminSource=readFileSync(path.join(root,'app.js'),'utf8');
  const start=adminHtml.indexOf('<details class="admin-disclosure" id="businessBillingAdminPanel"'),fragment=adminHtml.slice(start,adminHtml.indexOf('</details>',start)+10);
  const adminFunctions=adminSource.slice(adminSource.indexOf('function renderBusinessBillingAdmin()'),adminSource.indexOf('function resetPlanDefinitionForm()'));
  for(const width of [1366,390,320]){
    const page=await browser.newPage({viewport:{width,height:720}});await page.setContent('<main style="padding:16px;max-width:1000px;margin:auto">'+fragment+'</main>');
    await page.addStyleTag({content:readFileSync(path.join(root,'styles.css'),'utf8')});
    await page.addScriptTag({content:`const $=selector=>document.querySelector(selector);window.savedBilling=null;
      const state={adminRole:'super_admin',adminBusinessBillingSettings:[{plan_id:'business',plan_name:'Business',version:1,currency:'USD',pilot_enabled:false,included_seats:null,monthly_base:null,annual_base:null,monthly_seat:null,annual_seat:null,payment_instructions:''}]};
      const supabase={rpc:(name,args)=>{savedBilling={name,args};return Promise.resolve({data:{},error:null})}};
      const query=async(label,result)=>(await result).data,setSubmitting=()=>{},loadAdminData=async()=>{},renderAdminPlans=()=>{},showToast=()=>{};
      ${adminFunctions}
      renderBusinessBillingAdmin();document.querySelector('details').open=true;$('#businessBillingAdminForm').addEventListener('submit',saveBusinessBillingAdmin);`});
    assert.equal(await page.locator('#businessBillingAdminMonthlyBase').inputValue(),'');assert.equal(await page.locator('#businessBillingAdminAnnualSeat').inputValue(),'');
    await page.locator('#businessBillingAdminSeats').fill('2');await page.locator('#businessBillingAdminMonthlyBase').fill('10');await page.locator('#businessBillingAdminMonthlySeat').fill('0');await page.locator('#businessBillingAdminInstructions').fill('Pilot bank transfer instructions');await page.locator('#businessBillingAdminEnabled').check();await page.locator('#businessBillingAdminForm button').click();
    const saved=await page.evaluate(()=>savedBilling);assert.equal(saved.name,'save_business_billing_settings');assert.equal(saved.args.p_monthly_seat,0);assert.equal(saved.args.p_annual_base,null);assert.equal(saved.args.p_annual_seat,null);assert.equal(saved.args.p_expected_version,1);assert.equal(saved.args.p_pilot_enabled,true);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'admin billing form overflow');
    await page.evaluate(()=>{state.adminRole='finance_staff';renderBusinessBillingAdmin();});assert.equal(await page.locator('#businessBillingAdminPanel').isVisible(),false);
    console.log(`PASS ${width}px: actual admin billing form, unset versus zero prices, versioned settings, Finance role restriction and layout`);await page.close();
  }
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
