import { randomBytes, createHash } from 'node:crypto';
import { WEB_ORIGIN, API_ORIGIN, need, Stop, tokenIdentity, readPublicConfiguration } from './staging-access.mjs';
import { createMailbox } from './staging-recovery-bridge.mjs';
import { recoveryFixtures } from './staging-recovery-fixtures.mjs';
import { sessionBrowserDecision, readyDashboard } from './staging-password-sessions.mjs';

const KEY = 'sb-dczlddwbtgvfdujgcitb-auth-token';
const ISO = 'mushavo-invitation-dczlddwbtgvfdujgcitb';
const SDK = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm';
const GENERIC = 'If your account can receive this link, check your inbox for the newest email. Wait a minute before requesting another.';
const NETWORK = 'The request could not finish. Check your connection and try again.';
const RATE = 'Too many attempts. Wait before trying again.';
const SOURCES = { '/auth':'4f110e101a1bdf2ae7019fb227a0fc4dc579facd', '/auth-flows.js':'74c3bcb1dc6ef2494f327460ff6cef9866b527c3',
  '/auth-security.js':'eadce63c4b7166166236e2466c11d421f28a0229', '/session-entry.js':'b9d0a517c64174ecbd8f78fff273694f2655692d',
  '/app':'daf5c65b469e9a6f4ef53bea69d47acf2a3544c1', '/app.js':'ba7097c27a0488ce7d91b3c6e3912214f44fb2e6' };
export function safeRecoveryRequestOutcome(status, data) {
  const code=data?.error_code || (typeof data?.code==='string'?data.code:null);
  return {HTTP_status:status,error_code:['over_email_send_rate_limit','over_request_rate_limit','email_address_invalid','unexpected_failure'].includes(code)?code:code?'OTHER':null,
    accepted_by_Auth:status===200,rate_limited:status===429};
}
export function recoveryMailToken(value, type) {
  need(typeof value === 'string' && value.length < 5500 && ['signup','recovery'].includes(type), 'EXACT_TEST_MAIL_LINK_REQUIRED');
  const u = new URL(value);
  need(u.username === '' && u.password === '' && u.origin === API_ORIGIN && u.pathname === '/auth/v1/verify'
    && u.searchParams.get('type') === type, 'EXACT_STAGING_MAIL_LINK_REQUIRED');
  const token = u.searchParams.get('token');
  need(typeof token === 'string' && /^[a-zA-Z0-9_-]{20,256}$/.test(token), 'EXACT_MAIL_HASH_REQUIRED');
  const redirect = new URL(u.searchParams.get('redirect_to'));
  need(redirect.origin === WEB_ORIGIN && ['/auth','/auth.html'].includes(redirect.pathname)
    && redirect.searchParams.get('flow') === (type === 'signup' ? 'confirm' : 'recover'), 'EXACT_STABLE_MAIL_CALLBACK_REQUIRED');
  return token;
}
export function recoveryBrowserDecision(url, method, mode, counts = {}) {
  const u = new URL(url);
  if (u.origin === API_ORIGIN) {
    if (method === 'POST' && u.pathname === '/auth/v1/recover' && ['live-request','synthetic-rate','blocked-request'].includes(mode)) return 'recovery-request';
    if (method === 'POST' && u.pathname === '/auth/v1/verify' && mode === 'recovery') return 'verify-recovery';
    if (method === 'PUT' && u.pathname === '/auth/v1/user' && ['recovery','block-save','save'].includes(mode)) return 'password-save';
  }
  return sessionBrowserDecision(url, method);
}

export async function checkRecovery(plan, accounts, chromium, env = process.env, fetcher = fetch) {
  const fixtures = recoveryFixtures(plan.fixture_run_id), sessions = [], contexts = [];
  const report = { progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z', result:'RECOVERY_VARIANTS_REVIEW_REQUIRED',
    case_ids:['AU04.01','AU04.03','AU04.04','AU04.05','AU05.07'], run_plan:plan.run_id,
    source_commit:env.GITHUB_SHA, workflow_run_id:env.GITHUB_RUN_ID, workflow_run_attempt:env.GITHUB_RUN_ATTEMPT,
    checks:{}, cases:{}, direct_API_requests:0, browser_backend_requests:0, signup_requests:0, recovery_requests:0,
    actual_confirmation_email_requests:0, actual_recovery_email_requests:0, absent_recipient_recovery_requests:0,
    recovery_request_responses:[], accepted_recovery_email_requests:0,
    password_updates_forwarded:0, password_updates_blocked:0, synthetic_rate_responses:0,
    created_fixture_accounts:0, created_sessions:0, scoped_logout_acknowledgements:0, context_cleanup_count:0,
    global_Auth_policy_changed:false, saved_account_passwords_changed:false, finance_or_shared_workspace_writes:false,
    production_or_native_changed:false, service_workers:'blocked_for_interception', full_lettered_batch_W_complete:false,
    owner_deferred_AU03_04_restarted:false, natural_hour_long_expiry_observed:false, provider_quota_exhaustion_attempted:false,
    legacy_short_password_candidate_available:Object.values(accounts).some(x=>Array.from(x.password).length<8), exit_code:1 };
  const passwords = { A:'W9!'+randomBytes(24).toString('base64url'), B:'W9!'+randomBytes(24).toString('base64url'), NEW_A:'W9!'+randomBytes(24).toString('base64url') };
  let key, browser, mailbox, stage='SOURCE_PREFLIGHT', routeProblem=null, complete=false;
  const register = session => {
    if (!session?.access_token) return;
    const identity = tokenIdentity(session.access_token);
    need(identity && [fixtures.A,fixtures.B].includes(session.user?.email?.toLowerCase()) && session.user.id===identity.userId, 'OWN_NEW_FIXTURE_SESSION_REQUIRED');
    const found=sessions.find(x=>x.identity.sessionId===identity.sessionId && x.identity.userId===identity.userId);
    if (found) found.token=session.access_token;
    else { sessions.push({identity,token:session.access_token,cleaned:false}); report.created_sessions++; }
  };
  async function api(method, path, body, token) {
    const allowed = method==='POST' && path==='/auth/v1/signup?redirect_to='+encodeURIComponent(WEB_ORIGIN+'/auth.html?flow=confirm')
      || method==='POST' && ['/auth/v1/verify','/auth/v1/token?grant_type=password','/auth/v1/logout?scope=local'].includes(path)
      || method==='GET' && path==='/auth/v1/user';
    need(report.direct_API_requests++<28 && allowed, 'RECOVERY_DIRECT_API_BOUND_REQUIRED');
    const response=await fetcher(API_ORIGIN+path,{method,redirect:'error',signal:AbortSignal.timeout(20000),
      headers:{apikey:key,'Content-Type':'application/json','User-Agent':`Mushavo-Recovery/${env.GITHUB_RUN_ID}`,
        ...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    let data=null; try {data=await response.json();} catch {}
    register(data); return {status:response.status,data};
  }
  async function verifyIdentity(session,email) {
    const read=await api('GET','/auth/v1/user',null,session.access_token);
    need(read.status===200 && read.data?.id===session.user?.id && read.data?.email===email && read.data?.email_confirmed_at,
      'SERVER_CONFIRMED_FIXTURE_IDENTITY_REQUIRED');
  }
  async function newTest(seed=null, initialMode='idle') {
    const context=await browser.newContext({serviceWorkers:'block',userAgent:`Mushavo-Recovery/${env.GITHUB_RUN_ID}/browser`});
    context.setDefaultTimeout(20000);
    const test={context,mode:initialMode,requestEmail:null,liveRequests:0,verifyResponses:[],pending:[],refused:0,updateResponses:[],lastRecoverySession:null};
    contexts.push(test);
    await context.addInitScript(({seed,key,iso,origin})=>{
      if(location.origin!==origin)return;
      if(!localStorage.getItem('mushavo-recovery-seeded')){
        if(seed)localStorage.setItem(key,JSON.stringify(seed));
        localStorage.setItem('mushavo-recovery-seeded','true'); localStorage.setItem('mushavo-recovery-unrelated','preserve');
      }
    },{seed,key:KEY,iso:ISO,origin:WEB_ORIGIN});
    await context.route('**/*',async route=>{
      const request=route.request(), u=new URL(request.url()), action=recoveryBrowserDecision(request.url(),request.method(),test.mode);
      if(u.origin===API_ORIGIN && ++report.browser_backend_requests>400) routeProblem='RECOVERY_BROWSER_BOUND_REACHED';
      if(action==='recovery-request'){
        let body;try{body=request.postDataJSON();}catch{}
        if(body?.email!==test.requestEmail || !Object.values(fixtures).includes(body?.email))routeProblem='RECOVERY_RECIPIENT_BINDING_REQUIRED';
        else if(test.mode==='synthetic-rate'){
          report.synthetic_rate_responses++;
          await route.fulfill({status:429,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
            body:JSON.stringify({code:429,error_code:'over_email_send_rate_limit',msg:'Controlled rate boundary'})});return;
        }else if(test.mode==='blocked-request'){await route.abort('internetdisconnected');return;}
        else if(report.recovery_requests>=3 || test.liveRequests>=1)routeProblem='RECOVERY_EMAIL_BOUND_REACHED';
        else {report.recovery_requests++;test.liveRequests++;
          if(body.email===fixtures.UNKNOWN)report.absent_recipient_recovery_requests++;else report.actual_recovery_email_requests++;}
      } else if(action==='verify-recovery'){
        let body;try{body=request.postDataJSON();}catch{}
        if(body?.type!=='recovery' || typeof body.token_hash!=='string')routeProblem='RECOVERY_VERIFY_TYPE_REQUIRED';
      } else if(action==='password-save'){
        let body;try{body=request.postDataJSON();}catch{}
        const identity=tokenIdentity((request.headers().authorization||'').replace(/^Bearer /,''));
        if(!test.expectedActor || identity?.userId!==test.expectedActor || body?.password!==passwords.NEW_A
          || Object.keys(body||{}).some(x=>x!=='password'))routeProblem='EXACT_NEW_FIXTURE_PASSWORD_WRITE_REQUIRED';
        else if(test.mode==='block-save') {report.password_updates_blocked++;await route.abort('internetdisconnected');return;}
        else if(test.mode!=='save' || report.password_updates_forwarded>=1)routeProblem='RECOVERY_PASSWORD_WRITE_BOUND_REQUIRED';
        else report.password_updates_forwarded++;
      } else if(action==='refuse') {test.refused++;routeProblem='UNPLANNED_RECOVERY_BROWSER_REQUEST_REFUSED';}
      if(routeProblem){await route.abort('blockedbyclient');return;} await route.continue();
    });
    context.on('response',response=>{
      const u=new URL(response.url());if(u.origin!==API_ORIGIN)return;
      if(u.pathname==='/auth/v1/verify')test.pending.push((async()=>{
        const data=await response.json();register(data);test.verifyResponses.push({status:response.status(),code:data?.error_code||data?.code});
        if(data?.access_token)test.lastRecoverySession=data;
      })().catch(()=>{routeProblem='RECOVERY_VERIFICATION_RESPONSE_REQUIRED';}));
      if(u.pathname==='/auth/v1/user' && response.request().method()==='PUT')test.updateResponses.push(response.status());
    });
    test.page=await context.newPage();return test;
  }
  async function requestLink(test,email){
    test.mode='live-request';test.requestEmail=email;
    await test.page.goto(WEB_ORIGIN+'/auth?flow=request-recovery',{waitUntil:'networkidle'});
    await test.page.locator('#securityEmail').fill(email);
    const [response]=await Promise.all([test.page.waitForResponse(r=>new URL(r.url()).origin===API_ORIGIN && new URL(r.url()).pathname==='/auth/v1/recover'),
      test.page.getByRole('button',{name:'Send link',exact:true}).click()]);
    let data=null;try{data=await response.json();}catch{}
    const outcome=safeRecoveryRequestOutcome(response.status(),data);report.recovery_request_responses.push(outcome);
    if(outcome.accepted_by_Auth && email!==fixtures.UNKNOWN)report.accepted_recovery_email_requests++;
    if(outcome.rate_limited){
      await test.page.getByText(RATE,{exact:true}).waitFor({state:'visible'});
      report.checks.actual_rate_warning_and_retained_address=await test.page.locator('#securityEmail').inputValue()===email
        && await test.page.locator('#securityRequest').isVisible() && await test.page.getByRole('button',{name:'Send link',exact:true}).isEnabled();
      need(false,'RECOVERY_REQUEST_RATE_LIMITED_NO_RETRY');
    }
    need(response.status()===200,'ACTUAL_RECOVERY_GENERIC_RESPONSE_REQUIRED');
    await test.page.getByText(GENERIC,{exact:true}).waitFor({state:'visible'});
    return response.status();
  }
  async function installIsolated(page,session){
    return page.evaluate(async({session,sdk,api,key,iso})=>{
      const {createClient}=await import(sdk),client=createClient(api,key,{auth:{storage:sessionStorage,storageKey:iso,
        detectSessionInUrl:false,persistSession:true,autoRefreshToken:false}});
      const result=await client.auth.setSession({access_token:session.access_token,refresh_token:session.refresh_token});
      return {ok:!result.error,id:result.data?.session?.user?.id};
    },{session,sdk:SDK,api:API_ORIGIN,key,iso:ISO});
  }
  try {
    need(env.GITHUB_REPOSITORY==='dwtdhruvp246/mushavobudget' && env.GITHUB_REF==='refs/heads/security/stage-3-authorization','RECOVERY_STAGING_BRANCH_REQUIRED');
    const config=await fetcher(WEB_ORIGIN+'/config.js?v=27',{redirect:'error',signal:AbortSignal.timeout(20000)});
    need(config.status===200,'RECOVERY_PUBLIC_CONFIGURATION_REQUIRED');key=readPublicConfiguration(await config.text()).key;
    for(const [path,expected]of Object.entries(SOURCES)){
      const response=await fetcher(WEB_ORIGIN+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
      need(response.status===200,'RECOVERY_SOURCE_READ_REQUIRED');const bytes=Buffer.from(await response.arrayBuffer());
      need(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')===expected,'RECOVERY_ACCEPTED_SOURCE_REQUIRED');
    }
    report.checks.six_accepted_deployed_sources_verified=true;
    mailbox=createMailbox(env,fetcher);await mailbox.status('READY|'+mailbox.publicKey);
    browser=await chromium.launch({headless:true});
    const confirmed={};
    for(const slot of ['A','B']){
      stage='SIGNUP_'+slot;report.signup_requests++;report.actual_confirmation_email_requests++;
      const signup=await api('POST','/auth/v1/signup?redirect_to='+encodeURIComponent(WEB_ORIGIN+'/auth.html?flow=confirm'),
        {email:fixtures[slot],password:passwords[slot],data:{full_name:'Batch W disposable recovery '+slot,default_currency:'USD',enabled_currencies:['USD'],
          mushavo_recovery_fixture:fixtures.run_id}});
      need(signup.status===200 && signup.data?.id && !signup.data?.access_token,'EXACT_NEW_PENDING_CONFIRMATION_FIXTURE_REQUIRED');
      report.created_fixture_accounts++;
      stage='CONFIRM_'+slot;const input=await mailbox.receive(stage);
      const token=recoveryMailToken(input?.url,'signup');
      const verified=await api('POST','/auth/v1/verify',{token_hash:token,type:'signup'});
      need(verified.status===200 && verified.data?.user?.email===fixtures[slot],'NEW_FIXTURE_CONFIRMATION_REQUIRED');
      await verifyIdentity(verified.data,fixtures[slot]);confirmed[slot]=verified.data;
    }
    report.checks.two_new_confirmed_disposable_identities=true;
    stage='GENERIC_RECOVERY';const known=await newTest();await requestLink(known,fixtures.A);
    const countBefore=report.recovery_requests;await known.page.getByRole('button',{name:'Send link',exact:true}).click();
    await known.page.getByText(RATE,{exact:true}).waitFor({state:'visible'});
    need(report.recovery_requests===countBefore,'RECOVERY_LOCAL_COOLDOWN_MUST_PREVENT_DISPATCH');
    const absent=await newTest();await requestLink(absent,fixtures.UNKNOWN);
    report.cases.AU04_01={status:'SCOPED_PASS',real_known_and_absent_request_HTTP_status:200,exact_same_generic_guidance:true,
      local_cooldown_blocks_second_dispatch:true,absent_identity_creation_requested:false};
    stage='RATE_UI';const rate=await newTest(null,'synthetic-rate');rate.requestEmail=fixtures.A;
    await rate.page.goto(WEB_ORIGIN+'/auth?flow=request-recovery',{waitUntil:'networkidle'});
    await rate.page.locator('#securityEmail').fill(fixtures.A);await rate.page.getByRole('button',{name:'Send link',exact:true}).click();
    await rate.page.getByText(RATE,{exact:true}).waitFor({state:'visible'});
    need(report.synthetic_rate_responses===1 && await rate.page.locator('#securityEmail').inputValue()===fixtures.A
      && await rate.page.getByRole('button',{name:'Send link',exact:true}).isEnabled(),'SYNTHETIC_AUTH_RATE_UI_REQUIRED');
    report.cases.AU05_07_rate={status:'SYNTHETIC_AUTH_UI_SCOPED_PASS',HTTP_429_injected_at_browser_boundary:true,
      operational_guidance_and_retained_form:true,actual_provider_429_or_Business_Edge_502_exercised:false};
    stage='RECOVER_A';const recoveryInput=await mailbox.receive(stage),recoverToken=recoveryMailToken(recoveryInput?.url,'recovery');
    const test=await newTest(confirmed.B,'recovery');test.expectedActor=confirmed.A.user.id;
    const normal=await test.context.newPage();await normal.goto(WEB_ORIGIN+'/app#personal/dashboard',{waitUntil:'domcontentloaded'});await readyDashboard(normal);
    await test.page.goto(WEB_ORIGIN+'/auth?flow=recover&token_hash='+encodeURIComponent(recoverToken)+'&type=recovery',{waitUntil:'networkidle'});
    await test.page.locator('#securityPassword').waitFor({state:'visible'});await Promise.all(test.pending);
    need(await test.page.locator('#securityIdentity').innerText()===`Verified account: ${fixtures.A}` && test.lastRecoverySession?.user?.id===confirmed.A.user.id,'REAL_RECOVERY_RECIPIENT_REQUIRED');
    need(new URL(test.page.url()).search==='?flow=recover' && !new URL(test.page.url()).hash,'RECOVERY_URL_MUST_BE_CLEAN');
    const recoverySession=test.lastRecoverySession;
    stage='WRONG_SESSION';const wrong=await installIsolated(test.page,confirmed.B);
    need(wrong.ok && wrong.id===confirmed.B.user.id,'DISTINCT_REAL_ISOLATED_SESSION_REQUIRED');
    await test.page.locator('#securityNewPassword').fill(passwords.NEW_A);await test.page.locator('#securityConfirmPassword').fill(passwords.NEW_A);
    await test.page.getByRole('button',{name:'Save password',exact:true}).click();
    await test.page.getByText('The active account changed. Reload and sign in with the intended account.',{exact:true}).waitFor({state:'visible'});
    need(report.password_updates_forwarded===0 && report.password_updates_blocked===0
      && await test.page.locator('#securityNewPassword').inputValue()===passwords.NEW_A,'WRONG_SESSION_MUST_BE_DENIED_BEFORE_WRITE');
    const normalIdentity=await normal.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null')?.user?.id,KEY);
    need(normalIdentity===confirmed.B.user.id && await normal.locator('#appView:not(.hidden)').isVisible(),'ORIGINAL_NORMAL_ACCOUNT_MUST_REMAIN');
    report.cases.AU04_03={status:'SCOPED_PASS',real_distinct_account_substitution_denied_before_password_update:true,
      explicit_account_changed_message:true,normal_account_and_password_form_retained:true};
    stage='BLOCKED_PASSWORD_SAVE';const restored=await installIsolated(test.page,recoverySession);
    need(restored.ok && restored.id===confirmed.A.user.id,'CORRECT_RECOVERY_SESSION_RESTORATION_REQUIRED');
    test.mode='block-save';await test.page.getByRole('button',{name:'Save password',exact:true}).click();
    await test.page.getByText(NETWORK,{exact:true}).waitFor({state:'visible'});
    need(report.password_updates_blocked>=1 && report.password_updates_forwarded===0
      && await test.page.locator('#securityNewPassword').inputValue()===passwords.NEW_A
      && await test.page.locator('#securityConfirmPassword').inputValue()===passwords.NEW_A
      && await test.page.getByRole('button',{name:'Save password',exact:true}).isEnabled(),'ACTUAL_SAVE_NETWORK_FAILURE_AND_FORM_RETENTION_REQUIRED');
    stage='PASSWORD_SAVE_RETRY';test.mode='save';
    await test.page.getByRole('button',{name:'Save password',exact:true}).click();
    await test.page.waitForURL(u=>u.origin===WEB_ORIGIN && u.pathname==='/app',{timeout:35000});await readyDashboard(test.page);
    need(report.password_updates_forwarded===1 && test.updateResponses.length===1 && test.updateResponses[0]===200,'ONE_REAL_PASSWORD_RETRY_SUCCESS_REQUIRED');
    const adopted=await test.page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),KEY);register(adopted);
    need(adopted?.user?.id===confirmed.A.user.id,'RECOVERY_RETRY_MUST_OPEN_INTENDED_ACCOUNT');
    await verifyIdentity(adopted,fixtures.A);
    const newSignin=await api('POST','/auth/v1/token?grant_type=password',{email:fixtures.A,password:passwords.NEW_A});
    need(newSignin.status===200 && newSignin.data?.user?.id===confirmed.A.user.id,'RECOVERED_NEW_PASSWORD_SIGNIN_REQUIRED');
    const unchangedB=await api('POST','/auth/v1/token?grant_type=password',{email:fixtures.B,password:passwords.B});
    need(unchangedB.status===200 && unchangedB.data?.user?.id===confirmed.B.user.id,'OTHER_FIXTURE_PASSWORD_MUST_REMAIN_VALID');
    report.cases.AU04_05={status:'SCOPED_PASS',actual_browser_network_failure_before_server_write:true,
      both_password_fields_retained:true,retry_without_reentering_password:true,real_password_update_HTTP_status:200,
      correct_account_opened_and_server_verified:true,new_password_signin_succeeded:true,other_account_password_unchanged:true};
    stage='EXPIRY_REQUEST';const expiryRequest=await newTest();await requestLink(expiryRequest,fixtures.B);
    stage='RECOVER_B';const expiryInput=await mailbox.receive(stage),expiryToken=recoveryMailToken(expiryInput?.url,'recovery');
    stage='EXPIRE_B';const prepared=await mailbox.receive(stage);need(prepared?.kind==='exact-fixture-expiry-prepared','CONTROLLED_EXPIRY_FIXTURE_ACK_REQUIRED');
    stage='EXPIRED_LINK';const expired=await newTest(unchangedB.data,'recovery');
    await expired.page.goto(WEB_ORIGIN+'/auth?flow=recover&token_hash='+encodeURIComponent(expiryToken)+'&type=recovery',{waitUntil:'networkidle'});
    await expired.page.getByText('This link or session is unavailable. Open the newest email or request another link.',{exact:true}).waitFor({state:'visible'});
    await Promise.all(expired.pending);
    need(expired.verifyResponses.length===1 && expired.verifyResponses[0].status===403 && expired.verifyResponses[0].code==='otp_expired'
      && !await expired.page.locator('#securityPassword').isVisible() && new URL(expired.page.url()).search==='?flow=recover'
      && !new URL(expired.page.url()).hash && report.password_updates_forwarded===1,'REAL_EXPIRED_LINK_DENIAL_REQUIRED');
    report.cases.AU04_04={status:'CONTROLLED_EXPIRED_FIXTURE_SCOPED_PASS',actual_verify_HTTP_status:403,error_code:'otp_expired',
      new_disposable_fixture_timestamp_backdated:true,global_expiry_policy_changed:false,natural_hour_long_expiry_observed:false,
      password_view_hidden_and_URL_clean:true,password_update_not_dispatched:true};
    need(!routeProblem,'RECOVERY_BROWSER_REQUEST_BOUNDARIES_REQUIRED');complete=true;
  } catch(error) {report.problem_code=routeProblem||(error instanceof Stop?error.code:'RECOVERY_EXPECTATION_NOT_MET_'+stage);}
  finally {
    for(const test of contexts){try{await Promise.all(test.pending);await test.context.close();report.context_cleanup_count++;}catch{}}
    if(browser)await browser.close();
    for(const session of sessions.reverse()){
      try{const logout=await api('POST','/auth/v1/logout?scope=local',null,session.token);
        if([200,204].includes(logout.status)){session.cleaned=true;report.scoped_logout_acknowledgements++;}}
      catch{}
    }
    report.checks.all_isolated_contexts_closed=report.context_cleanup_count===contexts.length;
    if(mailbox && report.signup_requests>0){
      try{const cleanup=await mailbox.receive('CLEANUP');
        need(cleanup?.kind==='exact-new-fixtures-absent','EXACT_FIXTURE_CLEANUP_ACK_REQUIRED');
        report.checks.external_guarded_SQL_fixture_and_session_absence_acknowledged=true;
      }catch{report.cleanup_problem_code='EXACT_NEW_FIXTURE_CLEANUP_NOT_VERIFIED';}
    }
    report.session_cleanup_method='own_local_logout_then_guarded_new_fixture_deletion_with_external_SQL_absence_readback';
    report.checks.saved_accounts_passwords_and_settings_not_targeted=true;
    report.mailbox_polls=mailbox?.polls||0;
    if(complete && report.checks.all_isolated_contexts_closed && report.checks.external_guarded_SQL_fixture_and_session_absence_acknowledged){
      report.result='RECOVERY_VARIANTS_SCOPED_PASS';report.exit_code=0;
    }
    try{await mailbox?.status(report.exit_code===0?'SCOPED_PASS':'REVIEW_REQUIRED',report.exit_code===0?'success':'failure');}catch{}
  }
  return report;
}
