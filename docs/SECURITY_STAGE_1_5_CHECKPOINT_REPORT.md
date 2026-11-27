# 1.5 — Operations checkpoint report

Completed 9 October 2026, S1E90–S1E97. **Four work items have recorded outcomes; zero remain in 1.5. CLOSED WITH CARRY-FORWARD.** Missing controls remain open for the owner's final remediation and full re-audit. This is an operations documentation checkpoint, not an all-PASS operational acceptance.

| Work item | Outcome | Evidence and limit |
|---|---|---|
| 1.5.1 Deployed inventory | PARTIAL / closed | Production Worker/domain/main branch, six Edge Functions and three active Cron jobs recorded. Active version/source/asset mapping, Edge authorization/source parity and preview isolation unverified; Git-account warning visible. |
| 1.5.2 Monitoring and controlled checks | SUPPORT ROUTING PASS; ALERTS MISSING; USAGE PARTIAL | Owner support test received. Cloudflare account Alerts Overview shows no configured policies; no applicable sample policy to test. Six usage values are below displayed limits, but scope/cycle dates and other metrics are absent. Other failure detection and delivery remain unverified. |
| 1.5.3 Runbooks | DOCUMENTED / not exercised | Incident, monitoring, rollback, export/recovery and credential-loss procedures prepared from actual evidence and explicit gaps. No rollback, production recovery, daily review or incident-response exercise performed. |
| 1.5.4 Checkpoint report | COMPLETE / carry-forward retained | This report records outcomes, actions and advancement to 1.6. No finding closes merely because documentation is complete. |

## Owner monitoring evidence — S1E94

Three supplied screenshots were successfully viewed, despite attachment error text. Cloudflare's account Alerts Overview displays No alerts configured. This establishes an empty policy list for the shown account view, not absence of every alert mechanism at every provider. No policy was created or test message sent by root.

The Free plan / Current billing cycle usage image shows:

| Metric | Used / included | Approximate displayed-quota share |
|---|---:|---:|
| Egress | 0.23 / 5 GB | 4.6% |
| Database size | 46 / 500 MB | 9.2% |
| Monthly active users | 22 / 50,000 | 0.044% |
| File storage | 0.00 / 1 GB | Rounded display; exact bytes unknown |
| Log ingestion | 0.31 / 1 GB | 31% |
| Log Query | 7.81 / 100 GB | 7.81% |

All six displayed values are below their shown limits. Project/organization scope and cycle dates are cropped out, so these values cannot be attributed solely to production. Edge invocation/Realtime usage, Cloudflare usage/budget controls and actual quota-warning receipt are unverified. No plan, spend cap or alert threshold was changed.

The owner reports ZOHO TEST MAIL—RECEIVED. The screenshot shows the controlled subject Mushavo audit 1.5.2 support test and body Controlled owner test, with recipient label support; the full recipient address is not visible. Together with the preceding owner-only support@mushavobudget.com handoff and owner receipt confirmation, this is a scoped incoming-support-routing PASS. It does not test Supabase SMTP, business-invitation templates, outbound email, automated alerts, owner inbox-review frequency or response staffing. Personal sender/account details are omitted from the evidence.

## Production inventory limits

Production hosting is a Cloudflare Worker; staging is the separate Pages frontend. The production branch is main; non-production builds are enabled. A disconnected Git-account warning requires review, but is not proof that the live app is down. Ready audit builds do not identify the active source/assets. The six Edge names match repository directories only; deployment counts are not version IDs and dash metrics are not zeros.

The latest visible runs of all three active Cron jobs are Succeeded. Because their displayed command prefixes use asynchronous net.http_post, scheduler SQL completion does not prove HTTP/application/recipient success. No controlled dispatch or HTTP-response correlation was performed here. See the [inventory](SECURITY_STAGE_1_5_INVENTORY.md).

## Actions carried to final remediation

| Finding | Remaining work | Responsible party | Required recheck |
|---|---|---|---|
| F19 | Configure feasible outage/error/backup/dispatch detection and owner routing; establish actual review coverage | Both; owner selects provider settings/destinations | Sample receipt plus controlled relevant detection; missing/failed run produces actionable evidence |
| F18/F19 | Review Git warning; reconcile active Worker source/assets, Edge authorization/version parity and preview isolation | Both | Approved deployment mapping and actual isolated runtime checks |
| F19 | Establish usage scope/cycle dates, missing usage/budget metrics and review thresholds | Owner with developer guidance | Scope-labelled limits and controlled notification evidence where available |
| F16/F19 | Complete backup/failure handling and full recovery prerequisites; exercise the runbooks | Both | Realistic isolated recovery and operator execution, with integrity/completeness and measured targets |
| F08/F19 | Reconcile independent recovery/account ownership and incident/support responsibilities | Owner with developer guidance | Actual safe recovery/review evidence; no private codes disclosed |

No repeat 1.2 export loop, Google upload, paid upgrade, forced outage, production restore, APK update or audit-PR merge is performed. The local successful recovery target remains stopped. [Operational runbooks](SECURITY_STAGE_1_5_OPERATIONAL_RUNBOOKS.md) and the [detailed Stage 1 report](SECURITY_STAGE_1_COMPLETION_REPORT.md) explain the retained limits.
