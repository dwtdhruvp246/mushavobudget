# Current handoff — stable staging address, 28 October 2026

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** The owner explicitly chooses **https://mushavo-budget-staging.pages.dev/** for all remaining staging checks. Use this stable origin for instructions, links and recovery requests. The deployment-specific instructions retained below are historical and superseded; do not request another preview callback or repeat the accepted shared-tab cycle.

## Read-only serving check

Independent public HTTPS reads on 28 October 2026 show:

- Stable and accepted e39c66dd app pages are byte-identical (SHA256 `df9216d3ce1c4717c1e6467a5beed11bed83b45020ded63ae13fd3c034e8d4d7`), both referencing `app.js?v=122`. Cloudflare redirects `app.html` to `app`.
- Both origins serve the same JavaScript at that reference, SHA256 `edfced2f479edaf34bdfce1daac5448157cb4b957ee0de631326a3441d4e9a1e`, matching the accepted shared-tabs source manifest.
- Both origins serve byte-identical recovery HTML, SHA256 `966e2b8e7a10c429c134fb2fa44a83f112c3ae0ca8db118baeb3cbe6a5c8f1dc`. Cloudflare redirects `auth.html` to `auth`.
- Stable `auth-security.js` (`6deb33eb3a976b40e090e94f12c0d028403a1438a7cc11b85acad0ec76229a42`), `auth-flows.js` (`3bf445e67347e57f4f746e22baaa16866fd3ecb5570342d729fed8bbe4c47720`) and `config.js?v=27` (`be23e23251470da5a1caa5c19f9af46763aa9192dee62e96700c317c479cc74c`) match the retained manifest entries. These JavaScript responses have JavaScript content types. Config points to staging project `dczlddwbtgvfdujgcitb`.
- [The existing settings screenshot receipt](security-fr-2-batch-w-owner-settings-screenshots.json) shows the exact stable recovery callback and canonical Site URL. This remains prior visual metadata evidence, not a new Auth configuration API readback.

No frontend upload, SQL rerun, callback addition, settings change, password write, recovery-email request or Auth-session operation was performed in this read-only serving check. No new runtime tests or browser AU passes are claimed. The accepted three-step shared-tab result remains the owner's earlier e39c66dd observation. Public byte parity does not establish new browser-session acceptance.

## Continue existing AU04.06 on the stable origin

1. Open [the stable app](https://mushavo-budget-staging.pages.dev/app.html), sign in with one existing controlled test account if needed, and keep that dashboard open in tab B.
2. In a separate normal tab in the same browser/profile, open [the stable recovery request page](https://mushavo-budget-staging.pages.dev/auth.html?flow=request-recovery). Request **one** recovery email for the **other existing confirmed controlled test account**, different from B's account.
3. Open the newest matching Reset password link **once** in that browser/profile. Expect Choose a new password and the requested other account's email. **Stop before entering or saving a password, or choosing account continuation.**
4. Verify the recovery address stays on **mushavo-budget-staging.pages.dev**, at `auth.html?flow=recover` or the accepted extensionless `auth?flow=recover`, with no visible Auth code/token parameters or fragment. Return to B without refreshing or submitting anything; its account/dashboard should remain unchanged.

Report **recovery identity matches / stable URL clean / B unchanged**, yes or no for each. If an error, wrong origin, missing delivery or unavailable form appears, report it without resending or reopening the one-use link. Keep recovery links, passwords, codes, tokens and private account values out of chat. Leave the recovery result open. If there is no other controlled test account, report that blocker; no signup is needed.

No repeat Supabase setup is requested: the stable callback is already in prior evidence. No full AU04.06 or whole-W acceptance is inferred before the owner's observations. All original AU definitions/history, deferred mismatch visibility, V hold, signup-confirmation requirement and existing session/role/tenant controls remain. Full W/FR.2/Stage3/re-audit/release/findings remain open; production/native unchanged, APK deferred.

---

## Historical preview handoff — superseded for future URLs

# Shared tabs pass; recovery isolation on the current deployment

**Stage 3/10 | FR.2/8 | Batch W/Z — IN PROGRESS.** [Owner receipt](security-fr-2-batch-w-owner-shared-tabs-cycle-pass.json) explicitly reports all three shared normal-tab steps PASS on e39c66dd: initial sign-in opens both dashboards, signout sends both to sign-in, and a new sign-in opens both automatically without refreshing the other tab. This accepts the corrected ordinary shared-tab variant of AU05.06 at owner browser-observation scope. Do not repeat it or infer exact speed, actual in-flight/Business scope, server JWT revocation or the whole frozen case. Keep the prior observations under the superseded manual-tab rule as history.

Normal app tabs now intentionally follow the same session. The dedicated recovery page still uses a separate client/storage namespace until a successful intended password reset/adoption. The existing AU04.06 check therefore remains meaningful: a valid recovery link for another controlled account must not replace the currently signed-in normal account before password saving.

## Current-origin callback, then one real recovery link — AU04.06

The upload changed the preview origin. The earlier owner-saved f8c4b8d6 recovery entry does not establish callback readiness for e39c66dd. No new frontend or SQL change is needed.

1. In Supabase **Mushavo Budget Staging**, project **dczlddwbtgvfdujgcitb**, open **Authentication > URL Configuration > Redirect URLs**. Check for **https://e39c66dd.mushavo-budget-staging.pages.dev/auth.html?flow=recover**. If absent, add exactly this one entry and save; preserve existing entries and Site URL. Reload and verify it is listed. If already listed, do not add a duplicate. If saving/readback fails or is uncertain, report that state and stop before requesting email. Do not add a wildcard or other flow/origin entry; no current list count is assumed.
2. Keep the current e39c66dd normal dashboard signed in in B. In a separate normal C in the same browser/profile, open [the current recovery request page](https://e39c66dd.mushavo-budget-staging.pages.dev/auth.html?flow=request-recovery). Enter the email of your **other existing confirmed test account you control**, distinct from the account displayed in B, and select **Send link once**. This requests one Auth recovery email. If unavailable/error/no delivery, report the result without resending; a generic acknowledgement alone does not prove delivery.
3. From the newest matching recovery email, open **Reset password once** in that same browser/profile. Expect **Choose a new password**, the verified email of the requested other account, and the new/repeat-password form. **Stop before entering or saving a password or choosing account continuation.** An isolated Auth session exchange is expected when the valid link is opened; no password write or normal app-session adoption is requested.
4. Check that the resulting page remains on **e39c66dd.mushavo-budget-staging.pages.dev** with **auth.html?flow=recover** or the accepted extensionless **auth?flow=recover**, without visible Auth code/token parameters or a token-bearing fragment. Then return to B without signing out, refreshing or submitting anything: B must still show the same signed-in account/dashboard. Leave the recovery result page open without refreshing or reopening the one-use link.

Report **callback listed after reload / recovery identity matches / current-preview URL clean / B unchanged**, yes or no for each, or the displayed error. Keep complete recovery links, passwords, codes, tokens and private account/financial values out of chat. If there is no second existing controlled account, report that blocker instead of creating one. Maximum one exact callback addition if missing, one recovery request and one email-link open; password saves zero.

The auth-security.js/auth-flows.js/recovery-page entries are among the forty byte-preserved entries in the accepted shared-tabs ZIP; the app-side synchronization change does not relax their isolated verification/adoption guards. Earlier 129 local tests retain source pin7005e81825049510aa8b45c08d21c42031328794; no source change or new test run is needed. This is existing AU04.06; any current-origin delivery/view observation under AU04.01/AU04.02 is credited only when reported. Full recovery/password-save/failure/timeout/invitation or whole-W acceptance is not inferred.

Preserve original31 AU definitions and all earlier events/results, including AU05.03 owner PASS. Custom sign-in codes/trusted-browser prompts stay removed for all users; signup confirmation and server session/role/tenant controls remain. V stays on hold with policy reconciliation before future factors; stronger-MFA criteria stay unmet. Password-mismatch visibility remains deferred. Full W/FR.2/Stage3/re-audit/release/findings stay open; production/native unchanged, APK deferred.