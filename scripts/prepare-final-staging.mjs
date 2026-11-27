// FR.1.1: prepare a static staging candidate only. No transport or deployment.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAGING = 'dczlddwbtgvfdujgcitb';
const PRODUCTION = 'kttkospkblwvguuwnhjj';
const REQUIRED_AUTH = ['auth.html','auth-flows.js','auth-security.js','admin-mfa.js'];
const NOT_FOUND = '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Mushavo Budget</title></head><body><main><h1>Page not found</h1><p>The page you requested could not be found.</p><p><a href="/">Return to Mushavo Budget</a></p></main></body></html>\n';
export const MANIFEST_HEADERS = '\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n';
const hash = data => createHash('sha256').update(data).digest('hex');
const samePath = (a,b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
function ordinaryDirectory(input) {
  const full = path.resolve(input);
  if (!fs.lstatSync(full).isDirectory() || !samePath(fs.realpathSync(full),full)) throw Error('Use an ordinary directory without redirected parents.');
  return full;
}
function contained(root,full) {
  const rel = path.relative(root,full);
  return rel === '' || (!path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..'+path.sep));
}
function validateContract(contract) {
  if (contract.schema_version !== 1 || !/^[a-f0-9]{40}$/.test(contract.source_commit || '') ||
      contract.staging_project !== STAGING || contract.production_project !== PRODUCTION ||
      contract.candidate_serving_profile !== 'CLOUDFLARE_PAGES_STATIC_ONLY_NOT_TARGET_CONFIRMATION' ||
      !Array.isArray(contract.public_inputs) || contract.public_inputs.length > 128 ||
      contract.header_generator?.path !== 'scripts/prepare-stage-2-headers.cjs') throw Error('Unexpected reviewed source contract.');
  const seen = new Set();
  for (const row of [...contract.public_inputs,contract.header_generator]) {
    if (!/^(?:[A-Za-z0-9_-]+\.(?:html|js|css|webmanifest)|assets\/[A-Za-z0-9_.-]+|scripts\/prepare-stage-2-headers\.cjs)$/.test(row.path || '') ||
        !/^[a-f0-9]{64}$/.test(row.sha256 || '') || !/^[a-f0-9]{40}$/.test(row.git_blob_sha || '') ||
        !Number.isInteger(row.bytes) || row.bytes < 1 || row.bytes > 2*1024*1024 || seen.has(row.path)) throw Error('Invalid selected source identity.');
    seen.add(row.path);
  }
  if (!REQUIRED_AUTH.every(name=>seen.has(name)) || !['index.html','app.html','business.html','config.js','sw.js','manifest.webmanifest'].every(name=>seen.has(name))) throw Error('Missing required public candidate identities.');
}
function readInput(root,row) {
  const full = path.join(root,row.path);
  const stat = fs.lstatSync(full);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== row.bytes || !samePath(fs.realpathSync(full),full)) throw Error('Missing, changed or redirected selected source: '+row.path);
  const data = fs.readFileSync(full);
  const gitHash = createHash('sha1').update(Buffer.from('blob '+data.length+'\0')).update(data).digest('hex');
  if (hash(data)!==row.sha256 || gitHash!==row.git_blob_sha) throw Error('Selected source identity mismatch: '+row.path);
  return data;
}
function requirePublicReference(files,owner,reference) {
  if (/^(?:https?:|data:|blob:|\/\/|#)/i.test(reference)) return;
  const target = path.posix.normalize(path.posix.join(reference.startsWith('/')?'':path.posix.dirname(owner),reference.split(/[?#]/)[0])).replace(/^\//,'');
  if (!files.has(target)) throw Error('Missing local asset dependency: '+target);
}
export function verifyDependencies(files) {
  for (const [name,data] of files) {
    const text = data.toString('utf8');
    if (name.endsWith('.js')) {
      if (/^\s*(?:<!doctype\b|<html\b)/i.test(text)) throw Error('HTML at a selected JavaScript asset: '+name);
      for (const m of text.matchAll(/\b(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
        if (m[1].startsWith('.') || m[1].startsWith('/')) requirePublicReference(files,name,m[1]);
      }
    } else if (name.endsWith('.html')) {
      for (const m of text.matchAll(/<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) requirePublicReference(files,name,m[1]);
      for (const m of text.matchAll(/<link\b[^>]*>/gi)) {
        if (/\brel\s*=\s*["']stylesheet["']/i.test(m[0])) {
          const href = m[0].match(/\bhref\s*=\s*["']([^"']+)["']/i);
          if (href) requirePublicReference(files,name,href[1]);
        }
      }
    }
  }
}
export function prepareFinalStaging({source,output,receipt,sourcePin,project,publishableKey,contract}) {
  validateContract(contract);
  if (project !== STAGING || sourcePin !== contract.source_commit) throw Error('Confirm the exact reviewed staging source and project.');
  const key = String(publishableKey || '').trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw Error('Use only the staging publishable key, never a secret or service-role key.');
  if (!source || !output || !receipt) throw Error('Provide source, new output and sidecar receipt paths.');
  source = ordinaryDirectory(source);
  output = path.resolve(output);receipt = path.resolve(receipt);
  ordinaryDirectory(path.dirname(output));ordinaryDirectory(path.dirname(receipt));
  if (contained(source,output) || contained(source,receipt) || contained(output,receipt) || samePath(output,receipt)) throw Error('Output and receipt must be outside source; receipt must be outside public output.');
  for (const target of [output,receipt]) {
    try {fs.lstatSync(target);throw Error('Output and receipt must be new and nonexistent.');} catch(error) {if(error.code!=='ENOENT') throw error;}
  }
  const sourceFiles = new Map(contract.public_inputs.map(row=>[row.path,readInput(source,row)]));
  readInput(source,contract.header_generator);
  if (sourceFiles.get('config.js').includes(Buffer.from(key))) throw Error('The supplied key matches the source/production configuration.');
  const files = new Map();
  for (const [name,original] of sourceFiles) {
    let data = original;
    if (name === 'config.js') data = Buffer.from('window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://'+STAGING+'.supabase.co',supabasePublishableKey:key,vapidPublicKey:''},null,2)+';\n');
    else if (/\.(html|js|css|webmanifest)$/.test(name)) data = Buffer.from(data.toString('utf8').split(PRODUCTION).join(STAGING));
    if (data.includes(Buffer.from(PRODUCTION))) throw Error('Production reference remains in selected public asset: '+name);
    files.set(name,data);
  }
  files.set('404.html',Buffer.from(NOT_FOUND));
  verifyDependencies(files);
  const require = createRequire(import.meta.url);
  const {buildHeaders} = require(path.join(source,contract.header_generator.path));
  const finalHTML = [...files].filter(([name])=>name.endsWith('.html')).map(([,data])=>data.toString('utf8'));
  files.set('_headers',Buffer.from(buildHeaders(STAGING,finalHTML)+MANIFEST_HEADERS));
  if (files.get('_headers').includes(Buffer.from(PRODUCTION))) throw Error('Production reference remains in generated headers.');
  // All input, dependency and output-path checks precede creation.
  fs.mkdirSync(output);
  for (const [name,data] of files) {
    const target = path.join(output,name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,data,{flag:'wx'});
    if (hash(fs.readFileSync(target))!==hash(data)) throw Error('Written candidate identity mismatch.');
  }
  const safeReceipt = {
    stage_step:'FR.1.1',result:'ISOLATED_STAGING_STATIC_CANDIDATE_PREPARED_NOT_DEPLOYED',source_commit:sourcePin,project:STAGING,
    selected_source_inputs_verified:contract.public_inputs.length+1,public_files:files.size,required_Auth_MFA_assets_present:true,
    local_script_and_stylesheet_dependencies_present:true,production_reference_scan_passed:true,push_key_disabled:true,
    pages_static_404_candidate_present:true,headers_regenerated_from_final_HTML:true,
    publishable_key_ownership_independently_verified:false,actual_serving_product_project_branch_or_deployed_source_confirmed:false,
    public_asset_manifest:[...files].filter(([name])=>name!=='config.js').map(([name,data])=>({path:name,bytes:data.length,sha256:hash(data)})),
    configuration_artifact_hash_omitted:true,receipt_outside_public_output:true,
    actual_public_HTTP_Auth_API_SQL_jobs_provider_device_or_store_checks_run:0,deployed:false,hosted_acceptance:false,
    notification_email_or_charge_dispatched:false,source_or_existing_output_changed:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[]
  };
  fs.writeFileSync(receipt,JSON.stringify(safeReceipt,null,2)+'\n',{flag:'wx'});
  return safeReceipt;
}
if (process.argv[1] && samePath(path.resolve(process.argv[1]),fileURLToPath(import.meta.url))) {
  try {
    const args=process.argv.slice(2);
    if (args.length!==4) throw Error('Provide source folder, new output folder, new receipt path and reviewed source pin.');
    const contract=JSON.parse(fs.readFileSync(path.join(scriptRoot,'docs/security-audit/security-final-staging-source-contract.json'),'utf8'));
    console.log(JSON.stringify(prepareFinalStaging({source:args[0],output:args[1],receipt:args[2],sourcePin:args[3],project:process.env.MUSHAVO_STAGING_PROJECT_CONFIRMED,publishableKey:process.env.MUSHAVO_STAGING_PUBLISHABLE_KEY,contract}),null,2));
  } catch {console.error(JSON.stringify({stage_step:'FR.1.1',result:'PREPARATION_FAILED_NO_DEPLOYMENT',details:'Check exact source inputs, staging confirmation, publishable-key format and new ordinary output paths. Do not share keys or raw exceptions.'}));process.exitCode=1;}
}
