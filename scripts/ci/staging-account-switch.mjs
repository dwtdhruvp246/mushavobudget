import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { WEB_ORIGIN, API_ORIGIN, Stop, need, tokenIdentity } from './staging-access.mjs';
import { createTestContext, readyDashboard, closeTestContext } from './staging-password-sessions.mjs';

export const BUSINESS_READ_RPCS = ['business_team_snapshot', 'business_effective_permissions', 'business_roles_snapshot',
  'business_claim_summary', 'business_bill_summary', 'business_transaction_feed', 'business_request_feed', 'business_budget_feed'];
const KEY = 'sb-dczlddwbtgvfdujgcitb-auth-token';
const blob = b => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');

export async function staleSessionSnapshot(actor, key, agent, fetcher = fetch) {
  const claims = JSON.parse(Buffer.from(actor.token.split('.')[1], 'base64url').toString('utf8'));
  const evidence = { case_id: 'AU05.07', status: 'STALE_SESSION_VARIANT_REVIEW_REQUIRED', checks: {},
    provider_rate_limit_exercised: false, JWT_expiry_modified: false };
  const headers = { apikey: key, Authorization: 'Bearer ' + actor.token, 'User-Agent': agent, 'Content-Type': 'application/json' };
  const status = await fetcher(API_ORIGIN + '/rest/v1/rpc/app_session_status', {
    method: 'POST', body: '{}', headers, redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  const value = await status.json();
  evidence.session_status_HTTP_status = status.status;
  evidence.checks.access_JWT_still_before_expiry = Number.isFinite(claims.exp) && claims.exp > Date.now() / 1000;
  evidence.checks.existing_server_contract_denies_revoked_session = status.status === 200 && value?.contract === 1
    && value.policy === 'PASSWORD_ONLY_ALL_USERS' && value.session_valid === false && value.admin_authorized === false && value.role === null;
  const profile = await fetcher(API_ORIGIN + `/rest/v1/profiles?select=id&id=eq.${actor.id}&limit=1`, {
    method: 'GET', headers, redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  let rows = null;
  try { rows = await profile.json(); } catch {}
  evidence.profile_HTTP_status = profile.status;
  evidence.checks.protected_profile_not_returned = profile.status === 200 && Array.isArray(rows) && rows.length === 0
    || [401, 403].includes(profile.status);
  need(Object.values(evidence.checks).every(value => value === true), 'STALE_SESSION_BOUNDARY_NOT_VERIFIED');
  evidence.status = 'STALE_SESSION_VARIANT_SCOPED_PASS';
  return evidence;
}

export async function checkAccountSwitch(input, chromium, key, agent, fetcher = fetch) {
  const evidence = input.evidence;
  Object.assign(evidence, { scope: 'account-switch-and-stale-session', cases: {}, settings_or_finance_writes_requested: 0,
    new_public_AU_cases: 0, existing_passwords_changed: false, mail_requests: 0,
    service_workers: 'blocked_in_isolated_CI_context', public_source_reads: 0 });
  const canonicalHTML = fs.readFileSync('business.html');
  need(blob(canonicalHTML) === '691072e31a4fd43fcb0787781065071aa5ae5c05', 'CANONICAL_BUSINESS_HTML_REQUIRED');
  const stagingHTML = blob(Buffer.from(canonicalHTML.toString('utf8').replaceAll('kttkospkblwvguuwnhjj.supabase.co', 'dczlddwbtgvfdujgcitb.supabase.co')));
  for (const [path, expected] of [['/business.js', '2c58c6d5f84687a124cb06cac149464ba1a1fbd2'],
    ['/session-entry.js', 'b9d0a517c64174ecbd8f78fff273694f2655692d'], ['/business', stagingHTML]]) {
    const response = await fetcher(WEB_ORIGIN + path, { redirect: 'error', signal: AbortSignal.timeout(20000) });
    evidence.public_source_reads++;
    need(response.status === 200 && blob(Buffer.from(await response.arrayBuffer())) === expected, 'REVIEWED_BUSINESS_SESSION_SOURCE_REQUIRED');
  }
  const result = evidence.cases.AU05_06 = { case_id: 'AU05.06', status: 'REVIEW_REQUIRED', checks: {},
    response_payload_modified: false, actual_server_response_held: false };
  const browser = await chromium.launch({ headless: true });
  let test, releaseHeld = () => {}, armed = false, held = false;
  let signalHeld, heldFailure = null, heldStatus = null, responseFinished;
  const arrived = new Promise(resolve => { signalHeld = resolve; });
  const release = new Promise(resolve => { releaseHeld = resolve; });
  const finished = new Promise(resolve => { responseFinished = resolve; });
  try {
    const actor = input.actors.USER_B, replacement = input.actors.USER_A;
    test = await createTestContext(browser, actor.session, 'AU05.06', agent, input.acknowledgeLogout, {
      additionalReadRPCs: BUSINESS_READ_RPCS,
      routeHook: async (route, action) => {
        const request = route.request(), target = new URL(request.url());
        if (!armed || held || action !== 'read' || target.pathname !== '/rest/v1/rpc/business_transaction_feed') return false;
        held = true;
        try {
          const current = tokenIdentity((request.headers().authorization || '').replace(/^Bearer /, ''));
          need(current?.userId === actor.id && current.sessionId === tokenIdentity(actor.token)?.sessionId,
            'OLD_ACTOR_REQUEST_BINDING_REQUIRED');
          const response = await route.fetch({ timeout: 20000 });
          heldStatus = response.status();
          need(heldStatus === 200, 'REAL_BUSINESS_RESPONSE_REQUIRED');
          result.actual_server_response_held = true;
          signalHeld(); await release;
          await route.fulfill({ response });
        } catch (error) {
          heldFailure = error instanceof Stop ? error.code : 'HELD_RESPONSE_NOT_COMPLETED';
          signalHeld(); try { await route.abort('blockedbyclient'); } catch {}
        } finally { responseFinished(); }
        return true;
      }
    });
    const business = test.page;
    await business.goto(WEB_ORIGIN + '/business#business/overview', { waitUntil: 'domcontentloaded' });
    await business.locator('#businessApp:not(.hidden)').waitFor({ state: 'visible', timeout: 35000 });
    const brand = await business.locator('[data-business-name]').first().innerText();
    need(brand.trim().length > 0 && !test.state.problem, 'EXISTING_BUSINESS_STAFF_ACCESS_REQUIRED');
    result.checks.actual_Business_staff_workspace_opened = true;
    await business.evaluate(userId => localStorage.removeItem('mushavo-budget:last-workspace:' + userId), actor.id);
    const normal = await test.context.newPage();
    // Business's ordinary stored destination is an application feature; this
    // isolated test selects Personal explicitly for the concurrent app tab.
    await normal.goto(WEB_ORIGIN + '/app#personal/dashboard', { waitUntil: 'domcontentloaded' });
    await readyDashboard(normal);
    armed = true;
    await business.bringToFront();
    await business.locator('#refreshBusinessLive').click();
    let timer;
    try { await Promise.race([arrived, new Promise((_, reject) => { timer = setTimeout(() => reject(new Stop('INFLIGHT_BUSINESS_RESPONSE_REQUIRED')), 20000); })]); }
    finally { clearTimeout(timer); }
    need(!heldFailure && result.actual_server_response_held, 'INFLIGHT_BUSINESS_RESPONSE_REQUIRED');
    result.held_response_HTTP_status = heldStatus;
    // The real pinned SDK validates and broadcasts an existing runner-owned
    // session. No password request, fake Auth event or altered response is used.
    const adoption = await normal.evaluate(async session => {
      const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm');
      const config = window.MUSHAVO_BUDGET_CONFIG;
      const client = createClient(config.supabaseUrl, config.supabasePublishableKey,
        { auth: { detectSessionInUrl: false, autoRefreshToken: false, persistSession: true } });
      const result = await client.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
      return { ok: !result.error, id: result.data?.user?.id };
    }, replacement.session);
    need(adoption.ok && adoption.id === replacement.id, 'REAL_REPLACEMENT_IDENTITY_REQUIRED');
    await business.locator('#businessApp').waitFor({ state: 'hidden' });
    await business.locator('#businessNoAccess:not(.hidden)').waitFor({ state: 'visible', timeout: 20000 });
    await readyDashboard(normal);
    const stored = await normal.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    need(stored.user?.id === replacement.id && tokenIdentity(stored.access_token)?.sessionId === tokenIdentity(replacement.token)?.sessionId,
      'REPLACEMENT_ACCOUNT_PERSISTENCE_REQUIRED');
    result.checks.real_distinct_replacement_session_adopted = true;
    result.checks.old_Business_view_hidden_before_response_release = true;
    const cleared = await business.evaluate(() => ({
      brandingDefault: [...document.querySelectorAll('[data-business-name]')].every(node => node.textContent.trim() === 'Business'),
      activityEmpty: document.querySelector('#businessClaimActivity')?.childElementCount === 0,
      overviewEmpty: document.querySelector('#businessOverviewClaims')?.childElementCount === 0,
      protectedDialogsClosed: [...document.querySelectorAll('dialog[open]')].length === 0
    }));
    need(Object.values(cleared).every(Boolean), 'OLD_BUSINESS_PRIVATE_DOM_NOT_CLEARED');
    result.checks.branding_activity_and_dialogs_cleared = true;
    releaseHeld(); await finished;
    need(!heldFailure, 'HELD_RESPONSE_NOT_COMPLETED');
    await business.waitForLoadState('networkidle');
    need(!await business.locator('#businessApp').isVisible() && await business.locator('#businessNoAccess').isVisible()
      && !test.state.problem, 'OLD_RESPONSE_REOPENED_BUSINESS_VIEW');
    result.checks.delayed_old_response_did_not_restore_private_view = true;
    await normal.reload({ waitUntil: 'domcontentloaded' });
    await readyDashboard(normal);
    const current = await normal.evaluate(key => JSON.parse(localStorage.getItem(key)), KEY);
    need(current?.user?.id === replacement.id, 'SWITCHED_ACCOUNT_RELOAD_REQUIRED');
    result.checks.replacement_Personal_dashboard_survives_reload = true;
    result.status = 'SCOPED_PASS';
    await input.scopedLogout(actor.token);
    evidence.cases.AU05_07_stale = await staleSessionSnapshot(actor, key, agent, fetcher);
    evidence.stale_session_snapshot_requests = 2;
    evidence.status = 'ACCOUNT_SWITCH_AND_STALE_SESSION_VARIANT_SCOPED_PASS';
  } catch (error) {
    result.problem_code = test?.state.problem || (error instanceof Stop ? error.code : 'ACCOUNT_SWITCH_BROWSER_EXPECTATION_NOT_MET');
    throw new Stop(result.problem_code);
  } finally {
    releaseHeld();
    await closeTestContext(test, result);
    await browser.close();
  }
}
