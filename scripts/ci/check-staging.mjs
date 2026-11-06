import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEB_ORIGIN, privateAccounts, readPublicConfiguration, apiTransport, checkStagingAccess, Stop, need } from './staging-access.mjs';
import { checkConfirmation } from './staging-confirmation.mjs';
import { checkPasswordSessions } from './staging-password-sessions.mjs';
import { checkAccountSwitch } from './staging-account-switch.mjs';
import { checkRecovery } from './staging-recovery.mjs';
import { checkRecoveryFeedback } from './staging-recovery-feedback.mjs';
import { checkAdminBoundaries, verifyAdminSources } from './staging-admin-boundaries.mjs';
import { checkBusinessReceipt, isBusinessReceiptPlan } from './staging-business-receipt.mjs';

async function main() {
  let report;
  let progress = 'Stage 3/10 | FR.2/8 | Batch W/Z';
  try {
    const plan = JSON.parse(fs.readFileSync(new URL('./staging-run.json', import.meta.url), 'utf8'));
    const confirmation = plan.scope === 'access-and-confirmation' && plan.case_id === 'AU01.05';
    const passwordSessions = plan.scope === 'password-and-sessions'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['AU03.03', 'AU05.01', 'AU05.02', 'AU05.04']);
    const accountSwitch = plan.scope === 'account-switch-and-stale-session'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['AU05.06', 'AU05.07']);
    const recovery = plan.scope === 'recovery-variants'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['AU04.03','AU04.04','AU04.05']);
    const recoverySaveRetry = plan.scope === 'recovery-save-retry'
      && ['["AU04.05"]', '["AU04.05","AU03.01"]'].includes(JSON.stringify(plan.case_ids));
    const recoveryFeedback = plan.scope === 'recovery-request-feedback'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['AU04.01','AU05.07']);
    const controlledBrowser = plan.scope === 'controlled-browser'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['AU04.05','AU05.07']);
    const adminBoundaries = plan.scope === 'admin-boundaries'
      && JSON.stringify(plan.case_ids) === JSON.stringify(['V06', 'V07', 'V08', 'V09', 'V11']);
    const businessReceipt = isBusinessReceiptPlan(plan);
    need(confirmation || passwordSessions || accountSwitch || recovery || recoverySaveRetry || recoveryFeedback
      || controlledBrowser || adminBoundaries || businessReceipt, 'REVIEWED_RUN_SCOPE_REQUIRED');
    if (adminBoundaries) progress = 'Stage 3/10 | FR.2/8 | Batch V/Z';
    if (businessReceipt) progress = 'Stage 3/10 | FR.2/8 | Batch X/Z';
    need(process.env.GITHUB_REPOSITORY === 'dwtdhruvp246/mushavobudget'
      && process.env.GITHUB_REF === 'refs/heads/security/stage-3-authorization', 'STAGING_BRANCH_RUN_REQUIRED');
    const { chromium } = await import('../fixtures/staging-browser-tools/node_modules/playwright/index.mjs');
    if (controlledBrowser) {
      const { checkControlledBrowser } = await import('./staging-controlled-browser.mjs');
      report = await checkControlledBrowser(chromium);
    } else if (recovery || recoverySaveRetry) {
      report = await checkRecovery(plan, recovery ? privateAccounts(process.env) : {}, chromium);
    } else {
    const accounts = privateAccounts(process.env, { ordinaryOnly: businessReceipt });
    const response = await fetch(WEB_ORIGIN + '/config.js?v=27', { redirect: 'error', signal: AbortSignal.timeout(20000) });
    need(response.status === 200, 'PUBLIC_CONFIGURATION_READ_REQUIRED');
    const config = readPublicConfiguration(await response.text());
    const agent = `Mushavo-Staging-Runner/${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}`;
    if (businessReceipt) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkBusinessReceipt(args, config.key, agent, plan), { ordinaryOnly: true });
      delete report.full_lettered_batch_W_complete;
      report.full_lettered_batch_X_complete = false;
    } else if (adminBoundaries) {
      const sourceEvidence = {};
      await verifyAdminSources(sourceEvidence);
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkAdminBoundaries(args, chromium, config.key, agent));
      delete report.full_lettered_batch_W_complete;
      report.full_lettered_batch_V_complete = false;
      report.public_sources = sourceEvidence;
    } else {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent), args => confirmation
        ? checkConfirmation(args, chromium, agent) : passwordSessions ? checkPasswordSessions(args, chromium, config.key, agent)
          : recoveryFeedback ? checkRecoveryFeedback(args, chromium, agent, plan) : checkAccountSwitch(args, chromium, config.key, agent));
    }
    report.public_configuration_requests = 1;
    }
    report.progress_display = progress;
    report.run_plan = plan.run_id;
    report.source_commit = process.env.GITHUB_SHA;
    report.workflow_run_id = process.env.GITHUB_RUN_ID;
    report.workflow_run_attempt = process.env.GITHUB_RUN_ATTEMPT;
  } catch (error) {
    report = { progress_display: progress, result: 'STAGING_RUNNER_PREPARATION_REVIEW_REQUIRED',
      problem_code: error instanceof Stop ? error.code : 'RUNNER_DEPENDENCY_OR_PUBLIC_CONFIGURATION_REQUIRED', exit_code: 1 };
  }
  // Only this explicitly constructed receipt is written. No response payloads,
  // credentials, session state, console logs, traces, videos or HAR are exported.
  const safeJSON = JSON.stringify(report, null, 2);
  fs.mkdirSync('reports/staging', { recursive: true });
  fs.writeFileSync('reports/staging/summary.json', safeJSON + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '```json\n' + safeJSON + '\n```\n');
  console.log(report.exit_code === 0 ? 'COMPLETE: Scoped staging checks and session cleanup passed.' : 'STOPPED FOR REVIEW: Preserve the safe JSON below.');
  console.log(safeJSON);
  process.exitCode = report.exit_code;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
