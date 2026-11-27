// No Playwright dependency. One isolated browser child, loopback CDP only.
import {setTimeout as delay} from 'node:timers/promises';
export class LocalCDP {
 constructor(socket){this.socket=socket;this.sequence=0;this.pending=new Map();
  socket.addEventListener('message',event=>{let x;try{x=JSON.parse(String(event.data));}catch{return this.fail();}if(!Number.isInteger(x.id))return;const p=this.pending.get(x.id);if(!p)return;this.pending.delete(x.id);clearTimeout(p.timer);x.error?p.reject(Error('CDP_COMMAND_REQUIRED')):p.resolve(x.result??{});});
  socket.addEventListener('close',()=>this.fail());socket.addEventListener('error',()=>this.fail());
 }
 fail(){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(Error('CDP_CONNECTION_REQUIRED'));}this.pending.clear();}
 static async connect(url,{Socket=WebSocket,timeout=10000}={}){
  if(typeof url!=='string'||!/^ws:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/devtools\/browser\/[A-Za-z0-9-]+$/.test(url))throw Error('LOOPBACK_CDP_REQUIRED');
  const parsed=new URL(url);if(Number(parsed.port)>65535)throw Error('LOOPBACK_CDP_REQUIRED');
  const socket=new Socket(url),client=new LocalCDP(socket);
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{socket.close();reject(Error('CDP_CONNECT_TIMEOUT'));},timeout);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP_CONNECT_REQUIRED'));},{once:true});});return client;
 }
 call(method,params={},sessionId,timeout=15000){return new Promise((resolve,reject)=>{const id=++this.sequence,timer=setTimeout(()=>{this.pending.delete(id);reject(Error('CDP_COMMAND_TIMEOUT'));},timeout);this.pending.set(id,{resolve,reject,timer});try{this.socket.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));}catch{clearTimeout(timer);this.pending.delete(id);reject(Error('CDP_SEND_REQUIRED'));}});}
 close(){this.fail();this.socket.close();}
}
export async function until(check,{timeout=15000}={}){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(100);}throw Error('BROWSER_CHECK_TIMEOUT');}
export async function evaluate(cdp,session,expression){const x=await cdp.call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);if(x.exceptionDetails||!x.result||x.result.subtype==='error')throw Error('BROWSER_EVALUATION_REQUIRED');return x.result.value;}
