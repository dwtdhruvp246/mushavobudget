// FR.1.3: validate the retained candidate, then prepare a new static candidate.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {prepareFinalStaging,MANIFEST_HEADERS} from './prepare-final-staging.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha=data=>createHash('sha256').update(data).digest('hex');
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
function ordinary(location,directory=false,max=2097152) {
 const full=path.resolve(location),stat=fs.lstatSync(full);
 if(stat.isSymbolicLink() || !same(fs.realpathSync(full),full) ||
    (directory?!stat.isDirectory():!stat.isFile()||stat.size<1||stat.size>max))throw Error('UNEXPECTED_OR_REDIRECTED_PATH');
 return full;
}
export function prepareCorrection({source=root,previous,candidate}) {
 source=ordinary(source,true);previous=ordinary(previous,true);candidate=ordinary(candidate,true);
 if(fs.readdirSync(candidate).length)throw Error('NEW_CANDIDATE_PARENT_MUST_BE_EMPTY');
 const publicRoot=ordinary(path.join(previous,'public'),true);
 const receipt=JSON.parse(fs.readFileSync(ordinary(path.join(previous,'preparation-receipt.json'),false,262144),'utf8'));
 const contract=JSON.parse(fs.readFileSync(path.join(source,'docs/security-audit/security-final-staging-source-contract.json'),'utf8'));
 if(receipt.source_commit!==contract.source_commit || receipt.project!==contract.staging_project || receipt.public_files!==40 ||
    receipt.selected_source_inputs_verified!==39 || receipt.deployed!==false ||
    receipt.result!=='ISOLATED_STAGING_STATIC_CANDIDATE_PREPARED_NOT_DEPLOYED')throw Error('PREVIOUS_RECEIPT_IDENTITY');
 const configText=fs.readFileSync(ordinary(path.join(publicRoot,'config.js'),false,32768),'utf8');
 const match=configText.match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
 if(!match)throw Error('PREVIOUS_CONFIG_SHAPE');
 const config=JSON.parse(match[1]);
 if(Object.keys(config).sort().join(',')!=='supabasePublishableKey,supabaseUrl,vapidPublicKey' ||
    config.supabaseUrl!=='https://dczlddwbtgvfdujgcitb.supabase.co' ||
    typeof config.supabasePublishableKey!=='string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.supabasePublishableKey) ||
    config.vapidPublicKey!=='')throw Error('PREVIOUS_CONFIG_SHAPE');
 if(fs.readFileSync(path.join(source,'config.js')).includes(Buffer.from(config.supabasePublishableKey)))throw Error('SOURCE_KEY_REUSE');
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'mushavo-delivery-expected-'));
 try {
  const expectation=prepareFinalStaging({source,output:path.join(temp,'public'),receipt:path.join(temp,'receipt.json'),sourcePin:contract.source_commit,
   project:contract.staging_project,publishableKey:'sb_publishable_SYNTHETIC_EXPECTATION_ONLY',contract});
  const expectedNames=[...contract.public_inputs.map(x=>x.path),'404.html','_headers'].sort();
  const actualNames=[];
  for(const name of fs.readdirSync(publicRoot)) {
   const full=path.join(publicRoot,name);
   if(name==='assets') {
    ordinary(full,true);
    for(const asset of fs.readdirSync(full)){ordinary(path.join(full,asset));actualNames.push('assets/'+asset);}
   }else{ordinary(full);actualNames.push(name);}
  }
  if(JSON.stringify(actualNames.sort())!==JSON.stringify(expectedNames))throw Error('PREVIOUS_PUBLIC_FILE_SET');
  const rows=receipt.public_asset_manifest;
  if(!Array.isArray(rows)||rows.length!==39 || JSON.stringify(rows.map(x=>x.path).sort())!==JSON.stringify(expectedNames.filter(x=>x!=='config.js')))throw Error('PREVIOUS_MANIFEST_SET');
  for(const row of expectation.public_asset_manifest) {
   let expected=fs.readFileSync(path.join(temp,'public',row.path));
   if(row.path==='_headers') {
    const text=expected.toString('utf8');if(!text.endsWith(MANIFEST_HEADERS))throw Error('HEADER_PROFILE');
    expected=Buffer.from(text.slice(0,-MANIFEST_HEADERS.length));
   }
   const data=fs.readFileSync(ordinary(path.join(publicRoot,row.path))),old=rows.find(x=>x.path===row.path);
   if(!data.equals(expected)||old.bytes!==data.length||old.sha256!==sha(data))throw Error('PREVIOUS_ARTIFACT_IDENTITY');
  }
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
 const prepared=prepareFinalStaging({source,output:path.join(candidate,'public'),receipt:path.join(candidate,'preparation-receipt.json'),
  sourcePin:contract.source_commit,project:contract.staging_project,publishableKey:config.supabasePublishableKey,contract});
 // Verify that every retained public byte except the intended header addition is identical.
 for(const name of [...contract.public_inputs.map(x=>x.path),'404.html']) {
  if(!fs.readFileSync(path.join(candidate,'public',name)).equals(fs.readFileSync(path.join(publicRoot,name))))throw Error('UNEXPECTED_PUBLIC_CHANGE');
 }
 return {stage_step:'FR.1.3_DELIVERY_CORRECTION',result:'CORRECTED_STATIC_CANDIDATE_PREPARED_NOT_DEPLOYED',source_commit:prepared.source_commit,
  project:prepared.project,selected_source_inputs_verified:39,public_files:40,retained_non_header_file_bytes_matched:39,
  manifest_content_type_rule_present:true,staging_configuration_reused_locally:true,key_ownership_independently_verified:false,
  configuration_key_body_or_hash_printed:false,previous_candidate_changed:false,deployed:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]};
}
if(process.argv[1]&&same(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))) {
 try {
  const args=process.argv.slice(2);if(args.length!==2)throw Error('INVALID_ARGUMENTS');
  console.log(JSON.stringify(prepareCorrection({previous:args[0],candidate:args[1]}),null,2));
 }catch{console.error(JSON.stringify({stage_step:'FR.1.3_DELIVERY_CORRECTION',result:'CORRECTION_PREPARATION_FAILED',details:'Retained candidate, exact source, config or new ordinary path validation failed; no upload performed. Do not share keys or raw exceptions.'}));process.exitCode=1;}
}
