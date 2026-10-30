import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticError,safeLocalDiagnostic,localDiagnosticEvents} from '../scripts/lib/email-batch-t-diagnostic-shape.mjs';
import {startLoopbackStagingBrowser} from '../scripts/lib/browser-staging-acceptance.mjs';

test('Offline diagnostic projection drops private values, raw errors, URLs, paths, cookies and unknown fields at every exposed level',()=>{
 const privateValue='PRIVATE_SENTINEL@example.invalid';
 const result={exit_code:1,checkpoint:privateValue,problem_code:privateValue,actual_hosted_requests:3,email_request_attempts:0,privateValue,browser:{browser_product:privateValue,checkpoint:privateValue,problem_code:privateValue,request_guard:{attempts:2,privateValue},cookies:[privateValue],error:new Error(privateValue)}};
 const safe=safeLocalDiagnostic(result,{operation:privateValue,failure_operation:privateValue,error_code:privateValue,failed_cdp_method:privateValue,guard_denial:privateValue,raw:privateValue});
 assert(!JSON.stringify(safe).includes(privateValue));assert.equal(safe.browser_product,null);assert.equal(safe.operation,null);assert.equal(safe.synthetic_direct_requests,3);assert.equal(safe.browser_request_attempts,2);
 const events=localDiagnosticEvents('# BATCH_T_LOCAL_DIAGNOSTIC '+JSON.stringify({case:'positive',browser_product:privateValue,operation:privateValue,raw_error:privateValue,browser_cleanup_verified:true})+'\n# BATCH_T_TARGET_SCOPE '+JSON.stringify({variant:privateValue,raw_error:privateValue})+'\n# BATCH_T_LOCAL_DIAGNOSTIC malformed JSON\n# Arbitrary private stack '+privateValue);assert.equal(events.length,1);assert.equal(events[0].case,'positive');assert.equal(events[0].browser_cleanup_verified,true);assert(!JSON.stringify(events).includes(privateValue));
});
test('Offline diagnostic errors accept only exact fixed codes and never echo arbitrary messages or safeCode strings',()=>{
 for(const e of [new Error('TOKEN_PRIVATE'),{safeCode:'BROWSER_REQUIRED TOKEN_PRIVATE'},null,{message:'CDP_COMMAND_REQUIRED\nTOKEN_PRIVATE'}])assert.equal(diagnosticError(e),'LOCAL_DIAGNOSTIC_FAILED');
 assert.equal(diagnosticError(new Error('CDP_COMMAND_TIMEOUT')),'CDP_COMMAND_TIMEOUT');assert.equal(diagnosticError({safeCode:'COOKIE_REQUIRED',message:'PRIVATE'}),'COOKIE_REQUIRED');
});
test('Diagnostic counters reject negative, fractional, unbounded and nonnumeric values; flags require actual booleans',()=>{
 for(const value of [-1,0.5,Infinity,NaN,100001,'12',null])assert.equal(safeLocalDiagnostic({actual_hosted_requests:value}).synthetic_direct_requests,null);
 assert.equal(safeLocalDiagnostic({browser:{cleanup_verified:'true'}}).browser_cleanup_verified,false);assert.equal(safeLocalDiagnostic({browser:{cleanup_verified:true}}).browser_cleanup_verified,true);
});
test('Browser product and CDP method diagnostics are constrained to reviewed shapes and commands',()=>{
 for(const browser_product of ['Chrome/155.0.8059.79 PRIVATE','https://private.invalid','Chrome/1\nPRIVATE'])assert.equal(safeLocalDiagnostic({browser:{browser_product}}).browser_product,null);
 const safe=safeLocalDiagnostic({browser:{browser_product:'Chrome/155.0.8059.79'}},{operation:'PAGE_NAVIGATION',failure_operation:'PAGE_NAVIGATION',error_code:'CDP_COMMAND_TIMEOUT',failed_cdp_method:'Page.navigate'});
 assert.equal(safe.browser_product,'Chrome/155.0.8059.79');assert.equal(safe.failed_cdp_method,'Page.navigate');assert.equal(safeLocalDiagnostic({}, {failed_cdp_method:'Runtime.evaluate PRIVATE'}).failed_cdp_method,null);
});
test('An actual browser input failure retains its first fixed operation/error through cleanup without launching any process',async()=>{
 const port=startLoopbackStagingBrowser('relative-invalid-browser',{origin:'https://localhost:12345',api:'https://127.0.0.1:12345',publishableKey:'sb_publishable_SYNTHETIC'});
 await assert.rejects(port.preflight(),{message:'BROWSER_INPUT_REQUIRED'});const before=port.diagnostics();assert.equal(before.failure_operation,'PUBLIC_SOURCE_INPUTS');assert.equal(before.error_code,'BROWSER_INPUT_REQUIRED');
 const closed=await port.close();assert.equal(closed.cleanup_verified,true);assert.equal(port.diagnostics().failure_operation,before.failure_operation);assert.equal(port.diagnostics().error_code,before.error_code);
});
