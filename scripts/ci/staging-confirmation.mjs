import { createHash } from 'node:crypto';
import { WEB_ORIGIN, API_ORIGIN, need, Stop } from './staging-access.mjs';

const SOURCES = {
  // The accepted staging package changes only the two production DNS hints in
  // canonical signup.html to this staging project, preserving executable code.
  '/signup': 'f1e2dcfd6b856aca78a329e03c62ec9d5ec2bc5b',
  '/signup.html': 'f1e2dcfd6b856aca78a329e03c62ec9d5ec2bc5b',
  '/auth': '4f110e101a1bdf2ae7019fb227a0fc4dc579facd',
  '/auth.html': '4f110e101a1bdf2ae7019fb227a0fc4dc579facd',
  '/auth-flows.js': '74c3bcb1dc6ef2494f327460ff6cef9866b527c3',
  '/auth-security.js': 'eadce63c4b7166166236e2466c11d421f28a0229',
  '/session-entry.js': 'b9d0a517c64174ecbd8f78fff273694f2655692d'
};
const gitHash = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
export const reviewedSourceMatches = (path, bytes) => !!SOURCES[path] && gitHash(bytes) === SOURCES[path];

// Only the existing duplicate-signup request and the public read-only currency
// RPC may reach staging. Resends are always aborted at the browser boundary.
export function browserRequestDecision(url, method, phase, signupCount) {
  const target = new URL(url);
  if (target.origin === API_ORIGIN) {
    if (method === 'POST' && target.pathname === '/auth/v1/resend' && phase === 'confirmation') return 'block-resend';
    if (method === 'POST' && target.pathname === '/auth/v1/signup' && phase === 'signup' && signupCount === 0) return 'duplicate-signup';
    if (method === 'POST' && target.pathname === '/rest/v1/rpc/get_public_signup_currencies' && phase === 'signup') return 'public-currency-read';
    return 'refuse';
  }
  if (method === 'GET' && [WEB_ORIGIN, 'https://cdn.jsdelivr.net'].includes(target.origin)) return 'public-asset';
  return 'refuse';
}

export async function checkConfirmation({ accounts, registerSession, evidence }, chromium, runAgent) {
  Object.assign(evidence, { case_id: 'AU01.05', status: 'REVIEW_REQUIRED', checks: {},
    duplicate_signup_requests_forwarded: 0, resend_requests_forwarded: 0,
    blocked_resend_attempts: 0, public_currency_reads: 0, refused_unplanned_requests: 0,
    service_workers: 'blocked_for_network_interception', provider_429_exercised: false,
    actual_duplicate_signup_email_delivery_measured: false });
  const browser = await chromium.launch({ headless: true });
  let context, phase = 'signup', routeProblem = null;
  const verifiedSources = new Set();
  try {
    context = await browser.newContext({ serviceWorkers: 'block', userAgent: runAgent + '/browser' });
    context.setDefaultTimeout(20000);
    await context.route('**/*', async route => {
      const request = route.request();
      const action = browserRequestDecision(request.url(), request.method(), phase, evidence.duplicate_signup_requests_forwarded);
      if (action === 'block-resend') {
        evidence.blocked_resend_attempts++;
        if (evidence.blocked_resend_attempts > 4) routeProblem = 'RESEND_ATTEMPT_BOUND_REACHED';
        await route.abort('blockedbyclient'); return;
      }
      if (action === 'duplicate-signup') {
        let body;
        try { body = request.postDataJSON(); } catch {}
        if (body?.email !== accounts.USER_A.email || body?.password !== accounts.USER_A.password) {
          routeProblem = 'DUPLICATE_SIGNUP_BINDING_REQUIRED'; await route.abort('blockedbyclient'); return;
        }
        evidence.duplicate_signup_requests_forwarded++; await route.continue(); return;
      }
      if (action === 'public-currency-read') {
        evidence.public_currency_reads++;
        if (evidence.public_currency_reads <= 2) { await route.continue(); return; }
      }
      if (action === 'public-asset') { await route.continue(); return; }
      evidence.refused_unplanned_requests++; routeProblem = 'UNPLANNED_BROWSER_REQUEST_REFUSED';
      await route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const pendingBodies = [];
    page.on('response', response => {
      const path = new URL(response.url()).pathname;
      if (response.status() !== 200 || !SOURCES[path]) return;
      pendingBodies.push(response.body().then(bytes => {
        if (reviewedSourceMatches(path, bytes)) verifiedSources.add(path);
        else routeProblem = 'DEPLOYED_SOURCE_IDENTITY_MISMATCH';
      }).catch(() => { routeProblem = 'DEPLOYED_SOURCE_READ_FAILED'; }));
    });
    await page.goto(WEB_ORIGIN + '/signup.html', { waitUntil: 'networkidle' });
    await page.locator('#signupCurrencyOptions input[value="USD"]').waitFor({ state: 'visible' });
    await Promise.all(pendingBodies);
    need(!routeProblem && (verifiedSources.has('/signup') || verifiedSources.has('/signup.html'))
      && verifiedSources.has('/auth-security.js') && verifiedSources.has('/session-entry.js'), 'REVIEWED_SIGNUP_SOURCE_REQUIRED');
    evidence.checks.reviewed_signup_sources_loaded = true;
    await page.locator('#signupName').fill('Batch W Confirmation');
    await page.locator('#signupEmail').fill(accounts.USER_A.email);
    await page.locator('#signupPassword').fill(accounts.USER_A.password);
    await page.locator('#signupPasswordConfirm').fill(accounts.USER_A.password);
    await page.locator('#signupCurrencyOptions input[value="USD"]').check();
    await page.locator('#signupDefaultCurrency').selectOption('USD');
    const [response] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).origin === API_ORIGIN
        && new URL(response.url()).pathname === '/auth/v1/signup', { timeout: 25000 }),
      page.locator('#signupSubmitButton').click()
    ]);
    let data;
    try { data = await response.json(); } catch {}
    if (typeof data?.access_token === 'string') registerSession(data.access_token);
    const duplicateCode = data?.code || data?.error_code;
    need(!data?.access_token && (response.status() === 200
      || [400, 422].includes(response.status()) && ['user_already_exists', 'email_exists'].includes(duplicateCode)),
    'DUPLICATE_SIGNUP_GENERIC_RESPONSE_REQUIRED');
    await page.waitForURL(url => url.origin === WEB_ORIGIN && url.pathname === '/app', { timeout: 25000 });
    await page.getByText('Check your inbox to confirm your email, then sign in.', { exact: true }).waitFor({ state: 'visible' });
    need(evidence.duplicate_signup_requests_forwarded === 1 && !routeProblem, 'DUPLICATE_SIGNUP_NOT_BOUNDED');
    evidence.checks.generic_existing_account_guidance = true;

    phase = 'confirmation';
    await page.goto(WEB_ORIGIN + '/auth.html?flow=request-confirmation', { waitUntil: 'networkidle' });
    await page.locator('#securityRequest').waitFor({ state: 'visible' });
    await Promise.all(pendingBodies);
    need(verifiedSources.has('/auth-flows.js') && !routeProblem, 'REVIEWED_CONFIRMATION_SOURCE_REQUIRED');
    evidence.checks.reviewed_confirmation_source_loaded = true;
    await page.locator('#securityEmail').fill(accounts.USER_A.email);
    const send = page.getByRole('button', { name: 'Send link', exact: true });
    await send.click();
    await page.getByText('The request could not finish. Check your connection and try again.', { exact: true }).waitFor({ state: 'visible' });
    need(evidence.blocked_resend_attempts >= 1 && !routeProblem, 'ACTUAL_BROWSER_BLOCK_NOT_ESTABLISHED');
    need(await page.locator('#securityRequest').isVisible() && await send.isEnabled()
      && await page.locator('#securityEmail').inputValue() === accounts.USER_A.email, 'REQUEST_FORM_RETENTION_REQUIRED');
    evidence.checks.actual_browser_block_and_retry_guidance = true;
    evidence.checks.address_form_and_enabled_button_retained = true;
    const blockedBeforeRetry = evidence.blocked_resend_attempts;
    await send.click();
    await page.getByText('Too many attempts. Wait before trying again.', { exact: true }).waitFor({ state: 'visible' });
    need(evidence.blocked_resend_attempts === blockedBeforeRetry && !routeProblem, 'LOCAL_COOLDOWN_DISPATCHED_REQUEST');
    evidence.checks.local_cooldown_prevented_second_dispatch = true;
    evidence.checks.no_resend_reached_server = evidence.resend_requests_forwarded === 0;
    evidence.status = 'SCOPED_PASS';
  } catch (error) {
    evidence.problem_code = routeProblem || (error instanceof Stop ? error.code : 'BROWSER_EXPECTATION_NOT_MET');
    throw new Stop(evidence.problem_code);
  } finally {
    if (context) {
      // Keep blocking in place until the context is closed, including on errors.
      try { await context.close(); evidence.checks.test_browser_context_closed = true; }
      catch { evidence.checks.test_browser_context_closed = false; }
    }
    await browser.close();
    need(evidence.checks.test_browser_context_closed, 'TEST_BROWSER_CONTEXT_CLEANUP_REQUIRED');
  }
}
