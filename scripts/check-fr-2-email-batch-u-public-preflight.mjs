// Public startup only, before any packet selection or credential prompt.
import path from 'node:path';
import {startFullAppStagingBrowser} from './lib/full-app-staging-browser.mjs';
import {parseStagingConfiguration} from './prepare-fr-2-email-edge-batch-a.mjs';
let browser,problem=null,configAttempts=0;
try{
 if(process.argv.length!==3||!path.isAbsolute(process.argv[2]))throw Error('BROWSER_INPUT_REQUIRED');
 configAttempts++;const response=await fetch('https://mushavo-budget-staging.pages.dev/config.js',{redirect:'error',signal:AbortSignal.timeout(30000)});
 if(response.status!==200)throw Error('PUBLIC_CONFIGURATION_REQUIRED');
 const text=await response.text();if(Buffer.byteLength(text)>65536)throw Error('PUBLIC_CONFIGURATION_BOUND');
 const config=parseStagingConfiguration(text);browser=startFullAppStagingBrowser(process.argv[2],{publishableKey:config.supabasePublishableKey});await browser.preflight();
}catch(e){problem=/^(?:BROWSER_|FULL_APP_|CDP_|PUBLIC_)[A-Z0-9_]+$/.test(e?.message||'')?e.message:'PUBLIC_PREFLIGHT_REQUIRED';}
const result=await browser?.close();const ok=!problem&&result?.normal_hosted_TLS_verified&&result.actual_app_HTML_and_bootstrap_executed&&result.cleanup_verified;
console.log(JSON.stringify({stage_step:'FR.2.4.E5.34_BATCH_U_FULL_APP_BOOTSTRAP_PRIVATE_CACHE_AND_SESSION_LIFECYCLE',progress_display:'Stage 3/10 | FR.2/8 | Batch U/Z',scope:'HOSTED_PUBLIC_FULL_APP_PREFLIGHT_ONLY',result:ok?'BATCH_U_PUBLIC_STARTUP_SCOPED_PASS':'BATCH_U_PUBLIC_STARTUP_REVIEW_REQUIRED',browser:result||null,public_config_GET_attempts:configAttempts,actual_management_requests:0,Auth_password_signin_attempts:0,real_email_requests:0,private_packets_or_credentials_accessed:false,committed_mode_change_requests:0,hosted_acceptance:false,production_or_native_changed:false,checkpoint:ok?'COMPLETE':'PUBLIC_STARTUP',problem_code:problem,exit_code:ok?0:1,checked_UTC:new Date().toISOString()},null,2));process.exitCode=ok?0:1;
