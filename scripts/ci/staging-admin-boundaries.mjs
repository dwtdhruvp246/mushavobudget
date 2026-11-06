import { API_ORIGIN, WEB_ORIGIN, Stop, need, tokenIdentity } from './staging-access.mjs';
import { closeTestContext, createTestContext, readyDashboard, verifyPublicSources } from './staging-password-sessions.mjs';

const API = {
  session: ['POST', '/rest/v1/rpc/app_session_status', {}],
  roles: ['GET', '/rest/v1/app_admins?select=role&limit=2'],
  finance: ['GET', '/rest/v1/admin_finance_settings?select=id&id=eq.1&limit=1'],
  preview: ['POST', '/rest/v1/rpc/admin_plan_calculation_preview', {
    p_workspace_type: 'personal', p_base: 10, p_seat_price: 0, p_included: 1, p_total: 1, p_extra: 1,
    p_start: '2026-11-01T00:00:00Z', p_end: '2026-12-01T00:00:00Z', p_at: '2026-11-15T00:00:00Z', p_period: 'monthly'
  }],
  // Missing all invitation fields. Even an authorized caller cannot reserve or send anything.
  edge: ['POST', '/functions/v1/invite-admin-user', {}]
};
const adminReads = ['admin_business_billing_settings', 'admin_plan_workbench_snapshot'];
const denied = status => status === 401 || status === 403;
const emptyOrDenied = ({ status, value }) => denied(status) || status === 200 && Array.isArray(value) && value.length === 0;
const contract = ({ status, value }, valid, role) => status === 200 && value?.contract === 1
  && value.policy === 'PASSWORD_ONLY_ALL_USERS' && value.session_valid === valid
  && value.role === role && value.admin_authorized === (valid && role !== null);

export const verifyAdminSources = (evidence, fetcher = fetch) => verifyPublicSources(evidence, fetcher, {
  '/admin-plans.js': 'c6a7620703d83b9f5a3df9f62f69e4c4f41b32c2'
});

export function adminProbe(key, agent, evidence, fetcher = fetch) {
  return async (label, name, token, passes) => {
    need(Object.hasOwn(API, name), 'UNPLANNED_ADMIN_PROBE_REFUSED');
    need(evidence.direct_probe_requests < 25, 'ADMIN_PROBE_BOUND_REACHED');
    const [method, path, body] = API[name];
    evidence.direct_probe_requests++;
    const response = await fetcher(API_ORIGIN + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { apikey: key, Origin: WEB_ORIGIN, 'User-Agent': agent, 'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    });
    let value = null;
    try { value = await response.json(); } catch {}
    const passed = passes({ status: response.status, value });
    evidence.probes[label] = { HTTP_status: response.status, passed };
    need(passed, 'ADMIN_PROBE_REQUIRED_' + label);
  };
}

export async function checkAdminBoundaries(input, chromium, key, agent, fetcher = fetch) {
  const { actors, evidence, scopedLogout, acknowledgeLogout } = input;
  Object.assign(evidence, { probes: {}, direct_probe_requests: 0, browser_checks: {},
    role_or_finance_writes_requested: 0, invitation_requests_with_recipient: 0,
    service_workers: 'blocked_in_isolated_CI_context' });
  for (const { id, token } of Object.values(actors)) {
    need(tokenIdentity(token)?.userId === id, 'ADMIN_PROBE_ACTOR_SESSION_BINDING_REQUIRED');
  }
  const probe = adminProbe(key, agent, evidence, fetcher);
  const admin = actors.ADMIN;
  await probe('ADMIN_SESSION', 'session', admin.token, result => contract(result, true, 'super_admin'));
  await probe('ADMIN_ROLE_ROW', 'roles', admin.token, ({ status, value }) =>
    status === 200 && Array.isArray(value) && value.length === 1 && value[0].role === 'super_admin');
  await probe('ADMIN_FINANCE_ROW', 'finance', admin.token, ({ status, value }) =>
    status === 200 && Array.isArray(value) && value.length === 1 && value[0].id === 1);
  await probe('ADMIN_PLAN_PREVIEW', 'preview', admin.token, ({ status, value }) =>
    status === 200 && value?.preview_only === true && value.subscription_total === 10 && value.extra_seat_total === 0);
  await probe('ADMIN_EDGE_REACHES_PAYLOAD_VALIDATION', 'edge', admin.token, ({ status, value }) =>
    status === 400 && value?.error === 'INVALID_INVITATION_REQUEST');

  for (const slot of ['USER_A', 'USER_B']) {
    const { token } = actors[slot];
    await probe(slot + '_SESSION', 'session', token, result => contract(result, true, null));
    await probe(slot + '_ROLE_ROW_DENIED', 'roles', token, emptyOrDenied);
    await probe(slot + '_FINANCE_ROW_DENIED', 'finance', token, emptyOrDenied);
    await probe(slot + '_PLAN_PREVIEW_DENIED', 'preview', token, ({ status, value }) =>
      status === 400 && value?.message === 'PLAN_MANAGEMENT_ACCESS_REQUIRED');
    await probe(slot + '_EDGE_DENIED', 'edge', token, ({ status, value }) =>
      status === 403 && value?.error === 'ADMIN_USER_INVITATION_ACCESS_REQUIRED');
  }
  for (const [kind, token] of [['MISSING_BEARER', null], ['INVALID_BEARER', 'invalid-staging-bearer']]) {
    await probe(kind + '_SESSION_DENIED', 'session', token, ({ status }) => denied(status));
    await probe(kind + '_EDGE_DENIED', 'edge', token, ({ status }) => denied(status));
  }

  const browser = await chromium.launch({ headless: true });
  const blockAnalytics = async (route, action) => {
    if (action !== 'normal-activity') return false;
    await route.abort('blockedbyclient');
    return true;
  };
  let ordinaryTest, adminTest;
  try {
    ordinaryTest = await createTestContext(browser, actors.USER_A.session, 'V09', agent, acknowledgeLogout,
      { routeHook: blockAnalytics });
    await ordinaryTest.page.goto(WEB_ORIGIN + '/app#admin/plans', { waitUntil: 'domcontentloaded' });
    await readyDashboard(ordinaryTest.page);
    need(!await ordinaryTest.page.locator('#adminView').isVisible()
      && await ordinaryTest.page.locator('#adminPlansWorkbench .ap-plan').count() === 0
      && new URL(ordinaryTest.page.url()).hash === '#personal/dashboard' && !ordinaryTest.state.problem,
    'ORDINARY_ADMIN_DEEP_LINK_DENIAL_REQUIRED');
    evidence.browser_checks.ordinary_deep_link_opened_Personal_without_Admin_data = true;

    adminTest = await createTestContext(browser, admin.session, 'V07-V11', agent, acknowledgeLogout,
      { additionalReadRPCs: adminReads, routeHook: blockAnalytics });
    const { page } = adminTest;
    await page.goto(WEB_ORIGIN + '/app#admin/plans', { waitUntil: 'domcontentloaded' });
    await page.locator('#adminView:not(.hidden)').waitFor({ state: 'visible', timeout: 35000 });
    await page.locator('#adminPlansWorkbench .ap-plan').first().click();
    await page.locator('#adminPlansWorkbench #ap-form').waitFor({ state: 'visible' });
    need(!adminTest.state.problem && adminTest.state.refresh_requests === 0, 'EXPECTED_ADMIN_BROWSER_STATE_REQUIRED');
    evidence.browser_checks.live_Super_Admin_opened_Plans_and_loaded_editor = true;

    await scopedLogout(admin.token);
    evidence.selected_Admin_local_logout_acknowledged = true;
    await page.locator('#adminView nav [data-admin-tab="finance"]').click();
    await page.locator('#adminEmailView:not(.hidden) [role="status"]').filter({ hasText: 'Sign in again.' }).waitFor();
    need(!await page.locator('#adminView').isVisible() && await page.locator('#ap-form, #adminPlansWorkbench .ap-plan, dialog[open]').count() === 0
      && !adminTest.state.problem, 'STALE_ADMIN_BROWSER_DATA_CLEARING_REQUIRED');
    evidence.browser_checks.revoked_Admin_recheck_hid_view_and_cleared_loaded_editor = true;
  } catch (error) {
    throw new Stop(ordinaryTest?.state.problem || adminTest?.state.problem
      || (error instanceof Stop ? error.code : 'ADMIN_BROWSER_EXPECTATION_NOT_MET'));
  } finally {
    try {
      await closeTestContext(ordinaryTest, evidence.ordinary_browser = {});
      await closeTestContext(adminTest, evidence.Admin_browser = {});
    } finally { await browser.close(); }
  }

  const claims = JSON.parse(Buffer.from(admin.token.split('.')[1], 'base64url').toString('utf8'));
  need(Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000, 'REVOKED_ADMIN_JWT_MUST_STILL_BE_UNEXPIRED');
  evidence.revoked_Admin_JWT_still_before_expiry = true;
  await probe('REVOKED_ADMIN_SESSION', 'session', admin.token, result => contract(result, false, null));
  await probe('REVOKED_ADMIN_ROLE_ROW_DENIED', 'roles', admin.token, emptyOrDenied);
  await probe('REVOKED_ADMIN_FINANCE_ROW_DENIED', 'finance', admin.token, emptyOrDenied);
  await probe('REVOKED_ADMIN_PLAN_PREVIEW_DENIED', 'preview', admin.token, ({ status, value }) =>
    status === 403 && value?.message === 'EMAIL_VERIFICATION_REQUIRED');
  await probe('REVOKED_ADMIN_EDGE_DENIED', 'edge', admin.token, ({ status, value }) =>
    status === 401 && value?.error === 'EDGE_FUNCTION_AUTHENTICATION_FAILED'
    || status === 403 && value?.error === 'EMAIL_VERIFICATION_REQUIRED');
  await probe('UNRELATED_TEST_SESSION_STILL_VALID', 'session', actors.USER_B.token, result => contract(result, true, null));
}
