// Server-only material. Callers must never log returned codes or credentials.
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const enc=new TextEncoder();
const need=ok=>{if(!ok)throw new Error('EMAIL_CRYPTO_INPUT_REJECTED');};
const hex=bytes=>Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
export async function codeMac({userId,sessionId,challengeId,keyVersion,code,pepper}) {
 need(uuid.test(userId||'')&&uuid.test(sessionId||'')&&uuid.test(challengeId||'')
  &&/^[A-Za-z0-9_-]{1,32}$/.test(keyVersion||'')&&/^\d{6}$/.test(code||'')
  &&pepper instanceof Uint8Array&&pepper.length>=32&&pepper.length<=64);
 const key=await crypto.subtle.importKey('raw',pepper,{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const message=['mushavo-email-v1',userId.toLowerCase(),sessionId.toLowerCase(),challengeId.toLowerCase(),keyVersion,code].join('\0');
 return hex(await crypto.subtle.sign('HMAC',key,enc.encode(message)));
}
export function newCode() {
 const values=new Uint32Array(1),limit=Math.floor(4294967296/1000000)*1000000;
 do {crypto.getRandomValues(values);}while(values[0]>=limit);
 return String(values[0]%1000000).padStart(6,'0');
}
export async function newChallengeMaterial({userId,sessionId,keyVersion,pepper}) {
 const challengeId=crypto.randomUUID(),code=newCode();
 return {challengeId,code,keyVersion,codeMac:await codeMac({userId,sessionId,challengeId,keyVersion,code,pepper})};
}
export async function deviceDigest(credential) {
 need(typeof credential==='string'&&/^[A-Za-z0-9_-]{43}$/.test(credential));
 return hex(await crypto.subtle.digest('SHA-256',enc.encode('mushavo-device-v1\0'+credential)));
}
export async function newDeviceMaterial() {
 const bytes=crypto.getRandomValues(new Uint8Array(32));
 const credential=btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
 return {credential,digest:await deviceDigest(credential)};
}
