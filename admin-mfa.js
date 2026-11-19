// Secrets exist only in this view's DOM during enrollment. Never log SDK errors.
export function createAdminMfa({client,getSession,onState=()=>{},onUnlocked=()=>{}}) {
  let actor=null,epoch=0,checkId=0,pending=null,verified=[],busy=false;
  let authorized=false;
  const current=e=>e===epoch && actor && getSession()?.user?.id===actor;
  const emit=value=>onState({...value,busy,authorized});
  function bind(session) {
    if(actor!==session?.user?.id) {
      actor=session?.user?.id||null;epoch++;checkId++;pending=null;verified=[];busy=false;authorized=false;
      emit({phase:'locked',secret:''});
    }
  }
  async function check() {
    bind(getSession());
    const e=epoch,id=++checkId,token=getSession()?.access_token;
    authorized=false;
    try {
      if(!actor || !token)throw Error();
      const {data,error}=await client.rpc('admin_mfa_status');
      if(!current(e)||id!==checkId||getSession()?.access_token!==token)return false;
      if(error || data?.staff!==true || data?.active!==true)throw Error();
      authorized=data.authorized===true && data.has_verified_factor===true;
      if(authorized) {pending=null;emit({phase:'authorized',secret:''});return true;}
      emit({phase:'locked',secret:''});
      return false;
    }catch(_) {
      if(current(e)&&id===checkId)emit({phase:'unavailable',secret:'',message:'Admin verification is unavailable. Try again or contact your operator.'});
      return false;
    }
  }
  async function prepare() {
    const e=epoch;
    if(busy || !current(e))return;
    busy=true;emit({phase:'loading',secret:''});
    try {
      const {data,error}=await client.auth.mfa.listFactors();
      if(error)throw Error();
      if(!current(e))return;
      verified=(data?.totp||[]).filter(f=>f.status==='verified');
      // Supabase listFactors' totp list contains verified factors. Do not collect identifiers in receipts.
      pending=null;busy=false;emit({phase:verified.length?'challenge':'enroll',secret:'',factors:verified});
    }catch(_) {
      if(current(e)){busy=false;emit({phase:'unavailable',secret:'',message:'Verification could not start. Try again.'});}
    }
  }
  async function enroll() {
    const e=epoch;
    if(busy || !current(e))return;
    busy=true;emit({phase:'loading',secret:''});
    try {
      const {data,error}=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'Mushavo Admin '+new Date().toISOString()});
      if(error || !data?.id || !data?.totp?.secret)throw Error();
      if(!current(e))return;
      pending={id:data.id};busy=false;
      emit({phase:'challenge',secret:data.totp.secret,message:'Add this setup key to your authenticator, then enter its current code.'});
    }catch(_) {
      if(current(e)){busy=false;emit({phase:'unavailable',secret:'',message:'Setup could not start. Try again.'});}
    }
  }
  async function verify(code) {
    const e=epoch;
    if(busy || !current(e) || !/^\d{6}$/.test(code))return false;
    const factorId=pending?.id || verified[0]?.id;
    if(!factorId)return false;
    busy=true;emit({phase:'verifying',secret:''});
    try {
      const {error}=await client.auth.mfa.challengeAndVerify({factorId,code});
      if(error)throw Error();
      if(!current(e))return false;
      pending=null;
      // Verification updates the SDK session. Confirm server authorization before loading data.
      const {data,error:sessionError}=await client.auth.getSession();
      if(sessionError || data?.session?.user?.id!==actor)throw Error();
      // Caller session is updated by Auth event; no token/secret goes into application storage here.
      busy=false;
      if(!await check()){if(current(e))emit({phase:'unavailable',secret:'',message:'Verification finished, but Admin access is unavailable. Try again.'});return false;}
      if(current(e))await onUnlocked();
      return current(e);
    }catch(_) {
      if(current(e)){busy=false;emit({phase:'challenge',secret:'',message:'The code could not be verified. Enter a new code and try again.'});}
      return false;
    }
  }
  async function cancel() {
    const e=epoch,id=pending?.id;
    pending=null;authorized=false;checkId++;emit({phase:'locked',secret:''});
    if(id && current(e)) {
      try {await client.auth.mfa.unenroll({factorId:id});}catch(_){}
    }
    if(current(e))await prepare();
  }
  async function removeFactor(factorId) {
    const e=epoch;
    if(busy || !current(e))return false;
    try {
    const {data,error}=await client.auth.mfa.listFactors();
    if(error || !current(e))return false;
    const factors=(data?.totp||[]).filter(f=>f.status==='verified');
    if(!factors.some(f=>f.id===factorId)||factors.length<2) {
      emit({phase:'challenge',secret:'',message:'Verify a replacement authenticator before removing this one.'});return false;
    }
      const result=await client.auth.mfa.unenroll({factorId});
      if(result.error || !current(e))return false;
      authorized=false;
      const refreshed=await client.auth.refreshSession();
      if(refreshed.error){lock();return false;}
      return current(e) && await check();
    }catch(_){lock();return false;}
  }
  function lock() {authorized=false;checkId++;pending=null;emit({phase:'locked',secret:''});}
  function ticket() {const e=epoch,id=checkId,token=getSession()?.access_token;return ()=>current(e)&&id===checkId&&authorized&&getSession()?.access_token===token;}
  return {bind,check,prepare,enroll,verify,cancel,removeFactor,lock,ticket,get busy(){return busy;},get authorized(){return authorized;}};
}

export function attachAdminMfaView({controller,document,onSignOut,onRetry}) {
  const view=document.querySelector('#adminMfaView');
  const code=view.querySelector('[data-mfa-code]');
  view.querySelector('[data-mfa-enroll]').addEventListener('click',()=>controller.enroll());
  view.querySelector('[data-mfa-cancel]').addEventListener('click',()=>controller.cancel());
  view.querySelector('[data-mfa-signout]').addEventListener('click',onSignOut);
  view.querySelector('[data-mfa-retry]').addEventListener('click',onRetry);
  view.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const value=code.value.trim();code.value='';void controller.verify(value);});
  return value=> {
    view.querySelector('[data-mfa-secret]').textContent=value.secret||'';
    if(value.phase!=='challenge')code.value='';
    view.querySelector('[data-mfa-message]').textContent=value.message||'Admin access requires an authenticator code.';
    view.querySelector('[data-mfa-enroll]').hidden=!['enroll','challenge'].includes(value.phase);
    view.querySelector('form').hidden=!['challenge','verifying'].includes(value.phase);
    view.querySelector('[data-mfa-secret]').hidden=!value.secret;
    if(value.factors) {
      const list=view.querySelector('[data-mfa-factors]');list.replaceChildren();
      for(const factor of value.factors) {
        const row=document.createElement('p'),label=document.createElement('span'),button=document.createElement('button');
        label.textContent=factor.friendly_name||'Authenticator';button.textContent='Remove';button.type='button';
        button.addEventListener('click',()=>controller.removeFactor(factor.id).then(()=>controller.prepare()));
        row.append(label,' ',button);list.append(row);
      }
    }else if(['locked','authorized','unavailable'].includes(value.phase))view.querySelector('[data-mfa-factors]').replaceChildren();
    for(const button of view.querySelectorAll('button'))button.disabled=value.busy;
    view.querySelector('[data-mfa-signout]').disabled=false;
  };
}
