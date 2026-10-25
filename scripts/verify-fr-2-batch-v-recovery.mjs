import {readFile,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {stage} from './lib/admin-batch-v-recovery.mjs';
import {verifyRecoverySources} from './setup-fr-2-batch-v-recovery.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),dependency=process.argv[2];
let hashes=0,syntax=0,group=null,checkpoint='SOURCE_IDENTITIES',problem=null;
try{
 assert.equal(process.argv.length,3);hashes=await verifyRecoverySources();
 const m=JSON.parse(await readFile(path.join(root,'docs/security-audit/security-fr-2-batch-v-recovery-source-manifest.json'),'utf8'));
 checkpoint='SYNTAX';for(const name of m.syntax_paths){assert.equal(spawnSync(process.execPath,['--check',path.join(root,name)],{encoding:'utf8',timeout:30000}).status,0);syntax++;}
 checkpoint='RETAINED_PUBLIC_PGLITE';assert(path.isAbsolute(dependency));assert(!(await lstat(dependency)).isSymbolicLink());
 const pkg=JSON.parse(await readFile(path.resolve(path.dirname(dependency),'../package.json'),'utf8'));assert.equal(pkg.name,'@electric-sql/pglite');assert.equal(pkg.version,'0.5.8');
 const lock=JSON.parse(await readFile(path.join(root,'scripts/fixtures/email-session-review-tools/package-lock.json'),'utf8'));assert.equal(lock.packages['node_modules/@electric-sql/pglite'].integrity,'sha512-n9tsbUOhwx2epK1V0ZG9Ar4SHWUju04dhmzZXiSBXwBoleOvIfals33NAaWgagQVAL4Rbvx/Ptsu3P+pA09f6Q==');
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(TOKEN|PASSWORD|SECRET|SUPABASE|ZOHO|EMAIL_GATE|NODE_OPTIONS|NODE_DEBUG|NODE_TLS|SSLKEYLOG|CLOUDFLARE|WRANGLER)/i.test(k)));env.MUSHAVO_EMAIL_UI_PGLITE=dependency;
 checkpoint='COMBINED_METADATA_RETAINED_MFA_AND_CURRENT_RECOVERY_TESTS';
 const out=spawnSync(process.execPath,['--require',path.join(root,'scripts/offline-full-app-network.cjs'),'--test','--test-concurrency=1','--test-reporter=tap',...['fr-2-batch-v.test.mjs','fr-2-operator-mfa.test.mjs','fr-2-batch-v-mfa.test.mjs','fr-2-batch-v-recovery.test.mjs'].map(x=>path.join(root,'tests',x))],{cwd:root,env,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});
 const count=k=>Number((out.stdout||'').match(new RegExp('^# '+k+' (\\d+)\\s*$','m'))?.[1]??-1);
 group={tests:count('tests'),pass:count('pass'),fail:count('fail'),cancelled:count('cancelled'),skipped:count('skipped'),exit_code:out.status,failed_case_numbers:[...(out.stdout||'').matchAll(/^not ok ([0-9]+) - /gm)].map(x=>Number(x[1]))};
 assert.equal(group.tests,86);assert.equal(group.pass,86);assert.equal(group.fail,0);assert.equal(group.cancelled,0);assert.equal(group.skipped,0);assert.equal(group.exit_code,0);checkpoint='COMPLETE';
}catch{problem='BATCH_V_LOCAL_RECOVERY_REVIEW_REQUIRED';}
const ok=checkpoint==='COMPLETE'&&!problem;
console.log(JSON.stringify({stage_step:stage,progress_display:'Stage 3/10 | FR.2/8 | Batch V/Z',
 result:ok?'BATCH_V_LOCAL86_PASS_CURRENT_RECOVERY_OWNER_READY':'BATCH_V_LOCAL_RECOVERY_REVIEW_REQUIRED',
 source_parent_commit:'9b22f38bca162ca6c908f7fa1b99e7135fa80536',owner_next_action:'GUARDED_CURRENT_MFA_RESUME_OR_RECOVER_WHEN_PHONE_READY',
 node_version:process.version,pglite_version:'0.5.8',source_hashes_verified:hashes,syntax_checks:syntax,frozen_U_source_hashes_unchanged:ok?310:null,
 prior68_regressions_preserved:ok,new_recovery_cases:18,tests:group?.tests??0,pass:group?.pass??0,fail:group?.fail??0,group,
 actual_installed_read_only_snapshot_SQL_executed:ok,exact_pending_resume_and_primary_first_replacement_exercised:ok,
 both_flows_all_transport_loss_positions_exercised:ok,simulated_provider_expiry_and_outside_factor_boundary_exercised:ok,
 hosted_Auth_build_or_expiry_behavior_verified:false,phone_not_ready_stops_before_any_credentials_or_hosted_request:ok,
 Windows_private_terminal_or_real_authenticator_executed:false,real_PostgreSQL_concurrency_verified:false,installed_dependency_bytes_independently_hashed:false,
 actual_hosted_requests:0,Auth_requests:0,real_email_requests:0,real_factors_roles_or_settings_changed:false,real_credentials_or_private_packets_accessed:false,
 origin_of_prior_enrollment_established:false,genuine_hosted_AAL2_or_recovery_drill_verified:false,full_lettered_batch_V_complete:false,
 hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint,problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));
process.exitCode=ok?0:1;
