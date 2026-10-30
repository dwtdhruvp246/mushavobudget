import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const files=['scripts/lib/fr-2-operator-mfa.mjs','scripts/setup-fr-2-operator-mfa.mjs','scripts/verify-fr-2-operator-mfa.mjs','tests/fr-2-operator-mfa.test.mjs','tests/fixtures/fr-2-operator-mfa-pre-size-fix.txt'];
let syntax=0;
for(const file of files.filter(f=>f.endsWith('.mjs'))) {
  const p=spawnSync(process.execPath,['--check',path.join(root,file)],{encoding:'utf8',timeout:10000});
  if(p.status!==0) {console.log(JSON.stringify({result:'LOCAL_SYNTAX_FAILED',file,exit_code:1}));process.exit(1);} syntax++;
}
const p=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(root,files[3])],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:60000});
const count=name=>Number(p.stdout?.match(new RegExp('^# '+name+' (\\d+)$','m'))?.[1]??-1);
const pass=count('pass'),fail=count('fail'),tests=count('tests');
const ok=p.status===0&&tests===31&&pass===tests&&fail===0&&count('skipped')===0&&count('cancelled')===0;
const result={stage_step:'FR.2.4_OPERATOR_MFA_PREPARATION',
 result:ok?'OFFLINE_ACTUAL_OPERATOR_MFA_FLOW_WITH_SYNTHETIC_AUTH_SCOPED_PASS':'OFFLINE_OPERATOR_MFA_REVIEW_REQUIRED',
 scope:'ACTUAL_NODE_CLIENT_CONTROL_FLOW_WITH_SYNTHETIC_AUTH_HTTP_STREAMS_AND_CLI_REJECTION_CASES',
 node_version:process.version,tests,pass,fail,cancelled:count('cancelled'),skipped:count('skipped'),exit_code:ok?0:1,
 syntax_checks:syntax,file_sha256:Object.fromEntries(files.map(f=>[f,createHash('sha256').update(readFileSync(path.join(root,f))).digest('hex')])),
 real_hosted_requests:0,actual_Auth_signin_or_factor_enrollment_or_AAL2_verified:false,
 Windows_PowerShell_or_terminal_secret_display_execution_verified:false,
 hosted_Auth_accounts_roles_SQL_or_settings_changed:false,hosted_acceptance:false,findings_closed:[]};
console.log(JSON.stringify(result,null,2));process.exitCode=ok?0:1;
