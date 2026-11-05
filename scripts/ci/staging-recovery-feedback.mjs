import { createHash } from 'node:crypto';
import { WEB_ORIGIN, API_ORIGIN, Stop, need } from './staging-access.mjs';
import { recoveryFixtures } from './staging-recovery-fixtures.mjs';
const GENERIC='If your account can receive this link, check your inbox for the newest email. Wait a minute before requesting another.';
const NETWORK='The request could not finish. Check your connection and try again.';
const RATE='Too many attempts. Wait before trying again.';
const SOURCES={'/auth':'4f110e101a1bdf2ae7019fb227a0fc4dc579facd','/auth-flows.js':'74c3bcb1dc6ef2494f327460ff6cef9866b527c3',
  '/auth-security.js':'eadce63c4b7166166236e2466c11d421f28a0229','/session-entry.js':'b9d0a517c64174ecbd8f78fff273694f2655692d'};
export function recoveryFeedbackDecision(url,method,mode){
  const u=new URL(url);
  if(u.origin===API_ORIGIN && u.pathname==='/auth/v1/recover' && method==='POST'
    && ['absent','blocked','rate'].includes(mode))return mode;
  if(method==='GET' && [WEB_ORIGIN,'https://cdn.jsdelivr.net'].includes(u.origin))return 'public';
  return 'refuse';
}
export async function checkRecoveryFeedback({accounts,evidence},chromium,agent,plan,fetcher=fetch){
  const fixtures=recoveryFixtures(plan.fixture_run_id),contexts=[];
  let browser,routeProblem=null,stage='SOURCE';
  Object.assign(evidence,{case_ids:['AU04.01','AU05.07'],status:'REVIEW_REQUIRED',checks:{},
    absent_recipient_recovery_requests:0,existing_recipient_recovery_requests:0,blocked_recovery_requests:0,
    synthetic_HTTP_429_responses:0,refused_unplanned_requests:0,actual_email_delivery_measured:false,
    actual_provider_429_or_Business_Edge_502_exercised:false,known_recipient_generic_acknowledgement:'retained_owner_acceptance',
    settings_or_password_or_profile_writes:0,disposable_accounts_created:0,
    legacy_short_ordinary_password_candidate_available:['USER_A','USER_B'].some(slot=>Array.from(accounts[slot].password).length<8),
    legacy_short_Admin_password_candidate_available:Array.from(accounts.ADMIN.password).length<8});
  try{
    for(const[path,expected]of Object.entries(SOURCES)){
      const response=await fetcher(WEB_ORIGIN+path,{redirect:'error',signal:AbortSignal.timeout(20000)});
      need(response.status===200,'RECOVERY_FEEDBACK_PUBLIC_SOURCE_REQUIRED');const bytes=Buffer.from(await response.arrayBuffer());
      need(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex')===expected,'RECOVERY_FEEDBACK_ACCEPTED_SOURCE_REQUIRED');
    }
    evidence.checks.four_accepted_deployed_sources_verified=true;
    browser=await chromium.launch({headless:true});
    for(const mode of ['absent','blocked','rate']){
      stage=mode.toUpperCase();const email=mode==='absent'?fixtures.UNKNOWN:accounts.USER_A.email;
      const context=await browser.newContext({serviceWorkers:'block',userAgent:agent+'/recovery-'+mode});contexts.push(context);
      context.setDefaultTimeout(20000);let forwards=0,interceptions=0;
      await context.route('**/*',async route=>{
        const request=route.request(),action=recoveryFeedbackDecision(request.url(),request.method(),mode);
        if(action==='public'){await route.continue();return;}
        let body;try{body=request.postDataJSON();}catch{}
        if(action==='refuse' || body?.email!==email){evidence.refused_unplanned_requests++;routeProblem='UNPLANNED_RECOVERY_FEEDBACK_REQUEST_REFUSED';await route.abort('blockedbyclient');return;}
        if(++interceptions>4){routeProblem='RECOVERY_FEEDBACK_ATTEMPT_BOUND_REACHED';await route.abort('blockedbyclient');return;}
        if(action==='absent'){
          if(++forwards>1 || ++evidence.absent_recipient_recovery_requests>1){routeProblem='ABSENT_RECOVERY_REQUEST_BOUND_REACHED';await route.abort('blockedbyclient');return;}
          await route.continue();return;
        }
        if(action==='blocked'){evidence.blocked_recovery_requests++;await route.abort('internetdisconnected');return;}
        evidence.synthetic_HTTP_429_responses++;
        await route.fulfill({status:429,contentType:'application/json',headers:{'access-control-allow-origin':'*'},
          body:JSON.stringify({code:429,error_code:'over_email_send_rate_limit',msg:'Controlled rate boundary'})});
      });
      const page=await context.newPage();await page.goto(WEB_ORIGIN+'/auth?flow=request-recovery',{waitUntil:'networkidle'});
      await page.locator('#securityEmail').fill(email);const send=page.getByRole('button',{name:'Send link',exact:true});
      let status=null;
      if(mode==='absent'){
        const[response]=await Promise.all([page.waitForResponse(r=>new URL(r.url()).origin===API_ORIGIN&&new URL(r.url()).pathname==='/auth/v1/recover'),send.click()]);
        status=response.status();need(status===200,'ABSENT_RECOVERY_GENERIC_HTTP_200_REQUIRED');
      }else await send.click();
      await page.getByText(mode==='absent'?GENERIC:mode==='blocked'?NETWORK:RATE,{exact:true}).waitFor({state:'visible'});
      need(await page.locator('#securityRequest').isVisible() && await page.locator('#securityEmail').inputValue()===email
        && await send.isEnabled() && !routeProblem,'RECOVERY_FEEDBACK_FORM_RETENTION_REQUIRED');
      const before=interceptions;await send.click();await page.getByText(RATE,{exact:true}).waitFor({state:'visible'});
      need(interceptions===before,'RECOVERY_LOCAL_COOLDOWN_MUST_NOT_DISPATCH');
      evidence.checks[mode+'_feedback_and_retained_form']=true;
      evidence.checks[mode+'_local_cooldown_prevented_repeat_dispatch']=true;
      if(mode==='absent')evidence.absent_recipient_HTTP_status=status;
    }
    need(!routeProblem && evidence.absent_recipient_recovery_requests===1 && evidence.blocked_recovery_requests>=1
      && evidence.synthetic_HTTP_429_responses===1,'RECOVERY_FEEDBACK_BOUNDARIES_REQUIRED');
    evidence.status='RECOVERY_REQUEST_FEEDBACK_AND_SYNTHETIC_RATE_UI_SCOPED_PASS';
  }catch(error){evidence.problem_code=routeProblem||(error instanceof Stop?error.code:'RECOVERY_FEEDBACK_EXPECTATION_NOT_MET_'+stage);throw new Stop(evidence.problem_code);}
  finally{
    let closed=0;for(const context of contexts){try{await context.close();closed++;}catch{}}
    if(browser)await browser.close();evidence.checks.all_isolated_contexts_closed=closed===contexts.length;
    need(evidence.checks.all_isolated_contexts_closed,'RECOVERY_FEEDBACK_CONTEXT_CLEANUP_REQUIRED');
  }
}
