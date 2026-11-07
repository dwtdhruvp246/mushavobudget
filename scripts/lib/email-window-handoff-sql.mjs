// Fixed staging-only upgrade and READ ONLY snapshots. No execution on import.
import {readFile} from 'node:fs/promises';
import {windowSources} from './email-acceptance-window-source.mjs';
import {installationSQL} from '../install-fr-2-email-batch-h.mjs';
import {privateCatalogSQL,contextSQL,stagingRef} from './email-registration-handoff-sql.mjs';
import {versionReference} from './email-registration-catalog-versions.mjs';
export const windowCatalogSQL=privateCatalogSQL.replace("n.nspname IN ('mushavo_email_install','mushavo_email_auth')","n.nspname='mushavo_email_install'");
export function windowVersionReference(base,versionNum){
 const reference=versionReference(base,versionNum);if(!reference)return null;
 const major=Math.floor(versionNum/10000);
 if(major<18){
  const names=['singleton','target_project','allowed_users','opened_at','expires_at'];
  for(const name of names){
   const rows=reference.constraints.filter(x=>x[0]==='acceptance_window'&&x[1]==='acceptance_window_'+name+'_not_null');
   if(rows.length!==1||rows[0][2]!=='NOT NULL '+name||rows[0][3]!==true||!reference.columns.some(x=>x[0]==='acceptance_window'&&x[1]===name&&x[4]===true))throw Error('WINDOW_VERSION_REFERENCE_REQUIRED');
  }
  reference.constraints=reference.constraints.filter(x=>!(x[0]==='acceptance_window'&&names.some(n=>x[1]==='acceptance_window_'+n+'_not_null')));
 }
 if(major<17){const table=reference.relations.find(x=>x[0]==='acceptance_window');if(!table||table[5]!=='{postgres=arwdDxtm/postgres}')throw Error('WINDOW_VERSION_REFERENCE_REQUIRED');table[5]='{postgres=arwdDxt/postgres}';}
 return reference;
}
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
export async function windowHandoffSQL(){
 const {base}=await installationSQL();
 const upgraded=JSON.parse(await readFile(new URL('../../docs/security-audit/security-fr-2-email-batch-l-private-catalog.json',import.meta.url),'utf8'));
 const refs=fn=>Object.fromEntries([15,16,17,18].map(n=>[String(n),fn(n*10000)]));
 const oldRefs=refs(v=>versionReference(base,v)),newRefs=refs(v=>windowVersionReference(upgraded,v));
 const {upgrade,oldHash,newHash}=await windowSources();
 const snapshot=`BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
DO $snapshot$
DECLARE observed jsonb; kind text; empty_window boolean:=false; data jsonb; predicate_hash text;
BEGIN
 IF NOT ((${contextSQL})->>'privileged_origin')::boolean OR current_setting('transaction_read_only')<>'on'
 THEN RAISE EXCEPTION 'EMAIL_L_PRIVILEGED_READ_ONLY_REQUIRED'; END IF;
 PERFORM pg_advisory_xact_lock(20261017,2411);
 observed:=(${windowCatalogSQL});
 IF observed=(${quote(JSON.stringify(oldRefs))}::jsonb -> (current_setting('server_version_num')::integer/10000)::text)
 THEN kind:='ORIGINAL';predicate_hash:=${quote(oldHash)};
 ELSIF observed=(${quote(JSON.stringify(newRefs))}::jsonb -> (current_setting('server_version_num')::integer/10000)::text)
 THEN kind:='BOUNDED';predicate_hash:=${quote(newHash)};
 ELSE RAISE EXCEPTION 'EMAIL_L_CATALOG_SOURCE_REVIEW_REQUIRED'; END IF;
 -- No private catalog_identity function is invoked until its source/ACL projection matches.
 IF kind='BOUNDED' THEN EXECUTE 'SELECT count(*)=0 FROM mushavo_email_install.acceptance_window' INTO empty_window; END IF;
 SELECT jsonb_build_object('context',${contextSQL},'server_version_num',current_setting('server_version_num')::integer,
 'catalog_kind',kind,'control_rows',(SELECT count(*)::integer FROM mushavo_email_install.rollout_control),
 'quarantined_stamp_matched',EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}'
 AND mode='QUARANTINED' AND catalog_sha256=mushavo_email_install.catalog_identity()),
 'predicate_source_matched',EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure('mushavo_email_auth.session_valid(uuid,uuid)')
 AND p.proowner='postgres'::regrole AND p.prosecdef AND p.provolatile='s' AND p.proconfig=ARRAY['search_path=pg_catalog']::text[]
 AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=predicate_hash
 AND NOT has_function_privilege('anon',p.oid,'EXECUTE') AND NOT has_function_privilege('authenticated',p.oid,'EXECUTE') AND NOT has_function_privilege('service_role',p.oid,'EXECUTE')),
 'window_present',to_regclass('mushavo_email_install.acceptance_window') IS NOT NULL,'window_empty',empty_window,
 'guarded_RPCs',(SELECT count(*)::integer FROM pg_proc WHERE pronamespace='public'::regnamespace AND position('PERFORM mushavo_email_auth.require_application_session();' in prosrc)>0),
 'restrictive_policies',(SELECT count(*)::integer FROM pg_policies WHERE schemaname IN ('public','storage') AND policyname='Email verified session required' AND permissive='RESTRICTIVE'),
 'backend_forced_RLS_tables',(SELECT count(*)::integer FROM pg_class WHERE relnamespace=to_regnamespace('mushavo_email_auth') AND relkind='r' AND relrowsecurity AND relforcerowsecurity),
 'private_schema_API_denied',NOT EXISTS(SELECT 1 FROM pg_namespace n CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r WHERE n.nspname IN ('mushavo_email_install','mushavo_email_auth') AND (has_schema_privilege(r,n.oid,'USAGE') OR has_schema_privilege(r,n.oid,'CREATE')))) INTO data;
 PERFORM set_config('mushavo.window_snapshot',data::text,true);
END $snapshot$;
SELECT current_setting('mushavo.window_snapshot')::jsonb AS window_snapshot;
ROLLBACK;
`;
 if(upgrade.split('BEGIN;\n').length!==2||upgrade.split('COMMIT;\n').length!==2)throw Error('WINDOW_TRANSACTION_SOURCE_REQUIRED');
 const write=upgrade.replace('BEGIN;\n',`BEGIN;\nSET LOCAL mushavo.email_rollout_project='${stagingRef}';\nSET LOCAL mushavo.email_rollout_action='INSTALL_CLOSED_STAGING_ACCEPTANCE_CONTROLS';\n`).replace('COMMIT;\n',"SELECT jsonb_build_object('result','CLOSED_WINDOW_CONTROLS_INSTALLED','mode_change_requested',false) AS window_installation;\nCOMMIT;\n");
 return {snapshot,write};
}
