# Code-request failure review after AU05.03 pass

**Stage 3/10 | FR.2/8 | Batch W/Z.** The owner reports **AU05.03 passed**. Record that existing transient-network case as an owner-reported PASS and do not repeat the offline exercise. The separate **Send email code** failure remains open.

[Receipt](security-fr-2-batch-w-owner-network-pass-and-code-request-failure.json). The screenshot shows Verify your sign-in with Verification is unavailable. Try again., Trust this browser checked and no code input. It supplies no address bar, request status/result or proof result. It cannot establish whether a mail call was attempted or identify the live cause.

## One safe diagnostic

Use the canonical https://mushavo-budget-staging.pages.dev/app.html in the affected existing browser/profile, preserving cookies/storage. Open F12 → Network and select the existing request whose path ends **/api/email-verification/begin** from the reported Send email code click. If no request was retained, capture one Send email code click; do not repeatedly send.

Return only the page hostname, HTTP status and the fixed **result** string from the Response tab. Do not send request headers/cookies, Authorization, tokens, codes, challenge IDs, account identifiers, full response objects or a HAR. A result such as CODE_REQUESTED must be reduced to its result string, omitting the challenge ID.

If begin returns200 VERIFIED, also inspect the following **email_gate_current_session_verified** request: report its HTTP status and boolean result (true/false), or fixed error code, only. That path can fail after begin succeeds without sending new mail. No SQL/window, credential, secret or settings change is requested until the response identifies the failing boundary.

## Interpretation from actual source

- 404 NOT_FOUND on a deployment preview is consistent with the gateway's canonical-origin check.
- 401 SIGN_IN_REQUIRED indicates the authenticated session was rejected at the gateway.
- 503 UNAVAILABLE is a generic gateway/environment/upstream failure; it does not prove a mail-provider failure.
- 503 MAIL_UNAVAILABLE is the explicit send/delivery failure path and has a distinct user-facing message.
- 200 VERIFIED followed by false/error current-session proof produces the same generic browser message; a closed bounded staging window is one possible proof-denial cause, not an established current fact.
- A missing/blocked/non-JSON request needs its safe browser status reviewed before a backend change.

The sign-out/reload correction is published at522c883f50724efdd4daf967200bc4934eeb7a51; owner package/upload receipt has not been received. That correction prevents automatic verification after explicit manual sign-out intent; it does not change the email gateway or establish successful code delivery.

No new runtime/SQL source or tests are needed to record these observations. Preserve prior154 runtime/8 package checks at their source pin, the existing31-case contract, owner normal-signin/recovery scope and all historical evidence. Related signout/failure/account-switch variants still await their scoped evidence. V Admin MFA remains ON HOLD, mismatch visibility deferred, full W/FR.2/Stage3/release/findings open, production/native unchanged, APK deferred.
