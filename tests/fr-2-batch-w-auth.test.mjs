import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {projectAuthSettings, reviewAuthSettings, base, origin, flows} from '../scripts/lib/auth-batch-w-review.mjs';
import {authReviewEntry, unsafePrivateEnvironment, verifyWSources} from '../scripts/review-fr-2-batch-w-auth.mjs';

const token = 'sbp_fc' + 'SYNTHETIC_TEST_TOKEN_ONLY_'.repeat(2);
const closed = () => ({context: {privileged_origin: true, transaction_read_only: 'on'},
  catalog_kind: 'BOUNDED', control_rows: 1, mode: 'QUARANTINED', quarantined_stamp_matched: true,
  predicate_source_matched: true, stamp_matched: true, window_present: true, window_empty: true,
  guarded_RPCs: 148, restrictive_policies: 82, backend_forced_RLS_tables: 5, private_schema_API_denied: true,
  private_fence: 'SYNTHETIC_PRIVATE_FENCE_NEVER_PRINT'});
const project = () => ({ref: 'dczlddwbtgvfdujgcitb', status: 'ACTIVE_HEALTHY', database: {host: 'db.dczlddwbtgvfdujgcitb.supabase.co'}});
const config = () => ({mailer_autoconfirm: false, external_email_enabled: true, disable_signup: false,
  mailer_allow_unverified_email_sign_ins: false, password_min_length: 12, password_required_characters: '',
  security_update_password_require_current_password: false, security_update_password_require_reauthentication: true,
  mailer_secure_email_change_enabled: true, password_hibp_enabled: false, refresh_token_rotation_enabled: true,
  sessions_single_per_user: false, sessions_timebox: 0, sessions_inactivity_timeout: 0,
  security_refresh_token_reuse_interval: 10, jwt_exp: 3600, mailer_otp_exp: 3600,
  rate_limit_email_sent: 30, rate_limit_otp: 360, rate_limit_verify: 360, rate_limit_token_refresh: 1800,
  site_url: origin + '/', uri_allow_list: flows.map(x => origin + '/auth.html?flow=' + x).join(',')});
function fixture({change, failAt, responseAt} = {}) {
  const calls = [];
  const transport = async (url, options) => {
    calls.push({url, options}); const i = calls.length;
    if (i === failAt) throw Error('PRIVATE_TOKEN_EMAIL_OR_PROVIDER_MESSAGE_MUST_NOT_LEAK');
    if (responseAt?.[i]) return responseAt[i]();
    let value = url.endsWith('/config/auth') ? config() : url.endsWith('/database/query') ? [{bounded_state: closed()}] : project();
    if (change) value = change({i, url, value}) ?? value;
    return Response.json(value, {status: url.endsWith('/database/query') ? 201 : 200});
  };
  return {calls, transport, run: () => reviewAuthSettings({managementToken: token}, {transport})};
}
const assertPrivate = value => {
  const s = JSON.stringify(value);
  for (const forbidden of [token, 'SMTP_PRIVATE_CANARY', 'PROVIDER_SECRET_CANARY', 'private-inbox@example.invalid',
    'SYNTHETIC_PRIVATE_FENCE_NEVER_PRINT', 'PRIVATE_TOKEN_EMAIL_OR_PROVIDER_MESSAGE_MUST_NOT_LEAK', 'private-host.invalid']) assert(!s.includes(forbidden));
};

test('five fixed Management reads inspect Auth settings and quarantine; no Auth endpoint or mutable SQL', async () => {
  const f = fixture(), r = await f.run();
  assert.equal(r.exit_code, 0); assert.equal(r.actual_hosted_requests, 5); assert.equal(r.Auth_requests, 0);
  assert.equal(r.Auth_configuration_GET_requests, 1); assert.equal(r.SQL_read_only_snapshot_requests, 2);
  assert.deepEqual(f.calls.map(x => x.url), [base, base + '/database/query', base + '/config/auth', base + '/database/query', base]);
  for (const c of f.calls) {
    assert.equal(c.options.redirect, 'error'); assert.equal(c.options.headers.Authorization, 'Bearer ' + token);
    if (c.url.endsWith('/database/query')) {
      assert.equal(c.options.method, 'POST'); const q = JSON.parse(c.options.body);
      assert.equal(q.read_only, false); assert.match(q.query, /^BEGIN TRANSACTION READ ONLY;/); assert.match(q.query, /\nROLLBACK;\n$/);
      assert.match(q.query, /EMAIL_L_PRIVILEGED_READ_ONLY_REQUIRED/); assert(!q.query.includes(token));
    } else { assert.equal(c.options.method, 'GET'); assert.equal(c.options.body, undefined); }
  }
  assert.equal(r.quarantined_catalog_after_verified, true); assert.equal(r.safe_settings.settings.minimum_password_length, 12);
  assert.equal(r.full_lettered_batch_W_complete, false); assert.equal(r.pending_batch_V_MFA_deferred_by_owner, true); assertPrivate(r);
});

test('SMTP, OAuth secrets, addresses, URLs, unknown config and private fence never reach receipt', async () => {
  const f = fixture({change: ({url, value}) => url.endsWith('/config/auth') ? {...value,
    smtp_pass: 'SMTP_PRIVATE_CANARY', external_google_secret: 'PROVIDER_SECRET_CANARY', smtp_user: 'private-inbox@example.invalid',
    site_url: 'https://private-host.invalid/private?token=PROVIDER_SECRET_CANARY',
    uri_allow_list: 'https://private-host.invalid/callback?secret=PROVIDER_SECRET_CANARY',
    unknown: {value: token}, mailer_templates_recovery_content: '<a>SMTP_PRIVATE_CANARY</a>'} : value});
  const r = await f.run(); assert.equal(r.exit_code, 0); assertPrivate(r);
  assert.equal(r.safe_settings.settings.callbacks.site_url_class, 'INVALID_OR_OTHER');
  assert.equal(r.safe_settings.settings.callbacks.other_origin_entries, 1);
});

test('missing/null settings stay UNKNOWN and never imply disabled defaults or a workflow pass', () => {
  const r = projectAuthSettings({});
  assert.equal(r.settings.email_confirmation_enabled, null); assert.equal(r.settings.require_current_password_on_change, null);
  assert.equal(r.settings.minimum_password_length, null); assert.equal(r.settings.callbacks.allow_list_observed, false);
  assert(r.settings.fields_missing_or_null.includes('password_min_length'));
  assert(r.review_items.includes('PASSWORD_MINIMUM_UNKNOWN')); assert.equal(r.existing_password_login_or_new_password_boundary_exercised, false);
});

test('strict field types reject secret-shaped strings without printing the field value', async () => {
  for (const fields of [{mailer_autoconfirm: 'PROVIDER_SECRET_CANARY'}, {password_min_length: 'SMTP_PRIVATE_CANARY'},
    {sessions_timebox: -1}, {jwt_exp: 1.5}, {password_required_characters: {}}, {uri_allow_list: []}]) {
    const r = await fixture({change: ({url, value}) => url.endsWith('/config/auth') ? {...value, ...fields} : value}).run();
    assert.equal(r.exit_code, 1); assert.equal(r.failure_checkpoint, 'READ_AUTH_SETTINGS');
    assert.equal(r.quarantined_catalog_after_verified, true); assertPrivate(r);
  }
});

test('password-policy difference is an explicit review item, not a configuration write or failed inspection', async () => {
  for (const minimum of [8, 16]) {
    const r = await fixture({change: ({url, value}) => url.endsWith('/config/auth') ? {...value, password_min_length: minimum} : value}).run();
    assert.equal(r.exit_code, 0); assert.equal(r.safe_settings.settings.minimum_password_length, minimum);
    assert(r.safe_settings.review_items.includes('SERVER_AND_PINNED_UI_PASSWORD_MINIMUM_DIFFER'));
    assert.equal(r.settings_or_roles_or_accounts_or_sessions_changed, false); assert.equal(r.hosted_Auth_workflow_acceptance, false);
  }
});

test('known and unknown character rules expose only fixed classifications', () => {
  for (const [chars, label] of [['', 'NONE'], ['abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789', 'LETTERS_AND_DIGITS'],
    ['abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789', 'LOWER_UPPER_AND_DIGITS'], ['SMTP_PRIVATE_CANARY', 'CUSTOM_OR_UNRECOGNIZED']]) {
    const r = projectAuthSettings({...config(), password_required_characters: chars});
    assert.equal(r.settings.required_character_class, label); assertPrivate(r);
  }
});

test('callback projection counts patterns and foreign origins without assuming provider glob semantics', () => {
  const r = projectAuthSettings({...config(), uri_allow_list: origin + '/**,https://private-host.invalid/auth.html,http://localhost:3000/**,not-a-url'});
  assert.equal(r.settings.callbacks.pattern_or_wildcard_entries, 2); assert.equal(r.settings.callbacks.other_origin_entries, 2);
  assert.equal(r.settings.callbacks.invalid_or_unsupported_entries, 1);
  assert(Object.values(r.settings.callbacks.exact_flow_literals_listed).every(x => x === false));
  assert.equal(r.settings.callbacks.provider_redirect_matching_or_delivery_verified, false); assertPrivate(r);
});

test('site URL classification refuses credentials, fragment/query and lookalike staging origins', () => {
  for (const url of [origin + '?access_token=PROVIDER_SECRET_CANARY', origin + '#PROVIDER_SECRET_CANARY',
    'https://SMTP_PRIVATE_CANARY@example.invalid/', 'https://mushavo-budget-staging.pages.dev.private-host.invalid/']) {
    const r = projectAuthSettings({...config(), site_url: url});
    assert.notEqual(r.settings.callbacks.site_url_class, 'CANONICAL_STAGING_ROOT'); assertPrivate(r);
  }
  assert.equal(projectAuthSettings({...config(), site_url: 'https://28beb907.mushavo-budget-staging.pages.dev/'}).settings.callbacks.site_url_class, 'STAGING_DEPLOYMENT');
});

test('all five direct transport failures stop without retry and retain independent final readback where target was established', async () => {
  for (let failAt = 1; failAt <= 5; failAt++) {
    const f = fixture({failAt}), r = await f.run();
    assert.equal(r.exit_code, 1); assert(r.actual_hosted_requests <= 5); assert.equal(r.automatic_request_retries, 0);
    assert.equal(f.calls.filter(x => x.url.endsWith('/config/auth')).length, failAt <= 2 ? 0 : 1);
    if (failAt === 1) assert.equal(f.calls.length, 1);
    else assert.equal(f.calls.at(-1).url, base);
    assertPrivate(r);
  }
});

test('existing-token 401/403 Auth-read denial is explicit, never triggers a new token or settings retry', async () => {
  for (const status of [401, 403]) {
    const f = fixture({responseAt: {3: () => Response.json({message: 'SMTP_PRIVATE_CANARY'}, {status})}}), r = await f.run();
    assert.equal(r.problem_code, 'BATCH_W_EXISTING_TOKEN_AUTH_CONFIG_READ_NOT_AUTHORIZED'); assert.equal(r.exit_code, 1);
    assert.equal(r.actual_hosted_requests, 5); assert.equal(r.quarantined_catalog_after_verified, true); assertPrivate(r);
  }
});

test('HTTP status, redirect, media type, malformed JSON and oversized responses fail safely without provider bodies', async () => {
  const variants = [() => Response.json({message: 'SMTP_PRIVATE_CANARY'}, {status: 429}),
    () => Response.json({message: 'SMTP_PRIVATE_CANARY'}, {status: 500}),
    () => new Response('SMTP_PRIVATE_CANARY', {status: 200, headers: {'Content-Type': 'text/plain'}}),
    () => new Response('SMTP_PRIVATE_CANARY', {status: 200, headers: {'Content-Type': 'application/json'}}),
    () => new Response('x'.repeat(2 * 1024 * 1024 + 1), {status: 200, headers: {'Content-Type': 'application/json'}}),
    () => { const r = Response.json(config()); Object.defineProperty(r, 'redirected', {value: true}); return r; }];
  for (const v of variants) {
    const r = await fixture({responseAt: {3: v}}).run(); assert.equal(r.exit_code, 1);
    assert.equal(r.failure_checkpoint, 'READ_AUTH_SETTINGS'); assert.equal(r.quarantined_catalog_after_verified, true); assertPrivate(r);
  }
});

test('wrong initial target blocks configuration and all SQL requests; final target drift cannot pass', async () => {
  for (const at of [1, 5]) {
    const f = fixture({change: ({i, value}) => i === at ? {...value, ref: 'kttkospkblwvguuwnhjj'} : value}), r = await f.run();
    assert.equal(r.exit_code, 1); assert.equal(r.actual_hosted_requests, at === 1 ? 1 : 5);
    assert.equal(r.target_after_verified, false); assertPrivate(r);
  }
});

test('quarantine, empty-window, catalog and API-role drift block success; no automatic quarantine write', async () => {
  for (const at of [2, 4]) for (const drift of [{mode: 'ACTIVE'}, {window_empty: false}, {stamp_matched: false},
    {private_schema_API_denied: false}, {guarded_RPCs: 147}, {backend_forced_RLS_tables: 4}]) {
    const f = fixture({change: ({i, value}) => i === at ? [{bounded_state: {...value[0].bounded_state, ...drift}}] : value}), r = await f.run();
    assert.equal(r.exit_code, 1); assert.equal(r.committed_mode_change_requests, 0);
    assert.equal(f.calls.filter(x => x.url.endsWith('/config/auth')).length, at === 2 ? 0 : 1); assertPrivate(r);
  }
});

test('unexpected SQL rowset shapes never inherit a successful quarantine observation', async () => {
  for (const rows of [[], [{bounded_state: closed(), private: token}], [{bounded_state: closed()}, {bounded_state: closed()}]]) {
    const r = await fixture({change: ({i, value}) => i === 2 ? rows : value}).run();
    assert.equal(r.exit_code, 1); assert.equal(r.quarantined_catalog_before_verified, false); assert.equal(r.Auth_settings_read, false); assertPrivate(r);
  }
});

test('invalid token, extra input keys and failed source check stop before credentials or network', async () => {
  let calls = 0;
  for (const input of [{managementToken: ''}, {managementToken: token, primaryEmail: 'private-inbox@example.invalid'}, {}, null]) {
    const r = await reviewAuthSettings(input, {transport: () => { calls++; throw Error(); }}); assert.equal(r.exit_code, 1); assertPrivate(r);
  }
  assert.equal(calls, 0);
  await assert.rejects(authReviewEntry({sourceCheck: async () => { throw Error('SOURCE'); }, io: {prompt: () => { throw Error('PROMPT_MUST_NOT_RUN'); }}}), /SOURCE/);
});

test('actual entry asks exactly one hidden Management token and clears it after the review', async () => {
  const prompts = [], notices = [], f = fixture();
  const r = await authReviewEntry({sourceCheck: async () => 345, transport: f.transport,
    io: {notice: s => notices.push(s), prompt: async (...p) => { prompts.push(p); return token; }}});
  assert.equal(r.exit_code, 0); assert.equal(r.source_hashes_verified, 345); assert.equal(prompts.length, 1);
  assert.match(prompts[0][0], /Management token \(hidden\)/); assert.notEqual(prompts[0][1], false);
  assert(notices.some(x => x.includes('Batch V MFA remains pending'))); assertPrivate(r);
});

test('cancelled hidden prompt makes no request and private/debug environment values are rejected without printing them', async () => {
  const f = fixture();
  await assert.rejects(authReviewEntry({sourceCheck: async () => 345, transport: f.transport,
    io: {notice() {}, prompt: async () => { throw Error('OWNER_CANCELLED'); }}}), /OWNER_CANCELLED/);
  assert.equal(f.calls.length, 0);
  for (const k of ['NODE_OPTIONS', 'NODE_DEBUG', 'NODE_TLS_REJECT_UNAUTHORIZED', 'SSLKEYLOGFILE', 'SUPABASE_URL', 'SAVED_TOKEN', 'PASSWORD', 'CUSTOM_SECRET']) assert(unsafePrivateEnvironment({[k]: 'SMTP_PRIVATE_CANARY'}));
  assert.equal(unsafePrivateEnvironment({PATH: '/public/bin', TEMP: '/public/temp', EMPTY_TOKEN: ''}), false);
});

test('frozen 31 AU cases keep Admin-dependent invitations blocked by V; no case is credited from settings inspection', async () => {
  const c = JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-batch-w-contract.json', import.meta.url), 'utf8'));
  assert.equal(c.required_AU_case_count, 31); assert.equal(c.acceptance_cases.length, 31);
  for (const [group, count] of [['AU01', 5], ['AU02', 8], ['AU03', 5], ['AU04', 6], ['AU05', 7]]) assert.equal(c.acceptance_cases.filter(x => x.group === group).length, count);
  assert(c.acceptance_cases.every(x => ['PENDING_HOSTED_EVIDENCE', 'BLOCKED_BY_PENDING_V_ADMIN_MFA'].includes(x.status)));
  assert(c.acceptance_cases.filter(x => x.group === 'AU02' && x.id <= 'AU02.05').every(x => x.status === 'BLOCKED_BY_PENDING_V_ADMIN_MFA'));
  assert.equal(c.settings_write_requested, false); assert.equal(c.MFA_bypass_or_disable_requested, false);
});

test('pinned UI password and four callback constructors match declared review scope without changing password sign-in', async () => {
  const source = await readFile(new URL('../auth-security.js', import.meta.url), 'utf8');
  const actual = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  assert.equal(actual.NEW_PASSWORD_MINIMUM, 12);
  for (const flow of flows) assert.equal(actual.callbackUrl(origin + '/auth.html', flow), origin + '/auth.html?flow=' + flow);
  assert.equal(projectAuthSettings(config()).pinned_UI_new_password_minimum, actual.NEW_PASSWORD_MINIMUM);
});

test('all 339 previous executed sources and U310 remain exact; current 345 source identities verify', async () => {
  assert.equal(await verifyWSources(), 345);
  const previous = JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-batch-v-recovery-source-manifest.json', import.meta.url), 'utf8'));
  const u = JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json', import.meta.url), 'utf8'));
  assert.equal(Object.keys(u.file_sha256).length, 310);
  for (const [n, h] of Object.entries(u.file_sha256)) assert.equal(previous.file_sha256[n], h);
  assert.equal(createHash('sha256').update(await readFile(new URL('../scripts/lib/operator-private-terminal.mjs', import.meta.url))).digest('hex'), previous.file_sha256['scripts/lib/operator-private-terminal.mjs']);
});
