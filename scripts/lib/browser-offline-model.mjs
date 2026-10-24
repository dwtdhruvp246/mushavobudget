// The outer page navigation must reach the active worker; fail its outbound fetch, not the page.
export function offlinePauseAction(kind,resourceType){
 if(kind==='service_worker')return 'FAIL_WORKER_FETCH';
 if(kind==='page')return resourceType==='Document'?'CONTINUE_PAGE_NAVIGATION':'CONTINUE_PUBLIC_SUBRESOURCE';
 return 'FAIL_UNKNOWN_TARGET';
}
export const offlineNavigatorState={offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1};
export function offlineViewExpression(origin){
 return `(()=>({document_class:location.origin===${JSON.stringify(origin)}&&location.pathname==='/app.html'?'EXPECTED_APP_PATH':location.protocol==='chrome-error:'?'BROWSER_ERROR':'OTHER',expected_heading_present:document.querySelector('h1')?.textContent==='Your workspace needs a connection',expected_notice_present:document.body?.textContent.includes('No financial data has been stored')===true,navigator_online:navigator.onLine}))()`;
}
