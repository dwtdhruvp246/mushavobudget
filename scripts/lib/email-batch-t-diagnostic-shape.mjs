// Public offline diagnostics: closed vocabularies only; never serialize an Error or fixture state.
const errors=new Set(['BROWSER_REQUIRED','BROWSER_INPUT_REQUIRED','BROWSER_RESPONSE_REQUIRED','BROWSER_REQUEST_GUARD_REQUIRED','BROWSER_UNREVIEWED_WORKER','BROWSER_SOURCE_REQUIRED','BROWSER_TLS_REQUIRED','BROWSER_STORAGE_REQUIRED','BROWSER_CLEANUP_REQUIRED','BROWSER_CHECK_TIMEOUT','BROWSER_EVALUATION_REQUIRED','CDP_COMMAND_REQUIRED','CDP_COMMAND_TIMEOUT','CDP_CONNECTION_REQUIRED','CDP_CONNECT_TIMEOUT','CDP_CONNECT_REQUIRED','CDP_SEND_REQUIRED','LOOPBACK_CDP_REQUIRED','COOKIE_REQUIRED','CODE_REQUIRED','EMAIL_REQUIRED','RESTORE_REQUIRED','ACCOUNT_BINDING_REQUIRED','ACTIVE_HTTP_REQUIRED','QUARANTINED_DENIAL_REQUIRED','QUARANTINE_REQUIRED','LOCAL_DIAGNOSTIC_FAILED']);
const operations=new Set(['INPUT','PUBLIC_SOURCE_INPUTS','TEMPORARY_PROFILE_CREATE','BROWSER_PROCESS_START','DEVTOOLS_ENDPOINT_READY','CDP_CONNECT_AND_VERSION','BROWSER_CONTEXT_SETUP','PAGE_CREATE_AND_ATTACH','PAGE_DOMAIN_SETUP','PAGE_NAVIGATION','PAGE_DOCUMENT_READY','PAGE_TEST_MOUNT','PUBLIC_SOURCE_FETCH_AND_HASH','EMPTY_CONTEXT_STORAGE','SESSION_PAGE_ATTACH','SESSION_MODULE_IMPORT','PASSWORD_ONLY_CHECK','EMAIL_BEGIN_ACTION','CODE_VERIFY_ACTION','REMEMBER_COOKIE_ATTRIBUTES','RESTORE_AND_ACCOUNT_BINDING','BOUNDED_BROWSER_HTTP','POST_QUARANTINE_BROWSER','BROWSER_CLEANUP']);
const methods=new Set(['Storage.getCookies','Fetch.getResponseBody','Fetch.continueResponse','Target.createTarget','Target.attachToTarget','Network.enable','Network.setBypassServiceWorker','Fetch.enable','Page.enable','Security.enable','Runtime.enable','Debugger.enable','Emulation.setScriptExecutionDisabled','Page.navigate','Page.getFrameTree','Page.setDocumentContent','Browser.getVersion','Fetch.failRequest','Fetch.continueRequest','Debugger.getScriptSource','Target.setAutoAttach','Target.createBrowserContext','Storage.setCookies','Target.disposeBrowserContext','Target.getBrowserContexts','Browser.close']);
const denials=new Set(['REQUEST_SHAPE_OR_TOTAL_BUDGET','URL_OR_JSON_PARSE','NONCANONICAL_URL','UNBOUND_PAGE_OR_RESOURCE_TYPE','ACTIVE_DEADLINE','PREFLIGHT_HEADERS_OR_METHOD','PREFLIGHT_BUDGET','BEARER_BINDING','JSON_POST_SHAPE','GATEWAY_ORIGIN_CSRF_ROUTE','SESSION_ROUTE_BUDGET','EMAIL_BUDGET','VERIFY_BUDGET','UNREVIEWED_ROUTE_OR_BODY']);
const checkpoints=new Set(['PRIVATE_INPUT','BROWSER_PUBLIC_PREFLIGHT','BROWSER_PASSWORD_ONLY','BROWSER_ONE_EMAIL_PROOF','BROWSER_RESTORE_AND_ACCOUNT_BINDING','BROWSER_ACTIVE_WINDOW_HTTP','BROWSER_POST_QUARANTINE','COMPLETE','BROWSER_INPUT','BROWSER_PUBLIC_AND_TLS_PREFLIGHT','BROWSER_ONE_EMAIL','BROWSER_HIDDEN_CODE','BROWSER_BOUNDED_ACTIVE_HTTP','READ_ONLY_MANAGEMENT_RESULT_SHAPE','FOUR_SELECTED_ACTOR_FACTS','INDEPENDENT_DEVICE_BINDING','OPEN_FIRST_ACCOUNT_FIVE_MINUTE_WINDOW','INDEPENDENT_ACTIVE_WINDOW']);
const choice=(value,allowed)=>allowed.has(value)?value:null;
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=100000?value:null;
export function diagnosticError(error){return choice(error?.safeCode,errors)??choice(error?.message,errors)??'LOCAL_DIAGNOSTIC_FAILED';}
export function safeLocalDiagnostic(result={},diagnostic={}){
 const browser=result.browser??{},guard=browser.request_guard??{};
 return {
  orchestration_exit_code:result.exit_code===0?0:result.exit_code===1?1:null,
  orchestration_checkpoint:choice(result.checkpoint,checkpoints),
  orchestration_problem_code:choice(result.problem_code,errors),
  browser_checkpoint:choice(browser.checkpoint,checkpoints),
  browser_problem_code:choice(browser.problem_code,errors),
  operation:choice(diagnostic.operation,operations),failure_operation:choice(diagnostic.failure_operation,operations),error_code:choice(diagnostic.error_code,errors),failed_cdp_method:choice(diagnostic.failed_cdp_method,methods),guard_denial:choice(diagnostic.guard_denial,denials),
  browser_product:typeof browser.browser_product==='string'&&/^(?:HeadlessChrome|Chrome|Edg)\/[0-9]{1,4}(?:\.[0-9]{1,8}){1,3}$/.test(browser.browser_product)?browser.browser_product:null,
  synthetic_direct_requests:count(result.actual_hosted_requests),synthetic_email_requests:count(result.email_request_attempts),
  browser_request_attempts:count(guard.attempts),browser_blocked_requests:count(guard.blocked),browser_preflight_attempts:count(guard.preflight_attempts),
  public_source_bytes_verified:count(browser.public_source_bytes_verified),
  executed_modules_verified:browser.executed_modules_verified===true,
  secure_remember_cookie_observed:browser.secure_fixed_deadline_remember_cookie_observed===true,
  incognito_contexts_disposed:browser.incognito_contexts_disposed===true,disposed_context_cookies_absent:browser.disposed_context_cookies_absent===true,
  browser_process_stopped:browser.browser_process_stopped===true,temporary_profile_removed:browser.temporary_profile_removed===true,browser_cleanup_verified:browser.cleanup_verified===true,
  selected_synthetic_sessions_absent:result.selected_sessions_proofs_and_challenges_absent===true,
  selected_synthetic_device_absent:result.selected_generated_device_absent===true
 };
}
