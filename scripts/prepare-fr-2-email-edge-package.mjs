// Local public source preparation only. No network, credentials or deploy mode.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const preparationStage='FR.2.4.E5.11_FIRST_EDGE_DEPLOYMENT_PREPARATION';
export const preparationRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const preparationManifest='docs/security-audit/security-fr-2-email-edge-preparation-source-manifest.json';
export const edgeNames=Object.freeze(['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates']);
export const stagingConfigSource='deployment/candidates/email-edge-staging.config.toml';
const sha=b=>createHash('sha256').update(b).digest('hex');
const byName=([a],[b])=>a<b?-1:a>b?1:0;
const need=(b,code)=>{if(!b)throw Object.assign(Error(code),{safeCode:code});};
const validRelative=p=>typeof p==='string'&&/^[A-Za-z0-9_./-]+$/.test(p)&&!path.isAbsolute(p)&&!p.includes('..');
export function assertOrdinaryPath(value){
  let p=path.resolve(value);
  for(;;){
    if(fs.existsSync(p))need(!fs.lstatSync(p).isSymbolicLink(),'LOCAL_PATH_REVIEW_REQUIRED');
    const parent=path.dirname(p);if(parent===p)break;p=parent;
  }
  const full=path.resolve(value);
  if(fs.existsSync(full)){
    const real=fs.realpathSync(full);
    need(process.platform==='win32'?real.toLowerCase()===full.toLowerCase():real===full,'LOCAL_PATH_REVIEW_REQUIRED');
  }
}
export function renderedStagingConfig(){
  return '# Offline staging preparation only. This project label is not target attestation.\nproject_id = "dczlddwbtgvfdujgcitb"\n\n'+
    edgeNames.map((slug,i)=>`[functions.${slug}]\nverify_jwt = ${i<2?'true':'false'}\nentrypoint = "./functions/${slug}/index.ts"\n`).join('\n');
}
export function sourceSnapshot(sourceRoot=preparationRoot){
  assertOrdinaryPath(sourceRoot);
  const manifestPath=path.join(sourceRoot,preparationManifest);assertOrdinaryPath(manifestPath);
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  need(manifest.stage_step===preparationStage&&Object.keys(manifest.file_sha256).length===manifest.source_file_count,'SOURCE_MANIFEST_REVIEW_REQUIRED');
  const bytes=new Map();
  for(const [name,expected]of Object.entries(manifest.file_sha256)){
    need(validRelative(name)&&/^[a-f0-9]{64}$/.test(expected),'SOURCE_MANIFEST_REVIEW_REQUIRED');
    const file=path.join(sourceRoot,name);assertOrdinaryPath(file);
    const stat=fs.lstatSync(file);need(stat.isFile()&&stat.size>0&&stat.size<=2097152,'SOURCE_IDENTITY_REVIEW_REQUIRED');
    const data=fs.readFileSync(file);need(sha(data)===expected,'SOURCE_IDENTITY_REVIEW_REQUIRED');bytes.set(name,data);
  }
  need(bytes.get(stagingConfigSource)?.toString('utf8')===renderedStagingConfig(),'STAGING_CONFIG_REVIEW_REQUIRED');
  const absence=JSON.parse(bytes.get('docs/security-audit/security-fr-2-email-edge-inventory-owner-absence.json').toString('utf8'));
  const observed=absence.receipt?.function_list_observations?.[0];
  need(absence.receipt?.diagnostic_revision===2&&observed?.observation==='BEFORE'&&
    observed.selected_functions.length===4&&observed.selected_functions.every((x,i)=>x.slug===edgeNames[i]&&x.present===false),
    'ABSENCE_BASELINE_REVIEW_REQUIRED');
  const files=new Map();
  for(const mapping of manifest.package_inputs){
    need(validRelative(mapping.source)&&validRelative(mapping.destination)&&bytes.has(mapping.source)&&!files.has(mapping.destination),'SOURCE_MANIFEST_REVIEW_REQUIRED');
    files.set(mapping.destination,bytes.get(mapping.source));
  }
  const fileHashes=Object.fromEntries([...files].sort(byName).map(([name,data])=>[name,sha(data)]));
  const plan={schema_version:1,purpose:'OFFLINE_STAGING_EDGE_SOURCE_PREPARATION_ONLY_NOT_DEPLOYMENT',
    project:'dczlddwbtgvfdujgcitb',origin:'https://mushavo-budget-staging.pages.dev',
    source_parent_commit:'82694d5a9a1d69f23fcf8151cfab37950b5f6048',
    observed_absence_checked_UTC:absence.receipt.checked_UTC,observed_absence_is_not_a_current_write_precondition:true,
    selected_functions:edgeNames.map((slug,i)=>({slug,entrypoint:`supabase/functions/${slug}/index.ts`,verify_jwt:i<2,
      first_deployment:true,previous_deployment_version:null})),
    files_SHA256:fileHashes,
    readiness:{fresh_provider_target_and_absence:false,unrelated_function_identity_retained:false,
      private_Edge_configuration_verified:false,FX_scheduler_and_external_callers_reviewed:false,
      database_candidate_canonical_integration:false,privileged_SQL_target_and_recovery_baseline:false,
      current_Pages_identity_and_installed_bindings_verified:false,coordinated_window_and_recovery_tested:false,
      hosted_gateway_JWT_and_authorization_verified:false},
    recovery:{before_database_activation:{return_to_absence_requires_rollout_owned_ID_and_version:true,automatic_delete:false},
      after_database_activation:{quarantine_and_forward_repair_required:true,enforcement_and_application_rows_retained:true,automatic_delete:false}},
    deployable_now:false,hosted_write_approved:false,live_activation_approved:false,hosted_acceptance:false};
  files.set('preparation-plan.json',Buffer.from(JSON.stringify(plan,null,2)+'\n'));
  const packageIdentity=sha(JSON.stringify(Object.fromEntries([...files].sort(byName).map(([n,b])=>[n,sha(b)]))));
  return {files,packageIdentity,sourceCount:bytes.size,plan};
}
function packagePaths(root){
  const files=[];let entries=0;
  function walk(dir,depth=0){need(depth<=5,'PACKAGE_CONTENT_REVIEW_REQUIRED');for(const e of fs.readdirSync(dir,{withFileTypes:true})){
    need(++entries<=64,'PACKAGE_CONTENT_REVIEW_REQUIRED');
    const file=path.join(dir,e.name);assertOrdinaryPath(file);const stat=fs.lstatSync(file);
    need(stat.isFile()||stat.isDirectory(),'PACKAGE_CONTENT_REVIEW_REQUIRED');
    if(stat.isDirectory())walk(file,depth+1);else files.push(path.relative(root,file).split(path.sep).join('/'));
  }}
  walk(root);return files.sort();
}
export function inspectPreparedPackage(output,{sourceRoot=preparationRoot}={}){
  need(typeof output==='string'&&path.isAbsolute(output),'LOCAL_PATH_REVIEW_REQUIRED');assertOrdinaryPath(output);
  need(fs.lstatSync(output).isDirectory(),'LOCAL_PATH_REVIEW_REQUIRED');
  const snapshot=sourceSnapshot(sourceRoot);
  need(JSON.stringify(packagePaths(output))===JSON.stringify([...snapshot.files.keys()].sort()),'PACKAGE_CONTENT_REVIEW_REQUIRED');
  for(const [name,expected]of snapshot.files){const file=path.join(output,name);need(fs.statSync(file).size===expected.length&&fs.readFileSync(file).equals(expected),'PACKAGE_CONTENT_REVIEW_REQUIRED');}
  return snapshot;
}
export function prepareEdgePackage(output,{sourceRoot=preparationRoot}={}){
  need(typeof output==='string'&&path.isAbsolute(output),'LOCAL_PATH_REVIEW_REQUIRED');assertOrdinaryPath(output);
  need(!fs.existsSync(output)&&fs.statSync(path.dirname(output)).isDirectory(),'FRESH_OUTPUT_DIRECTORY_REQUIRED');
  // Read and validate every public input before creating the output directory.
  const snapshot=sourceSnapshot(sourceRoot);fs.mkdirSync(output);
  for(const [name,data]of snapshot.files){const file=path.join(output,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,data,{flag:'wx'});}
  return inspectPreparedPackage(output,{sourceRoot});
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  let r;
  try{
    need(process.argv.length===4&&['--prepare','--inspect'].includes(process.argv[2]),'LOCAL_PREPARATION_ARGUMENTS_REQUIRED');
    const output=process.argv[3];const s=process.argv[2]==='--prepare'?prepareEdgePackage(output):inspectPreparedPackage(output);
    r={stage_step:preparationStage,result:'OFFLINE_FIRST_EDGE_SOURCE_PACKAGE_SCOPED_PASS_NOT_DEPLOYED',
      source_files_SHA256_verified:s.sourceCount,package_files:s.files.size,package_SHA256:s.packageIdentity,
      package_directory:path.resolve(output),credentials_requested:false,actual_hosted_requests:0,
      uploaded_or_deployed:false,live_activation_approved:false,hosted_acceptance:false,exit_code:0};
  }catch(error){
    const codes=new Set(['LOCAL_PATH_REVIEW_REQUIRED','FRESH_OUTPUT_DIRECTORY_REQUIRED','SOURCE_MANIFEST_REVIEW_REQUIRED','SOURCE_IDENTITY_REVIEW_REQUIRED','STAGING_CONFIG_REVIEW_REQUIRED','ABSENCE_BASELINE_REVIEW_REQUIRED','PACKAGE_CONTENT_REVIEW_REQUIRED','LOCAL_PREPARATION_ARGUMENTS_REQUIRED']);
    r={stage_step:preparationStage,result:'LOCAL_FIRST_EDGE_PREPARATION_REVIEW_REQUIRED',problem_code:codes.has(error?.safeCode)?error.safeCode:'LOCAL_PREPARATION_REVIEW_REQUIRED',actual_hosted_requests:0,uploaded_or_deployed:false,exit_code:1};
  }
  console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;
}
