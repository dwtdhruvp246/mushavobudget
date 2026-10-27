import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {copyChanges, replaceConfirmationCopy} from '../scripts/prepare-fr-2-batch-w-copy.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {readCanonicalPublicZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function fixture() {
  const entries = new Map();
  for (const change of copyChanges) {
    const current = fs.readFileSync(new URL(change.name, root));
    const previous = Buffer.from(current.toString('utf8').replace(change.after, change.before));
    assert.equal(hash(previous), change.previousSHA256);
    entries.set(change.name, previous);
  }
  for (const name of ['config.js', '_worker.js', 'sw.js', '_headers', '_routes.json']) entries.set(name, Buffer.from('SYNTHETIC_PUBLIC_PRESERVE_' + name));
  for (let index = 0; entries.size < 44; index++) entries.set('fixture-' + index + '.js', Buffer.from('SYNTHETIC_PUBLIC_' + index));
  return entries;
}

test('public ZIP patch retains all forty-two unrelated entries, input bytes and reviewed output source identities', () => {
  const previous = fixture(), saved = new Map([...previous].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const next = replaceConfirmationCopy(previous);
  for (const [name, bytes] of previous) {
    assert(bytes.equals(saved.get(name)));
    const change = copyChanges.find(item => item.name === name);
    if (change) {
      assert.equal(hash(next.get(name)), change.nextSHA256);
      assert(next.get(name).equals(fs.readFileSync(new URL(name, root))));
    } else assert(bytes.equals(next.get(name)));
  }
});

test('missing entries or unreviewed product bytes stop before a replacement is returned', () => {
  const missing = fixture(); missing.delete('config.js');
  assert.throws(() => replaceConfirmationCopy(missing), /PUBLIC_SET_REQUIRED/);
  const altered = fixture(); altered.set('app.js', Buffer.from('UNREVIEWED_PUBLIC_SOURCE'));
  assert.throws(() => replaceConfirmationCopy(altered), /PRIOR_COPY_SOURCE_REQUIRED/);
});

test('replacement ZIP roundtrip retains every entry and a damaged archive is rejected', () => {
  const entries = replaceConfirmationCopy(fixture());
  const bytes = createPublicZIP([...entries]), decoded = readCanonicalPublicZIP(bytes);
  for (const [name, expected] of entries) assert(expected.equals(decoded.get(name)));
  const damaged = Buffer.from(bytes); damaged[50] ^= 1;
  assert.throws(() => readCanonicalPublicZIP(damaged));
});

test('actual CLI refuses an unrecognized retained ZIP without output writes or input changes', () => {
  const temporary = fs.mkdtempSync(path.join(tmpdir(), 'mushavo-w-copy-test-'));
  try {
    const input = path.join(temporary, 'unrecognized.zip'), out = path.join(temporary, 'out');
    const bytes = createPublicZIP([...fixture()]);
    fs.writeFileSync(input, bytes); fs.mkdirSync(out);
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('scripts/prepare-fr-2-batch-w-copy.mjs', root)), input, out], {encoding: 'utf8'});
    assert.equal(result.status, 1);
    const receipt = JSON.parse(result.stdout);
    assert.equal(receipt.problem_code, 'BATCH_W_RETAINED_PASSWORD8_ZIP_REQUIRED');
    assert.equal(receipt.actual_hosted_requests, 0);
    assert.equal(receipt.real_email_requests, 0);
    assert.deepEqual(fs.readdirSync(out), []);
    assert(fs.readFileSync(input).equals(bytes));
  } finally { fs.rmSync(temporary, {recursive: true, force: true}); }
});
