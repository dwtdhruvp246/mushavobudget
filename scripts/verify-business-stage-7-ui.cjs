// Optional offline visual smoke test; requires Playwright and Chromium.
const { readFileSync } = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright') : 'playwright');
const root = path.join(__dirname, '..');
const html = readFileSync(path.join(root, 'business.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
const source = readFileSync(path.join(root, 'business.js'), 'utf8').replace(/^import .*;$/m, '').replace(/loadBusinessAccess\(\);\s*$/, '');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.MUSHAVO_CHROMIUM_EXECUTABLE || undefined, args: ["--no-sandbox"] });
  try {
    for (const width of [1366, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 720 } });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('http://localhost/**', (route) => route.fulfill({ contentType: 'text/html', body: html }));
      await page.goto('http://localhost/business.html#business/activity');
      await page.addStyleTag({ content: readFileSync(path.join(root, 'business.css'), 'utf8') });
      await page.addScriptTag({ content: `window.MUSHAVO_BUDGET_CONFIG={supabaseUrl:'http://localhost',supabasePublishableKey:'fixture'};
        window.createClient=()=>({rpc:async(name,args)=>({data:name==='record_business_income'?{id:args.p_income_id,title:args.p_title,status:'received',amount:args.p_amount,currency:args.p_currency,received_on:args.p_received_on,reference:args.p_reference,payment_source:args.p_payment_source,reporting_amount:args.p_amount,reporting_currency:'USD',exchange_rate:1,rate_provider:'identity',created_at:new Date().toISOString()}: {items:[],finance_visible:true,reporting_currency:'USD',income:120,paid:30,committed:10,paid_count:1,total_count:0},error:null})});` });
      await page.addScriptTag({ content: source });
      await page.evaluate(`state.session={user:{id:'owner'}};state.workspace={id:'fixture',owner_id:'owner',name:'Fixture business'};
        state.businessProfile={onboarding_status:'complete'};state.permissions=new Set(['finance.view_all','finance.create','finance.record_payment']);
        state.workspaceSettings={timezone:'Africa/Johannesburg',enabled_currencies:['USD','ZAR'],reporting_currency:'USD'};
        state.businessCategories=[{id:'income-cat',name:'Sales',status:'active',category_type:'income'}];
        state.financeSummary={finance_visible:true,income:120,paid:30,committed:10,paid_count:1,reporting_currency:'USD'};
        state.activitySummary={...state.financeSummary,total_count:1};state.transactions=[{entry_key:'income:fixture',record_type:'income',title:'Customer sale',event_date:'2026-09-29',status:'received',amount:120,currency:'USD',payment_source:'cash',payer_name:'Customer',reference:'receipt-1'}];
        showOnly('businessApp');populateActivityFilters();renderRoute();renderTransactions();`);
      assert.equal(await page.locator('#businessIncomeTotal').textContent(), '$120.00');
      assert.ok(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `Activity overflow at ${width}`);
      await page.locator('#businessActivityFilters button[type="submit"]').click();
      await page.evaluate('openIncomeForm()');
      assert.ok(await page.locator('#businessIncomeDialog').isVisible());
      await page.locator('#incomeTitle').fill('Received sale');
      await page.locator('#incomeAmount').fill('120');
      await page.locator('#incomeCategory').selectOption('income-cat');
      await page.locator('#incomeSource').selectOption('cash');
      await page.locator('#incomeReference').fill('receipt-1');
      const scroll = await page.locator('#businessIncomeDialog').evaluate((dialog) => { dialog.scrollTop = dialog.scrollHeight; return { canScroll: dialog.scrollHeight > dialog.clientHeight, top: dialog.scrollTop, width: dialog.getBoundingClientRect().width }; });
      assert.ok(scroll.width <= width, `Income width at ${width}`);
      assert.ok(!scroll.canScroll || scroll.top > 0, `Income scroll at ${width}`);
      await page.locator('#businessIncomeForm button[type="submit"]').click();
      await page.locator('#businessIncomeDetailDialog').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#incomeDetailTitle').textContent(), 'Received sale');
      await page.locator('[data-close-income-detail]').click();
      await page.evaluate('openClaimForm("reimbursement")');
      assert.ok(await page.locator('#businessEmployeeSourceField').isVisible());
      assert.ok(await page.locator('#businessEmployeeSource').evaluate((node) => node.required));
      assert.deepEqual(errors, [], `Script errors at ${width}`);
      console.log(`PASS ${width}px: activity filters, income save/detail, responsive scroll, employee source`);
      await page.close();
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
