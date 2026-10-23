// Repack only the tested public service worker into the exact retained Batch B staging ZIP.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyFrontendZIP,frontendZIP} from './check-fr-2-email-batch-g.mjs';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
export const stage='FR.2.4.E5.29_BATCH_P_PAGES_REDIRECT_SAFE_OFFLINE_CANDIDATE_AND_RETAINED_ZIP';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
function ordinary(file,directory=false){if(typeof file!=='string'||!path.isAbsolute(file))throw Error('PUBLIC_PATH_REQUIRED');for(let p=file;;){const s=fs.lstatSync(p);if(s.isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(p);if(parent===p)break;p=parent;}if(directory?!fs.statSync(file).isDirectory():!fs.statSync(file).isFile())throw Error('PUBLIC_PATH_REQUIRED');return file;}
export function replacePublicWorker(entries,oldSource,candidate){
 if(!(entries instanceof Map)||entries.size!==44||!Buffer.isBuffer(oldSource)||!Buffer.isBuffer(candidate)||!entries.get('sw.js')?.equals(oldSource)||candidate.equals(oldSource))throw Error('PUBLIC_SW_IDENTITY_REQUIRED');
 const next=new Map(entries);next.set('sw.js',candidate);let unchanged=0;for(const [name,bytes]of entries){if(name!=='sw.js'){if(!bytes.equals(next.get(name)))throw Error('UNRELATED_CHANGE_REFUSED');unchanged++;}}
 if(unchanged!==43)throw Error('PUBLIC_SW_IDENTITY_REQUIRED');return next;
}
export function prepareOfflineZIP(retainedZIP,outputDirectory){
 ordinary(retainedZIP);ordinary(outputDirectory,true);if(fs.readdirSync(outputDirectory).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 verifyFrontendZIP(retainedZIP);const prior=fs.readFileSync(retainedZIP),oldSource=fs.readFileSync(path.join(root,'sw.js')),candidate=fs.readFileSync(path.join(root,'deployment/candidates/email-offline-pages-v89.sw.js'));
 const next=replacePublicWorker(readCanonicalPublicZIP(prior),oldSource,candidate);const bytes=createPublicZIP([...next]),readback=readCanonicalPublicZIP(bytes);
 for(const [name,value]of next)if(!value.equals(readback.get(name)))throw Error('CANDIDATE_ZIP_READBACK_REQUIRED');
 if(hash(fs.readFileSync(retainedZIP))!==frontendZIP)throw Error('RETAINED_ZIP_CHANGED');
 const filename=path.join(outputDirectory,'mushavo-pages-offline-review.zip');
 fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes)||hash(fs.readFileSync(retainedZIP))!==frontendZIP)throw Error('CANDIDATE_ZIP_READBACK_REQUIRED');
 return {stage_step:stage,batch:'P',result:'BATCH_P_LOCAL_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED',target_Pages_project:'mushavo-budget-staging',target_origin:'https://mushavo-budget-staging.pages.dev',target_Supabase_project:'dczlddwbtgvfdujgcitb',public_files:44,unchanged_public_entries:43,only_sw_js_changed:true,retained_ZIP_SHA256_verified:frontendZIP,retained_ZIP_unchanged:true,staging_configuration_and_public_push_key_byte_preserved:true,Cloudflare_gateway_worker_and_headers_byte_preserved:true,candidate_SW_SHA256:hash(candidate),candidate_cache_version:'pwa-shell-v89',ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,do_not_upload_yet:true,actual_hosted_requests:0,private_packets_or_credentials_accessed:false,keys_or_credentials_regenerated:false,email_requests:0,committed_mode_change_requests:0,hosted_acceptance:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
