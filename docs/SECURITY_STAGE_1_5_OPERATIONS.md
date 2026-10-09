# 1.5 — Inventory, monitoring and response

Stage 1 continues at 1.5.1 after the [1.4 scoped native recovery checkpoint](SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md). Four finite work items; none is completed yet. This step establishes what actually runs, who notices failures and how the owner responds. A source repository, a successful synthetic restore or saved recovery codes alone do not establish deployed operational coverage.

| Work item | Work and purpose | Acceptance |
|---|---|---|
| 1.5.1 Consolidated deployed inventory | Identify production/staging hosting mapping, deployed Edge function names/versions and authentication configuration presence, scheduler status/last outcomes, dependency/tool provenance and existing operational controls. Prevent missing or incorrectly targeted services from being treated as covered. | Redacted owner provider/metadata inventory, intended project confirmation, explicit unknowns; no credentials or private configuration values. |
| 1.5.2 Monitoring and controlled checks | Review current plan/usage limits, thresholds, outage/error/backup/dispatch alerts, support routing and response owner. Prepare concrete tests within approved destinations; record actual receipt or unavailable evidence. | Actual configured coverage and controlled test results, or explicit missing/partial controls with actions. Plan/budget changes and new paid services require a concrete owner decision. |
| 1.5.3 Operational runbooks | Write practical incident triage, deployment rollback and component export/recovery steps based on verified capabilities and known gaps. Distinguish the scoped local drill from full production recovery. | Reviewable instructions, responsibilities, required prerequisites and evidence to record; no invented full-service guarantees. |
| 1.5.4 Checkpoint report | Summarize passes, failures/unknowns and final-remediation actions; advance to 1.6 Stage 1 closure/recheck and detailed stage report. | Four outcomes recorded, remaining count zero, open controls retained. |

## 1.5.1 — One consolidated read-only inventory

S1E90 records the [partial production inventory](SECURITY_STAGE_1_5_INVENTORY.md): six production Edge Functions and three active Cron jobs with latest scheduler statuses Succeeded. Cloudflare displays active version 162af658 and Ready audit-branch builds; domain/active-commit/build mapping and owner alert status remain pending. These screenshots do not prove HTTP/delivery success, deployed authentication/source parity or complete operational coverage.

Owner provider evidence is necessary because root has no signed-in Supabase/Cloudflare/Zoho session. Use production Mushavo Budget kttkospkblwvguuwnhjj when gathering production metadata; staging dczlddwbtgvfdujgcitb remains separate. Clearly label the environment. Do not copy service-role/JWT/SMTP/Edge secret values, customer rows or function bodies into chat.

The consolidated inventory will cover:

- Cloudflare production and staging Pages project names, deployed branch/commit or manual-upload method, build/output mapping, domain mapping and existing deployment/outage notifications.
- Supabase production deployed Edge function names and visible deployment/version/authentication metadata. Secret names/presence may be recorded separately from their private values; repository source does not prove deployed parity.
- Scheduler job names/enabled state and latest safe status/time metadata. Command text and returned messages can contain credentials or customer content and must remain private.
- Existing error, backup and dispatch failure alerts: enabled/disabled/unknown, owner recipient and whether receipt has actually been tested. Record who reviews failures when automated alerting is absent.
- Provider plans/usage thresholds or budget controls and support@mushavobudget.com mailbox/routing presence. Actual support receipt and alert delivery tests belong to 1.5.2 after their destinations and test messages are concrete.

Read-only metadata/screenshot handoffs should consolidate these areas. Missing tables, unavailable dashboards or unconfigured alerts are outcomes to carry, not reasons for repeated speculative queries. This inventory enables no dispatch, changes no schedules and exports no customer data.

## Stopping rule and retained scope

Each work item receives one consolidated evidence/preparation pass and an explicit outcome. Necessary corrections to a supplied helper remain within that item; new uncovered controls enter the final remediation register instead of spawning unlimited substeps. No paid upgrade, recipient messaging, automatic deletion, production restore or reset is authorized by this planning document. Any later test communication needs the owner's explicit instruction and a concrete controlled destination. Google remains deferred and full-platform/F16 recovery acceptance remains open.
