import {
  API_ORIGIN, WEB_ORIGIN, apiTransport, checkStagingAccess, need, privateAccounts, readPublicConfiguration
} from './staging-access.mjs';

const allowedStates = new Set(['retention_review', 'shared_records_review', 'ownership_review']);
const apiNames = {
  status: 'fr33_account_deletion_status',
  submit: 'fr33_request_account_deletion',
  cancel: 'fr33_cancel_account_deletion'
};
const agent = 'MushavoBudget-FR33-Staging-Acceptance';
const scope = {accountScope: 'ordinary'};
let report = { result: 'STAGING_PRECHECK_FAILED', exit_code: 1 };
try {
  const config = await fetch(WEB_ORIGIN + '/config.js', {
    redirect: 'error', signal: AbortSignal.timeout(20000)
  });
  need(config.ok, 'STAGING_CONFIGURATION_UNAVAILABLE');
  const {key} = readPublicConfiguration(await config.text());
  async function rpc(action, token) {
    const response = await fetch(API_ORIGIN + '/rest/v1/rpc/' + apiNames[action], {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: {
        apikey: key, 'User-Agent': agent, 'Content-Type': 'application/json',
        ...(token ? {Authorization: 'Bearer ' + token} : {})
      },
      body: '{}'
    });
    return {status: response.status, body: await response.json()};
  }
  function assertNone(result, code) {
    need(result.status === 200 && result.body.status === 'none' && result.body.request_id === null, code);
  }
  function assertDenied(result, code) {
    need([401, 403, 404].includes(result.status), code);
  }

  report = await checkStagingAccess(privateAccounts(process.env, scope), apiTransport(key, agent),
    async ({actors, evidence, scopedLogout}) => {
      const a = actors.USER_A.token, b = actors.USER_B.token;
      assertDenied(await rpc('status'), 'ANONYMOUS_STATUS_WAS_AVAILABLE');
      assertDenied(await rpc('submit'), 'ANONYMOUS_REQUEST_WAS_AVAILABLE');
      evidence.anonymous_denied = true;
      assertNone(await rpc('status', a), 'SUBJECT_REQUEST_ALREADY_PENDING');
      assertNone(await rpc('status', b), 'SECOND_ACCOUNT_REQUEST_ALREADY_PENDING');
      try {
        const results = await Promise.allSettled([rpc('submit', a), rpc('submit', a)]);
        need(results.every(item => item.status === 'fulfilled'), 'REQUEST_RESPONSE_MISSING');
        const [first, second] = results.map(item => item.value);
        need(first.status === 200 && second.status === 200, 'FRESH_PASSWORD_SUBMISSION_FAILED');
        need(allowedStates.has(first.body.status) && first.body.status === second.body.status,
          'REQUEST_WAS_NOT_HELD_FOR_REVIEW');
        need(typeof first.body.request_id === 'string' && first.body.request_id === second.body.request_id,
          'CONCURRENT_REQUESTS_NOT_IDEMPOTENT');
        evidence.concurrent_requests_share_id = true;
        evidence.review_status = first.body.status;
        assertNone(await rpc('status', b), 'SECOND_ACCOUNT_COULD_SEE_REQUEST');
        assertNone(await rpc('cancel', b), 'SECOND_ACCOUNT_INCORRECT_CANCEL_RESPONSE');
        const read = await rpc('status', a);
        need(read.status === 200 && read.body.request_id === first.body.request_id,
          'SUBJECT_COULD_NOT_READ_OR_SECOND_ACCOUNT_CANCELLED_REQUEST');
        evidence.account_isolation = true;
      } finally {
        assertNone(await rpc('cancel', a), 'REQUEST_CANCELLATION_UNVERIFIED');
        assertNone(await rpc('cancel', a), 'REPEATED_CANCELLATION_UNVERIFIED');
        assertNone(await rpc('status', a), 'CANCELLED_REQUEST_STILL_ACTIVE');
        evidence.cancellation_verified = true;
      }
      await scopedLogout(a);
      assertDenied(await rpc('status', a), 'REVOKED_SESSION_STILL_HAS_STATUS_ACCESS');
      evidence.revoked_session_denied = true;
    }, scope);
} catch {
  // Detailed API errors can contain identifying information.
}
console.log(JSON.stringify(report));
process.exitCode = report.exit_code;
