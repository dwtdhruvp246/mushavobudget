# 3.5 — Auth-flow source review and bounded acceptance plan

**Latest — 3.5.2 candidate/local verification complete / next 3.5.3, 11 October 2026 (S3E23):** The Auth compatibility candidate adds separated confirmation/recovery/change and Business first-password UX, isolated link sessions with explicit verified-account transfer, a proposed 12-character new-password rule, compatible older-password sign-in, explicit logout failures and old-account query/render guards. **111 local checks PASS, exit 0; six syntax checks PASS.** Pinned SDK source supports nonce/current-password fields. This is source, VM/SDK/provider mocks and synthetic Git-builder evidence, not genuine Auth/SMTP/browser/JWT/hosted acceptance. Two of three 3.5 milestones have outcomes. [Candidate report and complete read-only staging handoff](SECURITY_STAGE_3_5_AUTH_CANDIDATE.md). Next is one owner settings/readiness summary; no setting toggle, mail/account mutation, SQL install, deployment or native action is requested. AU01–AU05 hosted cases and AU-R01–AU-R06 remain pending, alongside all earlier Business/MFA/Personal carry-forward. F08/F15 stay OPEN; Stage 3's full report remains due at 3.6. Earlier summaries are historical.

**3.5.1 complete — 11 October 2026, S3E22.** Source review is complete at audit-branch commit `8ecc3a10a608053d33b434cce7f53d7c6fe0c9bf`. The selected existing Node regressions return **34 PASS / 1 FAIL (exit 1)**; the failure is an assertion about statement order, described below. No hosted Auth, email-link, browser, password-setting or API acceptance ran. Next is **3.5.2**, candidate preparation and local verification. F08/F15 remain OPEN; Stage 3's full report remains due at **3.6**.

## Three bounded milestones

| Milestone | Work and completion criterion | Current outcome |
|---|---|---|
| 3.5.1 | Review current Auth routes, settings evidence, invitation guards and regressions; detail the existing AU01–AU05 groups | COMPLETE at source/local scope |
| 3.5.2 | Prepare compatible Auth UX/control candidates, meaningful local tests and a concrete staging-only owner handoff | NEXT |
| 3.5.3 | Run one bounded hosted acceptance batch when prerequisites exist; otherwise record BLOCKED cases and close the checkpoint with carry-forward | PENDING |

No additional audit stage or open-ended setup sequence is added. The five groups frozen in S3E05 retain their IDs. Their 31 selected cases below are a detailed plan, not 31 executed tests.

## Reviewed source and limits

Reviewed the authenticated application (`app.js`, `app.html`), `signup.html`, PWA entry controller `app-entry.js`, Business page/controller, workspace preference helper, the two invitation Edge functions, `supabase/config.toml`, and the latest migration definitions of the five invitation recipient/completion routines. All 52 ordered migration filenames were searched for later definitions; this review reads the latest definitions rather than claiming hosted catalog parity. See [the pinned source inventory](security-stage-3-auth-source-inventory.json) for repository blob identities and the test list.

Web and reviewed Edge clients pin Supabase JS **2.110.9**. The repository's function gateway config does not define the project's Auth password, confirmation, SMTP, redirect, rate or session settings. Earlier deployment notes are historical instructions, not current dashboard or plan-capability evidence. An optional fresh modeled-catalog probe could not run because its external PGlite package was unavailable; no new database compilation or behavioral PASS is claimed here. Prior 3.4 modeled evidence remains historical at its original scope.

## Findings and retained controls

| Area | Source finding / retained control | Consequence for 3.5 |
|---|---|---|
| New passwords and sign-in | Signup fields advertise and enforce HTML minimum 6; sign-in also advertises 6. Signup checks password equality and delegates actual strength enforcement to Auth. Actual backend settings are unknown. | Coordinate stronger **new-password** rules and hints with actual supported server settings. Do not reject an existing user's valid older password by raising the sign-in form minimum. |
| Ordinary signup and confirmation | Successful signup redirects to `app.html?signup=success` regardless of whether Auth returned a session. The application says the account was created and to sign in. There is no explicit confirmation-pending guidance or ordinary confirmation-resend UI. | Distinguish confirmation pending, signed-in/confirmed and error states; server denial of unconfirmed sign-in remains a hosted check. |
| Shared confirmation/fallback route | Ordinary signup's confirmation destination is `signup.html?mode=self-signup`, also used by the verified unfinished Admin invitation fallback. That initializer presents unfinished-invitation copy, verifies session/user, calls `has_my_unfinished_admin_invitation`, and transfers non-invite users to the normal app. | Give confirmation and recovery explicit intents, without making a URL flag an authorization proof. This is a source route/UX concern, not a demonstrated hosted takeover. |
| Existing-email fallback | Duplicate/identity-empty signup calls `resetPasswordForEmail` for the same shared route and shows generic unfinished-invitation inbox guidance. The unfinished-invitation check happens after the email link establishes a session. | Preserve generic account-existence responses while avoiding misleading invitation guidance for ordinary users; test rate/error handling with bounded dispatch. No emails were sent in this review. |
| Ordinary recovery and password change | No ordinary Forgot password UI, signed-in password-change UI, or dedicated `PASSWORD_RECOVERY` handling exists in the reviewed application/signup/Business sources. Password update is present for invitation completion only. | Prepare recovery and signed-in change flows, including recent-login/reauthentication errors and retry. Never treat every authenticated session as permission to run an invitation completion flow. |
| Admin invitation setup | Isolated tab session storage; server `getUser` validation; expected email and invitation identity/state checks; password save before completion; same-password retry; idempotent, locked server completion; exact user-ID verification before normal-session adoption. Leaving setup signs out locally before navigation. | Retain these controls and ordinary Admin-tab isolation. They are source/mocked evidence; genuine link expiry/replay, Auth/password behavior and hosted RPC parity remain unverified. The 3.4 privileged actor/MFA blockers still apply to invitation creation. |
| Business invitation setup | Edge validates the bearer user and reserves delivery through caller RPC before service mail dispatch. It uses Auth invitation for a new identity and OTP for an existing identity, both directed to `business.html?invitation=…#business/team`. The page loads its session and pending invitations but has no first-password setup view or password update handler. | Add first-password setup for the verified new recipient without requiring an existing recipient to replace their password. Keep recipient, expiry, pending-state, subscription/seat and server role/scope guards. The earlier Business fixture/source-parity blocker is retained. |
| Recovery-link privacy | Admin/self-signup setup removes known sensitive query/fragment fields after SDK session validation or handled errors. Other routes do not have a dedicated recovery view. Some handlers log raw SDK error objects or show raw messages. | Sanitize Auth-link material promptly, use safe error classifications, and prevent incidental session adoption/account switching on untrusted intent flags. Do not record tokens, links, passwords or inbox contents in evidence. |
| Session refresh and account switching | Application and PWA entry have bounded invalid-session refresh/cleanup and preserve sessions on selected transient failures. Application Auth callbacks clear/rebind privileged state. Business uses initial `getSession` and periodic access checks but has no Auth-state change callback in its reviewed controller/helper. | Check same-user refresh, invalid refresh, offline retry and old-user render/request cancellation when the active account changes or signs out. Server RLS is distinct from clearing previously rendered data. |
| Sign-out and push cleanup | `signOutSafely` awaits protected push-row cleanup before calling Auth sign-out; cleanup failure stops the call and displays “Sign-out stopped”. Business uses local sign-out and redirects in `finally`, even if it errors. | Make the account/session outcome explicit and test cleanup/Auth failures. Preserve protected device cleanup; a cleanup outage must not silently keep an unwanted session active. Record observed residual token validity, not an immediate revocation guarantee. |

Latest reviewed SQL definitions:
- `get_my_admin_user_invitation` / `complete_admin_user_invitation`: `20260923100000_complete_admin_user_invitations.sql`; require authenticated identity/email binding and invitation availability; completion locks and checks state/expiry/profile binding before provisioning.
- `has_my_unfinished_admin_invitation` / `complete_self_signup_from_admin_invitation`: `20260923143000_replace_pending_admin_invitations.sql`; bind to the authenticated unfinished recipient and cancel/provision transactionally. The fallback's deliberate source rule permits self-signup from an unfinished sent invitation; do not add an expiry restriction without a product requirement.
- `respond_business_invitation`: latest replacement `20260930090000_business_stage_10_billing.sql`; recipient ID/email, pending/expiry, suspension, active subscription and seat guards remain server-side.

## Frozen AU01–AU05 acceptance matrix

| Group | Selected cases (31 total) | Required observable outcome |
|---|---|---|
| AU01 — signup/confirmation (5) | 1 valid ordinary signup; 2 confirmation-pending guidance; 3 unconfirmed sign-in denial; 4 correct confirmation destination; 5 generic existing-email/resend failure and rate response | Accurate state guidance, verified destination/identity, no account-existence disclosure through application copy, no unintended invitation cancellation or premature privileged access |
| AU02 — invited setup (8) | 1 Admin new-recipient setup; 2 Admin-tab isolation; 3 wrong-recipient denial; 4 expired/cancelled/replaced invitation denial; 5 completion retry/idempotence; 6 Business new-recipient first password; 7 existing Business recipient without password overwrite; 8 Business accept/decline/replay | Authenticated intended identity only; server invitation rules preserved; successful password setup where required; no session or workspace adoption before verified completion |
| AU03 — sign-in/password change (5) | 1 ordinary valid sign-in including older valid password; 2 invalid credentials; 3 configured new-password boundary; 4 signed-in password change and retry; 5 required recent-login/reauthentication failure/success | Auth server and new-password UI agree; old credentials remain usable until deliberately changed; password-update errors do not imply success or grant authority |
| AU04 — recovery/links (6) | 1 generic recovery request; 2 valid recovery opens dedicated new-password view; 3 wrong/no session; 4 expired/used link; 5 password-save failure/retry; 6 cross-tab/current-account isolation and sanitized URL | No premature app/session transfer; verified recovery identity; no change for unrelated signed-in user; no token/link leakage; successful update followed by an explicit session outcome |
| AU05 — sessions/failures (7) | 1 same-user access refresh; 2 invalid refresh cleanup; 3 transient network preservation/retry; 4 sign-out with push cleanup failure; 5 Auth sign-out failure; 6 account switch with in-flight/Business UI clearing; 7 selected Auth rate errors and observed stale-token window | Bounded retry, accurate session outcome, no old-user protected render after switch/logout, no rate-limit hammering or assumed immediate JWT revocation |

Each case receives PASS, REVIEW, FAIL, or BLOCKED at its actual evidence scope. Local mocked/controller tests cannot satisfy genuine email, JWT, confirmation, rate-limit or hosted authorization acceptance. Do not repeatedly submit signup, recovery or invite requests to trigger quotas.

## 3.5.2 candidate contract

1. Prepare a **12-character minimum proposal for newly created or changed passwords**, with one shared rule/hint and tests for confirmation mismatch and backend strength errors. Server-aligned activation remains pending read-only staging settings evidence. Keep password sign-in free of a stronger creation-only minimum. Do not silently reset existing users.
2. Separate ordinary confirmation, ordinary recovery, verified Admin fallback and Business first-password intent. Verify server identity and expected recipient/state; use isolated Auth-link storage so an active account is not changed before a deliberate, verified transition. A mode/query flag alone grants nothing.
3. Add ordinary recovery and signed-in password-change UX; handle supported secure-change/recent-login requirements for the pinned SDK. Avoid assuming newer documented options work in 2.110.9 without compatibility validation.
4. Retain Admin invitation isolation, password-before-completion sequencing and idempotent retry. Business first-password handling must preserve existing recipients and all SQL invitation permissions, without changing assigned roles/scopes or dispatching live mail during local verification.
5. Correct sign-out failure handling, clear old-account state/in-flight renders, and use safe error categories. Include a meaningful behavioral replacement for the brittle reset-order assertion.
6. Produce one concrete staging handoff with pinned commit, complete PowerShell commands where applicable, private input boundaries and expected safe receipt. No owner setting toggle, SQL install, deployment, mail dispatch or shared synthetic password change is requested by 3.5.1.

## Hosted prerequisites and bounded blockers

Read-only owner inspection must identify **STAGING `dczlddwbtgvfdujgcitb`**, frontend `https://mushavo-budget-staging.pages.dev/`, current deployed source/version and:
- Email confirmation enabled/disabled; password minimum and required-character settings; secure password-change/recent-login options supported by the project and pinned client.
- Site URL and exact permitted staging callback paths; callback errors; SMTP configuration/deliverability status and email-template redirect behavior. Return summaries, never SMTP secrets or complete links.
- Applicable rate/session settings and actual plan capability. Do not claim paid leaked-password protection or advanced session limits are active.
- Separate owner-controlled inbox/test identities and explicit dispatch boundaries for signup, reset, Admin and Business invitation tests. Preserve `audit.owner@example.com`, `audit.outsider@example.com`, retained Personal/Family fixtures and two USD1 manual conversions. Those retained accounts must not be silently elevated, enrolled, password-reset or repurposed as destructive Auth fixtures.
- Admin invite creation's controlled MFA-ready privileged actor; Business fixture/guard parity and test workspace availability; account recovery and safe cleanup of any new fixtures.

Project Auth settings cannot be verified by the selected public SQL metadata receipts. Missing mailbox, identity, deployment, settings, privileged actor or Business prerequisite makes the dependent cases **BLOCKED in 3.5.3**. Independent safe cases can still be recorded. No production substitute, native rebuild or provider job is inferred.

## Local regression receipt

Executed eight existing Node test files from the pinned source: session recovery (6), startup recovery (3), Admin invitation exit (3), setup retry (3), completion (7), invitations (5), replacement (3), signup currencies (5). **35 tests: 34 PASS, 1 FAIL; Node exit 1.** These tests mix VM/mocked behavior with source assertions and do not run real Supabase Auth.

The failing test “a session reset repairs a button left mid sign-out” first executes the button-reset helper successfully, then requires `resetSignOutButtons()` to be the first statement of `resetState()`. The reviewed MFA candidate instead first calls `adminMfa.bind(null)` and `clearAdministrativeData()`, then calls the same reset helper. Record this as **test compatibility REVIEW**, not a demonstrated failed sign-out or a passing suite. Replace the statement-order assertion with a behavioral reset check in 3.5.2. Initial partial-checkout missing-style error was resolved by fetching the pinned dependency before the complete 35-test run; it is not a product failure.

## Carry-forward actions

| ID | Required work and closure evidence |
|---|---|
| AU-R01 | Match server-supported new-password/secure-change settings to UI; verify boundary rejection and existing-password sign-in |
| AU-R02 | Correct confirmation/shared-fallback guidance and generic resend/account-existence handling; verify hosted confirmation and unfinished-invitation behavior |
| AU-R03 | Ordinary recovery/change candidate, isolated identity/storage, expired/used-link/retry/reauthentication acceptance |
| AU-R04 | Business first-password path with new/existing-recipient controls; retain Business source/fixture blockers until reconciled |
| AU-R05 | Sign-out failures, push cleanup/session outcome, Business/account-switch clearing and behavioral reset regression |
| AU-R06 | Source/deployment/settings/controlled-mailbox prerequisites, full bounded AU01–AU05 hosted receipt and fresh re-audit |

These are F08/F15 follow-through, not new findings or completed remediations. Retain PF-R01–PF-R05, Business checkpoint actions and AM-R01–AM-R05 independently.

## Primary documentation consulted

Current documentation explains the intended Auth APIs; it does not establish this project's settings or hosted behavior:
- [Supabase password security](https://supabase.com/docs/guides/auth/password-security): server-configured password rules and secure password-change options; leaked-password protection is plan-dependent.
- [JavaScript password reset](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail): request a reset, handle recovery, then update the password.
- [Password-based Auth](https://supabase.com/docs/guides/auth/passwords).
- [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): configured permitted destinations and callback handling.
