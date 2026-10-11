# 3.5.2 — Auth compatibility candidate and staging readiness handoff

**Complete at source/local scope — 11 October 2026, S3E23.** Candidate code is pinned at `227264fddc59dc89d9c42b3778f481bab8e433e0` on `security/stage-3-authorization`, based on the [3.5.1 review](SECURITY_STAGE_3_5_AUTH_FLOWS.md). **111 local tests PASS, exit 0; six syntax checks PASS.** Two of three 3.5 milestones now have outcomes. Next is **3.5.3**, one read-only staging readiness receipt followed by bounded acceptance or recorded blockers.

No hosted Auth, SMTP, browser, JWT or API acceptance was performed. No settings were changed, emails dispatched, existing synthetic passwords changed, SQL installed, frontend/Edge deployed, production promoted or native bundle rebuilt by this work. F08/F15 remain OPEN; Stage 3's full report stays due at **3.6**.

## Candidate changes

| Area | Prepared behavior | Remaining acceptance |
|---|---|---|
| New passwords | Shared 12-character minimum and confirmation check for signup, recovery and password change. Sign-in has no creation-only minimum and still submits valid older credentials. Auth remains the server enforcement authority. | Actual backend minimum/character rules and secure-change settings must match before activation; browser validation alone does not strengthen the Auth endpoint |
| Signup and confirmation | Dedicated `auth.html?flow=confirm` destination. No-session and duplicate signup use the same generic confirmation-pending destination; duplicate signup does not send an extra reset email. Ordinary signup uses isolated tab storage. Explicit confirmation-resend link is available. | Real confirmation enabled/disabled behavior, mail delivery/template destination and unconfirmed sign-in denial |
| Recovery | Dedicated request and new-password views. Link material is captured then removed before asynchronous verification. A URL flag with no link material cannot reuse an existing app session. Server `getUser` checks identity and verified email; password-save failure is retryable. | Genuine link exchange, expiry/replay, token/session lifetimes and server password enforcement |
| Session transfer | Confirmation/recovery/Business link sessions use a separate tab storage namespace. Opening the verified account requires a checkbox and explicit Continue action explaining replacement of another app account. Transfer checks the adopted server identity; local link copy is removed without server logout. | Real SDK storage/broadcast/refresh behavior and cross-tab account replacement |
| Signed-in password change | Snapshot the displayed identity into a separate memory-only client. Check the normal active identity before and after saving; hide the form on account switch. Support nonce verification and optional `current_password`. | Genuine recent-login/current-password requirements, reauthentication email and refresh continuity |
| Admin invitations | Existing isolated invitation verification, recipient guards, password-before-completion, transactional completion and retry are retained. Ordinary recovery offers an explicit Free personal-signup choice only for a server-confirmed unfinished invitation; it never silently cancels one. Legacy shared-route ordinary users get sign-in/recovery guidance. Known errors use safe messages and raw SDK objects are no longer logged by reviewed signup handlers. | AM-R01–AM-R05 blockers and hosted invitation setup/expiry/replacement/idempotence |
| Business invitations | Existing recipients receive OTP to `flow=business-existing` and never enter a password-overwrite branch. New recipients receive `flow=business-new`; pending recipient/expiry is checked through server RPC before first-password write and again before transfer. Membership acceptance stays in the existing Business page/SQL flow. | Earlier Business fixture/source-guard blocker, new/existing controlled inboxes, actual subscription/seat/role/scope behavior |
| Legacy callbacks | Old Business Auth callbacks and ordinary recovery callbacks on app.html are handed to the isolated page before normal-client initialization. Ordinary workspace links remain unchanged. | Existing issued links, actual template types and PKCE verifier availability |
| Sign-out and account switching | Push cleanup failure no longer prevents Auth sign-out; failures remain explicit. A failed Auth sign-out does not claim success or erase its active-session warning. Business logout does not redirect on failure. Both controllers invalidate delayed old-account query results and hide/clear protected state on account changes. Password sign-in ignores only its own SIGNED_IN event. | Live failure timing, realtime/browser state, residual JWT validity and device cleanup; a request already sent before a switch is not assumed cancelled server-side |
| Staging preparation | New pin-required builder includes Auth and existing Admin MFA files, strips production references, disables push and validates all source assets before creating output. | Real repository build/hosting and coordinated frontend/Edge/Auth activation; no native wrapper integration is claimed |

The new route/mode values select UX only. Supabase identity, existing RLS/RPC checks and server invitation state remain authoritative. This candidate adds no role, scope, SQL grant or alternate membership-acceptance permission. First-password UI is not a new server authorization gate.

## Source files

- [Shared control](../../auth-security.js), [page controller](../../auth-flows.js), [account security page](../../auth.html).
- [Application](../../app.js)/[page](../../app.html), [signup](../../signup.html), [Business controller](../../business.js)/[page](../../business.html).
- [Business invitation Edge handler](../../supabase/functions/invite-business-member/index.ts).
- [Local verifier](../../scripts/verify-stage-3-auth.mjs), [staging builder](../../scripts/build-stage-3-auth-staging.cjs), [read-only readiness script](../../scripts/run-stage-3-auth-readiness.ps1).
- [Local receipt](security-stage-3-auth-local-checks.json).

Web source script references advance app.js to v114 and business.js to v19; the new Auth modules use v1. Existing service-worker safe-shell behavior is unchanged; Auth callbacks are not added to its offline cache. Native build allowlist/integration and real native Auth callbacks remain deferred.

## Local validation

| Evidence | Count and scope |
|---|---|
| New controller/application VM cases | 40 PASS: password boundary, safe errors, capture/sanitization, absent/wrong/expired link, verified identity, explicit transfer, Business state/recipient, nonce/current password, retries, logout failures, account switching and delayed results |
| Actual page module in a mocked DOM/SDK | 7 PASS: recovery/confirmation states, explicit transfer, unfinished invitation choice, generic requests/cooldown, resend and memory-only change identity |
| Actual Business Edge handler with mocked SDK/mail adapter | 3 PASS: new/old recipient destinations and reservation denial before service dispatch |
| Builder in synthetic local Git repositories | 3 PASS: required assets/staging rewriting/push disabled, rejected keys/project selection, missing asset fail-before-output |
| Selected existing regressions | 58 PASS: original 35 Auth/signup cases, 7 invitation isolation/provision guard cases and 16 MFA/controller/Edge cases |
| Syntax | 6 PASS: four browser modules, staging builder and signup inline module |

Total **111 PASS / 0 FAIL**, Node exit **0**. The prior first-statement reset assertion was replaced by execution of the real reset body, checking button reuse, session/data clearing and epoch invalidation. Startup's deduplication assertion was updated for expected-email matching; a new behavioral test checks a different account arriving during password sign-in.

The SDK API shape was reviewed against **Supabase JS v2.110.9**, official source commit `31dc1b0f4e9b21adb056cb799a2702bf1484919f`: [UserAttributes](https://github.com/supabase/supabase-js/blob/v2.110.9/packages/core/auth-js/src/lib/types.ts) includes `nonce` and `current_password`; [GoTrueClient](https://github.com/supabase/supabase-js/blob/v2.110.9/packages/core/auth-js/src/GoTrueClient.ts) provides `reauthenticate()` and storage-key-scoped broadcast. This is pinned source compatibility, not a real SDK/GoTrue/browser execution claim. No SDK upgrade is included.

The PowerShell handoff was reviewed as source; Windows execution is not verified in this environment. Initial missing files in this partial checkout were fetched from the reviewed pin before the final test run. No missing-file check is counted as a product failure or PASS. There is no new modeled database test or Deno runtime/deployment claim.

Reproduce locally from a complete checkout of the candidate:
```powershell
node .\scripts\verify-stage-3-auth.mjs
```
Expected: `AUTH_CANDIDATE_LOCAL_SCOPED_PASS`, tests/pass 111, fail 0, exit_code 0, syntax_checks 6; all hosted/deployment acceptance fields false.

## 3.5.3 — Current owner action: read-only dashboard summaries

**Environment: STAGING `dczlddwbtgvfdujgcitb` only.** Do not change a setting, send an email, reset an account, run SQL, install the MFA candidate, deploy/upload this candidate or rebuild an APK for this handoff.

The script opens the staging project dashboard and asks for Y/N/U summaries of values you inspect. It cannot read protected Auth settings itself; the output is owner-reported metadata, not independent acceptance. **U is a valid answer when a value or prerequisite is unavailable.** No password, token, full email link, SMTP secret, authenticator or inbox content is requested.

Run this full block in PowerShell:
```powershell
$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\HP\Desktop\Mushavo Budget'

git fetch origin security/stage-3-authorization
if ($LASTEXITCODE -ne 0) { throw 'Git fetch failed. Stop here.' }

$AuthCandidateCommit = '227264fddc59dc89d9c42b3778f481bab8e433e0'
$AuthScriptText = git show ($AuthCandidateCommit + ':scripts/run-stage-3-auth-readiness.ps1')
if ($LASTEXITCODE -ne 0 -or -not $AuthScriptText) { throw 'Pinned readiness script could not be read. Stop here.' }

$AuthReadinessScript = Join-Path ([System.IO.Path]::GetTempPath()) ('mushavo-auth-readiness-' + [guid]::NewGuid().ToString('N') + '.ps1')
$AuthScriptText | Set-Content -LiteralPath $AuthReadinessScript -Encoding UTF8
Get-Content -LiteralPath $AuthReadinessScript
& $AuthReadinessScript
```

No checkout/reset/stash modifies your working files. In the dashboard, inspect email/password sign-in settings and URL configuration. The prompts cover:
1. Confirm the project reference matches staging; stop if it does not.
2. Email confirmation, actual minimum/required characters, secure change and current-password requirement.
3. Whether the current Site URL and permitted callback destinations cover the staging Auth page.
4. Existing staging mail-delivery evidence, separate controlled test identities and candidate deployment status. Do not create evidence by sending mail or changing settings during this inspection.

Expected output: `stage_step: 3.5.3`, `scope: OWNER_READ_ONLY_DASHBOARD_SUMMARIES`, project staging, entered values or null, `hosted_acceptance: false`, `hosted_Auth_checks_run: 0`, and mutation/dispatch fields false. Return only that JSON summary. The script saves a timestamped summary in your temporary folder.

## Conditional staging preparation — not the current owner action

After readiness/settings parity and controlled test boundaries have recorded outcomes, the pin-required builder can prepare an isolated output. It must not be replaced by the old Stage 1 frontend builder, whose frozen source predates these Auth/MFA files. A complete Git checkout is required; a synthetic fixture test is not proof of building this full repository.

The reviewed future preparation command is:
```powershell
$AuthCandidateCommit = '227264fddc59dc89d9c42b3778f481bab8e433e0'
$AuthBuilderText = git show ($AuthCandidateCommit + ':scripts/build-stage-3-auth-staging.cjs')
if ($LASTEXITCODE -ne 0 -or -not $AuthBuilderText) { throw 'Pinned staging builder could not be read.' }
$AuthBuilderScript = Join-Path ([System.IO.Path]::GetTempPath()) ('mushavo-auth-builder-' + [guid]::NewGuid().ToString('N') + '.cjs')
$AuthBuilderText | Set-Content -LiteralPath $AuthBuilderScript -Encoding UTF8
$env:MUSHAVO_STAGING_PROJECT_CONFIRMED = 'dczlddwbtgvfdujgcitb'
$env:MUSHAVO_STAGING_PUBLISHABLE_KEY = Read-Host 'STAGING sb_publishable_ key only'
$AuthStagingOutput = Join-Path ([System.IO.Path]::GetTempPath()) ('mushavo-auth-staging-' + [guid]::NewGuid().ToString('N'))
try {
    node $AuthBuilderScript $AuthCandidateCommit $AuthStagingOutput
    if ($LASTEXITCODE -ne 0) { throw 'Staging frontend preparation failed.' }
} finally {
    Remove-Item Env:MUSHAVO_STAGING_PUBLISHABLE_KEY -ErrorAction SilentlyContinue
    Remove-Item Env:MUSHAVO_STAGING_PROJECT_CONFIRMED -ErrorAction SilentlyContinue
}
```
This creates files only; it does not upload them or deploy Edge functions. Key project ownership is an owner prerequisite, not proven by its `sb_publishable_` prefix. A coordinated deployment would also need the reviewed Business Edge change, correct Auth callbacks and password settings. The inherited MFA frontend/Edge candidate remains dependent on the unresolved 3.4 hosted prerequisites.

## Bounded acceptance and carry-forward

AU01–AU05 still contain **31 selected hosted cases**, as defined in [the source review](SECURITY_STAGE_3_5_AUTH_FLOWS.md). None ran in 3.5.2. Preserve the two ordinary accounts `audit.owner@example.com` and `audit.outsider@example.com`, Personal/Family fixtures and two USD1 conversions. Use separate owner-controlled identities/inboxes for destructive password/new-user/mail cases.

Known dependencies:
- Auth settings, exact staging callback/templates, current deployed source and real mail delivery are unverified. Twelve-character UI is a proposal until backend parity is confirmed.
- Admin fixture creation/acceptance retains missing controlled MFA-ready super operator, policy-source reconciliation, recovery/settings and coordinated enforcement blockers from 3.4.
- Business acceptance retains the unreviewed trigger/source guard and zero exact controlled fixture outcome from 3.3.
- Browser rendering/SDK event timing, real rate limits, JWT revocation windows, signed-in change/session continuity, issued legacy links and PKCE verifier/tab behavior remain unverified. Sanitized callback reloads require a fresh link; this candidate does not recover from arbitrary stored app sessions.
- Device cleanup after a failed push cleanup remains a pending operational action. An Auth sign-out network failure is explicitly reported and requires retry, not claimed immediate logout.
- Full production/native compatibility and fresh re-audit remain final-remediation work.

In **3.5.3**, record independent safe cases where prerequisites exist; mark dependent cases BLOCKED and close the checkpoint with AU-R01–AU-R06 carry-forward when they do not. Do not repeat privileged setup, bypass the Business guard, turn on paid/unsupported settings, dispatch uncontrolled emails or substitute production. Candidate source/local PASS does not close F08/F15.
