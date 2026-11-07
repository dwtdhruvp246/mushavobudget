// New local candidate only. Reads the old public ZIP, never the private credential packet.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {prepareFinalStaging} from './prepare-final-staging.mjs';
import {buildEmailWorkers} from './lib/build-fr-2-email-workers.mjs';
import {createPublicZIP,writePublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.4.E5.5_MODERN_REPLACEMENT_ZIP';
export const priorZIP='33bee04f34bf564330345ef7c041ca5b52e0222fbab7dd4cbcae1a789f5c6ef1';
export const priorWorker='fb089fffe0cabd9be4fb5e8cfed165786ef56dee8cd5209b7be679166ef4ae99';
export const modernWorker='a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651';
const hash=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
const inside=(root,file)=>{const r=path.relative(root,file);return !r||(!path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep));};
function ordinary(value,directory=false){const p=path.resolve(value),s=fs.lstatSync(p);if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||!same(fs.realpathSync(p),p))throw Error('ORDINARY_PATH_REQUIRED');return p;}
export function verifyModernPackageSources(source){
  source=ordinary(source,true);
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'docs/security-audit/security-fr-2-email-modern-package-source-manifest.json')));
  const rows=Object.entries(manifest.file_sha256||{});
  if(manifest.stage_step!==stage||rows.length!==manifest.source_file_count||rows.length<50)throw Error('PACKAGE_MANIFEST_REQUIRED');
  for(const [name,digest]of rows){
    if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||path.isAbsolute(name)||!/^[a-f0-9]{64}$/.test(digest))throw Error('SOURCE_PATH_REQUIRED');
    const file=ordinary(path.join(source,name));if(!inside(source,file)||fs.statSync(file).size>2097152||hash(fs.readFileSync(file))!==digest)throw Error('SOURCE_IDENTITY_REQUIRED');
  }
  return manifest;
}
// Accept only the deterministic, uncompressed ZIP format written by our existing public ZIP writer.
export function readCanonicalPublicZIP(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<22||bytes.length>8388608)throw Error('ZIP_FORMAT_REQUIRED');
  const end=bytes.length-22;if(bytes.readUInt32LE(end)!==0x06054b50)throw Error('ZIP_FORMAT_REQUIRED');
  const count=bytes.readUInt16LE(end+10);if(count!==44)throw Error('ZIP_COUNT_REQUIRED');
  const entries=[];let offset=0;
  for(let i=0;i<count;i++){
    if(offset+30>end||bytes.readUInt32LE(offset)!==0x04034b50||bytes.readUInt16LE(offset+6)!==0||bytes.readUInt16LE(offset+8)!==0)throw Error('ZIP_FORMAT_REQUIRED');
    const size=bytes.readUInt32LE(offset+18),original=bytes.readUInt32LE(offset+22),length=bytes.readUInt16LE(offset+26),extra=bytes.readUInt16LE(offset+28);
    if(size!==original||size<1||size>2097152||extra!==0||length<1||length>256||offset+30+length+size>end)throw Error('ZIP_FORMAT_REQUIRED');
    const filename=bytes.subarray(offset+30,offset+30+length);if(filename.some(x=>x>127))throw Error('ZIP_FORMAT_REQUIRED');
    entries.push([filename.toString('ascii'),bytes.subarray(offset+30+length,offset+30+length+size)]);offset+=30+length+size;
  }
  if(!createPublicZIP(entries).equals(bytes))throw Error('ZIP_CANONICAL_IDENTITY_REQUIRED');
  return new Map(entries);
}
export function configurationFromZIP(entries){
  const b=entries.get('config.js');if(!b||b.length>16384)throw Error('STAGING_CONFIG_REQUIRED');
  const match=b.toString('utf8').replace(/^\uFEFF/,'').match(/^\s*window\.MUSHAVO_BUDGET_CONFIG\s*=\s*(\{[\s\S]*\})\s*;\s*$/);
  if(!match)throw Error('STAGING_CONFIG_REQUIRED');
  let c;try{c=JSON.parse(match[1]);}catch{throw Error('STAGING_CONFIG_REQUIRED');}
  if(!c||Array.isArray(c)||Object.keys(c).sort().join(',')!=='supabasePublishableKey,supabaseUrl,vapidPublicKey'||c.supabaseUrl!=='https://dczlddwbtgvfdujgcitb.supabase.co'||c.vapidPublicKey!==''||typeof c.supabasePublishableKey!=='string'||!/^sb_publishable_[A-Za-z0-9_-]{1,512}$/.test(c.supabasePublishableKey))throw Error('STAGING_CONFIG_REQUIRED');
  return c;
}
export function compareReplacementEntries(current,previous){
  if(current.size!==44||previous.size!==44)throw Error('PUBLIC_SET_REQUIRED');
  let unchanged=0;for(const [name,b]of current){const old=previous.get(name);if(!old)throw Error('PUBLIC_SET_REQUIRED');
    if(name==='_worker.js'){if(hash(b)!==modernWorker||hash(old)!==priorWorker)throw Error('WORKER_IDENTITY_REQUIRED');}
    else{if(!b.equals(old))throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');unchanged++;}
  }
  if(unchanged!==43)throw Error('PUBLIC_SET_REQUIRED');return unchanged;
}
export async function buildModernPublicCandidate({source,candidate,toolsRoot,configuration}){
  source=ordinary(source,true);candidate=ordinary(candidate,true);toolsRoot=ordinary(toolsRoot,true);
  if(inside(source,candidate)||inside(candidate,source)||fs.readdirSync(candidate).length)throw Error('NEW_EMPTY_CANDIDATE_REQUIRED');
  const manifest=verifyModernPackageSources(source);
  // Validate config with the same non-executing ZIP reader contract used by the production CLI.
  const config=configurationFromZIP(new Map([['config.js',Buffer.from(configuration)]]));
  for(const name of ['package.json','package-lock.json'])if(!fs.readFileSync(ordinary(path.join(toolsRoot,name))).equals(fs.readFileSync(path.join(source,'scripts/fixtures/email-worker-tools',name))))throw Error('PINNED_TOOLS_REQUIRED');
  const require=createRequire(path.join(toolsRoot,'package.json')),esbuild=require('esbuild');
  if(esbuild.version!=='0.28.2')throw Error('PINNED_TOOLS_REQUIRED');
  const bundles=await buildEmailWorkers(esbuild,source),worker=Buffer.from(bundles.pages);
  if(hash(worker)!==modernWorker||hash(Buffer.from(bundles.limiter))!=='4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1')throw Error('WORKER_IDENTITY_REQUIRED');
  const contract=JSON.parse(fs.readFileSync(path.join(source,'docs/security-audit/security-fr-2-email-staging-package-contract.json')));
  const output=path.join(candidate,'public');
  const component=prepareFinalStaging({source,output,receipt:path.join(candidate,'static-component-receipt.json'),sourcePin:contract.application_source_commit,project:'dczlddwbtgvfdujgcitb',publishableKey:config.supabasePublishableKey,contract:contract.static_preparation_contract});
  fs.writeFileSync(path.join(output,'_worker.js'),worker,{flag:'wx'});fs.writeFileSync(path.join(output,'_routes.json'),JSON.stringify(contract.routes)+'\n',{flag:'wx'});
  const names=[...contract.static_preparation_contract.public_inputs.map(x=>x.path),'404.html','_headers','_worker.js','_routes.json'].sort();
  if(names.length!==44||new Set(names).size!==44)throw Error('PUBLIC_SET_REQUIRED');
  const entries=new Map(names.map(name=>[name,fs.readFileSync(ordinary(path.join(output,name)))]));
  for(const b of entries.values())if(b.includes(Buffer.from('kttkospkblwvguuwnhjj')))throw Error('PRODUCTION_REFERENCE_REFUSED');
  return {entries,manifest,component};
}
export async function prepareModernReplacementZIP({source,candidate,toolsRoot,retainedZIP}){
  // Before output writes: exact old artifact, archive structure and staging-only config.
  const retained=ordinary(retainedZIP);if(fs.statSync(retained).size>8388608)throw Error('RETAINED_ZIP_IDENTITY_REQUIRED');
  const original=fs.readFileSync(retained);if(hash(original)!==priorZIP)throw Error('RETAINED_ZIP_IDENTITY_REQUIRED');
  const previous=readCanonicalPublicZIP(original);configurationFromZIP(previous);
  const built=await buildModernPublicCandidate({source,candidate,toolsRoot,configuration:previous.get('config.js').toString('utf8')});
  const unchanged=compareReplacementEntries(built.entries,previous);
  const assets=[...built.entries].filter(([name])=>name!=='config.js').map(([name,b])=>({path:name,bytes:b.length,sha256:hash(b)}));
  fs.writeFileSync(path.join(candidate,'public-asset-manifest.json'),JSON.stringify(assets,null,2)+'\n',{flag:'wx'});
  const zip=path.join(candidate,'mushavo-email-modern-review.zip'),bytes=writePublicZIP(zip,[...built.entries]);
  const readback=readCanonicalPublicZIP(fs.readFileSync(zip));for(const [name,b]of built.entries)if(!b.equals(readback.get(name)))throw Error('ZIP_READBACK_REQUIRED');
  if(hash(fs.readFileSync(retainedZIP))!==priorZIP)throw Error('RETAINED_ZIP_CHANGED');
  const receipt={stage_step:stage,result:'LOCAL_MODERN_REPLACEMENT_ZIP_PREPARED_NOT_DEPLOYED',node_version:process.version,
    source_parent_commit:built.manifest.source_parent_commit,source_files_SHA256_verified:built.manifest.source_file_count,
    selected_public_and_header_source_identities_verified:built.component.selected_source_inputs_verified,
    target_project:'mushavo-budget-staging',target_domain:'mushavo-budget-staging.pages.dev',supabase_project:'dczlddwbtgvfdujgcitb',
    public_files:44,non_config_asset_hashes_recorded:43,prior_ZIP_identity_verified:true,prior_ZIP_compared_unchanged:true,
    public_files_except_Worker_byte_identical_to_prior_ZIP:unchanged,only_Worker_changed:true,Worker_SHA256:modernWorker,
    modern_service_key_transport_bundle_verified:true,configuration_key_body_or_hash_printed:false,push_key_disabled:true,
    headers_and_local_dependencies_verified:true,all_routes_forward_to_reviewed_Worker:true,
    ZIP_path:zip,ZIP_SHA256:hash(bytes),portable_44_entry_ZIP_readback_verified:true,Windows_dotNET_ZIP_independent_readback_verified:false,
    private_DPAPI_or_Zoho_files_accessed:false,credentials_requested:false,actual_hosted_requests:0,email_dispatched:false,
    bindings_secrets_SQL_Auth_or_settings_changed:false,deployed:false,do_not_upload_yet:true,live_activation_approved:false,
    hosted_acceptance:false,findings_closed:[],production_or_native_changed:false,APK_update_deferred:true,exit_code:0};
  fs.writeFileSync(path.join(candidate,'preparation-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&same(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))){
  try{if(process.argv.length!==6)throw Error('ARGUMENT_COUNT_REQUIRED');
    console.log(JSON.stringify(await prepareModernReplacementZIP({source:process.argv[2],candidate:process.argv[3],toolsRoot:process.argv[4],retainedZIP:process.argv[5]}),null,2));
  }catch{console.log(JSON.stringify({stage_step:stage,result:'LOCAL_MODERN_ZIP_REVIEW_REQUIRED',problem_code:'SOURCE_TOOLS_RETAINED_ARCHIVE_OR_PACKAGE_REVIEW_REQUIRED',raw_exceptions_configuration_or_keys_printed:false,actual_hosted_requests:0,deployed:false,hosted_acceptance:false,exit_code:1},null,2));process.exitCode=1;}
}
