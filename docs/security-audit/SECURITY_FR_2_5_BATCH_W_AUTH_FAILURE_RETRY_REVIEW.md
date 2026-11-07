# Batch W — Auth failure/retry review and next hosted check

Date: 29 October 2026.
Position: Stage 3 / FR.2 / FR.2.5 / Batch W.
Existing case for next owner action: AU05.05 (Auth sign-out failure). No new AU case or lettered batch.

## Completed local review

Source reviewed at a1667bca627c54347c7911f9551d8d635df6d6ea. Existing tests were run against downloaded repository source in an isolated local review directory:
`node --test tests/stage-3-auth-flows.test.mjs tests/session-recovery.test.mjs`
Runtime: Node v24.22.1. Result: 46 tests, 46 pass, 0 fail, 0 skipped, exit 0.

These tests use synthetic Auth clients and VM-extracted application functions. They cover password and link boundaries, recovery verification/adoption failure paths, same-user refresh, invalid refresh cleanup, transient network preservation, push cleanup failure, Auth sign-out failure, and delayed old-account/Business data rejection. They are local evidence only, not 46 live workflow passes or full AU/W closure. No application source changed or deployment required.

The source hides private application data before sign-out, attempts Auth sign-out despite push cleanup failure, and shows “Sign-out could not finish. Your session may still be active. Retry signing out.” on Auth failure. app.html provides a Retry sign-out button wired to signOutSafely. The next hosted check verifies this failure and recovery path.

## Preserved owner passes

W67: recovery password save automatically opened the recovered account; the other normal tab switched to that account; sign-out/reload/new-password sign-in opened the correct dashboard. All three are owner-reported passes. No repeat password write/recovery link requested.

## Next owner action — AU05.05, pending

Use the already signed-in ordinary Personal/Family dashboard at https://mushavo-budget-staging.pages.dev/. Do not use the Business or Admin console for this particular check.

1. In this Chrome tab, press Ctrl+Shift+I and select Network. In the throttling dropdown normally labelled No throttling, select Offline. Leave developer tools open. This is a temporary per-tab network simulation; do not change Supabase settings, clear storage, or expose request headers/tokens.
2. Click the app's Sign out once. Allow up to 30 seconds. Expected: private dashboard hidden, failure message stating the session may still be active, and Retry sign-out available. The failure state must not claim a confirmed successful sign-out.
3. Restore No throttling regardless of the observed outcome. Do not reload while offline. If it remained stuck or showed a different result, report that result and stop.
4. If the expected failure message and Retry sign-out appeared, click Retry sign-out once after restoring connectivity. Expected: failure notice clears and the normal sign-in screen remains. Then reload once while online: it should remain signed out.
5. Close developer tools. No password save, recovery email, or new deployment needed.

Report: offline message; dashboard hidden yes/no; online retry and reload remained signed out yes/no. If it stays busy for 30 seconds, restore No throttling and report instead of clicking again. Never send a network export, headers, password, or tokens.

This whole-tab outage may also interrupt push cleanup. It does not establish AU05.04's independent push-failure-with-successful-Auth condition. SDK/provider behavior is an observation to evaluate, not a forced PASS. Owner result is pending.

## Remaining work

Other original W requirements remain on the existing checklist: confirmation/resend; invitations; server password boundary and applicable reauthentication; remaining recovery failure/expiry variants; refresh, independent push cleanup failure, and Business/account-switch/rate variants. V/W/X/Y/Z remain open. Production/native and launch scope unchanged.
