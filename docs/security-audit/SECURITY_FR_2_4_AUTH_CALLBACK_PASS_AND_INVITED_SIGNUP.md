# Windows result received — FR.2.4.E4.8: 281 PASS, exit 0

17 October 2026, FRE72. [Owner receipt](security-fr-2-email-invited-signup-owner-Windows-pass.json) records 281/281 PASS on Node v22.17.0/PGlite 0.5.8, with 123 source hashes and 47 syntax checks. All six groups reported non-failing module-type warnings; the prior-entry/Edge group also reported the non-failing TypeScript warning. The exact receipt flags are retained. This supersedes the Windows-pending action below. The next [account security controls source checkpoint](SECURITY_FR_2_4_INVITED_SIGNUP_PASS_AND_ACCOUNT_SECURITY_CONTROLS.md) remains offline and undeployed. Original FRE71 evidence follows.

---

# FR.2.4.E4.8 — Auth callbacks passed on Windows; invited signup now uses email proof

16 October 2026, FRE71. The [owner callback receipt](security-fr-2-email-callback-owner-Windows-pass.json) records 192/192 PASS, zero FAIL, exit 0 on Node v22.17.0/PGlite 0.5.8, with 94 matching source hashes and 31 syntax checks. All four owner groups reported non-failing module-type warnings; the prior entry/Edge group also reported the non-failing TypeScript warning. These flags are preserved rather than copied from the warning-free local Node 24 groups. Hosted acceptance remains pending.

## Actual signup changes

The signup.html Admin-created invitation and explicit Free alternative now use createInvitationSignupController in auth-security.js and the existing shared email-code form. Admin-created means a platform operator invited an ordinary account to a selected plan; this workflow grants no platform Admin role. The new controller binds provider-verified identity, confirmed email and bearer, and independently calls the exact no-argument email_gate_current_session_verified predicate before private invitation lookup, completion and normal-app adoption. The screen callback cannot replace that predicate. Existing server role/ownership/plan/currency/entitlement rules remain authoritative, with no new RLS/RPC exemption.

Callback material is captured and removed from the URL before asynchronous Auth work; isolated signup clients now disable SDK URL auto-detection. Supplied provider error, incomplete token pairs, invalid link types or failed verification do not fall back to a stored isolated session. Token-hash, PKCE and complete token-pair verification are supported through explicit SDK calls. With no supplied material, a valid existing isolated session can continue the explicit recovery-to-Free setup route or a retry. No normal application session is borrowed. Provider callback/JWT semantics are modeled locally and still need actual SDK/browser acceptance.

Admin invitations are re-read after proof, checked against exact invitation ID and recipient email, and rechecked before password mutation and completion. The invited plan, workspace summary, selected currencies and fixed name/email appear only after verification. Changing the password invalidates earlier proof/device approval in the existing SQL backend, so fresh proof is required before provisioning. A legitimate own-password USER_UPDATED event may update the same actor's expected bearer; external account/bearer replacement cancels pending setup and clears private summary, names, password fields, acknowledgement and currency selection. Old pending callbacks cannot adopt a replacement account. This is not a change to the fixed seven-day remembered-device/open-session policy.

The Free alternative first verifies that an unfinished invitation actually belongs to the signed-in user. Its form explicitly states that completing Free signup will cancel that invitation. Merely opening the page, verifying a code, or saving a password does not invoke cancellation/provisioning. Completion remains an explicit submit with account acknowledgement, validated currencies, password setup and fresh proof. The actual existing SQL routine performs invitation cancellation and Free workspace provisioning transactionally. Normal public signup still selects currencies, sends provider confirmation and uses confirmation-pending guidance for duplicate signup without extra reset/code email.

The account acknowledgement is required before password/setup submission and normal-app adoption. An already-provisioned invitation offers Open verified account instead of automatically replacing a normal app tab's account. Normal storage receives only the same isolated proven session after known completion; getUser verifies the adopted identity. The isolated client stops refresh and only its local session/code-verifier keys are removed; server logout is not used during successful adoption. Back to sign in and the shared Sign out control remain outside the hidden setup form and log out only the isolated session before navigation.

After a password is successfully saved, failed completion can retry without another password write. After a known committed completion, failed adoption can retry without replaying provisioning, including the existing non-idempotent Free transition. This state is held only in the current controller instance. An unknown remote commit after a timeout, page reload or concurrent session is not proven by this work, and durable Free-RPC idempotency is not implemented or claimed. Manual sign-in/recovery and uncertain completion need hosted acceptance; a cancellation after a server write has started cannot promise to undo that transaction.

The signup inline module changed, so _headers was regenerated from the reviewed HTML. Only its exact inline-script hash changes; no broad script permission, policy source, backend origin or enforced directive is added. Auth/app/Business inline script sets remain empty. Public/staging/native exporter allowlists already include the changed files and their shared modules; no new allowlist entry is needed. The frozen FR.1 deployment source contract remains unchanged and no candidate is uploaded.

## Selected offline validation

[Verifier](../../scripts/verify-fr-2-email-invited-signup.mjs), [123-file manifest](security-fr-2-email-invited-signup-source-manifest.json), [local receipt](security-fr-2-email-invited-signup-local-checks.json), [contract](security-fr-2-email-invited-signup-candidate-contract.json).

| Batch | PASS |
| --- | ---: |
| Actual signup inline module/shared form and new controller boundaries | 33 |
| Actual new controller and provisioning SQL integration | 10 |
| Existing invitation, signup currency and header regressions | 46 |
| Prior Auth callback and identity regressions | 65 |
| Prior entry/exporter/workspace/Edge regressions | 84 |
| Shared component and gateway/SQL/Admin regressions | 43 |
| Total | 281 |

All 281 pass locally, exit 0, with no failure/cancellation/skip/todo. All 123 source SHA256 hashes and 47 syntax checks (including the actual inline module) match on Node v24.19.0/PGlite 0.5.8. The new page tests evaluate the actual signup inline module with real shared/controller imports, minimal DOM and explicit synthetic SDK/gateway ports. Negative and positive cases cover pre-proof private-read denial, password invalidation, explicit Free cancellation, pending/missing/replaced invitation, account/bearer replacement, cancellation, known-completion retry, acknowledgement and normal public signup. Pure controller tests independently reject malformed/failed callback material, false proof, wrong recipient, missing/unconfirmed session, invalid password/currency, early adoption and wrong adopted identity.

The new SQL group loads all 54 unchanged migrations and existing backend/session/application-guard/Admin-status candidates. It uses the actual new controller with synthetic Auth and code-screen ports, creates proof through real service challenge/delivery/verify SQL, and invokes real invitation/completion routines under modeled authenticated roles. It verifies password-only denial with no workspace, own invitation/foreign denial, password-trigger proof invalidation, fresh-proof Personal paid-plan/currency provisioning, explicit transactional Free cancellation/provisioning, known-completion retry, unsupported currencies/cancelled invitations and no platform Admin assignment or unrelated user workspace change. Its synthetic Personal USD1 price is local only; no charge or provider action occurs. This group does not exercise actual Zoho, Supabase SDK JWT validation or browser cookies. Existing gateway/SQL tests remain a separate regression group.

Legacy invitation tests were updated for the controller boundary and manual link bootstrap while retaining their existing password-retry, session-isolation, exit, pending-provisioning, currency, plan/payment and server-authorization checks. Header tests check exact tracked production policy against reviewed HTML, staging origin policy, unchanged permissions and redirected-path/output protections. This selected batch is not a full repository CI/regression rerun, native bundle/device/store test or genuine hosted acceptance.

## Remaining work and owner action

Remembered-device forgetting/revoke-all account settings, canonical schema/versioned migration, coordinated new Pages artifact/gateway configuration and full regression/browser/provider/hosted acceptance remain pending. Do not install global guards or deploy these source files independently. No live SQL, Auth, Zoho, Cloudflare, factor, role, account, payment, email/push/charge, scheduler or native action occurred.

Run the complete pinned temporary-folder PowerShell block in chat. It exports the candidate without switching your checkout and installs the one locked PGlite dependency with npm.cmd ci --ignore-scripts. npm may contact the public registry; the test transport guard disables default Node fetch/HTTP while explicit ports remain synthetic. That guard is not an OS sandbox. Package name/version and lock registry/integrity metadata are checked; installed package bytes are not independently hashed.

Expected: OFFLINE_ACTUAL_INVITED_SIGNUP_PAGE_CONTROLLER_SQL_AND_SELECTED_REGRESSIONS_SCOPED_PASS, 281 PASS, zero FAIL, exit 0. Return the JSON and exit code. No SQL, credentials, DPAPI access, upload, email or APK action is requested. TypeScript/module-type warnings are non-failing when present.

All 20 original findings remain open, release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Original stages, evidence events, coverage rows, retained fixtures and manual conversion baseline are preserved. Production excluded; APK/native deferred.
