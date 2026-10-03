// Exercise Save and continue together with the real live-refresh and workspace loaders.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright'));
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'business.html'), 'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').replace(/<link\b[^>]*>/g, '');
const source = fs.readFileSync(path.join(root, 'business.js'), 'utf8').replace(/^import .*;$/m, '').replace(/const supabase = isConfigured[^;]+;/, 'const supabase = window.fixtureSupabase;').replace(/\nloadBusinessAccess\(\);\s*$/, '');
(async () => {
  const browser = await chromium.launch({executablePath: process.env.MUSHAVO_CHROMIUM_EXECUTABLE, args: ['--no-sandbox']});
  try {
    for (const width of [320, 390, 1366]) {
      const page = await browser.newPage({viewport: {width, height: 900}}), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('http://localhost/**', route => route.fulfill({contentType: 'text/html', body: html}));
      await page.goto('http://localhost/business.html');
      await page.addStyleTag({content: fs.readFileSync(path.join(root, 'business.css'), 'utf8')});
      await page.addScriptTag({content: `
        window.setInterval = () => 0; window.events = []; window.rpcCalls = []; window.pendingSave = null;
        window.MushavoPWA = {beginOperation: () => () => {}, markFormClean() {}, hasUnsavedChanges: () => false};
        window.fixtureSupabase = {
          from(table) {
            const q = {select() {return q;}, eq() {return q;}, limit() {return q;}, order() {return q;}, maybeSingle() {return q;},
              then(resolve, reject) {return Promise.resolve({data: window.db[table] ?? []}).then(resolve, reject);}};
            return q;
          },
          rpc: async (name, args) => {
            rpcCalls.push({name, args});
            if (name === 'my_account_suspended') return {data: false};
            if (name === 'effective_workspace_entitlement') return {data: [{effective_status: 'active'}]};
            if (name === 'business_team_snapshot') return {data: {members: [], invitations: []}};
            if (name === 'business_effective_permissions') return {data: []};
            if (name === 'save_business_setup_with_branding') {
              db.business_profiles = {...db.business_profiles, trading_name: args.p_trading_name, version: db.business_profiles.version + 1};
              db.workspace_settings = {...db.workspace_settings, timezone: args.p_timezone, updated_at: new Date().toISOString()};
              db.budget_workspaces = {...db.budget_workspaces, name: args.p_trading_name};
              events.at(-2)({new: {access_version: 5}});
              if (pendingSave) await pendingSave;
              return {data: {profile: db.business_profiles, settings: db.workspace_settings}};
            }
            return {data: []};
          },
          channel() {const c = {on(type, filter, callback) {events.push(callback); return c;}, subscribe() {return c;}}; return c;},
          removeChannel() {}
        };
        ${source}
        refreshBusinessBilling = refreshClaims = refreshBills = async () => {};
        state.session = {user: {id: 'owner'}}; state.profile = {full_name: 'Owner'};
        window.db = {
          budget_workspaces: {id: 'company', name: 'Mushavo Homes', workspace_type: 'business', owner_id: 'owner', status: 'active'},
          workspace_members: {id: 'member', workspace_id: 'company', user_id: 'owner', role: 'business_owner', status: 'active'},
          workspace_subscriptions: [{workspace_id: 'company', status: 'active', paid_through_at: '2099-01-01T00:00:00Z'}],
          business_profiles: {workspace_id: 'company', trading_name: 'Mushavo Homes', version: 1, onboarding_status: 'in_progress', financial_year_start_month: 1, period_start_day: 1},
          workspace_settings: {timezone: 'Africa/Harare', base_currency: 'USD', enabled_currencies: ['USD']},
          business_setup_drafts: null
        };
        state.workspaces = [db.budget_workspaces]; state.memberships = [db.workspace_members];
        state.supportedCurrencies = [{code: 'USD', name: 'US dollar'}];
        window.openFixture = selectBusinessWorkspace('company');
      `});
      await page.evaluate(() => openFixture);
      await page.locator('#setupBusinessName').fill('Mushavo Homes Updated');
      await page.locator('#setupTimezone').selectOption('Asia/Kathmandu');
      await page.locator('#businessBasicsForm button[type=submit]').click();
      await page.waitForFunction(() => !setupBusy);
      await page.evaluate(() => flushBusinessLiveRefresh());
      assert.equal(await page.locator('#onboardingProgress').innerText(), 'Step 2 of 4');
      assert.equal(await page.locator('[data-setup-pane=categories]').isVisible(), true);
      assert.equal(await page.locator('#setupBusinessName').inputValue(), 'Mushavo Homes Updated');
      assert.equal(await page.locator('#setupTimezone').inputValue(), 'Asia/Kathmandu');

      // A slow save must not be invalidated by its own access signal.
      await page.evaluate(() => {showSetupStep('basics'); pendingSave = new Promise(resolve => window.finishSave = resolve);});
      await page.locator('#businessBasicsForm button[type=submit]').click();
      await page.waitForFunction(() => setupBusy && businessLivePending);
      const sequence = await page.evaluate(() => workspaceLoadSequence);
      await page.evaluate(() => flushBusinessLiveRefresh());
      assert.equal(await page.evaluate(() => workspaceLoadSequence), sequence);
      assert.equal(await page.evaluate(() => setupBusy), true);
      await page.evaluate(() => {finishSave(); pendingSave = null;});
      await page.waitForFunction(() => !setupBusy);
      await page.evaluate(() => flushBusinessLiveRefresh());
      assert.equal(await page.locator('#onboardingProgress').innerText(), 'Step 2 of 4');

      // Later steps and explicitly reopened setup survive a same-company refresh.
      await page.evaluate(async () => {setupOpen = true; showSetupStep('tags'); queueBusinessLiveRefresh(true); await flushBusinessLiveRefresh();});
      assert.equal(await page.locator('#onboardingProgress').innerText(), 'Step 3 of 4');
      assert.equal(await page.evaluate(() => setupOpen), true);

      // A different workspace starts with its own first step.
      await page.evaluate(async () => {
        db.budget_workspaces = {...db.budget_workspaces, id: 'second', name: 'Second Company'};
        db.business_profiles = {...db.business_profiles, workspace_id: 'second', trading_name: 'Second Company'};
        state.workspaces.push(db.budget_workspaces);
        await selectBusinessWorkspace('second', {preserveSetup: true});
      });
      assert.equal(await page.locator('#onboardingProgress').innerText(), 'Step 1 of 4');
      assert.equal(await page.evaluate(() => setupOpen), false);
      assert.deepEqual(errors, []);
      console.log('PASS ' + width + 'px: save advances, live refresh preserves progress, slow save finishes, switching companies resets setup');
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
