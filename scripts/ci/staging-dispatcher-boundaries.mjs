import { randomUUID } from 'node:crypto';
import { API_ORIGIN, need, tokenIdentity } from './staging-access.mjs';

const FUNCTIONS = ['dispatch-push-reminders', 'dispatch-admin-notifications'];
const CASES = ['Y_EDGE_METHOD', 'Y_EDGE_NO_SECRET', 'Y_EDGE_WRONG_SECRET', 'Y_EDGE_HUMAN_CALLER'];

export function isDispatcherBoundaryPlan(plan) {
  return plan.scope === 'dispatcher-boundaries'
    && plan.project === 'dczlddwbtgvfdujgcitb'
    && JSON.stringify(plan.case_ids) === JSON.stringify(CASES);
}

export async function checkDispatcherBoundaries({ actors, evidence }, key, agent, fetcher = fetch) {
  const owner = actors.USER_A, other = actors.USER_B;
  need(Object.keys(actors).length === 2 && owner?.id !== other?.id
    && [owner, other].every(actor => actor?.id && tokenIdentity(actor.token)?.userId === actor.id),
  'TWO_ORDINARY_BOUND_SESSIONS_REQUIRED');
  evidence.checks = {};
  evidence.exercise_requests = 0;
  evidence.email_requests = 0;
  evidence.provider_push_requests = 0;
  evidence.valid_cron_secret_used = false;
  const wrongSecret = 'audit-invalid:' + randomUUID();
  const cases = [
    { name: 'ANONYMOUS_GET_REJECTED', method: 'GET', status: 405, code: 'METHOD_NOT_ALLOWED' },
    { name: 'ANONYMOUS_POST_WITHOUT_SECRET_REJECTED', method: 'POST', status: 401, code: 'CRON_AUTHENTICATION_FAILED' },
    { name: 'ANONYMOUS_POST_WITH_WRONG_SECRET_REJECTED', method: 'POST', wrong: true, status: 401, code: 'CRON_AUTHENTICATION_FAILED' },
    { name: 'ORDINARY_A_POST_REJECTED', method: 'POST', actor: owner, status: 401, code: 'CRON_AUTHENTICATION_FAILED' },
    { name: 'ORDINARY_B_POST_REJECTED', method: 'POST', actor: other, status: 401, code: 'CRON_AUTHENTICATION_FAILED' },
  ];
  for (const name of FUNCTIONS) {
    for (const item of cases) {
      need(evidence.exercise_requests < 10, 'DISPATCHER_REQUEST_LIMIT_REQUIRED');
      evidence.exercise_requests++;
      const response = await fetcher(new URL('/functions/v1/' + name, API_ORIGIN), {
        method: item.method, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(20000),
        headers: { apikey: key, 'User-Agent': agent,
          ...(item.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
          ...(item.actor ? { Authorization: 'Bearer ' + item.actor.token } : {}),
          ...(item.wrong ? { 'x-mushavo-cron-secret': wrongSecret } : {}) },
        ...(item.method === 'POST' ? { body: JSON.stringify({ source: 'cron' }) } : {}),
      });
      let data = null;
      try { data = await response.json(); } catch {}
      const passed = response.status === item.status && data?.error === item.code
        && /(?:^|,)\s*no-store\b/.test(response.headers.get('cache-control') || '');
      evidence.checks[name + ':' + item.name] = passed;
      need(passed, 'DISPATCHER_AUTHORIZATION_DENIAL_REQUIRED');
    }
  }
}
