// One staging-only quarantined installation. No resume or delivery path.
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {reviewRegistration} from './review-fr-2-email-batch-f.mjs';
import {contextSQL,privateCatalogSQL,stagingRef} from './lib/email-registration-handoff-sql.mjs';
import {versionReference} from './lib/email-registration-catalog-versions.mjs';
export const stage='FR.2.4.E5.21_BATCH_H_QUARANTINED_STAGING_DATABASE_INSTALLATION';
export const acknowledgement='INSTALL_STAGING_EMAIL_QUARANTINED_ONLY';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const exact=(x,keys)=>object(x)&&isDeepStrictEqual(Object.keys(x).sort(),keys.slice().sort());
const need=(x,code)=>{if(!x)throw Object.assign(Error(code),{safeCode:code});};
const codes=new Set(['PRIVATE_INPUT_REQUIRED','LOCAL_SOURCE_REVIEW_REQUIRED','FRESH_DORMANT_REVIEW_REQUIRED','HTTP_RESPONSE_REVIEW_REQUIRED','BOUNDED_JSON_RESPONSE_REQUIRED','INSTALLATION_RECEIPT_REVIEW_REQUIRED','QUARANTINED_READBACK_REVIEW_REQUIRED','TARGET_METADATA_REVIEW_REQUIRED','NETWORK_OR_RESPONSE_REVIEW_REQUIRED']);
const safe=e=>codes.has(e?.safeCode)?e.safeCode:'NETWORK_OR_RESPONSE_REVIEW_REQUIRED';
export async function installationSQL(){
 const base=JSON.parse(await readFile(new URL('../docs/security-audit/security-fr-2-email-batch-f-private-catalog.json',import.meta.url),'utf8'));
 const quote=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
 const refs=Object.fromEntries([15,16,17,18].map(n=>[String(n),versionReference(base,n*10000)]));
 // Before calling any private control function, compare its entire reviewed source/ACL catalog in this transaction.
 const write=`BEGIN;
SET LOCAL statement_timeout='45s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SET LOCAL mushavo.email_rollout_project='${stagingRef}';
SET LOCAL mushavo.email_rollout_action='ACTIVATE_STAGING_EMAIL_QUARANTINED';
DO $guard$ DECLARE expected jsonb; BEGIN
 IF NOT ((${contextSQL})->>'privileged_origin')::boolean OR current_setting('transaction_read_only')<>'off'
 THEN RAISE EXCEPTION 'EMAIL_H_PRIVILEGED_ORIGIN_REQUIRED'; END IF;
 expected := ${quote(refs)} -> (current_setting('server_version_num')::integer/10000)::text;
 IF expected IS NULL OR (${privateCatalogSQL}) IS DISTINCT FROM expected
 THEN RAISE EXCEPTION 'EMAIL_H_PINNED_DORMANT_CATALOG_REQUIRED'; END IF;
 PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}'
 AND mode='REGISTERED' AND catalog_sha256 IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'EMAIL_H_REGISTERED_STATE_REQUIRED'; END IF;
END $guard$;
SELECT mushavo_email_install.activate() AS quarantined_installation;
COMMIT;
`;
 // The selected private installer projection excludes the newly installed backend schema.
 const installerCatalog=privateCatalogSQL.replace("n.nspname IN ('mushavo_email_install','mushavo_email_auth')","n.nspname='mushavo_email_install'");
 const readback=`BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='25s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
SELECT jsonb_build_object('context',${contextSQL},'server_version_num',current_setting('server_version_num')::integer,
 'installer_catalog',${installerCatalog},
 'control',(SELECT jsonb_build_object('rows',count(*),'quarantined',coalesce(bool_and(singleton AND target_project='${stagingRef}'
 AND mode='QUARANTINED' AND catalog_sha256 ~ '^[a-f0-9]{64}$' AND catalog_sha256=mushavo_email_install.catalog_identity()),false))
 FROM mushavo_email_install.rollout_control),
 'guarded_RPCs',(SELECT count(*)::integer FROM pg_proc WHERE pronamespace='public'::regnamespace
 AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0),
 'restrictive_policies',(SELECT count(*)::integer FROM pg_policies WHERE schemaname IN ('public','storage') AND policyname='Email verified session required' AND permissive='RESTRICTIVE'),
 'public_guard_policies',(SELECT count(*)::integer FROM pg_policies WHERE schemaname='public' AND policyname='Email verified session required' AND permissive='RESTRICTIVE'),
 'storage_guard_policies',(SELECT count(*)::integer FROM pg_policies WHERE schemaname='storage' AND policyname='Email verified session required' AND permissive='RESTRICTIVE'),
 'backend_tables',(SELECT count(*)::integer FROM pg_class WHERE relnamespace=to_regnamespace('mushavo_email_auth') AND relkind='r'),
 'backend_tables_forced_RLS',(SELECT count(*)::integer FROM pg_class WHERE relnamespace=to_regnamespace('mushavo_email_auth') AND relkind='r' AND relrowsecurity AND relforcerowsecurity),
 'backend_schema_API_denied',NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
 WHERE n.nspname='mushavo_email_auth' AND (has_schema_privilege(r,n.oid,'USAGE') OR has_schema_privilege(r,n.oid,'CREATE')))
 ) AS quarantined_readback;
ROLLBACK;
`;
 return {write,readback,base};
}
export async function installQuarantined(input,{transport=fetch}={}){
 const r={stage_step:stage,batch:'H',result:'BATCH_H_QUARANTINED_INSTALLATION_REVIEW_REQUIRED',actual_hosted_requests:0,
  fresh_dormant_review_passed:false,precheck_problem_code:null,activation_POST_requests:0,activation_HTTP_accepted:false,
  activation_write_outcome_uncertain:false,independent_readback_attempted:false,quarantined_committed_state_observed:false,
  installer_catalog_version_reference_exact:false,guarded_RPCs:0,restrictive_policies:0,public_guard_policies:0,storage_guard_policies:0,backend_forced_RLS_tables:0,
  backend_schema_API_denied:false,post_target_metadata_matched:false,readback_problem_code:null,installation_problem_code:null,
  general_write_capable_SQL_endpoint_used:false,application_rows_explicitly_read_or_written:false,
  private_control_rows_aggregated:false,private_catalog_function_may_have_run:false,reviewed_DDL_hooks_may_have_run:false,
  application_guards_may_have_changed:false,resume_or_quarantine_recovery_invoked:false,automatic_write_retry_or_delete_performed:false,
  email_push_or_FX_dispatched:false,Auth_settings_secrets_schedules_or_deployments_changed:false,
  raw_provider_bodies_SQL_sources_or_credentials_printed:false,token_saved_to_disk_or_environment:false,
  ZIP_DPAPI_or_saved_credentials_accessed:false,metadata_observation_is_not_a_write_lock:true,
  target_GUC_is_acknowledgement_not_independent_attestation:true,actual_PostgreSQL_concurrency_verified:false,
  authenticated_gateway_or_delivery_verified:false,live_activation_approved:false,hosted_acceptance:false,
  production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],samples:[],checkpoint:'PRIVATE_INPUT',problem_code:null,exit_code:1};
 try{
  need(exact(input,['token','acknowledgement'])&&input.acknowledgement===acknowledgement&&typeof input.token==='string'&&/^sbp_fc[A-Za-z0-9_-]{20,512}$/.test(input.token),'PRIVATE_INPUT_REQUIRED');
  const sql=await installationSQL();r.checkpoint='FRESH_DORMANT_REVIEW';
  const pre=await reviewRegistration({token:input.token},{transport});r.actual_hosted_requests=pre.actual_hosted_requests;
  r.samples=pre.samples.map(x=>({endpoint:'PRE_'+x.endpoint,http_status:x.http_status}));r.precheck_problem_code=pre.problem_code;
  need(pre.exit_code===0&&pre.current_dormant_registration_state_verified===true,'FRESH_DORMANT_REVIEW_REQUIRED');r.fresh_dormant_review_passed=true;
  async function request(label,query){
   r.checkpoint=label;r.actual_hosted_requests++;const sample={endpoint:label,http_status:null};r.samples.push(sample);
   const url='https://api.supabase.com/v1/projects/'+stagingRef+(query?'/database/query':'');
   const response=await transport(url,{method:query?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(label==='INSTALL_QUARANTINED'?60000:30000),
    headers:{Authorization:'Bearer '+input.token,Accept:'application/json','Cache-Control':'no-store',...(query?{'Content-Type':'application/json'}:{})},
    ...(query?{body:JSON.stringify({query,read_only:false})}:{})});
   sample.http_status=response.status;if(label==='INSTALL_QUARANTINED')r.activation_HTTP_accepted=response.status===201;
   need(!response.redirected&&(!response.url||response.url===url)&&response.status===(query?201:200),'HTTP_RESPONSE_REVIEW_REQUIRED');
   need(/^application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''),'BOUNDED_JSON_RESPONSE_REQUIRED');
   const reader=response.body?.getReader();need(reader,'BOUNDED_JSON_RESPONSE_REQUIRED');const chunks=[];let size=0;
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=131072,'BOUNDED_JSON_RESPONSE_REQUIRED');chunks.push(value);}}
   finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)));}catch{need(false,'BOUNDED_JSON_RESPONSE_REQUIRED');}
  }
  const row=(data,alias)=>{need(Array.isArray(data)&&data.length===1&&exact(data[0],[alias]),'BOUNDED_JSON_RESPONSE_REQUIRED');return data[0][alias];};
  r.activation_POST_requests=1;r.activation_write_outcome_uncertain=true;r.application_guards_may_have_changed=true;
  r.general_write_capable_SQL_endpoint_used=true;r.reviewed_DDL_hooks_may_have_run=true;
  let writeProblem=null;
  try{const x=row(await request('INSTALL_QUARANTINED',sql.write),'quarantined_installation');
   need(isDeepStrictEqual(x,{result:'STAGING_EMAIL_INSTALLED_QUARANTINED',target_independently_verified:false,guarded_RPCs:148,restrictive_policies:82,hosted_acceptance:false}),'INSTALLATION_RECEIPT_REVIEW_REQUIRED');
  }catch(e){writeProblem=safe(e);r.installation_problem_code=writeProblem;}
  try{
   r.independent_readback_attempted=true;r.private_catalog_function_may_have_run=true;
   const x=row(await request('INDEPENDENT_QUARANTINED_READBACK',sql.readback),'quarantined_readback');
   need(exact(x,['context','server_version_num','installer_catalog','control','guarded_RPCs','restrictive_policies','public_guard_policies','storage_guard_policies','backend_tables','backend_tables_forced_RLS','backend_schema_API_denied'])&&
    isDeepStrictEqual(x.context,{privileged_origin:true,transaction_read_only:'on'})&&x.server_version_num===pre.server_version_num&&
    ['guarded_RPCs','restrictive_policies','public_guard_policies','storage_guard_policies','backend_tables','backend_tables_forced_RLS'].every(k=>Number.isInteger(x[k])&&x[k]>=0&&x[k]<=10000)&&
    typeof x.backend_schema_API_denied==='boolean'&&exact(x.control,['rows','quarantined'])&&Number.isInteger(x.control.rows)&&typeof x.control.quarantined==='boolean','QUARANTINED_READBACK_REVIEW_REQUIRED');
   r.installer_catalog_version_reference_exact=isDeepStrictEqual(x.installer_catalog,versionReference(sql.base,x.server_version_num));
   r.guarded_RPCs=x.guarded_RPCs;r.restrictive_policies=x.restrictive_policies;r.public_guard_policies=x.public_guard_policies;r.storage_guard_policies=x.storage_guard_policies;r.backend_forced_RLS_tables=x.backend_tables_forced_RLS;r.backend_schema_API_denied=x.backend_schema_API_denied;
   r.private_control_rows_aggregated=true;
   need(r.installer_catalog_version_reference_exact&&isDeepStrictEqual(x.control,{rows:1,quarantined:true})&&x.guarded_RPCs===148&&x.restrictive_policies===82&&x.public_guard_policies===81&&x.storage_guard_policies===1&&x.backend_tables===5&&x.backend_tables_forced_RLS===5&&x.backend_schema_API_denied===true,'QUARANTINED_READBACK_REVIEW_REQUIRED');
   r.quarantined_committed_state_observed=true;r.activation_write_outcome_uncertain=false;
  }catch(e){r.readback_problem_code=safe(e);}
  const target=await request('TARGET_AFTER');need(object(target)&&object(target.database)&&(target.ref===stagingRef||(target.ref===undefined&&target.id===stagingRef))&&!(typeof target.id==='string'&&/^[a-z]{20}$/.test(target.id)&&target.id!==stagingRef)&&target.database.host==='db.'+stagingRef+'.supabase.co'&&target.status==='ACTIVE_HEALTHY','TARGET_METADATA_REVIEW_REQUIRED');r.post_target_metadata_matched=true;
  if(writeProblem)need(false,writeProblem);if(r.readback_problem_code)need(false,r.readback_problem_code);
  r.result='BATCH_H_STAGING_DATABASE_INSTALLED_QUARANTINED_AND_READ_BACK';r.checkpoint='COMPLETE';r.exit_code=0;
 }catch(e){r.problem_code=safe(e);}
 r.checked_UTC=new Date().toISOString();return r;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 let r;try{need(process.argv.length===3&&process.argv[2]==='--private-parent-pipe'&&!process.stdin.isTTY&&!process.stdout.isTTY,'PRIVATE_INPUT_REQUIRED');
  let size=0;const chunks=[];for await(const b of process.stdin){size+=b.length;need(size<=8192,'PRIVATE_INPUT_REQUIRED');chunks.push(b);}
  const x=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  r=exact(x,['preflight'])&&x.preflight===true?{stage_step:stage,result:'PRIVATE_PIPE_PREFLIGHT_PASS',actual_hosted_requests:0,exit_code:0}:await installQuarantined(x);
 }catch{r={stage_step:stage,result:'PRIVATE_BATCH_H_INPUT_REQUIRED',actual_hosted_requests:0,problem_code:'PRIVATE_INPUT_REQUIRED',exit_code:1};}
 process.stdout.write(JSON.stringify(r));process.exitCode=r.exit_code;
}
