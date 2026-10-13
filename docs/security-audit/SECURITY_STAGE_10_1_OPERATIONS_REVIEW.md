# 10.1 — Release and operations evidence review

**13 October 2026, S10E01 — COMPLETE AT SOURCE / PRIOR EVIDENCE / PRIMARY DOCUMENTATION SCOPE.**
Source pin: `b51fe2e49d32ecf5f3ee5a1f9118d1bc88888719`; tree `c927694df9d7e08c41276cbe5ed9d4e185466c1f`.
[Finite Stage 10 plan](SECURITY_STAGE_10_RELEASE_OPERATIONS_PLAN.md) · [Selected source identities](security-stage-10-operations-source-inventory.json) · [OPEN actions](security-stage-10-remediation-actions.json).

## Outcome

All **64 selected input identities match** their current Git blobs and byte hashes: 43 source/config/script/SQL/historical deployment inputs and 21 prior audit records. The complete recursive tree contains 619 tracked files and no tracked AGENTS.md, Android or iOS project path. These selected-tree absences do not establish absence from the owner's Windows workspace or external service.

Targeted source sections and dated prior reports were reviewed; hashing a manifest, config or lockfile is not a full dependency or secret scan. No new behavior/syntax test, application public GET, SQL/Auth/API/provider/device/store request, installed job inventory or alert/support delivery test ran. No source/settings/deployment/native change occurred. This milestone establishes a reviewable inventory and finite plan, not current operational acceptance.

## Current source observations and remaining evidence

### OP-S01 — Release source and serving-channel mapping

**REVIEW_CURRENT_INSTALLED_MAPPING_UNVERIFIED.** Tracked workflow triggers main/PR/manual runs and deploys a public allowlist to GitHub Pages; wrangler.jsonc points assets at the repository root. Earlier owner evidence identifies a production Cloudflare Worker/domain; staging uses a pages.dev URL. The active Cloudflare build/version/artifact and complete staging isolation are not mapped to the candidate.

Required next evidence: Record exact project/channel/branch/source/artifact/Edge/schema/grants/config/headers and final asset types; use only accepted isolated staging for controlled checks.

Source: `.github/workflows/pages.yml`, `wrangler.jsonc`, `scripts/build-public-site.mjs`, `scripts/build-staging-frontend.cjs`, `scripts/build-stage-3-auth-staging.cjs`. Prior records: S1E91, S1E92, S9E05, S9E06. Coordinating action: OP-R01; findings F18, F19, F05.

### OP-S02 — Historical deployment instructions need explicit version scope

**SOURCE_CONFLICT_REQUIRES_RUNBOOK_RECONCILIATION.** Historical public-site instructions describe direct enquiry inserts and deleting submit-enquiry; the current selected source instead includes the hardened submit-enquiry handler. Older deployment notes retain older web/version/worker markers and production commands. They are historical inputs, not executable current instructions.

Required next evidence: Prepare source-bound runbooks using current accepted code and installed state. Do not run old delete/deploy/rollback snippets as part of inventory.

Source: `PUBLIC_WEBSITE_DEPLOYMENT.md`, `PWA_STAGE_13_DEPLOYMENT.md`, `ADMIN_OPERATIONS_4_6_DEPLOYMENT.md`, `supabase/functions/submit-enquiry/handler.mjs`, `supabase/config.toml`. Prior records: S2E38, S9E06. Coordinating action: OP-R01, OP-R05; findings F09, F18, F19.

### OP-S03 — Schedules versus end-to-end execution

**SOURCE_SCHEDULES_PRESENT_INSTALLED_EXECUTION_UNVERIFIED.** Source proposes reminders every 15 minutes, admin dispatch every five minutes and currency sync at 00:15/12:15. Protected cron headers and dedicated server-side environment/Vault names are present. Currency sync includes a provider timeout, run status, duplicate-running handling and partial historical backfill reporting. No current installed job or successful provider run was checked in 10.1.

Required next evidence: Bind actual cron job to HTTP response, Edge version, business result and controlled delivery/history. Scheduler success alone does not prove final outcome; do not enable or invoke jobs here.

Source: `supabase/cron-push-reminders.sql`, `supabase/cron-admin-notifications.sql`, `supabase/cron-currency-rates.sql`, `supabase/functions/sync-exchange-rates/index.ts`, `supabase/functions/dispatch-push-reminders/index.ts`, `supabase/functions/dispatch-admin-notifications/index.ts`. Prior records: S1E92, S3E25, S8E05. Coordinating action: OP-R02; findings F19, F15, F12.

### OP-S04 — Queue retry, claims and outbound boundaries

**SOURCE_CONTROLS_PRESENT_DATABASE_AND_DELIVERY_RECHECK_PENDING.** Selected migrations define unique keys, pending/processing/sent/retry/failed/cancelled states, up to three attempts, 15-minute abandoned-claim release, FOR UPDATE SKIP LOCKED and five-/30-minute retry delays. Selected push functions use recipient/destination helpers and permanent-device-failure handling. Earlier synthetic passes do not verify current PostgreSQL concurrency, retries, final recipient display or actual delivery.

Required next evidence: Use recoverable controlled synthetic queues/recipients and correlate due/claim/attempt/result with real permission/egress boundaries. Preserve terminal states, stale-claim history and failed results.

Source: `supabase/migrations/20260908170000_notification_outbox.sql`, `supabase/migrations/20260916190000_admin_event_notifications.sql`, `supabase/functions/_shared/push-destination.mjs`, `supabase/functions/_shared/notification-recipient.mjs`, `supabase/functions/send-test-push/index.ts`. Prior records: S2E38, S8E05, S9E06. Coordinating action: OP-R02; findings F12, F15, F19.

### OP-S05 — Monitoring, budgets, alert/support ownership

**PARTIAL_HISTORICAL_EVIDENCE_CURRENT_OPERATION_UNVERIFIED.** The source monitoring query returns aggregate customer-reminder cron/queue/subscription health; it does not prove alert detection/delivery or cover every service. Stage 1 recorded no policies in the shown Cloudflare account view, an owner-confirmed incoming Zoho support test and six usage values below displayed limits with project/cycle attribution unresolved. Those are dated scoped observations, not current absence or full operational PASS.

Required next evidence: Select scope-labelled metrics/budgets, account/service coverage, private logs/redaction/retention, review frequency, responsible responder/alternate and actual bounded alert/support receipt evidence.

Source: `supabase/pwa-stage-13-monitoring.sql`, `supabase/migrations/20260912120000_support_ticket_workflow.sql`, `docs/security-audit/SECURITY_STAGE_1_5_OPERATIONAL_RUNBOOKS.md`. Prior records: S1E94, S1E95, S1E96. Coordinating action: OP-R03; findings F19, F08.

### OP-S06 — Recovery, offsite protection and component coverage

**PRIOR_SYNTHETIC_RESTORE_PASS_FULL_SERVICE_RECOVERY_UNVERIFIED.** Prior owner Windows PostgreSQL 17.11 loopback restore committed selected staging public application data; selected role/RLS/data and dummy-file hashes passed and the server stopped. Reported 11 seconds is that narrow drill, not production RTO. Actual Storage service/bytes, hosted Auth/config/providers/managed roles, encryption/offsite/failure operations and full RPO/RTO remain open. Google offsite route was deferred.

Required next evidence: Inventory privately protected components/keys/settings and independent recovery access, accepted retention and RPO/RTO, realistic isolated target authority and full-service restore validation. Keep the successful local target stopped; do not drop or rerun its empty-target helper.

Source: `scripts/restore-synthetic-recovery.ps1`, `scripts/verify-local-recovery-probe.cjs`, `supabase/diagnostics/security_stage_1_backup_inventory.sql`, `supabase/diagnostics/security_stage_1_recovery_dependencies.sql`, `docs/security-audit/SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md`. Prior records: S1E88, S1E96, S1E99. Coordinating action: OP-R04; findings F16, F19, F08.

### OP-S07 — Containment and rollback are different scopes

**SOURCE_RECIPES_PRESENT_UNEXERCISED_AND_COMPATIBILITY_UNVERIFIED.** One dispatcher recipe unschedules a named job while retaining queue history; another rollback removes queue/functions. The MFA rollback restores pre-candidate routine/policy definitions and drops candidate helpers. Existing recipes are not evidence of safe current rollback, compatible schema/artifacts or an operator exercise.

Required next evidence: Prefer reversible bounded containment in the accepted environment. Separate front-end rollback, Edge/config rollback, data migrations/restoration and security enforcement. Review exact installed shapes, data/history preservation and accepted authority before any exercise.

Source: `supabase/rollback-push-dispatcher.sql`, `supabase/rollback-notification-outbox.sql`, `supabase/candidates/security_stage_3_admin_mfa_rollback.sql`, `docs/security-audit/SECURITY_STAGE_1_5_OPERATIONAL_RUNBOOKS.md`. Prior records: S1E96, S3E25, S9E06. Coordinating action: OP-R05; findings F16, F19, F15, F18.

### OP-S08 — Final release dependencies and supply-chain evidence

**CARRY_FORWARD_OPEN_NO_RELEASE_ACCEPTANCE.** Workflow has default contents-read and job-scoped deploy permissions, but action references use version tags and no full current CI/provider provenance or final signed artifact is accepted. Prior final Windows offline result is 882 PASS, 21 syntax checks; all failures remain retained. 48 RG cases, eight RG actions/eight decisions, native/store/privacy/commerce and a dated staging Auth module asset-type FAIL remain carry-forward.

Required next evidence: Reconcile actual reproducible artifact/source/access/dependency evidence and complete earlier implementation/hosted/device/store dependencies plus final remediation and fresh full re-audit; source metadata and docs alone cannot authorize release.

Source: `.github/workflows/pages.yml`, `package-lock.json`, `scripts/build-capacitor.mjs`, `docs/security-audit/SECURITY_STAGE_9_COMPLETION_REPORT.md`, `docs/security-audit/security-stage-9-final-recheck.json`. Prior records: S9E06. Coordinating action: OP-R01, OP-R06; findings F05, F18, F19, F20, F17.


## Historical operations and recovery evidence

| Record | Dated result retained | Scope still open |
|---|---|---|
| S1E88 / 9 October | Owner Windows PostgreSQL 17.11 isolated public-application restore PASS; selected data/roles/RLS and dummy-file hash; server stopped | Full hosted Auth, actual Storage service/file bytes, managed roles/settings/keys, offsite protection and realistic RPO/RTO |
| S1E92 / 9 October | Six production functions/three active jobs and production Worker/domain/build labels recorded from owner screenshots | Current installed versions, serving artifact parity, preview isolation and asynchronous final outcomes |
| S1E94–95 / 9 October | Owner received incoming Zoho support test; no policies in shown Cloudflare account view; six displayed usage values below displayed limits | Current alert detection/delivery, actual service/project/cycle usage scope, budgets and support/alternate coverage |
| S1E96–97 / 9 October | Operational runbooks documented; Stage 1 operations checkpoint closed with carry-forward | Operator exercise, rollback, independent recovery and full operational acceptance |
| S9E04 / 13 October | Corrected owner Windows 882 PASS / zero FAIL / exit 0; 21 syntax checks | Actual installed/device/store/provider acceptance |
| S9E05–06 / 13 October | Selected staging config reference positive, source parity REVIEW and explicit Auth module asset-type FAIL; Stage 9 closure reconciled | All 48 RG full cases blocked/unrun, eight OPEN actions/eight unconfirmed decisions |

The old F16/F19 finding rows remain original definitions and contain historical baseline statements. They are not fresh assertions that staging or every provider alert is currently absent. Stage 1 positives and later staging evidence supersede only their demonstrated scope; all unresolved parts and failed receipts remain traceable.

No historical usage figures are treated as current limits, provider plan or billing attribution. No old “11 seconds” restore duration becomes production RTO. The known successful recovery target remains protected and stopped; an empty-target helper must not be rerun against its committed state.

## Current primary documentation reviewed

Four primary pages were read on 13 October 2026 for recovery/deployment boundaries. These are requirement context, not owner account/settings proof.

- **[Supabase Database Backups](https://supabase.com/docs/guides/platform/backups)** — Database backups exclude Storage object bytes and omit custom-role passwords. Project deletion removes associated backups. Recovery planning therefore needs separately protected file/configuration/access components; no account plan or current backup entitlement is inferred.
- **[Cloudflare Pages Rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)** — Successful production Pages deployments are valid rollback targets; preview deployments are not. This is not a Worker rollback instruction or a database/Edge/configuration restore. Actual serving product and accepted target must be identified.
- **[Supabase Production Checklist](https://supabase.com/docs/guides/deployment/going-into-prod)** — Review RLS, protected provider/admin access, SMTP, performance and availability. The deployed application's actual policies/settings/capacity and access recovery need evidence; this reference does not prove they are enabled.
- **[GitHub Actions Secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)** — Use minimum token permissions and review untrusted code/action handling. Current guidance discusses workflow dependency lockfiles and, where not adopted, verified full commit SHA action references. Assess the actual workflow/repository controls; no pinning or protection change is made in inventory.

The distinction between product scopes is material: a Cloudflare Pages deployment rollback does not itself roll back Worker code, Supabase Edge/schema/settings or data. The operational plan must first identify the actual serving product and compatible accepted artifacts. Likewise, a database restore cannot substitute for independently protected uploaded files and access/configuration dependencies.

## Six coordinating decisions and actions

| Decision | Owner | Current result |
|---|---|---|
| OP-D01 — Exact accepted environment, source/artifact, hosting product/channel and deployment authority | Both | UNCONFIRMED; accepted value null |
| OP-D02 — Responsible operator, alternate/recovery custody, support and incident review coverage | Owner/Both | UNCONFIRMED; accepted value null |
| OP-D03 — Service/usage scope, health and alert thresholds, review cadence and private log retention | Owner/Both | UNCONFIRMED; accepted value null |
| OP-D04 — Full recovery components, independent offsite route, retention and RPO/RTO objectives | Owner/Both | UNCONFIRMED; accepted value null |
| OP-D05 — Version-compatible containment/rollback/resume triggers and authorized safe drill scope | Both | UNCONFIRMED; accepted value null |
| OP-D06 — Final release channels/dependencies, accountable release disposition and fresh full re-audit scope | Owner/Both | UNCONFIRMED; accepted value null |

| Action | Owner | Findings | Required remaining work |
|---|---|---|---|
| OP-R01 — Reconcile release mapping and protected deployment provenance | Both | F18, F19, F08, F05 | Establish accepted exact staging/serving/backend version and isolated configuration; reconcile historical instructions, workflow provenance, artifact allowlist and protected operator/recovery authority. |
| OP-R02 — Verify protected jobs, queue lifecycle and actual outcomes | Both | F12, F15, F19 | Complete actual scheduler-to-HTTP/Edge/business correlation, queue concurrency/retry/terminal and recipient/egress checks, automatic rate/history integrity and safe cleanup on controlled fixtures. |
| OP-R03 — Establish measurable monitoring, support and incident response | Owner/Both | F19, F08 | Approve service/usage scopes, budgets, alert destinations, cadence, private logs and accountable responder/alternate; demonstrate safe detection/receipt and support/incident operation. |
| OP-R04 — Complete protected backup and full-service recovery evidence | Both | F16, F19, F08 | Resolve private component/file/settings/key coverage, offsite/retention and failure handling; prove independent access and realistic fresh isolated recovery against accepted RPO/RTO without rerunning the committed local restore. |
| OP-R05 — Prepare and exercise compatible containment and rollback | Both | F16, F18, F19, F15 | Separate product-specific web rollback, scheduler containment, Edge/config and schema/data/security recovery; review exact installed compatibility and preserve history/access controls during accepted operator exercises. |
| OP-R06 — Reconcile all final dependencies before release disposition | Owner/Both | F05, F17, F18, F19, F20 | Complete earlier remediation/installed/device/store evidence and all original coverage/action traceability; prepare accountable release/rollback/incident disposition and perform a fresh full final audit. |

All six OP actions are **OPEN**. They coordinate the existing audit's findings and dependencies; no original finding is added or closed. The eight RG action definitions and eight RG decision records are unchanged, as are all earlier stage families.

The frozen OP matrix has six groups with four genuine acceptance requirements each: **24 PENDING_NOT_RUN / NOT_EXECUTED**. These overlap earlier requirements and are not 24 additional unique global controls. Recoverable actors, accepted staging installation, metrics/ownership decisions and earlier implementation gaps are prerequisites; further fixture counts cannot replace missing operational evidence.

## Finite checkpoint and handoff

Stage 10 has four milestones: **10.1 inventory/plan, 10.2 reviewable source-bound runbooks and bounded collection candidate, 10.3 one controlled staging operations/readiness outcome, 10.4 full report and final-remediation handoff**. The full Stage 10 report remains due at 10.4. A blocked 10.3 outcome is recorded once and carried forward.

All prior Stage 0–9 progress objects, all 123 coverage rows and 20 finding definitions, prior receipts/action definitions and retained synthetic fixtures remain unchanged. The two intended USD 1 manual conversions remain intact. Production project `kttkospkblwvguuwnhjj` remains excluded from mutation.

Release gate: `OPEN_PENDING_REQUIRED_EVIDENCE`. Final re-audit: `PLANNED_NOT_PERFORMED`. Hosted/native/store/operations acceptance: false. APK update: deferred. No rollback/restore/incident exercise, deployment, alert configuration, email/notification/charge, store upload or policy adoption is performed.

**Next: 10.2. No owner SQL, terminal, setup, rerun or file-opening action is required for 10.1.** Future executable owner handoffs must include the complete scoped code in chat; final remediation and a fresh full re-audit of final accepted source/deployments/artifacts remain required before release.
