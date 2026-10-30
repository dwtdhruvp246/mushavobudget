import {readFile, lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const stage = 'FR.2.5.W4_OWNER_SELECTED_EIGHT_CHARACTER_PASSWORD_POLICY';
export const display = 'Stage 3/10 | FR.2/8 | Batch W/Z';
export const policyChanges = ['auth-security.js', 'auth.html', 'signup.html',
  'scripts/lib/auth-batch-w-review.mjs',
  'tests/stage-3-auth-flows.test.mjs', 'tests/stage-3-auth-page.test.mjs', 'tests/fr-2-batch-w-auth.test.mjs'];
const additions = ['scripts/lib/auth-eight-source.mjs', 'scripts/prepare-fr-2-batch-w-eight.mjs',
  'scripts/verify-fr-2-batch-w-eight.mjs', 'tests/fr-2-batch-w-eight.test.mjs',
  'docs/security-audit/security-fr-2-batch-w-eight-contract.json',
  'docs/security-audit/security-fr-2-batch-w-source-manifest.json',
  'tests/fr-2-batch-w-policy-sdk.test.mjs',
  'docs/security-audit/security-fr-2-email-batch-u-owner-local-and-artifact-pass.json'];
export async function verifyEightSources() {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const json = async n => JSON.parse(await readFile(path.join(root, n), 'utf8'));
  const m = await json('docs/security-audit/security-fr-2-batch-w-eight-source-manifest.json');
  const prior = await json('docs/security-audit/security-fr-2-batch-w-source-manifest.json');
  const expected = [...new Set([...Object.keys(prior.file_sha256), ...additions, ...policyChanges])].sort();
  const priorChanges = policyChanges.filter(n => Object.hasOwn(prior.file_sha256, n)).sort();
  if (m.stage_step !== stage || prior.source_file_count !== 345 || m.source_file_count !== expected.length
    || JSON.stringify(Object.keys(m.file_sha256).sort()) !== JSON.stringify(expected)
    || JSON.stringify(m.intentional_prior_source_changes.map(x => x.path).sort()) !== JSON.stringify(priorChanges)
    || JSON.stringify(m.policy_source_revisions.map(x => x.path).sort()) !== JSON.stringify(policyChanges.slice().sort())) throw Error('BATCH_W_SOURCE_MANIFEST_REQUIRED');
  for (const [name, hash] of Object.entries(m.file_sha256)) {
    if (!/^[A-Za-z0-9_./-]+$/.test(name) || name.includes('..') || path.isAbsolute(name) || !/^[a-f0-9]{64}$/.test(hash)) throw Error('BATCH_W_SOURCE_MANIFEST_REQUIRED');
    for (let p = path.join(root, name);;) {
      if ((await lstat(p)).isSymbolicLink()) throw Error('BATCH_W_SOURCE_PATH_REQUIRED');
      const parent = path.dirname(p); if (parent === p) break; p = parent;
    }
    if (createHash('sha256').update(await readFile(path.join(root, name))).digest('hex') !== hash) throw Error('BATCH_W_SOURCE_IDENTITY_REQUIRED');
  }
  for (const [name, hash] of Object.entries(prior.file_sha256)) {
    if (policyChanges.includes(name)) {
      const row = m.intentional_prior_source_changes.find(x => x.path === name);
      if (row.before_sha256 !== hash || row.after_sha256 !== m.file_sha256[name] || row.before_sha256 === row.after_sha256) throw Error('BATCH_W_POLICY_DELTA_REQUIRED');
    } else if (m.file_sha256[name] !== hash) throw Error('BATCH_W_UNRELATED_SOURCE_CHANGED');
  }
  const frozen = await json('docs/security-audit/security-fr-2-email-batch-u-hosted-source-manifest.json');
  const uChanges = Object.keys(frozen.file_sha256).filter(n => m.file_sha256[n] !== frozen.file_sha256[n]).sort();
  if (frozen.source_file_count !== 310 || JSON.stringify(uChanges) !== JSON.stringify(m.historical_U_source_deltas.slice().sort())
    || uChanges.some(n => !policyChanges.includes(n))) throw Error('BATCH_W_HISTORICAL_U_DELTA_REQUIRED');
  const contract = await json('docs/security-audit/security-fr-2-batch-w-eight-contract.json');
  if (contract.new_password_minimum !== 8 || contract.required_AU_cases_unchanged !== 31) throw Error('BATCH_W_POLICY_CONTRACT_REQUIRED');
  return m.source_file_count;
}
