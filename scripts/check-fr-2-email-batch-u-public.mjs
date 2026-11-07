// Read-only Batch U publication readback. No Auth/gateway/Management calls or input secrets.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {publicBrowser,reviewedStagingOrigin,stagingOrigin} from './check-fr-2-email-batch-o.mjs';
import {selectedHeaders,SW_SHA256} from './check-fr-2-email-batch-q.mjs';
import {parseStagingConfiguration} from './prepare-fr-2-email-edge-batch-a.mjs';
export const previousAcceptedOrigin='https://d24b6611.mushavo-budget-staging.pages.dev';
export const executionSourcePin='f4fe5d525c1d376974c101bcbdcee990afbc86fb';
export const reviewedArtifactSHA256='03542ed32e0ef32392f718f518248954a81f5317e94b77adf90c5c2b9457fd1a';
export const lifecycleSHA256=Object.freeze({'app.js':'05e08c2c7b62303ebb2f4b9b45a3fc7232e24ece61793df9e0a8551c4f7061bb','session-entry.js':'8ddf940ae5be0856ac85a20e3445995e535aac61e7d33c2379f89fb2e0125e58'});
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c);};
export function expectedLifecycle(){
 const root=new URL('../',import.meta.url),m=new Map();
 for(const [name,expected]of Object.entries(lifecycleSHA256)){
  const b=Buffer.from(fs.readFileSync(new URL(name,root)).toString().replaceAll('kttkospkblwvguuwnhjj','dczlddwbtgvfdujgcitb'));
  need(hash(b)===expected,'PINNED_LIFECYCLE_SOURCE_REQUIRED');m.set(name,b);
 }
 const sw=fs.readFileSync(new URL('sw.js',root));need(hash(sw)===SW_SHA256,'PINNED_LIFECYCLE_SOURCE_REQUIRED');m.set('sw.js',sw);return m;
}
export async function readPublicJavaScript(url,{transport=fetch,onAttempt=()=>{}}={}){
 const u=new URL(url);need([stagingOrigin,previousAcceptedOrigin].includes(u.origin)||/^https:\/\/[a-f0-9]{8}\.mushavo-budget-staging\.pages\.dev$/.test(u.origin),'PUBLIC_READ_TARGET_REQUIRED');
 need(!u.username&&!u.password&&!u.search&&!u.hash&&['/config.js','/app.js','/session-entry.js','/sw.js'].includes(u.pathname)&&u.href===url,'PUBLIC_READ_TARGET_REQUIRED');
 const row={path:u.pathname,http_status:null,JavaScript_MIME:false,selected_headers_match:false};onAttempt(row);
 const r=await transport(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/javascript'},signal:AbortSignal.timeout(15000)});row.http_status=r.status;
 if(r.status!==200||r.redirected){await r.body?.cancel();throw Error('PUBLIC_HTTP_RESPONSE_REQUIRED');}
 row.JavaScript_MIME=/^(?:application|text)\/javascript(?:\s*;|$)/i.test(r.headers.get('content-type')??'');row.selected_headers_match=Object.entries(selectedHeaders).every(([k,v])=>r.headers.get(k)===v);
 const reader=r.body?.getReader();need(reader,'PUBLIC_HTTP_RESPONSE_REQUIRED');const parts=[];let size=0;
 try{for(;;){const x=await reader.read();if(x.done)break;size+=x.value.length;need(size<=1048576,'PUBLIC_RESPONSE_TOO_LARGE');parts.push(x.value);}}
 finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
 need(row.JavaScript_MIME&&row.selected_headers_match,'PUBLIC_MIME_OR_HEADERS_REQUIRED');return {bytes:Buffer.concat(parts),row};
}
export async function publicLifecycleRelease(executable,deploymentURL,{transport=fetch,browser=publicBrowser,source=expectedLifecycle,runBrowser=true}={}){
 const r={stage_step:'FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE',progress_display:'Stage 3/10 | FR.2/8 | Batch U/Z — IN PROGRESS',batch:'U',result:'BATCH_U_PUBLIC_DEPLOYMENT_READBACK_REVIEW_REQUIRED',scope:'PUBLIC_TWO_FILE_LIFECYCLE_CONFIG_WORKER_TLS_AND_OFFLINE_READBACK_ONLY',execution_source_pin:executionSourcePin,owner_reviewed_ZIP_SHA256:reviewedArtifactSHA256,deployment_origin:null,canonical_origin:stagingOrigin,previous_configuration_origin:previousAcceptedOrigin,direct_public_GET_requests:0,maximum_direct_public_GET_requests:9,samples:[],public_browser_results:[],public_browser_requested:runBrowser===true,direct_scoped_checks:0,public_browser_checks:0,hosted_scoped_checks:0,both_origins_lifecycle_source_exact:false,both_origins_worker_exact:false,both_origins_public_configuration_preserved:false,entire_deployed_artifact_verified:false,deployed_gateway_source_or_binding_secret_metadata_verified:false,public_configuration_printed_or_saved:false,private_packets_or_credentials_accessed:false,real_email_requests:0,Auth_or_gateway_requests_permitted:false,database_state_read_or_changed:false,committed_mode_change_requests:0,upload_or_write_performed:false,total_browser_background_requests_independently_counted:false,worker_startup_fetches_not_intercepted:true,hosted_authenticated_full_app_acceptance:false,lettered_Batch_U_complete:false,hosted_acceptance:false,live_activation_approved:false,production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],checkpoint:'PUBLIC_INPUT',problem_code:null,exit_code:1};
 const read=async(origin,file,label)=>readPublicJavaScript(origin+'/'+file,{transport,onAttempt:row=>{need(r.direct_public_GET_requests<r.maximum_direct_public_GET_requests,'PUBLIC_REQUEST_BUDGET_REQUIRED');r.direct_public_GET_requests++;r.samples.push(Object.assign(row,{origin:label,byte_match:false}));}});
 try{
  need(typeof runBrowser==='boolean','PUBLIC_INPUT_REQUIRED');const origin=reviewedStagingOrigin(deploymentURL,{unique:true});need(origin!==previousAcceptedOrigin,'NEW_DEPLOYMENT_REQUIRED');r.deployment_origin=origin;const expected=await source();
  need(expected instanceof Map&&expected.size===3&&['app.js','session-entry.js','sw.js'].every(f=>Buffer.isBuffer(expected.get(f))),'PINNED_LIFECYCLE_SOURCE_REQUIRED');
  r.checkpoint='PREVIOUS_ACCEPTED_PUBLIC_CONFIGURATION';const old=await read(previousAcceptedOrigin,'config.js','PREVIOUS_ACCEPTED');const c=parseStagingConfiguration(old.bytes.toString('utf8'));need(c.vapidPublicKey!=='','PUBLIC_CONFIGURATION_REQUIRED');old.row.staging_configuration_shape=true;delete old.row.byte_match;r.direct_scoped_checks++;
  const wanted=new Map([...expected,['config.js',old.bytes]]);
  for(const [label,target]of [['DEPLOYMENT',origin],['CANONICAL',stagingOrigin]]){
   for(const [file,bytes]of wanted){r.checkpoint=label+'_PUBLIC_'+file.replaceAll('.','_').replaceAll('-','_').toUpperCase();const v=await read(target,file,label);v.row.byte_match=v.bytes.equals(bytes);need(v.row.byte_match,'PUBLIC_PINNED_BYTES_REQUIRED');r.direct_scoped_checks++;}
   if(runBrowser){r.checkpoint=label+'_PUBLIC_BROWSER';const b=await browser(executable,{reviewedDeploymentOrigin:target});r.public_browser_results.push({origin:label,...b});
   need(b.exit_code===0&&b.pass===10&&b.fail===0&&b.hosted_secure_transport_verified===true&&b.executed_worker_source_verified===true&&b.candidate_worker_exercised===true&&b.local_certificate_validation_bypassed===false&&b.browser_process_stopped===true&&b.temporary_profile_removed===true&&b.offline_navigation?.document_from_service_worker===true&&b.offline_navigation?.document_http_status===200&&b.offline_navigation?.navigation_error_present===false&&b.blocked_unreviewed_requests===0,'PUBLIC_BROWSER_READBACK_REQUIRED');r.public_browser_checks+=10;}
  }
  r.both_origins_lifecycle_source_exact=true;r.both_origins_worker_exact=true;r.both_origins_public_configuration_preserved=true;r.hosted_scoped_checks=r.direct_scoped_checks+r.public_browser_checks;r.result=runBrowser?'BATCH_U_TWO_ORIGIN_PUBLIC_LIFECYCLE_TLS_WORKER_OFFLINE_SCOPED_PASS':'BATCH_U_TWO_ORIGIN_DIRECT_PUBLIC_BYTES_HEADERS_SCOPED_PASS';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){const safe=new Set(['PUBLIC_INPUT_REQUIRED','REVIEWED_STAGING_ORIGIN_REQUIRED','NEW_DEPLOYMENT_REQUIRED','PINNED_LIFECYCLE_SOURCE_REQUIRED','PUBLIC_READ_TARGET_REQUIRED','PUBLIC_HTTP_RESPONSE_REQUIRED','PUBLIC_MIME_OR_HEADERS_REQUIRED','PUBLIC_RESPONSE_TOO_LARGE','PUBLIC_CONFIGURATION_REQUIRED','STAGING_CONFIG_REVIEW_REQUIRED','PUBLIC_PINNED_BYTES_REQUIRED','PUBLIC_REQUEST_BUDGET_REQUIRED','PUBLIC_BROWSER_READBACK_REQUIRED']);r.problem_code=safe.has(e?.message)?e.message:'PUBLIC_TRANSPORT_OR_SOURCE_REVIEW_REQUIRED';}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const valid=process.argv.length===4||(process.argv.length===5&&process.argv[4]==='--bytes-only');const r=await publicLifecycleRelease(valid?process.argv[2]:null,valid?process.argv[3]:null,{runBrowser:process.argv.length!==5});console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code;
}
