# Windows result received — FR.2.4.E4.9: 320 PASS, exit 0

17 October 2026, FRE73. [Owner receipt](security-fr-2-email-security-controls-owner-Windows-pass.json) records 320/320 PASS on Node v22.17.0/PGlite 0.5.8, with 126 source hashes and 50 syntax checks. All eight groups reported non-failing module-type warnings, and the prior-entry/Edge group reported the non-failing TypeScript warning. This supersedes the Windows-pending action below. The next [canonical baseline source reconciliation](SECURITY_FR_2_4_ACCOUNT_SECURITY_PASS_AND_CANONICAL_BASELINE.md) is offline; it does not activate the email gate. Original FRE72 evidence follows.

---

# FR.2.4.E4.9 — invited signup passed on Windows; account security controls now connected

17 October 2026, FRE72. The [owner invited-signup receipt](security-fr-2-email-invited-signup-owner-Windows-pass.json) records 281/281 PASS, zero FAIL, exit 0 on Node v22.17.0/PGlite 0.5.8, with 123 matching hashes and 47 syntax checks. All six groups reported non-failing module-type warnings, and the prior-entry/Edge group reported the non-failing TypeScript warning. Their exact flags are retained. Hosted acceptance remains pending.

## Account controls and verification

The existing auth.html/auth-flows.js security page now handles flow=devices. Personal/Family Settings and the Admin console link to it. Business sidebar and mobile More-menu links are independent of Business workspace settings permissions, so ordinary members can manage their own account verification. The normal signed-in account is verified through Auth getUser, copied to a separate memory-only client and checked through the shared email gate. Switching to a different normal account cancels the pending security operation; management never adopts or mutates that replacement account. Initial opening checks proof/remembered approval but sends no email automatically.

The controls are Forget this device and Require verification on all sessions, each requiring explicit acknowledgement. A new shared manageDevice method accepts only the two fixed routes, a true boolean acknowledgement, a current approved actor/token and a fresh server proof. Requests are same-origin POSTs to the existing gateway with cookie credentials, fixed CSRF header and an empty JSON body. The browser supplies no target actor, device ID or privileged credential. The gateway continues deriving identity/session from Auth and requiring server-held proof. Existing response size/type/redirect/time limits and stale actor/token/operation checks apply. Duplicate clicks do not issue another mutation while busy. Fixed safe messages never echo transport errors.

Forget clears the selected account/device cookie and invokes the existing revoke_device SQL path. That SQL deletes every proof linked to the selected device, including an original email proof created with Remember enabled and sessions restored from that device. Independent email proof or another device is retained. The client performs a server-proof readback: a retained independent proof can keep the security page verified; a removed proof holds the email screen. No selected cookie is a valid forget outcome with an unchanged independent proof. Revoke-all invokes the existing invalidate-user path, removing all approvals for that account and holding this session locked. The client requires the post-action proof to be false; a claimed success retaining approval is review-required. Neither action deletes Auth sessions, enrolls/deletes MFA factors or changes platform roles. The wording describes access paused until fresh verification, rather than promising Auth logout everywhere.

No code email is sent by these management actions. When verification is needed, the user explicitly requests and enters a code. The existing seven-day fixed device deadline and open-session behavior is unchanged. A network/response uncertainty leaves this page locked with a Check again/Continue verification path; it does not claim the remote mutation failed or was rolled back. Already-started server work cannot be cancelled retroactively, and late/uncertain commit or concurrent management requires hosted acceptance.

## Same-origin reset notices and private data clearing

The shared component now publishes strict versioned BroadcastChannel reset notices before an attempted mutation and after it settles. The payload contains only the current actor ID, a fixed reset kind and version, with no code/token/device credential or approval flag. Local and peer listeners act only for their current actor. Notices can remove client access and invalidate tickets; they can never establish proof. Malformed, extra-field, approval-shaped or oversized actor notices are ignored. A broken listener cannot suppress others. Disposed controllers unsubscribe. No localStorage verification flag or persistent device credential is introduced.

A receiving app or Business controller locks immediately without automatic restore, code send or private reload. Its existing selected private-data clearing callbacks stop realtime, clear models/dialogs/rendered roots and discard stale query tickets. New reset hooks also increment the page data epoch and release pending loader references, so an old pending startup cannot absorb a later successful verification or overwrite a new load. The Admin assurance view now falls back to the general verification view if general proof is lost, avoiding a stale Admin-only view for ordinary accounts or a cleared Admin model. Business membership/invitation/workspace scope is cleared through the same existing callback. Other accounts ignore the notice.

This notice is a same-origin browser convenience, not server authorization or a guaranteed remote erase. Browser support/delivery, actual cross-tab behavior and native/PWA resume are not verified by synthetic channel tests. With no channel, server guards still deny access after approval removal. Other devices do not receive this local channel notice; their protected requests are denied by SQL/Edge guards. Previously loaded content on another/offline device is not remotely erased, and the exact presentation/recheck behavior remains in hosted acceptance.

Shared component/page module versions were bumped so changed imports are not silently tied to old cached URLs. The signup inline import changed, so _headers was regenerated from reviewed HTML; only the exact script hash changes, with no policy broadening. Existing exporter allowlists already contain all changed files, and the frozen FR.1 source/deployment contract is unchanged. No upload or root www/native update occurs.

## Selected offline validation

[Verifier](../../scripts/verify-fr-2-email-security-controls.mjs), [126-file manifest](security-fr-2-email-security-controls-source-manifest.json), [local receipt](security-fr-2-email-security-controls-local-checks.json), [contract](security-fr-2-email-security-controls-candidate-contract.json).

| Batch | PASS |
| --- | ---: |
| New device-action/controller, actual security page and reset-notice boundaries | 28 |
| Actual new device actions, gateway and full54 SQL integration | 11 |
| Previous invited signup page/controller | 33 |
| Previous actual signup controller/provisioning SQL | 10 |
| Existing invitation/signup/currency/header regressions | 46 |
| Prior callback/identity regressions | 65 |
| Prior entry/exporter/workspace/Edge regressions | 84 |
| Shared component/gateway/SQL/Admin regressions | 43 |
| Total | 320 |

All 320 pass locally, exit 0, no failure/cancellation/skip/todo; 126 source hashes and 50 syntax checks, including the signup inline module, match on Node v24.19.0/PGlite 0.5.8. New tests evaluate the actual auth-flows.js page module, real shared controllers/form and selected actual app/Business clearing/reset callbacks with minimal DOM and explicit synthetic Auth/gateway/channel ports. They check acknowledgement/proof boundaries, no actor/device body authority, forget/revoke outcomes, malformed/uncertain responses, concurrency/token replacement, scoped notices, listener isolation, no auto-email, private model clearing and pending-loader invalidation. Existing 281 selected cases remain included; their callback DOM fixture now includes the added security fields and current external module version.

The new SQL group loads all 54 unchanged migrations plus existing backend/session/application-guard/Admin-status candidates. Real browser-controller methods invoke the actual gateway/crypto and actual SQL through explicit synthetic Auth, mail, limiter and cookie-jar ports. It verifies password-only direct denial; an Admin's original remembered proof and same-device restore; independent device/email sessions and another ordinary account; exact forget deletion/cookie clearing; account-wide proof removal without Auth-session/factor deletion; protected profile RLS denial after revocation; fixed old deadlines; and fresh-code restoration retaining the original Admin role. Existing day-seven and role-boundary checks remain in the retained regressions. No real JWT signature/provider, email, browser cookie engine or channel delivery is claimed. Temporary exporter/native-packager tests retain mocked bundler/plugin scope.

## Remaining work and owner action

Canonical schema/versioned migration integration, guard inventory review, coordinated Pages artifact/gateway activation, full regression and genuine browser/provider/hosted acceptance remain pending. The current hosted app, SQL and gateway are not changed by this source batch. Do not install guards or deploy the frontend independently of the coordinated handoff. Unknown completion/reload/concurrency recovery, prior Business/FX/security carry-forward and the stronger original MFA finding remain open. Email proof is not Supabase AAL2.

Run the complete pinned temporary-folder PowerShell block in chat. It exports the candidate without switching your checkout, installs the one locked PGlite dependency with npm.cmd ci --ignore-scripts and runs the selected offline verifier. npm may contact the public registry; default Node fetch/HTTP is disabled during tests, with explicit ports synthetic. This transport guard is not an OS sandbox. Package name/version and lock registry/integrity are checked; installed package bytes are not independently hashed.

Expected: OFFLINE_ACTUAL_ACCOUNT_SECURITY_CONTROLS_GATEWAY_SQL_AND_SELECTED_REGRESSIONS_SCOPED_PASS, 320 PASS, zero FAIL, exit 0. Return the JSON and exit code. No SQL, credentials, DPAPI file access, upload, email or APK action is requested. TypeScript/module-type warnings are non-failing when present.

All 20 original findings remain open, release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Prior stages, evidence events, coverage rows, retained fixtures and manual conversion baseline are preserved. Production excluded; APK/native deferred.
