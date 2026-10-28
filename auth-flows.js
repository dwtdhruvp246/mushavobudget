import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
import { callbackUrl, consumeAuthUrl, isolatedAuthOptions, createLinkController, createPasswordChanger, safeAuthMessage, verifiedUser, authError, requireVerifiedApplicationSession } from './auth-security.js?v=4';
import { createAuthCallbackEntry } from './session-entry.js?v=5';

const $ = selector => document.querySelector(selector);
const material = consumeAuthUrl(window.location.href, value => window.history.replaceState(null, '', value));
const flow = material.flow === 'devices' ? 'account' : material.flow;
const settings = window.MUSHAVO_BUDGET_CONFIG || {};
let isolated, app, controller, changer, busy = false, identity = null, cooldownUntil = 0, emailEntry = null, passwordClient = null;
const message = value => { $('#securityMessage').textContent = value; };
function hideForms() { for (const id of ['#securityRequest','#securityPassword','#securityContinue','#securitySelfSignup','#securityResume','#securityAccountControls']) $(id).hidden = true; }
function showIdentity(user) { identity = user; $('#securityIdentity').hidden = false; $('#securityIdentity').textContent = `Verified account: ${user.email || ''}`; }
async function operation(action) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('#securityRequest button, #securityPassword button, #securityContinue button, #securityResume, #securityAccountControls button')];
  buttons.forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { message(safeAuthMessage(error)); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}
function prepareEmailEntry(client) {
  emailEntry?.dispose();
  emailEntry = createAuthCallbackEntry({client,root:$('#securitySessionStatus'),
    show:state=>{
      hideForms(); $('#securitySessionStatus').hidden=false;
      $('#securityTitle').textContent=state?.busy?'Signing in':'Account unavailable';
      message(state?.busy?'Please wait.':'Your sign-in could not be checked. Try again.');
    },
    onInvalidated:()=>{ $('#securityAcknowledge').checked=false; },
    onSignOut:()=>cancelSecurityFlow(true),
    onVerified:async({ticket})=>{if(flow==='account'&&ticket()&&identity)await showAccountSecurity();}
  });
}
async function requireApplication(client, actor) {
  try { await requireVerifiedApplicationSession(client, actor, id=>emailEntry.require(id)); }
  catch(error){
    if(['email_verification_required','application_session_required'].includes(error?.code)){
      emailEntry.lock();
      $('#securityResume').hidden=false;
    }
    throw error;
  }
}
async function recoveryDestination() {
  await requireApplication(isolated, identity.id);
  const result = await isolated.rpc('has_my_unfinished_admin_invitation');
  if (result.error) throw result.error;
  if (result.data === true) {
    $('#securityContinue').hidden = true;
    $('#securitySelfSignup').hidden = false;
    message('Your unfinished Admin invitation is still available. Complete the latest invitation, or choose a Free personal signup instead.');
  } else {
    $('#securityContinue').hidden = true;
    $('#securityResume').hidden = false;
    $('#securityResume').textContent = 'Retry sign-in';
    message('Signing in…');
    await openVerifiedAccount();
  }
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
  if (['change','account'].includes(flow)) {
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
    passwordClient = snapshot;
    prepareEmailEntry(snapshot);
    showIdentity(user);
    app.auth.onAuthStateChange((event, next) => {
      if (event !== 'INITIAL_SESSION' && next?.user?.id !== user.id) {
        emailEntry?.cancel(); identity = null; hideForms(); message(safeAuthMessage(authError('session_changed')));
      }
    });
    if(flow==='account') { await showAccountSecurity(); return; }
    changer = createPasswordChanger(snapshot);
    await changer.verify();
    $('#securityTitle').textContent = 'Change your password';
    message('Choose a new password. Enter your current password or request a password-change code only if your account requires it.');
    $('#securityPassword').hidden = false; $('#securityNonceLabel').hidden = false; $('#securityRequestCode').hidden = false; $('#securityCurrentLabel').hidden = false;
    return;
  }
  const confirmationOnly = flow === 'confirm';
  if (!confirmationOnly) prepareEmailEntry(isolated);
  controller = createLinkController(isolated, material, confirmationOnly ? {} : {beforeApplication:id=>emailEntry.require(id)});
  const user = await controller.verify();
  showIdentity(user);
  $('#securityTitle').textContent = flow === 'confirm' ? 'Email confirmed' : flow === 'recover' ? 'Choose a new password' : 'Business invitation verified';
  if (confirmationOnly) {
    const signInButton = $('#securityCancel');
    signInButton.textContent = 'Go to sign in';
    signInButton.className = 'primary';
    finishConfirmation();
    return;
  }
  message(flow.startsWith('business-') ? `Invitation for ${controller.invitation.workspace_name}. Membership is decided when you accept in the Business workspace.` : 'Your email link has been verified.');
  if (['recover','business-new'].includes(flow)) $('#securityPassword').hidden = false;
  else $('#securityContinue').hidden = false;

}
function finishConfirmation() {
  if(flow!=='confirm'||!identity)throw authError('link_unavailable');
  message('Email confirmed. You can now sign in.');
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
    // Recheck the current server session after a password change before opening the app.
    emailEntry.lock();
    $('#securityPassword').reset(); $('#securityPassword').hidden = true;
    $('#securityResume').hidden = false;
    await finishPasswordFlow();
  });
});
async function finishPasswordFlow() {
  if (!identity || (flow !== 'change' && !controller.passwordSaved)) throw authError('link_unavailable');
  message(flow==='recover'?'Signing in…':'Password saved. Opening your account…');
  $('#securityResume').hidden = false;
  if (flow === 'recover') await recoveryDestination();
  else {
    await requireApplication(flow === 'change' ? passwordClient : isolated, identity.id);
    if (flow === 'change') { await currentIdentity(); message('Password changed. You can return to your app.'); }
    else $('#securityContinue').hidden = false;
  }
  $('#securityResume').hidden = true;
}
$('#securityResume').addEventListener('click',()=>operation(flow==='account'?showAccountSecurity:finishPasswordFlow));
async function showAccountSecurity() {
  await currentIdentity();
  await requireApplication(passwordClient,identity.id);
  await currentIdentity();
  $('#securityTitle').textContent='Account settings';
  $('#securityAccountControls').hidden=false;
  $('#securityResume').hidden=true;
  $('#securityCancel').textContent='Return to app';
  message('Manage the password for your signed-in account.');
}
$('#securityRequestCode').addEventListener('click', () => operation(async () => {
  if (Date.now() < cooldownUntil) throw {status:429};
  await currentIdentity(); cooldownUntil = Date.now()+60000;
  await changer.requestCode(); message('Check your account inbox for the newest verification code.');
}));
$('#securityOpen').addEventListener('click', () => operation(async () => {
  if (flow === 'confirm') { await cancelSecurityFlow(); return; }
  if (flow !== 'recover' && !$('#securityAcknowledge').checked) { message('Confirm that you want to open the verified account shown above.'); return; }
  await openVerifiedAccount();
}));
async function openVerifiedAccount() {
  app ||= createClient(settings.supabaseUrl, settings.supabasePublishableKey, {auth:{detectSessionInUrl:false,persistSession:true,autoRefreshToken:true}});
  // Completing recovery verification is the intent to sign in. The controller
  // still revalidates the saved password, actor and server authorization before adoption.
  const next = await controller.continueToApp(app, true);
  if (flow === 'recover') message('Signing in…');
  // Removing this local copy must not call server logout: the adopted app
  // uses the same Auth session and refresh token.
  await isolated.auth.stopAutoRefresh();
  const storageKey = isolatedAuthOptions(settings, window.sessionStorage).auth.storageKey;
  window.sessionStorage.removeItem(storageKey);
  window.sessionStorage.removeItem(storageKey + '-code-verifier');
  window.location.replace(new URL(next, window.location.href).href);
}
async function cancelSecurityFlow(logoutNormal = false) {
  controller?.cancel();
  emailEntry?.cancel();
  hideForms();
  const target = ['change','account'].includes(flow) ? (logoutNormal ? app : null) : isolated;
  if (target) {
    const {error} = await target.auth.signOut({scope:'local'});
    if (error && !['session_not_found','session_expired'].includes(error.code)) throw error;
  }
  const destination=['change','account'].includes(flow)&&!logoutNormal?'./app.html':'./app.html?auth=manual';
  window.location.replace(new URL(destination, window.location.href).href);
}
$('#securityCancel').addEventListener('click', () => { cancelSecurityFlow().catch(error=>message(safeAuthMessage(error))); });
operation(init);
