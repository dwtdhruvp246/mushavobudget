// Owner-run staging check for existing AU05.01. Not a deployed application module.
export async function checkSameUserRefresh({origin,ready,config,loadSDK}) {
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
