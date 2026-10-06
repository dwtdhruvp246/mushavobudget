# Security and store release — Stage 0 baseline

Prepared 5 October 2026; live/native evidence updated 6 October 2026. Baseline: `d2a32032b1c560bbae853de87837c3436ea44887`, web/PWA **4.9.39**.

**Stage 0 is in progress. The owner supplied live database metadata and partial Windows/Android evidence; the private-table grant fix has passed the owner-supplied live metadata recheck, an additional internal currency-helper fix awaits application/recheck, and native package/provider evidence is pending. The app is not cleared for store submission.**

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
| Native web asset build | FAIL | `npm run build:capacitor` fails before replacing `www`: esbuild and Capacitor dependencies are not declared/installed in this checkout. F06 remains open. |
| Custom-role browser fixture | NOT TESTED | Playwright is available, but its Chromium executable is absent here. The fixture could not launch; this is not evidence of a UI defect. PC/phone acceptance remains required. |
| Current tracked-text secret signatures | LIMITED CHECK: no matches | Private-key headers, Supabase secret-key strings and decoded service-role JWT literals were checked without printing values. Available history was also searched for private-key/secret-key signature changes, with no matching commits. This is not a comprehensive historical-secret or dependency-advisory scan. |
| Live assets | VERIFIED, public GET only | `/app.js` and `/business.js` bytes match the pinned source. SHA-256 evidence is in `security-stage-0-evidence.json`. |
| Live response headers | FAIL, sampled property | Homepage, `/app`, `/business`, `/signup`, `/app.js` and `/business.js` lack CSP, report-only CSP, HSTS, nosniff, X-Frame-Options, Referrer-Policy and Permissions-Policy in this sample. No exploit is established by missing headers. F07 remains open. |
| Live public policy routes | FAIL, sampled routes | `/privacy`, `/terms` and `/delete-account` return 404. Dedicated equivalents are also absent from tracked source. F01/F02 remain open. |
| Hosting analytics | PRESENT | Cloudflare analytics is injected on the sampled HTML pages. The fronting server identifies as Cloudflare; the repo also contains a GitHub Pages workflow and Wrangler asset configuration. The current origin/deployment relationship needs dashboard evidence. |
| Live custom-role deployment | OWNER-REPORTED PASS | Owner previously confirmed all 20 custom-role diagnostics passed. Preserve that result, but do not substitute it for current tenant/API/storage/realtime tests. |
| Live database metadata | OWNER-SUPPLIED EVIDENCE | 6 October CSV: **12 PASS, 1 FAIL, 7 REVIEW, 4 CANNOT VERIFY** across all 24 rows. All 79 expected tables have RLS; required buckets are private with type/size limits. The initial diagnostic 08 failed on seven private-table SELECT grants to anon. The subsequent owner-supplied CSV now has **13 PASS, 7 REVIEW, 4 CANNOT VERIFY, zero FAIL**; diagnostic 08 is PASS and all other rows are unchanged. Policies on those seven tables target authenticated; no data exposure was established by the initial grant result. |
| Windows/Android identity | OWNER-SUPPLIED, PARTIAL | Node **22.17.0**; `com.mushavo.budget`, **Mushavo Budget**, `www`. Local package/lock/gitignore edits and untracked Android/config/scripts must be preserved. npm.ps1 was blocked by PowerShell, so installed package versions remain unknown; use npm.cmd. No signed build has been verified. |
| Live Auth, backups and store consoles | CANNOT VERIFY | No authenticated service/admin connector or native project is available in this session. Provider, recovery and release-artifact evidence remains required. |

## Stage 0 changes and verification

This branch adds an evidence collector, a tested read-only SQL diagnostic, a coverage register for **all 123 master-audit sections**, this report and a redacted evidence snapshot. After the owner's live results, it also adds narrow private-table SELECT and internal currency-helper EXECUTE migrations, their isolated behavior verifiers, accumulated schema additions and CI execution of all three Stage 0 SQL verifiers. Application code, dependencies, package lock, table structures, RLS, financial rules, signing and provider configuration are unchanged. The owner's post-fix live diagnostic confirms the checked anonymous SELECT grants are absent.

`scripts/security-stage-0-check.mjs` uses built-in Node modules. It inventories declared/installed Capacitor packages and whitelisted native config fields without printing credentials. `--live` makes nine public HTTPS GET requests with timeouts; network failure remains CANNOT VERIFY. It does not install packages, sync native platforms, call the database or write configuration.

`supabase/diagnostics/security_stage_0_diagnostic.sql` is a single read-only metadata SELECT, verified inside a read-only transaction by its disposable test runner. Its 24 rows check catalog/configuration properties and identify remaining evidence. It avoids user rows, secrets, cron commands, storage-object paths and full function bodies. Missing application tables produce FAIL rows rather than aborting the query. The normal Supabase `storage.buckets` catalog is required. A single SELECT ensures SQL Editor displays the evidence rows directly.

The new tests cover redaction, unavailable native files, network failure, 404 responses, absent headers and live source mismatch. The disposable SQL verifier exercises disabled RLS, missing tables, inherited PUBLIC/column grants, profile privilege escalation, callable internal helpers, a public bucket and the database's rejection of writes inside a read-only transaction. Successful metadata checks do not certify authorization.

After the additions: **390 automated tests pass**, and all three Stage 0 SQL verifiers pass in PGlite 0.5.8. The grant verifier exercises actual anon permission-denied queries, authenticated own/other-user reads and updates, server reads, PUBLIC table/column grants, protected RPC execution, public pricing/contact compatibility, reapplication and atomic rollback for inherited access/missing tables/disabled RLS. These are synthetic fixtures, not live JWT/API tests. Existing application code hashes and web/PWA version remain the pinned baseline; the grant migration requires no web cache bump.

## 6 October live result and narrow repair

Diagnostic 08 lists `app_admins`, `payment_records`, `payments`, `profiles`, `workspace_invitations`, `workspace_members` and `workspace_subscriptions`. The live policy inventory assigns their policies to authenticated, so anonymous SELECT grants do not alone demonstrate readable customer rows. Remove the unnecessary privilege as defense in depth, then verify live.

`20261006043000_security_stage_0_private_reads.sql` removes SELECT from anon and PUBLIC only on those seven tables. PostgreSQL table-level REVOKE also removes the corresponding column grants. Before revoking PUBLIC, the migration captures and preserves the existing effective authenticated/service_role table or column reads; it does not add readable columns. RLS and write grants stay in place. The transaction aborts if a table/RLS prerequisite is missing or anon retains inherited SELECT; it never changes membership or uses CASCADE. Other custom roles relying only on PUBLIC reads would lose that implicit access; no such role is required by the application source. Unexpected grant chains may produce an error and rollback rather than an automatic broad fix.

**Live recheck received 6 October:** the owner supplied all 24 rows after the repair. Diagnostic 08 changed from FAIL to PASS with an empty `missing_or_granted` list. Every other row is identical to the initial CSV: **13 PASS, 7 REVIEW, 4 CANNOT VERIFY, zero FAIL**. This closes the specific anonymous SELECT grant failure at the catalog level. Production allowed/denied behavior is not certified by this result. The attachment contains SQL results only; installed native package versions and workflow smoke-test results remain pending. Do not rerun the grant migration solely because REVIEW/CANNOT VERIFY rows remain.

The seven REVIEW rows remain open. In particular, 61 SECURITY DEFINER functions are executable by anon, including intended public lookups, helpers and trigger functions; this is an inventory to classify, not evidence that all 61 leak data. Do not blanket-revoke function execution before reviewing Auth/RLS/trigger dependencies and protected/public RPC contracts. The 263 function search paths include two legacy family helpers with `search_path=public`; caller-writable schemas and function behavior still need review. Cron metadata is present; a CLI migration ledger is absent, consistent with possible manual SQL use but not proof that every migration ran.

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

The source internal writer `store_api_payment_conversion` accepts trusted conversion parameters without caller authorization. It and the cross-workspace `currency_conversion_backfill_dates` helper are anonymously executable in the owner's live catalog. The old PUBLIC-only revocations do not remove separate API-role grants. An isolated fixture using actual currency definitions/table DDL and Supabase-style direct grants reproduces an unauthorized supplied conversion amount and historical-date read. This is source-plus-grant evidence, not proof of a matching live function body or past production tampering. The live authenticated EXECUTE state was not supplied; the fixture explicitly covers default authenticated exposure too.

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

## Findings F01–F20

The dated master audit remains the original finding definition. No finding below is closed merely because this report exists. The original register has 17 P1 and 3 P2 items; these priorities mix store blockers, security work and evidence gaps.

| ID | Current conclusion | Evidence / next action | Work stage |
|---|---|---|---|
| F01 | Confirmed missing | Policy pages absent; sampled privacy/terms routes 404. Obtain operator, audience, territories and retention facts before factual policies. | 4 |
| F02 | Confirmed missing; ownership decision required | No tracked user account-deletion process; sampled public resource 404. Review cascades and shared finance/file ownership before implementation. | 4 |
| F03 | Missing in source; product decision | Manual web proof/review workflows exist; no native store purchase integration is present. Decide approved channel and plan/seat mapping. | 7 |
| F04 | Missing in source; provider settings unknown | No tracked Google/Apple login integration. Inspect production provider settings and preserve setup/invitation/account linking. | 6 |
| F05 | Cannot verify | Actual native source, release artifact, application IDs, signing identity and store-console evidence are not tracked. | 0, 5, 9 |
| F06 | Reproduced FAIL | Native asset builder imports absent dependencies. Obtain the existing local core/platform versions before recording compatible versions; do not install a guessed latest major. | 1, 5 |
| F07 | Reconfirmed live gap | Seven security-header families absent from sampled responses. Determine real hosting path, introduce compatible headers/CSP and recheck live. | 2 |
| F08 | Source gap; external settings unknown | Admin checks exist; no tracked MFA/aal2 integration found. Infrastructure MFA and backend assurance/recovery require evidence. | 3 |
| F09 | Reconfirmed source gap | `site.js` inserts directly into enquiries. Column validation exists; no authoritative challenge/quota path found for this submission. | 2 |
| F10 | Conditional compatibility | Invitation/test-push functions compare request Origin with APP_ORIGIN. Actual local/native origins are unknown. Keep identity checks while testing explicit supported origins. | 5 |
| F11 | Cannot verify native transport | Browser Web Push exists. No tracked FCM/APNs integration; inspect actual devices/native projects. | 8 |
| F12 | Source validation gap, exploit not proved | Stored Web Push endpoints are sent through web-push 3.6.7 without explicit destination/network controls in the reviewed senders. Controlled egress assessment and compatibility tests required. | 2 |
| F13 | Needs improvement | Private buckets/type/size restrictions exist. Content-signature/normalization controls were not found. Add justified server validation and safe downloads. | 4 |
| F14 | Cannot verify protected native sessions | Default Supabase browser clients are tracked; no native credential-storage adapter is visible. Workspace Preferences are metadata, not protected token storage. | 5 |
| F15 | Private-table grant recheck PASS; internal helper repair pending | Owner-supplied diagnostic 08 passes. The anonymous function inventory reveals two exposed internal currency helpers; actual-source isolated reproduction/fix verification passes, and the narrow EXECUTE migration awaits live application/recheck. JWT/API/storage/realtime and complete legitimate workflows remain required. | 0, 3, 9 |
| F16 | Cannot verify | Schema files are not record/object backups. Confirm plan, actual recovery coverage, retention and isolated restore drill. | 1 |
| F17 | Documented; archive unknown | Preferences UserDefaults/CA92.1 is documented, but actual iOS privacy manifest and archive are unavailable. | 5, 9 |
| F18 | Partial foundations; further work | Existing tests/SQL workflow and limited signature checks exist. Native CI, complete supply-chain/artifact scans and repository protection evidence remain. | 1 |
| F19 | Cannot verify operations | Observability configuration/error handling exist; alert routing, budgets, incident owner and recovery runbook are unverified. | 1, 10 |
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

For future local updates, after preserving local changes and when the branch is merged:

```powershell
git fetch origin main
git merge --ff-only origin/main
```

Stop and send the conflict/divergence message if the fast-forward is refused. Do not reset, clean or force-pull to get around it. `npm ci` is not a Stage 0 instruction for the existing Windows project: its native dependencies are currently untracked and must be reconciled first.

## Additional evidence to close Stage 0

| Input | Evidence needed | Why it changes the implementation |
|---|---|---|
| Hosting | Active Cloudflare Pages/Workers project and GitHub Pages role; current domains/redirects and production branch. Configuration/screenshot, not API tokens. | Headers must be added to the layer actually serving the app. |
| Supabase Auth/Edge | Email confirmation and password settings; enabled providers; site/callback URLs; MFA availability; deployed function names and deployment dates. Secret names/presence only, never values. | Avoid changing working invitations and define supported web/native callbacks. |
| Supabase database | Initial/post-table-fix 24-row results received; diagnostic 08 passes. Apply/recheck the currency-helper repair using its 12-row diagnostic; complete legitimate workflows and isolated authorization tests. | Effective catalog/grant state can differ from accumulated source or manual migration history. |
| Recovery/operations | Plan/backup retention, PITR availability, object-byte backup method, any restore drill, alert/budget configuration, incident owner and support mailbox. | Establish recoverability and service costs; no restore of production. |
| Staging | Existing separate Supabase project and deployment/controlled inboxes, or confirmation that these do not yet exist. | Negative tests and future deletion/billing work need synthetic isolated data. |
| Native | Node/config identity received; installed package versions pending npm.cmd. Non-secret Android manifest/Gradle configuration when requested; whether iOS/Mac/Xcode access exists. Later inspect the actual signed artifacts. | Preserve current core major, app ID, platform source and signing identity. |
| Stores/operator | Account type/status, intended countries/audience and actual operator/support identity. | Determines publishing/test obligations and factual policy declarations. |

Do not send service-role keys, access/refresh tokens, MFA recovery codes/seeds, keystores, signing passwords, private keys, full customer records or backups with real financial data.

## Staging design for the next implementation stage

Use a separate Supabase project and preview deployment with separate Auth URLs, Storage, service credentials and dedicated staging cron secrets. Start with cron/automatic notifications disabled. Use synthetic workspaces and controlled inboxes; do not copy production customers, dispatch production messages or buy services to create this baseline. Later configure store sandbox identities/products separately.

Reuse Daniel, Priya, Tendai, Aisha and Brian with the agreed TEST workspaces/branches. Every negative test records caller role, workspace, operation, expected result and observed result. Direct API, object downloads and realtime removal tests are separate from a UI hiding an action. Deletion, subscription and ownership changes use synthetic data only.

## Implementation and recheck sequence

1. Read the owner's live/native results and reconcile the baseline.
2. Investigate any unexpected FAIL. Fix demonstrated issues within approved Stage 0 scope using narrow changes and tests; architectural/destructive work stays subject to the agreed higher-risk boundary.
3. Record confirmed later-stage gaps without claiming closure. Native dependency selection waits for the existing local versions; no guessed framework upgrade. Headers/contact controls belong to Stage 2, Admin MFA/tenant enforcement to Stage 3, and deletion/policies to Stage 4.
4. Re-run the affected diagnostics and allowed/denied behavior after each fix. A catalog PASS is a property check; final behavior still needs direct tests.
5. Close Stage 0 only when the required external/native inputs are accounted for, staging requirements are concrete and the worklist is evidence-backed. An unavailable iOS environment becomes a documented prerequisite, not a silent PASS.

Estimated scope, pending these inputs: Stage 1 is moderate with external recovery work; Stage 2 is moderate and hosting-dependent; Stage 3 is large because authorization/MFA requires end-to-end coverage; Stage 4 is large and ownership/retention-dependent; Stage 5 is moderate to large depending on native setup; Stage 6 is moderate to large because of invitations/linking; Stage 7 is the largest financial/product stage; Stage 8 is moderate to large across devices; Stages 9–10 include external store testing/review. No calendar or service price is credible until the missing inputs and product decisions are resolved.

## Rollback and release boundary

The baseline diagnostics/documentation need no data rollback. The 6 October follow-ups additionally include narrowly scoped table/function grant migrations for owner application; reverting a Git commit does not revert applied database grants. If an unexpected live workflow fails, inspect that operation and restore only justified authenticated/service access rather than regranting anonymous private-table reads. Failed prerequisites roll the entire transaction back. Both the existing Pages allowlist and Cloudflare `.assetsignore` exclude development paths. No Edge deployment or app release/cache bump is required. Native rebuilds, provider settings and store submissions are later work.

Official technical references used for subsequent native choices: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup), [Preferences](https://capacitorjs.com/docs/apis/preferences), [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa), [Supabase backups](https://supabase.com/docs/guides/platform/backups). Recheck the documentation for the **actual existing core major**; current/latest documentation is not permission to upgrade it.
