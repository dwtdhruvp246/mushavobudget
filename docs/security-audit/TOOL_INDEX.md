# Audit SQL, scripts, tests and implementation index

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
