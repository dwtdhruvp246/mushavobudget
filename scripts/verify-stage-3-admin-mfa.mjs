// One reproducible offline batch; external PGlite dependency, no repo install.
import {spawnSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './lib/stage-3-local-db.mjs';
if(!process.argv[2])throw Error('Provide the external PGlite module path.');
const paths=[
 'admin-mfa.js','app.js','app.html','.github/workflows/pages.yml',
 'supabase/candidates/security_stage_3_admin_mfa.sql','supabase/candidates/security_stage_3_admin_mfa_rollback.sql',
 'supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql',
 'supabase/functions/_shared/admin-assurance.mjs','supabase/functions/invite-admin-user/index.ts','supabase/functions/sync-exchange-rates/index.ts',
 'scripts/lib/stage-3-local-db.mjs','scripts/build-stage-3-admin-mfa.mjs','scripts/check-stage-3-admin-mfa.mjs',
 'scripts/verify-stage-3-admin-mfa.mjs','tests/stage-3-admin-mfa-ui-edge.test.mjs'
];
const run=(args)=> {
 const r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',env:{...process.env,NODE_NO_WARNINGS:'1'}});
 if(r.status!==0){console.error(r.stdout,r.stderr);throw Error('Local batch failed: '+args[0]);}
 return r.stdout;
};
const receipt=resolve(root,'docs/security-audit/security-stage-3-admin-mfa-local-db.json');
run(['scripts/check-stage-3-admin-mfa.mjs',process.argv[2],receipt]);
const db=JSON.parse(await readFile(receipt,'utf8'));
const suites=[];
for(const [name,files] of [
 ['MFA controller and actual Edge handlers with local adapters',['tests/stage-3-admin-mfa-ui-edge.test.mjs']],
 ['Existing invitation, manual-grant and plan workbench regression',['tests/admin-invitation-session-isolation.test.mjs','tests/admin-manual-subscription.test.mjs','tests/admin-plans-workbench.test.mjs']]
]) {
 const stdout=run(['--test','--test-reporter=tap',...files]);
 const passed=Number(stdout.match(/^# pass (\d+)$/m)?.[1]),failed=Number(stdout.match(/^# fail (\d+)$/m)?.[1]);
 if(!Number.isFinite(passed)||failed!==0)throw Error('Incomplete test reporter output');
 suites.push({name,passed,failed});
}
for(const path of ['app.js','admin-mfa.js','supabase/functions/_shared/admin-assurance.mjs'])run(['--check',path]);
const hashes={};for(const path of paths)hashes[path]=createHash('sha256').update(await readFile(resolve(root,path))).digest('hex');
const summary={stage_step:'3.4.2',source_parent:'9703bcac1731c1f5b68b7c3537ab0e27b3a2ae72',scope:'OFFLINE_CANDIDATE_ONLY',
 database:{passed:db.passed,failed:db.failed,migrations:db.migration_count,auth_storage_grants:'MODELED'},suites,
 total_passed:db.passed+suites.reduce((n,s)=>n+s.passed,0),failed:0,syntax_checks_passed:3,
 candidate_guarded_routines:36,candidate_replaced_routines:30,candidate_public_policies:55,candidate_storage_policies:3,
 hosted_authorization_verified:false,genuine_totp_or_auth_issued_session_verified:false,
 browser_render_verified:false,native_windows_or_deno_runtime_verified:false,recovery_exercised_on_hosted_actor:false,
 live_email_or_provider_dispatch_executed:false,production_or_staging_deployment_performed:false,
 findings_closed:[],source_sha256:hashes};
await writeFile(resolve(root,'docs/security-audit/security-stage-3-admin-mfa-local-checks.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({database:summary.database,suites,total_passed:summary.total_passed,failed:0,hosted_authorization_verified:false}));
