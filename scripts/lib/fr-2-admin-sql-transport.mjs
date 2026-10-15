// Bytes only. No SQL execution, clipboard operation, Auth or network access.
import {createHash} from 'node:crypto';
const sha256=b=>createHash('sha256').update(b).digest('hex');
export function normalizeReviewedAdminSql(bytes,reviewed){
 if(!Buffer.isBuffer(bytes)||!reviewed||!['lf_sha256','crlf_sha256'].every(k=>/^[0-9a-f]{64}$/.test(reviewed[k]||'')))throw Error('ADMIN_SQL_TRANSPORT_CONTRACT_REQUIRED');
 const observed=sha256(bytes);
 if(observed!==reviewed.lf_sha256&&observed!==reviewed.crlf_sha256)throw Error('ADMIN_SQL_UNREVIEWED_BYTES');
 const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
 const normalized=Buffer.from(text.replace(/\r\n/g,'\n'),'utf8');
 if(sha256(normalized)!==reviewed.lf_sha256||normalized.length!==reviewed.lf_bytes)throw Error('ADMIN_SQL_NORMALIZED_BYTES_MISMATCH');
 return normalized;
}
