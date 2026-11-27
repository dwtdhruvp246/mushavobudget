// Local source model only. No real accounts/provider access; no edits to historical models.
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
import {prepareReviewedEmailPlatform} from './lib/email-reviewed-platform-fixture.mjs';
import {handoffSQL} from './lib/email-registration-handoff-sql.mjs';
import {installationSQL} from './install-fr-2-email-batch-h.mjs';
import {windowHandoffSQL} from './lib/email-window-handoff-sql.mjs';
import {batchVReviewSQL,stage} from './lib/admin-batch-v-review.mjs';
const {db}=await localDatabase(process.argv[2],{preparePlatform:prepareReviewedEmailPlatform});try{
 await db.exec('alter table auth.mfa_factors add column friendly_name text,add column created_at timestamptz,add column updated_at timestamptz');await db.exec((await handoffSQL()).write);await db.exec((await installationSQL()).write);await db.exec((await windowHandoffSQL()).write);
 const sets=await db.exec(await batchVReviewSQL('primary@example.invalid','recovery@example.invalid')),v=sets.find(x=>x.rows?.[0]?.batch_v_review).rows[0].batch_v_review,a=v.admin_surface;
 const model={stage_step:stage,source_parent_commit:'35c2d1b46f6bd06c7c0792aecf4fe28d9e712e68',scope:'CURRENT_APP_MIGRATIONS_PLUS_ACCEPTED_H_AND_BOUNDED_CONTROLS_METADATA_ONLY',server_version:a.server_version,keys:{admin:Object.keys(a).sort(),identity:Object.keys(v.operator_identities).sort(),factor:Object.keys(v.factor_review).sort(),identity_account:Object.keys(v.operator_identities.accounts[0]).sort(),factor_account:Object.keys(v.factor_review.accounts[0]).sort()},routine_fingerprints:a.routine_fingerprints,policy_fingerprints:a.policy_fingerprints,candidate_helper_overloads:a.candidate_helper_overloads,selected_anonymous_executable_routines:a.selected_anonymous_executable_routines,selected_authenticated_executable_routines:a.selected_authenticated_executable_routines,actual_hosted_requests:0,hosted_acceptance:false};
 await writeFile(path.join(root,'docs/security-audit/security-fr-2-batch-v-source-model.json'),JSON.stringify(model,null,2)+'\n');console.log(JSON.stringify({routines:a.selected_routine_names,policies:a.selected_policies,model_server_version:a.server_version}));
}finally{await db.close();}
