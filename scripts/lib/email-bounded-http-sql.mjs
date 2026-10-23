// Staging-only Batch M: source-pinned one-shot window, stale-open fence and exact cleanup.
// Rendering has no network or database effects. Private timestamps never enter safe receipts.
import {windowHandoffSQL} from './email-window-handoff-sql.mjs';
import {deviceCleanupSQL as oldCleanup} from '../check-fr-2-email-batch-j.mjs';
import {stagingRef} from './email-registration-handoff-sql.mjs';
export const windowSeconds=300;
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(x);
function inputs(user,fence){if(!uuid(user)||typeof fence!=='string'||!/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d(?:\.\d{1,6})?\+00$/.test(fence))throw Error('WINDOW_PRIVATE_IDENTITY_REQUIRED');}
async function pinnedGuard(){
 const {snapshot}=await windowHandoffSQL();
 const a=snapshot.indexOf(' IF NOT (('),b=snapshot.indexOf(' -- No private catalog_identity');
 if(a<0||b<a)throw Error('WINDOW_PINNED_GUARD_REQUIRED');
 // Use the existing reviewed catalog comparison before any private function invocation.
 // Writes require the same privileged origin but are not READ ONLY.
 return snapshot.slice(a,b).replace(" OR current_setting('transaction_read_only')<>'on'",'')+"\n IF kind<>'BOUNDED' THEN RAISE EXCEPTION 'EMAIL_M_BOUNDED_CONTROLS_REQUIRED'; END IF;";
}
export async function stateSQL(){
 const {snapshot}=await windowHandoffSQL();
 // This read-only variant can observe a nonempty/ACTIVE window. The exact catalog check stays intact.
 return snapshot.replace("'window_present',to_regclass",`'mode',(SELECT mode FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}'),
 'private_fence',(SELECT changed_at AT TIME ZONE 'UTC' FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}')::text||'+00',
 'stamp_matched',EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' AND catalog_sha256=mushavo_email_install.catalog_identity()),
 'window_present',to_regclass`).replace('AS window_snapshot','AS bounded_state');
}
const transaction=body=>`BEGIN;\nSET LOCAL statement_timeout='25s';\nSET LOCAL lock_timeout='3s';\nSET LOCAL search_path=pg_catalog;\nSET LOCAL mushavo.email_rollout_project='${stagingRef}';\n${body}\nCOMMIT;\n`;
const selectedLease=(user,fence)=>`singleton AND target_project='${stagingRef}' AND allowed_users=ARRAY[${quote(user)}::uuid]
 AND opened_at>${quote(fence)}::timestamptz AND expires_at=opened_at+interval '${windowSeconds} seconds'`;
export async function openSQL(user,fence){inputs(user,fence);
 return transaction(`DO $open$ DECLARE observed jsonb; kind text; predicate_hash text; result jsonb; BEGIN
 ${await pinnedGuard()}
 -- A quarantine changes this value under the same advisory lock. Even a delayed original POST must fail afterwards.
 PERFORM 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}'
 AND mode='QUARANTINED' AND changed_at=${quote(fence)}::timestamptz FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window) THEN RAISE EXCEPTION 'EMAIL_M_STALE_OPEN_REFUSED'; END IF;
 PERFORM set_config('mushavo.email_rollout_action','OPEN_STAGING_ACCEPTANCE_WINDOW',true);
 result:=mushavo_email_install.open_acceptance_window(ARRAY[${quote(user)}::uuid],${windowSeconds});
 IF result IS DISTINCT FROM jsonb_build_object('result','STAGING_BOUNDED_ACCEPTANCE_WINDOW_OPEN','allowed_actor_count',1,'maximum_seconds',${windowSeconds},'hosted_acceptance',false)
 THEN RAISE EXCEPTION 'EMAIL_M_OPEN_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window WHERE ${selectedLease(user,fence)}) THEN RAISE EXCEPTION 'EMAIL_M_MONOTONIC_OPEN_REQUIRED'; END IF;
END $open$;
SELECT jsonb_build_object('opened',true,'allowed_actor_count',1,'maximum_seconds',${windowSeconds}) AS bounded_open;`);
}
export async function leaseSQL(user,fence){inputs(user,fence);
 const state=await stateSQL();
 return state.replace('AS bounded_state',`AS bounded_state`).replace('ROLLBACK;\n',`SELECT jsonb_build_object('exact_live_lease',EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window WHERE ${selectedLease(user,fence)}
 AND opened_at<=clock_timestamp() AND expires_at>clock_timestamp()+interval '30 seconds'
 AND opened_at=(SELECT changed_at FROM mushavo_email_install.rollout_control WHERE singleton AND mode='ACTIVE')),
 'remaining_seconds',(SELECT greatest(0,floor(extract(epoch FROM expires_at-clock_timestamp())))::integer FROM mushavo_email_install.acceptance_window WHERE ${selectedLease(user,fence)})) AS bounded_lease;
ROLLBACK;\n`);
}
export async function quarantineSQL(user,fence){inputs(user,fence);
 return transaction(`DO $close$ DECLARE observed jsonb; kind text; predicate_hash text; result jsonb; old_changed timestamptz; old_mode text; BEGIN
 ${await pinnedGuard()}
 SELECT changed_at,mode INTO STRICT old_changed,old_mode FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' FOR UPDATE;
 IF NOT ((old_mode='QUARANTINED' AND old_changed=${quote(fence)}::timestamptz AND NOT EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window))
 OR (old_mode='ACTIVE' AND (SELECT count(*)=1 FROM mushavo_email_install.acceptance_window WHERE ${selectedLease(user,fence)} AND opened_at=old_changed)))
 THEN RAISE EXCEPTION 'EMAIL_M_SELECTED_WINDOW_STATE_REQUIRED'; END IF;
 PERFORM set_config('mushavo.email_rollout_action','QUARANTINE_STAGING_EMAIL',true);
 result:=mushavo_email_install.quarantine();
 IF result->>'result' IS DISTINCT FROM 'STAGING_EMAIL_QUARANTINED' THEN RAISE EXCEPTION 'EMAIL_M_QUARANTINE_REQUIRED'; END IF;
 -- Ensure the changed-at fence advances even on a low-resolution/frozen clock.
 UPDATE mushavo_email_install.rollout_control SET changed_at=greatest(changed_at,old_changed+interval '1 microsecond') WHERE singleton;
 DELETE FROM mushavo_email_install.acceptance_window WHERE ${selectedLease(user,fence)};
 IF EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window) THEN RAISE EXCEPTION 'EMAIL_M_EXACT_WINDOW_CLEANUP_REQUIRED'; END IF;
END $close$;
SELECT jsonb_build_object('quarantined',true,'window_empty',true,'stale_open_fenced',true) AS bounded_close;`);
}
export async function deviceCleanupSQL(actor,challenge){
 const old=await oldCleanup(actor,challenge),start=old.indexOf(' IF NOT (('),end=old.indexOf('\n IF NOT EXISTS(SELECT 1 FROM mushavo_email_auth.challenges',start);
 if(start<0||end<start)throw Error('WINDOW_DEVICE_GUARD_REQUIRED');
 return old.slice(0,start).replace('DO $cleanup$ BEGIN','DO $cleanup$ DECLARE observed jsonb; kind text; predicate_hash text; BEGIN')+(await pinnedGuard())+`
 IF NOT EXISTS(SELECT 1 FROM mushavo_email_install.rollout_control WHERE singleton AND target_project='${stagingRef}' AND mode='QUARANTINED')
 OR EXISTS(SELECT 1 FROM mushavo_email_install.acceptance_window) THEN RAISE EXCEPTION 'EMAIL_M_CLOSED_DEVICE_CLEANUP_REQUIRED'; END IF;`+old.slice(end).replace('DO $cleanup$ BEGIN','DO $cleanup$ BEGIN');
}
