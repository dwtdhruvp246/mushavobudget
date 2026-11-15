import { readFile } from 'node:fs/promises';
import {
  API_ORIGIN, WEB_ORIGIN, apiTransport, checkStagingAccess, need, privateAccounts, readPublicConfiguration
} from './staging-access.mjs';

const agent = 'MushavoBudget-FR33-Browser-Acceptance';
const browserKey = 'sb-dczlddwbtgvfdujgcitb-auth-token';
const scope = { accountScope: 'ordinary' };
const statusPath = '/rest/v1/rpc/fr33_account_deletion_status';
const requestPath = '/rest/v1/rpc/fr33_request_account_deletion';
const cancelPath = '/rest/v1/rpc/fr33_cancel_account_deletion';
const allowedPost = new Set([statusPath, requestPath, cancelPath, '/rest/v1/rpc/app_session_status']);

let report = { result: 'FR33_BROWSER_PREFLIGHT_FAILED', exit_code: 1 };
let step = 'READ_STAGING_CONFIGURATION';
try {
  const response = await fetch(WEB_ORIGIN + '/config.js', { redirect: 'error', signal: AbortSignal.timeout(20000) });
  need(response.ok, 'FR33_STAGING_CONFIGURATION_UNAVAILABLE');
  const configText = await response.text();
  const { key } = readPublicConfiguration(configText);
  const source = new Map([
    ['/auth.html', { contentType: 'text/html; charset=utf-8', body: await readFile(new URL('../../auth.html', import.meta.url)) }],
    ['/auth-flows.js', { contentType: 'application/javascript; charset=utf-8', body: await readFile(new URL('../../auth-flows.js', import.meta.url)) }],
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
        }, { origin: WEB_ORIGIN, key: browserKey, session });

        let assetLoads = 0;
        await context.route('**/*', async route => {
          const request = route.request();
          const url = new URL(request.url());
          const method = request.method();
          if (url.origin === WEB_ORIGIN && method === 'GET') {
            const candidate = source.get(url.pathname);
            if (!candidate) return route.continue();
            if (url.pathname !== '/config.js') assetLoads++;
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
        const ownerReview = page.getByText('Your request is pending a review of the shared workspaces you own.', { exact: true });

        step = 'OPEN_ACCOUNT_SETTINGS';
        await page.goto(WEB_ORIGIN + '/auth.html?flow=account', { waitUntil: 'domcontentloaded' });
        await page.getByRole('heading', { name: 'Account settings', exact: true }).waitFor();
        await noRequest.waitFor();
        await newRequest.waitFor();
        evidence.initial_status_visible = true;

        step = 'DISMISS_CONFIRMATION';
        page.once('dialog', dialog => dialog.dismiss());
        await newRequest.click();
        need(!submitted, 'FR33_BROWSER_SUBMITTED_WITHOUT_CONFIRMATION');
        evidence.dismissal_prevents_request = true;

        step = 'SUBMIT_AND_READ_OWNERSHIP_HOLD';
        page.once('dialog', dialog => dialog.accept());
        await newRequest.click();
        await ownerReview.waitFor();
        await cancelRequest.waitFor();
        need(submitted, 'FR33_BROWSER_NO_REQUEST_SENT');
        need((await rpc(statusPath, other.token)).status === 'none', 'FR33_BROWSER_OTHER_ACCOUNT_SAW_REQUEST');
        evidence.ownership_hold_and_isolation = true;

        step = 'RELOAD_ACCOUNT_SETTINGS';
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ownerReview.waitFor();
        await cancelRequest.waitFor();
        need(assetLoads === 4, 'FR33_BROWSER_CANDIDATE_ASSETS_NOT_RELOADED');
        evidence.review_status_survives_reload = true;

        step = 'CANCEL_FROM_ACCOUNT_SETTINGS';
        await cancelRequest.click();
        await noRequest.waitFor();
        await newRequest.waitFor();
        need((await rpc(statusPath, owner.token)).status === 'none', 'FR33_BROWSER_CANCEL_NOT_PERSISTED');
        evidence.cancellation_visible_and_persisted = true;
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
console.log(JSON.stringify(report));
process.exitCode = report.exit_code;
