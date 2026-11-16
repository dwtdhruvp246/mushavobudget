import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from '../fixtures/staging-browser-tools/node_modules/playwright/index.mjs';

const source = new URL('../../', import.meta.url);
const origin = 'https://mushavo-settings-test.invalid';
const files = new Map([
  ['/app.html', 'text/html'], ['/business.html', 'text/html'], ['/styles.css', 'text/css'],
  ['/business.css', 'text/css'], ['/auth.html', 'text/html'], ['/auth-flows.js', 'application/javascript'],
  ['/session-entry.js', 'application/javascript'], ['/auth-security.js', 'application/javascript'],
  ['/config.js', 'application/javascript']
]);
const cases = [
  { name: 'Personal and Family', file: '/app.html', area: '#appView', selector: '[data-family-panel="settings"]', returnTo: '/app.html#personal/settings' },
  { name: 'Admin', file: '/app.html', area: '#adminView', selector: '[data-admin-panel="settings"]', returnTo: '/app.html#admin/settings' },
  { name: 'Business', file: '/business.html', area: '#businessApp', selector: '[data-business-panel="settings"]', returnTo: '/business.html#business/settings' }
];
const businessSource = await readFile(new URL('business.js', source), 'utf8');
const renderRoute = businessSource.slice(businessSource.indexOf('function renderRoute()'), businessSource.indexOf('function renderBusinessWorkspace()'));
function checkBusinessRoute({ tab, locked, lockOwner, needsSetup, expected, showPanel, hideWorkspaceSettings }) {
  const elements = new Map();
  const element = () => ({
    classList: {
      hidden: false,
      toggle(_class, value) { this.hidden = value; },
      add() { this.hidden = true; },
      remove() { this.hidden = false; }
    }
  });
  const node = selector => {
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  };
  const panels = ['overview','subscription','settings','reports'].map(businessPanel => ({
    ...element(), dataset: { businessPanel }
  }));
  const state = { locked, lockOwner, workspace: { id:'test' }, businessProfile: { onboarding_status: needsSetup ? 'draft' : 'complete' } };
  runInNewContext(renderRoute + '\nrenderRoute();', {
    $:node, $$: selector=>selector.includes('business-panel') ? panels : [],
    state, currentTab:()=>tab, businessOwnerCanSetUp:()=>needsSetup, setupOpen:false, setupStep:1, showSetupStep(){},
    TAB_COPY: Object.fromEntries(panels.map(panel=>[panel.dataset.businessPanel,['','Settings','']])),
    window: {location: {hash:'#business/'+tab}}, document:{}, setWorkspaceUrl(){}
  });
  assert.equal(state.tab,expected);
  assert.equal(!panels.find(panel=>panel.dataset.businessPanel===expected).classList.hidden,showPanel);
  if (expected==='settings') assert.equal(node('#businessWorkspaceSettings').classList.hidden,hideWorkspaceSettings);
}
for (const role of [true,false]) {
  checkBusinessRoute({tab:'settings',locked:true,lockOwner:role,expected:'settings',showPanel:true,hideWorkspaceSettings:true});
  checkBusinessRoute({tab:'reports',locked:true,lockOwner:role,expected:role?'subscription':'overview',showPanel:role});
}
checkBusinessRoute({tab:'settings',locked:false,needsSetup:true,expected:'settings',showPanel:true,hideWorkspaceSettings:true});
checkBusinessRoute({tab:'settings',locked:false,needsSetup:false,expected:'settings',showPanel:true,hideWorkspaceSettings:false});

const browser = await chromium.launch({ headless:true });
let checked = 0;
try {
  for (const width of [360, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, serviceWorkers:'block' });
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js')) {
        return route.fulfill({ contentType:'application/javascript', body:'export const createClient=()=>({auth:{getSession:async()=>({data:{session:null}})}})' });
      }
      const type = url.origin === origin && files.get(url.pathname);
      if (!type) return route.abort();
      const data = await readFile(new URL(url.pathname.slice(1), source));
      return route.fulfill({ contentType:type, body:data });
    });
    for (const item of cases) {
      const page = await context.newPage();
      await page.goto(origin+item.file,{waitUntil:'domcontentloaded'});
      assert.equal(await page.locator('a[href*="flow=account"]:not(.account-security-setting a), a[href*="flow=change"]:not(.account-security-setting a)').count(), 0);
      assert.equal(await page.locator(item.selector+' .account-security-settings').count(),1);
      // Expose the selected test screen without a Supabase sign-in.
      await page.locator(item.area).evaluate(element=>{
        document.querySelector('#loadingView, #businessLoading')?.classList.add('hidden');
        element.classList.remove('hidden');
      });
      await page.locator(item.selector).evaluate(element=>{
        element.closest('.content-shell')?.classList.remove('hidden');
        element.classList.remove('hidden');
        element.parentElement.classList.remove('hidden');
      });
      const card = page.locator(item.selector+' .account-security-settings');
      await card.getByRole('heading',{name:'Account security',exact:true}).waitFor({state:'visible',timeout:4500});
      for (const name of ['Change password','Manage deletion requests']) {
        const link = card.getByRole('link',{name,exact:true});
        await link.waitFor({state:'visible',timeout:4500});
        const clean = await link.evaluate(element=>{
          const {left,right,width}=element.getBoundingClientRect();
          return left>=-1 && right<=window.innerWidth+1 && width>0;
        });
        assert.ok(clean, `${item.name} ${name} overflows at ${width}px`);
      }
      const link = card.getByRole('link',{name:'Manage deletion requests',exact:true});
      await link.click({timeout:4500});
      const back = page.getByRole('button',{name:'Back to settings',exact:true});
      await back.waitFor({state:'visible',timeout:4500});
      await back.click();
      await page.waitForURL(origin+item.returnTo,{timeout:4500});
      checked++;
      await page.close();
    }
    await context.close();
  }
  const js = await readFile(new URL('app.js', source),'utf8');
  assert.match(js,/const adminTabs = new Set\(\[.*"settings"\]\)/);
  assert.match(js,/destination\.searchParams\.set\("from", `\$\{budgetRouteArea\(\)\}-settings`\)/);
  const auth = await readFile(new URL('auth-flows.js', source),'utf8');
  assert.match(auth,/\['family-settings', '\.\/app\.html#family\/settings'\]/);
  console.log(JSON.stringify({responsive_workspace_cases:checked,settings_navigation:'passed',business_lock_routes:6,fixed_return_routes:'passed'}));
} finally {
  await browser.close();
}
