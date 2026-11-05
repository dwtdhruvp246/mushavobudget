import { createHash } from 'node:crypto';
import { WEB_ORIGIN, API_ORIGIN, Stop, need, tokenIdentity } from './staging-access.mjs';

const STORAGE_KEY = 'sb-dczlddwbtgvfdujgcitb-auth-token';
const SOURCE_BLOBS = {
  '/app': 'daf5c65b469e9a6f4ef53bea69d47acf2a3544c1',
  '/app.js': 'ba7097c27a0488ce7d91b3c6e3912214f44fb2e6',
  '/auth-security.js': 'eadce63c4b7166166236e2466c11d421f28a0229',
  '/session-entry.js': 'b9d0a517c64174ecbd8f78fff273694f2655692d'
};
const READ_RPCS = new Set(['app_session_status', 'my_account_suspended', 'has_my_unfinished_admin_invitation',
  'get_my_admin_user_invitation', 'get_my_business_invitations', 'public_business_checkout_terms',
  'effective_workspace_entitlement', 'workspace_billable_member_count', 'workspace_member_usage',
  'exchange_rate_status', 'personal_payment_plan_access']);

export function sessionBrowserDecision(url, method, additionalReadRPCs = []) {
  const target = new URL(url);
  if (target.origin === API_ORIGIN) {
    if (method === 'POST' && target.pathname === '/auth/v1/token' && target.search === '?grant_type=refresh_token') return 'refresh';
    if (method === 'POST' && target.pathname === '/auth/v1/logout' && target.search === '?scope=local') return 'local-logout';
    if (method === 'GET' && (target.pathname === '/auth/v1/user' || target.pathname.startsWith('/rest/v1/'))) return 'read';
    const name = target.pathname.startsWith('/rest/v1/rpc/') ? target.pathname.slice(13) : null;
    if (method === 'POST' && (READ_RPCS.has(name) || additionalReadRPCs.includes(name))) return 'read';
    if (method === 'POST' && name === 'record_my_analytics_activity') return 'normal-activity';
    return 'refuse';
  }
  if (method === 'GET' && [WEB_ORIGIN, 'https://cdn.jsdelivr.net'].includes(target.origin)) return 'public';
  return 'refuse';
}

export async function checkServerPasswordBoundary(account, key, registerSession, fetcher = fetch) {
  const evidence = { case_id: 'AU03.03', status: 'REVIEW_REQUIRED', attempted_password_length: 7,
    actual_signup_requests: 1, password_update_requests: 0, existing_confirmed_recipient_used: true };
  const response = await fetcher(API_ORIGIN + '/auth/v1/signup', {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: 'Ab3!xyz' })
  });
  let data = null;
  try { data = await response.json(); } catch {}
  if (typeof data?.access_token === 'string') registerSession(data.access_token);
  const code = data?.error_code || (typeof data?.code === 'string' ? data.code : null);
  const minimum = String(data?.msg || data?.message || '').match(/at least (\d+) characters/i);
  evidence.HTTP_status = response.status;
  evidence.error_code = code === 'weak_password' ? code : 'OTHER';
  evidence.reported_minimum = minimum ? Number(minimum[1]) : null;
  evidence.no_session_returned = !data?.access_token;
  evidence.boundary_rejection_verified = [400, 422].includes(response.status)
    && code === 'weak_password' && evidence.reported_minimum === 8 && evidence.no_session_returned;
  evidence.status = evidence.boundary_rejection_verified ? 'SCOPED_PASS' : 'REVIEW_REQUIRED';
  return evidence;
}

async function verifyPublicSources(evidence, fetcher) {
  evidence.public_source_reads = 0;
  for (const [path, expected] of Object.entries(SOURCE_BLOBS)) {
    const response = await fetcher(WEB_ORIGIN + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    evidence.public_source_reads++;
    need(response.status === 200, 'SESSION_TEST_PUBLIC_SOURCE_REQUIRED');
    const bytes = Buffer.from(await response.arrayBuffer());
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    if (actual !== expected) evidence.source_check_failed_path = path;
    need(actual === expected, 'SESSION_TEST_REVIEWED_SOURCE_REQUIRED');
  }
  evidence.reviewed_app_and_session_sources_verified = true;
}

export async function createTestContext(browser, session, caseId, agent, acknowledgeLogout, { additionalReadRPCs = [], routeHook = null } = {}) {
  const context = await browser.newContext({ serviceWorkers: 'block', userAgent: agent + '/' + caseId });
  context.setDefaultTimeout(20000);
  const state = { backend_requests: 0, refused_requests: 0, refresh_requests: 0,
    local_logout_requests: 0, local_logout_acknowledgements: 0, normal_activity_RPCs: 0, problem: null };
  await context.addInitScript(({ session, key, origin }) => {
    if (location.origin !== origin) return;
    if (localStorage.getItem('mushavo-ci-seeded') !== 'true') {
      localStorage.setItem(key, JSON.stringify(session));
      localStorage.setItem('mushavo-ci-seeded', 'true');
      localStorage.setItem('mushavo-ci-unrelated', 'preserve');
    }
    window.__mushavoCI = { pushFault: false, pushFaultCalls: 0, authViewExposed: false };
    const observe = () => {
      const auth = document.querySelector('#authView');
      if (auth && !auth.classList.contains('hidden')) window.__mushavoCI.authViewExposed = true;
    };
    new MutationObserver(observe).observe(document, { childList: true, attributes: true, subtree: true });
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      const original = navigator.serviceWorker.getRegistration.bind(navigator.serviceWorker);
      navigator.serviceWorker.getRegistration = (...args) => {
        if (window.__mushavoCI.pushFault) {
          window.__mushavoCI.pushFaultCalls++;
          return Promise.reject(new DOMException('Controlled browser registration lookup failure', 'NetworkError'));
        }
        return original(...args);
      };
    }
  }, { session, key: STORAGE_KEY, origin: WEB_ORIGIN });
  await context.route('**/*', async route => {
    const request = route.request(), action = sessionBrowserDecision(request.url(), request.method(), additionalReadRPCs);
    if (!['public', 'refuse'].includes(action)) {
      state.backend_requests++;
      if (state.backend_requests > 280) state.problem = 'SESSION_BROWSER_REQUEST_BOUND_REACHED';
    }
    if (action === 'refresh') {
      state.refresh_requests++;
      if (state.refresh_requests > 2) state.problem = 'REFRESH_ATTEMPT_BOUND_REACHED';
    }
    if (action === 'local-logout') state.local_logout_requests++;
    if (action === 'normal-activity') state.normal_activity_RPCs++;
    if (action === 'refuse') { state.refused_requests++; state.problem = 'UNPLANNED_SESSION_BROWSER_REQUEST_REFUSED'; }
    if (state.problem) { await route.abort('blockedbyclient'); return; }
    if (routeHook && await routeHook(route, action)) return;
    await route.continue();
  });
  context.on('response', response => {
    if (sessionBrowserDecision(response.url(), response.request().method()) !== 'local-logout') return;
    try {
      const authorization = response.request().headers().authorization || '';
      acknowledgeLogout(authorization.replace(/^Bearer /, ''), response.status());
      state.local_logout_acknowledgements++;
    } catch { state.problem = 'BROWSER_LOCAL_LOGOUT_NOT_ACKNOWLEDGED'; }
  });
  return { context, state, page: await context.newPage() };
}

export async function readyDashboard(page) {
  await page.locator('#appView:not(.hidden)').waitFor({ state: 'visible', timeout: 35000 });
  need(await page.locator('#signOutButton').isVisible(), 'AUTHENTICATED_DASHBOARD_REQUIRED');
  return page.locator('#dashboardMonthTitle').innerText();
}

export async function closeTestContext(test, evidence) {
  if (!test) return;
  Object.assign(evidence, test.state);
  delete evidence.problem;
  await test.context.close();
  evidence.test_context_closed = true;
}

async function sameUserRefresh(browser, input, key, agent, evidence, fetcher) {
  const actor = input.actors.USER_A;
  let test;
  Object.assign(evidence, { case_id: 'AU05.01', status: 'REVIEW_REQUIRED', checks: {},
    trigger: 'local_expiry_metadata_shortened_in_isolated_test_session', real_JWT_expiry_or_server_policy_changed: false,
    explicit_refreshSession_calls: 0, natural_hour_long_expiry_observed: false });
  try {
    test = await createTestContext(browser, actor.session, evidence.case_id, agent, input.acknowledgeLogout);
    const { page, state } = test;
    await page.goto(WEB_ORIGIN + '/app#personal/dashboard', { waitUntil: 'domcontentloaded' });
    const title = await readyDashboard(page);
    const initial = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    const before = tokenIdentity(initial?.access_token);
    need(before && before.userId === actor.id && before.sessionId === tokenIdentity(actor.token)?.sessionId, 'INITIAL_OWN_SESSION_REQUIRED');
    const [response] = await Promise.all([
      page.waitForResponse(response => sessionBrowserDecision(response.url(), response.request().method()) === 'refresh', { timeout: 45000 }),
      page.evaluate(key => {
        const value = JSON.parse(localStorage.getItem(key));
        value.expires_at = Math.floor(Date.now() / 1000) + 30;
        localStorage.setItem(key, JSON.stringify(value));
      }, STORAGE_KEY)
    ]);
    const renewed = await response.json();
    if (renewed?.access_token) input.registerSession(renewed.access_token);
    const after = tokenIdentity(renewed?.access_token);
    need(response.status() === 200 && after?.userId === actor.id && after.sessionId === before.sessionId
      && renewed.access_token !== initial.access_token, 'REAL_SAME_SESSION_REFRESH_REQUIRED');
    actor.session = renewed; actor.token = renewed.access_token;
    evidence.refresh_HTTP_status = response.status();
    evidence.checks.real_rotated_access_token_same_user_and_session = true;
    await readyDashboard(page);
    await page.waitForFunction(({ key, token }) => JSON.parse(localStorage.getItem(key) || 'null')?.access_token === token,
      { key: STORAGE_KEY, token: renewed.access_token });
    need(await page.locator('#dashboardMonthTitle').innerText() === title
      && !await page.evaluate(() => window.__mushavoCI.authViewExposed), 'DASHBOARD_CONTINUITY_REQUIRED');
    const user = await fetcher(API_ORIGIN + '/auth/v1/user', { redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { apikey: key, Authorization: 'Bearer ' + renewed.access_token, 'User-Agent': agent } });
    const verified = await user.json();
    need(user.status === 200 && verified.id === actor.id, 'REFRESHED_SERVER_IDENTITY_REQUIRED');
    evidence.server_identity_reads = 1;
    evidence.checks.server_reverified_same_user = true;
    evidence.checks.dashboard_retained_without_signin_view = true;
    await page.reload({ waitUntil: 'domcontentloaded' });
    await readyDashboard(page);
    const persisted = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
    need(persisted?.access_token === renewed.access_token && persisted.user?.id === actor.id
      && await page.locator('#dashboardMonthTitle').innerText() === title && !state.problem, 'REFRESH_PERSISTENCE_REQUIRED');
    evidence.checks.renewed_session_persists_through_reload = true;
    evidence.status = 'SCOPED_PASS';
  } catch (error) {
    evidence.problem_code = test?.state.problem || (error instanceof Stop ? error.code : 'REFRESH_BROWSER_EXPECTATION_NOT_MET');
    throw new Stop(evidence.problem_code);
  } finally { await closeTestContext(test, evidence); }
}

async function invalidRefresh(browser, input, agent, evidence) {
  let test;
  Object.assign(evidence, { case_id: 'AU05.02', status: 'REVIEW_REQUIRED', checks: {},
    only_new_runner_session_revoked: true, server_response_mocked: false });
  try {
    const actor = input.actors.USER_B;
    await input.scopedLogout(actor.token);
    evidence.checks.own_session_scoped_revocation_acknowledged = true;
    const expiredMetadata = { ...actor.session, expires_at: Math.floor(Date.now() / 1000) - 30 };
    test = await createTestContext(browser, expiredMetadata, evidence.case_id, agent, input.acknowledgeLogout);
    const { page, state } = test;
    const [response] = await Promise.all([
      page.waitForResponse(response => sessionBrowserDecision(response.url(), response.request().method()) === 'refresh', { timeout: 25000 }),
      page.goto(WEB_ORIGIN + '/app#personal/dashboard', { waitUntil: 'domcontentloaded' })
    ]);
    const rejected = await response.json();
    const code = rejected?.error_code || (typeof rejected?.code === 'string' ? rejected.code : null);
    evidence.refresh_HTTP_status = response.status();
    evidence.error_code = ['refresh_token_not_found', 'refresh_token_already_used', 'session_not_found'].includes(code) ? code : 'OTHER';
    need([400, 401, 403].includes(response.status()) && evidence.error_code !== 'OTHER', 'REAL_INVALID_REFRESH_DENIAL_REQUIRED');
    await page.locator('#authView:not(.hidden)').waitFor({ state: 'visible' });
    const storage = await page.evaluate(key => ({ removed: localStorage.getItem(key) === null,
      unrelatedRetained: localStorage.getItem('mushavo-ci-unrelated') === 'preserve' }), STORAGE_KEY);
    need(storage.removed && storage.unrelatedRetained && !await page.locator('#appView').isVisible()
      && !await page.locator('#adminView').isVisible(), 'INVALID_SESSION_CLEARING_REQUIRED');
    evidence.checks.actual_provider_rejection = true;
    evidence.checks.project_session_removed_and_unrelated_storage_retained = true;
    evidence.checks.signin_shown_and_protected_views_hidden = true;
    const count = state.refresh_requests;
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#authView:not(.hidden)').waitFor({ state: 'visible' });
    need(state.refresh_requests === count && !state.problem, 'INVALID_REFRESH_RETRIED_AFTER_CLEANUP');
    evidence.checks.reload_stays_signed_out_without_refresh_loop = true;
    evidence.status = 'SCOPED_PASS';
  } catch (error) {
    evidence.problem_code = test?.state.problem || (error instanceof Stop ? error.code : 'INVALID_REFRESH_BROWSER_EXPECTATION_NOT_MET');
    throw new Stop(evidence.problem_code);
  } finally { await closeTestContext(test, evidence); }
}

async function pushCleanupFailure(browser, input, agent, evidence) {
  let test;
  Object.assign(evidence, { case_id: 'AU05.04', status: 'REVIEW_REQUIRED', checks: {},
    injected_failure: 'browser_service_worker_registration_lookup_NetworkError',
    real_push_subscription_created: false, protected_push_row_DELETE_exercised: false, Auth_logout_response_mocked: false });
  try {
    const actor = input.actors.USER_A;
    test = await createTestContext(browser, actor.session, evidence.case_id, agent, input.acknowledgeLogout);
    const { page, state } = test;
    await page.goto(WEB_ORIGIN + '/app#personal/dashboard', { waitUntil: 'domcontentloaded' });
    await readyDashboard(page);
    await page.evaluate(() => { window.__mushavoCI.pushFault = true; });
    const [response] = await Promise.all([
      page.waitForResponse(response => sessionBrowserDecision(response.url(), response.request().method()) === 'local-logout'),
      page.locator('#signOutButton').click()
    ]);
    need([200, 204].includes(response.status()), 'PUSH_FAILURE_AUTH_LOGOUT_REQUIRED');
    await page.getByText('Signed out. Device notification cleanup could not finish; disable notifications in this browser if needed.', { exact: true }).waitFor({ state: 'visible' });
    await page.locator('#authView:not(.hidden)').waitFor({ state: 'visible' });
    const local = await page.evaluate(key => ({ attempts: window.__mushavoCI.pushFaultCalls,
      cleared: localStorage.getItem(key) === null }), STORAGE_KEY);
    need(local.attempts > 0 && local.cleared && state.local_logout_acknowledgements === 1 && !state.problem,
      'INDEPENDENT_PUSH_FAILURE_OUTCOME_REQUIRED');
    evidence.logout_HTTP_status = response.status();
    evidence.checks.push_cleanup_failed_but_real_local_logout_succeeded = true;
    evidence.checks.accurate_residual_push_warning_shown = true;
    evidence.checks.saved_session_removed = true;
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('#authView:not(.hidden)').waitFor({ state: 'visible' });
    need(!await page.locator('#appView').isVisible() && !await page.locator('#adminView').isVisible(), 'PUSH_FAILURE_SIGNOUT_PERSISTENCE_REQUIRED');
    evidence.checks.reload_remains_signed_out = true;
    evidence.status = 'SCOPED_PASS';
  } catch (error) {
    evidence.problem_code = test?.state.problem || (error instanceof Stop ? error.code : 'PUSH_FAILURE_BROWSER_EXPECTATION_NOT_MET');
    throw new Stop(evidence.problem_code);
  } finally { await closeTestContext(test, evidence); }
}

export async function checkPasswordSessions(input, chromium, key, agent, fetcher = fetch) {
  const evidence = input.evidence;
  Object.assign(evidence, { scope: 'password-and-sessions', cases: {}, new_public_AU_cases: 0,
    existing_passwords_changed: false, settings_or_finance_writes_requested: 0,
    unblocked_recovery_invitation_or_resend_requests: 0, service_workers: 'blocked_in_isolated_CI_contexts',
    browser_logs_tokens_HAR_traces_or_storage_exported: false });
  await verifyPublicSources(evidence, fetcher);
  evidence.cases.AU03_03 = await checkServerPasswordBoundary(input.accounts.USER_A, key, input.registerSession, fetcher);
  need(evidence.cases.AU03_03.status === 'SCOPED_PASS', 'SERVER_PASSWORD_BOUNDARY_NOT_VERIFIED');
  const browser = await chromium.launch({ headless: true });
  try {
    evidence.cases.AU05_01 = {};
    await sameUserRefresh(browser, input, key, agent, evidence.cases.AU05_01, fetcher);
    evidence.cases.AU05_02 = {};
    await invalidRefresh(browser, input, agent, evidence.cases.AU05_02);
    evidence.cases.AU05_04 = {};
    await pushCleanupFailure(browser, input, agent, evidence.cases.AU05_04);
    evidence.status = 'FOUR_EXISTING_CASES_SCOPED_PASS';
  } finally { await browser.close(); }
}
