import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalIP,rateObjectName,durableRatePort} from '../supabase/functions/_shared/email-verification-rate-client.mjs';
const pepper='3a'.repeat(32);
test('IPv4 alternate formatting maps to one canonical identity',()=>{assert.equal(canonicalIP('192.000.002.001'),'v4:192.0.2.1');});
test('Compressed and full IPv6 forms map to one identity',()=>{assert.equal(canonicalIP('2001:DB8::1'),canonicalIP('2001:0db8:0:0:0:0:0:1'));});
test('IPv4-mapped IPv6 shares the IPv4 quota identity',()=>{assert.equal(canonicalIP('::ffff:192.0.2.1'),canonicalIP('192.0.2.1'));assert.equal(canonicalIP('::ffff:c000:201'),canonicalIP('192.0.2.1'));});
for(const bad of ['256.0.0.1','1.2.3',':::1','1:2:3:4:5:6:7','1:2:3:4:5:6:7:8::','fe80::1%eth0'])test('Malformed ingress address is denied: '+bad,()=>assert.throws(()=>canonicalIP(bad)));
test('Object names use domain-separated keyed hashes with no raw address',async()=>{
 const a=await rateObjectName('2001:db8::1',pepper),b=await rateObjectName('2001:0db8:0:0:0:0:0:1',pepper);
 assert.equal(a,b);assert.match(a,/^email-ip-v1:[a-f0-9]{64}$/);assert(!a.includes('2001:db8'));
 assert.notEqual(a,await rateObjectName('2001:db8::1','3b'.repeat(32)));assert.notEqual(a,await rateObjectName('2001:db8::2',pepper));
});
test('Actual port forwards only a fixed empty request to the hashed namespace',async()=>{
 let name;
 const port=durableRatePort({idFromName(x){name=x;return x;},get(id){assert.equal(id,name);return{async fetch(url,init){
  assert.equal(url,'https://email-rate.internal/check');assert.equal(init.body,'{}');assert.equal(init.redirect,'manual');
  assert(!JSON.stringify(init).includes('192.0.2.1'));assert(!init.headers.authorization);assert(!init.headers.cookie);
  return new Response('{"success":true}',{headers:{'content-type':'application/json'}});
 }};}},pepper);
 assert.deepEqual(await port.limit({key:'mushavo-email:192.0.2.1'}),{success:true});assert.match(name,/^email-ip-v1:/);
});
test('Missing namespace and malformed rate secrets fail closed',()=>{
 assert.throws(()=>durableRatePort({},pepper));assert.throws(()=>durableRatePort({idFromName(){},get(){}},'weak'));
});
for(const [name,response]of [['malformed boolean',()=>new Response('{"success":"true"}',{headers:{'content-type':'application/json'}})],['redirect',()=>new Response(null,{status:302,headers:{location:'https://foreign.invalid'}})],['HTML',()=>new Response('<html>',{headers:{'content-type':'text/html'}})]])test('Limiter '+name+' cannot silently approve a request',async()=>{
 const port=durableRatePort({idFromName:x=>x,get:()=>({fetch:async()=>response()})},pepper);await assert.rejects(port.limit({key:'mushavo-email:192.0.2.1'}));
});
