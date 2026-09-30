// Offline browser checks of the actual Stage 8 screens with controlled RPC responses.
const { readFileSync, mkdirSync } = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = path.join(__dirname, '..');
const html = readFileSync(path.join(root, 'business.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
const source = readFileSync(path.join(root, 'business.js'), 'utf8').replace(/^import .*;$/m, '').replace(/loadBusinessAccess\(\);\s*$/, '');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined, args: ['--no-sandbox'] });
  try {
    for (const width of [1366, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 720 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('http://localhost/**', (route) => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto('http://localhost/business.html#business/budgets');
      await page.addStyleTag({ content: readFileSync(path.join(root, 'business.css'), 'utf8') });
      await page.addScriptTag({ content: `window.MUSHAVO_BUDGET_CONFIG={supabaseUrl:'http://localhost',supabasePublishableKey:'fixture'};
        window.fixtureRequests=[];window.fixtureBudgets=[];window.rpcCalls=[];
        window.createClient=()=>({rpc:async(name,a)=>{
          rpcCalls.push({name,args:a});let data={};
          if(name==='save_business_spending_request'){data={id:a.p_request_id,version:1,status:'draft',submitted_by:'owner',title:a.p_title,description:a.p_description,category_id:a.p_category_id,dimension_id:a.p_dimension_id,amount:a.p_amount,currency:a.p_currency,reporting_amount:a.p_amount,reporting_currency:'USD',planned_on:a.p_planned_on};fixtureRequests.push(data);}
          if(name==='business_request_feed')data={items:fixtureRequests,total_count:fixtureRequests.length,review_count:0};
          if(name==='business_request_detail')data={request:fixtureRequests.find(x=>x.id===a.p_request_id),bill_id:null,history:[{action:'request.saved',created_at:'2026-09-30T08:00:00Z'}]};
          if(name==='transition_business_request'){data=fixtureRequests.find(x=>x.id===a.p_request_id);data.status=a.p_action==='submit'?'submitted':a.p_action;data.version++;}
          if(name==='save_business_budget'){data={id:a.p_budget_id,version:1,status:'draft',name:a.p_name,planned_amount:a.p_planned_amount,reporting_currency:'USD',starts_on:a.p_starts_on,ends_on:a.p_ends_on,period_type:a.p_period_type,category_id:a.p_category_id,dimension_id:a.p_dimension_id};fixtureBudgets.push(data);}
          if(name==='business_budget_feed')data={items:fixtureBudgets.map(x=>({...x,totals:{paid:500,committed:650}})),total_count:fixtureBudgets.length,warning_count:1};
          if(name==='business_budget_detail')data={budget:fixtureBudgets.find(x=>x.id===a.p_budget_id),totals:{paid:500,committed:650,source_count:12},items:Array.from({length:12},(_,i)=>({record_id:'source-'+i,title:'Supplier purchase '+i,record_type:'bill_payment',event_date:'2026-09-28',amount:100,currency:'USD',reporting_amount:100,paid_value:100}))};
          if(name==='transition_business_budget'){data=fixtureBudgets.find(x=>x.id===a.p_budget_id);data.status=a.p_status;data.version++;}
          if(name==='business_transaction_feed')data={items:[],finance_visible:true,income:0,paid:500,committed:650,paid_count:1,total_count:0,reporting_currency:'USD'};
          return{data,error:null};
        },from:()=>({select(){return this},eq(){return this},in:async()=>({data:[],error:null})})});` });
      await page.addScriptTag({ content: source });
      await page.evaluate(`state.session={user:{id:'owner'}};state.workspace={id:'fixture',owner_id:'owner',name:'Fixture business'};
        state.businessProfile={onboarding_status:'complete',period_start_day:20};
        state.permissions=new Set(['finance.view_all','finance.create','approvals.review','budgets.view','budgets.manage']);
        state.workspaceSettings={timezone:'Africa/Johannesburg',enabled_currencies:['USD','ZAR'],reporting_currency:'USD'};
        state.businessCategories=[{id:'expense-cat',name:'Operations',status:'active',category_type:'expense'}];
        state.businessDimensions=[{id:'branch-a',name:'Branch A',status:'active'}];
        showOnly('businessApp');renderRoute();renderPlanning();`);
      await page.locator('#createBusinessBudget').click();
      await page.locator('#budgetName').fill('Operating target');
      await page.locator('#budgetAmount').fill('1000');
      await page.locator('#budgetMonth').fill('2026-09');
      assert.equal(await page.locator('#budgetStart').inputValue(), '2026-09-20');
      assert.equal(await page.locator('#budgetEnd').inputValue(), '2026-10-19');
      await checkScroll(page, '#businessBudgetDialog', width);
      await page.locator('#businessBudgetForm button[type="submit"]').click();
      await page.locator('#businessBudgetDetailDialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#budgetDetailFields').textContent(), /-\$150\.00/);
      await checkScroll(page, '#businessBudgetDetailDialog', width);
      await page.locator('[data-budget-action="active"]').click();
      await page.waitForFunction(() => fixtureBudgets[0].status === 'active');
      await page.locator('[data-budget-action="closed"]').waitFor();
      assert.equal(await page.locator('#businessBudgetList .over').count(), 1);
      await page.locator('[data-close-budget-detail]').click();
      if (process.env.MUSHAVO_UI_SCREENSHOT_DIR) {
        mkdirSync(process.env.MUSHAVO_UI_SCREENSHOT_DIR,{recursive:true});
        await page.screenshot({path:path.join(process.env.MUSHAVO_UI_SCREENSHOT_DIR,'budgets-'+width+'.png'),fullPage:true});
      }
      assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Budget page overflow at '+width);
      await page.evaluate('openRequestForm()');
      await page.locator('#requestTitle').fill('Supermarket supplies');
      await page.locator('#requestDescription').fill('Supplies for our branch');
      await page.locator('#requestAmount').fill('50');
      await page.locator('#requestCategory').selectOption('expense-cat');
      await checkScroll(page, '#businessRequestDialog', width);
      await page.locator('#businessRequestForm button[type="submit"]').click();
      await page.locator('#businessRequestDetailDialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#requestDetailTitle').textContent(), 'Supermarket supplies');
      await page.locator('[data-request-action="submit"]').click();
      await page.waitForFunction(() => fixtureRequests[0].status === 'submitted');
      await page.waitForFunction(() => !workflowBusy);
      assert.equal(await page.locator('[data-request-action="approved"]').count(), 0, 'Owner must not review own request');
      await page.locator('[data-close-request-detail]').click();
      await page.evaluate(`state.session.user.id='reviewer';state.workspace.owner_id='someone-else';openRequestDetail(fixtureRequests[0].id)`);
      await page.locator('[data-request-action="changes_requested"]').waitFor();
      await page.locator('[data-request-action="changes_requested"]').click();
      assert.ok(await page.locator('#requestDecisionForm').isVisible(), JSON.stringify(await page.evaluate(()=>({busy:workflowBusy,item:openedRequest,classes:document.querySelector('#requestDecisionForm').className}))));
      assert.ok(await page.locator('#requestDecisionReason').evaluate(node=>node.required));
      await page.locator('#requestDecisionReason').fill('Please itemize the purchase');
      await page.locator('#requestDecisionForm button[type="submit"]').click();
      await page.waitForFunction(() => fixtureRequests[0].status === 'changes_requested' && !workflowBusy);
      assert.equal(await page.evaluate(() => rpcCalls.find(x=>x.name==='transition_business_request' && x.args.p_action==='changes_requested').args.p_reason), 'Please itemize the purchase');
      await page.locator('[data-close-request-detail]').click();
      await page.evaluate(`state.permissions=new Set(['finance.create']);state.memberScopes=[];renderPlanning();location.hash='#business/approvals';renderRoute();`);
      assert.ok(await page.locator('#businessWorkflowPermissions').evaluate(node=>node.classList.contains('hidden')));
      assert.equal(await page.locator('#businessBudgetWarningCount').textContent(), 'Private');
      assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), 'Approvals overflow at '+width);
      await page.evaluate('clearBusinessWorkspaceState()');
      assert.equal(await page.locator('#businessBudgetList article, #businessRequestList article').count(), 0);
      assert.deepEqual(errors, [], 'Script errors at '+width);
      console.log('PASS '+width+'px: request save/review/reasons, self-review hidden, monthly budget/save/activation/over-target, scoped privacy, scrolling, workspace clearing');
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});

async function checkScroll(page, selector, width) {
  const result = await page.locator(selector).evaluate(dialog=>{
    dialog.scrollTop=dialog.scrollHeight;
    return {canScroll:dialog.scrollHeight>dialog.clientHeight,top:dialog.scrollTop,width:dialog.getBoundingClientRect().width,overflow:dialog.scrollWidth>dialog.clientWidth};
  });
  assert.ok(result.width<=width && !result.overflow, selector+' horizontal overflow at '+width);
  assert.ok(!result.canScroll || result.top>0, selector+' cannot scroll at '+width);
}
