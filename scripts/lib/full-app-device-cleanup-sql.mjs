// U's UI logout cascades the first Auth session/challenge before device cleanup.
// Preserve bounded catalog/Q guards and bind deletion to the independently read-back digest.
import {deviceCleanupSQL as prior} from './email-bounded-http-sql.mjs';
const quote=s=>"'"+s.replaceAll("'","''")+"'",uuid=s=>typeof s==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(s);
export async function fullAppDeviceCleanupSQL(actor,challenge,actors,digest){
 const source=await prior(actor,challenge);if(digest===null||digest===undefined)return source;
 if(!Array.isArray(actors)||actors.length!==4||actors[0].user!==actor.user||actors[0].session!==actor.session||!actors.every(a=>uuid(a.user)&&uuid(a.session))||!actors.slice(0,3).every(a=>a.user===actor.user)||actors[3].user===actor.user||new Set(actors.map(a=>a.session)).size!==4||typeof digest!=='string'||!/^[a-f0-9]{64}$/.test(digest))throw Error('FULL_APP_CLEANUP_BINDING_REQUIRED');
 const start=source.indexOf(' IF NOT EXISTS(SELECT 1 FROM mushavo_email_auth.challenges'),end=source.indexOf(" THEN RAISE EXCEPTION 'EMAIL_J_SELECTED_CHALLENGE_REQUIRED'; END IF;",start);
 if(start<0||end<start)throw Error('FULL_APP_CLEANUP_SOURCE_REQUIRED');
 const original=source.slice(start+' IF NOT '.length,end);
 const restored=actors.slice(1,3).map(a=>quote(a.session)+'::uuid').join(',');
 const afterLocalLogout=`NOT EXISTS(SELECT 1 FROM auth.sessions WHERE id=${quote(actor.session)}::uuid)
 AND NOT EXISTS(SELECT 1 FROM mushavo_email_auth.challenges WHERE id=${quote(challenge)}::uuid)
 AND EXISTS(SELECT 1 FROM mushavo_email_auth.devices d JOIN mushavo_email_auth.session_proofs p ON p.device_id=d.id JOIN auth.sessions s ON s.id=p.session_id AND s.user_id=p.user_id
 WHERE d.user_id=${quote(actor.user)}::uuid AND d.origin_challenge_id=${quote(challenge)}::uuid AND d.credential_digest=${quote(digest)} AND d.revoked_at IS NULL
 AND d.expires_at=d.verified_at+interval '168 hours' AND p.user_id=d.user_id AND p.source='device' AND p.verified_at=d.verified_at AND p.session_id IN (${restored}))`;
 let sql=source.slice(0,start)+` IF NOT ((${original}) OR (${afterLocalLogout}))`+source.slice(end);
 const old=`DELETE FROM mushavo_email_auth.devices WHERE user_id=${quote(actor.user)}::uuid AND origin_challenge_id=${quote(challenge)}::uuid;`;
 if(sql.split(old).length!==2)throw Error('FULL_APP_CLEANUP_DELETE_SOURCE_REQUIRED');
 return sql.replace(old,old.slice(0,-1)+` AND credential_digest=${quote(digest)};`);
}
