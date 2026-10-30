import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyUnavailableSources } from '../scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs';
import { unavailableInvitationSQL } from '../scripts/lib/unavailable-admin-invitation-sql.mjs';
import { readStagingConfiguration, validateStagingConfiguration } from '../scripts/check-fr-2-batch-w-completed-admin-invitation.mjs';
const root = new URL('../', import.meta.url);
test('all eight runtime inputs match the manifest and a modified input is refused before private input', async () => {
  assert.equal(verifyUnavailableSources(), 8);
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
