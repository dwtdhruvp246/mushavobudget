import {createEmailVerification,attachEmailVerificationView} from './email-verification.js?v=1';

// The owning page clears models/DOM before a proof change and checks tickets
// after asynchronous work. Opening this view never sends mail automatically.
export function createSessionEntry({client,getSession,root,origin=globalThis.location?.origin,fetcher=globalThis.fetch,requireAdmin=false,retainViewDuringCheck=false,show,onInvalidated,onUnlocked,onSignOut}){
  let checking=0,retaining=false,render=()=>{},controller,pending=null,pendingActor=null,pendingToken=null,boundActor=null,boundToken=null;
  try{
    controller=createEmailVerification({client,getSession,origin,fetcher,requireAdmin,
      onState:value=>{if(retaining&&value.phase==='loading')return;if(retaining&&!value.authorized)onInvalidated();render(value);if(!value.authorized&&getSession())show();},
      onInvalidated:()=>{if(!retaining)onInvalidated();},
      onUnlocked:async({ticket})=>{if(!checking&&ticket())await onUnlocked({ticket});}
    });
  }catch{
    // Deferred native clients or unsupported origins must stop visibly, not skip verification.
    controller={bind(){onInvalidated();},lock(){onInvalidated();},async prepare(){show();render({phase:'unavailable',busy:false,authorized:false,canVerify:false,message:'Verification is unavailable in this version. Open the Mushavo Budget website to continue.'});return false;},requestCode:async()=>false,verify:async()=>false,ticket:()=>()=>false,authorized:false,busy:false};
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
    ensure:()=>perform(false),recheck:()=>perform(true),
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
