// 2.2.3: bounded owner-local staging checks; no service secret or production login.
const { createHash } = require('node:crypto');
const STAGING = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const WEBSITE = 'https://mushavo-budget-staging.pages.dev';
const SITE_HASH = 'a4cf1add2b9f702fe21ac956e380c1ae99b4afe2d291b6b606c57f1598fc507d';
const HTML_HASH = 'f52e51744229c8de735a675f305810c68837695600bc370d3b177ef4d90e9159';
const normalize = text => text.replace(/\r\n?/g, '\n').trimEnd();
const hash = text => createHash('sha256').update(normalize(text)).digest('hex');
const permissionDenied = r => [401, 403].includes(r.status) && r.data?.code === '42501';
class GuardError extends Error {}
function parseConfig(text) {
  let config;
  try {
    const match = text.match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
    config = JSON.parse(match?.[1] || '');
  } catch { throw new GuardError('DEPLOYED_CONFIG_UNRECOGNIZED'); }
  if (config.supabaseUrl !== STAGING || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey || '') ||
      config.vapidPublicKey !== '' || text.includes('kttkospkblwvguuwnhjj') ||
      Object.keys(config).sort().join(',') !== 'supabasePublishableKey,supabaseUrl,vapidPublicKey') {
    throw new GuardError('DEPLOYED_CONFIG_NOT_ISOLATED_STAGING');
  }
  return config;
}
async function run({ fetcher = fetch, password = '', now = Date.now } = {}) {
  const checks = [];
  let config, token, problem = null, logoutOk = null;
  const marker = 'AUDIT-S223-API-' + now();
  const payload = { full_name: 'Contact API Audit', email: 'audit.bypass@example.com', country_code: 'ZW',
    country_name: 'Zimbabwe', enquiry_type: 'support', message: marker + ' synthetic staging bypass test.' };
  const record = (check, ok, r) => checks.push({ check, status: ok ? 'PASS' : 'FAIL', ...(r ? { http_status: r.status } : {}) });
  async function getFile(path) {
    const r = await fetcher(WEBSITE + path, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    if (r.status !== 200 || (r.url && !r.url.startsWith(WEBSITE + '/'))) throw new GuardError('DEPLOYED_ASSET_FETCH_FAILED');
    return { text: await r.text(), headers: r.headers };
  }
  async function request(path, { method = 'POST', body, auth, origin = WEBSITE, headers: extra = {} } = {}) {
    const headers = { apikey: config.supabasePublishableKey, Accept: 'application/json', ...extra };
    if (origin !== null) headers.Origin = origin;
    if (auth) headers.Authorization = 'Bearer ' + auth;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const r = await fetcher(STAGING + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error', signal: AbortSignal.timeout(15000) });
    let data = null;
    try { data = JSON.parse(await r.text()); } catch { /* Non-JSON cannot pass a denial receipt. */ }
    return { status: r.status, data, headers: r.headers };
  }
  try {
    config = parseConfig((await getFile('/config.js')).text);
    record('Deployed config is staging only', true);
    const site = await getFile('/site.js');
    const html = await getFile('/contact.html');
    const siteMatches = hash(site.text) === SITE_HASH;
    const keyMatches = (html.text.match(/data-sitekey="0x[A-Za-z0-9_-]{10,100}"/g) || []).length === 1;
    const htmlMatches = keyMatches && hash(html.text.replace(/data-sitekey="0x[A-Za-z0-9_-]{10,100}"/, 'data-sitekey=""')) === HTML_HASH;
    record('Deployed contact JavaScript matches reviewed candidate', siteMatches);
    record('Deployed contact HTML matches candidate with real-format public sitekey', htmlMatches);
    if (!siteMatches || !htmlMatches) throw new GuardError('DEPLOYED_CONTACT_CANDIDATE_MISMATCH');
    const csp = html.headers.get('content-security-policy') || '';
    const report = html.headers.get('content-security-policy-report-only') || '';
    record('Served headers retain baseline CSP and Turnstile allowances',
      csp.includes("object-src 'none'") && csp.includes("frame-ancestors 'none'") &&
      /script-src[^;]*https:\/\/challenges\.cloudflare\.com/.test(report) &&
      /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/.test(report) && !report.includes('kttkospkblwvguuwnhjj'));
    const endpoint = '/functions/v1/submit-enquiry';
    const preflight = await request(endpoint, { method: 'OPTIONS', headers: {
      'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,apikey' } });
    record('Staging browser preflight is allowed', preflight.status === 204 && preflight.headers.get('access-control-allow-origin') === WEBSITE, preflight);
    const cases = [
      ['Missing website origin is rejected', { origin: null, body: { ...payload, turnstile_token: '' } }, 403, 'ORIGIN_DENIED'],
      ['Unexpected administrative field is rejected', { body: { ...payload, turnstile_token: 'audit-forged-token', status: 'new' } }, 400, 'INVALID_SUBMISSION'],
      ['Oversized request is rejected', { body: { ...payload, turnstile_token: 'audit-forged-token', message: 'x'.repeat(33000) } }, 413, 'SUBMISSION_TOO_LARGE'],
      ['Missing verification token is rejected', { body: { ...payload, turnstile_token: '' } }, 400, 'VERIFICATION_REQUIRED'],
      ['Forged verification token is rejected by live validation', { body: { ...payload, turnstile_token: 'audit-forged-token' } }, 400, 'VERIFICATION_REQUIRED'],
    ];
    for (const [name, options, status, code] of cases) {
      const r = await request(endpoint, options);
      record(name, r.status === status && r.data?.code === code, r);
    }
    async function roleChecks(label, auth) {
      const insert = await request('/rest/v1/enquiries', { body: payload, auth });
      record(label + ' direct enquiry INSERT is permission-denied', permissionDenied(insert), insert);
      const rpc = await request('/rest/v1/rpc/submit_verified_public_enquiry', {
        body: { p_submission: payload, p_email_hash: 'b'.repeat(64) }, auth });
      record(label + ' direct submission RPC is permission-denied', permissionDenied(rpc), rpc);
      const counters = await request('/rest/v1/enquiry_submission_limits?select=scope&limit=1', { method: 'GET', auth });
      record(label + ' quota-counter read is permission-denied', permissionDenied(counters), counters);
    }
    await roleChecks('Anonymous');
    if (password) {
      const login = await request('/auth/v1/token?grant_type=password', { body: { email: 'audit.owner@example.com', password } });
      if (login.status !== 200 || typeof login.data?.access_token !== 'string') throw new GuardError('STAGING_APP_USER_LOGIN_FAILED');
      token = login.data.access_token;
      const identity = await request('/auth/v1/user', { method: 'GET', auth: token });
      if (identity.status !== 200 || identity.data?.id !== login.data?.user?.id || identity.data?.email !== 'audit.owner@example.com') {
        throw new GuardError('STAGING_SESSION_IDENTITY_FAILED');
      }
      record('Existing staging app-user session is verified', true);
      await roleChecks('Signed-in');
    } else {
      checks.push({ check: 'Signed-in bypass checks', status: 'UNVERIFIED', reason: 'OWNER_SKIPPED_TEST_ACCOUNT_PASSWORD' });
    }
  } catch (error) {
    problem = error instanceof GuardError ? error.message : 'NETWORK_OR_LOCAL_CHECK_ERROR';
  } finally {
    if (token) {
      try { const r = await request('/auth/v1/logout?scope=local', { auth: token }); logoutOk = [200, 204].includes(r.status); }
      catch { logoutOk = false; }
      record('Only the API test session is logged out', logoutOk);
    }
  }
  const failed = checks.some(check => check.status === 'FAIL');
  return { stage_step: '2.2.3', result: problem || failed ? 'STAGING_CONTACT_API_REVIEW' :
    password ? 'STAGING_CONTACT_API_SCOPED_PASS' : 'STAGING_CONTACT_API_SCOPED_PASS_SIGNED_IN_UNVERIFIED',
    project: 'dczlddwbtgvfdujgcitb', checks, problem_code: problem,
    test_session_logged_out: logoutOk, credentials_tokens_keys_and_raw_rows_printed: false,
    valid_browser_enquiry_or_real_key_pair_verified: false, same_email_quota_concurrency_or_rollback_verified: false,
    staff_queue_access_or_dispatch_verified: false, full_f09_acceptance_verified: false,
    unexpected_bypass_test_rows_if_any_retained: true, completed_utc: new Date(now()).toISOString() };
}
module.exports = { run, parseConfig, permissionDenied, normalize, hash, STAGING, WEBSITE, SITE_HASH, HTML_HASH };
if (require.main === module) {
  run({ password: process.env.MUSHAVO_CONTACT_TEST_PASSWORD || '' }).then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (result.result === 'STAGING_CONTACT_API_REVIEW') process.exitCode = 1;
  }).catch(() => { console.log(JSON.stringify({ stage_step: '2.2.3', result: 'STAGING_CONTACT_API_REVIEW', problem_code: 'LOCAL_CHECK_FAILURE' })); process.exitCode = 1; });
}
