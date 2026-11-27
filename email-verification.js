// Shared browser component. Server proof, never browser flags, authorizes data.
const roles=new Set(['super_admin','admin_staff','finance_staff','support_staff']);
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const messages={managing:'Updating sign-in approvals…',locked:'Verify this sign-in with a code sent to your email.',code:'Enter the six-digit code from your email. It expires after 10 minutes.',authorized:'Sign-in verified.',forbidden:'This account does not have Admin access.',unavailable:'Verification is unavailable. Try again.',loading:'Checking your sign-in…',verifying:'Checking your code…',MAIL_UNAVAILABLE:'Your code could not be sent. Try again later.',RATE_LIMITED:'Too many attempts. Wait before trying again.',COOLDOWN:'Wait a minute before requesting another code.',RATE_LIMIT:'Too many requests. Try again later.',CODE_REJECTED:'The code was not accepted. Check the latest email or request a new code.'};
const waitLimit=(promise,signal)=>new Promise((resolve,reject)=>{
  const stop=()=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);};
  const aborted=()=>{stop();reject(Error('STALE_SESSION'));};
  const timer=setTimeout(()=>{stop();reject(Error('UNAVAILABLE'));},8000);
  if(signal?.aborted){aborted();return;}
  signal?.addEventListener('abort',aborted,{once:true});
  Promise.resolve(promise).then(x=>{stop();resolve(x);},()=>{stop();reject(Error('UNAVAILABLE'));});
});
async function boundedJSON(response){
  if(!response || response.redirected || !/application\/json(?:\s*;|$)/i.test(response.headers.get('content-type')||''))throw Error('UNAVAILABLE');
  if(!response.body)throw Error('UNAVAILABLE');
  const reader=response.body.getReader(),parts=[];let size=0;
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4096)throw Error('UNAVAILABLE');parts.push(value);}}
  finally {try{await reader.cancel();}catch{}reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||Array.isArray(value)||typeof value!=='object')throw Error('UNAVAILABLE');
  return value;
}
// Signup-link trust is enrolled by the server, not by an email-confirmed browser flag.
// One pending-cookie handshake may be followed by one registration POST; transport failures are not retried.
export async function registerConfirmationDevice({client,expectedId,origin=globalThis.location?.origin,fetcher=globalThis.fetch}) {
  const fail=code=>Object.assign(new Error(code),{code});
  const location=new URL(origin);
  if(location.protocol!=='https:'||location.origin!==origin||!uuid.test(expectedId||'')||typeof fetcher!=='function')throw fail('device_trust_unavailable');
  const abort=new AbortController(),signal=abort.signal;
  try {
    const initial=await waitLimit(client.auth.getSession(),signal);
    const token=initial?.data?.session?.access_token;
    if(initial?.error||initial?.data?.session?.user?.id!==expectedId||typeof token!=='string'||!token||token.length>16384)throw fail('session_changed');
    async function current(){
      const value=await waitLimit(client.auth.getSession(),signal);
      if(value?.error||value?.data?.session?.user?.id!==expectedId||value.data.session.access_token!==token)throw fail('session_changed');
      const checked=await waitLimit(client.auth.getUser(),signal);
      if(checked?.error||checked?.data?.user?.id!==expectedId||!checked.data.user.email_confirmed_at)throw fail('session_changed');
    }
    for(let step=0;step<2;step++){
      await current();
      const response=await waitLimit(fetcher(origin+'/api/email-verification/confirm-device',{
        method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal,
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,'X-Mushavo-CSRF':'email-v1'},body:'{}'
      }),signal);
      const value=await waitLimit(boundedJSON(response),signal);
      await current();
      if(response.status!==200)throw fail('device_trust_unavailable');
      if(value.result==='TRUSTED'&&value.persistent===true)return true;
      if(value.result!=='DEVICE_COOKIE_PREPARED'||step!==0)throw fail('device_trust_unavailable');
    }
    throw fail('device_trust_unavailable');
  } catch(error) {throw fail(error?.code==='session_changed'?'session_changed':'device_trust_unavailable');}
  finally {abort.abort();}
}
// Notices only remove local access; no message can establish verification.
export function createVerificationEvents(createChannel){
  const channel=createChannel('mushavo-email-verification-v1'),listeners=new Set();
  const receive=event=>{
    const value=event?.data;
    if(!value||Array.isArray(value)||typeof value!=='object'||Object.keys(value).sort().join(',')!=='kind,userId,version'||value.version!==1||value.kind!=='verification-reset'||typeof value.userId!=='string'||!value.userId||value.userId.length>128)return;
    for(const listener of [...listeners]){try{listener(value.userId);}catch{}}
  };
  channel.addEventListener('message',receive);
  return{
    subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    publish(userId,skip){
      if(typeof userId!=='string'||!userId||userId.length>128)return;
      for(const listener of [...listeners])if(listener!==skip){try{listener(userId);}catch{}}
      try{channel.postMessage({version:1,kind:'verification-reset',userId});}catch{}
    },
    close(){listeners.clear();channel.removeEventListener('message',receive);channel.close();}
  };
}
let browserEvents;
function defaultVerificationEvents(){
  if(typeof window==='undefined'||typeof window.BroadcastChannel!=='function')return null;
  if(browserEvents===undefined){try{browserEvents=createVerificationEvents(name=>new window.BroadcastChannel(name));}catch{browserEvents=null;}}
  return browserEvents;
}
export function createEmailVerification({client,getSession,origin=globalThis.location?.origin,fetcher=globalThis.fetch,requireAdmin=false,onState=()=>{},onUnlocked=()=>{},onInvalidated=()=>{},onReset=()=>{},events=defaultVerificationEvents()}){
  const location=new URL(origin);
  if(location.protocol!=='https:'||location.origin!==origin||typeof fetcher!=='function'||typeof requireAdmin!=='boolean')throw Error('INVALID_CONFIGURATION');
  let identity=null,token=null,epoch=0,serial=0,busy=false,authorized=false,challenge=null,abort=null;
  const emit=(phase,message)=>onState({phase,message:message||messages[phase],busy,authorized,canVerify:!!challenge});
  const current=(e,t)=>e===epoch&&t===token&&getSession()?.user?.id===identity&&getSession()?.access_token===t;
  function invalidate(){authorized=false;challenge=null;serial++;abort?.abort();abort=null;busy=false;onInvalidated();}
  function bind(session){
    const actor=typeof session?.user?.id==='string'?session.user.id:null;
    const bearer=typeof session?.access_token==='string'?session.access_token:null;
    if(actor!==identity||bearer!==token){epoch++;invalidate();identity=actor;token=bearer;emit(actor&&bearer?'loading':'locked');}
  }
  function lock(){epoch++;invalidate();emit('locked');}
  const receiveReset=userId=>{if(userId===getSession()?.user?.id){try{onReset();}finally{lock();}}};
  const stopNotices=events?.subscribe(receiveReset);
  async function rpc(name,signal){
    if(signal.aborted)throw Error('STALE_SESSION');
    const value=await waitLimit(Promise.resolve().then(()=>client.rpc(name)),signal);
    if(!value||typeof value!=='object'||value.error!==null)throw Error('UNAVAILABLE');
    return value.data;
  }
  async function proof(signal){
    const verified=await rpc('email_gate_current_session_verified',signal);
    if(typeof verified!=='boolean')throw Error('UNAVAILABLE');
    if(!verified)return 'locked';
    if(!requireAdmin)return 'authorized';
    const status=await rpc('email_gate_admin_status',signal);
    if(!status||status.contract!==1||typeof status.verified!=='boolean'||typeof status.authorized!=='boolean'||!(status.role===null||roles.has(status.role)))throw Error('UNAVAILABLE');
    if(status.verified!==true)return 'locked';
    return status.authorized===true&&roles.has(status.role)?'authorized':'forbidden';
  }
  async function request(route,body,signal,t){
    if(signal.aborted)throw Error('STALE_SESSION');
    const response=await waitLimit(Promise.resolve().then(()=>fetcher(origin+'/api/email-verification/'+route,{
      method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',signal,
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+t,'X-Mushavo-CSRF':'email-v1'},body:JSON.stringify(body)
    })),signal);
    const value=await waitLimit(boundedJSON(response),signal);
    if(response.status!==200){const key=typeof value.result==='string'?value.result:'';throw Error(Object.hasOwn(messages,key)?key:'UNAVAILABLE');}
    return value;
  }
  async function run(phase,action,{unlock=false}={}){
    bind(getSession());if(busy||!identity||!token)return false;
    const e=epoch,t=token,id=++serial;authorized=false;onInvalidated();busy=true;abort=new AbortController();const signal=abort.signal;emit(phase);
    try {
      const next=await action(signal,t,()=>current(e,t)&&id===serial);
      if(!current(e,t)||id!==serial)return false;
      busy=false;authorized=next==='authorized';if(authorized)challenge=null;emit(next);
      if(authorized&&unlock&&current(e,t)&&id===serial){await onUnlocked({ticket:ticket()});if(!current(e,t)||id!==serial)return false;}
      return authorized;
    }catch(error){
      if(current(e,t)&&id===serial){busy=false;authorized=false;emit(challenge?'code':'unavailable',messages[error.message]||messages.unavailable);}
      return false;
    }finally{if(current(e,t)&&id===serial){busy=false;abort=null;}}
  }
  async function check(){return run('loading',signal=>proof(signal));}
  async function prepare(){return run('loading',async(signal,t)=>{
    const state=await proof(signal);if(state!=='locked')return state;
    const value=await request('restore',{},signal,t);
    if(['VERIFIED','APPROVED'].includes(value.result)){const next=await proof(signal);if(next==='locked')throw Error('UNAVAILABLE');return next;}
    if(value.result!=='CODE_REQUIRED')throw Error('UNAVAILABLE');return 'locked';
  },{unlock:true});}
  async function requestCode(remember=false){
    if(typeof remember!=='boolean')return false;
    return run('loading',async(signal,t,alive)=>{
      challenge=null;const value=await request('begin',{remember},signal,t);
      if(value.result==='VERIFIED'){const next=await proof(signal);if(next==='locked')throw Error('UNAVAILABLE');return next;}
      if(value.result!=='CODE_REQUESTED'||!uuid.test(value.challengeId||'')||!Number.isFinite(Date.parse(value.expiresAt)))throw Error('UNAVAILABLE');
      if(!alive())throw Error('STALE_SESSION');challenge={id:value.challengeId};return 'code';
    },{unlock:true});
  }
  async function verify(code){
    bind(getSession());
    if(typeof code!=='string'||!/^\d{6}$/.test(code)||!challenge)return false;
    const selected=challenge;
    return run('verifying',async(signal,t)=>{
      const value=await request('verify',{challengeId:selected.id,code},signal,t);
      if(value.result!=='VERIFIED')throw Error('CODE_REJECTED');
      const next=await proof(signal);if(next==='locked')throw Error('UNAVAILABLE');return next;
    },{unlock:true});
  }
  async function manageDevice(route,acknowledged){
    bind(getSession());
    if(!['forget','revoke-all'].includes(route)||acknowledged!==true||busy||!authorized||!current(epoch,token))return{result:'VERIFICATION_REQUIRED',verified:false};
    const actor=identity,e=epoch,t=token;
    let attempted=false,result='REVIEW_REQUIRED';
    await run('managing',async(signal,bearer,alive)=>{
      const initial=await proof(signal);if(initial!=='authorized')return initial;
      attempted=true;
      events?.publish(actor,receiveReset);
      const value=await request(route,{},signal,bearer);
      if(!alive())throw Error('STALE_SESSION');
      if(value.result!==(route==='forget'?'FORGOTTEN':'REVOKED'))throw Error('UNAVAILABLE');
      const next=await proof(signal);
      if(!alive())throw Error('STALE_SESSION');
      if(route==='revoke-all'&&next!=='locked')throw Error('UNAVAILABLE');
      result=value.result;return next;
    });
    // Both attempted and uncertain mutations make peer pages discard old data.
    if(attempted)events?.publish(actor,receiveReset);
    if(!current(e,t))return{result:'REVIEW_REQUIRED',verified:false};
    return{result,verified:authorized};
  }
  function ticket(){const e=epoch,t=token,id=serial;return()=>current(e,t)&&id===serial&&authorized;}
  return{bind,lock,check,prepare,requestCode,verify,manageDevice,ticket,dispose(){stopNotices?.();lock();},get authorized(){return authorized&&!!current(epoch,token);},get busy(){return busy;}};
}

// Mount with the owning page's DOM and callbacks; do not store codes or device credentials.
export function attachEmailVerificationView({controller,root,document=root.ownerDocument,onSignOut}){
  root.setAttribute('data-email-verification','');
  let awaitingCode=false;
  const element=(tag,text)=>{const node=document.createElement(tag);if(text)node.textContent=text;return node;};
  const title=element('h1','Verify your sign-in'),message=element('p');message.setAttribute('role','status');message.setAttribute('aria-live','polite');
  const remember=element('input');remember.type='checkbox';remember.checked=true;
  const rememberLabel=element('label');rememberLabel.className='verification-trust-choice';rememberLabel.append(remember,document.createTextNode(' Trust this browser'));
  const explanation=element('p','Trusted browsers do not need another code unless their approval is removed or browser data is cleared.');
  const send=element('button','Send email code');send.type='button';
  const form=element('form'),label=element('label','Email code'),code=element('input');form.className='verification-code-form';
  code.type='text';code.inputMode='numeric';code.pattern='[0-9]{6}';code.maxLength=6;code.autocomplete='one-time-code';code.required=true;label.append(code);
  const verify=element('button','Verify');verify.type='submit';form.append(label,verify);form.hidden=true;
  const retry=element('button','Check again');retry.type='button';const signout=element('button','Sign out');signout.type='button';
  root.replaceChildren(title,message,rememberLabel,explanation,send,form,retry,signout);
  remember.addEventListener('change',()=>{if(awaitingCode){const selected=remember.checked;code.value='';controller.lock();remember.checked=selected;}});
  send.addEventListener('click',()=>{code.value='';void controller.requestCode(remember.checked);});
  retry.addEventListener('click',()=>{code.value='';void controller.prepare();});
  signout.addEventListener('click',()=>{code.value='';remember.checked=false;controller.lock();void onSignOut();});
  form.addEventListener('submit',event=>{event.preventDefault();const value=code.value.trim();code.value='';void controller.verify(value);});
  return state=>{
    const working=['loading','verifying','managing','authorized'].includes(state.phase);
    awaitingCode=state.canVerify;
    root.setAttribute('aria-busy',state.busy?'true':'false');
    message.className=working?'verification-progress':'';
    message.textContent=working?(state.phase==='verifying'?'Checking your code…':state.phase==='managing'?messages.managing:'Signing in…'):(state.message||messages.unavailable);
    for(const node of[title,rememberLabel,explanation,send,retry,signout])node.hidden=working;
    form.hidden=working||!state.canVerify||['forbidden','unavailable','locked'].includes(state.phase);
    if(state.phase!=='code')code.value='';
    if(['locked','authorized','forbidden','unavailable'].includes(state.phase))remember.checked=true;
    send.textContent=state.canVerify?'Send a new code':'Send email code';
    for(const node of[send,retry,verify,remember,code])node.disabled=state.busy||state.authorized||state.phase==='forbidden';
    signout.disabled=false;
  };
}
