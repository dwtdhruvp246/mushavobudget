# Batch W: private password-boundary and session checks

5 November 2026. Stage 3/10 → FR.2/8 → Batch W/Z. This is execution of four
existing cases from the frozen 31-case contract. No new AU group is added.

Accepted signup/confirmation/invitation/recovery-success/sign-out-retry results
are retained. The owner-deferred AU03.04 password-change failure/retry remains
deferred. No password is changed, no optional Auth setting is enabled, and no
frontend, SQL schema, production or native deployment is requested.

The finite plan is `scripts/ci/staging-run.json`; implementation is
`scripts/ci/staging-password-sessions.mjs`. The runner privately revalidates the
three designated accounts. Only its newly created sessions are used or revoked.
Session rotation is correlated by verified user/session identity so that renewed
access tokens are not miscounted as new sessions. Local logout acknowledgements
are recorded once, including when the real app signs out during a browser check.

## Frozen run scope and observable outcomes

| Existing case | Action | Required evidence and limit |
|---|---|---|
| AU03.03 | Send exactly one anonymous signup request with a seven-character test value and the already-confirmed ordinary test email. Never call password-update. | Actual server strength rejection reports minimum eight and returns no session. Generic duplicate responses, rate errors or a different minimum cannot pass. Existing browser seven/eight boundary evidence is reused. No arbitrary new recipient is used. |
| AU05.01 | Open the genuine app with a newly created ordinary session, then shorten only its local cached expiry metadata. Allow the app's existing background timer to request a real server refresh. | Real HTTP200, rotated token, unchanged verified user/session, same dashboard without the sign-in view, and renewed session retained through reload. The real JWT expiry, server configuration and clock are unchanged. This is an accelerated client-timer test, not observation of natural hour-long expiry. |
| AU05.02 | Locally revoke only the newly created second runner session, then open an isolated app context with that revoked refresh token and expired local metadata. | Actual provider invalid-refresh denial, project session removed, unrelated test storage retained, sign-in shown, private views hidden, and reload remains signed out without another refresh attempt. No synthetic server rejection or global logout. |
| AU05.04 | In another isolated context, reject the browser's service-worker registration lookup with a controlled NetworkError, then click the real app's Sign out button. | The actual app handles the independent push-cleanup error, real local Auth logout succeeds, the residual push warning is accurate, stored session clears and reload stays signed out. This injects a browser component failure; no real push subscription or protected push-row DELETE is exercised, and no push-provider failure is claimed. |

Every context is separate from the owner's Chrome session. Test Auth data exists
only inside the ephemeral CI browser and runner process. No storage state, HAR,
trace, video, browser log, raw response or credential is exported. The receipt
contains fixed classifications, booleans, counts and HTTP statuses.

Before browser work, four exact accepted public app/security source identities
are checked, including the known staging DNS substitutions in app HTML. Browser
requests allow normal reads, the reviewed read-only startup RPCs, real refresh,
local logout and the app's normal activity-recording RPC. Normal foreground
activity may therefore update analytics. Financial/profile/plan/role mutations,
workspace provisioning, mail requests and global logout are refused. The only
signup attempt is the separately bounded seven-character rejection check.

Each browser context has bounded requests and at most two refresh attempts; the
workflow keeps its eight-minute timeout, no automatic retry and one-run-at-a-time
limit. Test service workers are blocked for interception; PWA/push transport and
native acceptance are not added by these checks. Closing contexts disposes local
faults and cache metadata. Cleanup must pass before COMPLETE.

## Local verification before hosted execution

Sixteen guard checks pass, including the previous ten and new tests for rotated
session cleanup, early revocation/browser logout, unowned-session refusal,
seven-character request/true strength classification, generic/rate/minimum
rejection, unexpected-session cleanup and the session browser's mutation/mail
boundaries. Three changed runtime modules pass Node syntax checks; the workflow
parses with six private secret references and its existing finite-plan trigger.
These local checks do not constitute hosted acceptance. Record each live case's
actual receipt, including partial results or a stop, before updating its status.

Remaining W recovery/expiry/wrong-session/account-switch/rate variants, older
unbound Node-session cleanup, V/X/Y/Z and later FRs remain open. No whole W,
Stage3, finding or release closure follows from this run plan.


## Hosted result

FRE298: all four selected cases scoped PASS in [run41998406883](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/41998406883), exit0. [Safe receipt](security-fr-2-batch-w-password-session-pass.json). The first run received HTTP422/minimum8 but stopped because its parser preferred numeric code over error_code; its review receipt is retained. The parser was corrected and the guard fixture now includes both fields. The corrected run used17 direct API calls,149 browser backend requests,1 bounded short-password request and1 server-identity read, with4 normal activity RPCs included in browser traffic. It created3 sessions and acknowledged3 scoped logouts. Read-only metadata found zero rows with either exact run tag. No screenshot/trace/token/console export, app deployment or password change.
