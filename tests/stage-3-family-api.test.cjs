const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { run, parseConfig, rpcDenied, rowDenied } = require('../scripts/check-stage-3-family-api.cjs');
const staging = { supabaseUrl: 'https://dczlddwbtgvfdujgcitb.supabase.co', supabasePublishableKey: 'sb_publishable_LOCAL_TEST', vapidPublicKey: '' };
const config = c => 'window.MUSHAVO_BUDGET_CONFIG = ' + JSON.stringify(c) + ';';
test('Production, secret key and enabled push config cannot begin a Family batch', () => {
  for (const c of [{ ...staging, supabaseUrl: 'https://kttkospkblwvguuwnhjj.supabase.co' }, { ...staging, supabasePublishableKey: 'sb_secret_LOCAL_TEST' }, { ...staging, vapidPublicKey: 'LOCAL_PUSH' }]) assert.throws(() => parseConfig(config(c)));
});
test('Missing passwords stop before any network request', async () => {
  const r = await run({ fetcher: async () => { throw Error('Unexpected request'); } });
  assert.equal(r.problem_code, 'TWO_STAGING_APP_PASSWORDS_REQUIRED');
});
test('Foreign key, expired-token and unavailable-RPC errors cannot count as permission denial', () => {
  for (const r of [{ status: 400, data: { code: '23503' } }, { status: 401, data: { code: 'bad_jwt' } }, { status: 404, data: { code: 'PGRST202' } }, { status: 500, data: { code: '42501' } }]) {
    assert.equal(rowDenied(r), false); assert.equal(rpcDenied(r, ['INVITATION_NOT_AVAILABLE']), false);
  }
});
test('Transport exceptions print no secret, token, row or original error message', async () => {
  const privateText = 'LOCAL_PRIVATE_PASSWORD_OR_TOKEN';
  const r = await run({ ownerPassword: privateText, outsiderPassword: privateText, fetcher: async () => { throw Error(privateText); } });
  assert.equal(r.problem_code, 'NETWORK_OR_LOCAL_ERROR'); assert(!JSON.stringify(r).includes(privateText));
});
const runner = fs.readFileSync(path.join(__dirname, '../scripts/run-stage-3-family-acceptance.ps1'), 'utf8');
const expression = runner.match(/node -e '([^\n]+)'/)[1].replace(/''/g, "'");
test('PowerShell handoff stays ASCII and identifies app passwords separately from database passwords', () => {
  assert(!/[^\x00-\x7f]/.test(runner)); assert.equal((runner.match(/not the database password/g) || []).length, 2);
  assert(runner.includes('ZeroFreeBSTR') && runner.includes('Remove-Item Env:MUSHAVO_FAMILY_AUDIT_CODE'));
});
for (const [label, value, exit] of [['success', 'STAGING_FAMILY_API_SCOPED_PASS', 0], ['review', 'STAGING_FAMILY_API_REVIEW', 1]]) test('Extracted runner Node expression preserves ' + label + ' result and exit', () => {
  const output = spawnSync(process.execPath, ['-e', expression], { encoding: 'utf8', env: { ...process.env, MUSHAVO_FAMILY_AUDIT_CODE: 'module.exports.run=async()=>({result:' + JSON.stringify(value) + '});', MUSHAVO_FAMILY_OWNER_PASSWORD: 'LOCAL_DUMMY', MUSHAVO_FAMILY_MEMBER_PASSWORD: 'LOCAL_DUMMY' } });
  assert.equal(output.status, exit); assert.equal(JSON.parse(output.stdout).result, value); assert.equal(output.stderr, '');
});
test('Extracted runner rejection stays generic', () => {
  const output = spawnSync(process.execPath, ['-e', expression], { encoding: 'utf8', env: { ...process.env, MUSHAVO_FAMILY_AUDIT_CODE: "module.exports.run=async()=>{throw Error('LOCAL_PRIVATE_SECRET');};" } });
  assert.equal(output.status, 1); assert(!output.stdout.includes('LOCAL_PRIVATE_SECRET')); assert.equal(output.stderr, '');
});
