# 1.5.3 — Operational runbooks

Prepared 9 October 2026, S1E96. These are manual instructions based on the Stage 1 evidence, not proof that alerts, daily reviews, rollback or full production recovery have been exercised. The owner accepted responsibility for recording backup completion/failure and same-day review in S1E63. Incident/support review coverage and an alternate responder remain unconfirmed. No provider action is performed by this document.

## Identify the environment before acting

| Environment | Known target | Permitted use in this audit |
|---|---|---|
| Production | Supabase kttkospkblwvguuwnhjj; Cloudflare Worker mushavobudget serving mushavobudget.com | Read-only operational evidence; production changes need a concrete reviewed action |
| Staging | Supabase dczlddwbtgvfdujgcitb; https://mushavo-budget-staging.pages.dev | Controlled synthetic cases using separate configuration and owner-controlled destinations |
| Local recovery | Owner's private PostgreSQL 17.11 cluster, 127.0.0.1:55439, mushavo_restore_admin | Completed synthetic application drill; keep the committed target stopped and retained |

Match the Dashboard project/domain and connection username; a generic postgres database name does not identify the hosted project. Never use production customer rows as synthetic fixtures. Private passwords, recovery codes, tokens, raw logs, backup bytes and hashes remain owner-controlled.

## Incident triage and evidence

1. Record when the issue began, affected environment/workflow, observed symptom and last known working version. Keep private identifiers and request references in a private incident record; publish only redacted outcomes.
2. Check the affected layer read-only: Cloudflare active deployment/build status; Supabase database/Auth/Storage/Edge status; relevant Cron history; or Zoho mailbox/SMTP status. Record exact safe errors rather than guessing the cause from a failed screen.
3. For Cron, distinguish scheduler SQL completion from queued HTTP response, application outcome and recipient receipt. A Succeeded net.http_post call alone cannot close a dispatch incident. Correlate the controlled request and its response privately before retrying. Avoid blind invitation, payment or notification retries that can duplicate work.
4. Choose the smallest reviewed correction. Record the target, expected effect and verification before changing a deployment, credential, schedule or data. A production restore, destructive cleanup, paid change or communication to other users needs its own concrete owner instruction.
5. Verify the affected workflow with a controlled positive case and the relevant denied/failure case. Record restored service time, remaining limitations and follow-up finding ID. A green dashboard alone is insufficient for a customer-facing workflow.

Suggested private incident fields: opened/completed UTC, environment, safe symptom/error, version, decision, action, operator, verification and residuals. This template is prepared; no incident exercise or response-time performance is claimed.

## Monitoring and support

Cloudflare Alerts Overview showed no configured policies in S1E94. No built-in sample alert was available to test. Backup/application/dispatch failure detection and other provider alert delivery remain unverified. The owner received one controlled support message at support@mushavobudget.com; that establishes incoming routing, not monitoring, continuous staffing or an SLA.

Pending final remediation, manual review of deployment failures, usage, Cron/HTTP outcomes and backup receipts is a proposed interim procedure. Its frequency and actual operation need owner confirmation; it is not recorded as an enabled service. When configuring alerts later, select a monitor for an actual failure signal and an owner-controlled destination, then test sample receipt and controlled detection separately. Do not force a production outage to test delivery. Provider plan/type availability must be checked before choosing a policy. [Cloudflare alert guide](https://developers.cloudflare.com/notifications/get-started/).

The Free-plan usage screenshot has six values within displayed limits, but no visible project/organization identity or cycle dates. Obtain scope and missing metrics during final remediation; do not interpret rounded Storage 0.00 GB as no files or within-quota usage as budget/failure-alert proof. [Supabase usage scope](https://supabase.com/docs/guides/troubleshooting/understanding-the-usage-summary-on-the-dashboard-D7Gnle).

## Deployment failure and Worker rollback

1. Check the current production Worker, active version and actual source/asset mapping. The recorded active version 162af658 and Ready audit-branch builds do not prove that mapping. Review the disconnected Git-account warning and intended repository/account access before another approved deployment.
2. Identify a previously deployed version known to work with the current Supabase schema, Auth callbacks, configuration and assets. Verify compatibility and recovery options before choosing it; a repository commit or Ready build alone is insufficient.
3. Once a specific rollback is reviewed and authorized, Cloudflare's documented Dashboard route is Workers & Pages > the intended Worker > Deployments > the target version's menu > Rollback. This changes the active deployment across its routes/domains. It does not restore Supabase rows or uploaded files; connected-resource compatibility still matters. [Official rollback procedure and limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).
4. Verify the public domain serves the expected version and repeat the affected controlled workflow. Record version, time and result. No rollback or deployment was performed or tested in 1.5.3.

Do not treat audit-branch Worker previews as isolated staging: their settings/bindings are unverified. Keep the separately configured staging frontend/backend distinct. Preserve the owner's original Windows native edits and signing identity; APK updating remains deferred.

## Component export and backup review

Approved objectives are daily and before major changes, 30-day retention, 24-hour RPO and 24-hour RTO, with owner completion/failure recording and same-day review. These are targets, not evidence of scheduled jobs, automated deletion, alert delivery or achieved recovery time.

For each authorized export, use the existing versioned native PostgreSQL/component instructions and a new private run directory. Confirm source identity, TLS verification, compatible tools, scope and protected local permissions. Record native exit status, UTC, component sizes/counts and completeness. Compare hashes privately; verify encrypted payload/header protection, correct-password extraction and restored-file hashes. Keep failed/partial artifacts for diagnosis and do not label them a completed package.

Current verified components are encrypted database and role packages. Storage bytes were downloaded, but encrypted Storage extraction failed. Auth/provider configuration, exact setting values/managed authority, keys and coordinated snapshot coverage remain incomplete. Google Drive is deferred; no offsite copy is verified. Retention cleanup is not authorized by this document. See the [1.2 checkpoint](SECURITY_STAGE_1_2_CHECKPOINT_REPORT.md).

## Recovery and credential loss

The completed [1.4 drill](SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md) restored synthetic public application data with minimal SQL Auth identities, nonprivileged role placeholders and other explicit adapters. Thirteen access checks, selected data/RLS metadata and a local dummy-file hash passed. It did not restore hosted Auth, actual Storage service/files, production ownership or full platform configuration. Eleven seconds is the scoped drill duration, not production RTO.

Keep that committed local target stopped. Do not rerun an empty-target restore helper against it or drop it. A future drill needs a fresh isolated target, source hashes, explicit compatibility/adapters and retained failures. Full production recovery remains blocked until component/configuration completeness, recoverable credentials/keys, destination authority and realistic isolated platform validation are established. No generic production pg_restore command is issued here.

For lost administrative access, use the owner's privately retained independent recovery material and the provider's verified recovery path. Actual independent recovery tests and some backup-factor/account-identity coverage remain open under F08/F19. Do not share codes, remove the sole working factor or claim recovery success from normal sign-in alone.

## Closure evidence still required

Final remediation must demonstrate alert detection/delivery, accountable review, a safe rollback exercise and realistic recovery capability. The owner must be able to follow these instructions; preparation alone does not satisfy that operational check. F16/F19 remain open and the final full re-audit remains required.
