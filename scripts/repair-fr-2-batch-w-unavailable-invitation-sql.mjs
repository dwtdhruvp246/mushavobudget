import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unavailableInvitationSQL, reviewedBusinessTriggerClause } from './lib/unavailable-admin-invitation-sql.mjs';
import { verifyUnavailableSources } from './check-fr-2-batch-w-unavailable-admin-invitation.mjs';
const filenames = { expired: '01-expired.sql', cancelled: '02-cancelled.sql', replaced: '03-replaced-state.sql', cleanup: '04-cleanup.sql' };
const normalize = text => text.replaceAll('\r\n', '\n');
export function repairUnavailableInvitationSQL(directory) {
  const folder = path.resolve(directory);
  const actual = {};
  for (const [phase, name] of Object.entries(filenames)) {
    const filename = path.join(folder, name), info = fs.lstatSync(filename);
    if (!info.isFile() || info.isSymbolicLink() || info.size > 200000) throw Error('GENERATED_SQL_PACK_REQUIRED');
    actual[phase] = fs.readFileSync(filename, 'utf8');
  }
  const first = normalize(actual.expired);
  const actorId = first.match(/WHERE u\.id = '([0-9a-f-]{36})'::uuid AND u\.email_confirmed_at/i)?.[1];
  const adminId = first.match(/WHERE a\.user_id = '([0-9a-f-]{36})'::uuid AND a\.role = 'super_admin'/i)?.[1];
  const invitationId = first.match(/pg_advisory_xact_lock\(hashtextextended\('([0-9a-f-]{36})', 0\)\)/i)?.[1];
  let expected;
  try { expected = unavailableInvitationSQL({ actorId, adminId, invitationId }); }
  catch { throw Error('GENERATED_SQL_PACK_REQUIRED'); }
  for (const phase of Object.keys(filenames)) {
    const original = expected[phase].replace(reviewedBusinessTriggerClause, '');
    if (![original, expected[phase]].includes(normalize(actual[phase]))) throw Error('GENERATED_SQL_PACK_REQUIRED');
  }
  const backup = path.join(folder, 'before-trigger-repair');
  if (fs.existsSync(backup) && (!fs.lstatSync(backup).isDirectory() || fs.lstatSync(backup).isSymbolicLink())) throw Error('BACKUP_DIRECTORY_REQUIRED');
  if (!fs.existsSync(backup)) fs.mkdirSync(backup);
  for (const [phase, name] of Object.entries(filenames)) {
    const filename = path.join(backup, name);
    if (!fs.existsSync(filename)) fs.writeFileSync(filename, actual[phase], { encoding: 'utf8', flag: 'wx' });
    else if (!fs.lstatSync(filename).isFile() || fs.lstatSync(filename).isSymbolicLink()
      || ![expected[phase], expected[phase].replace(reviewedBusinessTriggerClause, '')].includes(normalize(fs.readFileSync(filename, 'utf8')))) throw Error('REVIEWED_BACKUP_REQUIRED');
  }
  let changed = 0;
  // Repair cleanup first so it is available even if a subsequent local write fails.
  for (const phase of ['cleanup', 'expired', 'cancelled', 'replaced']) {
    if (normalize(actual[phase]) !== expected[phase]) {
      const filename = path.join(folder, filenames[phase]), temporary = filename + '.trigger-fix.tmp';
      fs.writeFileSync(temporary, expected[phase], { encoding: 'utf8', flag: 'wx' });
      fs.renameSync(temporary, filename); changed++;
    }
    if (normalize(fs.readFileSync(path.join(folder, filenames[phase]), 'utf8')) !== expected[phase]) throw Error('REPAIRED_SQL_READBACK_REQUIRED');
  }
  return { changed_files: changed, verified_files: 4, existing_bindings_preserved: true, backups_preserved: true };
}
function main() {
  try {
    if (process.argv.length !== 3) throw Error('EXISTING_FIXTURE_SQL_DIRECTORY_REQUIRED');
    const sources = verifyUnavailableSources();
    const result = repairUnavailableInvitationSQL(process.argv[2]);
    console.log(JSON.stringify({ progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z',
      result: 'EXISTING_INVITATION_SQL_REPAIRED_NOT_EXECUTED', ...result, source_hashes_verified: sources,
      actual_hosted_requests: 0, SQL_executed: false, real_email_requests: 0,
      new_fixture_created: false, new_Auth_sessions_created: 0, exit_code: 0 }, null, 2));
  } catch (error) {
    const known = new Set(['EXISTING_FIXTURE_SQL_DIRECTORY_REQUIRED', 'GENERATED_SQL_PACK_REQUIRED', 'BACKUP_DIRECTORY_REQUIRED', 'REVIEWED_BACKUP_REQUIRED', 'REPAIRED_SQL_READBACK_REQUIRED', 'SOURCE_HASH_MISMATCH']);
    console.log(JSON.stringify({ progress_display: 'Stage 3/10 | FR.2/8 | Batch W/Z', result: 'SQL_REPAIR_REVIEW_REQUIRED',
      problem_code: known.has(error?.message) ? error.message : 'EXISTING_SQL_DIRECTORY_OR_WRITE_REQUIRED',
      actual_hosted_requests: 0, SQL_executed: false, exit_code: 1 }, null, 2));
    process.exitCode = 1;
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) main();
