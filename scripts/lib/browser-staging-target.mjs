// Attach only to workers related to each explicitly selected test page.
// Browser/default-context component workers are outside this shared-component test.
import {workerAutoAttach} from './browser-public-target.mjs';
export async function guardStagingPageWorkers(cdp,sessionId){
 if(typeof sessionId!=='string'||sessionId.length===0)throw Error('BROWSER_INPUT_REQUIRED');
 await cdp.call('Target.setAutoAttach',workerAutoAttach,sessionId);
}
const causes=new Set(['BROWSER_UNREVIEWED_WORKER','BROWSER_REQUEST_GUARD_REQUIRED','BROWSER_SOURCE_REQUIRED','BROWSER_RESPONSE_REQUIRED','BROWSER_REQUIRED']);
export function navigationProblem(errorText,guardFailure){
 if(guardFailure)return causes.has(guardFailure)?guardFailure:'BROWSER_REQUIRED';
 if(errorText===undefined||errorText==='')return null;
 return typeof errorText==='string'&&/^net::ERR_(?:CERT_|SSL_)/.test(errorText)?'BROWSER_TLS_REQUIRED':'BROWSER_NAVIGATION_REQUIRED';
}
