'use strict';

const fs = require('node:fs');

const site = 'https://mushavobudget.com';
const project = 'kttkospkblwvguuwnhjj';
const api = `https://${project}.supabase.co`;
const staffRoles = new Set(['super_admin', 'admin_staff', 'support_staff']);
const jwtPattern = /^[\w-]+\.[\w-]+\.[\w-]+$/;

function getPublicKey(source) {
  const url = /\bsupabaseUrl\s*:\s*['"]([^'"]+)['"]/.exec(source)?.[1];
  const key = /\bsupabasePublishableKey\s*:\s*['"]([^'"]+)['"]/.exec(source)?.[1];
  if (url !== api || !key || key.length > 4096) return null;
  if (/^sb_publishable_[\w-]+$/.test(key)) return key;
  if (!jwtPattern.test(key)) return null;
  const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
  return claims?.role === 'anon' && claims.ref === project ? key : null;
}

class CheckError extends Error {}

function requireCheck(condition, code) {
  if (!condition) throw new CheckError(code);
}

async function verifyProductionStaffSession(readCredentials, fetcher = fetch) {
  const result = {
    stage: 3,
    fr: '3.3',
    batch: 'production-staff-session',
    project,
    result: 'STOPPED_FOR_REVIEW',
    failure_step: null,
    failure_code: null,
    production_config_verified: false,
    signed_in_staff_session_verified: false,
    staff_archive_gate_closed: false,
    private_file_gate_closed: false,
    test_session_signed_out: false,
    test_session_access_revoked: false,
    cleanup_failure_code: null,
    exit_code: 2,
  };

  const request = (url, options) => fetcher(url, {
    ...options, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  let publicKey;
  let accessToken;
  let step = 'production_config';
  const post = (path, payload, extraHeaders) => request(`${api}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json', apikey: publicKey,
      ...(accessToken && { authorization: `Bearer ${accessToken}` }),
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  });
  const sessionStatus = () => post('/rest/v1/rpc/app_session_status', {});

  try {
    const config = await request(`${site}/config.js`, {});
    requireCheck(config.ok, `CONFIG_HTTP_${config.status}`);
    publicKey = getPublicKey(await config.text());
    requireCheck(publicKey, 'PRODUCTION_PUBLIC_CONFIG_MISMATCH');
    result.production_config_verified = true;

    step = 'staff_sign_in';
    const credentials = await readCredentials();
    requireCheck(typeof credentials?.email === 'string' && credentials.email.trim().includes('@') &&
      credentials.email.length <= 320 && typeof credentials.password === 'string' &&
      credentials.password.length > 0 && credentials.password.length <= 4096, 'SIGN_IN_INPUT_INVALID');
    let signIn;
    try {
      signIn = await post('/auth/v1/token?grant_type=password', {
        email: credentials.email.trim(), password: credentials.password,
      });
    } finally {
      credentials.email = '';
      credentials.password = '';
    }
    requireCheck(signIn.ok, `SIGN_IN_HTTP_${signIn.status}`);
    const token = (await signIn.json())?.access_token;
    requireCheck(typeof token === 'string' && token.length <= 8192 && jwtPattern.test(token),
      'SIGN_IN_SESSION_MISSING');
    accessToken = token;

    step = 'staff_session_status';
    const response = await sessionStatus();
    requireCheck(response.ok, `SESSION_STATUS_HTTP_${response.status}`);
    const status = await response.json();
    requireCheck(status?.contract === 1 && status.policy === 'ACTIVE_SUPABASE_SESSION' &&
      status.session_valid === true && status.admin_authorized === true && staffRoles.has(status.role),
    'ACTIVE_SUPPORT_STAFF_SESSION_REQUIRED');
    result.signed_in_staff_session_verified = true;

    step = 'staff_archive_gate';
    // The last UUID requests an empty page even if this function is opened later.
    const archive = await post('/rest/v1/rpc/fr33_list_assigned_support_archive', {
      p_after: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
    });
    const archiveError = await archive.json();
    requireCheck((archive.status === 403 && archiveError?.code === '42501') ||
      (archive.status === 404 && archiveError?.code === 'PGRST202'),
    `ARCHIVE_GATE_UNEXPECTED_HTTP_${archive.status}`);
    result.staff_archive_gate_closed = true;

    step = 'private_file_gate';
    const file = await post('/functions/v1/get-private-file', {
      bucket: 'payment-proofs',
      path: '00000000-0000-0000-0000-000000000000/fr33-session-preflight.png',
    }, { origin: site });
    const fileError = await file.json();
    requireCheck((file.status === 403 && fileError?.error === 'ORIGIN_NOT_ALLOWED') ||
      (file.status === 503 && fileError?.error === 'PRIVATE_FILE_UNAVAILABLE'),
    `PRIVATE_FILE_GATE_UNEXPECTED_HTTP_${file.status}`);
    result.private_file_gate_closed = true;
  } catch (error) {
    result.failure_step = step;
    result.failure_code = error instanceof CheckError ? error.message : 'REQUEST_OR_RESPONSE_ERROR';
  } finally {
    if (accessToken) {
      try {
        const logout = await post('/auth/v1/logout?scope=local', {});
        requireCheck(logout.ok, `SIGN_OUT_HTTP_${logout.status}`);
        result.test_session_signed_out = true;
        const after = await sessionStatus();
        requireCheck([401, 403].includes(after.status) ||
          (after.ok && (await after.json())?.session_valid === false),
        'SESSION_REVOCATION_NOT_CONFIRMED');
        result.test_session_access_revoked = true;
      } catch (error) {
        result.cleanup_failure_code = error instanceof CheckError ? error.message : 'SIGN_OUT_CHECK_ERROR';
        if (!result.failure_step) {
          result.failure_step = 'test_session_cleanup';
          result.failure_code = result.cleanup_failure_code;
        }
      }
    }
  }

  if (!result.failure_step) {
    result.result = 'FR33_PRODUCTION_STAFF_SESSION_PASS';
    result.exit_code = 0;
  }
  return { ...result, completed_utc: new Date().toISOString() };
}

if (require.main === module) {
  verifyProductionStaffSession(() => JSON.parse(fs.readFileSync(0, 'utf8'))).then(result => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    process.exitCode = result.exit_code;
  });
}

module.exports = { verifyProductionStaffSession };
