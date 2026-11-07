# 1.3.3–1.3.4 — Schema completion and frontend preparation

Owner reported APPLICATION_SCHEMA_INITIALIZED / 51 migrations applied and native psql successful completion on 8 October 2026. Earlier password failure occurred at connection precheck, before schema setup started; owner confirmed the wrong password and subsequent success. Intended session-pooler user postgres.dczlddwbtgvfdujgcitb. Treat hosted completion as owner evidence; no independent root connection or production data import occurred.

1.3.2 metadata identified postgres-owned SECURITY DEFINER rls_auto_enable(), linked to enabled ensure_rls for CREATE TABLE / CREATE TABLE AS / SELECT INTO. Six additional Supabase-admin-owned event triggers concern extension access and API schema handling. No trigger was removed. Function bodies, runtime behavior, source/destination parity and full isolation remain unverified.

Disposable replay completed for 51 ordered source migrations, separately and as the combined transaction. The embedded fixture substituted minimal Auth/Storage schemas and omitted pgcrypto extension creation (built-in gen_random_uuid available). Hosted extensions, exact auto-RLS behavior, permissions, real Auth, Storage/API and role behavior are not proved by that fixture.

Owner SQL Editor rejected the approximately 1 MB combined script before execution because it exceeded its query-size limit. The approved setup moved to installed PostgreSQL 17 psql with verified TLS, no startup file, password prompting, ON_ERROR_STOP and an empty-target guard. Subsequent owner result establishes successful native script completion; APPLICATION_SCHEMA_INITIALIZED is not an all-feature acceptance result.

## Current finite work items

| Item | Status |
|---|---|
| 1.3.1 Separate target | Owner reported created |
| 1.3.2 Initial metadata review | Complete with behavior/identity limitations recorded |
| 1.3.3 Application initialization | Owner reported 51 migrations and psql completion |
| 1.3.4 Frontend/Auth/Storage/Edge and dispatch separation | In progress |
| 1.3.5 Synthetic operations/isolation checkpoint | Pending |

The staging frontend builder reads reviewed commit e5b1936847e22a04a3f5fd63785ceed3b4d0f9da from Git rather than the dirty Windows checkout. It exports public web assets only to a new folder, replaces production project references, sets the staging URL and owner-supplied sb_publishable_ key, removes the production VAPID public key, and fails on remaining production reference bytes. Key type and inequality do not prove the supplied key belongs to staging: owner must obtain it from the staging project. It copies no Edge functions, provider secrets, production accounts or Storage object files. Existing working-tree files are untouched.

Frontend hosting is not yet deployed; test hosting origin and Auth redirects remain pending. No custom SMTP/Zoho, production VAPID private keys, currency provider credentials, scheduled dispatch or production OAuth credentials are requested at this checkpoint. Dispatch functions must remain undeployed until separately reviewed test destinations and credentials are established. Use synthetic accounts only in later tests. Storage buckets/policies created by migrations still require API/role tests.

Stage 1.2 remains closed with carry-forward, Google Drive deferred, full recovery and full isolation unproved. Stage 1.4 covers restore tests; Stage 1.6 the full Stage 1 report.

## Owner frontend preparation result — 8 October 2026

Owner supplied STAGING_FRONTEND_PREPARED for reviewed source e5b1936847e22a04a3f5fd63785ceed3b4d0f9da, staging dczlddwbtgvfdujgcitb, 34 public files in a new Desktop folder. Production-reference scan and production push-key removal passed. Supplied publishable-key project ownership, hosting, Auth redirects and full isolation remained false/unverified; no Edge functions/secrets copied. This is a local preparation result, not hosted network isolation proof.

Next owner action: create a separate Cloudflare Pages Direct Upload project (suggested name mushavo-budget-staging), upload only the prepared public output folder, retain its pages.dev hostname, and report the actual resulting URL. No production project deployment, custom domain/DNS change, Git-connected build using production config or credentials is needed. A staging project's primary deployment may be labelled Production by Cloudflare; that label is scoped to the separate staging Pages project. Account/provider access, discoverability restrictions and actual deployment content remain separately unverified.

Once the actual origin is known, configure staging Auth Site URL and exact redirect destinations; keep dispatch functions/secrets undeployed pending reviewed synthetic destinations. Do not create test accounts until those boundaries are prepared. Google Drive remains deferred.

## Owner hosting URL and Auth handoff — 8 October 2026

Owner supplied https://mushavo-budget-staging.pages.dev/ as the staging deployment address. Public retrieval of root/config.js through the available web service failed (not accessible through that tool); do not label the deployed content independently verified or infer the site is down. Owner-side HTTPS config metadata checking remains pending.

Next staging-only Auth handoff: Site URL https://mushavo-budget-staging.pages.dev; allow explicit root, app.html, signup.html and signup.html?mode=self-signup destinations. The source signup and reset-password paths explicitly use signup.html?mode=self-signup. Dynamic admin/business invitation destinations require separately reviewed scope when those Edge functions are enabled; this handoff does not claim they are covered. Remove inherited/default localhost or production entries only from staging if present; do not edit production URL configuration. Keep Confirm email on, custom SMTP off and Google disabled at this stage. No account signup/email dispatch test is authorized by merely setting these URLs; controlled synthetic users and dispatch tests follow after reviewed isolation boundaries. Owner must confirm no Edge functions or production secrets have been separately added to staging.

## Owner configuration confirmation and transition to 1.3.5

Owner reported deployed config flags all true (staging URL, publishable key format, empty push key, absent production reference). Then replied "all five confirmed" to the staging Auth URL settings, Confirm email on, custom SMTP off, Google disabled, and no Edge functions/production secrets added. 1.3.4 is complete at this prepared/owner-confirmed disabled-integration scope; full runtime isolation remains a test requirement. Continue with the five scoped synthetic check groups in SECURITY_STAGE_1_3_SYNTHETIC_CHECKS.md. No email or push workflow acceptance is claimed.
