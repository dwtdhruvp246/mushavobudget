// Generate explicit, reviewable candidate SQL from the frozen ordered catalog.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {localDatabase,root} from './lib/stage-3-local-db.mjs';
const {db}=await localDatabase(process.argv[2]);
const quote=s=>"'"+s.replaceAll("'","''")+"'";
const ident=s=>'"'+s.replaceAll('"','""')+'"';
const md5=s=>createHash('md5').update(s).digest('hex');
const identityOnly=new Set(['is_app_admin','is_platform_staff','enqueue_admin_event_notification','transfer_business_ownership','reserve_admin_user_invitation','business_admin_test_permit']);
try {
 const routines=(await db.query(`select p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosrc body,
 pg_get_functiondef(p.oid) definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
 and (p.prosrc ~* '(is_app_admin|is_platform_staff|app_admins)' or p.proname like 'admin_%') order by p.proname`)).rows;
 const frozen=JSON.parse(await readFile(resolve(root,'docs/security-audit/security-stage-3-admin-source-inventory.json'),'utf8'));
 if(routines.length!==frozen.routines.length || routines.some(r=>!frozen.routines.some(f=>f.name===r.name&&f.args===r.args&&f.body_md5===md5(r.body))))throw Error('Frozen routine inventory drift');
 const policies=(await db.query(`select n.nspname schema,c.relname relation,p.polname name,p.polcmd command,p.polpermissive permissive,
 pg_get_expr(p.polqual,p.polrelid) using_expression,pg_get_expr(p.polwithcheck,p.polrelid) check_expression,(select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r) roles
 from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
 where n.nspname in ('public','storage') and concat(pg_get_expr(p.polqual,p.polrelid),' ',pg_get_expr(p.polwithcheck,p.polrelid)) ~* '(is_app_admin|is_platform_staff|app_admins)' order by c.relname,p.polname`)).rows;
 if(policies.filter(p=>p.schema==='public').length!==frozen.policies.length || policies.filter(p=>p.schema==='storage').length!==3)throw Error('Frozen policy count drift');
 const replaceCalls=s=>s.replace(/(?:public\.)?is_platform_staff\(/g, 'public.platform_admin_authorized(').replace(/(?:public\.)?is_app_admin\(\)/g, 'public.platform_admin_authorized(null)');
 const changePolicy=s=>s && replaceCalls(s).replaceAll('app_admins.user_id','(CASE WHEN public.admin_mfa_satisfied() THEN app_admins.user_id ELSE NULL::uuid END)');
 const replacements=[];
 const guards=[];
 for(const r of routines) {
  const crlf=r.body.replaceAll('\n','\r\n');
  guards.push(`if not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=${quote(r.name)} and pg_get_function_identity_arguments(p.oid)=${quote(r.args)} and md5(p.prosrc) in (${quote(md5(r.body))},${quote(md5(crlf))}) and md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))=${quote(md5(r.definition.replace(r.body,'')))}) then raise exception 'ADMIN_MFA_SOURCE_DRIFT: ${r.name}'; end if;`);
  if(identityOnly.has(r.name))continue;
  let body=replaceCalls(r.body);
  if(r.name==='is_active_family_participant')body=body.replace('app_admins.user_id = auth.uid()','app_admins.user_id = auth.uid() and public.admin_mfa_satisfied()');
  if(body===r.body)throw Error('Unclassified positive privilege routine: '+r.name);
  replacements.push(r.definition.replace(r.body,()=>body)+';');
 }
 const policyChanges=[];
 for(const p of policies) {
  const shape=JSON.stringify([p.command,p.permissive,p.roles,p.using_expression,p.check_expression]);
  guards.push(`if not exists(select 1 from pg_policy p where p.polrelid=${quote(p.schema+'.'+p.relation)}::regclass and p.polname=${quote(p.name)} and p.polcmd=${quote(p.command)} and p.polpermissive=${p.permissive} and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)=${quote(p.roles)} and coalesce(pg_get_expr(p.polqual,p.polrelid),'')=${quote(p.using_expression||'')} and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')=${quote(p.check_expression||'')}) then raise exception 'ADMIN_MFA_POLICY_DRIFT: ${p.relation} / ${p.name}'; end if;`);
  const u=changePolicy(p.using_expression),c=changePolicy(p.check_expression);
  if(u===p.using_expression && c===p.check_expression)throw Error('Unclassified policy '+shape);
  policyChanges.push(`alter policy ${ident(p.name)} on ${ident(p.schema)}.${ident(p.relation)}${u?' using ('+u+')':''}${c?' with check ('+c+')':''};`);
 }
 const sql=`-- 3.4.2 REVIEW CANDIDATE ONLY. Not an ordered migration; do not paste as readiness SQL.
-- Source parent 9703bcac1731c1f5b68b7c3537ab0e27b3a2ae72; no Auth/user/factor/history mutation.
-- Operator must review recovery, baseline drift, effective grants and isolated staging actor first.
begin;
set local search_path=public,pg_temp;
do $guard$
begin
 if current_setting('mushavo.admin_mfa_recovery_reviewed',true) is distinct from 'yes' then raise exception 'ADMIN_MFA_RECOVERY_REVIEW_REQUIRED'; end if;
 if to_regprocedure('public.admin_mfa_satisfied()') is not null then raise exception 'ADMIN_MFA_ALREADY_INSTALLED'; end if;
 if not exists(select 1 from public.app_admins a join public.profiles p on p.id=a.user_id join auth.mfa_factors f on f.user_id=a.user_id where a.role='super_admin' and p.account_status='active' and f.factor_type='totp' and f.status='verified') then raise exception 'ADMIN_MFA_CONTROLLED_OPERATOR_REQUIRED'; end if;
 ${guards.join('\n ')}
end $guard$;

create function public.admin_mfa_satisfied() returns boolean language sql stable security definer set search_path=public,pg_temp as $mfa$
 select auth.uid() is not null and coalesce(auth.jwt()->>'aal','aal1')='aal2'
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active')
 and exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified');
$mfa$;
create function public.platform_admin_authorized(p_roles text[] default null) returns boolean language sql stable security definer set search_path=public,pg_temp as $mfa$
 select public.is_platform_staff(p_roles) and public.admin_mfa_satisfied();
$mfa$;
create function public.admin_mfa_status() returns jsonb language sql stable security definer set search_path=public,pg_temp as $mfa$
 select jsonb_build_object('staff',public.is_platform_staff(null),'authorized',public.platform_admin_authorized(null),
 'active',exists(select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active'),
 'has_verified_factor',exists(select 1 from auth.mfa_factors f where f.user_id=auth.uid() and f.factor_type='totp' and f.status='verified'));
$mfa$;
revoke all on function public.admin_mfa_satisfied(),public.platform_admin_authorized(text[]),public.admin_mfa_status() from public,anon;
grant execute on function public.admin_mfa_satisfied(),public.platform_admin_authorized(text[]),public.admin_mfa_status() to authenticated,service_role;

-- Existing routine ACLs/security settings remain those returned by pg_get_functiondef.
${replacements.join('\n\n')}
-- Change reviewed administrative branches of existing policies, preserving policy roles/type/owner alternatives.
${policyChanges.join('\n\n')}
commit;
`;
 await mkdir(resolve(root,'supabase/candidates'),{recursive:true});
 await writeFile(resolve(root,'supabase/candidates/security_stage_3_admin_mfa.sql'),sql);
 const routineValues=routines.map(r=>`(${quote(r.name)},${quote(r.args)},${quote(md5(r.body))},${quote(md5(r.body.replaceAll('\n','\r\n')))},${quote(md5(r.definition.replace(r.body,'')))})`).join(',\n');
 const policyValues=policies.map(p=>`(${quote(p.schema)},${quote(p.relation)},${quote(p.name)},${quote(p.command)},${p.permissive},${quote(p.roles)},${quote(p.using_expression||'')},${quote(p.check_expression||'')})`).join(',\n');
 const readiness=`-- 3.4.3 READ-ONLY STAGING METADATA. No installation, enrollment, role change or provider call.
-- Owner must select project dczlddwbtgvfdujgcitb in Supabase before running.
-- SQL cannot prove which dashboard/project the owner selected. No token/secret/UUID output.
begin read only;
set local search_path=public,pg_temp;
with expected_routines(name,args,lf_md5,crlf_md5,shape_md5) as (values
${routineValues}),
routine_checks as (
 select e.name,p.oid,p.proacl,
 coalesce(md5(p.prosrc)=e.lf_md5,false) lf_match,
 coalesce(md5(p.prosrc)=e.crlf_md5,false) crlf_match,
 coalesce(md5(replace(pg_get_functiondef(p.oid),p.prosrc,''))=e.shape_md5,false) shape_match
 from expected_routines e left join pg_proc p on p.proname=e.name and p.pronamespace='public'::regnamespace and pg_get_function_identity_arguments(p.oid)=e.args),
expected_policies(schema_name,relation_name,name,command,permissive,roles,using_expression,check_expression) as (values
${policyValues}),
policy_checks as (
 select e.schema_name,e.relation_name,e.name,coalesce(p.polcmd=e.command and p.polpermissive=e.permissive
 and (select string_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end,',' order by r) from unnest(p.polroles) r)=e.roles
 and coalesce(pg_get_expr(p.polqual,p.polrelid),'')=e.using_expression
 and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')=e.check_expression,false) matches
 from expected_policies e left join pg_policy p on p.polrelid=to_regclass(e.schema_name||'.'||e.relation_name) and p.polname=e.name),
staff_counts as (select role,count(*) n from public.app_admins group by role),
operators as (select count(distinct a.user_id) n from public.app_admins a join public.profiles p on p.id=a.user_id
 join auth.mfa_factors f on f.user_id=a.user_id where a.role='super_admin' and p.account_status='active' and f.factor_type='totp' and f.status='verified')
select jsonb_build_object(
 'stage_step','3.4.3','scope','READ_ONLY_SELECTED_METADATA','project_selection','OWNER_MUST_CONFIRM_STAGING',
 'selected_routines',(select count(*) from routine_checks),
 'routine_lf_body_matches',(select count(*) from routine_checks where lf_match),
 'routine_crlf_body_matches',(select count(*) from routine_checks where crlf_match),
 'routine_body_or_shape_mismatches',(select count(*) from routine_checks where not ((lf_match or crlf_match) and shape_match)),
 'routine_mismatch_names',(select coalesce(jsonb_agg(name order by name),'[]'::jsonb) from routine_checks where not ((lf_match or crlf_match) and shape_match)),
 'modeled_source_not_hosted_grants',false,
 'selected_anonymous_executable_routines',(select count(*) from routine_checks where oid is not null and has_function_privilege('anon',oid,'execute')),
 'selected_authenticated_executable_routines',(select count(*) from routine_checks where oid is not null and has_function_privilege('authenticated',oid,'execute')),
 'selected_policies',(select count(*) from policy_checks),
 'policy_mismatches',(select count(*) from policy_checks where not matches),
 'policy_mismatch_names',(select coalesce(jsonb_agg(schema_name||'.'||relation_name||' / '||name order by schema_name,relation_name,name),'[]'::jsonb) from policy_checks where not matches),
 'platform_role_counts',(select coalesce(jsonb_object_agg(role,n),'{}'::jsonb) from staff_counts),
 'active_super_users_with_verified_totp',(select n from operators),
 'candidate_helpers_present',(select count(*) from pg_proc where pronamespace='public'::regnamespace and proname in ('admin_mfa_satisfied','platform_admin_authorized','admin_mfa_status')),
 'readiness',case when (select n from operators)=0 then 'BLOCKED_NO_VERIFIED_SUPER_OPERATOR' else 'VERIFIED_SUPER_EXISTS_CONTROLLED_IDENTITY_AND_RECOVERY_UNVERIFIED' end,
 'auth_settings_verified',false,'recovery_verified',false,'hosted_acceptance',false
) as admin_mfa_readiness;
commit;
`;
 await mkdir(resolve(root,'supabase/diagnostics'),{recursive:true});
 await writeFile(resolve(root,'supabase/diagnostics/security_stage_3_admin_mfa_readiness.sql'),readiness);
 // Compile the candidate in a disposable catalog to freeze rollback guards.
 await db.exec(`insert into auth.users(id,email) values('90000000-0000-4000-8000-000000000001','local-build@example.invalid');
 insert into public.app_admins(user_id,email,role) values('90000000-0000-4000-8000-000000000001','local-build@example.invalid','super_admin');
 insert into auth.mfa_factors(user_id,status,factor_type) values('90000000-0000-4000-8000-000000000001','verified','totp');
 set mushavo.admin_mfa_recovery_reviewed='yes';`);
 await db.exec(sql);
 const installed=(await db.query(`select p.proname name,pg_get_function_identity_arguments(p.oid) args,p.prosrc body from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (${routines.filter(r=>!identityOnly.has(r.name)).map(r=>quote(r.name)).join(',')})`)).rows;
 const installedPolicies=(await db.query(`select n.nspname schema,c.relname relation,p.polname name,pg_get_expr(p.polqual,p.polrelid) q,pg_get_expr(p.polwithcheck,p.polrelid) c from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage')`)).rows;
 const rollbackGuards=installed.map(r=>`if not exists(select 1 from pg_proc p where p.pronamespace='public'::regnamespace and p.proname=${quote(r.name)} and pg_get_function_identity_arguments(p.oid)=${quote(r.args)} and md5(p.prosrc)=${quote(md5(r.body))}) then raise exception 'ADMIN_MFA_ROLLBACK_SOURCE_DRIFT'; end if;`);
 for(const p of policies){const actual=installedPolicies.find(a=>a.schema===p.schema&&a.relation===p.relation&&a.name===p.name);rollbackGuards.push(`if not exists(select 1 from pg_policy p where p.polrelid=${quote(p.schema+'.'+p.relation)}::regclass and p.polname=${quote(p.name)} and coalesce(pg_get_expr(p.polqual,p.polrelid),'')=${quote(actual.q||'')} and coalesce(pg_get_expr(p.polwithcheck,p.polrelid),'')=${quote(actual.c||'')}) then raise exception 'ADMIN_MFA_ROLLBACK_POLICY_DRIFT'; end if;`);}
 const rollback=`-- OWNER-ONLY REVIEW CANDIDATE. Restores original authorization (including its pre-MFA risks).
-- No user/factor/history mutation. Not a browser bypass, automatic recovery or a deployment instruction.
begin;
set local search_path=public,pg_temp;
do $guard$ begin
 if current_setting('mushavo.admin_mfa_rollback_reviewed',true) is distinct from 'yes' then raise exception 'ADMIN_MFA_ROLLBACK_REVIEW_REQUIRED'; end if;
 ${rollbackGuards.join('\n ')}
end $guard$;
${routines.filter(r=>!identityOnly.has(r.name)).map(r=>r.definition+';').join('\n\n')}
${policies.map(p=>`alter policy ${ident(p.name)} on ${ident(p.schema)}.${ident(p.relation)}${p.using_expression?' using ('+p.using_expression+')':''}${p.check_expression?' with check ('+p.check_expression+')':''};`).join('\n\n')}
drop function public.admin_mfa_status();
drop function public.platform_admin_authorized(text[]);
drop function public.admin_mfa_satisfied();
commit;
`;
 await writeFile(resolve(root,'supabase/candidates/security_stage_3_admin_mfa_rollback.sql'),rollback);
 console.log(JSON.stringify({storage_policies:policies.filter(p=>p.schema==='storage').length,guarded_routines:routines.length,replaced_routines:replacements.length,replaced_policies:policyChanges.length,identity_only_routines:[...identityOnly]}));
}finally{await db.close();}
