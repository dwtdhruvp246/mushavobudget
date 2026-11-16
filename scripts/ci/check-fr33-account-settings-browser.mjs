import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  API_ORIGIN, WEB_ORIGIN, apiTransport, checkStagingAccess, need, privateAccounts, readPublicConfiguration
} from './staging-access.mjs';

const verifiedHostedTargets = {
  preview: 'https://7106e2c5.mushavo-budget-staging.pages.dev',
  canonical: WEB_ORIGIN
};
const deployedAssetHashes = {
  "/app": "914ac7337a632d71ade8ed8341fa6d1f248ee555fd7372f3b4948a78e4470a7f",
  "/app.js": "7277c26175f2b0e5b8fa1eff47fb2e8c206984f1cd8dcfa9aa7d893c36502308",
  "/auth": "1e6709a0827d1419f6e98b4db6792b20368f7b36aab7684b067fbfcd039d3f83",
  "/auth-flows.js": "6047de0c73e770ef7c5b3cb5b35d5f02abf1c8c6e1254ffb3d7f52e26558d1f1",
  "/business": "1bdb7ac1df770528fc105637918a7d7eb429415ee34f1bf8f0e104a4c2eda292",
  "/business.js": "8166bf5efa83cc4d2d7dc19bddddc017ae8a8479e1c6b9616f3071444cf38111",
  "/business.css": "8c61e8e16848f04e0795eda892c64bf65d8637b260356f4526877990829eff7c",
  "/styles.css": "5297acddf4caa776d0bba4e00ca6753499631c690267e7771e48e50af5e11e94",
  "/config.js": "be23e23251470da5a1caa5c19f9af46763aa9192dee62e96700c317c479cc74c"
};
const target = process.env.MUSHAVO_FR33_BROWSER_TARGET || 'candidate';
const origin = verifiedHostedTargets[target] || WEB_ORIGIN;
const hosted = target !== 'candidate';
const accountPath = hosted ? '/auth' : '/auth.html';
const agent = 'MushavoBudget-FR33-Browser-Acceptance';
const browserKey = 'sb-dczlddwbtgvfdujgcitb-auth-token';
const scope = { accountScope: 'ordinary' };
const statusPath = '/rest/v1/rpc/fr33_account_deletion_status';
const requestPath = '/rest/v1/rpc/fr33_submit_account_deletion';
const impactPath = '/rest/v1/rpc/fr33_account_deletion_impact';
const cancelPath = '/rest/v1/rpc/fr33_cancel_account_deletion';
const allowedPost = new Set([statusPath, impactPath, requestPath, cancelPath, '/rest/v1/rpc/app_session_status']);

let report = { result: 'FR33_BROWSER_PREFLIGHT_FAILED', exit_code: 1 };
let step = 'READ_STAGING_CONFIGURATION';
let hostedAssetsVerified = false;
try {
  need(!hosted || Object.hasOwn(verifiedHostedTargets, target), 'FR33_UNKNOWN_BROWSER_TARGET');
  const readHosted = path => fetch(origin + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
  const response = await readHosted('/config.js');
  need(response.ok, 'FR33_STAGING_CONFIGURATION_UNAVAILABLE');
  const configBytes = Buffer.from(await response.arrayBuffer());
  if (hosted) {
    step = 'VERIFY_DEPLOYED_ASSETS_AND_HEADERS';
    const files = Object.entries(deployedAssetHashes);
    const hash = bytes => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
    const [retiredRoute] = await Promise.all([
      readHosted('/api/email-verification/status'),
      ...files.map(async ([path, expected]) => {
        const asset = path === '/config.js' ? response : await readHosted(path);
        need(asset.ok && asset.headers.get('x-content-type-options') === 'nosniff', 'FR33_HOSTED_ASSET_UNAVAILABLE');
        const bytes = path === '/config.js' ? configBytes : await asset.arrayBuffer();
        need(hash(bytes) === expected, 'FR33_HOSTED_ASSET_MISMATCH');
      })
    ]);
    need(retiredRoute.status === 410 && (await retiredRoute.json()).result === 'SIGNIN_VERIFICATION_REMOVED',
      'FR33_STAGING_WORKER_NOT_PRESENT');
    hostedAssetsVerified = true;
  }
  const configText = configBytes.toString('utf8');
  const { key } = readPublicConfiguration(configText);
  const source = new Map([
    ['/auth.html', { contentType: 'text/html; charset=utf-8', body: await readFile(new URL('../../auth.html', import.meta.url)) }],
    ['/auth-flows.js', { contentType: 'application/javascript; charset=utf-8', body: await readFile(new URL('../../auth-flows.js', import.meta.url)) }],
    ['/styles.css', { contentType: 'text/css; charset=utf-8', body: await readFile(new URL('../../styles.css', import.meta.url)) }],
    ['/config.js', { contentType: 'application/javascript; charset=utf-8', body: configText }]
  ]);
  const { chromium } = await import('../fixtures/staging-browser-tools/node_modules/playwright/index.mjs');

  async function rpc(path, token) {
    const response = await fetch(API_ORIGIN + path, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(18000),
      headers: { apikey: key, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': agent },
      body: '{}'
    });
    need(response.ok, 'FR33_BROWSER_TEST_RPC_FAILED');
    return response.json();
  }

  step = 'VERIFY_TEST_ACCOUNTS';
  report = await checkStagingAccess(privateAccounts(process.env, scope), apiTransport(key, agent),
    async ({ actors, evidence }) => {
      const owner = actors.USER_A;
      const other = actors.USER_B;
      const browser = await chromium.launch({ headless: true });
      let submitted = false;
      try {
        step = 'READ_INITIAL_STATUS';
        const [ownerStatus, otherStatus] = await Promise.all([
          rpc(statusPath, owner.token), rpc(statusPath, other.token)
        ]);
        need(ownerStatus.status === 'none' && otherStatus.status === 'none', 'FR33_BROWSER_EXISTING_REQUEST');

        const context = await browser.newContext({ serviceWorkers: 'block', userAgent: agent });
        context.setDefaultTimeout(20000);
        const session = {
          ...owner.session,
          expires_at: owner.session.expires_at ?? Math.floor(Date.now() / 1000) + owner.session.expires_in
        };
        await context.addInitScript(({ origin, key, session }) => {
          if (location.origin === origin && !localStorage.getItem(key)) {
            localStorage.setItem(key, JSON.stringify(session));
          }
        }, { origin, key: browserKey, session });

        let assetLoads = 0;
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          const method = request.method();
          if (url.origin === origin && method === 'GET') {
            if (hosted) {
              if (url.pathname === accountPath || url.pathname === '/auth-flows.js') assetLoads++;
              return route.continue();
            }
            const candidate = source.get(url.pathname);
            if (!candidate) return route.continue();
            if (url.pathname === accountPath || url.pathname === '/auth-flows.js') assetLoads++;
            return route.fulfill({ status: 200, ...candidate });
          }
          if (url.origin === 'https://cdn.jsdelivr.net' && method === 'GET' && url.pathname.startsWith('/npm/')) return route.continue();
          if (url.origin === API_ORIGIN) {
            if (method === 'GET' && url.pathname === '/auth/v1/user') return route.continue();
            if (method === 'OPTIONS') return route.continue();
            if (method === 'POST' && allowedPost.has(url.pathname)) {
              if (url.pathname === requestPath) submitted = true;
              return route.continue();
            }
          }
          return route.abort('blockedbyclient');
        });

        const page = await context.newPage();
        const newRequest = page.getByRole('button', { name: 'Request account deletion', exact: true });
        const cancelRequest = page.getByRole('button', { name: 'Cancel deletion request', exact: true });
        const noRequest = page.getByText('You have no pending account deletion request.', { exact: true });
        const ownerReview = page.getByText('Your request is pending. Deleting your account will also delete the Family and Business workspaces you own.', { exact: true });

        step = 'OPEN_ACCOUNT_SETTINGS';
        await page.goto(origin + accountPath + '?flow=account&from=personal-settings', { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Account settings', exact: true }).waitFor();
        await noRequest.waitFor();
        await newRequest.waitFor();
        evidence.initial_status_visible = true;

        step = 'CHECK_WORKSPACE_IMPACT_WARNING';
        const expectedImpact = await rpc(impactPath, owner.token);
        const otherImpact = await rpc(impactPath, other.token);
        await newRequest.click();
        const dialog = page.getByRole('dialog', { name: 'Confirm account deletion request' });
        const confirm = dialog.getByRole('button', { name: 'Submit deletion request' });
        const acknowledge = dialog.getByRole('checkbox', { name: 'I understand what will be permanently deleted.' });
        const list = dialog.getByRole('list', { name: 'Workspaces that will be deleted' });
        await dialog.waitFor();
        await list.waitFor();
        need(expectedImpact.workspaces.some(row => row.kind === 'business'), 'FR33_BROWSER_OWNED_FIXTURE_REQUIRED');
        need(await list.getByRole('listitem').count() === expectedImpact.workspaces.length,
          'FR33_BROWSER_OWNED_WORKSPACE_COUNT_MISMATCH');
        const expectedLabels = expectedImpact.workspaces.map(row => {
          const kind = row.kind === 'business' ? 'Business' : 'Family';
          const state = { active: 'Active', suspended: 'Suspended', closed: 'Closed' }[row.status];
          return state ? `${row.name} (${kind}, ${state})` : `${row.name} (${kind})`;
        });
        need(JSON.stringify(await list.getByRole('listitem').allTextContents()) === JSON.stringify(expectedLabels),
          'FR33_BROWSER_OWNED_WORKSPACE_WARNING_MISMATCH');
        need(otherImpact.impact_token !== expectedImpact.impact_token && !(await confirm.isEnabled()),
          'FR33_BROWSER_IMPACT_SCOPE_OR_CONFIRMATION_MISMATCH');
        await dialog.getByText('All members will lose access to these workspaces.', { exact: false }).waitFor();
        evidence.owned_workspace_warning = true;

        step = 'DISMISS_CONFIRMATION';
        await dialog.getByRole('button', { name: 'Go back' }).click();
        await dialog.waitFor({ state: 'hidden' });
        need(!submitted, 'FR33_BROWSER_SUBMITTED_WITHOUT_CONFIRMATION');
        evidence.dismissal_prevents_request = true;

        step = 'SUBMIT_AND_READ_OWNERSHIP_HOLD';
        await newRequest.click();
        await acknowledge.check();
        need(await confirm.isEnabled(), 'FR33_BROWSER_CONFIRMATION_UNAVAILABLE');
        await confirm.click();
        await ownerReview.waitFor();
        await cancelRequest.waitFor();
        need(submitted, 'FR33_BROWSER_NO_REQUEST_SENT');
        need((await rpc(statusPath, other.token)).status === 'none', 'FR33_BROWSER_OTHER_ACCOUNT_SAW_REQUEST');
        evidence.ownership_hold_and_isolation = true;

        step = 'RELOAD_ACCOUNT_SETTINGS';
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ownerReview.waitFor();
        await cancelRequest.waitFor();
        need(assetLoads === 4, 'FR33_BROWSER_ACCOUNT_ASSETS_NOT_RELOADED');
        evidence.review_status_survives_reload = true;

        step = 'CANCEL_FROM_ACCOUNT_SETTINGS';
        await cancelRequest.click();
        await noRequest.waitFor();
        await newRequest.waitFor();
        need((await rpc(statusPath, owner.token)).status === 'none', 'FR33_BROWSER_CANCEL_NOT_PERSISTED');
        evidence.cancellation_visible_and_persisted = true;

        step = 'RETURN_TO_WORKSPACE_SETTINGS';
        const back = page.getByRole('button', { name: 'Back to settings', exact: true });
        await back.click();
        await page.waitForURL(url => url.origin === origin && ['/app','/app.html'].includes(url.pathname)
          && url.hash === '#personal/settings');
        evidence.return_to_workspace_settings = true;
      } finally {
        try {
          // Reconcile the same test account if the request reached the API but a UI assertion failed.
          if (submitted && (await rpc(statusPath, owner.token)).status !== 'none') {
            need((await rpc(cancelPath, owner.token)).status === 'none', 'FR33_BROWSER_REQUEST_CLEANUP_FAILED');
          }
        } finally {
          await browser.close();
        }
      }
    }, scope);
} catch {
  // Stage errors can contain account credentials or private identifiers.
}
report.browser_step = step;
report.browser_target = target;
report.hosted_assets_verified = hostedAssetsVerified;
console.log(JSON.stringify(report));
process.exitCode = report.exit_code;
