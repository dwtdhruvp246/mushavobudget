# Current UI accepted; next Auth case

Stage 3/10 | FR.2/8 | Batch W/Z. 27 October 2026, FRE236.

The owner accepts the current checking screen for this version and asks to move on. Faster background verification with a professional sign-in presentation is explicitly deferred as `UX_AUTH_BACKGROUND_VERIFICATION`. Future work should keep a minimal Signing in indicator for trusted-browser checks, show the code form only when interaction is required, and measure latency before choosing a performance target. All server proof, actor/token, revocation and Admin MFA checks must remain. There is no runtime change or upload for this decision.

The prior current-signin/dashboard transition remains an owner-reported scoped pass. The separate fresh sign-out/password-signin-without-code cycle is still not explicitly reported; accepting the presentation does not retroactively verify that case. Do not ask the owner to repeat it now as a condition for moving to independent cases.

The new-browser code test is queued. The actual staging recipient list and current acceptance-window deadline are not observed. `createZohoCodeMailer` checks exact lowercased membership in `ZOHO_TEST_RECIPIENTS_JSON`; receiving signup confirmation mail or owning the base Gmail inbox does not establish that a new alias is enabled for gateway code dispatch. Resolve that prerequisite before a later controlled code-send test. No allowlist/settings change or send is requested here.

The next independent existing case is **AU03.02 — Invalid credentials**, using a known confirmed test email with a password the owner knows is wrong. This does not require an application acceptance window: failure must occur at password authentication before app verification/protected access. Do not open or extend a window to run it.

Owner steps:

1. Use a private/browser context that is currently signed out, then open https://mushavo-budget-staging.pages.dev/app.html?auth=manual. Keep the original trusted-browser data intact.
2. Enter the same test email that reached the dashboard, with an intentionally wrong password of at least eight characters so input validation does not substitute for the credential check.
3. Click Sign in once. Expected: `The email or password was not accepted. Check both and try again.` Remain signed out with no dashboard or code step.
4. Return the displayed error and whether dashboard access stayed denied. Keep the password private. Close the separate test context after reporting. Do not repeatedly try bad passwords or request mail if an unexpected screen appears.

Preparation is based on the existing app.js signIn handler and auth-security.js invalid_credentials mapping. No new code was introduced, so no new tests were written or prior suites repeated. This handoff is not a hosted AU03.02 pass until the owner's result arrives; it does not independently establish all invalid-email/password variants, provider rate thresholds or session security.

The frozen31-case AU contract is unchanged. Batch V Admin MFA remains on hold. Full W, FR.2, Stage3, release acceptance and all findings remain open; production/native unchanged and APK work deferred.
