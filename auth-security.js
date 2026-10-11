// Review candidate: browser UX checks supplement Supabase Auth enforcement.
export const NEW_PASSWORD_MINIMUM = 12;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function authError(code) { return Object.assign(new Error(code), { code }); }
export function validateNewPassword(password, confirmation) {
  if (typeof password !== 'string' || Array.from(password).length < NEW_PASSWORD_MINIMUM) throw authError('new_password_too_short');
  if (password !== confirmation) throw authError('password_mismatch');
}
export function safeAuthMessage(error) {
  const code = error?.code;
  if (code === 'new_password_too_short') return 'Use at least 12 characters for your new password.';
  if (code === 'password_mismatch') return 'Passwords do not match.';
  if (code === 'email_not_confirmed') return 'Confirm your email before signing in. Open the newest email or request another confirmation link.';
  if (code === 'invalid_credentials') return 'The email or password was not accepted. Check both and try again.';
  if (['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit'].includes(code) || error?.status === 429) return 'Too many attempts. Wait before trying again.';
  if (['reauthentication_needed', 'reauthentication_not_valid'].includes(code)) return 'Request a verification code, then enter the newest code to change your password.';
  if (code === 'weak_password') return 'Your new password does not meet the account security rules. Choose a stronger password.';
  if (code === 'same_password') return 'Choose a password different from your current password.';
  if (code === 'current_password_required') return 'Enter your current password to confirm this change.';
  if (['session_changed', 'identity_mismatch'].includes(code)) return 'The active account changed. Reload and verify the email before continuing.';
  if (['otp_expired', 'link_unavailable', 'session_not_found', 'session_expired'].includes(code)) return 'This link or session is unavailable. Open the newest email or request another link.';
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
export function createLinkController(client, material) {
  let user = null, invitation = null, passwordSaved = false;
  const flow = material.flow;
  async function checkBusiness() {
    if (!UUID.test(material.invitation || '')) throw authError('business_invitation_unavailable');
    const {data, error} = await client.rpc('get_my_business_invitations');
    if (error) throw error;
    const row = data?.find(item => item.invitation_id === material.invitation);
    if (!row || row.status !== 'pending' || !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= Date.now()) throw authError('business_invitation_unavailable');
    invitation = row;
  }
  return {
    get user() { return user; }, get invitation() { return invitation; }, get passwordSaved() { return passwordSaved; },
    async verify() {
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
      if (result.error) throw result.error;
      const session = result.data?.session;
      if (!session?.user?.id) throw authError('session_not_found');
      const checked = await verifiedUser(client, session.user.id);
      if (!checked.email_confirmed_at) throw authError('email_not_confirmed');
      if (flow.startsWith('business-')) await checkBusiness();
      user = checked;
      return checked;
    },
    async save(password, confirmation) {
      if (!user || !['recover','business-new'].includes(flow)) throw authError('link_unavailable');
      validateNewPassword(password, confirmation);
      await verifiedUser(client, user.id);
      if (flow === 'business-new') await checkBusiness();
      const {error} = await client.auth.updateUser({password});
      if (error && !(passwordSaved && error.code === 'same_password')) throw error;
      if (!error) passwordSaved = true;
      await verifiedUser(client, user.id);
      passwordSaved = true;
    },
    async continueToApp(appClient, acknowledged) {
      if (!acknowledged || !user || (['recover','business-new'].includes(flow) && !passwordSaved)) throw authError('link_unavailable');
      await verifiedUser(client, user.id);
      if (flow.startsWith('business-')) await checkBusiness();
      const {data,error} = await client.auth.getSession();
      if (error) throw error;
      if (data?.session?.user?.id !== user.id || !data.session.access_token || !data.session.refresh_token) throw authError('session_not_found');
      const current = await appClient.auth.getSession();
      if (current.error) throw current.error;
      // UI must explain account replacement; acknowledgment is always explicit.
      const adopted = await appClient.auth.setSession({access_token:data.session.access_token,refresh_token:data.session.refresh_token});
      if (adopted.error) throw adopted.error;
      await verifiedUser(appClient, user.id);
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
