// Fixed local synthetic fault boundaries. An arbitrary contained failure is not a named fault pass.
export const fullAppFailureContracts=Object.freeze({
 source:{checkpoint:'SIGNED_OUT_ACTUAL_APP_AND_WORKER',code:'BROWSER_SOURCE_REQUIRED'},
 begin:{checkpoint:'ONE_SYNTHETIC_EMAIL_THROUGH_ACTUAL_DOM',code:'BROWSER_CHECK_TIMEOUT'},
 verify:{checkpoint:'ONE_SYNTHETIC_EMAIL_THROUGH_ACTUAL_DOM',code:'BROWSER_CHECK_TIMEOUT'},
 rpc:{checkpoint:'REAL_APP_PRIVATE_VIEW',code:'BROWSER_CHECK_TIMEOUT'},
 open:{checkpoint:'SYNTHETIC_BOUNDED_WINDOW',code:'SYNTHETIC_LOST_COMMIT_RESPONSE'},
 close:{checkpoint:'EXPLICIT_QUARANTINE_AND_ACTUAL_APP_REFRESH',code:'SYNTHETIC_LOST_COMMIT_RESPONSE'},
 'profile-sync':{checkpoint:'REAL_APP_PRIVATE_VIEW',code:'BROWSER_NETWORK_POLICY_REQUIRED'},
 refresh:{checkpoint:'SDK_REFRESH_REQUEST',code:'BROWSER_CHECK_TIMEOUT'}
});
export function namedFullAppFailureObserved(result,scenario){
 const expected=Object.hasOwn(fullAppFailureContracts,scenario)&&fullAppFailureContracts[scenario];
 return !!expected&&result?.exit_code===1&&result.failure_checkpoint===expected.checkpoint&&result.problem_code===expected.code&&result.failure_scenario_exercised===true&&
 (scenario==='profile-sync'?result.profile_sync_request_refused===true:Array.isArray(result.injected_faults_observed)&&result.injected_faults_observed.includes(scenario));
}
