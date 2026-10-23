// Known CDP commands only. No provider/browser error strings, URLs or target/session IDs in diagnostics.
export const workerAutoAttach={autoAttach:true,waitForDebuggerOnStart:true,flatten:true,filter:[{type:'service_worker'},{type:'worker'},{exclude:true}]};
const phases={
 'Network.enable':'NETWORK_ENABLE','Fetch.enable':'REQUEST_GUARD_ENABLE','Page.enable':'PAGE_ENABLE','Security.enable':'PAGE_SECURITY_ENABLE','Runtime.enable':'RUNTIME_ENABLE',
 'Emulation.setScriptExecutionDisabled':'DOCUMENT_SCRIPTS_DISABLE','Debugger.enable':'WORKER_SOURCE_DEBUGGER_ENABLE','Runtime.runIfWaitingForDebugger':'TARGET_RESUME'
};
export async function configurePublicTarget(cdp,{sessionId,type},failure){
 const kind=['page','service_worker','worker'].includes(type)?type:'OTHER';let phase='TARGET_KIND_CHECK';
 const call=async(method,params={})=>{phase=phases[method];return cdp.call(method,params,sessionId);};
 try{
  if(kind==='OTHER')throw Error('UNREVIEWED_BROWSER_TARGET');
  if(kind==='service_worker')await call('Runtime.runIfWaitingForDebugger');
  await call('Network.enable');await call('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});
  if(kind==='page'){await call('Page.enable');await call('Security.enable');await call('Runtime.enable');await call('Emulation.setScriptExecutionDisabled',{value:true});}
  if(kind==='service_worker')await call('Debugger.enable');
  await call('Runtime.runIfWaitingForDebugger');
 }catch(error){
  const code=['CDP_COMMAND_REQUIRED','CDP_COMMAND_TIMEOUT','CDP_CONNECTION_REQUIRED','UNREVIEWED_BROWSER_TARGET'].includes(error?.message)?error.message:'TARGET_SETUP_REVIEW_REQUIRED';
  failure({phase,target_kind:kind,problem_code:code});throw Error('BROWSER_TARGET_SETUP_REQUIRED');
 }
}
