import {createEmailVerification,attachEmailVerificationView} from './email-verification.js?v=2';

// The owning page clears models/DOM before a proof change and checks tickets
// after asynchronous work. Opening this view never sends mail automatically.
export function createSessionEntry({client,getSession,root,origin=globalThis.location?.origin,fetcher=globalThis.fetch,requireAdmin=false,retainViewDuringCheck=false,show,onInvalidated,onUnlocked,onSignOut,onReset,events}){
  let checking=0,retaining=false,render=()=>{},controller,pending=null,pendingActor=null,pendingToken=null,boundActor=null,boundToken=null;
  try{
    controller=createEmailVerification({client,getSession,origin,fetcher,requireAdmin,events,onReset,
      onState:value=>{if(retaining&&value.phase==='loading')return;if(retaining&&!value.authorized)onInvalidated();render(value);if(!value.authorized&&getSession())show();},
      onInvalidated:()=>{if(!retaining)onInvalidated();},
      onUnlocked:async({ticket})=>{if(!checking&&ticket())await onUnlocked({ticket});}
    });
  }catch{
    // Deferred native clients or unsupported origins must stop visibly, not skip verification.
    controller={bind(){onInvalidated();},lock(){onInvalidated();},async prepare(){show();render({phase:'unavailable',busy:false,authorized:false,canVerify:false,message:'Verification is unavailable in this version. Open the Mushavo Budget website to continue.'});return false;},requestCode:async()=>false,verify:async()=>false,manageDevice:async()=>({result:'VERIFICATION_REQUIRED',verified:false}),dispose(){},ticket:()=>()=>false,authorized:false,busy:false};
  }
  render=attachEmailVerificationView({controller,root,onSignOut});
  function bind(session){
    const actor=session?.user?.id||null,token=session?.access_token||null;
    if(actor!==boundActor||token!==boundToken)retaining=false;
    controller.bind(session);boundActor=actor;boundToken=token;
  }
  function perform(force){
    const session=getSession(),actor=session?.user?.id,token=session?.access_token;
    if(pending&&(actor!==pendingActor||token!==pendingToken))retaining=false;
    bind(session);
    if(pending&&actor===pendingActor&&token===pendingToken)return pending;
    if(!force&&controller.authorized)return Promise.resolve(true);
    retaining=force&&retainViewDuringCheck&&controller.authorized;checking++;pendingActor=actor;pendingToken=token;
    const task=Promise.resolve().then(()=>controller.prepare()).finally(()=>{checking--;if(pending===task){pending=null;retaining=false;}});
    pending=task;return task;
  }
  return {
    bind,lock:()=>{retaining=false;controller.lock();},ticket:()=>controller.ticket(),
    ensure:()=>perform(false),recheck:()=>perform(true),manageDevice:(route,ack)=>controller.manageDevice(route,ack),dispose:()=>controller.dispose(),
    get authorized(){return controller.authorized;},get busy(){return controller.busy;}
  };
}

// Restore original nodes so their listeners survive; remove generated private content.
export function snapshotPrivateView(node){
  const children=[...node.childNodes].map(snapshotPrivateView),originals=[...node.childNodes];
  const attributes=node.nodeType===1?[...node.attributes].map(a=>[a.name,a.value]):null;
  const text=node.nodeType===3?node.nodeValue:null;
  return()=>{
    if(attributes){for(const a of [...node.attributes])node.removeAttribute(a.name);for(const [name,value]of attributes)node.setAttribute(name,value);
      if('value'in node)node.value=node.defaultValue||'';if('checked'in node)node.checked=node.defaultChecked===true;}
    if(text!==null)node.nodeValue=text;node.replaceChildren?.(...originals);for(const restore of children)restore();
  };
}

// Callback pages can pause a protected step while the user enters a code. This
// adapter never sends a code by opening the screen, and never adopts a session.
export function createAuthCallbackEntry({client,root,origin,fetcher,show,onInvalidated,onSignOut,onVerified=async()=>{},events}) {
  let session=null,pending=null,generation=0,disposed=false;
  const changed=()=>Object.assign(new Error('session_changed'),{code:'session_changed'});
  function rejectPending(){const waiting=pending;pending=null;if(waiting)waiting.reject(changed());}
  const entry=createSessionEntry({client,getSession:()=>session,root,origin,fetcher,events,show:()=>{if(pending)show();},
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
        if(await entry.recheck()){
          if(pending===waiting){pending=null;root.hidden=true;resolve();}
        }
      }catch(error){if(pending===waiting){pending=null;reject(error);}}
      await completion;
      if(disposed||epoch!==generation||!entry.authorized||session?.user?.id!==actor)throw changed();
    },
    cancel,manageDevice:(route,ack)=>entry.manageDevice(route,ack),
    dispose(){disposed=true;cancel();entry.dispose();subscription?.unsubscribe();}
  };
}
