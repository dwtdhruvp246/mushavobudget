# Batch W — AU05.01 same-user refresh

29 October 2026. Stage 3 / FR.2 / FR.2.5 / Batch W. Existing AU05.01 only.

## Current owner route — native automatic refresh observation

The owner screenshot image(20261029-091242).png shows Chrome's self-XSS paste warning and the signed-out app, without check output. No execution or refresh outcome is credited. Keep console pasting protection enabled; the earlier explicit console route below is historical preparation, not the current owner action.

For the same original AU05.01 case: sign into the controlled ordinary account on stable staging, with two normal tabs displaying that same dashboard and Network set to No throttling. In the first tab's Network panel enable Preserve log, select All and filter refresh_token. Leave the app open, computer awake and connected. Observe its native token?grant_type=refresh_token request and HTTP status, without opening or sharing headers, request payloads or response bodies. No reload/sign-out while waiting. The recorded token lifetime was 3600 seconds; a newly signed-in session may take around an hour to reach renewal. This is an estimate based on that recorded setting, not a verified current hosted deadline. Once the request completes, report status and whether both tabs retain the same account/dashboard before refreshing, then whether one online reload opens that same dashboard. If no request appears after about an hour or any error appears, report that and stop; do not change settings or manufacture expiry. A 200 alone is insufficient for full case closure without the dashboard observations. Owner outcome remains pending. No new AU cases, product change, upload or settings action.

## Accepted previous result

AU05.05 scoped hosted PASS: version123 offline sign-out warning, connectivity restoration and Retry sign-out action confirmed by owner, warning cleared without refresh, subsequent reload remained signed out. Do not repeat.

## Scope and preparation

The existing full-app-staging-browser.mjs harness requests a real SDK refresh with a temporary client using the normal storage namespace, automatic refresh disabled on that temporary client, and verifies both application tabs rebound. Current app.js imports Supabase JS 2.110.9 and handles a changed token for the same actor by clearing stale load state and reloading the authenticated workspace.

The owner check below uses that SDK method on the signed-in staging session, once at the coordinator level, then calls server getUser with the returned access token. SDK internals may have their own retry behavior; no exact network request count is claimed. It checks same actor and session_id, changed access token, server-verified user, and never logs the session/token/identity values. A missing session, malformed token, wrong origin/project, failed API, wrong user/session or unchanged access token stays REVIEW_REQUIRED.

This is an explicit SDK refresh test. It does not establish the natural automatic refresh timer or a prolonged idle/expiry window. The temporary client shares the normal app session and refreshes its credentials; it does not ask for a password or send mail. A second GoTrueClient diagnostic may appear because the app already has a client. Reload the tested page after observations to dispose the temporary client. No settings, deployments or finance-record edits are required.

Eight local synthetic coordinator tests passed, zero failed/skipped, Node v24.22.1, exit0. These are not hosted refresh evidence. The real owner result remains pending.

## Owner actions

1. On https://mushavo-budget-staging.pages.dev/ with Network set to No throttling, sign into the controlled ordinary test account if needed. Keep two normal tabs showing that same account's Personal/Family dashboard.
2. In the first tab's Developer Tools Console, paste the complete block below and run it once. This runs in the staging browser, not PowerShell. If the browser blocks pasted code, report that rather than changing its protections.
3. Wait for the safe JSON result. If REVIEW_REQUIRED or a stalled result occurs, do not rerun; report the checkpoint.
4. Observe both dashboards without refreshing them: same intended account, and dashboard content available after any brief reload. Copy only the JSON emitted by this check; do not copy expanded network/SDK/session objects.
5. After observing the dashboards, reload the first tab once online to dispose the temporary client. Confirm the same account's dashboard still opens. Do not sign out as part of this test.

Return the safe JSON and first-tab same account/dashboard, second-tab same account/dashboard, and online reload same account/dashboard as yes/no.

```javascript
(async () => {
  async function checkSameUserRefresh({origin,ready,config,loadSDK}) {
    const result={case:"AU05.01",result:"REVIEW_REQUIRED",checkpoint:"SCOPE",
      explicit_refresh_calls:0,refresh_completed:false,access_token_changed:false,
      same_verified_user:false,same_session:false,automatic_timer_observed:false};
    try {
      if(origin!=="https://mushavo-budget-staging.pages.dev" || !ready ||
         config?.supabaseUrl!=="https://dczlddwbtgvfdujgcitb.supabase.co" ||
         typeof config.supabasePublishableKey!=="string" || !config.supabasePublishableKey) return result;
      result.checkpoint="SDK";
      const {createClient}=await loadSDK();
      const client=createClient(config.supabaseUrl,config.supabasePublishableKey,
        {auth:{persistSession:true,autoRefreshToken:false,detectSessionInUrl:false}});
      result.checkpoint="EXISTING_SESSION";
      const before=await client.auth.getSession();
      if(before.error || !before.data?.session?.user?.id) return result;
      const first=before.data.session;
      const claims=token=>JSON.parse(atob(token.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
      const initial=claims(first.access_token);
      if(initial.sub!==first.user.id || typeof initial.session_id!=="string" || !initial.session_id) return result;
      result.checkpoint="REFRESH";
      result.explicit_refresh_calls=1;
      const refreshed=await client.auth.refreshSession();
      if(refreshed.error || !refreshed.data?.session?.access_token) return result;
      const next=refreshed.data.session;
      result.refresh_completed=true;
      result.access_token_changed=next.access_token!==first.access_token;
      const renewed=claims(next.access_token);
      result.same_session=renewed.session_id===initial.session_id;
      result.checkpoint="SERVER_IDENTITY";
      const verified=await client.auth.getUser(next.access_token);
      result.same_verified_user=!verified.error && verified.data?.user?.id===first.user.id &&
        next.user?.id===first.user.id && renewed.sub===first.user.id;
      if(result.access_token_changed && result.same_verified_user && result.same_session) {
        result.result="PASS_REFRESH_UI_CHECK_PENDING";
        result.checkpoint="OWNER_DASHBOARD_CHECK";
      }
      return result;
    } catch (_error) {
      // Never print SDK response bodies, session objects, tokens or account identifiers.
      return result;
    }
  }
  
  const dashboard = document.querySelector('#appView');
  const result = await checkSameUserRefresh({
    origin: location.origin,
    ready: !!dashboard && !dashboard.classList.contains('hidden'),
    config: window.MUSHAVO_BUDGET_CONFIG || window.EXPENSE_TRACKER_CONFIG,
    loadSDK: () => import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm')
  });
  console.log(JSON.stringify(result, null, 2));
})();
```

## Completion rules

Only accept the requested live scope after the result and owner dashboard observations. Keep automatic-timer evidence distinct and carry it within original AU05.01; no additional AU case, lettered batch or scope is introduced. AU05.02 invalid-refresh, AU05.04 independent push failure, AU05.06 Business/in-flight clearing, AU05.07 supported rate/stale-token scope and all other W requirements remain on the existing checklist. Full Batch W/FR.2/Stage3/release acceptance stays open.
