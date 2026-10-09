# 1.5.2 — Monitoring, usage and controlled support check

Prepared 9 October 2026, S1E93. The owner replied unsure about outage, application-error, backup-failure and dispatch-failure alerts. They remain UNVERIFIED, not confirmed absent. 1.5.1 is closed with partial inventory/carry-forward. One of four 1.5 work items is complete; three remain.

## One consolidated owner batch

1. **Cloudflare account alert list:** open the account-level Alerts > Overview page (older navigation may say Notifications). Send the existing alert-policy list showing policy types and enabled state; personal recipient addresses may be redacted. If the list is empty, send the empty page. If unavailable, report UNAVAILABLE. Do not create, delete or toggle policies for this inventory check. Cloudflare's current official guide describes the account Alerts page and a Test action for existing policies. Alert availability depends on plan/product; existence of a Workers metrics/Issues page is not proof of configured delivery. [Official guide](https://developers.cloudflare.com/notifications/get-started/).
2. **Supabase current usage:** open the organization's Usage page and show the current billing-period usage and included limits, especially database size, Storage, egress, Edge invocations and Realtime if visible. Record the scope: filter to production Mushavo Budget if the page offers it; otherwise label the screenshot ORGANIZATION_TOTAL, which can include staging. Hide payment details. No subscription, spend-cap or add-on change is needed. [Usage page](https://supabase.com/dashboard/org/_/usage) and [scope explanation](https://supabase.com/docs/guides/troubleshooting/understanding-the-usage-summary-on-the-dashboard-D7Gnle).
3. **Support incoming receipt:** if support@mushavobudget.com exists and the owner can open its Zoho inbox, manually send one plain dummy message from another inbox the owner controls. Subject: Mushavo audit 1.5.2 support test. Body: Controlled owner test. No customer data. Report RECEIVED, NOT_RECEIVED or MAILBOX_NOT_CREATED/UNAVAILABLE; check Spam if necessary. Keep message headers and private account details local. Root sends no email and does not use SMTP credentials. This tests incoming support routing only, not automated alerts, Supabase SMTP or customer email templates.

Report whether the owner personally reviews this support inbox; do not invent staffing or response-time proof from a single received message.

## Controlled alert test after policy inspection

If a relevant existing enabled policy routes solely to a verified owner-controlled email destination, prepare use of its built-in sample Test action rather than breaking the live application or forcing a real outage. The owner result must identify policy type, sample-test outcome and inbox receipt status. A sample receipt tests that delivery path; it does not prove the monitor detects the correct production failure or cover backup/dispatch/application failures. Do not trigger a policy aimed at other recipients without explicit instructions. If no relevant policy or delivery destination can be established, record MISSING/UNVERIFIED and carry the action to final remediation rather than fabricate coverage or force an upgrade.

Cloudflare docs say email delivery is supported across plans, but specific alert types can require a particular plan/product. Do not equate general provider alert availability with a configured account policy. [Alerts overview](https://developers.cloudflare.com/notifications/).

## Outcome fields and limits

| Area | Record | Current state |
|---|---|---|
| Existing alert coverage | Types, enabled state, monitored target, safe delivery destination presence | Pending owner policy list |
| Usage/limits | Provider plan, billing period, project/organization scope, used/included amounts and visible warnings | Pending owner screenshot |
| Alert delivery | Sample-test type/outcome and actual controlled recipient receipt | Not tested |
| Support routing | Mailbox availability, owner review and controlled incoming receipt | Not tested |
| Backup and dispatch failure detection | Actual completion/failure signal, operator action and alert path | Unverified; previous scheduler SQL success is insufficient |

Supabase Free plan quota warnings/notifications described in general documentation do not prove configured custom error/backup/dispatch alerts or actual owner receipt. A Pro spend-cap instruction must not be imposed on a Free account. Current usage and provider thresholds remain owner evidence, not guessed from repository data. No paid service is added by this handoff.

After this consolidated batch and an applicable controlled sample check, record PASS/PARTIAL/MISSING/UNVERIFIED and advance to 1.5.3 runbooks. Unsupported provider coverage, Git disconnection, exact deployed parity, full recovery and offsite gaps remain in final remediation/re-audit. Avoid additional screenshot/diagnostic cascades. The local successful restore stays stopped; production schedules, application policies and source backups are unchanged.
