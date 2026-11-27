const adminRoles=new Set(['super_admin','admin_staff','finance_staff','support_staff']);
const policy='PASSWORD_ONLY_ALL_USERS';
// This checks server authorization for the same current Auth actor/token.
// It never sends mail, reads a browser approval, or grants access from local flags.
export function createSessionAccess({client,getSession,requireAdmin=false,onState=()=>{},onUnlocked=()=>{},onInvalidated=()=>{},onReset=()=>{}}){
  let actor=null,token=null,epoch=0,serial=0,busy=false,authorized=false,abort=null;
  const current=(e,t)=>e===epoch&&t===token&&getSession()?.user?.id===actor&&getSession()?.access_token===t;
  const emit=(phase,message)=>onState({phase,message,busy,authorized});
  function invalidate(){serial++;abort?.abort();abort=null;busy=false;authorized=false;onInvalidated();}
  function bind(session){
    const id=typeof session?.user?.id==='string'?session.user.id:null,bearer=typeof session?.access_token==='string'?session.access_token:null;
    if(id!==actor||bearer!==token){epoch++;invalidate();actor=id;token=bearer;emit(id&&bearer?'loading':'unavailable','Please sign in to continue.');}
  }
  function lock(){epoch++;invalidate();onReset();emit('unavailable','Your sign-in needs to be checked again.');}
  function ticket(){const e=epoch,t=token,id=serial;return()=>current(e,t)&&id===serial&&authorized;}
  async function prepare(){
    bind(getSession());if(busy||!actor||!token)return false;
    const e=epoch,t=token,id=++serial;authorized=false;onInvalidated();busy=true;abort=new AbortController();const requestAbort=abort,signal=abort.signal;
    emit('loading','Signing in…');let timer,removeAbort;
    try{
      const response=await Promise.race([
        Promise.resolve().then(()=>{const request=client.rpc('app_session_status');return typeof request?.abortSignal==='function'?request.abortSignal(signal):request;}),
        new Promise((_,reject)=>{
          const cancel=()=>reject(Error('STALE_SESSION'));signal.addEventListener('abort',cancel,{once:true});removeAbort=()=>signal.removeEventListener('abort',cancel);
          timer=setTimeout(()=>{reject(Error('SESSION_UNAVAILABLE'));requestAbort.abort();},8000);
        })
      ]);
      if(!current(e,t)||id!==serial)return false;
      const s=response?.data;
      if(response?.error!==null||!s||Array.isArray(s)||Object.keys(s).sort().join(',')!=='admin_authorized,contract,policy,role,session_valid'
        ||s.contract!==1||s.policy!==policy||typeof s.session_valid!=='boolean'||typeof s.admin_authorized!=='boolean'
        ||!(s.role===null||adminRoles.has(s.role))||s.admin_authorized!==(s.session_valid&&adminRoles.has(s.role))
        ||(!s.session_valid&&s.role!==null))throw Error('SESSION_UNAVAILABLE');
      if(!s.session_valid)throw Error('SESSION_REQUIRED');
      busy=false;authorized=!requireAdmin||s.admin_authorized;
      emit(authorized?'authorized':'forbidden',authorized?'Signed in.':'This account cannot open Admin tools.');
      if(authorized&&current(e,t)&&id===serial)await onUnlocked({ticket:ticket()});
      return authorized&&current(e,t)&&id===serial;
    }catch(error){
      if(current(e,t)&&id===serial){busy=false;authorized=false;onInvalidated();emit('unavailable',error?.message==='SESSION_REQUIRED'?'This account or session is unavailable. Sign in again.':'Your sign-in could not be checked. Try again.');}
      return false;
    }finally{
      clearTimeout(timer);removeAbort?.();
      if(current(e,t)&&id===serial){busy=false;abort=null;}
    }
  }
  return{bind,lock,prepare,ticket,dispose(){epoch++;invalidate();},get authorized(){return authorized&&!!current(epoch,token);},get busy(){return busy;}};
}
export function attachSessionAccessView({controller,root,onSignOut}){
  const document=root.ownerDocument,element=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  const title=element('h1','Unable to open your account'),message=element('p','Please try again.'),retry=element('button','Try again'),signout=element('button','Sign out');
  message.setAttribute('role','status');message.setAttribute('aria-live','polite');retry.type=signout.type='button';
  root.replaceChildren(title,message,retry,signout);retry.addEventListener('click',()=>{void controller.prepare();});signout.addEventListener('click',()=>{controller.lock();void onSignOut();});
  return s=>{root.setAttribute('aria-busy',s.busy?'true':'false');message.textContent=s.message||'Please try again.';title.hidden=retry.hidden=signout.hidden=s.phase==='loading'||s.phase==='authorized';retry.disabled=s.busy;signout.disabled=false;};
}
export function createSessionEntry({client,getSession,root,requireAdmin=false,retainViewDuringCheck=false,show,onInvalidated,onUnlocked,onSignOut,onReset}){
  let checking=0,retaining=false,render=()=>{},pending=null,pendingActor=null,pendingToken=null,boundActor=null,boundToken=null;
  const controller=createSessionAccess({client,getSession,requireAdmin,onReset,
    onState:value=>{if(retaining&&value.phase==='loading')return;if(retaining&&!value.authorized)onInvalidated();render(value);if(!value.authorized&&getSession())show(value);},
    onInvalidated:()=>{if(!retaining)onInvalidated();},
    onUnlocked:async({ticket})=>{if(!checking&&ticket())await onUnlocked({ticket});}
  });
  render=attachSessionAccessView({controller,root,onSignOut});
  function bind(session){
    const actor=session?.user?.id||null,token=session?.access_token||null;
    if(actor!==boundActor||token!==boundToken)retaining=false;
    controller.bind(session);boundActor=actor;boundToken=token;
  }
  function perform(force){
    const session=getSession(),actor=session?.user?.id,token=session?.access_token;
    if(pending&&(actor!==pendingActor||token!==pendingToken))retaining=false;
    bind(session);if(pending&&actor===pendingActor&&token===pendingToken)return pending;
    if(!force&&controller.authorized)return Promise.resolve(true);
    retaining=force&&retainViewDuringCheck&&controller.authorized;checking++;pendingActor=actor;pendingToken=token;
    const task=Promise.resolve().then(()=>controller.prepare()).finally(()=>{checking--;if(pending===task){pending=null;retaining=false;}});
    pending=task;return task;
  }
  return{bind,lock:()=>{retaining=false;controller.lock();},ticket:()=>controller.ticket(),ensure:()=>perform(false),recheck:()=>perform(true),dispose:()=>controller.dispose(),get authorized(){return controller.authorized;},get busy(){return controller.busy;}};
}

// Restore original nodes so their listeners survive; remove generated private content.
export function snapshotPrivateView(node){
  const children=[...node.childNodes].map(snapshotPrivateView),originals=[...node.childNodes];
  const attributes=node.nodeType===1?[...node.attributes].map(a=>[a.name,a.value]):null;
  const text=node.nodeType===3?node.nodeValue:null;
  const selectedIndex=node.nodeType===1&&node.tagName==='SELECT'&&!node.multiple?node.selectedIndex:null;
  return()=>{
    if(attributes){for(const a of [...node.attributes])node.removeAttribute(a.name);for(const [name,value]of attributes)node.setAttribute(name,value);
      // Only text/input controls expose defaultValue. Option/button value is
      // an HTML attribute and must retain its restored source value.
      if('defaultValue'in node)node.value=node.defaultValue||'';if('checked'in node)node.checked=node.defaultChecked===true;}
    if(text!==null)node.nodeValue=text;node.replaceChildren?.(...originals);for(const restore of children)restore();
    if('defaultSelected'in node)node.selected=node.defaultSelected===true;
    if(selectedIndex!==null)node.selectedIndex=selectedIndex;
  };
}

// Callback operations retain identity isolation and check the normal server session.
// This adapter never adopts a session or requests any sign-in code.
export function createAuthCallbackEntry({client,root,origin,fetcher,show,onInvalidated,onSignOut,onVerified=async()=>{},events}) {
  let session=null,pending=null,generation=0,disposed=false;
  const changed=()=>Object.assign(new Error('session_changed'),{code:'session_changed'});
  function rejectPending(){const waiting=pending;pending=null;if(waiting)waiting.reject(changed());}
  const entry=createSessionEntry({client,getSession:()=>session,root,origin,fetcher,events,show:state=>{if(pending)show(state);},
    onInvalidated:()=>onInvalidated?.(),
    onUnlocked:async({ticket})=>{const waiting=pending;if(waiting&&ticket()&&session?.user?.id===waiting.actor){pending=null;root.hidden=true;waiting.resolve();}else if(!waiting&&ticket())await onVerified({ticket});},
    onSignOut:async()=>{cancel();await onSignOut();}
  });
  const subscription=client.auth.onAuthStateChange((event,next)=>{
    if(disposed||event==='INITIAL_SESSION')return;
    const replacement=next?.user?.id!==session?.user?.id||next?.access_token!==session?.access_token;
    session=next;
    if(replacement){generation++;rejectPending();entry.bind(next);root.hidden=true;onInvalidated?.();}
  }).data?.subscription;
  function cancel(){generation++;rejectPending();session=null;entry.bind(null);root.hidden=true;}
  return {
    async require(actor){
      if(disposed)throw changed();
      const epoch=generation,current=await client.auth.getSession();
      if(disposed||epoch!==generation||current.error||current.data?.session?.user?.id!==actor)throw changed();
      session=current.data.session;entry.bind(session);
      if(pending)throw changed();
      // Register before checking: a user can complete the screen immediately.
      let resolve,reject;const approved=new Promise((yes,no)=>{resolve=yes;reject=no;});
      const waiting={actor,resolve,reject};pending=waiting;
      // Attach the rejection handler before any asynchronous check can cancel it.
      const completion=approved.then(()=>true);
      completion.catch(()=>{});
      try {
        // A current actor/token-bound ticket can finish this callback without
        // repeating prepare(). Its caller still checks the remote user and SQL
        // application proof before adopting or opening the account.
        if(await entry.ensure()){
          if(pending===waiting){pending=null;root.hidden=true;resolve();}
        }
      }catch(error){if(pending===waiting){pending=null;reject(error);}}
      await completion;
      if(disposed||epoch!==generation||!entry.authorized||session?.user?.id!==actor)throw changed();
    },
    cancel,lock:()=>entry.lock(),
    dispose(){disposed=true;cancel();entry.dispose();subscription?.unsubscribe();}
  };
}
