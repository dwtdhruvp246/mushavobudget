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
