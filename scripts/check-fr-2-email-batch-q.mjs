// Read the exact owner-reviewed public ZIP and independently check its staging publication.
// Deployment itself is one separate owner dashboard action. No credentials or private endpoints.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {verifyFrontendZIP} from './check-fr-2-email-batch-g.mjs';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {publicBrowser,reviewedStagingOrigin,stagingOrigin} from './check-fr-2-email-batch-o.mjs';
export const stage='FR.2.4.E5.30_BATCH_Q_REVIEWED_STAGING_SW_UPLOAD_AND_PUBLIC_BROWSER_READBACK';
export const ZIP_SHA256='5bbbea1dfaca36a05c513b087012657c0dfd7380901dcf2f47dc2eac45309fe0';
export const SW_SHA256='0bc471318eb7156aed4f004c153a3e45fd08a71f665ad77ba59caa29fd8d8c47';
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c);};
export function reviewedZIP(filename){
 verifyFrontendZIP(filename,{expectedZIP:ZIP_SHA256});
 const bytes=fs.readFileSync(filename);need(hash(bytes)===ZIP_SHA256,'REVIEWED_ZIP_REQUIRED');
 const entries=readCanonicalPublicZIP(bytes);need(entries.size===44&&hash(entries.get('sw.js'))===SW_SHA256,'REVIEWED_ZIP_REQUIRED');
 return entries;
}
export const selectedHeaders=Object.freeze({'strict-transport-security':'max-age=86400','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'strict-origin-when-cross-origin'});
export async function publicBytes(origin,entries,{transport=fetch,onAttempt=()=>{}}={}){
 origin=reviewedStagingOrigin(origin);const rows=[];
 for(const [file,label]of [['sw.js','PUBLIC_SERVICE_WORKER'],['config.js','PUBLIC_STAGING_CONFIGURATION']]){
  const row={endpoint:label,http_status:null,byte_match:false,JavaScript_MIME:false,selected_headers_match:false};rows.push(row);onAttempt(row);
  const response=await transport(origin+'/'+file,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/javascript'},signal:AbortSignal.timeout(15000)});
  row.http_status=response.status;
  if(response.status!==200||response.redirected){await response.body?.cancel();throw Error('PUBLIC_HTTP_RESPONSE_REQUIRED');}
  row.JavaScript_MIME=/^(?:application|text)\/javascript(?:\s*;|$)/i.test(response.headers.get('content-type')??'');
  row.selected_headers_match=Object.entries(selectedHeaders).every(([k,v])=>response.headers.get(k)===v);
  const reader=response.body?.getReader();need(reader,'PUBLIC_HTTP_RESPONSE_REQUIRED');let n=0;const parts=[];
  try{for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;need(n<=1048576,'PUBLIC_RESPONSE_TOO_LARGE');parts.push(x.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  row.byte_match=Buffer.concat(parts).equals(entries.get(file));
  need(row.byte_match&&row.JavaScript_MIME&&row.selected_headers_match,'PUBLIC_BYTES_MIME_OR_HEADERS_REQUIRED');
 }
 return rows;
}
export async function stagingRelease(executable,zip,deploymentURL,{artifactCheck=reviewedZIP,transport=fetch,browser=publicBrowser}={}){
 const r={stage_step:stage,batch:'Q',result:'BATCH_Q_PUBLIC_READBACK_REVIEW_REQUIRED',ZIP_SHA256,SW_SHA256,cache_version:'pwa-shell-v89',
  reviewed_ZIP_verified:false,deployment_origin:null,canonical_origin:stagingOrigin,direct_public_GET_requests:0,maximum_direct_public_GET_requests:4,
  samples:[],public_browser_results:[],public_byte_checks:0,public_browser_checks:0,hosted_scoped_checks:0,
  upload_action_automated:false,reviewed_public_release_observed_on_both_origins:false,Pages_binding_or_secret_metadata_rechecked:false,
  total_browser_hosted_requests_independently_counted:false,maximum_intercepted_requests_per_browser:128,
  private_packets_or_credentials_accessed:false,email_requests:0,committed_mode_change_requests:0,database_state_read_or_changed:false,
  hosted_authenticated_browser_acceptance:false,installed_PWA_OS_lifecycle_verified:false,hosted_acceptance:false,live_activation_approved:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'REVIEWED_ZIP_AND_STAGING_URL',problem_code:null,exit_code:1};
 try{
  const origin=reviewedStagingOrigin(deploymentURL,{unique:true});r.deployment_origin=origin;
  const entries=await artifactCheck(zip);r.reviewed_ZIP_verified=true;
  for(const [label,target]of [['DEPLOYMENT',origin],['CANONICAL',stagingOrigin]]){
   r.checkpoint=label+'_PUBLIC_BYTES';const rows=await publicBytes(target,entries,{transport,onAttempt:row=>{r.direct_public_GET_requests++;row.origin=label;r.samples.push(row);}});
   // Keep only fixed labels, statuses and booleans; never emit the configuration body or key.
   r.public_byte_checks+=rows.length;
   r.checkpoint=label+'_PUBLIC_BROWSER';const b=await browser(executable,{reviewedDeploymentOrigin:target});r.public_browser_results.push({origin:label,...b});
   need(b.exit_code===0&&b.pass===10&&b.fail===0&&b.hosted_secure_transport_verified===true&&b.executed_worker_source_verified===true&&b.candidate_worker_exercised===true&&b.local_certificate_validation_bypassed===false&&b.browser_process_stopped===true&&b.temporary_profile_removed===true&&b.offline_navigation?.document_from_service_worker===true&&b.offline_navigation?.document_http_status===200&&b.offline_navigation?.navigation_error_present===false&&b.blocked_unreviewed_requests===0,'PUBLIC_BROWSER_READBACK_REQUIRED');
   r.public_browser_checks+=b.pass;
  }
  r.hosted_scoped_checks=r.public_byte_checks+r.public_browser_checks;r.reviewed_public_release_observed_on_both_origins=true;
  r.result='BATCH_Q_REVIEWED_STAGING_SW_AND_TWO_ORIGIN_PUBLIC_BROWSER_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){const codes=new Set(['REVIEWED_STAGING_ORIGIN_REQUIRED','REVIEWED_ZIP_REQUIRED','PUBLIC_HTTP_RESPONSE_REQUIRED','PUBLIC_RESPONSE_TOO_LARGE','PUBLIC_BYTES_MIME_OR_HEADERS_REQUIRED','PUBLIC_BROWSER_READBACK_REQUIRED']);r.problem_code=codes.has(e?.message)?e.message:'PUBLIC_ARTIFACT_OR_TRANSPORT_REVIEW_REQUIRED';}
 r.checked_UTC=new Date().toISOString();return r;
}
