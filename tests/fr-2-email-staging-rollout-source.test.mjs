import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {renderStagingRollout,stagingCandidate} from '../scripts/lib/email-staging-rollout-source.mjs';
import {loadStagingInputs} from '../scripts/check-fr-2-email-staging-rollout-source.mjs';
const {components,baseline} = await loadStagingInputs();
const source = renderStagingRollout(components,baseline);
test('Staging candidate exactly matches the renderer and does not invoke activation or resume',async()=>{
  assert.equal(source,await readFile(new URL('../'+stagingCandidate,import.meta.url),'utf8'));
  assert(!/SELECT\s+mushavo_email_install\.(activate|resume|quarantine)\s*\(/i.test(source));
  assert(!source.includes("IS DISTINCT FROM 'OFFLINE_ATOMIC_REHEARSAL'"));
  assert(source.includes("'target_independently_verified',false"));
});
test('The original four components and guards stay embedded before rollout quarantine is added',()=>{
  for(const [i,name] of Object.keys(components).entries())assert(source.includes('-- COMPONENT '+name));
  assert(source.indexOf('-- FR_ATOMIC_FINAL_ASSERTIONS')<source.indexOf('-- FR_STAGING_AFTER_COMPONENTS'));
  assert.equal((source.match(/-- COMPONENT /g)||[]).length,4);
  assert(source.includes('EMAIL_DATA_GUARD_UNREVIEWED_ROUTINE_BASELINE'));
});
test('Changed source anchors and missing diagnostic structure are rejected',()=>{
  assert.throws(()=>renderStagingRollout(components,baseline.replace('WITH routines AS (','WITH changed AS (')));
  assert.throws(()=>renderStagingRollout({...components,verification_backend:components.verification_backend.replace('AND (s.not_after IS NULL OR s.not_after>statement_timestamp()));','AND true);')},baseline));
});
test('The check-only CLI accepts no deployment, activation or SQL write option',async()=>{
  const file=new URL('../'+stagingCandidate,import.meta.url),before=await readFile(file);
  const run=spawnSync(process.execPath,[fileURLToPath(new URL('../scripts/check-fr-2-email-staging-rollout-source.mjs',import.meta.url)),'--activate'],{encoding:'utf8'});
  assert.equal(run.status,1);assert.deepEqual(await readFile(file),before);
});
