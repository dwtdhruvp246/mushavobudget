# FR.2.4.E4.7 — app entry passed on Windows; Auth callbacks use the email screen

16 October 2026, FRE70. The [owner app-entry receipt](security-fr-2-email-entry-owner-Windows-pass.json) records 127/127 PASS, zero FAIL, exit 0 on Node v22.17.0/PGlite 0.5.8, with 89 matching source hashes and 27 syntax checks. This completes the E4.6 Windows repeat. Hosted acceptance remains pending.

## Callback integration

The actual auth.html/auth-flows.js page now mounts the same email verification form used by app and Business entry. session-entry.js adds a callback adapter that can pause a protected step while the user explicitly requests and enters a code. Opening the screen never dispatches email. The code form and cancellation remain usable while the owning page operation waits. Proof approval resolves only its current actor/token operation; cancellation, sign-out, account replacement or bearer replacement rejects pending work. The normal app session is not adopted by this adapter.

The link controller independently calls the exact no-argument email_gate_current_session_verified predicate and accepts only data=true with error=null, with provider getUser identity and stable session-token checks. Supplying a UI callback that returns true cannot bypass that server check. Business invitation reads and normal-app adoption are preceded by proof. Business invitation pending/expiry/recipient checks still happen before first-password mutation and are rechecked before continuing; no membership is accepted by the callback itself. A cancelled controller cannot resume a pending invitation step. No RLS/RPC guard or bootstrap exception is weakened to make the callback work.

A valid provider recovery link still authorizes choosing the account's own password. Protected unfinished-Admin-invitation checks now happen after the new password and fresh email proof, rather than before proof. A matching unfinished invitation still offers an explicit Free personal signup alternative; the recovery page never automatically cancels an invitation or provisions a workspace. The existing signup.html provisioning destination has its own pending integration checkpoint and must not yet be treated as globally compatible with the gate.

Confirmation and existing Business links require proof before deliberate normal-app session adoption. Link material is removed from the URL before asynchronous work. Isolated callback sessions remain tab-scoped; adopted tokens identify the same Auth session and removal of the isolated local copy does not server-log-out that adopted session. Provider link confirmation alone is not an application code proof. Public confirmation/resend and recovery-link request forms remain provider-only and do not issue private application RPCs or automatically request app verification codes.

Signed-in password changes keep the separate memory-only Auth snapshot and current displayed-account checks. After saving, password fields are cleared and the new verification screen must establish fresh proof before the page reports completion. Password changes invalidate prior device/session approval in the existing SQL backend. Consequently, a new Business first-password flow can require verification before the protected invitation read and again after changing the password; this preserves both existing pending-invitation validation and password-change invalidation. It is not an every-login code policy change. The fixed seven-day remembered-device and open-session behavior remains unchanged.

A continuation button permits retrying a failed post-password verification/destination check without writing the password again. Back to sign in cancels only the isolated callback session; on a signed-in password-change page it returns without logging out the normal app session. The shared form's explicit Sign out control does log out that normal session. Fixed safe messages avoid printing SDK errors or secrets. No code/password/device approval is written by the new controller to localStorage, files, command arguments or logs; existing isolated Supabase SDK sessionStorage behavior is retained.

## Selected offline checks

[Verifier](../../scripts/verify-fr-2-email-callbacks.mjs), [94-file manifest](security-fr-2-email-callback-source-manifest.json), [local receipt](security-fr-2-email-callback-local-checks.json), [contract](security-fr-2-email-callback-candidate-contract.json).

| Batch | PASS |
| --- | ---: |
| Actual Auth module, mounted form, callback proof/cancel/retry boundaries | 25 |
| Existing Auth link, password, identity, logout and stale-query regressions | 40 |
| Prior app entry, temporary exporters, workspace and Edge regressions | 84 |
| Shared component and actual gateway/SQL/Admin regressions | 43 |
| Total | 192 |

All 192 pass locally, exit 0, with no failure/cancellation/skip/todo. All 94 source SHA256 hashes and 31 JS/stripped-TS syntax checks match on Node v24.19.0/PGlite 0.5.8. Auth tests evaluate the actual auth-flows.js module with its imported real link/controller and shared form against a minimal DOM and explicit synthetic SDK/transport ports. They exercise negative and positive confirmation, Business invitation, recovery and signed-in change paths, cancelled invitations, account/token replacement, cancellation, password field clearing, same-session adoption and retry without another password write. The existing 40-case Auth harness now supplies the current email-entry/Admin coordinator and exact proof response instead of obsolete TOTP mocks.

The retained SQL group independently applies all 54 unchanged migrations and backend/session/application-guard/Admin-status candidates in PGlite. It checks real SQL proof, browser-controller/gateway integration, seven-day open-session/device behavior and password/suspension invalidation. These SQL regressions and new callback-module tests are separate groups; they do not constitute an end-to-end callback using actual Auth/JWT, a browser engine or hosted Postgres. Temporary exporters run locally; the native packager still uses mocked bundler/plugins. Neither modified HTML file introduces executable inline scripts; app, Business and Auth inline hash sets remain unchanged. The frozen FR.1 deployment contract is not rebased or uploaded.

## Remaining work and owner action

Admin-created invitation signup and explicit Free-signup provisioning in signup.html, remembered-device forgetting/revoke-all settings, canonical schema/versioned migration, coordinated new Pages artifact/gateway bindings, full regression and genuine browser/provider/hosted acceptance remain pending. Do not install global guards or deploy this frontend independently of that coordinated work. Source changes are on the audit branch only; no real Auth, Zoho, Cloudflare, SQL, factor, account, role, payment, email/push/charge or native action occurred.

Run the complete pinned temporary-folder PowerShell block in chat. It exports selected source without switching your checkout and installs the one locked PGlite dependency through npm.cmd ci --ignore-scripts. npm may contact the public registry; test transports are explicit synthetic ports with default Node fetch/HTTP disabled. That transport guard is not an OS sandbox. Dependency name/version and lock registry/integrity metadata are checked; installed package bytes are not independently hashed.

Expected: OFFLINE_ACTUAL_AUTH_CALLBACK_EMAIL_GATE_AND_SELECTED_SQL_REGRESSIONS_SCOPED_PASS, 192 PASS, zero FAIL, exit 0. Return the JSON and exit code. No SQL, credentials, DPAPI access, upload, email or APK action is requested. TypeScript experimental warnings are non-failing when present.

All 20 original findings remain open, release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Prior stages, evidence events, coverage, retained fixtures and manual conversion baseline remain preserved. Production excluded; APK/native deferred.
