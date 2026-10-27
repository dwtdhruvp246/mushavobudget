import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as security from '../../auth-security.js';
import {createAuthCallbackEntry} from '../../session-entry.js';
import {registerConfirmationDevice} from '../../email-verification.js';
const source=(await readFile(new URL('../../auth-flows.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',foreign='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',invitation='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const tick=()=>new Promise(r=>setImmediate(r));
class Element {
 constructor(tag,document){this.tag=tag;this.ownerDocument=document;this.children=[];this.events={};this.hidden=true;this.value='';this.checked=false;this.disabled=false;}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}setAttribute(k,v){this[k]=v;}addEventListener(k,fn){this.events[k]=fn;}
}
export function securityPageFixture(flow='recover',options={}){
 const calls=[],navigations=[],proofs=new Map(),nodes={},clients=[],removed=[],user={id,email:'owner@example.invalid',email_confirmed_at:'2026-10-16T00:00:00Z'};
 let linkError=options.linkError??null,invited=options.invited??true,proofOverride=null,unfinishedError=null,normalAdoptError=null,verifyResult=null;
 const doc={createElement:tag=>new Element(tag,doc),createTextNode:text=>({textContent:text}),querySelector:selector=>nodes[selector.slice(1)],querySelectorAll:()=>[]};
 for(const name of['securityMessage','securityTitle','securityIdentity','securityRequest','securityEmail','securityPassword','securityContinue','securitySelfSignup','securityEmailVerification','securityNonceLabel','securityRequestCode','securityCurrentLabel','securityNewPassword','securityConfirmPassword','securityNonce','securityCurrentPassword','securityAcknowledge','securityOpen','securityCancel','securityResume','securityDeviceControls','securityDeviceAcknowledge','securityForgetDevice','securityRevokeAll','securityTrustRetry'])nodes[name]=new Element('section',doc);
 nodes.securityPassword.reset=()=>{for(const n of['securityNewPassword','securityConfirmPassword','securityNonce','securityCurrentPassword'])nodes[n].value='';};
 function newClient(kind){
  let session=kind==='normal'||kind==='snapshot'?{user,access_token:'original',refresh_token:'refresh'}:null;const listeners=[];
  const emit=(event,next)=>{session=next;for(const fn of listeners)fn(event,next);};
  const client={kind,emit,get session(){return session;},auth:{
   onAuthStateChange(fn){listeners.push(fn);return{data:{subscription:{unsubscribe(){const i=listeners.indexOf(fn);if(i>=0)listeners.splice(i,1);}}}};},
   async getSession(){return{data:{session},error:null};},async getUser(){return session?{data:{user:session.user},error:null}:{data:null,error:{code:'session_not_found'}};},
   async setSession(tokens){calls.push(kind+':adopt');if(kind==='normal'&&normalAdoptError)return{error:normalAdoptError};if(linkError)return{error:linkError};emit('SIGNED_IN',{user,access_token:tokens.access_token,refresh_token:tokens.refresh_token});return{data:{session},error:null};},
   async updateUser(){calls.push(kind+':password');proofs.set(session.access_token,false);return{error:null};},
   async verifyOtp(){return this.setSession({access_token:'link-token',refresh_token:'link-refresh'});},async exchangeCodeForSession(){return this.verifyOtp();},
   async reauthenticate(){calls.push(kind+':password-code');return{error:null};},async signOut(){calls.push(kind+':logout');emit('SIGNED_OUT',null);return{error:null};},async stopAutoRefresh(){calls.push(kind+':stop-refresh');},
   async resend(){calls.push('confirmation-link');return{error:null};},async resetPasswordForEmail(){calls.push('recovery-link');return{error:null};}
  },async rpc(name){calls.push(name);if(name==='email_gate_current_session_verified')return proofOverride??{data:proofs.get(session?.access_token)===true,error:null};if(name==='get_my_business_invitations')return{data:invited?[{invitation_id:invitation,status:'pending',expires_at:'2099-01-01',workspace_name:'Controlled Business'}]:[],error:null};if(name==='has_my_unfinished_admin_invitation')return{data:options.unfinished??false,error:unfinishedError};throw Error('UNEXPECTED_RPC');}};
  clients.push(client);return client;
 }
 const win={location:{href:'https://mushavo-budget-staging.pages.dev/auth.html?flow='+flow+'&invitation='+invitation+'#access_token=link-token&refresh_token=link-refresh&type='+(flow==='recover'?'recovery':flow==='confirm'?'signup':flow==='business-new'?'invite':'magiclink'),origin:'https://mushavo-budget-staging.pages.dev',replace:x=>navigations.push(x)},history:{replaceState(){calls.push('strip-url');}},sessionStorage:{removeItem:x=>removed.push(x)},MUSHAVO_BUDGET_CONFIG:{supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'synthetic-publishable'},
 async fetch(url,init){const action=url.split('/').at(-1);calls.push('gateway:'+action);if(action==='confirm-device'){if(options.failDeviceTrust)return json({result:'UNAVAILABLE'},503);if(options.prepareDeviceCookie&&calls.filter(x=>x==='gateway:confirm-device').length===1)return json({result:'DEVICE_COOKIE_PREPARED'});return json({result:'TRUSTED',persistent:true});}if(action==='restore')return json({result:options.restoreApproved?'APPROVED':'CODE_REQUIRED'});if(action==='begin')return json({result:'CODE_REQUESTED',challengeId:'00000000-0000-4000-8000-000000000123',expiresAt:'2099-01-01'});if(action==='forget'||action==='revoke-all'){if(options.failActions)throw Error('PRIVATE_PROVIDER_ERROR');if(action==='revoke-all'||options.forgetInvalidates)proofs.set(init.headers.Authorization.slice('Bearer '.length),false);return json({result:action==='forget'?'FORGOTTEN':'REVOKED'});}if(action==='verify'){assert.equal(JSON.parse(init.body).code,'123456');if(verifyResult)return json({result:verifyResult});proofs.set(init.headers.Authorization.slice('Bearer '.length),true);return json({result:'VERIFIED'});}throw Error('UNEXPECTED_GATEWAY');}};
 if(options.noTokens)win.location.href=win.location.href.split('#')[0];
 const context={...security,registerConfirmationDevice,createAuthCallbackEntry:opts=>createAuthCallbackEntry({...opts,events:options.events}),createClient:(u,k,o)=>newClient(o.auth.storageKey?'isolated':o.auth.persistSession===false?'snapshot':'normal'),window:win,document:doc,URL,Date,Promise};
 vm.createContext(context);vm.runInContext(source,context);
 function all(){const a=[];function visit(n){a.push(n);for(const c of n.children||[])visit(c);}visit(nodes.securityEmailVerification);return a;}
 async function code(){const send=all().find(x=>x.textContent==='Send email code');assert(send&&!send.disabled);send.events.click();await tick();const input=all().find(x=>x.autocomplete==='one-time-code'),form=all().find(x=>x.tag==='form');input.value='123456';form.events.submit({preventDefault(){}});await tick();await tick();if(!verifyResult)assert.equal(input.value,'');}
 async function save(){nodes.securityNewPassword.value='new-private-password';nodes.securityConfirmPassword.value='new-private-password';nodes.securityPassword.events.submit({preventDefault(){}});await tick();await tick();}
 async function open(){nodes.securityAcknowledge.checked=true;nodes.securityOpen.events.click();await tick();await tick();}
 return{actor:id,calls,clients,nodes,navigations,removed,context,all,code,save,open,proof:x=>proofOverride=x,unfinishedError:x=>unfinishedError=x,linkError:x=>linkError=x,normalAdoptError:x=>normalAdoptError=x,verifyResult:x=>verifyResult=x,invited:x=>invited=x,ready:async()=>{await tick();await tick();}};
}
const json=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});
// Explicit transport passed to the real component; the default Node network stays disabled.
