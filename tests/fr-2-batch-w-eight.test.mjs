import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, mkdir, writeFile, readdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {replacePasswordPolicyEntries, prepareEightZIP, policyFiles} from '../scripts/prepare-fr-2-batch-w-eight.mjs';
import {createPublicZIP} from '../scripts/lib/store-public-zip.mjs';
import {readCanonicalPublicZIP} from '../scripts/prepare-fr-2-email-modern-package.mjs';
import {NEW_PASSWORD_MINIMUM, safeAuthMessage} from '../auth-security.js';
const hash = x => createHash('sha256').update(x).digest('hex');
const root = new URL('../', import.meta.url);
const baseline = JSON.parse(await readFile(new URL('docs/security-audit/security-fr-2-batch-w-eight-contract.json', root), 'utf8'));
async function beforeEntries() {
  const entries = new Map();
  for (const name of policyFiles) {
    let source = await readFile(new URL(name, root), 'utf8');
    if (name === 'auth-security.js') source = source.replace('NEW_PASSWORD_MINIMUM = 8;', 'NEW_PASSWORD_MINIMUM = 12;')
      .replace('`Use at least ${NEW_PASSWORD_MINIMUM} characters for your new password.`', "'Use at least 12 characters for your new password.'");
    else source = source.replaceAll('minlength="8"', 'minlength="12"').replaceAll('at least 8 characters', 'at least 12 characters').replaceAll('At least 8 characters', 'At least 12 characters');
    const bytes = Buffer.from(source.replaceAll('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb'));
    assert.equal(hash(bytes), baseline.prior_public_policy_SHA256[name]); entries.set(name, bytes);
  }
  for (const name of ['config.js', '_worker.js', 'sw.js', '_headers', '_routes.json']) entries.set(name, Buffer.from('SYNTHETIC_PUBLIC_PRESERVE_' + name));
  for (let i = 0; entries.size < 44; i++) entries.set('public-' + i + '.js', Buffer.from('SYNTHETIC_PUBLIC_' + i));
  return entries;
}

test('all actual signup and password-change/recovery native fields and visible guidance match the chosen eight-character rule', async () => {
  assert.equal(NEW_PASSWORD_MINIMUM, 8); assert.match(safeAuthMessage({code: 'new_password_too_short'}), /at least 8 characters/);
  for (const [file, ids] of [['signup.html', ['signupPassword', 'signupPasswordConfirm']], ['auth.html', ['securityNewPassword', 'securityConfirmPassword']]]) {
    const source = await readFile(new URL(file, root), 'utf8');
    for (const id of ids) {
      const input = source.match(new RegExp('<input\\b[^>]*\\bid="' + id + '"[^>]*>'))?.[0];
      assert(input); assert.match(input, /\bminlength="8"/); assert.match(input, /\bautocomplete="new-password"/);
    }
    assert.match(source, /[Aa]t least 8 characters/); assert.doesNotMatch(source, /[Aa]t least 12 characters|minlength="12"/);
  }
});

test('patching the reviewed prior policy bytes changes only three files and preserves all forty-one other entries', async () => {
  const original = await beforeEntries(), copy = new Map([...original].map(([n, b]) => [n, Buffer.from(b)]));
  const next = replacePasswordPolicyEntries(original);
  assert.equal(next.size, 44);
  for (const [name, bytes] of original) {
    assert(bytes.equals(copy.get(name)));
    if (policyFiles.includes(name)) assert(next.get(name).equals(Buffer.from((await readFile(new URL(name, root), 'utf8')).replaceAll('kttkospkblwvguuwnhjj', 'dczlddwbtgvfdujgcitb'))));
    else assert(next.get(name).equals(bytes));
  }
  assert(next.get('signup.html').includes(Buffer.from('dczlddwbtgvfdujgcitb')));
  assert(!next.get('signup.html').includes(Buffer.from('kttkospkblwvguuwnhjj')));
});

test('canonical forty-four-entry ZIP roundtrip retains exact bytes and rejects unexpected prior policy or CRC changes', async () => {
  const original = await beforeEntries(), next = replacePasswordPolicyEntries(original);
  const bytes = createPublicZIP([...next]), decoded = readCanonicalPublicZIP(bytes);
  for (const [name, data] of next) assert(data.equals(decoded.get(name)));
  const corrupt = Buffer.from(bytes); corrupt[50] ^= 1;
  assert.throws(() => readCanonicalPublicZIP(corrupt));
  const unexpected = new Map(original); unexpected.set('auth-security.js', Buffer.from('UNREVIEWED_PRIOR_POLICY'));
  assert.throws(() => replacePasswordPolicyEntries(unexpected), /PRIOR_PASSWORD_SOURCE/);
  unexpected.delete('auth.html'); assert.throws(() => replacePasswordPolicyEntries(unexpected), /PUBLIC_SET/);
});

test('an unrecognized retained ZIP is refused before any output write and the input remains byte-identical', async () => {
  const temporary = await mkdtemp(path.join(tmpdir(), 'mushavo-w-eight-test-'));
  try {
    const input = path.join(temporary, 'wrong-public.zip'), out = path.join(temporary, 'out');
    const bytes = createPublicZIP([...await beforeEntries()]); await writeFile(input, bytes); await mkdir(out);
    await assert.rejects(prepareEightZIP(input, out));
    assert.deepEqual(await readdir(out), []); assert((await readFile(input)).equals(bytes));
  } finally { await rm(temporary, {recursive: true, force: true}); }
});
