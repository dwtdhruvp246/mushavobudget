// Review candidate: browser UX checks supplement Supabase Auth enforcement.
export const NEW_PASSWORD_MINIMUM = 8;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function authError(code) { return Object.assign(new Error(code), { code }); }
export function validateNewPassword(password, confirmation) {
  if (typeof password !== 'string' || Array.from(password).length < NEW_PASSWORD_MINIMUM) throw authError('new_password_too_short');
  if (password !== confirmation) throw authError('password_mismatch');
}
export function safeAuthMessage(error) {
  const code = error?.code;
  if (code === 'new_password_too_short') return `Use at least ${NEW_PASSWORD_MINIMUM} characters for your new password.`;
  if (code === 'password_mismatch') return 'Passwords do not match.';
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in.';
  if (code === 'invalid_credentials') return 'The email or password was not accepted. Check both and try again.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'].includes(code) || error?.status === 429) return 'Too many attempts. Wait before trying again.';
  if (['reauthentication_needed', 'reauthentication_not_valid'].includes(code)) return 'Request a verification code, then enter the newest code to change your password.';
  if (code === 'weak_password') return 'Your new password does not meet the account security rules. Choose a stronger password.';
  if (code === 'same_password') return 'Choose a password different from your current password.';
  if (code === 'current_password_required') return 'Enter your current password to confirm this change.';
  if (['session_changed', 'identity_mismatch'].includes(code)) return 'The active account changed. Reload and verify the email before continuing.';
  if (['otp_expired', 'link_unavailable', 'session_not_found', 'session_expired'].includes(code)) return 'This link or session is unavailable. Open the newest email or request another link.';
  if (code === 'email_verification_required') return 'Verify your email code before continuing to your account.';
  if (code === 'business_invitation_unavailable') return 'This Business invitation is unavailable. Ask the owner for the latest invitation.';
  return 'The request could not finish. Check your connection and try again.';
}
export function callbackUrl(href, flow) {
  const url = new URL('./auth.html', href);
  url.searchParams.set('flow', flow);
  return url.href;
}
export function redirectLegacyAuthLink(href, kind, replace) {
  const source = new URL(href), fragment = new URLSearchParams(source.hash.slice(1));
  const type = fragment.get('type') || source.searchParams.get('type');
  const hasMaterial = source.searchParams.has('code') || source.searchParams.has('token_hash') || fragment.has('access_token') || fragment.has('error');
  if (!hasMaterial || (kind !== 'business' && type !== 'recovery')) return false;
  const target = new URL('./auth.html', source);
  target.searchParams.set('flow', kind === 'business' ? (type === 'invite' ? 'business-new' : 'business-existing') : 'recover');
  for (const key of ['invitation','code','token_hash','type','error','error_code','error_description']) if (source.searchParams.has(key)) target.searchParams.set(key, source.searchParams.get(key));
  target.hash = source.hash;
  replace(target.href);
  return true;
}
export function isolatedAuthOptions(settings, storage) {
  const project = new URL(settings.supabaseUrl).hostname.split('.')[0];
  return { auth: { storage, storageKey: `mushavo-invitation-${project}`, detectSessionInUrl: false, persistSession: true, autoRefreshToken: true } };
}
// Capture material once, then remove it BEFORE any asynchronous operation.
export function consumeAuthUrl(href, replace) {
  const url = new URL(href), fragment = new URLSearchParams(url.hash.slice(1));
  const material = {
    flow: url.searchParams.get('flow'), invitation: url.searchParams.get('invitation'),
    code: url.searchParams.get('code'), token_hash: url.searchParams.get('token_hash'),
    access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token'),
    type: fragment.get('type') || url.searchParams.get('type'),
    error: fragment.get('error_code') || url.searchParams.get('error_code') || fragment.get('error') || url.searchParams.get('error')
  };
  for (const key of ['code','token','token_hash','access_token','refresh_token','type','expires_in','expires_at','error','error_code','error_description']) url.searchParams.delete(key);
  url.hash = '';
  replace(`${url.pathname}${url.search}`);
  return material;
}
export async function verifiedUser(client, expectedId = null) {
  const {data, error} = await client.auth.getUser();
  if (error) throw error;
  if (!data?.user?.id) throw authError('session_not_found');
  if (expectedId && data.user.id !== expectedId) throw authError('identity_mismatch');
  return data.user;
}
// A provider email link is not an application email-code proof. The optional
// screen waits for user input; the independent server predicate still decides.
export async function requireVerifiedApplicationSession(client, expectedId, beforeApplication = async () => {}) {
  await beforeApplication(expectedId);
  const before = await client.auth.getSession();
  if (before.error) throw before.error;
  const session = before.data?.session;
  if (session?.user?.id !== expectedId || !session.access_token) throw authError('identity_mismatch');
  await verifiedUser(client, expectedId);
  const proof = await client.rpc('email_gate_current_session_verified');
  if (proof.error !== null || proof.data !== true) throw authError('email_verification_required');
  const after = await client.auth.getSession();
  if (after.error || after.data?.session?.user?.id !== expectedId || after.data.session.access_token !== session.access_token) throw authError('session_changed');
  return session;
}
export function createLinkController(client, material, {beforeApplication} = {}) {
  let user = null, invitation = null, passwordSaved = false, generation = 0;
  function active(epoch) { if (epoch !== generation) throw authError('session_changed'); }
  const flow = material.flow;
  async function checkBusiness(expectedId, epoch) {
    if (!UUID.test(material.invitation || '')) throw authError('business_invitation_unavailable');
    const expectedSession = await requireVerifiedApplicationSession(client, expectedId, beforeApplication);
    active(epoch);
    const {data, error} = await client.rpc('get_my_business_invitations');
    active(epoch);
    await verifiedUser(client, expectedId);
    const current = await client.auth.getSession();
    active(epoch);
    if (current.error || current.data?.session?.user?.id !== expectedId || current.data.session.access_token !== expectedSession.access_token) throw authError('session_changed');
    if (error) throw error;
    const row = data?.find(item => item.invitation_id === material.invitation);
    if (!row || row.status !== 'pending' || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) throw authError('business_invitation_unavailable');
    invitation = row;
  }
  return {
    get user() { return user; }, get invitation() { return invitation; }, get passwordSaved() { return passwordSaved; },
    cancel() { generation++; user = null; invitation = null; passwordSaved = false; },
    async verify() {
      const epoch = ++generation;
      user = null; passwordSaved = false;
      if (!['confirm','recover','business-new','business-existing'].includes(flow) || material.error) throw authError('link_unavailable');
      // Never fall back to an existing app or isolated session on a missing link.
      let result;
      if (material.token_hash) {
        const allowed = flow === 'recover' ? ['recovery'] : flow === 'confirm' ? ['signup','email'] : ['invite','magiclink'];
        if (!allowed.includes(material.type)) throw authError('link_unavailable');
        result = await client.auth.verifyOtp({token_hash:material.token_hash,type:material.type});
      } else if (material.code) result = await client.auth.exchangeCodeForSession(material.code);
      else if (material.access_token && material.refresh_token) {
        const allowed = flow === 'recover' ? ['recovery'] : flow === 'confirm' ? ['signup','email'] : ['invite','magiclink'];
        if (material.type && !allowed.includes(material.type)) throw authError('link_unavailable');
        result = await client.auth.setSession({access_token:material.access_token,refresh_token:material.refresh_token});
      } else throw authError('link_unavailable');
      active(epoch);
      if (result.error) throw result.error;
      const session = result.data?.session;
      if (!session?.user?.id) throw authError('session_not_found');
      const checked = await verifiedUser(client, session.user.id);
      active(epoch);
      if (!checked.email_confirmed_at) throw authError('email_not_confirmed');
      if (flow.startsWith('business-')) await checkBusiness(checked.id, epoch);
      user = checked;
      return checked;
    },
    async save(password, confirmation) {
      const epoch = generation;
      if (!user || !['recover','business-new'].includes(flow)) throw authError('link_unavailable');
      validateNewPassword(password, confirmation);
      await verifiedUser(client, user.id);
      active(epoch);
      if (flow === 'business-new') await checkBusiness(user.id, epoch);
      active(epoch);
      const {error} = await client.auth.updateUser({password});
      active(epoch);
      if (error && !(passwordSaved && error.code === 'same_password')) throw error;
      if (!error) passwordSaved = true;
      await verifiedUser(client, user.id);
      active(epoch);
      passwordSaved = true;
    },
    async continueToApp(appClient, acknowledged) {
      const epoch = generation;
      if (!acknowledged || !user || (['recover','business-new'].includes(flow) && !passwordSaved)) throw authError('link_unavailable');
      await verifiedUser(client, user.id);
      active(epoch);
      await requireVerifiedApplicationSession(client, user.id, beforeApplication);
      active(epoch);
      if (flow.startsWith('business-')) await checkBusiness(user.id, epoch);
      const {data,error} = await client.auth.getSession();
      active(epoch);
      if (error) throw error;
      if (data?.session?.user?.id !== user.id || !data.session.access_token || !data.session.refresh_token) throw authError('session_not_found');
      const current = await appClient.auth.getSession();
      active(epoch);
      if (current.error) throw current.error;
      // UI must explain account replacement; acknowledgment is always explicit.
      const adopted = await appClient.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
      active(epoch);
      if (adopted.error) throw adopted.error;
      await verifiedUser(appClient, user.id);
      active(epoch);
      return flow.startsWith('business-') ? `./business.html?invitation=${encodeURIComponent(material.invitation)}#business/team` : './app.html';
    }
  };
}
export function createPasswordChanger(client) {
  let expectedId = null;
  return {
    async verify() { const user = await verifiedUser(client); expectedId = user.id; return user; },
    async requestCode() {
      if (!expectedId) throw authError('session_not_found');
      await verifiedUser(client, expectedId);
      const {error} = await client.auth.reauthenticate();
      if (error) throw error;
    },
    async save(password, confirmation, nonce = '', currentPassword = '') {
      if (!expectedId) throw authError('session_not_found');
      validateNewPassword(password, confirmation);
      await verifiedUser(client, expectedId);
      const {error} = await client.auth.updateUser({password, ...(nonce ? {nonce} : {}), ...(currentPassword ? {current_password:currentPassword} : {})});
      if (error) throw error;
      await verifiedUser(client, expectedId);
    }
  };
}

// Admin-created signup is an application workflow, not a platform Admin grant.
// The screen port supplies UX only; each private step checks server proof too.
export function createInvitationSignupController(client, {mode, invitationId = '', linkMaterial = {}, beforeApplication, onInvalidated = () => {}}) {
  if (!['admin-invite','self-signup'].includes(mode)) throw authError('link_unavailable');
  let epoch=0, expected=null, detail=null, ready=false, saved=false, completed=null, passwordWrite=false;
  let bootstrapStarted=false,bootstrapSucceeded=false,working=false;
  const unavailable=()=>authError('session_changed');
  function cancel(){epoch++;expected=null;detail=null;ready=false;saved=false;completed=null;onInvalidated();}
  const subscription=client.auth.onAuthStateChange((event,next)=>{
    if(event==='INITIAL_SESSION'||!expected)return;
    if(passwordWrite&&event==='USER_UPDATED'&&next?.user?.id===expected.user){expected.token=next.access_token;return;}
    if(next?.user?.id!==expected.user||next?.access_token!==expected.token)cancel();
  }).data?.subscription;
  async function run(action){if(working)throw unavailable();working=true;try{return await action();}finally{working=false;}}
  function active(version){if(epoch!==version||!expected)throw unavailable();}
  async function snapshot(version){
    active(version);const result=await client.auth.getSession();active(version);
    const s=result.data?.session;
    if(result.error||s?.user?.id!==expected.user||s?.access_token!==expected.token)throw unavailable();
    const user=await verifiedUser(client,expected.user);active(version);
    if(!user.email_confirmed_at||user.email?.toLowerCase()!==expected.email)throw authError('identity_mismatch');
    return s;
  }
  async function application(version){active(version);await requireVerifiedApplicationSession(client,expected.user,beforeApplication);active(version);return snapshot(version);}
  async function bootstrap(){
    if(bootstrapStarted){if(!bootstrapSucceeded)throw authError('link_unavailable');return;}
    bootstrapStarted=true;
    const m=linkMaterial;
    if(m.error)throw authError('link_unavailable');
    let response;
    if(m.token_hash||m.access_token||m.refresh_token||m.code){
      if(m.type&&!['invite','recovery','magiclink','signup','email'].includes(m.type))throw authError('link_unavailable');
      if(m.token_hash){if(!m.type)throw authError('link_unavailable');response=await client.auth.verifyOtp({token_hash:m.token_hash,type:m.type});}
      else if(m.code)response=await client.auth.exchangeCodeForSession(m.code);
      else if(m.access_token&&m.refresh_token)response=await client.auth.setSession({access_token:m.access_token,refresh_token:m.refresh_token});
      else throw authError('link_unavailable');
      if(response.error)throw response.error;
      if(!response.data?.session?.user?.id)throw authError('session_not_found');
    }
    bootstrapSucceeded=true;
  }
  async function context(version){
    await application(version);
    const result=mode==='admin-invite'
      ?await client.rpc('get_my_admin_user_invitation',{p_invitation_id:invitationId})
      :await client.rpc('has_my_unfinished_admin_invitation');
    await snapshot(version);
    if(result.error)throw result.error;
    if(mode==='self-signup'){
      if(result.data!==true)throw authError('ADMIN_INVITATION_NOT_AVAILABLE');
      return null;
    }
    const row=Array.isArray(result.data)?result.data[0]:result.data;
    if(!row||row.invitation_id!==invitationId||row.email?.toLowerCase()!==expected.email||!['sent','provisioned'].includes(row.invitation_status))throw authError('ADMIN_INVITATION_NOT_AVAILABLE');
    if(row.invitation_status==='provisioned'){
      if(!UUID.test(row.provisioned_workspace_id||''))throw authError('ADMIN_INVITATION_NOT_AVAILABLE');
      completed=row.provisioned_workspace_id;
    }
    detail=row;return row;
  }
  function currencies(values){
    const list=values.enabledCurrencies;
    if(!Array.isArray(list)||list.length<1||list.length>20||list.some(x=>typeof x!=='string'||! /^[A-Z]{3}$/.test(x))||new Set(list).size!==list.length||!list.includes(values.defaultCurrency))throw authError('INVALID_ENABLED_CURRENCIES');
    if(mode==='self-signup'&&(typeof values.fullName!=='string'||!values.fullName.trim()||values.fullName.trim().length>120))throw authError('INVALID_SIGNUP_NAME');
    return{enabledCurrencies:list.slice().sort(),defaultCurrency:values.defaultCurrency,fullName:values.fullName?.trim()};
  }
  return {
    get passwordSaved(){return saved;},get completed(){return completed;},get invitation(){return detail;},get userId(){return expected?.user;},
    verify:()=>run(async()=>{
      if(mode==='admin-invite'&&!UUID.test(invitationId))throw authError('ADMIN_INVITATION_NOT_AVAILABLE');
      const version=epoch;await bootstrap();if(epoch!==version)throw unavailable();
      const session=await client.auth.getSession();if(epoch!==version)throw unavailable();
      if(session.error||!session.data?.session?.user?.id)throw authError('session_not_found');
      const user=await verifiedUser(client,session.data.session.user.id);if(epoch!==version)throw unavailable();
      if(!user.email_confirmed_at||!user.email)throw authError('email_not_confirmed');
      if(expected&&(expected.user!==user.id||expected.token!==session.data.session.access_token))throw unavailable();
      expected={user:user.id,email:user.email.toLowerCase(),token:session.data.session.access_token};
      // A locally known committed completion can retry adoption without replaying Free signup.
      if(completed)await application(version);
      const row=completed?detail:await context(version);active(version);ready=true;
      return{user,invitation:row,completed};
    }),
    savePassword:(password,confirmation,values)=>run(async()=>{
      if(!ready||!expected||completed)throw authError('link_unavailable');
      validateNewPassword(password,confirmation);const selected=currencies(values),version=epoch;
      await context(version);if(completed)throw authError('link_unavailable');
      await snapshot(version);passwordWrite=true;
      let result;
      try{result=await client.auth.updateUser({password,data:mode==='admin-invite'?{full_name:detail.full_name,default_currency:selected.defaultCurrency,enabled_currencies:selected.enabledCurrencies,signup_source:'admin_invitation',admin_invitation_id:invitationId}:{full_name:selected.fullName,default_currency:selected.defaultCurrency,enabled_currencies:selected.enabledCurrencies,country_code:values.countryCode||null,signup_source:'self_signup',admin_invitation_id:null}});}finally{passwordWrite=false;}
      active(version);
      // Existing account setup supports retry when this password was already saved.
      if(result.error&&result.error.code!=='same_password')throw result.error;
      saved=true;await snapshot(version);
    }),
    complete:(values,acknowledged)=>run(async()=>{
      if(!acknowledged||!ready||!expected||(!saved&&!completed))throw authError('link_unavailable');
      const version=epoch;await application(version);if(completed)return completed;
      const selected=currencies(values);await context(version);if(completed)return completed;
      const result=mode==='admin-invite'
        ?await client.rpc('complete_admin_user_invitation',{p_invitation_id:invitationId,p_enabled_currencies:selected.enabledCurrencies,p_default_currency:selected.defaultCurrency})
        :await client.rpc('complete_self_signup_from_admin_invitation',{p_full_name:selected.fullName,p_enabled_currencies:selected.enabledCurrencies,p_default_currency:selected.defaultCurrency});
      await snapshot(version);if(result.error)throw result.error;
      if(!UUID.test(result.data||''))throw authError('request_invalid');
      completed=result.data;return completed;
    }),
    adopt:(appClient,acknowledged)=>run(async()=>{
      if(!acknowledged||!completed||!expected)throw authError('link_unavailable');
      const version=epoch,s=await application(version);if(!s.refresh_token)throw authError('session_not_found');
      const result=await appClient.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});active(version);
      if(result.error)throw result.error;await verifiedUser(appClient,expected.user);active(version);await snapshot(version);
    }),
    cancel,
    dispose(){subscription?.unsubscribe();cancel();}
  };
}
