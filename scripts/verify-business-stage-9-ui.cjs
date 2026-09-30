// Actual HTML/CSS/JavaScript, offline RPC fixtures, desktop/mobile verification.
const {readFileSync,mkdirSync}=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES?path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'):'playwright');
const root=path.join(__dirname,'..');
const html=readFileSync(path.join(root,'business.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const source=readFileSync(path.join(root,'business.js'),'utf8').replace(/^import .*;$/m,'').replace(/loadBusinessAccess\(\);\s*$/,'');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox']});
  try{
    for(const width of process.env.MUSHAVO_UI_WIDTHS?process.env.MUSHAVO_UI_WIDTHS.split(',').map(Number):[1366,390,320]){
      const page=await browser.newPage({viewport:{width,height:720}}),errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('http://localhost/**',route=>route.fulfill({contentType:'text/html',body:html}));
      await page.goto('http://localhost/business.html#business/reports');
      await page.addStyleTag({content:readFileSync(path.join(root,'business.css'),'utf8')});
      await page.addScriptTag({content:`window.MUSHAVO_BUDGET_CONFIG={supabaseUrl:'http://localhost',supabasePublishableKey:'fixture'};
        window.rpcCalls=[];window.fixtureVersion=1;
        const base={record_id:'b6f7cc34-012b-49be-8908-bbdeeddbd114',category_id:'category',category_name:'Operating costs',dimension_id:'branch',dimension_name:'Branch A',currency:'USD',reporting_currency:'USD',exchange_rate:1,rate_provider:'identity',rate_effective_at:'2026-09-25T10:00:00Z',event_date:'2026-09-25',person_name:'Member',payment_source:'cash',reference:'fixture',income_value:0,paid_value:0,commitment_value:0,claim_value:0,can_open:false,receipt_state:'not_required'};
        window.fixtureRows=[{...base,entry_key:'income:1',record_type:'income',title:'<img src=x onerror=alert(1)> sale',status:'received',original_amount:120,reporting_amount:120,income_value:120},
          {...base,entry_key:'bill_payment:1',record_type:'bill_payment',title:'Company paid purchase',status:'paid',original_amount:30,reporting_amount:30,paid_value:30,receipt_state:'missing',parent_id:'bill-1'},
          {...base,entry_key:'bill:1',record_type:'bill',title:'Outstanding bill',status:'open',original_amount:10,reporting_amount:10,commitment_value:10,due_state:'overdue'},
          {...base,entry_key:'employee_claim:1',record_type:'employee_claim',title:'Employee cost register',status:'submitted',original_amount:20,reporting_amount:20,claim_value:20,is_reimbursement:true}];
        function selected(a){return fixtureRows.filter(r=>a.p_section==='ledger'?r.income_value+r.paid_value+r.commitment_value>0:a.p_section==='income'?r.income_value>0:a.p_section==='paid'?r.paid_value>0:a.p_section==='committed'?r.commitment_value>0:a.p_section==='actuals'?r.income_value+r.paid_value>0:a.p_section==='employee_claims'?r.record_type==='employee_claim':a.p_section==='missing'?r.receipt_state==='missing':a.p_section==='bills'||a.p_section==='overdue'?r.due_state==='overdue':false)}
        function report(a){return{fingerprint:'fixture-'+fixtureVersion,metadata:{workspace_id:'fixture',workspace_name:'Fixture business',access:'workspace',can_export:true,from:a.p_from,to:a.p_to,mode:a.p_mode,currency:'USD',reporting_currency:'USD',original_currency:a.p_currency,timezone:'Africa/Johannesburg',generated_at:'2026-09-30T05:00:00Z'},currencies:['USD'],summary:{income:120,paid:30,committed:10,due_count:0,overdue_count:1,due_amount:0,overdue_amount:10,missing_count:1,claim_count:1,claimed:20,reimbursed:0,approved_reimbursements:0},categories:[{id:'category',name:'Operating costs',paid:30,committed:10}],dimensions:[{id:'branch',name:'Branch A',paid:30,committed:10}],budgets:a.p_mode==='original'?[]:[{id:'budget',name:'Operations target',planned_amount:50,reporting_currency:'USD',paid:30,committed:10,starts_on:'2026-09-20',ends_on:'2026-10-19',activity_from:'2026-09-20',activity_to:'2026-10-19'}]}}
        window.createClient=()=>({rpc:async(name,a)=>{rpcCalls.push({name,args:a});let data={};
          if(name==='business_report_summary')data=report(a);
          if(name==='business_report_records'||name==='business_report_export'){
            if(a.p_expected_fingerprint!=='fixture-'+fixtureVersion)return{data:null,error:{message:'BUSINESS_REPORT_CHANGED'}};
            const items=selected(a),metadata=report(a).metadata;
            data={...report(a),items,total_count:items.length,metadata,totals:{income:items.reduce((sum,r)=>sum+r.income_value,0),paid:items.reduce((sum,r)=>sum+r.paid_value,0),committed:items.reduce((sum,r)=>sum+r.commitment_value,0),claimed:items.reduce((sum,r)=>sum+r.claim_value,0)},csv:'Record key,Title'+String.fromCharCode(13,10)+'income:1,Safe CSV'+String.fromCharCode(13,10)};
          }
          if(name==='business_transaction_feed')data={items:[],finance_visible:true,income:120,paid:30,committed:10,total_count:0,paid_count:1,reporting_currency:'USD'};
          return{data,error:null};},from:()=>({select(){return this},eq(){return this},in:async()=>({data:[],error:null})})});`});
      await page.addScriptTag({content:source});
      await page.evaluate(`state.session={user:{id:'owner'}};state.workspace={id:'fixture',owner_id:'owner',name:'Fixture business'};
        state.businessProfile={onboarding_status:'complete',period_start_day:20,financial_year_start_month:1};
        state.permissions=new Set(['finance.view_all','reports.view','reports.export']);
        state.workspaceSettings={timezone:'Africa/Johannesburg',reporting_currency:'USD',enabled_currencies:['USD','ZAR']};
        state.businessCategories=[{id:'category',name:'Operating costs',category_type:'expense',status:'active'}];state.businessDimensions=[{id:'branch',name:'Branch A',status:'active'}];
        showOnly('businessApp');prepareBusinessReports();renderRoute();`);
      await page.waitForFunction(()=>state.reportSnapshot || (reportAttempted && !reportLoading));
      assert.ok(await page.locator('#businessReportMetrics [data-report-section="income"]').isVisible(),JSON.stringify(await page.evaluate(()=>({snapshot:state.reportSnapshot,message:document.querySelector('#businessReportMessage').textContent,tab:state.tab,attempted:reportAttempted,loading:reportLoading,calls:rpcCalls})))+' errors '+JSON.stringify(errors));
      assert.match(await page.locator('#businessReportMetrics').textContent(),/\$120\.00/);
      assert.ok(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),'Report overflow at '+width);
      if(process.env.MUSHAVO_UI_SCREENSHOT_DIR){mkdirSync(process.env.MUSHAVO_UI_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:path.join(process.env.MUSHAVO_UI_SCREENSHOT_DIR,'reports-'+width+'.png'),fullPage:true});}
      await page.locator('#reportPeriod').selectOption('custom');
      await page.locator('#reportFrom').fill('2026-09-01');await page.locator('#reportTo').fill('2026-09-30');
      await page.locator('#businessReportFilters button[type="submit"]').click();
      await page.waitForFunction(()=>state.reportSnapshot?.metadata.from==='2026-09-01');
      await page.evaluate(`activityFilters={p_from:'2026-01-01',p_to:'2026-01-31'};refreshTransactions(false)`);
      assert.equal(await page.evaluate(()=>reportFilters.p_from),'2026-09-01','Activity filters changed Reports');
      await page.locator('#businessReportMetrics [data-report-section="income"]').click();
      await page.locator('#businessReportSourcesDialog').waitFor({state:'visible'});
      assert.equal(await page.locator('#reportSourceList article').count(),1);
      assert.equal(await page.locator('#reportSourceList img').count(),0,'Source title was rendered as markup');
      await checkScroll(page,'#businessReportSourcesDialog',width);
      await page.locator('[data-report-entry-key="income:1"]').click();
      await page.locator('#businessReportRecordDialog').waitFor({state:'visible'});
      assert.match(await page.locator('#reportRecordFields').textContent(),/b6f7cc34-012b-49be-8908-bbdeeddbd114/);
      assert.ok(await page.locator('#openReportOriginal').evaluate(node=>node.classList.contains('hidden')));
      await checkScroll(page,'#businessReportRecordDialog',width);
      await page.locator('[data-close-report-record]').click();
      const downloaded=page.waitForEvent('download');await page.locator('#exportReportSourcesCSV').click();
      const file=await downloaded;assert.match(file.suggestedFilename(),/income.*\.csv/);
      assert.equal(await page.evaluate(()=>rpcCalls.filter(x=>x.name==='business_report_export').at(-1).args.p_section),'income');
      const popupReady=page.waitForEvent('popup');await page.locator('#printReportSources').click();const popup=await popupReady;
      await popup.waitForFunction(()=>document.querySelector('h1')?.textContent.includes('Fixture business'));
      assert.match(await popup.locator('body').textContent(),/1 exact source records/);
      assert.match(await popup.locator('body').textContent(),/<img src=x onerror=alert\(1\)> sale/);
      assert.equal(await popup.locator('img').count(),0,'Print title was rendered as markup');
      assert.equal(await popup.locator('button').textContent(),'Print / Save PDF');await popup.close();
      await page.locator('[data-close-report-sources]').click();
      await page.locator('#reportCurrencyMode').selectOption('original');await page.locator('#reportOriginalCurrency').selectOption('USD');
      await page.locator('#businessReportFilters button[type="submit"]').click();
      await page.waitForFunction(()=>state.reportSnapshot?.metadata.mode==='original');
      assert.match(await page.locator('#reportBudgetComparisons').textContent(),/Switch to the reporting view/);
      await page.evaluate('fixtureVersion++');await page.locator('#exportBusinessReportCSV').click();
      await page.waitForFunction(()=>state.reportStale);
      assert.ok(await page.locator('#exportBusinessReportCSV').isDisabled());assert.match(await page.locator('#businessReportMessage').textContent(),/Refresh the report/);
      await page.locator('#refreshBusinessReports').click();await page.waitForFunction(()=>state.reportSnapshot && !state.reportStale && !reportLoading);
      await page.evaluate(`state.permissions.delete('reports.export');renderReportAccess();`);
      assert.ok(await page.locator('#printBusinessReport').isDisabled());
      await page.evaluate(`state.permissions.delete('reports.view');renderReportAccess();`);
      assert.ok(await page.locator('#businessReportControls').evaluate(node=>node.classList.contains('hidden')));
      assert.match(await page.locator('#businessReportMessage').textContent(),/not enabled/);
      await page.evaluate('clearBusinessWorkspaceState()');assert.equal(await page.locator('#businessReportMetrics button').count(),0);
      assert.deepEqual(errors,[],'Browser errors at '+width);
      console.log('PASS '+width+'px: report filters independent of Activity; figures and exact sources; CSV download; safe printable/PDF summary; original currency; stale snapshot refresh; access/export controls; mobile scrolling and workspace clearing');
      await page.close();
    }
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
async function checkScroll(page,selector,width){
  const result=await page.locator(selector).evaluate(dialog=>{dialog.scrollTop=dialog.scrollHeight;return{width:dialog.getBoundingClientRect().width,overflow:dialog.scrollWidth>dialog.clientWidth,scroll:dialog.scrollHeight>dialog.clientHeight,top:dialog.scrollTop}});
  assert.ok(result.width<=width&&!result.overflow,selector+' horizontal overflow at '+width);assert.ok(!result.scroll||result.top>0,selector+' cannot scroll at '+width);
}
