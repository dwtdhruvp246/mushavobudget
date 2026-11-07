import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WEB_ORIGIN, privateAccounts, readPublicConfiguration, apiTransport, checkStagingAccess, Stop, need } from './staging-access.mjs';
import { checkConfirmation } from './staging-confirmation.mjs';
import { checkPasswordSessions } from './staging-password-sessions.mjs';
import { checkAccountSwitch } from './staging-account-switch.mjs';
import { checkRecovery } from './staging-recovery.mjs';
import { checkRecoveryFeedback } from './staging-recovery-feedback.mjs';
import { checkAdminBoundaries, verifyAdminSources } from './staging-admin-boundaries.mjs';
import { checkBusinessReceipt, isBusinessReceiptPlan, manageReceiptFixture } from './staging-business-receipt.mjs';
import { checkDispatcherBoundaries, isDispatcherBoundaryPlan } from './staging-dispatcher-boundaries.mjs';
import { checkAccountSuspension, isAccountSuspensionPlan } from './staging-account-suspension.mjs';
import { checkBusinessFinance, isBusinessFinancePlan } from './staging-business-finance.mjs';
import { checkFamilyProof, isFamilyProofPlan } from './staging-family-proof.mjs';
import { checkBusinessExpiry, isBusinessExpiryPlan } from './staging-business-expiry.mjs';
import { checkBusinessTeam, isBusinessTeamPlan } from './staging-business-team.mjs';

async function main() {
  let report;
  let progress = 'Stage 3/10 | FR.2/8 | Batch W/Z';
  try {
    const plan = JSON.parse(fs.readFileSync(new URL('./staging-run.json', import.meta.url), 'utf8'));
    need(plan.enabled !== false, 'RUN_PLAN_ARCHIVED');
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
    const dispatcherBoundaries = isDispatcherBoundaryPlan(plan);
    const accountSuspension = isAccountSuspensionPlan(plan);
    const businessFinance = isBusinessFinancePlan(plan);
    const familyProof = isFamilyProofPlan(plan);
    const businessExpiry = isBusinessExpiryPlan(plan);
    const businessTeam = isBusinessTeamPlan(plan);
    need(confirmation || passwordSessions || accountSwitch || recovery || recoverySaveRetry || recoveryFeedback
      || controlledBrowser || adminBoundaries || businessReceipt || dispatcherBoundaries || accountSuspension || businessFinance || familyProof || businessExpiry || businessTeam, 'REVIEWED_RUN_SCOPE_REQUIRED');
    if (adminBoundaries) progress = 'Stage 3/10 | FR.2/8 | Batch V/Z';
    if (businessReceipt) progress = 'Stage 3/10 | FR.2/8 | Batch X/Z';
    if (dispatcherBoundaries) progress = 'Stage 3/10 | FR.2/8 | Batch Y/Z';
    if (accountSuspension) progress = 'Stage 3/10 | FR.2/8 | Batch X/Z';
    if (businessFinance) progress = 'Stage 3/10 | FR.2/8 | Batch X/Z';
    if (familyProof || businessExpiry || businessTeam) progress = 'Stage 3/10 | FR.2/8 | Batch X/Z';
    need(process.env.GITHUB_REPOSITORY === 'dwtdhruvp246/mushavobudget'
      && process.env.GITHUB_REF === 'refs/heads/security/stage-3-authorization', 'STAGING_BRANCH_RUN_REQUIRED');
    const fixtureAction = process.env.MUSHAVO_STAGING_RECEIPT_ADMIN_ACTION || null;
    need(!fixtureAction || businessReceipt && ['provision', 'suspend'].includes(fixtureAction), 'REVIEWED_FIXTURE_ACTION_REQUIRED');
    if (businessReceipt) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'BUSINESS_FIXTURE_RERUN_REFUSED');
    if (dispatcherBoundaries) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'DISPATCHER_BOUNDARY_RERUN_REFUSED');
    if (accountSuspension) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'ACCOUNT_SUSPENSION_RERUN_REFUSED');
    if (businessFinance) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'BUSINESS_FINANCE_RERUN_REFUSED');
    if (familyProof) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'FAMILY_PROOF_RERUN_REFUSED');
    if (businessExpiry) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'BUSINESS_EXPIRY_RERUN_REFUSED');
    if (businessTeam) need(process.env.GITHUB_RUN_ATTEMPT === '1', 'BUSINESS_TEAM_RERUN_REFUSED');
    const chromium = businessReceipt || dispatcherBoundaries || accountSuspension || businessFinance || familyProof || businessExpiry || businessTeam ? null
      : (await import('../fixtures/staging-browser-tools/node_modules/playwright/index.mjs')).chromium;
    if (controlledBrowser) {
      const { checkControlledBrowser } = await import('./staging-controlled-browser.mjs');
      report = await checkControlledBrowser(chromium);
    } else if (recovery || recoverySaveRetry) {
      report = await checkRecovery(plan, recovery ? privateAccounts(process.env) : {}, chromium);
    } else {
    const accountScope = fixtureAction ? 'businessFixture' : businessTeam ? 'businessTeam' : businessReceipt || dispatcherBoundaries ? 'ordinary' : 'standard';
    const accounts = privateAccounts(process.env, { accountScope });
    const response = await fetch(WEB_ORIGIN + '/config.js?v=27', { redirect: 'error', signal: AbortSignal.timeout(20000) });
    need(response.status === 200, 'PUBLIC_CONFIGURATION_READ_REQUIRED');
    const config = readPublicConfiguration(await response.text());
    const agent = `Mushavo-Staging-Runner/${process.env.GITHUB_RUN_ID}/${process.env.GITHUB_RUN_ATTEMPT}`;
    if (businessReceipt) {
      if (fixtureAction === 'suspend') {
        const prior = JSON.parse(fs.readFileSync('reports/staging/summary.json', 'utf8'));
        const safeToSuspend = plan.cleanup_fixture === true ? prior.exercise?.independent_archive_readback_bound === true
          : prior.exercise?.upload_attempted === false || prior.exercise?.storage_delete_acknowledged === true;
        need(prior.run_plan === plan.run_id && prior.source_commit === process.env.GITHUB_SHA
          && prior.disposable_fixture_action === 'exercise' && safeToSuspend,
          'EXACT_STORAGE_CLEANUP_REQUIRED_BEFORE_SUSPENSION');
      }
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent), args => fixtureAction
        ? manageReceiptFixture(args, config.key, agent, plan, fixtureAction)
        : checkBusinessReceipt(args, config.key, agent, plan), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
      report.disposable_fixture_action = fixtureAction || 'exercise';
      report.full_lettered_batch_X_complete = false;
      report.full_lettered_batch_Y_complete = false;
    } else if (dispatcherBoundaries) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkDispatcherBoundaries(args, config.key, agent), { accountScope });
      delete report.full_lettered_batch_W_complete;
      report.full_lettered_batch_Y_complete = false;
    } else if (accountSuspension) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkAccountSuspension(args, config.key, agent), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
      report.full_lettered_batch_X_complete = false;
    } else if (businessFinance) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkBusinessFinance(args, config.key, agent, plan), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
      report.full_lettered_batch_X_complete = false;
    } else if (businessTeam) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkBusinessTeam(args, config.key, agent, plan), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
      report.full_lettered_batch_X_complete = false;
    } else if (businessExpiry) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkBusinessExpiry(args, config.key, agent, plan), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
      report.full_lettered_batch_X_complete = false;
    } else if (familyProof) {
      report = await checkStagingAccess(accounts, apiTransport(config.key, agent),
        args => checkFamilyProof(args, config.key, agent, plan), { accountScope });
      delete report.full_lettered_batch_W_complete;
      delete report.settings_or_finance_writes_requested;
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
