// Staging metadata only. No Auth user endpoint, factor operation or settings write.
import {stateSQL} from './email-bounded-http-sql.mjs';
import {closedState} from './admin-batch-v-mfa.mjs';
import {boundedBody} from './fr-2-operator-mfa.mjs';

export const stage = 'FR.2.5.W1_AUTH_SETTINGS_READ_ONLY_AND_FROZEN_AU31';
export const display = 'Stage 3/10 | FR.2/8 | Batch W/Z';
export const project = 'dczlddwbtgvfdujgcitb';
export const base = `https://api.supabase.com/v1/projects/${project}`;
export const origin = 'https://mushavo-budget-staging.pages.dev';
export const flows = ['confirm', 'recover', 'business-new', 'business-existing'];
const own = (o, k) => Object.hasOwn(o, k);
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const need = (v, code) => { if (!v) throw new ReviewError(code); };
export class ReviewError extends Error {}
const safe = e => e instanceof ReviewError ? e.message : 'BATCH_W_PRIVATE_RESPONSE_OR_TRANSPORT_REVIEW_REQUIRED';

// Return fixed field names and typed public values only. Unknown fields, SMTP,
// provider keys, template bodies, arbitrary strings and URLs are never copied.
export function projectAuthSettings(config) {
  need(object(config), 'BATCH_W_CONFIG_OBJECT_REQUIRED');
  const missing = [];
  const bool = k => {
    if (!own(config, k) || config[k] === null) { missing.push(k); return null; }
    need(typeof config[k] === 'boolean', 'BATCH_W_BOOLEAN_FIELD_REVIEW_REQUIRED');
    return config[k];
  };
  const integer = k => {
    if (!own(config, k) || config[k] === null) { missing.push(k); return null; }
    need(Number.isSafeInteger(config[k]) && config[k] >= 0, 'BATCH_W_INTEGER_FIELD_REVIEW_REQUIRED');
    return config[k];
  };
  const text = (k, max) => {
    if (!own(config, k) || config[k] === null) { missing.push(k); return null; }
    need(typeof config[k] === 'string' && config[k].length <= max, 'BATCH_W_TEXT_FIELD_REVIEW_REQUIRED');
    return config[k];
  };
  const autoconfirm = bool('mailer_autoconfirm');
  const summary = {
    email_signin_enabled: bool('external_email_enabled'),
    signup_disabled: bool('disable_signup'),
    email_confirmation_enabled: autoconfirm === null ? null : !autoconfirm,
    unverified_email_signins_allowed: bool('mailer_allow_unverified_email_sign_ins'),
    minimum_password_length: integer('password_min_length'),
    required_character_class: 'UNKNOWN',
    require_current_password_on_change: bool('security_update_password_require_current_password'),
    require_reauthentication_on_password_change: bool('security_update_password_require_reauthentication'),
    secure_email_change_enabled: bool('mailer_secure_email_change_enabled'),
    leaked_password_protection_enabled: bool('password_hibp_enabled'),
    refresh_token_rotation_enabled: bool('refresh_token_rotation_enabled'),
    single_session_per_user: bool('sessions_single_per_user'),
    session_timebox_seconds: integer('sessions_timebox'),
    session_inactivity_timeout_seconds: integer('sessions_inactivity_timeout'),
    refresh_token_reuse_interval_seconds: integer('security_refresh_token_reuse_interval'),
    JWT_lifetime_seconds: integer('jwt_exp'),
    email_OTP_expiry_seconds: integer('mailer_otp_exp'),
    rate_limits: Object.fromEntries(['rate_limit_email_sent', 'rate_limit_otp', 'rate_limit_verify', 'rate_limit_token_refresh'].map(k => [k, integer(k)])),
  };
  const chars = text('password_required_characters', 512);
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (chars !== null) {
    summary.required_character_class = chars === '' ? 'NONE'
      : chars === letters + ':0123456789' ? 'LETTERS_AND_DIGITS'
      : chars === 'abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789' ? 'LOWER_UPPER_AND_DIGITS'
      : 'CUSTOM_OR_UNRECOGNIZED';
  }
  const site = text('site_url', 8192);
  let siteClass = site === null ? 'MISSING' : 'INVALID_OR_OTHER';
  if (site !== null) {
    try {
      const u = new URL(site);
      if (!u.username && !u.password && !u.search && !u.hash) {
        if (u.origin === origin) siteClass = u.pathname === '/' ? 'CANONICAL_STAGING_ROOT' : 'CANONICAL_STAGING_OTHER_PATH';
        else if (/^https:\/\/[a-f0-9]{8}\.mushavo-budget-staging\.pages\.dev$/.test(u.origin)) siteClass = 'STAGING_DEPLOYMENT';
        else if (u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)) siteClass = 'LOCAL_HTTP';
        else if (u.protocol === 'https:') siteClass = 'OTHER_HTTPS';
      }
    } catch { /* Return a fixed enum only. */ }
  }
  const redirects = text('uri_allow_list', 65536);
  const entries = redirects === null || redirects.trim() === '' ? [] : redirects.split(',').map(x => x.trim());
  need(entries.length <= 256, 'BATCH_W_REDIRECT_BOUND_REQUIRED');
  const callbacks = Object.fromEntries(flows.map(flow => [flow, entries.includes(`${origin}/auth.html?flow=${flow}`)]));
  let glob = 0, other = 0, invalid = 0;
  for (const entry of entries) {
    // No glob expansion or external fetch. Literal presence is not provider acceptance.
    if (/[\*?\[\]{}]/.test(entry.replace(/^https:\/\/[^/]+\/auth\.html\?flow=(confirm|recover|business-new|business-existing)$/, ''))) glob++;
    try {
      const u = new URL(entry);
      if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.hash) invalid++;
      if (u.origin !== origin) other++;
    } catch { invalid++; }
  }
  summary.callbacks = {
    site_url_class: siteClass,
    allow_list_observed: redirects !== null,
    allow_list_entries: entries.length,
    exact_canonical_root_listed: entries.includes(origin) || entries.includes(origin + '/'),
    exact_auth_path_listed: entries.includes(origin + '/auth.html'),
    exact_flow_literals_listed: callbacks,
    pattern_or_wildcard_entries: glob,
    other_origin_entries: other,
    invalid_or_unsupported_entries: invalid,
    provider_redirect_matching_or_delivery_verified: false,
  };
  summary.fields_missing_or_null = missing.sort();
  const review = [];
  if (summary.minimum_password_length !== 12) review.push(summary.minimum_password_length === null ? 'PASSWORD_MINIMUM_UNKNOWN' : 'SERVER_AND_PINNED_UI_PASSWORD_MINIMUM_DIFFER');
  if (summary.email_confirmation_enabled !== true) review.push('EMAIL_CONFIRMATION_NOT_CONFIRMED_ENABLED');
  if (summary.unverified_email_signins_allowed !== false) review.push('UNVERIFIED_EMAIL_SIGNIN_POLICY_REQUIRES_REVIEW');
  if (summary.required_character_class === 'CUSTOM_OR_UNRECOGNIZED' || summary.required_character_class === 'UNKNOWN') review.push('PASSWORD_CHARACTER_RULE_REQUIRES_REVIEW');
  if (summary.require_reauthentication_on_password_change === null || summary.require_current_password_on_change === null) review.push('PASSWORD_CHANGE_REQUIREMENTS_PARTLY_UNKNOWN');
  if (siteClass !== 'CANONICAL_STAGING_ROOT') review.push('SITE_URL_REQUIRES_REVIEW');
  if (redirects === null || !Object.values(callbacks).every(Boolean)) review.push('CALLBACK_LITERAL_OR_PATTERN_REVIEW_REQUIRED');
  if (invalid || other || glob) review.push('REDIRECT_PATTERN_OR_OTHER_ORIGIN_REVIEW_REQUIRED');
  return {settings: summary, pinned_UI_new_password_minimum: 12, review_items: review,
    configuration_readback_is_not_workflow_acceptance: true,
    existing_password_login_or_new_password_boundary_exercised: false};
}

function target(x) {
  need(object(x) && (x.ref === project || !own(x, 'ref') && x.id === project)
    && !(typeof x.id === 'string' && /^[a-z]{20}$/.test(x.id) && x.id !== project)
    && x.status === 'ACTIVE_HEALTHY' && x.database?.host === `db.${project}.supabase.co`, 'BATCH_W_TARGET_REQUIRED');
}

export async function reviewAuthSettings(input, {transport = fetch} = {}) {
  const r = {stage_step: stage, progress_display: display, batch: 'W',
    result: 'BATCH_W_READ_ONLY_AUTH_SETTINGS_REVIEW_REQUIRED',
    actual_hosted_requests: 0, maximum_direct_HTTP_requests: 5, Management_requests: 0,
    Auth_requests: 0, Auth_configuration_GET_requests: 0, SQL_read_only_snapshot_requests: 0,
    target_before_verified: false, target_after_verified: false,
    quarantined_catalog_before_verified: false, quarantined_catalog_after_verified: false,
    Auth_settings_read: false, safe_settings: null, samples: [],
    automatic_request_retries: 0, real_email_requests: 0, factor_changes_requested: false,
    settings_or_roles_or_accounts_or_sessions_changed: false,
    application_rows_read_or_written: false, private_packets_accessed: false,
    raw_config_credentials_URLs_or_provider_bodies_printed: false,
    credentials_saved_to_disk_arguments_or_environment: false,
    committed_mode_change_requests: 0, pending_batch_V_MFA_deferred_by_owner: true,
    full_lettered_batch_W_complete: false, hosted_Auth_workflow_acceptance: false,
    hosted_acceptance: false, live_activation_approved: false,
    production_or_native_changed: false, APK_update_deferred: true, findings_closed: [],
    failure_checkpoint: null, final_state_problem_code: null,
    checkpoint: 'PRIVATE_INPUT', problem_code: null, exit_code: 1};
  let targetReady = false, inspected = false, query;
  async function request(label, suffix = '', sql = false) {
    r.checkpoint = label;
    need(r.actual_hosted_requests < 5, 'BATCH_W_REQUEST_BOUND');
    r.actual_hosted_requests++; r.Management_requests++;
    if (sql) r.SQL_read_only_snapshot_requests++;
    if (suffix === '/config/auth') r.Auth_configuration_GET_requests++;
    const url = base + suffix;
    let response;
    try {
      response = await transport(url, {method: sql ? 'POST' : 'GET', redirect: 'error',
        signal: AbortSignal.timeout(40000), headers: {Authorization: 'Bearer ' + input.managementToken,
          Accept: 'application/json', ...(sql ? {'Content-Type': 'application/json'} : {})},
        ...(sql ? {body: JSON.stringify({query, read_only: false})} : {})});
      r.samples.push({endpoint: label, http_status: Number.isInteger(response?.status) ? response.status : null});
      need(!response.redirected && (!response.url || response.url === url), 'BATCH_W_REDIRECT_REFUSED');
      if (suffix === '/config/auth' && [401, 403].includes(response.status)) throw new ReviewError('BATCH_W_EXISTING_TOKEN_AUTH_CONFIG_READ_NOT_AUTHORIZED');
      need(response.status === (sql ? 201 : 200), response.status === 429 ? 'BATCH_W_RATE_LIMIT_NO_RETRY' : 'BATCH_W_HTTP_STATUS_REVIEW_REQUIRED');
      need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type') || ''), 'BATCH_W_JSON_RESPONSE_REQUIRED');
      let text = await boundedBody(response, suffix === '/config/auth' ? 2 * 1024 * 1024 : 262144);
      try { return JSON.parse(text); } finally { text = ''; }
    } finally { await response?.body?.cancel().catch(() => {}); }
  }
  async function quarantine(label) {
    const rows = await request(label, '/database/query', true);
    need(Array.isArray(rows) && rows.length === 1 && object(rows[0])
      && Object.keys(rows[0]).length === 1 && own(rows[0], 'bounded_state'), 'BATCH_W_SQL_ROWSET_REQUIRED');
    try { closedState(rows[0].bounded_state); } catch { throw new ReviewError('BATCH_W_QUARANTINED_CATALOG_REQUIRED'); }
  }
  try {
    need(object(input) && Object.keys(input).length === 1 && /^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.managementToken || ''), 'BATCH_W_PRIVATE_INPUT_REQUIRED');
    query = await stateSQL();
    target(await request('TARGET_BEFORE')); targetReady = true; r.target_before_verified = true;
    await quarantine('QUARANTINED_CATALOG_BEFORE'); r.quarantined_catalog_before_verified = true;
    let config = await request('READ_AUTH_SETTINGS', '/config/auth');
    try { r.safe_settings = projectAuthSettings(config); r.Auth_settings_read = true; inspected = true; }
    finally { config = null; }
  } catch (e) { r.failure_checkpoint = r.checkpoint; r.problem_code = safe(e); }
  finally {
    if (targetReady) {
      try { await quarantine('QUARANTINED_CATALOG_AFTER'); r.quarantined_catalog_after_verified = true; }
      catch (e) { r.final_state_problem_code = safe(e); }
      try { target(await request('TARGET_AFTER')); r.target_after_verified = true; }
      catch (e) { r.final_state_problem_code ??= safe(e); }
    }
  }
  if (inspected && !r.problem_code && !r.final_state_problem_code) {
    r.result = 'BATCH_W_READ_ONLY_AUTH_SETTINGS_INSPECTION_COMPLETE';
    r.checkpoint = 'COMPLETE'; r.exit_code = 0;
  }
  r.checked_UTC = new Date().toISOString();
  return r;
}
