# Windows result received — FR.2.4.E4.10: 338 PASS, exit 0

17 October 2026, FRE74. [Owner receipt](security-fr-2-email-canonical-owner-Windows-pass.json) records 338/338 PASS, Node v22.17.0/PGlite 0.5.8, 130 source hashes and 53 syntax checks. Non-failing module-type warnings occurred in the first eight groups, with none in the canonical group; the TypeScript warning occurred only in the prior-entry/Edge group. This supersedes the Windows-pending action below. The next [atomic installer source checkpoint](SECURITY_FR_2_4_CANONICAL_PASS_AND_ATOMIC_INSTALLER.md) registers a private installer without activating the hosted gate. Original FRE73 evidence follows.

---

# FR.2.4.E4.10 — account controls passed on Windows; canonical baseline reconciled

17 October 2026, FRE73. The [owner account-security receipt](security-fr-2-email-security-controls-owner-Windows-pass.json) records 320/320 PASS, zero FAIL, exit 0, Node v22.17.0/PGlite 0.5.8, 126 matching source hashes and 50 syntax checks. Exact warning flags are retained: module-type warnings in all eight groups and the TypeScript warning in the prior-entry/Edge group. Hosted acceptance remains pending.

## Prerequisite found before email migration integration

A fresh modeled database created by the previous supabase/schema.sql was not equivalent to the database created by all 54 ordered migration files. The [bounded source drift record](security-fr-2-email-canonical-baseline-drift.json) pins the old/new schema hashes and source parent. This is local source evidence, not a fresh claim about any hosted database.

| Compared baseline | Previous schema | Ordered migrations |
| --- | ---: | ---: |
| Public functions | 275 | 278 |
| Public tables/views | 80 | 82 |
| Public/storage policies | 165 | 166 |

Twelve routine signatures differed: three were missing, eight had different body hashes, and provision_budget_user had different effective API execution grants. The schema also lacked enquiry_submission_limits and public_enquiry_events and two policies, while retaining the obsolete Public can submit enquiries policy. In particular the schema allowed direct API provisioning and contact-column insertion that the migration path already denies. Notification context, payer guard, plan definition and Family subscription bodies also diverged. A successful migration-path email test therefore could not establish successful canonical bootstrap integration.

The correction changes the actual supabase/schema.sql source. It is generated deterministically from every existing ordered migration body, with named boundaries and CRLF-to-LF normalization. No migration file is edited or added. This preserves the migration history as the reviewed source of truth and eliminates a separately maintained incomplete bootstrap. The new scripts/build-canonical-schema.mjs exports the generator and provides only a read-only --check CLI. It rejects missing/duplicate/reordered/path-shaped inputs and invalid bodies. It cannot overwrite schema.sql through CLI flags. Future migration changes must regenerate and review the canonical source, then run its parity checks.

This canonical file contains historical DDL, seed transitions and transaction boundaries. It is a bootstrap for a controlled database creation path, not a repair script to paste into an existing staging or production database. No execution against either hosted database is requested. The new email backend/session/guard/Admin candidates remain separate; this correction does not add them to automatic schema or migration execution. A single atomic email installer and coordinated activation still require a later source checkpoint. The preliminary atomic-installer review was paused when this baseline difference was found.

## Offline evidence

[Verifier](../../scripts/verify-fr-2-email-canonical.mjs), [130-file manifest](security-fr-2-email-canonical-source-manifest.json), [local receipt](security-fr-2-email-canonical-local-checks.json), [contract](security-fr-2-email-canonical-candidate-contract.json).

All 338 selected checks pass locally, exit 0, on Node v24.19.0/PGlite 0.5.8. There are 130 matching source hashes and 53 syntax checks. The previous 320 selected account-controls/signup/callback/entry/Edge/header/gateway/SQL cases remain included unchanged. Eighteen new cases cover generator/CLI behavior and two separate real in-memory database creation paths. No test is skipped or cancelled.

The database checks compare all 278 public routine bodies, signatures, selected execution metadata and effective API execution grants; all public/storage relation RLS settings and 166 policies; column/default/generated expressions, constraints, indexes, user trigger bindings, publications and effective table/column grants. The regenerated schema and incremental path match. Direct provisioning and direct contact insertion are denied for both anon and authenticated roles. A valid contact can be submitted only through the modeled service RPC; its synthetic effect is rolled back.

The four existing email SQL candidates then compile independently on both creation paths. Their guarded routine and policy catalogs match, with 148 guarded RPCs and 82 added restrictive policies. Password-only ordinary/Admin sessions cannot read protected profiles. The actual service challenge/verify SQL establishes exact-session proof; ordinary ownership is retained, an ordinary caller stays unauthorized for Admin, and an existing synthetic Admin role is retained after verification. Repeating backend installation rejects existing state without replacing the test proofs/roles. Auth rows and claims are modeled, not real JWT/signature/Auth acceptance; the local Admin fixture is not a hosted promotion. Local DB fixtures disappear when the in-memory instances close.

These are selected regressions and catalog parity checks, not complete repository/CI coverage, real concurrency, Deno/provider validation or actual browser cookie/BroadcastChannel acceptance. Default Node fetch/HTTP is disabled during tests; explicit transports remain synthetic. This guard is not an OS network sandbox. npm may contact the public registry to install the single locked PGlite dependency with lifecycle scripts disabled; installed package bytes are not independently hashed. The older pinned verifier/manifests remain historical artifacts and were not rewritten to claim new-source acceptance: reproduce them at their own original commits. The new verifier pins the changed schema and current selected tests.

## Next owner action and carry-forward

Run only the complete pinned temporary-folder PowerShell block in chat. It exports the audit commit without switching or editing the existing checkout, installs the isolated locked dependency and performs the new offline verification. Expected result: OFFLINE_CANONICAL_SCHEMA_MIGRATION_PARITY_EMAIL_CANDIDATES_AND_SELECTED_REGRESSIONS_SCOPED_PASS, 338 PASS, zero FAIL, exit 0. Return its JSON and exit code. No SQL, credentials, DPAPI file access, email, upload, Worker deployment or APK action is requested.

The next implementation work is atomic email backend/guard integration into versioned migration/canonical source, then coordinated new Pages/gateway activation and full regression. Genuine provider delivery, browser/cookie/cross-device/concurrency/recovery acceptance and prior Business/FX/operator/MFA carry-forward remain pending. Email proof does not establish Supabase AAL2. All 20 original findings remain open, release gate OPEN_PENDING_REQUIRED_EVIDENCE, final re-audit PLANNED_NOT_PERFORMED. Historical stages, prior events and coverage are retained; production excluded and APK/native deferred.
