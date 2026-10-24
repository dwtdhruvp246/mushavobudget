// Fixed SQL only. Catalog preflight/readback never invokes application controls.
import {readFile} from 'node:fs/promises';
import {loadCanonicalRollout} from '../check-fr-2-email-canonical-rollout-source.mjs';
export const stagingRef='dczlddwbtgvfdujgcitb';
const root=new URL('../../',import.meta.url);
export const contextSQL=`jsonb_build_object('privileged_origin',current_user='postgres' AND session_user='postgres'
 AND current_setting('session_replication_role')='origin'
 AND coalesce(current_setting('role',true),'none') IN ('none','postgres')
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls)),
 'transaction_read_only',current_setting('transaction_read_only'))`;
const readonly=select=>`BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='3s';
SET LOCAL search_path=pg_catalog;
${select}
ROLLBACK;
`;
export const privateCatalogSQL=`jsonb_build_object(
 'schemas',(SELECT jsonb_agg(jsonb_build_array(n.nspname,r.rolname,n.nspacl::text) ORDER BY n.nspname)
 FROM pg_namespace n JOIN pg_roles r ON r.oid=n.nspowner WHERE n.nspname IN ('mushavo_email_install','mushavo_email_auth')),
 'functions',(SELECT jsonb_agg(jsonb_build_array(p.proname,pg_get_function_identity_arguments(p.oid),
 p.prorettype::regtype::text,l.lanname,r.rolname,p.prokind,p.prosecdef,p.proisstrict,p.proleakproof,
 p.provolatile,p.proparallel,p.pronargdefaults,p.proconfig,p.proacl::text,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),
 has_function_privilege('anon',p.oid,'EXECUTE'),has_function_privilege('authenticated',p.oid,'EXECUTE'),has_function_privilege('service_role',p.oid,'EXECUTE'))
 ORDER BY p.proname,pg_get_function_identity_arguments(p.oid)) FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner
 JOIN pg_language l ON l.oid=p.prolang WHERE p.pronamespace=to_regnamespace('mushavo_email_install')),
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.relname,c.relkind,r.rolname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text,c.reloptions)
 ORDER BY c.relname) FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.relnamespace=to_regnamespace('mushavo_email_install')),
 'columns',(SELECT jsonb_agg(jsonb_build_array(c.relname,a.attname,a.atttypid::regtype::text,a.atttypmod,a.attnotnull,
 a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY c.relname,a.attnum)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(c.relname,k.conname,pg_get_constraintdef(k.oid),k.convalidated) ORDER BY c.relname,k.conname)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid WHERE c.relnamespace=to_regnamespace('mushavo_email_install')),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(indexname,indexdef) ORDER BY indexname) FROM pg_indexes WHERE schemaname='mushavo_email_install'),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY tablename,policyname) FROM pg_policies p WHERE schemaname='mushavo_email_install'),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(c.relname,t.tgname,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY c.relname,t.tgname)
 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND NOT t.tgisinternal),
 'schema_api_access',(SELECT jsonb_agg(jsonb_build_array(x,has_schema_privilege(x,n.oid,'USAGE'),has_schema_privilege(x,n.oid,'CREATE')) ORDER BY x)
 FROM pg_namespace n CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) x WHERE n.nspname='mushavo_email_install'),
 'table_api_access',(SELECT jsonb_agg(jsonb_build_array(x,c.relname,has_table_privilege(x,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')) ORDER BY x,c.relname)
 FROM pg_class c CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) x WHERE c.relnamespace=to_regnamespace('mushavo_email_install') AND c.relkind='r'))`;
export const controlQuery=readonly(`SELECT jsonb_build_object('context',${contextSQL},'state',
 (SELECT jsonb_build_object('row_count',count(*),'registered_only',coalesce(bool_and(singleton AND target_project='${stagingRef}'
 AND mode='REGISTERED' AND catalog_sha256 IS NULL),false)) FROM mushavo_email_install.rollout_control)) AS registration_control;`);
export async function handoffSQL(){
 const baseline=await readFile(new URL('supabase/diagnostics/security_fr_2_4_email_pre_activation_reviewed_types.sql',root),'utf8');
 const start=baseline.indexOf('WITH routines AS ('),end=baseline.indexOf('\nSELECT jsonb_build_object(',start);
 if(start<0||end<0)throw Error('BASELINE_SOURCE_REQUIRED');
 const cte=baseline.slice(start,end);
 const preflight=readonly(cte+`\nSELECT jsonb_build_object('context',${contextSQL},'checks',to_jsonb(c)) AS registration_preflight FROM checks c;`);
 const readback=readonly(cte+`\nSELECT jsonb_build_object('context',${contextSQL},'checks',to_jsonb(c),
 'private_catalog',${privateCatalogSQL}) AS registration_readback FROM checks c;`);
 const {registration}=await loadCanonicalRollout();
 if(registration.split('BEGIN;\n').length!==2)throw Error('REGISTRATION_SOURCE_REQUIRED');
 const write=registration.replace('BEGIN;\n',`BEGIN;\nSET LOCAL mushavo.email_rollout_project='${stagingRef}';\nSET LOCAL mushavo.email_rollout_action='REGISTER_STAGING_EMAIL';\n`);
 return {preflight,readback,control:controlQuery,write};
}
