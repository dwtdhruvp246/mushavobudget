// One privileged staging-only synthetic payment. No DDL, Auth proof or control-mode change.
import {createHash} from 'node:crypto';
import {contextSQL,stagingRef} from './email-registration-handoff-sql.mjs';
import {windowHandoffSQL} from './email-window-handoff-sql.mjs';
import {preservationSQL} from '../check-fr-2-email-batch-u-hosted.mjs';
export const fixtureName='MUSHAVO SECURITY BATCH U TEMPORARY TEST';
export const fixtureNote='FR2_BATCH_U_SCOPED_FIXTURE_V1_REMOVE_AFTER_ACCEPTANCE';
const quote=x=>"'"+String(x).replaceAll("'","''")+"'",uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
const need=(v,c='SCOPED_FIXTURE_INPUT_REQUIRED')=>{if(!v)throw Error(c);};
export function scopedFixtureId(actor){need(uuid(actor?.user));const s=createHash('md5').update(stagingRef+':'+fixtureNote+':'+actor.user).digest('hex');return [s.slice(0,8),s.slice(8,12),s.slice(12,16),s.slice(16,20),s.slice(20)].join('-');}
function inputs(actors,p){need(Array.isArray(actors)&&actors.length===4&&actors.every(a=>uuid(a.user)&&uuid(a.session))&&actors.slice(0,3).every(a=>a.user===actors[0].user)&&actors[3].user!==actors[0].user);if(p)need(p.id===scopedFixtureId(actors[0])&&uuid(p.workspace)&&/^[A-Z]{3}$/.test(p.currency)&&/^\d{4}-\d\d-\d\d$/.test(p.date));}
const ro=b=>`BEGIN TRANSACTION READ ONLY;\nSET LOCAL statement_timeout='25s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\n${b}\nROLLBACK;\n`;
const first=a=>quote(a[0].user)+'::uuid';
const closed=`EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' AND mode='QUARANTINED') AND NOT EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window)`;
const fingerprint=p=>`md5(to_jsonb(${p})::text)`;
function preservationExpression(actors,excluded){let sql=preservationSQL(actors);if(excluded)sql=sql.replace('FROM public.payment_items p WHERE owner_id IN (',`FROM public.payment_items p WHERE p.id<>${quote(excluded)}::uuid AND owner_id IN (`);const a=sql.indexOf('SELECT jsonb_build_object('),b=sql.lastIndexOf(' AS full_app_preservation;');need(a>=0&&b>a);return sql.slice(a+'SELECT '.length,b);}
function exactRow(actors,p){return `p.id=${quote(p.id)}::uuid AND p.owner_id=${first(actors)} AND p.created_by=${first(actors)} AND p.workspace_id=${quote(p.workspace)}::uuid AND p.family_id IS NULL AND p.responsible_member_id IS NULL AND p.visibility='personal' AND p.status='active' AND p.name=${quote(fixtureName)} AND p.notes=${quote(fixtureNote)} AND p.category='Other' AND p.amount=1 AND p.currency=${quote(p.currency)} AND p.recurrence_type='once' AND p.recurrence_interval=1 AND p.start_date=${quote(p.date)}::date AND p.end_date=p.start_date AND p.due_day=extract(day FROM p.start_date)::int AND p.reminder_days_before=0`;}
export function scopedPlanSQL(actors){inputs(actors);return ro(`SELECT jsonb_build_object('context',${contextSQL},'closed',(${closed}),'personal_count',(SELECT count(*)::int FROM public.payment_items WHERE owner_id=${first(actors)} AND visibility='personal'),'id_absent',NOT EXISTS(SELECT 1 FROM public.payment_items WHERE id=${quote(scopedFixtureId(actors[0]))}::uuid),'plan',(SELECT jsonb_build_object('id',${quote(scopedFixtureId(actors[0]))},'workspace',w.id,'currency',s.default_payment_currency,'date',(current_date-7)::text) FROM public.budget_workspaces w JOIN public.workspace_settings s ON s.workspace_id=w.id JOIN public.supported_currencies c ON c.code=s.default_payment_currency AND c.is_active WHERE w.owner_id=${first(actors)} AND w.workspace_type='personal' AND w.status='active'),'preservation',${preservationExpression(actors)}) AS scoped_plan;`);}
export function scopedSnapshotSQL(actors,p){inputs(actors,p);return ro(`SELECT jsonb_build_object('context',${contextSQL},'closed',(${closed}),'absent',NOT EXISTS(SELECT 1 FROM public.payment_items WHERE id=${quote(p.id)}::uuid),'exact_row',EXISTS(SELECT 1 FROM public.payment_items p WHERE ${exactRow(actors,p)}),'row_fingerprint',(SELECT ${fingerprint('p')} FROM public.payment_items p WHERE p.id=${quote(p.id)}::uuid),'records_absent',NOT EXISTS(SELECT 1 FROM public.payment_records WHERE payment_item_id=${quote(p.id)}::uuid),'preservation',${preservationExpression(actors,p.id)}) AS scoped_snapshot;`);}
async function guard(){const {snapshot}=await windowHandoffSQL();const a=snapshot.indexOf(' IF NOT (('),b=snapshot.indexOf(' -- No private catalog_identity');need(a>=0&&b>a,'SCOPED_FIXTURE_GUARD_SOURCE_REQUIRED');return snapshot.slice(a,b).replace(" OR current_setting('transaction_read_only')<>'on'",'')+`\n IF kind<>'BOUNDED' OR NOT (${closed}) THEN RAISE EXCEPTION 'SCOPED_FIXTURE_QUARANTINE_REQUIRED'; END IF;\n PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' AND mode='QUARANTINED' FOR UPDATE;\n`;}
const ownerClaims=actors=>`PERFORM set_config('request.jwt.claim.role','',true);PERFORM set_config('request.jwt.claim.sub',${quote(actors[0].user)},true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',${quote(actors[0].user)})::text,true);`;
const tx=b=>`BEGIN;\nSET LOCAL statement_timeout='25s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\n${b}\nCOMMIT;\n`;
export async function scopedCreateSQL(actors,p){inputs(actors,p);return tx(`DO $fixture$ DECLARE observed jsonb;kind text;predicate_hash text;n integer; BEGIN\n${await guard()}
 LOCK TABLE public.payment_items IN SHARE ROW EXCLUSIVE MODE;
 IF EXISTS(SELECT 1 FROM public.payment_items WHERE owner_id=${first(actors)} AND visibility='personal') OR EXISTS(SELECT 1 FROM public.payment_items WHERE id=${quote(p.id)}::uuid) THEN RAISE EXCEPTION 'SCOPED_FIXTURE_EMPTY_SCOPE_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM auth.users u JOIN public.profiles pr ON pr.id=u.id JOIN public.budget_workspaces w ON w.owner_id=u.id JOIN public.workspace_settings s ON s.workspace_id=w.id WHERE u.id=${first(actors)} AND u.email_confirmed_at IS NOT NULL AND (u.banned_until IS NULL OR u.banned_until<=statement_timestamp()) AND pr.account_status='active' AND w.id=${quote(p.workspace)}::uuid AND w.workspace_type='personal' AND w.status='active' AND s.default_payment_currency=${quote(p.currency)} AND ${quote(p.currency)}=ANY(s.enabled_currencies) AND NOT EXISTS(SELECT 1 FROM public.app_admins a WHERE a.user_id=u.id OR lower(a.email)=lower(u.email))) OR (SELECT count(*) FROM public.budget_workspaces WHERE owner_id=${first(actors)} AND workspace_type='personal' AND status<>'closed')<>1 OR ${quote(p.date)}::date<>current_date-7 THEN RAISE EXCEPTION 'SCOPED_FIXTURE_ACTOR_OR_PLAN_REQUIRED'; END IF;
 ${ownerClaims(actors)}
 INSERT INTO public.payment_items(id,owner_id,created_by,workspace_id,visibility,name,category,amount,currency,recurrence_type,recurrence_interval,due_day,start_date,end_date,reminder_days_before,status,notes) VALUES(${quote(p.id)}::uuid,${first(actors)},${first(actors)},${quote(p.workspace)}::uuid,'personal',${quote(fixtureName)},'Other',1,${quote(p.currency)},'once',1,extract(day FROM ${quote(p.date)}::date)::int,${quote(p.date)}::date,${quote(p.date)}::date,0,'active',${quote(fixtureNote)});
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 OR NOT EXISTS(SELECT 1 FROM public.payment_items p WHERE ${exactRow(actors,p)}) THEN RAISE EXCEPTION 'SCOPED_FIXTURE_CREATE_REQUIRED'; END IF;
END $fixture$;
SELECT jsonb_build_object('created',true,'row_fingerprint',(SELECT ${fingerprint('p')} FROM public.payment_items p WHERE p.id=${quote(p.id)}::uuid)) AS scoped_created;`);}
export async function scopedDeleteSQL(actors,p,hash,baseline){inputs(actors,p);need(typeof hash==='string'&&/^[a-f0-9]{32}$/.test(hash)&&baseline&&['payment_items','payment_records'].every(k=>/^[a-f0-9]{32}$/.test(baseline[k])));return tx(`DO $fixture$ DECLARE observed jsonb;kind text;predicate_hash text;n integer;f record;linked boolean;v jsonb; BEGIN\n${await guard()}
 PERFORM 1 FROM public.payment_items p WHERE ${exactRow(actors,p)} AND ${fingerprint('p')}=${quote(hash)} FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SCOPED_FIXTURE_CHANGED_ROW_REFUSED'; END IF;
 -- The row lock also blocks new foreign-key references until this transaction ends.
 FOR f IN SELECT ns.nspname,c.relname,a.attname,k.conkey,k.confkey FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace ns ON ns.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=k.conkey[1] WHERE k.contype='f' AND k.confrelid='public.payment_items'::regclass LOOP
  IF cardinality(f.conkey)<>1 OR cardinality(f.confkey)<>1 THEN RAISE EXCEPTION 'SCOPED_FIXTURE_REFERENCE_SHAPE_REQUIRED'; END IF;
  EXECUTE format('SELECT EXISTS(SELECT 1 FROM %I.%I WHERE %I=$1)',f.nspname,f.relname,f.attname) INTO linked USING ${quote(p.id)}::uuid;
  IF linked THEN RAISE EXCEPTION 'SCOPED_FIXTURE_LINKED_ROW_REFUSED'; END IF;
 END LOOP;
 v:=(${preservationExpression(actors,p.id)});
 IF v->>'payment_items'<>${quote(baseline.payment_items)} OR v->>'payment_records'<>${quote(baseline.payment_records)} THEN RAISE EXCEPTION 'SCOPED_FIXTURE_EXISTING_FINANCE_DRIFT'; END IF;
 ${ownerClaims(actors)}
 DELETE FROM public.payment_items p WHERE ${exactRow(actors,p)} AND ${fingerprint('p')}=${quote(hash)};
 GET DIAGNOSTICS n=ROW_COUNT;IF n<>1 THEN RAISE EXCEPTION 'SCOPED_FIXTURE_DELETE_REQUIRED'; END IF;
END $fixture$;
SELECT jsonb_build_object('deleted',true) AS scoped_deleted;`);}
