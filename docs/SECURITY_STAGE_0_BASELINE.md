# Security and store release — Stage 0 baseline

Prepared 5 October 2026; live/native evidence updated 6 October 2026. Baseline: `d2a32032b1c560bbae853de87837c3436ea44887`, web/PWA **4.9.39**.

**Stage 0 is in progress. Both narrow database permission repairs pass the owner-supplied live metadata rechecks. Android source values match the Capacitor 8 baseline. Locked web asset builds pass locally and in the owner's isolated Windows worktree. The scoped UUID repair passes local and owner-supplied Windows checks with zero known npm findings. GitHub CI also passes at 2c4b570; its deployment job was skipped. Owner screenshots identify Cloudflare Workers Static Assets and separate audit-branch version uploads. Later evidence shows newly enabled Confirm email, Apple disabled and owner-reported Google disabled. Normal signup/confirmation and the specified Admin invitation smoke tests are owner-reported PASS. Production promotion, Business invitations/recovery, broader authorization, original-project reconciliation, native toolchain/device validation and backup/session protection remain unverified. The owner deferred the APK update; no APK was built or changed. The app is not cleared for store submission.**

The owner approved starting Stage 0 and clarified the working method: audit, fix confirmed failures within the approved stage, and recheck. The earlier document-only restriction no longer prevents this authorized work. Stages 1–10 and destructive/major production changes are not automatically approved by Stage 0.

## Evidence collected

| Check | Result | Evidence and limit |
|---|---|---|
| Repository baseline | VERIFIED | Main commit above; clean checkout before Stage 0 changes; 48 migration files and 79 application tables declared in the accumulated schema. No repository or ancestor AGENTS.md was found in this workspace. |
| Existing automated suite | PASS | **387/387**, zero failed/skipped/cancelled, Node 24.19.0. CI specifies Node 22; this local run does not certify the CI environment. Most checks use source/fixtures rather than production. |
| Custom roles SQL | PASS, isolated | Existing `verify-business-custom-roles-sql.cjs`, PGlite 0.5.8: complete custom-role migration plus owner restrictions, scopes, overrides, dependencies, stale edits, invitations, archives, rollback, isolation and expiry. Some surrounding services/functions are fixture substitutes. |
| Budgets/approvals SQL | PASS, isolated | Existing Stage 8 SQL verifier: lifecycle, periods, snapshots, duplicate-safe actuals, scope, suspension/expiry and private RPC checks. |
| Reports SQL | PASS, isolated | Existing Stage 9 SQL verifier: currencies, paid/commitment calculations, links, dates, scopes, export escaping, snapshots and expiry. |
| Business billing SQL | PASS, isolated | Existing Stage 10 SQL verifier: quote/proof validation, proration, concurrency-related guards, idempotency, seats, expiry and Personal/Family delegation. |
| Realtime SQL | PASS, isolated | Existing Stage 12 SQL verifier: private signals, transactional events, revocation/suspension, workspace isolation and its 20 metadata checks. This is not a live websocket test. |
| Native web asset build | PASS, local and owner-supplied Windows | Initial clean-checkout build failed on undeclared dependencies. Repaired locked install/builder pass locally: 9 HTML pages, 85 local references and a 26,500-byte bridge. The owner independently ran `npm.cmd ci`, the actual builder and the six-package inventory at `86f2063`; all expected versions match. The repaired dependency tree, actual consumer verifier and asset build also pass at `2c4b570` in the same Windows/Node 22.17.0 audit worktree. Five filesystem regressions pass. This is web packaging, not native compilation/device/release evidence. |
| Tracked npm dependency advisories | PASS, local and owner-supplied Windows | The owner's three moderate findings reproduce as one UUID advisory propagated through CLI → xcode → uuid. A version-scoped UUID 11.1.1 override keeps every other locked package version/path and the established Capacitor pins. Clean install, actual CommonJS Xcode template mutation and UUID bounds checks pass; local `npm audit --json` and the owner's Windows `npm.cmd audit` report zero known findings on 6 October. This covers the npm tree, not CDN/Edge/native SDKs, secrets or an existing APK. |
| GitHub pull-request CI | PASS, remote | Run [37430712809](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/37430712809), head `2c4b570`, completed successfully. Automated tests, locked native consumer/build, custom-role SQL and Stage 0 SQL steps pass. Deployment was skipped; no signed artifact or production deployment is established. |
| Custom-role browser fixture | NOT TESTED | Playwright is available, but its Chromium executable is absent here. The fixture could not launch; this is not evidence of a UI defect. PC/phone acceptance remains required. |
| Current tracked-text secret signatures | LIMITED CHECK: no matches | Private-key headers, Supabase secret-key strings and decoded service-role JWT literals were checked without printing values. Available history was also searched for private-key/secret-key signature changes, with no matching commits. This is not a comprehensive historical-secret or dependency-advisory scan. |
| Live assets | VERIFIED, public GET only | `/app.js` and `/business.js` bytes match the pinned source. SHA-256 evidence is in `security-stage-0-evidence.json`. |
| Live response headers | FAIL, sampled property | Homepage, `/app`, `/business`, `/signup`, `/app.js` and `/business.js` lack CSP, report-only CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy and Permissions-Policy in this sample. No exploit is established by missing headers. F07 remains open. |
| Live public policy routes | FAIL, sampled routes | `/privacy`, `/terms` and `/delete-account` return 404. Dedicated equivalents are also absent from tracked source. F01/F02 remain open. |
| Hosting analytics and serving layer | OWNER SCREENSHOT / PUBLIC GET | Cloudflare analytics is injected on sampled HTML. Owner screenshots identify the `mushavobudget` Worker, production branch `main`, custom domain `mushavobudget.com`, no build command and Wrangler deploy/version-upload commands. Source config serves assets from `.`. Audit-branch versions are uploaded separately from GitHub Actions; production promotion and the secondary GitHub Pages role are not established. |
| Live custom-role deployment | OWNER-REPORTED PASS | Owner previously confirmed all 20 custom-role diagnostics passed. Preserve that result, but do not substitute it for current tenant/API/storage/realtime tests. |
| Live database metadata | OWNER-SUPPLIED EVIDENCE | 6 October CSV: **12 PASS, 1 FAIL, 7 REVIEW, 4 CANNOT VERIFY** across all 24 rows. All 79 expected tables have RLS; required buckets are private with type/size limits. The initial diagnostic 08 failed on seven private-table SELECT grants to anon. The subsequent owner-supplied CSV now has **13 PASS, 7 REVIEW, 4 CANNOT VERIFY, zero FAIL**; diagnostic 08 is PASS and all other rows are unchanged. Policies on those seven tables target authenticated; no data exposure was established by the initial grant result. |
| Windows/Android identity | OWNER-SUPPLIED, PARTIAL | Node **22.17.0**; `com.mushavo.budget`, **Mushavo Budget**, `www`; core/CLI/Android **8.5.2**. Source reports SDK 24/36/36, Gradle 8.14.3, AGP 8.13.0, Android versionCode 1/versionName 1.0 and `density` handling. These match the checked Capacitor 8 baseline; actual toolchain execution and merged/signed manifest remain unverified. The pasted local builder omits Business/launcher/native bridge assets, deletes `www` first and skips missing copied files. Preserve the original project while testing the repaired builder separately. |
| Live currency-helper recheck | PASS, metadata | Owner supplied all **12 rows: 10 PASS, 1 REVIEW, 1 CANNOT VERIFY**, zero FAIL. Direct anon/authenticated EXECUTE on both helpers is absent; service access, five protected caller owners, six signed-in entry points and two public lookups retain execution. The anonymous SECURITY DEFINER inventory is now **59**, exactly the previous inventory minus the two helpers. Actual workflows and historical integrity remain unverified. |
| Live Auth configuration | OWNER EVIDENCE, PARTIAL | E17 shows Email enabled, Phone disabled, secure email change on; minimum password length 6, secure password change/current-password requirement/leaked-password protection off. Site URL is `https://mushavobudget.com`; sole redirect is `https://mushavobudget.com/signup.html*`. E18 shows newly enabled Confirm email and new signups on, manual linking/anonymous sign-ins off, and Apple disabled. E19 reports Google disabled. E20/E21 confirm specified normal signup and Admin invitation smoke tests; separate dashboard reload, rates/session/MFA, templates, Business invitations/recovery and wider authorization remain unverified. |
| Live new-signup email confirmation | OWNER-REPORTED PASS | E20 explicitly confirms all three requested outcomes: email arrived, sign-in denied before using the confirmation link, and correct account opened/normal sign-in worked afterward. This is an operator smoke test, not an independently observed trace, every-account guarantee or invitation/recovery test. |
| Live Admin invitation setup | OWNER-REPORTED PASS | E21 confirms prefilled name/email, no workspace access through Back to sign in before setup, and successful completion with intended workspace/plan/currencies after resending a fresh invitation. Direct API denial, absence of premature database records, old-link invalidation and replay are not established by this UI smoke test. |
| Backups and store consoles | CANNOT VERIFY | No authenticated service/admin connector or native release artifact is available. Recovery and release evidence remains required. |

## Stage 0 changes and verification

This branch adds an evidence collector, a tested read-only SQL diagnostic, a coverage register for **all 123 master-audit sections**, this report and a redacted evidence snapshot. After the owner's live results, it also adds narrow private-table SELECT and internal currency-helper EXECUTE migrations, their isolated behavior verifiers, accumulated schema additions and CI execution of all three Stage 0 SQL verifiers. The native follow-up pins dependencies/lockfile against the owner's established Capacitor version, preserves the previous asset bundle on build failure, retains the existing wrapper's install-UI suppression/public-site link, and adds five build regression tests plus a real CI asset-build step. A follow-up scopes patched UUID 11.1.1 to xcode 3.0.1 and adds a real dependency consumer/bounds verifier to CI, keeping Capacitor versions unchanged. Application web/PWA sources, table structures, RLS, financial rules, Android platform source, signing and provider configuration are unchanged. The owner's post-fix live diagnostics confirm the checked anonymous SELECT grants and direct anon/authenticated internal-helper EXECUTE grants are absent.

`scripts/security-stage-0-check.mjs` uses built-in Node modules. It inventories declared/installed Capacitor packages and whitelisted native config fields without printing credentials. `--live` makes nine public HTTPS GET requests with timeouts; network failure remains CANNOT VERIFY. It does not install packages, sync native platforms, call the database or write configuration.

`supabase/diagnostics/security_stage_0_diagnostic.sql` is a single read-only metadata SELECT, verified inside a read-only transaction by its disposable test runner. Its 24 rows check catalog/configuration properties and identify remaining evidence. It avoids user rows, secrets, cron commands, storage-object paths and full function bodies. Missing application tables produce FAIL rows rather than aborting the query. The normal Supabase `storage.buckets` catalog is required. A single SELECT ensures SQL Editor displays the evidence rows directly.

The new tests cover redaction, unavailable native files, network failure, 404 responses, absent headers and live source mismatch. The disposable SQL verifier exercises disabled RLS, missing tables, inherited PUBLIC/column grants, profile privilege escalation, callable internal helpers, a public bucket and the database's rejection of writes inside a read-only transaction. Successful metadata checks do not certify authorization.

After the additions: **395 automated tests pass** on Linux with Node 24.19.0 and the owner's exact Node 22.17.0 version. The separate dependency verifier and actual asset build also pass on both Node versions; GitHub CI at 2c4b570 also passes the automated checks, locked consumer/build and SQL steps, with deployment skipped. Native compilation remains unverified. All three Stage 0 SQL verifiers passed in PGlite 0.5.8 before the native-only follow-up; their implementation is unchanged. The grant verifier exercises actual anon permission-denied queries, authenticated own/other-user reads and updates, server reads, PUBLIC table/column grants, protected RPC execution, public pricing/contact compatibility, reapplication and atomic rollback for inherited access/missing tables/disabled RLS. These are synthetic fixtures, not live JWT/API tests. The five new build tests cover complete local resources/Business/launcher/native loader, unchanged source HTML, repeat builds and preservation on missing dependencies/assets or bundler/promotion failure. Those failure tests substitute the bundler/plugins; the separate successful bundle uses actual pinned packages. Existing application code hashes and web/PWA version remain the pinned baseline; no web cache bump is required.

## 6 October live result and narrow repair

Diagnostic 08 lists `app_admins`, `payment_records`, `payments`, `profiles`, `workspace_invitations`, `workspace_members` and `workspace_subscriptions`. The live policy inventory assigns their policies to authenticated, so anonymous SELECT grants do not alone demonstrate readable customer rows. Remove the unnecessary privilege as defense in depth, then verify live.

`20261006043000_security_stage_0_private_reads.sql` removes SELECT from anon and PUBLIC only on those seven tables. PostgreSQL table-level REVOKE also removes the corresponding column grants. Before revoking PUBLIC, the migration captures and preserves the existing effective authenticated/service_role table or column reads; it does not add readable columns. RLS and write grants stay in place. The transaction aborts if a table/RLS prerequisite is missing or anon retains inherited SELECT; it never changes membership or uses CASCADE. Other custom roles relying only on PUBLIC reads would lose that implicit access; no such role is required by the application source. Unexpected grant chains may produce an error and rollback rather than an automatic broad fix.

**Live recheck received 6 October:** the owner supplied all 24 rows after the repair. Diagnostic 08 changed from FAIL to PASS with an empty `missing_or_granted` list. Every other row is identical to the initial CSV: **13 PASS, 7 REVIEW, 4 CANNOT VERIFY, zero FAIL**. This closes the specific anonymous SELECT grant failure at the catalog level. Production allowed/denied behavior is not certified by this result. The attachment contains SQL results only; a later message supplies installed native package versions. Workflow smoke-test results remain pending. Do not rerun the grant migration solely because REVIEW/CANNOT VERIFY rows remain.

The seven REVIEW rows remain open. The initial inventory had 61 SECURITY DEFINER functions executable by anon; the later currency-helper recheck has 59, exactly removing the two repaired helpers. This is an inventory to classify, not evidence that every remaining function leaks data. Do not blanket-revoke function execution before reviewing Auth/RLS/trigger dependencies and protected/public RPC contracts. The 263 function search paths include two legacy family helpers with `search_path=public`; caller-writable schemas and function behavior still need review. Cron metadata is present; a CLI migration ledger is absent, consistent with possible manual SQL use but not proof that every migration ran.

Apply and recheck from the existing Windows folder; fetching/reading does not overwrite the local native edits:

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin security/stage-0-baseline
git show "FETCH_HEAD:supabase/migrations/20261006043000_security_stage_0_private_reads.sql" | Out-String | Set-Clipboard
```

Run the clipboard SQL in Supabase SQL Editor. Expected: **Success. No rows returned**. If any error is returned, stop and send it; the transaction must not be treated as applied.

Then copy the diagnostic separately and run it:

```powershell
git show "FETCH_HEAD:supabase/diagnostics/security_stage_0_diagnostic.sql" | Out-String | Set-Clipboard
```

Expected: diagnostic 08 becomes PASS; with unchanged other metadata, **13 PASS, 7 REVIEW, 4 CANNOT VERIFY**. Send the returned table. Smoke-test sign-in, Dashboard/Payments, Family membership, Business Teams and Admin subscription reads; the isolated fixture does not certify production workflows.

## Internal currency-helper follow-up

The 61-function anonymous SECURITY DEFINER inventory has now been classified against source: 2 intended public lookups, 2 internal helpers, 23 triggers, 30 signed-in/permission/currency lookup functions and 4 live-only/provider definitions absent from source. The complete mapping and limits are in [SECURITY_STAGE_0_FUNCTION_REVIEW.md](SECURITY_STAGE_0_FUNCTION_REVIEW.md).

The source internal writer `store_api_payment_conversion` accepts trusted conversion parameters without caller authorization. It and the cross-workspace `currency_conversion_backfill_dates` helper were anonymously executable in the owner's initial live catalog. The old PUBLIC-only revocations do not remove separate API-role grants. An isolated fixture using actual currency definitions/table DDL and Supabase-style direct grants reproduces an unauthorized supplied conversion amount and historical-date read. This is source-plus-grant evidence, not proof of a matching live function body or past production tampering. The pre-repair live authenticated EXECUTE state was not supplied; the fixture explicitly covers default authenticated exposure too.

`20261006050000_security_stage_0_currency_helpers.sql` removes PUBLIC/anon/authenticated EXECUTE on those two helpers, explicitly grants service execution, and preserves writer access for trusted owners of five protected triggers/backfills. It aborts if required functions/roles are missing, an API role inherits a protected caller owner, or forbidden helper execution remains inherited. It does not modify function bodies, records, calculations, frontend code, native projects or APKs. The actual-source fixture verifies denied direct calls, preserved trusted-owner payment triggers, owner and finance-staff backfills, service scheduler calls, settings/manual conversions, public lookups, idempotency and inherited-grant rollback. Auth claims and surrounding payment/ownership fixtures are synthetic; full JWT/RLS/approval workflows remain untested live.

PowerShell apply step:

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin security/stage-0-baseline
git show "FETCH_HEAD:supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql" | Out-String | Set-Clipboard
```

Run in Supabase SQL Editor. Expected **Success. No rows returned**; stop and send any error.

```powershell
git show "FETCH_HEAD:supabase/diagnostics/security_stage_0_currency_helpers_diagnostic.sql" | Out-String | Set-Clipboard
```

Run separately. Expected **12 rows: 10 PASS, 1 REVIEW, 1 CANNOT VERIFY**. With all other grants unchanged, the remaining anonymous inventory should have 59 functions. Review/unknown rows remain open. Check legitimate payment conversion, owner settings/manual conversion and the next scheduled currency sync using normal controlled test workflows. Do not test the original helper misuse on real records or delete existing conversion data automatically.

**Live recheck received 6 October:** all 12 rows match that expectation, with no FAIL. Both helpers are present with the checked SECURITY DEFINER/search-path properties; neither anon nor authenticated has effective direct execution. Service access and five protected caller owners retain execution, as do six signed-in currency entry points and two public lookups. The returned inventory contains exactly the original 61 signatures minus these two helpers. This closes the specific EXECUTE defects at the catalog level. It does not verify live function bodies, scheduled runs, normal conversion workflows or historical financial integrity; those checks remain open. No further permission migration is required for this recheck.

## 6 October hosting and Auth screenshots

Six owner-supplied screenshots were recovered and visually reviewed. Only redacted configuration facts and attachment hashes are recorded; images, account email, token names and credential values are not committed. Auth crops omit the project header, so attribution is owner-supplied rather than independently checked against the backend project. Screenshots show displayed settings, not proof that unsaved values were persisted or that workflows pass.

| Area | Displayed configuration | Scope and remaining check |
|---|---|---|
| Cloudflare service | Workers & Pages → `mushavobudget`, Worker Deployments/Version History UI; production branch `main`, non-production builds enabled. | This is Workers Static Assets, not a Pages build-output-directory configuration. Source `wrangler.jsonc` has `assets.directory = "."` and no Worker script; `.assetsignore` excludes development/generated paths. A compatible future header file belongs in that asset directory; no headers are changed here. |
| Cloudflare build commands | Build None; root `/`; deploy `npx wrangler deploy --config ./wrangler.jsonc`; version `npx wrangler versions upload`. | GitHub Actions deployment being skipped does not prevent this independent Cloudflare automation. Actual Wrangler version/build logs are not supplied; Wrangler is not pinned in the tracked npm dependencies. |
| Versions versus production | Version History shows audit-branch versions `a1da38c7`, `f0e1a577`, `6026c9d5` with the corresponding evidence/UUID/native-repair commit messages. Active deployment displays `50b48816`, from one day earlier. | These are Cloudflare version IDs, not Git commit SHAs. The traffic row shows 0% while the slider endpoint shows 100%, so an exact traffic allocation and active version-to-Git mapping cannot be inferred. The screenshot does not establish promotion of audit versions to production. |
| Domains and previews | Production custom domain `mushavobudget.com`; production and preview `workers.dev` URL toggles on, with public-access wording. Builds offers “Set up Worker Previews”. | Enabled version preview URLs are distinct from the separate branch-oriented Worker Previews feature. Public previews are not evidence of an isolated backend. Source `config.js` fixes one Supabase URL, with no per-preview substitution visible; deployed preview configuration and a separate test backend remain unverified. No customer-data exposure is established. |
| Providers and email | Email enabled; Phone disabled; secure email change on; secure password change and current-password requirement off. Minimum length 6; password-requirements control displays “Select an option”; leaked-password protection off; OTP expiry 3600 seconds, length 8. | Google/Apple and Confirm email are absent from the crops. Leaked-password protection has a Pro-and-above notice; this does not establish the owner's plan. No Auth toggle is changed. Policy hardening must include signup, invitation setup, recovery and password-change compatibility. |
| Auth URLs | Site URL `https://mushavobudget.com`; only redirect `https://mushavobudget.com/signup.html*`. | Source signup/recovery/admin invitation uses `signup.html` query routes. Business invitations request `${APP_ORIGIN}/business.html?invitation=…#business/team`, which the displayed signup pattern does not cover. Deployed APP_ORIGIN, email templates and actual link delivery must be checked before a narrow callback change. No broad domain wildcard or live failure is inferred. |

Cloudflare documents [separate version uploads and deployments](https://developers.cloudflare.com/workers/versions-and-deployments/) and [version URLs versus Worker Previews](https://developers.cloudflare.com/workers/ci-cd/builds/). Its [Static Assets header rules](https://developers.cloudflare.com/workers/static-assets/headers/) apply to asset responses, not arbitrary Worker-generated responses. Supabase documents [redirect matching](https://supabase.com/docs/guides/auth/redirect-urls): `*` excludes `.` and `/`, so query-bearing callbacks must be reviewed individually. Its [password guidance](https://supabase.com/docs/guides/auth/password-security) discourages lengths below eight and describes nonce/current-password requirements. Existing signup inputs advertise six characters and invitation setup calls `updateUser({ password, data })`; coordinated Stage 3 changes and recovery tests are required before enabling additional requirements.

At the E17 snapshot, User Signups/Confirm email and Google/Apple rows were missing. E18 supplies User Signups and Apple; Google remained outside that crop. E19 records the owner's explicit confirmation that Google is disabled, so no further provider-status screenshot is requested. Current upstream Studio [providers page](https://github.com/supabase/supabase/blob/master/apps/studio/pages/project/%5Bref%5D/auth/providers.tsx) renders [BasicAuthSettingsForm](https://github.com/supabase/supabase/blob/master/apps/studio/components/interfaces/Auth/BasicAuthSettingsForm.tsx), where Confirm email is in User Signups; the general documentation still describes the Email panel. Expanded Cloudflare active-deployment details are required only to establish its exact production traffic/version mapping.

## 6 October email-confirmation follow-up

The owner says, **“I have only now turned on the confirm email toggle.”** This is an owner-made Auth policy change after E17, not an earlier audit PASS or a change performed by the session. `image(20261006-102713).png` shows new signups and Confirm email on, manual linking and anonymous sign-ins off. `image(20261006-102751).png` shows Email enabled and Phone, SAML 2.0, Web3 Wallet, Apple, Azure, Bitbucket, Discord, Facebook, Figma and GitHub disabled. Google is below the crop and remains unknown. The project header is not supplied; attribution remains owner-reported. Neither screenshot proves save/reload persistence or end-to-end behavior.

[Supabase general configuration](https://supabase.com/docs/guides/auth/general-configuration) states that confirmation is required before first sign-in when enabled and that disabling it implicitly confirms email in the database. Consequently, the new screenshot does not establish actual inbox verification for accounts created while the owner reports the setting was off. Existing accounts and sessions were not inspected or changed.

Source review identifies a confirmation-message gap: after ordinary signup, `signup.html` sets `signup=success` even without a session; `app.js` then says **“Account created successfully. Sign in with your new account.”** Its sign-in failure displays the returned message through generic toast handling; no dedicated `email_not_confirmed` message instructs the user to check their inbox. The backend [error code](https://supabase.com/docs/guides/auth/debugging/error-codes) identifies an unconfirmed-email sign-in denial, but a dashboard toggle is not a test of that denial or proof that the app sends the requested notice. This is an Auth UX gap, not a demonstrated confirmation bypass. No application code is changed in this evidence-only follow-up.

The source normal confirmation callback is `signup.html?mode=self-signup`. That handler reads the verified identity and unfinished-invitation state; with no pending invitation it adopts the session into the app. Admin invitation setup retains its separate verified-session/completion flow. These are source observations, not live email/template/provisioning evidence. Stage 3 must coordinate clear signup/unconfirmed-login messages with confirmation, invitation and recovery tests while retaining the existing workspace-completion guards.

Next controlled check: save if needed, reload the Auth page and confirm the toggle remains on; use one new test inbox owned by the operator to register, check delivery, attempt password sign-in before using the email link (expected denied), open the newest link and verify the correct account/workspace, then sign out and sign in normally. Record outcomes only, never passwords, tokens or full email links. Recheck manual Admin invitations, Business invitations and recovery separately; E17's uncovered Business callback remains unresolved. These live checks have not been performed by this session. Google/Apple configuration remains future Stage 6 work.

**Later owner follow-up (E19):** “done. google is disabled”. Google disabled is recorded as owner-reported configuration, rather than screenshot/API verification. This completes the initial Google/Apple provider-status question; integration remains Stage 6 work. “Done” does not identify whether the owner saved/reloaded the toggle, received a signup email, observed denial before confirmation or completed the link/sign-in checks. Those individual outcomes remain unverified pending clarification; no live PASS is inferred.

**Explicit confirmation received next (E20):** the owner answered **“yes”** to whether all three specified tests passed: (1) confirmation email arrived; (2) password sign-in was blocked before clicking the link; (3) after confirmation, the correct account opened and normal sign-in worked. Record **OWNER-REPORTED PASS** for those outcomes. This resolves E19's ambiguous test status without rewriting the earlier snapshots. No email address, token, trace, device/browser, SMTP configuration or independent test was supplied. Dashboard reload/persistence was not separately confirmed, and detailed workspace provisioning, Admin/Business invitations, recovery, expiry/resend/replay and tenant authorization remain unverified. The signup/unconfirmed-login message gap and Business callback mismatch remain open; no runtime change is made by this evidence follow-up.

**Admin invitation follow-up (E21):** the owner next reports **“done, passed”** after the specified three-step check: manually invite a fresh owned test inbox; confirm prefilled identity and use Back to sign in before completion without gaining workspace access; resend a fresh invitation, complete setup and verify the intended workspace, plan and currencies. Record **OWNER-REPORTED PASS** for those normal UI outcomes. No identifiers, email links, screenshots, database record inspection or independent trace are supplied. This does not prove that premature workspace rows never exist, that direct APIs deny every pending identity, or that replaced/expired/used links are all invalidated. Those negative cases and broader tenant authorization require controlled staging evidence. Business invitations and recovery remain untested; the Business callback mismatch stays open. Reuse the now-registered owned test account for the next Business invitation smoke test, with the correct workspace and assigned role explicitly checked.

## Findings F01–F20

The dated master audit remains the original finding definition. No finding below is closed merely because this report exists. The original register has 17 P1 and 3 P2 items; these priorities mix store blockers, security work and evidence gaps.

| ID | Current conclusion | Evidence / next action | Work stage |
|---|---|---|---|
| F01 | Confirmed missing | Policy pages absent; sampled privacy/terms routes 404. Obtain operator, audience, territories and retention facts before factual policies. | 4 |
| F02 | Confirmed missing; ownership decision required | No tracked user account-deletion process; sampled public resource 404. Review cascades and shared finance/file ownership before implementation. | 4 |
| F03 | Missing in source; product decision | Manual web proof/review workflows exist; no native store purchase integration is present. Decide approved channel and plan/seat mapping. | 7 |
| F04 | Missing in source; Google/Apple disabled by owner evidence | No tracked Google/Apple login integration. E18 shows Apple disabled and newly enabled Confirm email; E19 reports Google disabled. Provider status is recorded; future integration must preserve setup/invitation/account linking. | 6 |
| F05 | Partial source evidence; release cannot verify | Owner supplied application ID, SDK/Gradle values and selected manifest flags. Android Studio/JDK execution, complete/merged manifest, signing identity, release artifact, iOS environment and store-console evidence remain unavailable. | 0, 5, 9 |
| F06 | Asset build PASS locally and on Windows; native/device pending | Core/CLI/Android remain 8.5.2, App 8.1.2, Preferences 8.0.1, esbuild 0.28.2. Owner's isolated Windows build passes at 86f2063. Scoped UUID repair passes local and owner Windows install/audit/consumer/build verification, and GitHub CI passes. Original-project reconciliation and native release evidence remain. APK update is deferred. | 0, 1, 5 |
| F07 | Reconfirmed live gap; serving layer identified | Seven security-header families absent from sampled responses. E17 and source identify Workers Static Assets from `.`; introduce compatible asset headers/CSP and recheck live in Stage 2. | 2 |
| F08 | Source/Auth UX gap; normal confirmation/Admin invite owner-tests PASS | No tracked Admin MFA/aal2 integration. E17 shows minimum length 6 and secure/current-password checks off. E20/E21 confirm normal signup/confirmation and specified Admin invitation UI outcomes. Source notices, separate reload, Business invitation/recovery, Auth/infrastructure MFA and rate/session settings remain open. | 3 |
| F09 | Reconfirmed source gap | `site.js` inserts directly into enquiries. Column validation exists; no authoritative challenge/quota path found for this submission. | 2 |
| F10 | Conditional compatibility | Invitation/test-push functions compare request Origin with APP_ORIGIN. Actual local/native origins are unknown. Keep identity checks while testing explicit supported origins. | 5 |
| F11 | Cannot verify native transport | Browser Web Push exists. No tracked FCM/APNs integration; inspect actual devices/native projects. | 8 |
| F12 | Source validation gap, exploit not proved | Stored Web Push endpoints are sent through web-push 3.6.7 without explicit destination/network controls in the reviewed senders. Controlled egress assessment and compatibility tests required. | 2 |
| F13 | Needs improvement | Private buckets/type/size restrictions exist. Content-signature/normalization controls were not found. Add justified server validation and safe downloads. | 4 |
| F14 | Native session/backup protection needs review | Default Supabase browser clients are tracked; no native credential-storage adapter is visible. Owner's source reports allowBackup=true and does not report fullBackupContent/dataExtractionRules in the selected lines. Inspect full/merged configuration and define/test sensitive storage exclusions for cloud and device transfer; no token backup/disclosure is established. Workspace Preferences are metadata, not protected token storage. | 5 |
| F15 | Both targeted grant rechecks PASS; Auth callback mismatch needs review | Owner-supplied diagnostic 08 and all ten currency-helper property checks pass. The remaining 59 anonymous functions need review. E17's sole signup redirect does not cover the Business invitation source callback; verify deployed origin and controlled delivery. JWT/API/storage/realtime, scheduled execution, historical integrity and complete legitimate workflows remain required. | 0, 3, 9 |
| F16 | Cannot verify | Schema files are not record/object backups. Confirm plan, actual recovery coverage, retention and isolated restore drill. | 1 |
| F17 | Documented; archive unknown | Preferences UserDefaults/CA92.1 is documented, but actual iOS privacy manifest and archive are unavailable. | 5, 9 |
| F18 | Partial foundations; further work | Existing tests/SQL workflow and limited signature checks exist. Native asset CI and scoped npm repair are present. E17 shows unversioned npx Wrangler commands outside the locked npm audit; deployed tooling version, native/device CI, broader supply-chain/artifact scans and repository protection remain unverified. | 1 |
| F19 | Hosting partially evidenced; operations/isolation unverified | E17 confirms main production builds, audit-branch version uploads and public version-preview settings. Separate Supabase staging, preview backend isolation, exact active production mapping, alert routing, budgets, incident owner and recovery runbook remain unverified. | 1, 10 |
| F20 | Reconfirmed collection; incomplete disclosure | User-linked activity-hour data, push device/user-agent fields and injected Cloudflare analytics exist. Complete actual processor/retention/native SDK inventory. | 0, 4, 9 |

The coverage register in `SECURITY_AUDIT_REGISTER.md` maps every section to its evidence scope, work stage, owner and required test. Source-supported controls stay in place; unknowns remain unknown.

## PowerShell — first live Supabase step

Run from the existing folder. Fetching the branch does not overwrite local/native work:

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
git fetch origin security/stage-0-baseline
git show "FETCH_HEAD:supabase/diagnostics/security_stage_0_diagnostic.sql" | Out-String | Set-Clipboard
```

Paste into **Supabase → SQL Editor** and run. This is a diagnostic, not a migration. Expect **24 rows** with a mixture of **PASS**, **REVIEW** and **CANNOT VERIFY**. Any **FAIL** needs investigation. Do not expect every row to be TRUE/PASS: for example, metadata cannot establish backup restoration or actual JWT isolation. Send the returned table or screenshots; no user details or secrets are requested.

## PowerShell — preserve and inventory the existing native setup

Before any pull/merge, inspect local changes. Do not stash/delete/reset the Android project or replace its application ID/signing configuration.

```powershell
git status --short
node --version
npm.cmd ls @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios @capacitor/app @capacitor/preferences esbuild --depth=0
if (Test-Path .\capacitor.config.json) {
  Get-Content .\capacitor.config.json | ConvertFrom-Json | Select-Object appId, appName, webDir
}
```

An npm missing-package/nonzero result is useful baseline evidence. These commands do not install or upgrade anything. `npm.cmd` selects the Windows command launcher explicitly when PowerShell blocks npm.ps1; no execution-policy change is needed. Send this output. If the config is TypeScript instead, report that filename; do not paste credentials or whole signing/config files.

**Package output received 6 October:** core, CLI and Android are all **8.5.2**. The repository builder imports App, Preferences and esbuild, which were absent from the supplied depth-0 list. iOS is also absent, which does not prevent an Android-only build. Node 22.17.0 meets the [Capacitor 8 Node minimum](https://capacitorjs.com/docs/updating/8-0); this is compatibility evidence, not a Node security/advisory assessment. The repair pins the three established core/platform/CLI versions without a major upgrade. App 8.1.2 and Preferences 8.0.1 both declare a compatible >=8.0.0 core peer; esbuild 0.28.2 supports Node >=18. Versions were checked against the official npm registry and used in the actual successful bundle. The initial native repair preserved all existing locked package versions and paths. The subsequent advisory repair changes only transitive UUID from 7.0.3 to 11.1.1; every other package version/path remains unchanged. The npm audit scope excludes CDN/Edge/native SDKs and existing release artifacts.

Next, run these read-only local checks and send their output:

```powershell
Set-Location "C:\Users\HP\Desktop\Mushavo Budget"
Get-Content .\scripts\build-capacitor.mjs
Get-Content .\android\variables.gradle
Select-String -Path .\android\gradle\wrapper\gradle-wrapper.properties -Pattern 'distributionUrl'
Select-String -Path .\android\build.gradle -Pattern 'com.android.tools.build:gradle'
Select-String -Path .\android\app\build.gradle -Pattern 'applicationId|namespace|minSdk|targetSdk|compileSdk|versionCode|versionName|VERSION_'
Select-String -Path .\android\app\src\main\AndroidManifest.xml -Pattern 'allowBackup|usesCleartextTraffic|exported|configChanges|permission|dataExtractionRules|fullBackupContent'
```

Also report whether a Mac with Xcode is available for iOS. These checks do not run the builder, sync Capacitor, install packages or create an APK. Missing optional manifest flags are evidence to inspect, not an automatic failure. Do not paste full signing blocks, keystores, passwords or `local.properties`.

**Android/source results received 6 October:** minSdk 24, compile/targetSdk 36, Gradle 8.14.3, AGP 8.13.0 and the listed AndroidX versions match the [Capacitor 8 baseline](https://capacitorjs.com/docs/updating/8-0); `configChanges` includes `density`. Namespace/applicationId are both `com.mushavo.budget`. VersionCode 1/versionName 1.0 are native release fields, independent of web/PWA 4.9.39; any uploaded store history remains unknown. The selected source lines show allowBackup=true, one exported=true component and another exported=false component with grantUriPermissions=true. Component names/intent filters, provider paths and any library/variant overrides were not supplied; do not blanket-disable the launcher. No usesCleartextTraffic/fullBackupContent/dataExtractionRules field appears in the supplied matches; final effective defaults/configuration need inspection.

The local builder is an older custom copy script. It does not include Business assets, the shared workspace launcher or native App/Preferences bridge, removes `www` before validation and ignores ENOENT on copied files. Its original install-UI suppression and external public-site link are intentional behaviors retained by the repaired repository builder. The new builder validates sources, builds in a sibling temporary directory and promotes the completed bundle with previous-output restoration if promotion fails. No Android project or APK was generated in this session.

### Windows asset and dependency repair results

**Initial owner result received 6 October:** the isolated worktree at `C:\Users\HP\Desktop\Mushavo Budget Native Audit` was detached at `86f2063`. `npm.cmd ci` succeeded, the actual asset builder reported the session-aware launcher/workspace/resume integration, and all six top-level package versions matched the pins above. This closes the Windows asset-packaging prerequisite for that commit. The original native project was not reconciled or rebuilt. The owner explicitly deferred the APK update; no APK is available from this work.

The install also reported a deprecated UUID 7.0.3 and three moderate npm findings. The reproduced audit traces all three entries to `@capacitor/cli@8.5.2 → xcode@3.0.1 → uuid@7.0.3`, with one underlying [GHSA-w5hq-g745-h8pq / CVE-2026-41907](https://github.com/advisories/GHSA-w5hq-g745-h8pq). It concerns invalid caller-provided output-buffer bounds in UUID v3/v5/v6 methods. Xcode's inspected UUID call uses v4, which the advisory excludes; this is not evidence of an exploited application or APK defect.

The repair overrides UUID **only under xcode 3.0.1** to **11.1.1**, the [maintainer's CommonJS-compatible patched release](https://github.com/uuidjs/uuid/releases/tag/v11.1.1). CLI/core/Android remain 8.5.2; other locked versions and paths are retained. The [npm version-scoped override mechanism](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides) records the decision reproducibly. `npm audit fix --force` was not used: its proposed CLI version was 8.4.3, a downgrade from the established 8.5.2.

A fresh locked install passes. The actual consumer verifier resolves UUID from Xcode's CommonJS context, rejects nine invalid-buffer cases without partial writes, accepts valid buffers for all three methods, generates 256 project identifiers, and parses/edits/writes/reparses Capacitor's shipped CocoaPods Xcode template. The actual asset build and all 395 automated tests pass. Verification includes Linux Node **22.17.0** and **24.19.0**; the resulting npm audit has **zero known findings** as of 6 October. This does not certify macOS/Xcode compilation, devices, existing APKs or dependencies outside the npm lockfile.

The full-suite check on Node 22.17.0 initially failed because an existing currency test imports TypeScript. `npm test` now explicitly enables [Node type stripping](https://nodejs.org/download/release/v22.17.0/docs/api/cli.html#--experimental-strip-types), and CI uses that command. The existing deployment-gate assertion follows the package command. The recheck passes all 395 tests; application code is unchanged.

**Owner dependency recheck received 6 October:** the existing isolated worktree fast-forwarded cleanly from `86f2063` to `2c4b570`. `npm.cmd ci` and `npm.cmd audit` each reported **zero vulnerabilities**. The actual verifier returned PASS with CLI 8.5.2, xcode 3.0.1 and UUID 11.1.1: nine invalid-buffer cases, three valid-buffer methods, 256 identifiers and template parse/edit/write/reparse all pass on Windows Node 22.17.0. The actual asset builder also succeeded. This closes the reported npm advisory and Windows web-packaging rechecks; the verifier explicitly reports native compilation/device testing as false. The APK update remains deferred.

**GitHub CI verified 6 October:** [run 37430712809](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/37430712809) completed successfully for PR #90 at `2c4b570`. The automated checks, locked dependency consumer/asset build, custom-role SQL and three Stage 0 SQL verification steps pass. The deploy job is skipped because this is a pull-request run; this is not a production release.

The following block records the already-completed Windows procedure for reproducibility. It does not require another run to close this check. It stops on local source changes or a failed fast-forward and produces `www`, with no native sync or APK build:

```powershell
& {
  Set-Location "C:\Users\HP\Desktop\Mushavo Budget Native Audit"
  $nativeAuditChanges = git status --porcelain
  if ($LASTEXITCODE -ne 0) { throw "Status check failed." }
  if ($nativeAuditChanges) { throw "Audit worktree has local changes. Send git status --short." }
  git fetch origin security/stage-0-baseline
  if ($LASTEXITCODE -ne 0) { throw "Fetch failed." }
  git merge --ff-only FETCH_HEAD
  if ($LASTEXITCODE -ne 0) { throw "Fast-forward failed." }
  npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw "Dependency install failed." }
  node .\scripts\verify-native-build-dependencies.cjs
  if ($LASTEXITCODE -ne 0) { throw "Dependency verification failed." }
  npm.cmd audit
  if ($LASTEXITCODE -ne 0) { throw "Audit still reports findings. Send this output." }
  npm.cmd run build:capacitor
  if ($LASTEXITCODE -ne 0) { throw "Asset build failed." }
}
```

Observed: dependency verifier PASS, zero npm vulnerabilities and a successful asset build. Output is `C:\Users\HP\Desktop\Mushavo Budget Native Audit\www`, a web asset folder. The owner's original Android/config/signing files stay in the original project; its reconciliation and later APK release remain separate work.

Android backup is a separate Stage 5 check. The [official backup guidance](https://developer.android.com/identity/data/autobackup) explains broad default inclusion and separate older/newer Android rules; allowBackup=false alone is insufficient to guarantee device-transfer exclusion on all manufacturers. Inspect and test actual token/WebView storage and both backup modes before certifying protection. No backup flags were changed here.

For future local updates, after preserving local changes and when the branch is merged:

```powershell
git fetch origin main
git merge --ff-only origin/main
```

Stop and send the conflict/divergence message if the fast-forward is refused. Do not reset, clean or force-pull to get around it. `npm ci` is not a Stage 0 instruction for the existing Windows project: its native dependencies are currently untracked and must be reconciled first.

## Additional evidence to close Stage 0

| Input | Evidence needed | Why it changes the implementation |
|---|---|---|
| Hosting | Workers Static Assets, main production branch, commands, audit-version history and public URL toggles received. Exact active production/version mapping, TLS/redirects and secondary GitHub Pages role remain unverified. No API tokens. | Headers must be added to the layer actually serving the app; independent Cloudflare automation is distinct from GitHub CI. |
| Supabase Auth/Edge | E17 supplies email/password/site/redirect settings; E18 shows newly enabled confirmation, general controls and Apple disabled; E19 reports Google disabled; E20/E21 confirm normal signup and specified Admin invitation UI tests PASS. Separate reload, Business invitation/recovery, rates/session/MFA, deployed function dates, APP_ORIGIN and wider authorization remain unverified. Secret names/presence only, never values. | Review confirmation notices and the uncovered Business callback; preserve signup/invitations/recovery while defining supported web/native callbacks. |
| Supabase database | Initial/post-table-fix 24-row results and post-helper-fix 12-row results received; both narrow repairs pass their metadata checks. Complete legitimate workflows, scheduled execution and isolated authorization tests. | Effective catalog/grant state can differ from accumulated source or manual migration history. |
| Recovery/operations | Plan/backup retention, PITR availability, object-byte backup method, any restore drill, alert/budget configuration, incident owner and support mailbox. | Establish recoverability and service costs; no restore of production. |
| Staging | Public Worker version-preview URLs are enabled; a separate backend/inboxes and deployed preview configuration are not established. Provide existing separate Supabase project and controlled inboxes, or confirmation they do not yet exist. | Version upload is not backend isolation. Negative tests and future deletion/billing work need synthetic isolated data. |
| Native | Node/config identity, core/CLI/Android 8.5.2, local builder and selected Android manifest/Gradle values received. Repository asset build passes with locked dependencies. The isolated Windows asset recheck passes at 86f2063. The Windows dependency/consumer/asset recheck passes at 2c4b570, and GitHub CI passes for the same commit. Original-project reconciliation and Android Studio/JDK/merged-manifest/backup/signed-artifact evidence remain deferred to native work; Mac/Xcode availability still unanswered. APK update is deferred by the owner. | Preserve current core major, app ID, platform source and signing identity. |
| Stores/operator | Account type/status, intended countries/audience and actual operator/support identity. | Determines publishing/test obligations and factual policy declarations. |

Do not send service-role keys, access/refresh tokens, MFA recovery codes/seeds, keystores, signing passwords, private keys, full customer records or backups with real financial data.

## Staging design for the next implementation stage

Use a separate Supabase project and preview deployment with separate Auth URLs, Storage, service credentials and dedicated staging cron secrets. Start with cron/automatic notifications disabled. Use synthetic workspaces and controlled inboxes; do not copy production customers, dispatch production messages or buy services to create this baseline. Later configure store sandbox identities/products separately.

Reuse Daniel, Priya, Tendai, Aisha and Brian with the agreed TEST workspaces/branches. Every negative test records caller role, workspace, operation, expected result and observed result. Direct API, object downloads and realtime removal tests are separate from a UI hiding an action. Deletion, subscription and ownership changes use synthetic data only.

## Implementation and recheck sequence

1. Read the owner's live/native results and reconcile the baseline.
2. Investigate any unexpected FAIL. Fix demonstrated issues within approved Stage 0 scope using narrow changes and tests; architectural/destructive work stays subject to the agreed higher-risk boundary.
3. Record confirmed later-stage gaps without claiming closure. The existing Capacitor core/CLI/Android versions are now pinned as 8.5.2, and the repository asset build passes; reconcile the separate Windows check with the original native project before a native rebuild. Headers/contact controls belong to Stage 2, Admin MFA/tenant enforcement to Stage 3, deletion/policies to Stage 4, and token/backup/native release protection to Stage 5.
4. Re-run the affected diagnostics and allowed/denied behavior after each fix. A catalog PASS is a property check; final behavior still needs direct tests.
5. Close Stage 0 only when the required external/native inputs are accounted for, staging requirements are concrete and the worklist is evidence-backed. An unavailable iOS environment becomes a documented prerequisite, not a silent PASS.

Estimated scope, pending these inputs: Stage 1 is moderate with external recovery work; Stage 2 is moderate and hosting-dependent; Stage 3 is large because authorization/MFA requires end-to-end coverage; Stage 4 is large and ownership/retention-dependent; Stage 5 is moderate to large depending on native setup; Stage 6 is moderate to large because of invitations/linking; Stage 7 is the largest financial/product stage; Stage 8 is moderate to large across devices; Stages 9–10 include external store testing/review. No calendar or service price is credible until the missing inputs and product decisions are resolved.

## Rollback and release boundary

The baseline diagnostics/documentation need no data rollback. The 6 October follow-ups additionally include narrowly scoped table/function grant migrations for owner application; reverting a Git commit does not revert applied database grants. If an unexpected live workflow fails, inspect that operation and restore only justified authenticated/service access rather than regranting anonymous private-table reads. Failed prerequisites roll the entire transaction back. Both the existing Pages allowlist and Cloudflare `.assetsignore` exclude development paths. No Edge deployment or app release/cache bump is required. Native rebuilds, provider settings and store submissions are later work.

Official technical references used for subsequent native choices: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Preferences](https://capacitorjs.com/docs/apis/preferences), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Supabase backups](https://supabase.com/docs/guides/platform/backups). Recheck the documentation for the **actual existing core major**; current/latest documentation is not permission to upgrade it.
