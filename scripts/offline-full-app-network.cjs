// New hosted-driver rehearsals: Node may send synthetic password logins only to loopback.
// Browser traffic has its separate per-page/worker policy; this is not an OS sandbox.
const {syncBuiltinESMExports}=require('node:module');
const http=require('node:http'),https=require('node:https');
const denied=()=>{throw Error('OFFLINE_FULL_APP_NETWORK_DISABLED');};
const request=https.request;
globalThis.fetch=denied;http.request=http.get=https.get=denied;
https.request=function(url,options,...args){
 let u;try{u=new URL(url);}catch{return denied();}
 if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||!u.port||Number(u.port)>65535||u.username||u.password||u.hash||u.pathname!=='/auth/v1/token'||u.search!=='?grant_type=password'||options?.method!=='POST'||options?.headers?.apikey!=='sb_publishable_SYNTHETIC')return denied();
 return request.call(this,url,options,...args);
};syncBuiltinESMExports();
