import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let count = 0, syntax = [], run = null, problem = null;
try {
  const manifest = JSON.parse(await readFile(path.join(root,
    'docs/security-audit/security-fr-2-zoho-private-setup-source-manifest.json'), 'utf8'));
  const files = Object.entries(manifest.file_sha256);
  if (files.length !== 8) throw Error();
  for (const [file, expected] of files) {
    if (!/^[A-Za-z0-9_./-]+$/.test(file) || file.includes('..') || path.isAbsolute(file)) throw Error();
    const raw = await readFile(path.join(root, file));
    if (createHash('sha256').update(raw).digest('hex') !== expected) throw Error();
    count++;
  }
  for (const file of files.map(x=>x[0]).filter(f=>/\.[cm]js$/.test(f))) {
    const c = spawnSync(process.execPath, ['--check', path.join(root,file)], {encoding:'utf8',timeout:10000});
    syntax.push({file,pass:c.status===0});
  }
  if (syntax.length !== 7 || syntax.some(x=>!x.pass)) throw Error();
  const c = spawnSync(process.execPath, ['--require','./scripts/offline-test-network.cjs',
    '--test','--test-reporter=tap','tests/fr-2-zoho-private-setup.test.mjs'], {
    cwd:root, encoding:'utf8',timeout:15000,maxBuffer:1024*1024});
  const number = key => Number(c.stdout.match(new RegExp('^# '+key+' (\\d+)$','m'))?.[1] || 0);
  run = {tests:number('tests'),pass:number('pass'),fail:number('fail'),exit_code:c.status};
  if (run.tests !== 30 || run.pass !== 30 || run.fail !== 0 || c.status !== 0) throw Error();
} catch { problem = 'OFFLINE_SOURCE_OR_CHECK_REVIEW_REQUIRED'; }
const good = !problem;
console.log(JSON.stringify({stage_step:'FR.2.4.E3.3_PRIVATE_ZOHO_SETUP_OFFLINE',
  result:good?'OFFLINE_ACTUAL_OAUTH_SETUP_HANDLER_AND_PRIVATE_OUTPUT_SCOPED_PASS':'OFFLINE_REVIEW_REQUIRED',
  node_version:process.version, source_files_SHA256_verified:count, syntax_checks:syntax.length, syntax,
  tests:run?.tests||0, pass:run?.pass||0, fail:run?.fail||(good?0:1), exit_code:good?0:1,
  scope:'ACTUAL_JS_HANDLER_SYNTHETIC_ZOHO_PORTS_CLI_REJECTIONS_AND_POWERSHELL_SOURCE_ASSERTIONS',
  Windows_PowerShell_execution_or_DPAPI_encryption_verified:false,
  actual_OAuth_Auth_Zoho_or_Cloudflare_HTTP_requests:0, actual_email_dispatched:false,
  hosted_settings_or_Auth_roles_SQL_or_native_changed:false,
  installed_or_live_application_guards_verified:false, hosted_acceptance:false,
  findings_closed:[], problem_code:problem, APK_update_deferred:true},null,2));
process.exitCode = good?0:1;
