// Reproducible local-only candidate receipt. No network or account mutation.
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const files=['tests/stage-3-auth-flows.test.mjs','tests/stage-3-auth-page.test.mjs','tests/stage-3-auth-edge-build.test.mjs',
 'tests/session-recovery.test.mjs','tests/startup-recovery.test.mjs','tests/admin-invitation-exit.test.mjs','tests/admin-invitation-setup-retry.test.mjs',
 'tests/admin-user-invitation-completion.test.mjs','tests/admin-user-invitations.test.mjs','tests/admin-invitation-replacement.test.mjs',
 'tests/signup-currencies.test.mjs','tests/admin-invitation-session-isolation.test.mjs','tests/admin-invitation-provision-guard.test.mjs','tests/stage-3-admin-mfa-ui-edge.test.mjs'];
const result=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const number=name=>Number(result.stdout?.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]||0);
if(result.status!==0){process.stderr.write((result.stdout||result.stderr||'Tests could not run.').slice(-10000));process.exit(1);}
const syntax=[];
for(const file of ['auth-security.js','auth-flows.js','app.js','business.js','scripts/build-stage-3-auth-staging.cjs']){
 const checked=spawnSync(process.execPath,['--check',resolve(root,file)],{encoding:'utf8'});
 if(checked.status!==0)throw Error('Syntax check failed: '+file);
 syntax.push(file);
}
const signup=await readFile(resolve(root,'signup.html'),'utf8');
const inline=signup.match(/<script type="module">([\s\S]*?)<\/script>/)?.[1];
if(!inline)throw Error('Signup module is missing.');new vm.Script(inline.replace(/^\s*import .*;\s*$/mg,''));syntax.push('signup.html inline module');
const receipt={stage_step:'3.5.2',result:'AUTH_CANDIDATE_LOCAL_SCOPED_PASS',scope:'NODE_CONTROLLER_VM_PAGE_AND_EDGE_MOCKS_SYNTHETIC_GIT_BUILD',
 tests:number('tests'),pass:number('pass'),fail:number('fail'),exit_code:result.status,test_files:files,syntax_checks:syntax.length,syntax_files:syntax,
 genuine_Auth_or_SMTP_verified:false,hosted_API_or_browser_checks_run:0,Auth_settings_verified:false,frontend_deployed:false,Edge_functions_deployed:false,
 production_or_native_changed:false,findings_F08_F15_closed:false};
if(!receipt.tests||receipt.fail||receipt.pass!==receipt.tests)throw Error('Unexpected test summary.');
if(process.argv[2])await writeFile(resolve(process.argv[2]),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify(receipt,null,2));
