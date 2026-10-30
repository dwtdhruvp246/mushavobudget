import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyUnavailableSources } from '../scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs';
import { unavailableInvitationSQL, reviewedBusinessTriggerClause } from '../scripts/lib/unavailable-admin-invitation-sql.mjs';
import { repairUnavailableInvitationSQL } from '../scripts/repair-fr-2-batch-w-unavailable-invitation-sql.mjs';
import { stagedSQLFiles, stepFiles, copySQLToClipboard } from '../scripts/lib/unavailable-admin-invitation-workflow.mjs';
import { EventEmitter } from 'node:events';
import { readStagingConfiguration, validateStagingConfiguration } from '../scripts/check-fr-2-batch-w-completed-admin-invitation.mjs';
const root = new URL('../', import.meta.url);
test('all ten runtime inputs match the manifest and a modified input is refused before private input', async () => {
  assert.equal(verifyUnavailableSources(), 10);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-unavailable-'));
  try {
    const manifest = JSON.parse(fs.readFileSync(new URL('scripts/unavailable-admin-invitation-manifest.json', root), 'utf8'));
    for (const name of [...Object.keys(manifest.sources), 'scripts/unavailable-admin-invitation-manifest.json']) {
      const filename = path.join(temporary, name); fs.mkdirSync(path.dirname(filename), { recursive: true });
      fs.copyFileSync(new URL(name, root), filename);
    }
    fs.appendFileSync(path.join(temporary, 'scripts/lib/unavailable-admin-invitation-sql.mjs'), '\n// modified fixture scope\n');
    const changed = await import(pathToFileURL(path.join(temporary, 'scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs')).href);
    assert.throws(() => changed.verifyUnavailableSources(), /SOURCE_HASH_MISMATCH/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});
test('fixed staging public-key configuration refuses production, privileged keys and an unaccepted ZIP', () => {
  const key = 'sb_publishable_abcdefghijklmnop';
  assert.equal(validateStagingConfiguration({ supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co', supabasePublishableKey: key }).key, key);
  for (const config of [
    { supabaseUrl: 'https://production.supabase.co', supabasePublishableKey: key },
    { supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co', supabasePublishableKey: 'sb_secret_abcdefghijklmnop' },
    { supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co', supabasePublishableKey: 'a.' + Buffer.from(JSON.stringify({ role: 'service_role', ref: 'dczlddwbtgvfdujgcitb' })).toString('base64url') + '.b' }
  ]) assert.throws(() => validateStagingConfiguration(config));
  assert.throws(() => readStagingConfiguration(Buffer.from('unverified package')), /ACCEPTED_STAGING_ZIP_REQUIRED/);
});
test('SQL identifier bindings refuse injection and shared actor/invitation identities', () => {
  const a = '00000000-0000-4000-8000-000000000001', b = '00000000-0000-4000-8000-000000000002';
  for (const values of [{ actorId: a, adminId: b, invitationId: a }, { actorId: a, adminId: b, invitationId: "';DELETE FROM profiles" }]) {
    assert.throws(() => unavailableInvitationSQL(values), /DISTINCT_UUID4_BINDINGS_REQUIRED/);
  }
});
const bindings = { actorId: '00000000-0000-4000-8000-000000000001', adminId: '00000000-0000-4000-8000-000000000002', invitationId: '00000000-0000-4000-8000-000000000003' };
const filenames = { expired: '01-expired.sql', cancelled: '02-cancelled.sql', replaced: '03-replaced-state.sql', cleanup: '04-cleanup.sql' };
test('existing SQL repair preserves the original run bindings and backups, repairs cleanup, and is idempotent', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-sql-repair-'));
  try {
    const expected = unavailableInvitationSQL(bindings), originals = {};
    for (const [phase, name] of Object.entries(filenames)) {
      originals[phase] = expected[phase].replace(reviewedBusinessTriggerClause, '').replaceAll('\n', '\r\n');
      fs.writeFileSync(path.join(directory, name), originals[phase]);
    }
    assert.deepEqual(repairUnavailableInvitationSQL(directory), { changed_files: 4, verified_files: 4, existing_bindings_preserved: true, backups_preserved: true });
    for (const [phase, name] of Object.entries(filenames)) {
      assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), expected[phase]);
      assert.equal(fs.readFileSync(path.join(directory, 'before-trigger-repair', name), 'utf8'), originals[phase]);
    }
    assert.equal(repairUnavailableInvitationSQL(directory).changed_files, 0);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('SQL repair refuses edited or mixed-run files before writing any file', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-sql-repair-refusal-'));
  try {
    const expected = unavailableInvitationSQL(bindings);
    for (const [phase, name] of Object.entries(filenames)) fs.writeFileSync(path.join(directory, name), expected[phase].replace(reviewedBusinessTriggerClause, ''));
    const cleanup = path.join(directory, filenames.cleanup);
    fs.appendFileSync(cleanup, '\nDELETE FROM profiles;\n');
    const before = Object.fromEntries(Object.values(filenames).map(name => [name, fs.readFileSync(path.join(directory, name), 'utf8')]));
    assert.throws(() => repairUnavailableInvitationSQL(directory), /GENERATED_SQL_PACK_REQUIRED/);
    for (const [name, content] of Object.entries(before)) assert.equal(fs.readFileSync(path.join(directory, name), 'utf8'), content);
    assert.equal(fs.existsSync(path.join(directory, 'before-trigger-repair')), false);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
test('only emergency cleanup exists initially; later SQL files appear only when their phase is requested', () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'mushavo-staged-')), output = path.join(parent, 'steps');
  try {
    const pack = unavailableInvitationSQL(bindings), files = stagedSQLFiles(output);
    files.prepare(pack); assert.deepEqual(fs.readdirSync(output), [stepFiles.cleanup]);
    files.materialize('expired', pack.expired);
    assert.equal(fs.existsSync(path.join(output, stepFiles.cancelled)), false);
    assert.equal(fs.existsSync(path.join(output, stepFiles.replaced)), false);
    assert.throws(() => files.materialize('cancelled', pack.replaced), /REQUESTED_SQL_STEP_REQUIRED/);
    files.materialize('cancelled', pack.cancelled); files.materialize('replaced', pack.replaced); files.materialize('cleanup', pack.cleanup);
    assert.deepEqual(fs.readdirSync(output).sort(), Object.values(stepFiles).sort());
  } finally { fs.rmSync(parent, { recursive: true, force: true }); }
});
test('clipboard copy sends SQL only through stdin, verifies the fixed marker and does not execute SQL as shell text', async () => {
  let command, args, received;
  const spawn = (name, values) => {
    command = name; args = values;
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stdin = new EventEmitter(); child.kill = () => {};
    child.stdin.end = text => {
      received = text;
      queueMicrotask(() => { child.stdout.emit('data', Buffer.from('COPIED')); child.emit('close', 0); });
    };
    return child;
  };
  const sql = 'SELECT 1; -- literal $() and backticks remain data\n';
  assert.equal(await copySQLToClipboard(sql, { platform: 'win32', spawn }), true);
  assert.equal(command, 'powershell.exe'); assert.equal(received, sql);
  assert.ok(!args.includes(sql)); assert.ok(args.includes('-STA'));
  assert.equal(await copySQLToClipboard(sql, { platform: 'linux', spawn }), false);
});
