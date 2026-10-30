# Stable recovery — save password and verify sign-in

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** Prepared 28 October 2026 under existing AU04.05. This does not add an AU case or repeat the passed AU04.06 link-isolation observation.

## Owner result — 29 October 2026: scoped PASS

The owner confirms that saving the recovery password automatically opened the recovered account, the other normal app tab showed the same account, and the dashboard opened successfully after the requested sign-out/reload/new-password sign-in. All three requested W67 observations pass. Do not repeat this successful sequence. This is owner-reported hosted evidence, not a new automated test run. Provider failure/retry and other untested AU variants remain open; Batch W remains in progress.

The instructions below are retained as historical procedure, not a pending request.

## Accepted starting point

[The owner receipt](security-fr-2-batch-w-owner-stable-recovery-isolation-pass.json) reports matching requested recovery identity, clean stable URL and unchanged original signed-in dashboard. Reuse that accepted before-save view. Keep future URLs on **https://mushavo-budget-staging.pages.dev/**. The password-only backend is already installed. No ZIP, SQL, callback/settings change, email/code request or account creation is required.

## Exact owner action

Use the **existing recovery tab left open**, without refreshing it or reopening its one-use email link. Continue only if it still shows **Choose a new password**, the password form and the expected other controlled test account. If unavailable, expired or different, stop and report the screen; do not resend or reopen the link as an automatic retry.

1. Enter a **different private new password of at least eight characters**, identically in New password and Repeat new password. This updates only the displayed recovered test account's password. Keep the value private and retained by the owner.
2. Click **Save password once**. Expect automatic navigation to the stable app and the **recovered account's dashboard**, with no custom verification-code step. Completing this save intentionally adopts that account as the shared normal app session: the other normal app tab should also switch from its earlier account to the recovered account, with no old-account data left visible.
3. **Only after the correct dashboard opens**, sign out once, reload the app once, and sign in once using that recovered account's email and new password. Expect its dashboard directly.

Maximum one initial password-save click, one normal signout, one app reload and one password sign-in. If an error, unfinished-invitation/setup screen, wrong account, or stalled sign-in appears, stop and report it before any further click/retry. If the recovery form remains open, retain it without refreshing. Do not resubmit a password after an ambiguous save result. No email link, password, code or token is collected in chat.

Return **automatic recovered dashboard / other app tab switched correctly / new-password sign-in**, yes or no for each, or the actual safe displayed message.

## Source and verification scope

Current branch source was read at parent 34a5e7004b30cbc2b7e80d6612c1dab37410e43a. The accepted frontend source remains pin7005e81825049510aa8b45c08d21c42031328794; selected stable served bytes were checked in the prior stable-origin handoff, not refetched for this instruction.

- auth-security.js createLinkController.save validates password and server identity before updateUser, preserves refusal/error and passwordSaved state, and rechecks identity afterward. continueToApp requires a successful save, verified matching session and server application status before adopting it into the normal client.
- auth-flows.js password submit runs controller.save, then finishPasswordFlow/recoveryDestination. A normal recovered account opens automatically through openVerifiedAccount. An unfinished Admin invitation takes the established explicit setup path instead; this handoff does not authorize an invitation or Free-signup choice.
- Existing tests cover recovery save/automatic app opening without a code, provider strength/same-password refusal, post-write verification retry, server-status denial, adoption retry without another password write, wrong identity and unfinished invitations. Earlier 129 selected local checks remain historical passing evidence; no new runtime change or test execution is needed or claimed for this evidence-only handoff.

Earlier mismatch/same-password refusal and ordinary password-change/new-password sign-in results are preserved. This positive recovery sequence does not by itself prove an injected provider outage/retry, all session failures or full AU04.05/W acceptance. No full W/FR.2/Stage3/release/finding closure. V stays on hold, mismatch visibility stays deferred, production/native unchanged and APK deferred.
