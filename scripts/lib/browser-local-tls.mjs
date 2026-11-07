// Ephemeral loopback-only test certificate; generated in memory, never stored or used by staging.
import {generateKeyPairSync,sign,randomBytes} from 'node:crypto';
const der=(tag,...parts)=>{const body=Buffer.concat(parts.map(x=>Buffer.isBuffer(x)?x:Buffer.from(x))),n=body.length;const length=n<128?Buffer.from([n]):(()=>{let hex=n.toString(16);if(hex.length%2)hex='0'+hex;const b=Buffer.from(hex,'hex');return Buffer.concat([Buffer.from([128+b.length]),b]);})();return Buffer.concat([Buffer.from([tag]),length,body]);};
const seq=(...x)=>der(0x30,...x),oid=hex=>der(6,Buffer.from(hex,'hex'));
export function localTLS(){
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const algorithm=seq(oid('2a864886f70d01010b'),der(5,Buffer.alloc(0)));
 const name=seq(der(0x31,seq(oid('550403'),der(12,'localhost'))));
 const san=seq(oid('551d11'),der(4,seq(der(0x82,'localhost'),der(0x87,Buffer.from([127,0,0,1])))));
 const body=seq(der(0xa0,der(2,Buffer.from([2]))),der(2,Buffer.concat([Buffer.from([1]),randomBytes(15)])),algorithm,name,
  seq(der(0x18,'20200101000000Z'),der(0x18,'21000101000000Z')),name,publicKey.export({type:'spki',format:'der'}),der(0xa3,seq(san)));
 const certificate=seq(body,algorithm,der(3,Buffer.concat([Buffer.from([0]),sign('RSA-SHA256',body,privateKey)])));
 return {key:privateKey.export({type:'pkcs8',format:'pem'}),cert:'-----BEGIN CERTIFICATE-----\n'+certificate.toString('base64').match(/.{1,64}/g).join('\n')+'\n-----END CERTIFICATE-----\n'};
}
