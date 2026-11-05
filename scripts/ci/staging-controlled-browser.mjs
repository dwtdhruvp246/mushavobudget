import { readFileSync } from 'node:fs';
import { need, Stop } from './staging-access.mjs';
import { isBoundRecoveryPasswordUpdate } from './staging-recovery.mjs';

const ORIGIN = 'https://mushavo-browser-test.invalid';
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
const INVITATION = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const SESSION = '44444444-4444-4444-8444-444444444444';
const EMAIL = 'invitee@example.invalid';
const PASSWORD = 'ControlledFixture9!';

function range(source, first, last, includeLast = false) {
  const start = source.indexOf(first);
  const end = source.indexOf(last, start + first.length);
  need(start >= 0 && end > start, 'EXACT_BUSINESS_CANDIDATE_CONTROLS_REQUIRED');
  return source.slice(start, end + (includeLast ? last.length : 0));
}

export async function checkControlledBrowser(chromium) {
  const report = { progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z',
    result: 'CONTROLLED_BROWSER_REVIEW_REQUIRED', case_ids: ['AU04.05', 'AU05.07'], checks: {},
    actual_hosted_backend_requests: 0, real_email_requests: 0, frontend_uploaded: false,
    live_recovery_save_retry_verified: false, deployed_business_candidate_verified: false, exit_code: 1 };
  let browser, stage = 'CANDIDATE_SOURCE';
  try {
    const html = readFileSync(new URL('../../business.html', import.meta.url), 'utf8');
    const js = readFileSync(new URL('../../business.js', import.meta.url), 'utf8');
    need(js.includes(`from "${SDK}"`), 'EXACT_CANDIDATE_SDK_VERSION_REQUIRED');
    const team = range(html, '<section class="business-panel hidden" data-business-panel="team">', '</section>', true)
      .replace('class="business-panel hidden"', 'class="business-panel"');
    const dialog = range(html, '<dialog id="businessInviteDialog"', '</dialog>', true);
    const clientModule = `import { createClient } from ${JSON.stringify(SDK)};
      const supabase = createClient(location.origin, 'fixture-only-publishable-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      });
      const $ = (selector) => document.querySelector(selector);
      const $$ = (selector) => [...document.querySelectorAll(selector)];
      const state = { workspace: { id: '${WORKSPACE}' }, teamSnapshot: { can_manage: true, capacity: { available: 1 } }, businessDimensions: [] };
      let workspaceLoadSequence = 1, teamBusy = false;
      const renderBusinessRoles = () => {}, refreshBusinessRoles = () => {};
      const renderMemberPermissionChoices = () => {}, updateBusinessInviteScopeHelp = () => {};
      const formatDate = value => value, formatRole = value => value;
      async function query(_label, pending) {
        const {data, error} = await pending;
        if (error) throw error;
        return data;
      }
      ${range(js, 'function friendlyMessage(', '\n}', true)}
      ${range(js, 'function renderTeam()', 'function renderIncomingInvitations()')}
      ${range(js, '$("#inviteBusinessMember").addEventListener', "$('[data-close-team-dialog]')")}
      ${range(js, '$("#businessInvitationList").addEventListener', '$("#incomingBusinessInvitations").addEventListener')}
      renderTeam();
      window.testAuth = supabase.auth;
    `;
    stage = 'CHROMIUM_SETUP';
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    context.setDefaultTimeout(15000);
    const expiresAt = Math.floor(Date.now() / 1000) + 600;
    const jwt = part => Buffer.from(JSON.stringify(part)).toString('base64url');
    const token = [jwt({ alg: 'HS256', typ: 'JWT' }), jwt({ sub: USER, session_id: SESSION, exp: expiresAt }), 'fixture'].join('.');
    const user = { id: USER, email: EMAIL, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const calls = { create: 0, snapshot: 0, resend: 0, authRead: 0, update: 0, refused: 0 };
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      if (url.origin === 'https://cdn.jsdelivr.net' && url.pathname.startsWith('/npm/') && method === 'GET') return route.continue();
      if (url.origin === ORIGIN) {
        if (method === 'GET' && url.pathname === '/') return route.fulfill({ contentType: 'text/html',
          body: `<!doctype html><meta charset="utf-8"><style>.hidden{display:none}</style>${team}${dialog}<script type="module" src="/fixture.mjs"></script>` });
        if (method === 'GET' && url.pathname === '/fixture.mjs') return route.fulfill({ contentType: 'text/javascript', body: clientModule });
        const json = (status, body) => route.fulfill({ status, json: body });
        const body = request.postDataJSON();
        if (method === 'POST' && url.pathname === '/functions/v1/invite-business-member') {
          if (body?.action === 'create' && body.workspace_id === WORKSPACE && body.email === EMAIL
            && body.role === 'staff' && body.scope_ids?.length === 0 && ++calls.create === 1) {
            return json(502, { error: 'BUSINESS_INVITATION_EMAIL_FAILED', invitation_id: INVITATION });
          }
          if (body?.action === 'resend' && body.invitation_id === INVITATION && ++calls.resend === 1) {
            return json(429, { error: 'BUSINESS_INVITATION_RATE_LIMITED' });
          }
        }
        if (method === 'POST' && url.pathname === '/rest/v1/rpc/business_team_snapshot'
          && body?.p_workspace_id === WORKSPACE && ++calls.snapshot === 1) {
          return json(200, { can_manage: true, members: [], capacity: { limit: 1, pending: 1, available: 0 },
            invitations: [{ id: INVITATION, email: EMAIL, role: 'staff', status: 'pending', delivery_status: 'failed', expires_at: 'Later' }] });
        }
        if (method === 'GET' && url.pathname === '/auth/v1/user'
          && await request.headerValue('authorization') === 'Bearer ' + token && ++calls.authRead === 1) {
          return json(200, user);
        }
        if (method === 'PUT' && url.pathname === '/auth/v1/user') {
          const bearer = (await request.headerValue('authorization') || '').replace(/^Bearer /i, '');
          if (isBoundRecoveryPasswordUpdate(body, bearer, { userId: USER, sessionId: SESSION }, PASSWORD)
            && body.code_challenge === null && body.code_challenge_method === null) {
            if (++calls.update === 1) return route.abort('internetdisconnected');
            if (calls.update === 2) return json(200, user);
          }
        }
      }
      calls.refused++;
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    stage = 'TEAM_CREATE_502';
    await page.goto(ORIGIN);
    await page.locator('#inviteBusinessMember').click();
    await page.locator('#businessInviteEmail').fill(EMAIL);
    await page.locator('#saveBusinessInvitation').click();
    await page.getByText('The invitation was saved, but email delivery failed. Use Resend in the pending invitations list.', { exact: true })
      .waitFor({ state: 'visible' });
    const pending = page.locator('#businessInvitationList');
    need(!await page.locator('#businessInviteDialog').isVisible()
      && await pending.getByText(EMAIL, { exact: true }).count() === 1
      && await page.locator('#businessPendingSeats').innerText() === '1', 'SAVED_FAILED_INVITATION_MUST_APPEAR_ONCE');
    report.checks.controlled_502_saved_invitation_and_resend_visible = true;

    stage = 'TEAM_RESEND_429';
    await pending.getByRole('button', { name: 'Resend', exact: true }).click();
    await page.getByText('Wait one minute before resending this invitation.', { exact: true }).waitFor({ state: 'visible' });
    need(await pending.getByText(EMAIL, { exact: true }).count() === 1
      && calls.create === 1 && calls.resend === 1 && calls.snapshot === 1, 'RATE_LIMIT_MUST_KEEP_THE_EXISTING_INVITATION');
    report.checks.controlled_429_wait_guidance_and_existing_row_retained = true;

    stage = 'SDK_PASSWORD_UPDATE';
    const sdkResult = await page.evaluate(async ({ token, password }) => {
      const setup = await window.testAuth.setSession({ access_token: token, refresh_token: 'controlled-fixture' });
      if (setup.error) return { setup: false };
      const first = await window.testAuth.updateUser({ password });
      const second = await window.testAuth.updateUser({ password });
      return { setup: true, failed: Boolean(first.error), succeeded: !second.error && second.data.user?.id === setup.data.user?.id };
    }, { token, password: PASSWORD });
    need(sdkResult.setup && sdkResult.failed && sdkResult.succeeded && calls.update === 2
      && calls.authRead === 1 && calls.refused === 0, 'EXACT_SDK_PASSWORD_PAYLOAD_AND_CONTROLLED_RETRY_REQUIRED');
    report.checks.real_sdk_null_PKCE_fields_and_exact_session_guard_verified = true;
    report.result = 'CONTROLLED_BROWSER_SCOPED_PASS';
    report.exit_code = 0;
  } catch (error) {
    report.problem_code = error instanceof Stop ? error.code : 'CONTROLLED_BROWSER_EXPECTATION_NOT_MET_' + stage;
  } finally {
    if (browser) await browser.close();
  }
  return report;
}
