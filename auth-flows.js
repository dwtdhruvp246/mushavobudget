import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
import { callbackUrl, consumeAuthUrl, isolatedAuthOptions, createLinkController, createPasswordChanger, safeAuthMessage, verifiedUser, authError } from './auth-security.js?v=1';

const $ = selector => document.querySelector(selector);
const material = consumeAuthUrl(window.location.href, value => window.history.replaceState(null, '', value));
const flow = material.flow;
const settings = window.MUSHAVO_BUDGET_CONFIG || {};
let isolated, app, controller, changer, busy = false, identity = null, cooldownUntil = 0;
const message = value => { $('#securityMessage').textContent = value; };
function hideForms() { for (const id of ['#securityRequest','#securityPassword','#securityContinue','#securitySelfSignup']) $(id).hidden = true; }
function showIdentity(user) { identity = user; $('#securityIdentity').hidden = false; $('#securityIdentity').textContent = `Verified account: ${user.email || ''}`; }
async function operation(action) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('button')];
  buttons.forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { message(safeAuthMessage(error)); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}
async function currentIdentity() {
  if (!identity) throw authError('session_not_found');
  return verifiedUser(app, identity.id);
}
async function init() {
  if (!settings.supabaseUrl || !settings.supabasePublishableKey || /YOUR-/.test(settings.supabaseUrl + settings.supabasePublishableKey)) throw authError('configuration_missing');
  isolated = createClient(settings.supabaseUrl, settings.supabasePublishableKey, isolatedAuthOptions(settings, window.sessionStorage));
  const normalClient = () => createClient(settings.supabaseUrl, settings.supabasePublishableKey, {auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  hideForms();
  if (['request-recovery','request-confirmation'].includes(flow)) {
    $('#securityTitle').textContent = flow === 'request-recovery' ? 'Reset your password' : 'Request a confirmation email';
    message('Enter your email. If a matching account can receive this link, it will be sent.');
    $('#securityRequest').hidden = false;
    return;
  }
  if (flow === 'change') {
    app = normalClient();
    const current = await app.auth.getSession();
    if (current.error) throw current.error;
    const session = current.data?.session;
    if (!session) throw authError('session_not_found');
    const user = await verifiedUser(app, session.user.id);
    // Snapshot into a separate memory-only client so a cross-tab switch cannot
    // make updateUser apply to the newly active account.
    const snapshot = createClient(settings.supabaseUrl, settings.supabasePublishableKey, {auth:{detectSessionInUrl:false,persistSession:false,autoRefreshToken:false}});
    const adopted = await snapshot.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
    if (adopted.error) throw adopted.error;
    changer = createPasswordChanger(snapshot);
    await changer.verify();
    showIdentity(user);
    app.auth.onAuthStateChange((event, next) => {
      if (event !== 'INITIAL_SESSION' && next?.user?.id !== user.id) {
        identity = null; hideForms(); message(safeAuthMessage(authError('session_changed')));
      }
    });
    $('#securityTitle').textContent = 'Change your password';
    message('Your account stays signed in after a successful change. If verification is required, request and enter the newest code.');
    $('#securityPassword').hidden = false; $('#securityNonceLabel').hidden = false; $('#securityRequestCode').hidden = false; $('#securityCurrentLabel').hidden = false;
    return;
  }
  controller = createLinkController(isolated, material);
  const user = await controller.verify();
  showIdentity(user);
  $('#securityTitle').textContent = flow === 'confirm' ? 'Email confirmed' : flow === 'recover' ? 'Choose a new password' : 'Business invitation verified';
  message(flow.startsWith('business-') ? `Invitation for ${controller.invitation.workspace_name}. Membership is decided when you accept in the Business workspace.` : 'Your email link has been verified.');
  if (['recover','business-new'].includes(flow)) $('#securityPassword').hidden = false;
  else $('#securityContinue').hidden = false;
  if (flow === 'recover') {
    const result = await isolated.rpc('has_my_unfinished_admin_invitation');
    if (!result.error && result.data === true) {
      // Ordinary recovery never silently cancels an Admin invitation.
      $('#securityContinue').hidden = true;
      $('#securitySelfSignup').hidden = false;
      message('Your unfinished Admin invitation is still available. Complete the latest invitation, or choose a Free personal signup instead.');
    }
  }
}
$('#securityRequest').addEventListener('submit', event => {
  event.preventDefault();
  operation(async () => {
    if (Date.now() < cooldownUntil) throw {status:429};
    const email = $('#securityEmail').value.trim().toLowerCase();
    if (!email) throw authError('request_invalid');
    cooldownUntil = Date.now() + 60000;
    const result = flow === 'request-recovery'
      ? await isolated.auth.resetPasswordForEmail(email, {redirectTo:callbackUrl(window.location.href,'recover')})
      : await isolated.auth.resend({type:'signup',email,options:{emailRedirectTo:callbackUrl(window.location.href,'confirm')}});
    // Use the same application response for absent, confirmed or registered
    // addresses. Rate/network feedback remains useful without exposing SDK text.
    if (result.error && (result.error.status === 429 || result.error.code?.startsWith('over_'))) throw result.error;
    message('If your account can receive this link, check your inbox for the newest email. Wait a minute before requesting another.');
  });
});
$('#securityPassword').addEventListener('submit', event => {
  event.preventDefault();
  operation(async () => {
    const password = $('#securityNewPassword').value, confirmation = $('#securityConfirmPassword').value;
    if (flow === 'change') { await currentIdentity(); await changer.save(password, confirmation, $('#securityNonce').value.trim(), $('#securityCurrentPassword').value); await currentIdentity(); }
    else await controller.save(password, confirmation);
    $('#securityPassword').reset(); $('#securityPassword').hidden = true;
    message(flow === 'change' ? 'Password changed. You can return to your app.' : 'Password saved. Review the verified account before continuing.');
    if (flow !== 'change' && $('#securitySelfSignup').hidden) $('#securityContinue').hidden = false;
  });
});
$('#securityRequestCode').addEventListener('click', () => operation(async () => {
  if (Date.now() < cooldownUntil) throw {status:429};
  await currentIdentity(); cooldownUntil = Date.now()+60000;
  await changer.requestCode(); message('Check your account inbox for the newest verification code.');
}));
$('#securityOpen').addEventListener('click', () => operation(async () => {
  if (!$('#securityAcknowledge').checked) { message('Confirm that you want to open the verified account shown above.'); return; }
  app ||= createClient(settings.supabaseUrl, settings.supabasePublishableKey, {auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  const next = await controller.continueToApp(app, true);
  // Removing this local copy must not call server logout: the adopted app
  // uses the same Auth session and refresh token.
  await isolated.auth.stopAutoRefresh();
  const storageKey = isolatedAuthOptions(settings, window.sessionStorage).auth.storageKey;
  window.sessionStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(storageKey + '-code-verifier');
  window.location.replace(new URL(next, window.location.href).href);
}));
$('#securityCancel').addEventListener('click', () => operation(async () => {
  if (flow !== 'change' && isolated) {
    const {error} = await isolated.auth.signOut({scope:'local'});
    if (error && !['session_not_found','session_expired'].includes(error.code)) throw error;
  }
  window.location.replace(new URL('./app.html?auth=manual', window.location.href).href);
}));
operation(init);
