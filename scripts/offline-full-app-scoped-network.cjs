// Scoped local integration: only the three synthetic Auth endpoints on loopback.
const {syncBuiltinESMExports}=require('node:module');
const http=require('node:http'),https=require('node:https'),original=https.request;
const denied=()=>{throw Error('OFFLINE_SCOPED_NETWORK_DISABLED');};
globalThis.fetch=denied;http.request=http.get=https.get=denied;
https.request=function(value,options,...args){let u;try{u=new URL(value);}catch{return denied();}if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||!u.port||Number(u.port)>65535||u.username||u.password||u.hash||options?.headers?.apikey!=='sb_publishable_SYNTHETIC')return denied();const bearer=options.headers.Authorization||options.headers.authorization,login=u.pathname==='/auth/v1/token'&&u.search==='?grant_type=password'&&options.method==='POST',identity=u.pathname==='/auth/v1/user'&&!u.search&&options.method==='GET',logout=u.pathname==='/auth/v1/logout'&&u.search==='?scope=local'&&options.method==='POST';if(!login&&!(identity||logout)||!login&&!(typeof bearer==='string'&&bearer.startsWith('Bearer ')&&bearer.endsWith('.U1lOVEhFVElD')))return denied();return original.call(this,value,options,...args);};syncBuiltinESMExports();
