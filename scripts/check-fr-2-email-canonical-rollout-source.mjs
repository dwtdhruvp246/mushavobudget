// Check-only CLI. No connection or SQL execution mode.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {loadStagingInputs} from './check-fr-2-email-staging-rollout-source.mjs';
import {renderCanonicalBridge,renderCanonicalRegistration,canonicalMigration,registrationBundle} from './lib/email-canonical-rollout-source.mjs';
const root=new URL('../',import.meta.url);
export async function loadCanonicalRollout(){const {components,baseline}=await loadStagingInputs();return {migration:renderCanonicalBridge(components,baseline),registration:renderCanonicalRegistration(components,baseline)};}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let ok=false;try{if(process.argv.length!==2)throw Error('CHECK_ONLY');const rendered=await loadCanonicalRollout();ok=await readFile(new URL('supabase/migrations/'+canonicalMigration,root),'utf8')===rendered.migration&&await readFile(new URL(registrationBundle,root),'utf8')===rendered.registration;}catch{}
 console.log(JSON.stringify({result:ok?'CANONICAL_ROLLOUT_SOURCE_MATCHES':'CANONICAL_ROLLOUT_SOURCE_REVIEW_REQUIRED',files_changed:false,hosted_requests:0,activation_invoked:false}));process.exitCode=ok?0:1;
}
