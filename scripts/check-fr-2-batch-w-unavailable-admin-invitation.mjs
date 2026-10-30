import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { privateTerminal } from './lib/operator-private-terminal.mjs';
import { readStagingConfiguration } from './check-fr-2-batch-w-completed-admin-invitation.mjs';
import { checkUnavailableAdminInvitation } from './lib/unavailable-admin-invitation-check.mjs';
import { stagedSQLFiles, copySQLToClipboard, stepFiles, stepResults } from './lib/unavailable-admin-invitation-workflow.mjs';
const root = new URL('../', import.meta.url);
const sourceNames = [
  'scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs',
  'scripts/repair-fr-2-batch-w-unavailable-invitation-sql.mjs',
  'scripts/lib/unavailable-admin-invitation-check.mjs',
  'scripts/lib/unavailable-admin-invitation-sql.mjs',
  'scripts/lib/unavailable-admin-invitation-workflow.mjs',
  'scripts/check-fr-2-batch-w-completed-admin-invitation.mjs',
  'scripts/lib/completed-admin-invitation-check.mjs',
  'scripts/lib/operator-private-terminal.mjs',
  'scripts/lib/read-public-zip.mjs',
  'scripts/lib/store-public-zip.mjs'
];
export function verifyUnavailableSources() {
  const manifest = JSON.parse(fs.readFileSync(new URL('scripts/unavailable-admin-invitation-manifest.json', root), 'utf8'));
  if (Object.keys(manifest.sources || {}).sort().join('|') !== sourceNames.slice().sort().join('|')) throw Error('SOURCE_HASH_MISMATCH');
  for (const name of sourceNames) {
    const hash = createHash('sha256').update(fs.readFileSync(new URL(name, root))).digest('hex');
    if (hash !== manifest.sources[name]) throw Error('SOURCE_HASH_MISMATCH');
  }
  return sourceNames.length;
}
async function main() {
  let terminal, activeController;
  const interrupt = () => activeController?.abort();
  process.on('SIGINT', interrupt);
  try {
    if (process.argv.length !== 4) throw Error('ZIP_AND_NEW_OUTPUT_DIRECTORY_REQUIRED');
    const count = verifyUnavailableSources();
    const config = readStagingConfiguration(fs.readFileSync(process.argv[2]));
    const output = path.resolve(process.argv[3]);
    if (fs.existsSync(output)) throw Error('NEW_EMPTY_OUTPUT_DIRECTORY_REQUIRED');
    const files = stagedSQLFiles(output);
    terminal = privateTerminal();
    terminal.notice('STARTED: Stage 3/10 | FR.2/8 | Batch W/Z — unavailable invitation check, staging only.');
    terminal.notice('Use the OTHER existing ordinary test account from the previous check, then your existing staging Super Admin. Passwords are masked. No email is sent.');
    terminal.notice('ONE STEP AT A TIME: this checker copies the current complete SQL step to your clipboard. In staging Supabase, open a NEW BLANK query, press Ctrl+V and Run. Return here and type DONE after the expected result. The next step is supplied only after its server checks pass.');
    terminal.notice('Only the new test sessions may be refreshed and locally signed out. The two older Node-labelled rows are not targeted. No email, upload, API key or settings change is needed.');
    const actor = { email: (await terminal.prompt('Existing ordinary test user email:', false)).trim(), password: await terminal.prompt('Test user password:', true) };
    const admin = async () => {
      terminal.notice('Ordinary test account verified. Enter the existing staging Super Admin.');
      return { email: (await terminal.prompt('Staging Super Admin email:', false)).trim(), password: await terminal.prompt('Super Admin password:', true) };
    };
    const transport = async ({ method, route, token, body }) => {
      if (!/^\/(auth\/v1|rest\/v1)\//.test(route)) throw Error('FIXED_STAGING_ROUTE_REQUIRED');
      const controller = new AbortController(); activeController = controller;
      const timer = setTimeout(() => controller.abort(), 25000);
      try {
        const response = await fetch(config.origin + route, { method,
          headers: { apikey: config.key, 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: controller.signal });
        const text = await response.text(); let data = null;
        if (text) { try { data = JSON.parse(text); } catch {} }
        return { status: response.status, data, serverDate: response.headers.get('date') };
      } finally { clearTimeout(timer); if (activeController === controller) activeController = null; }
    };
    const interact = {
      prepare: async pack => {
        files.prepare(pack);
        terminal.notice('Emergency cleanup prepared before the fixture: ' + path.join(output, stepFiles.cleanup));
      },
      sqlStep: async (phase, sql) => {
        const filename = files.materialize(phase, sql), copied = await copySQLToClipboard(sql);
        terminal.notice('STEP ' + ({ expired: 1, cancelled: 2, replaced: 3, cleanup: 4 })[phase] + '/4 — ' + phase.toUpperCase());
        terminal.notice(copied ? 'CURRENT SQL COPIED: Supabase staging dczlddwbtgvfdujgcitb > NEW BLANK query > Ctrl+V > Run once.' : 'Clipboard unavailable. Copy the WHOLE current file into a NEW BLANK staging query: ' + filename);
        terminal.notice('Expected SQL result: ' + stepResults[phase]);
        if (!copied && process.platform === 'win32') {
          const child = spawn('notepad.exe', [filename], { stdio: 'ignore', detached: true });
          child.on('error', () => terminal.notice('Open the SQL file above manually in Notepad.')); child.unref();
        }
        if ((await terminal.prompt('After that expected SQL result, type DONE:', false)).trim() !== 'DONE') throw Error('OWNER_CANCELLED');
      }
    };
    const report = await checkUnavailableAdminInvitation({ actor, admin, invitationId: randomUUID() }, transport, interact);
    report.source_hashes_verified = count; report.retained_staging_ZIP_verified = true;
    terminal.notice(report.exit_code === 0 ? 'COMPLETE: Three unavailable states denied; fixture and sessions cleaned up.' : 'STOPPED FOR REVIEW: Preserve the safe JSON below.');
    if (report.fixture_cleanup_required) terminal.notice('MANUAL CLEANUP REQUIRED: Open ' + path.join(output, stepFiles.cleanup) + ' and run the whole file in staging. Report any safe error code; do not restart the check.');
    console.log(JSON.stringify(report, null, 2)); process.exitCode = report.exit_code;
  } catch (error) {
    const allowed = new Set(['ZIP_AND_NEW_OUTPUT_DIRECTORY_REQUIRED', 'NEW_EMPTY_OUTPUT_DIRECTORY_REQUIRED', 'SOURCE_HASH_MISMATCH', 'ACCEPTED_STAGING_ZIP_REQUIRED', 'STAGING_PUBLIC_CONFIGURATION_REQUIRED', 'PUBLIC_ANON_OR_PUBLISHABLE_KEY_REQUIRED', 'PRIVATE_INTERACTIVE_TERMINAL_REQUIRED', 'OWNER_CANCELLED']);
    console.log(JSON.stringify({ progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z', result: 'UNAVAILABLE_INVITATION_PREPARATION_STOPPED', problem_code: allowed.has(error?.message) ? error.message : 'SOURCE_OR_PATH_REQUIRED', real_email_requests: 0, exit_code: 1 }, null, 2));
    process.exitCode = 1;
  } finally { terminal?.close(); process.off('SIGINT', interrupt); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
