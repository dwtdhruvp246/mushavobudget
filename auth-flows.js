import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
import { callbackUrl, consumeAuthUrl, isolatedAuthOptions, createLinkController, createPasswordChanger, safeAuthMessage, verifiedUser, authError, requireVerifiedApplicationSession } from './auth-security.js?v=3';
import { createAuthCallbackEntry } from './session-entry.js?v=4';
import { registerConfirmationDevice } from './email-verification.js?v=4';

const $ = selector => document.querySelector(selector);
const material = consumeAuthUrl(window.location.href, value => window.history.replaceState(null, '', value));
const flow = material.flow;
const settings = window.MUSHAVO_BUDGET_CONFIG || {};
let isolated, app, controller, changer, busy = false, identity = null, cooldownUntil = 0, emailEntry = null, passwordClient = null;
const message = value => { $('#securityMessage').textContent = value; };
function hideForms() { for (const id of ['#securityRequest','#securityPassword','#securityContinue','#securitySelfSignup','#securityResume','#securityDeviceControls','#securityTrustRetry']) $(id).hidden = true; }
function showIdentity(user) { identity = user; $('#securityIdentity').hidden = false; $('#securityIdentity').textContent = `Verified account: ${user.email || ''}`; }
async function operation(action) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('#securityRequest button, #securityPassword button, #securityContinue button, #securityResume, #securityDeviceControls button')];
  buttons.forEach(button => { button.disabled = true; });
  try { await action(); } catch (error) { message(safeAuthMessage(error)); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}
function prepareEmailEntry(client) {
  emailEntry?.dispose();
  emailEntry = createAuthCallbackEntry({client,root:$('#securityEmailVerification'),origin:window.location.origin,fetcher:window.fetch.bind(window),
    show:state=>{
      hideForms(); $('#securityEmailVerification').hidden=false;
      const checking=state?.busy||state?.phase==='loading';
      if(flow==='recover'){
        $('#securityTitle').textContent=checking?'Signing in':'Check your email';
        message(checking?'Please wait.':'Enter your email code to finish signing in.');
      }else message(checking?'Checking your account…':'Verify this account with an email code to continue.');
    },
    onInvalidated:()=>{ $('#securityAcknowledge').checked=false;if(flow==='devices'){$('#securityDeviceControls').hidden=true;$('#securityDeviceAcknowledge').checked=false;$('#securityResume').hidden=false;} },
    onSignOut:()=>cancelSecurityFlow(true),
    onVerified:async({ticket})=>{if(flow==='devices'&&ticket()&&identity)await showDeviceSecurity();}
  });
}
async function requireApplication(client, actor) {
  try { await requireVerifiedApplicationSession(client, actor, id=>emailEntry.require(id)); }
  catch(error){
    if(error?.code==='email_verification_required'){
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
  if (['change','devices'].includes(flow)) {
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
    if(flow==='devices') { await showDeviceSecurity(); return; }
    changer = createPasswordChanger(snapshot);
    await changer.verify();
    $('#securityTitle').textContent = 'Change your password';
    message('After changing your password, verify a fresh email code before returning to the app. Request a password-change code here only if your account requires one.');
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
    await finishConfirmationDevice();
    return;
  }
  message(flow.startsWith('business-') ? `Invitation for ${controller.invitation.workspace_name}. Membership is decided when you accept in the Business workspace.` : 'Your email link has been verified.');
  if (['recover','business-new'].includes(flow)) $('#securityPassword').hidden = false;
  else $('#securityContinue').hidden = false;

}
async function finishConfirmationDevice() {
  if(flow!=='confirm'||!identity)throw authError('link_unavailable');
  const signInButton=$('#securityCancel');signInButton.disabled=true;
  $('#securityTrustRetry').hidden=true;
  message('Email confirmed. Saving this browser…');
  try {
    await registerConfirmationDevice({client:isolated,expectedId:identity.id,origin:window.location.origin,fetcher:window.fetch.bind(window)});
    message('This browser is trusted. You can now sign in.');
  } catch(error) { $('#securityTrustRetry').hidden=false;throw error; }
  finally {signInButton.disabled=false;}
}
$('#securityTrustRetry').addEventListener('click',()=>operation(finishConfirmationDevice));
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
    // Password changes revoke the prior approval even when the bearer stays
    // unchanged. A subsequent step must obtain fresh server-backed proof.
    emailEntry.lock();
    $('#securityPassword').reset(); $('#securityPassword').hidden = true;
    $('#securityResume').hidden = false;
    await finishPasswordFlow();
  });
});
async function finishPasswordFlow() {
  if (!identity || (flow !== 'change' && !controller.passwordSaved)) throw authError('link_unavailable');
  message(flow==='recover'?'Signing in…':'Password saved. Verify this account before continuing.');
  $('#securityResume').hidden = false;
  if (flow === 'recover') await recoveryDestination();
  else {
    await requireApplication(flow === 'change' ? passwordClient : isolated, identity.id);
    if (flow === 'change') { await currentIdentity(); message('Password changed and email verification complete. You can return to your app.'); }
    else $('#securityContinue').hidden = false;
  }
  $('#securityResume').hidden = true;
}
$('#securityResume').addEventListener('click',()=>operation(flow==='devices'?showDeviceSecurity:finishPasswordFlow));
async function showDeviceSecurity() {
  await currentIdentity();
  await requireApplication(passwordClient,identity.id);
  await currentIdentity();
  $('#securityTitle').textContent = 'Sign-in security';
  $('#securityDeviceAcknowledge').checked=false;
  $('#securityDeviceControls').hidden=false;
  $('#securityResume').hidden=true;
  message('Manage remembered approval for your signed-in account.');
}
async function manageRememberedDevice(route) {
  const acknowledged=$('#securityDeviceAcknowledge').checked;
  if(acknowledged!==true){message('Confirm the effect of this change before continuing.');return;}
  await currentIdentity();
  message('Updating sign-in approvals…');
  const result=await emailEntry.manageDevice(route,acknowledged);
  await currentIdentity();
  $('#securityDeviceAcknowledge').checked=false;
  if(result.verified){$('#securityDeviceControls').hidden=false;$('#securityResume').hidden=true;}
  else {$('#securityDeviceControls').hidden=true;$('#securityResume').hidden=false;$('#securityEmailVerification').hidden=false;}
  if(result.result==='FORGOTTEN')message(result.verified?'This device is no longer remembered. Your current sign-in remains verified.':'This device is no longer remembered. Verify this sign-in again to continue.');
  else if(result.result==='REVOKED')message('Email approvals were reset for your account. Verify this sign-in again to continue.');
  else message('The change could not be confirmed. Check this sign-in again before retrying.');
}
$('#securityForgetDevice').addEventListener('click',()=>operation(()=>manageRememberedDevice('forget')));
$('#securityRevokeAll').addEventListener('click',()=>operation(()=>manageRememberedDevice('revoke-all')));
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
  // still revalidates the saved password, actor and server proof before adoption.
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
  const target = ['change','devices'].includes(flow) ? (logoutNormal ? app : null) : isolated;
  if (target) {
    const {error} = await target.auth.signOut({scope:'local'});
    if (error && !['session_not_found','session_expired'].includes(error.code)) throw error;
  }
  window.location.replace(new URL('./app.html?auth=manual', window.location.href).href);
}
$('#securityCancel').addEventListener('click', () => { cancelSecurityFlow().catch(error=>message(safeAuthMessage(error))); });
operation(init);
