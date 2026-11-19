// Check only: no write, connection, credential or activation option.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {renderStagingRollout, stagingCandidate} from './lib/email-staging-rollout-source.mjs';
import {componentNames} from './lib/email-atomic-source.mjs';
const root = new URL('../', import.meta.url);
export async function loadStagingInputs() {
  const components = Object.fromEntries(await Promise.all(componentNames.map(async name => [
    name, await readFile(new URL('supabase/candidates/security_fr_2_4_email_' + name + '.sql', root), 'utf8')
  ])));
  const baseline = await readFile(new URL('supabase/diagnostics/security_fr_2_4_email_pre_activation_reviewed_types.sql', root), 'utf8');
  return {components, baseline};
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw new Error('CHECK_ONLY');
    const {components, baseline} = await loadStagingInputs();
    if (await readFile(new URL(stagingCandidate, root), 'utf8') !== renderStagingRollout(components, baseline))
      throw new Error('SOURCE_DRIFT');
    console.log(JSON.stringify({result:'STAGING_ROLLOUT_SOURCE_MATCHES',files_changed:false,activation_invoked:false}));
  } catch {
    console.log(JSON.stringify({result:'STAGING_ROLLOUT_SOURCE_REVIEW_REQUIRED',files_changed:false,activation_invoked:false}));
    process.exitCode = 1;
  }
}
