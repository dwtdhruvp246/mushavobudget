# FR.2.4.E4.6 — email screen passed on Windows; application entry now uses it

16 October 2026, FRE69. The [owner screen/Admin contract receipt](security-fr-2-email-ui-owner-Windows-pass.json) records 93/93 PASS, zero FAIL, exit 0 on Node v22.17.0/PGlite 0.5.8, with 71 matching source hashes and 11 syntax checks. This completes the E4.5 Windows repeat; hosted acceptance remains pending.

## Actual application changes

[session-entry.js](../../session-entry.js) coordinates the shared screen with its owning page. Startup checks are shared only for the exact actor and bearer, and opening the screen never sends a code automatically. An already verified session proceeds; a valid remembered cookie can restore proof; otherwise the actual email-code screen stays visible. Manual code verification resumes the owning startup path. Automatic proof checks suppress recursive startup callbacks. Access tickets become invalid immediately on actor/token change, lock or a new check. Unsupported native origins stop with a fixed visible message rather than skipping verification.

Personal/Family app.js now checks the entry coordinator before invitation-profile, suspension, profile, role, workspace, financial, notification or subscription data loads. Remembered workspace routing follows proof. Query results are discarded if their original actor/token proof ticket or Auth data epoch changed. A verification-required SQL denial locks the screen and clears private state. Normal Auth sign-in/session retry/session refresh calls remain outside this application-data response guard; backend authorization is never based on a client label. Initial password sign-in no longer shows a success toast before verification.

Same-account bearer replacement now invalidates the entry, current load promise and data epoch immediately, clears private state, then schedules SDK reload outside the Auth event callback. This applies to ordinary accounts and Admins. Same-token Auth events retain the verified session. Realtime startup, notification refresh, finance refresh and analytics recording stop when the entry lacks approval. Explicit offline navigation still cannot open private startup data because proof cannot be checked.

The Admin page now mounts the shared screen with requireAdmin and the actual email_gate_admin_status contract. The app does not import the former TOTP controller, request admin_mfa_status, enroll factors or display authenticator setup controls. Existing four-role assignment remains required; a missing role no longer defaults to super_admin in loadAccess. Admin rechecks query current server proof and role status. Approved rechecks retain the currently loaded models; a denied/unavailable result clears models/dialogs/DOM and holds the verification view. Prior Admin access tickets are invalid during checks. Historical TOTP helper/test source remains available but is not the app's selected verification path. Email verification is not AAL2 and does not close the original stronger-TOTP finding.

Business startup now checks proof immediately after the SDK session read and before preference hydration, suspension, profile, membership, invitations, workspace or financial reads. Its query wrapper discards invalidated responses and locks on verification-required denials. Token replacement clears the Business scope, increments its epoch, binds the new session and schedules reload. A post-Promise.all epoch/proof check prevents a completed old batch from writing after invalidation. Existing role, member scope, entitlement/expiry, invitation and workspace-selection logic remains in place.

Both pages include dedicated verification roots. Private invalidation clears sensitive arrays/nullable models, profile/workspace/member data, Admin support detail and pending push/analytics/detail sequences, stops realtime, closes dialogs and restores original private DOM nodes with their listeners. Inputs, checked values, generated rows and private image attributes return to initial state. State clearing does not sign the user out or delete a factor. Sign-out controls call their existing owning-page flow.

Production public, staging Auth and native packaging source allowlists now include email-verification.js and session-entry.js. Actual temporary exporter checks preserve both modules byte-for-byte and reject a missing dependency before replacing an artifact. Native packaging uses mocked esbuild/Capacitor modules solely for copy/promotion tests; no real native dependency bundle, root www change, sync, build, signing or APK update occurred. Neither changed HTML page has inline executable script bodies; their original inline hash sets are unchanged, so no header policy change was required. The frozen FR.1 static source contract still identifies its original reviewed deployment; it is not silently rebased or reused as a new deployment receipt.

## Selected validation

[Verifier](../../scripts/verify-fr-2-email-entry.mjs), [89-file manifest](security-fr-2-email-entry-source-manifest.json), [local receipt](security-fr-2-email-entry-local-checks.json), [contract](security-fr-2-email-entry-candidate-contract.json).

| Batch | PASS |
| --- | ---: |
| New coordinator, actual page startup/query/Auth callback functions, DOM clearing and exporters | 32 |
| Affected existing workspace restoration, Business invitation and notification checks | 52 |
| Shared component and actual gateway/SQL/Admin status regressions | 43 |
| Total | 127 |

All 127 pass, exit 0, with no failures/cancellations/skips/todo; 89 hashes, 27 JS/stripped-TS syntax checks and unchanged inline script hashes match locally on Node v24.19.0/PGlite 0.5.8. The entry tests execute selected actual functions from app.js/business.js in VM contexts with explicit SDK/DOM/query ports. They verify negative startup before private work, positive Personal/Family/Business/Admin controls, role removal, concurrent checks, mounted code form resume, native-origin denial, stale query responses and immediate token-change invalidation with deferred SDK reload. Existing workspace restoration tests retain Business/Family selection, suspension, invitation and expiry cases. Notification tests preserve cleanup and service-side privacy behavior. The SQL regression runs all 54 unchanged migrations and actual backend, session, application guards and Admin status; genuine proof, seven-day behavior and credential/suspension invalidation are checked locally.

This is not a complete browser engine/CSS/accessibility/PWA/device test, full application evaluation, full 882-case regression rerun, actual SDK JWT verification, native runtime, real mail/push/charge/job or hosted acceptance. Source checks cannot establish whether a deployment currently serves these modules. No live Auth, SQL, Cloudflare, Zoho, role, factor, account, payment setting or provider action was performed.

## Remaining coordinated work

The code-confirmation, password-recovery, invitation first-password and future provider callback flows in auth.html/auth-flows.js/auth-security.js need their own integration before globally enabling the database gate. Account controls for forgetting a remembered device/revoking approvals also remain to be connected. Canonical schema and a versioned migration, exact new staging artifact contract/headers, Pages Worker bindings/secrets, supported clients, real browser/provider delivery and full hosted/final re-audit checks remain pending. Do not deploy the frontend or SQL guards alone. The current hosted site has not been changed by this source batch.

## Owner action

Run the complete pinned PowerShell block in chat. It exports selected source to a new temporary folder, installs the one locked PGlite dependency with npm.cmd ci --ignore-scripts and executes the new verifier. npm can contact the public registry; default Node fetch/HTTP is disabled during tests and all provider ports are synthetic. This transport guard is not an OS sandbox. Package name/version and lock registry/integrity metadata are checked; installed bytes are not independently hashed.

Expected: OFFLINE_ACTUAL_APP_BUSINESS_ADMIN_ENTRY_AND_EXPORTERS_SCOPED_PASS, 127 PASS, zero FAIL, exit 0. Return its JSON and exit code. No Supabase SQL, credentials, DPAPI access, Cloudflare settings, upload, email or APK action is requested. The TypeScript experimental warning is non-failing when present.

All 20 original findings remain open; release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Original stages, earlier events, coverage rows, retained fixtures and manual conversion baseline are preserved. Production excluded; APK/native deferred.
