// E5.1 local review package only. No credentials, provider calls or deployment.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareFinalStaging} from './prepare-final-staging.mjs';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';
import {writePublicZIP} from './lib/store-public-zip.mjs';
export const packageStage='FR.2.4.E5.1_LOCAL_UPLOAD_CANDIDATE';
const hash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root,file)=>{const rel=path.relative(root,file);return !rel||(!path.isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+path.sep));};
function ordinary(input,directory) {
  const full=path.resolve(input),stat=fs.lstatSync(full);
  if(stat.isSymbolicLink()||!(directory?stat.isDirectory():stat.isFile())||!same(fs.realpathSync(full),full))throw Error('ORDINARY_PATH_REQUIRED');
  return full;
}
function read(root,relative) {
  if(!/^[A-Za-z0-9_./-]+$/.test(relative)||relative.split('/').includes('..'))throw Error('SOURCE_PATH');
  const file=ordinary(path.join(root,relative),false);if(!inside(root,file)||fs.statSync(file).size>2*1024*1024)throw Error('SOURCE_BOUND');
  return fs.readFileSync(file);
}
export function verifyPackageSources(source) {
  source=ordinary(source,true);
  const manifest=JSON.parse(read(source,'docs/security-audit/security-fr-2-email-staging-package-source-manifest.json'));
  if(manifest.stage_step!==packageStage||manifest.source_file_count!==57||Object.keys(manifest.file_sha256||{}).length!==57)throw Error('SOURCE_MANIFEST');
  for(const [name,expected]of Object.entries(manifest.file_sha256)) {
    if(!/^[a-f0-9]{64}$/.test(expected)||hash(read(source,name))!==expected)throw Error('SOURCE_IDENTITY');
  }
  return manifest;
}
export function readStagingConfiguration(filename) {
  const full=ordinary(filename,false),size=fs.statSync(full).size;
  if(size<1||size>16384)throw Error('CONFIG_BOUND');
  const text=fs.readFileSync(full,'utf8').replace(/^\uFEFF/,'');
  const match=text.match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if(!match)throw Error('CONFIG_FORMAT');
  const config=JSON.parse(match[1]);
  if(!config||Array.isArray(config)||Object.keys(config).sort().join(',')!=='supabasePublishableKey,supabaseUrl,vapidPublicKey'||
    config.supabaseUrl!=='https://dczlddwbtgvfdujgcitb.supabase.co'||config.vapidPublicKey!==''||
    typeof config.supabasePublishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(config.supabasePublishableKey))throw Error('CONFIG_SCOPE');
  return config;
}
export async function prepareEmailStaging({source,configuration,candidate,toolsRoot}) {
  source=ordinary(source,true);toolsRoot=ordinary(toolsRoot,true);candidate=ordinary(candidate,true);
  if(inside(source,candidate)||inside(candidate,source)||inside(candidate,path.resolve(configuration))||fs.readdirSync(candidate).length)throw Error('NEW_ISOLATED_EMPTY_CANDIDATE_REQUIRED');
  const manifest=verifyPackageSources(source);
  const contract=JSON.parse(read(source,'docs/security-audit/security-fr-2-email-staging-package-contract.json'));
  if(contract.stage_step!==packageStage||contract.expected_public_files!==44||contract.activation_approved!==false||
    contract.worker_sha256!=='fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99'||
    JSON.stringify(contract.routes)!=='{"version":1,"include":["/*"],"exclude":[]}')throw Error('PACKAGE_CONTRACT');
  for(const name of ['package.json','package-lock.json']) {
    if(!fs.readFileSync(ordinary(path.join(toolsRoot,name),false)).equals(read(source,'scripts/fixtures/email-worker-tools/'+name)))throw Error('TOOLS_LOCK');
  }
  const require=createRequire(path.join(toolsRoot,'package.json'));
  const esbuild=require('esbuild');if(esbuild.version!=='0.28.2')throw Error('TOOLS_VERSION');
  const config=readStagingConfiguration(configuration);
  // Build before any candidate writes; require the previously accepted exact bundle.
  const bundles=await buildEmailWorkers(esbuild,source),worker=Buffer.from(bundles.pages);
  if(hash(worker)!==contract.worker_sha256)throw Error('WORKER_IDENTITY');
  const output=path.join(candidate,'public');
  const component=prepareFinalStaging({source,output,receipt:path.join(candidate,'static-component-receipt.json'),
    sourcePin:contract.application_source_commit,project:'dczlddwbtgvfdujgcitb',publishableKey:config.supabasePublishableKey,
    contract:contract.static_preparation_contract});
  fs.writeFileSync(path.join(output,'_worker.js'),worker,{flag:'wx'});
  fs.writeFileSync(path.join(output,'_routes.json'),JSON.stringify(contract.routes)+'\n',{flag:'wx'});
  const names=[...contract.static_preparation_contract.public_inputs.map(x=>x.path),'404.html','_headers','_worker.js','_routes.json'].sort();
  if(names.length!==44||new Set(names).size!==44)throw Error('PACKAGE_ALLOWLIST');
  const files=names.map(name=>[name,fs.readFileSync(ordinary(path.join(output,name),false))]);
  if(files.some(([,bytes])=>bytes.includes(Buffer.from('kttkospkblwvguuwnhjj'))))throw Error('PRODUCTION_REFERENCE');
  const assets=files.filter(([name])=>name!=='config.js').map(([name,bytes])=>({path:name,bytes:bytes.length,sha256:hash(bytes)}));
  fs.writeFileSync(path.join(candidate,'public-asset-manifest.json'),JSON.stringify(assets,null,2)+'\n',{flag:'wx'});
  const zip=path.join(candidate,'mushavo-email-staging-review.zip'),zipBytes=writePublicZIP(zip,files);
  const summary={stage_step:packageStage,result:'LOCAL_ADVANCED_MODE_REVIEW_ZIP_PREPARED_NOT_DEPLOYED',
    node_version:process.version,pinned_esbuild_version:esbuild.version,installed_package_bytes_independently_hashed:false,
    application_source_commit:contract.application_source_commit,target_project:contract.target_project,target_domain:contract.target_domain,
    source_files_SHA256_verified:Object.keys(manifest.file_sha256).length,selected_public_and_header_source_identities_verified:component.selected_source_inputs_verified,
    public_files:44,non_config_asset_hashes_recorded:assets.length,Worker_SHA256:hash(worker),Worker_matches_accepted_bundle:true,
    literal_forward_slash_ZIP_paths_written:true,all_routes_forward_to_reviewed_Worker:true,manifest_content_type_rule_present:true,
    local_dependencies_and_production_reference_scan_passed:true,headers_regenerated_from_final_HTML:true,
    staging_configuration_reused_locally:true,push_key_disabled:true,key_ownership_independently_verified:false,
    configuration_key_body_or_hash_printed:false,receipt_SQL_tools_and_audit_files_excluded:true,
    previous_candidate_and_source_changed:false,ZIP_SHA256:hash(zipBytes),ZIP_path:zip,
    Windows_dotNET_ZIP_independent_readback_verified:false,actual_hosted_requests:0,actual_email_dispatched:false,
    bindings_or_secrets_installed:false,email_enforcement_activated:false,do_not_upload_yet:true,deployed:false,
    hosted_acceptance:false,findings_closed:[],production_or_native_changed:false,APK_update_deferred:true,exit_code:0};
  fs.writeFileSync(path.join(candidate,'preparation-receipt.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
  return summary;
}
if(process.argv[1]&&same(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))) {
  try {
    if(process.argv.length!==6)throw Error('ARGUMENT_COUNT');
    console.log(JSON.stringify(await prepareEmailStaging({source:process.argv[2],configuration:process.argv[3],candidate:process.argv[4],toolsRoot:process.argv[5]}),null,2));
  } catch {
    console.log(JSON.stringify({stage_step:packageStage,result:'LOCAL_PACKAGE_REVIEW_REQUIRED_NOT_DEPLOYED',
      problem_code:'SOURCE_TOOLS_CONFIG_OR_NEW_OUTPUT_REVIEW_REQUIRED',raw_exceptions_or_configuration_printed:false,
      actual_hosted_requests:0,deployed:false,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;
  }
}
