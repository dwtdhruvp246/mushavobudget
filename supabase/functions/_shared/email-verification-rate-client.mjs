import {requireGate,upstreamJSON} from './email-verification-http.mjs';
// Canonicalise trusted Cloudflare ingress addresses before deriving a private object name.
export function canonicalIP(value) {
  requireGate(typeof value==='string'&&value.length<=64);
  const ipv4=s=>{
    requireGate(/^\d{1,3}(?:\.\d{1,3}){3}$/.test(s));
    const octets=s.split('.').map(Number);requireGate(octets.every(n=>n<=255));return octets;
  };
  if(!value.includes(':'))return 'v4:'+ipv4(value).join('.');
  let raw=value.toLowerCase();requireGate(/^[0-9a-f:.]+$/.test(raw));
  if(raw.includes('.')) {
    const colon=raw.lastIndexOf(':'),v=ipv4(raw.slice(colon+1));
    raw=raw.slice(0,colon+1)+((v[0]<<8)|v[1]).toString(16)+':'+((v[2]<<8)|v[3]).toString(16);
  }
  const sides=raw.split('::');requireGate(sides.length<=2);
  const parts=s=>s?s.split(':'):[];
  const left=parts(sides[0]),right=sides.length===2?parts(sides[1]):[];
  requireGate([...left,...right].every(x=>/^[0-9a-f]{1,4}$/.test(x)));
  requireGate(sides.length===1?left.length===8:left.length+right.length<8);
  const words=[...left,...Array(sides.length===1?0:8-left.length-right.length).fill('0'),...right].map(x=>parseInt(x,16));
  requireGate(words.length===8);
  if(words.slice(0,5).every(x=>x===0)&&words[5]===65535)return 'v4:'+[(words[6]>>8),words[6]&255,words[7]>>8,words[7]&255].join('.');
  return 'v6:'+words.map(n=>n.toString(16).padStart(4,'0')).join(':');
}
export async function rateObjectName(ip,pepperHex) {
  requireGate(typeof pepperHex==='string'&&/^[a-f0-9]{64}$/.test(pepperHex));
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(pepperHex.match(/../g),x=>parseInt(x,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signature=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode('mushavo-email-ip-v1\0'+canonicalIP(ip)));
  return 'email-ip-v1:'+Array.from(new Uint8Array(signature),n=>n.toString(16).padStart(2,'0')).join('');
}
export function durableRatePort(namespace,pepperHex) {
  requireGate(typeof namespace?.idFromName==='function'&&typeof namespace?.get==='function'
    &&typeof pepperHex==='string'&&/^[a-f0-9]{64}$/.test(pepperHex));
  return {async limit({key}) {
    requireGate(typeof key==='string'&&key.startsWith('mushavo-email:'));
    const name=await rateObjectName(key.slice('mushavo-email:'.length),pepperHex);
    const stub=namespace.get(namespace.idFromName(name));requireGate(typeof stub?.fetch==='function');
    const result=await upstreamJSON((url,init)=>stub.fetch(url,init),'https://email-rate.internal/check',{
      method:'POST',headers:{'content-type':'application/json','x-mushavo-internal':'email-rate-v1'},body:'{}'
    },1024);
    requireGate(typeof result?.success==='boolean');return {success:result.success};
  }};
}
