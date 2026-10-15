import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,createHash} from 'node:crypto';
import {codeMac,newCode,newChallengeMaterial,deviceDigest,newDeviceMaterial} from '../supabase/functions/_shared/email-verification-crypto.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const base={userId:id(1),sessionId:id(2),challengeId:id(3),keyVersion:'v1',code:'012345',pepper:new Uint8Array(32).fill(42)};
test('WebCrypto code HMAC agrees with an independent native HMAC implementation',async()=>{
 const message=['mushavo-email-v1',base.userId,base.sessionId,base.challengeId,'v1','012345'].join('\0');
 assert.equal(await codeMac(base),createHmac('sha256',base.pepper).update(message).digest('hex'));
});
test('actor, session, challenge, key version and code are each cryptographically bound',async()=>{
 const mac=await codeMac(base);
 for(const change of [{userId:id(4)},{sessionId:id(4)},{challengeId:id(4)},{keyVersion:'v2'},{code:'012346'}])assert.notEqual(await codeMac({...base,...change}),mac);
 assert.equal(await codeMac({...base,userId:base.userId.toUpperCase()}),mac);
});
test('malformed actor/code/key input and weak pepper are rejected with a fixed safe error',async()=>{
 for(const change of [{userId:'other'},{code:'12345'},{code:'1234567'},{code:'      '},{keyVersion:'bad\0v'},{pepper:new Uint8Array(16)},{pepper:'PRIVATE STRING'}])
  await assert.rejects(codeMac({...base,...change}),{message:'EMAIL_CRYPTO_INPUT_REJECTED'});
});
test('six digit codes use cryptographic randomness without Math.random',()=>{
 const previous=Math.random;Math.random=()=>{throw Error('WEAK_RANDOMNESS_USED');};
 try{for(let i=0;i<32;i++)assert(/^\d{6}$/.test(newCode()));}finally{Math.random=previous;}
});
test('new challenge material has an independent ID and a verifiable bound HMAC',async()=>{
 const a=await newChallengeMaterial(base),b=await newChallengeMaterial(base);
 assert.notEqual(a.challengeId,b.challengeId);assert(/^\d{6}$/.test(a.code));
 assert.equal(a.codeMac,await codeMac({...base,challengeId:a.challengeId,code:a.code}));
});
test('device credential is a separate 256-bit value with domain-separated digest',async()=>{
 const a=await newDeviceMaterial(),b=await newDeviceMaterial();assert(/^[A-Za-z0-9_-]{43}$/.test(a.credential));
 assert.equal(Buffer.from(a.credential,'base64url').length,32);assert.notEqual(a.credential,b.credential);
 assert.equal(a.digest,createHash('sha256').update('mushavo-device-v1\0'+a.credential).digest('hex'));
 assert.notEqual(a.digest,createHash('sha256').update(a.credential).digest('hex'));
});
test('malformed remembered credential is refused before hashing',async()=>{
 for(const value of ['',null,'x'.repeat(42),'x'.repeat(44),' '.repeat(43)])await assert.rejects(deviceDigest(value),{message:'EMAIL_CRYPTO_INPUT_REJECTED'});
});
