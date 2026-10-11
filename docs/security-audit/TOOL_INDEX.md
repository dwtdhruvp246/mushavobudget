# Audit SQL, scripts, tests and implementation index

**Latest — 4.3.2 internal privacy review candidate/local checks complete / next 4.3.3, 11 October 2026 (S4E09):** Owner reports **Dhruv Parekh, Zimbabwe, individual/not yet registered business**, assigns **support@mushavobudget.com** for privacy requests, intends **no age restriction**, and leaves country exclusions **unconfirmed**. This is owner evidence, not independent identity, mailbox or child-law compliance proof. [Candidate and limits](SECURITY_STAGE_4_3_PRIVACY_CANDIDATE.md), [internal review draft](SECURITY_STAGE_4_3_PRIVACY_NOTICE_REVIEW_DRAFT.md), [structured decisions](security-stage-4-privacy-decisions.json), [local receipt](security-stage-4-privacy-local-checks.json). **43 local review-contract/draft checks PASS, three syntax checks PASS, exit 0; 36 granular publication blockers remain under six existing PR actions.** These checks are not app consent/retention/deletion/child controls or the 25 planned privacy cases; hosted cases remain zero. No public policy, legal terms, store declaration, email/job, live account/file/settings/SQL/provider/deployment/production/native action. No required owner SQL/terminal action; any optional isolated local repeat is provided fully in chat. F01/F20 and existing findings remain OPEN; original 123 rows/20 definitions and prior stage/4.1/4.2 evidence are preserved. Two of three 4.3 milestones are complete. Next **4.3.3**, one controlled owner/hosted outcome or BLOCKED; full Stage 4 report **4.4**. Earlier summaries are historical.

**Latest — 4.3.1 factual privacy/data-flow source review complete / next 4.3.2, 11 October 2026 (S4E08):** **96 exact source blob matches, zero mismatches; 14 data categories and ten provider/service components** are recorded. Ten components are not ten distinct vendors/contracts. First-party analytics is account-linked; contact/Turnstile/HMAC quotas, Business identity/contact/tax data, uploaded content, push/device fields and external copies require factual coverage. Current hosted analytics/settings and final native binaries were not inspected. Operator identity, monitored privacy contact, minimum age/minors treatment, territory exclusions, category retention and deployed provider contracts/regions/log handling remain unconfirmed. [Source review, 25 planned PR01–PR05 grouped cases and six OPEN actions](SECURITY_STAGE_4_3_PRIVACY_SOURCE_REVIEW.md), [source inventory](security-stage-4-privacy-source-inventory.json). Zero local behavioral or hosted checks ran; no public policy, email/job, account/file/settings/SQL/provider/deployment/production/native action. F01/F20 and all existing findings remain OPEN. One of three 4.3 milestones is complete; two of four main Stage 4 steps remain closed with carry-forward. No owner SQL/terminal action is needed. Next **4.3.2**, reviewable candidate/local checks with unresolved facts explicit; full Stage 4 report **4.4**. Earlier summaries are historical.

This index links the operational audit files used from Stage 0 onward. Executable files stay in their normal scripts, tests and Supabase directories; commands and migration order are preserved. Listing a tool does not imply a hosted run or a PASS. Use the reports/evidence for actual results.

## Documentation and source history

All audit reports, plans and redacted evidence are in this folder. [Start here](README.md). Source changes and their original versions remain in Git history; moving documentation does not erase those versions.

## Diagnostic SQL

- [business_invitation_notifications_diagnostic.sql](../../supabase/diagnostics/business_invitation_notifications_diagnostic.sql)
- [security_stage_0_currency_helpers_diagnostic.sql](../../supabase/diagnostics/security_stage_0_currency_helpers_diagnostic.sql)
- [security_stage_0_diagnostic.sql](../../supabase/diagnostics/security_stage_0_diagnostic.sql)
- [security_stage_1_backup_inventory.sql](../../supabase/diagnostics/security_stage_1_backup_inventory.sql)
- [security_stage_1_local_recovery_probe.sql](../../supabase/diagnostics/security_stage_1_local_recovery_probe.sql)
- [security_stage_1_recovery_dependencies.sql](../../supabase/diagnostics/security_stage_1_recovery_dependencies.sql)
- [security_stage_1_setting_scope.sql](../../supabase/diagnostics/security_stage_1_setting_scope.sql)
- [security_stage_1_staging_preflight.sql](../../supabase/diagnostics/security_stage_1_staging_preflight.sql)
- [security_stage_1_staging_routines.sql](../../supabase/diagnostics/security_stage_1_staging_routines.sql)
- [security_stage_1_synthetic_export.sql](../../supabase/diagnostics/security_stage_1_synthetic_export.sql)
- [security_stage_2_contact_acceptance.sql](../../supabase/diagnostics/security_stage_2_contact_acceptance.sql)
- [security_stage_2_contact_metadata.sql](../../supabase/diagnostics/security_stage_2_contact_metadata.sql)
- [security_stage_2_push_destinations.sql](../../supabase/diagnostics/security_stage_2_push_destinations.sql)

- [security_stage_3_permission_baseline.sql](../../supabase/diagnostics/security_stage_3_permission_baseline.sql) — eight-row read-only STAGING catalog baseline.

## Audit and staging/recovery scripts

- [build-capacitor.mjs](../../scripts/build-capacitor.mjs)
- [build-staging-frontend.cjs](../../scripts/build-staging-frontend.cjs)
- [build-staging-schema.cjs](../../scripts/build-staging-schema.cjs)
- [check-staging-contact-api.cjs](../../scripts/check-staging-contact-api.cjs)
- [diagnose-staging-contact-files.cjs](../../scripts/diagnose-staging-contact-files.cjs)
- [export-synthetic-recovery-source.ps1](../../scripts/export-synthetic-recovery-source.ps1)
- [prepare-local-recovery-target.ps1](../../scripts/prepare-local-recovery-target.ps1)
- [prepare-stage-2-contact.cjs](../../scripts/prepare-stage-2-contact.cjs)
- [prepare-stage-2-contact.ps1](../../scripts/prepare-stage-2-contact.ps1)
- [prepare-stage-2-headers.cjs](../../scripts/prepare-stage-2-headers.cjs)
- [restore-synthetic-recovery.ps1](../../scripts/restore-synthetic-recovery.ps1)
- [run-staging-contact-acceptance.ps1](../../scripts/run-staging-contact-acceptance.ps1)
- [security-stage-0-check.mjs](../../scripts/security-stage-0-check.mjs)
- [security-stage-1-connection-check.ps1](../../scripts/security-stage-1-connection-check.ps1)
- [security-stage-1-database-encryption.ps1](../../scripts/security-stage-1-database-encryption.ps1)
- [security-stage-1-database-export.ps1](../../scripts/security-stage-1-database-export.ps1)
- [security-stage-1-database-properties-toc-check.ps1](../../scripts/security-stage-1-database-properties-toc-check.ps1)
- [security-stage-1-database-properties-toc.cjs](../../scripts/security-stage-1-database-properties-toc.cjs)
- [security-stage-1-download-format-check.ps1](../../scripts/security-stage-1-download-format-check.ps1)
- [security-stage-1-drive-download-check.ps1](../../scripts/security-stage-1-drive-download-check.ps1)
- [security-stage-1-encryption-synthetic-check.ps1](../../scripts/security-stage-1-encryption-synthetic-check.ps1)
- [security-stage-1-encryption-tool-check.ps1](../../scripts/security-stage-1-encryption-tool-check.ps1)
- [security-stage-1-local-backup-folder.ps1](../../scripts/security-stage-1-local-backup-folder.ps1)
- [security-stage-1-local-coverage-check.ps1](../../scripts/security-stage-1-local-coverage-check.ps1)
- [security-stage-1-original-archive-selection.ps1](../../scripts/security-stage-1-original-archive-selection.ps1)
- [security-stage-1-role-coverage-check.ps1](../../scripts/security-stage-1-role-coverage-check.ps1)
- [security-stage-1-role-coverage.cjs](../../scripts/security-stage-1-role-coverage.cjs)
- [security-stage-1-role-encryption.ps1](../../scripts/security-stage-1-role-encryption.ps1)
- [security-stage-1-role-export.ps1](../../scripts/security-stage-1-role-export.ps1)
- [security-stage-1-setting-coverage-check.ps1](../../scripts/security-stage-1-setting-coverage-check.ps1)
- [security-stage-1-setting-coverage.cjs](../../scripts/security-stage-1-setting-coverage.cjs)
- [security-stage-1-storage-backup-check.ps1](../../scripts/security-stage-1-storage-backup-check.ps1)
- [security-stage-1-storage-backup.cjs](../../scripts/security-stage-1-storage-backup.cjs)
- [security-stage-1-tool-inventory.ps1](../../scripts/security-stage-1-tool-inventory.ps1)
- [verify-local-recovery-probe.cjs](../../scripts/verify-local-recovery-probe.cjs)
- [verify-native-build-dependencies.cjs](../../scripts/verify-native-build-dependencies.cjs)
- [verify-security-stage-0-currency-sql.cjs](../../scripts/verify-security-stage-0-currency-sql.cjs)
- [verify-security-stage-0-private-reads-sql.cjs](../../scripts/verify-security-stage-0-private-reads-sql.cjs)
- [verify-security-stage-0-sql.cjs](../../scripts/verify-security-stage-0-sql.cjs)
- [verify-security-stage-1-backup-inventory.cjs](../../scripts/verify-security-stage-1-backup-inventory.cjs)
- [verify-security-stage-1-recovery-dependencies.cjs](../../scripts/verify-security-stage-1-recovery-dependencies.cjs)
- [verify-security-stage-1-setting-scope.cjs](../../scripts/verify-security-stage-1-setting-scope.cjs)
- [verify-security-stage-1-staging-preflight.cjs](../../scripts/verify-security-stage-1-staging-preflight.cjs)
- [verify-stage-2-push-transport.mjs](../../scripts/verify-stage-2-push-transport.mjs)
- [verify-staging-personal-api-fixtures.cjs](../../scripts/verify-staging-personal-api-fixtures.cjs)
- [verify-staging-personal-api.cjs](../../scripts/verify-staging-personal-api.cjs)
- [verify-synthetic-recovery-export.cjs](../../scripts/verify-synthetic-recovery-export.cjs)

## Audit and native regression tests

- [security-stage-0.test.mjs](../../tests/security-stage-0.test.mjs)
- [security-stage-1-database-properties-toc.test.cjs](../../tests/security-stage-1-database-properties-toc.test.cjs)
- [security-stage-1-role-coverage.test.cjs](../../tests/security-stage-1-role-coverage.test.cjs)
- [security-stage-1-setting-coverage.test.cjs](../../tests/security-stage-1-setting-coverage.test.cjs)
- [security-stage-1-storage-backup.test.mjs](../../tests/security-stage-1-storage-backup.test.mjs)
- [security-stage-2-contact-api-check.test.mjs](../../tests/security-stage-2-contact-api-check.test.mjs)
- [security-stage-2-contact-byte-preparation.test.mjs](../../tests/security-stage-2-contact-byte-preparation.test.mjs)
- [security-stage-2-contact-file-diagnostic.test.mjs](../../tests/security-stage-2-contact-file-diagnostic.test.mjs)
- [security-stage-2-contact.test.mjs](../../tests/security-stage-2-contact.test.mjs)
- [security-stage-2-headers.test.mjs](../../tests/security-stage-2-headers.test.mjs)
- [security-stage-2-push-destination.test.mjs](../../tests/security-stage-2-push-destination.test.mjs)

## Audit repair migrations

- [20261006043000_security_stage_0_private_reads.sql](../../supabase/migrations/20261006043000_security_stage_0_private_reads.sql)
- [20261006050000_security_stage_0_currency_helpers.sql](../../supabase/migrations/20261006050000_security_stage_0_currency_helpers.sql)
- [20261006180000_business_invitation_notifications.sql](../../supabase/migrations/20261006180000_business_invitation_notifications.sql)
- [20261009190000_public_enquiry_submission_gate.sql](../../supabase/migrations/20261009190000_public_enquiry_submission_gate.sql)

## Runtime candidates reviewed or changed during the audit

- [Contact Edge function](../../supabase/functions/submit-enquiry/index.ts) and [handler](../../supabase/functions/submit-enquiry/handler.mjs).
- [Shared push destination guard](../../supabase/functions/_shared/push-destination.mjs).
- [Test push sender](../../supabase/functions/send-test-push/index.ts), [reminder dispatcher](../../supabase/functions/dispatch-push-reminders/index.ts), and [Admin dispatcher](../../supabase/functions/dispatch-admin-notifications/index.ts).
- [Header candidate](../../_headers) and [Contact frontend](../../site.js).
- [Business invitation activation guide](BUSINESS_INVITATION_NOTIFICATION_SETUP.md) and [Auth templates](../../supabase/templates/).
- [Full application test directory](../../tests/), [migration directory](../../supabase/migrations/) and [deployment verification workflow](../../.github/workflows/pages.yml) contain supporting existing product regressions and integration history.

Private exports, original backups, certificates, keys and passwords are owner-held artifacts and are not copied into the public audit folder. The index contains only tracked repository files.

## Stage 3 diagnostic validation

- [verify-stage-3-permission-baseline.mjs](../../scripts/verify-stage-3-permission-baseline.mjs) — disposable catalog fixtures using an externally supplied PGlite module; no hosted connection or application authorization proof.

## Stage 3 Personal/Family controlled acceptance

- [3.2 instructions and bounded matrix](SECURITY_STAGE_3_2_PERSONAL_FAMILY.md).
- [check-stage-3-personal-api.cjs](../../scripts/check-stage-3-personal-api.cjs) — staging-only ordinary accounts, inactive synthetic Personal writes and owner effect verification.
- [run-stage-3-personal-acceptance.ps1](../../scripts/run-stage-3-personal-acceptance.ps1) — complete masked-password owner runner from a pinned commit.
- [stage-3-personal-api.test.cjs](../../tests/stage-3-personal-api.test.cjs) — 28 checker tests including hidden mutations/insert effects and non-authorization errors.
- [verify-stage-3-personal-workspace-bindings.mjs](../../scripts/verify-stage-3-personal-workspace-bindings.mjs) — reduced-schema current-source binding probe; gap reproduced, hosted behavior unverified.

- [security_stage_3_family_fixture.sql](../../supabase/diagnostics/security_stage_3_family_fixture.sql) — once-only controlled synthetic STAGING Family fixture transaction with one four-row SELECT receipt.
- [check-stage-3-family-api.cjs](../../scripts/check-stage-3-family-api.cjs) — head/recipient/member/removal requests with effect readbacks and local-scope test logout.
- [run-stage-3-family-acceptance.ps1](../../scripts/run-stage-3-family-acceptance.ps1) — pinned, masked staging app-password runner.
- [verify-stage-3-family-source.mjs](../../scripts/verify-stage-3-family-source.mjs) — migration-source Family lifecycle and checker fault cases using explicit local provider/default-grant/HTTP adapters.
- [stage-3-family-api.test.cjs](../../tests/stage-3-family-api.test.cjs) — eight target/error/redaction and runner-expression tests; native PowerShell and hosted acceptance pending.

## Stage 3 selected currency acceptance

- [3.2.3 instructions and frozen requests](SECURITY_STAGE_3_2_CURRENCY_SETTINGS.md).
- [check-stage-3-currency-api.cjs](../../scripts/check-stage-3-currency-api.cjs) — existing synthetic fixtures, normalized/restored settings, ordinary/foreign/anonymous helper and conversion boundaries.
- [run-stage-3-currency-acceptance.ps1](../../scripts/run-stage-3-currency-acceptance.ps1) — masked app-password runner from a pinned commit.
- [verify-stage-3-currency-source.mjs](../../scripts/verify-stage-3-currency-source.mjs) — nine local source/checker cases with explicit provider/default-grant/HTTP adapters.
- [stage-3-currency-api.test.cjs](../../tests/stage-3-currency-api.test.cjs) — eight target/error/redaction and runner-expression tests; native owner acceptance pending.

## Stage 3.2 completed checkpoint

- [3.2 checkpoint report and remediation actions](SECURITY_STAGE_3_2_CHECKPOINT_REPORT.md): Personal 26 PASS/one REVIEW, Family 33 PASS, currency 23 PASS; all three milestones recorded, remaining cases carried to final remediation/re-audit.

## Stage 3.3 Business matrix

- [Existing Business roles/scopes and bounded B01–B08 groups](SECURITY_STAGE_3_3_BUSINESS_ROLES.md): source review recorded; fixture/checker preparation and hosted acceptance pending.


## Stage 4 lifecycle review candidate — 4.1.2

Offline/source/local scope only; no deployment or deletion adapter. 46 local PASS, three syntax checks, 0 hosted checks. [Candidate report and reproduction](SECURITY_STAGE_4_1_LIFECYCLE_CANDIDATE.md).

- [Review/preflight and pure state model](../../scripts/lib/stage-4-lifecycle-review.mjs)
- [46 lifecycle tests](../../tests/stage-4-lifecycle-review.test.mjs)
- [Finite local verifier](../../scripts/verify-stage-4-lifecycle.mjs)
- [Local receipt with file hashes](security-stage-4-lifecycle-local-checks.json)
- [Unapproved eight-category decision template](security-stage-4-retention-decisions.json)

## Stage 4.2.2 client candidate

- [Candidate and server completion contract](SECURITY_STAGE_4_2_UPLOAD_DOWNLOAD_CANDIDATE.md)
- [Offline primary verifier](../../scripts/verify-stage-4-files.mjs) — 63 actual-function VM checks and four syntax checks; no hosted actions
- [Client tests](../../tests/stage-4-upload-client.test.mjs)
- [Primary receipt](security-stage-4-upload-local-checks.json)
- [Related regression receipt](security-stage-4-upload-regression.json) — 36 PASS across seven existing files

## Stage 4.2.3 checkpoint

- [Detailed checkpoint and action plan](SECURITY_STAGE_4_2_CHECKPOINT_REPORT.md)
- [Readiness receipt](security-stage-4-upload-readiness.json) — 67 source blob matches/four candidate hash matches; zero fresh behavior or hosted checks; 30 grouped cases BLOCKED
- [Owner Windows repeat](security-stage-4-upload-owner-local-checks.json) — 63 PASS/four syntax checks; exact LF/CRLF hash reconciliation

No owner SQL/terminal action is requested by this checkpoint; next 4.3.1, full Stage 4 report due 4.4.

## Stage 4.3.1 privacy source review

- [Factual source review and 25-case PR contract](SECURITY_STAGE_4_3_PRIVACY_SOURCE_REVIEW.md) — source facts, limits, unresolved owner decisions and six OPEN privacy actions.
- [Source inventory](security-stage-4-privacy-source-inventory.json) — 96 verified Git blobs, 14 categories and ten service components; zero behavior/hosted tests.

No SQL/terminal action is required; next 4.3.2, full Stage 4 report 4.4.

## Stage 4.3.2 internal privacy review candidate

- [Candidate report](SECURITY_STAGE_4_3_PRIVACY_CANDIDATE.md), [review draft](SECURITY_STAGE_4_3_PRIVACY_NOTICE_REVIEW_DRAFT.md), [owner/decision record](security-stage-4-privacy-decisions.json), [assessment](security-stage-4-privacy-review-assessment.json), [local receipt](security-stage-4-privacy-local-checks.json).
- [Contract/renderer](../../scripts/lib/stage-4-privacy-review.mjs), [tests](../../tests/stage-4-privacy-review.test.mjs), [offline verifier](../../scripts/verify-stage-4-privacy.mjs): Node built-ins only; 43 review checks/three syntax checks; no app privacy-control or hosted acceptance implementation.

No required SQL/terminal action. Optional pinned Windows repeat is supplied fully in chat; no install/checkout/execution-policy change. Next 4.3.3; full Stage 4 report 4.4.
