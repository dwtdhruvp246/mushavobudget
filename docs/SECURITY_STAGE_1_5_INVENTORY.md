# 1.5.1 — Production operations inventory

Partial inventory recorded 9 October 2026 from three owner screenshots, S1E90. All three attachment copies were successfully viewed despite the earlier image-loading error text. Stage 1 remains at 1.5.1; the four finite 1.5 work items remain open. No provider setting, deployment, Cron job or dispatch destination was changed.

## Hosting evidence

The Cloudflare Workers & Pages screen displays project mushavobudget, environment Production, active version ID 162af658 deployed two days before the screenshot. Recent builds are Ready on security/stage-1-foundations; the latest visible build commit is 72b2f269. A Ready build and its audit-branch label do not establish which version/commit currently serves mushavobudget.com. Domains, production branch, build/output settings and active-version commit mapping are not visible. The traffic percentage label/bar is not used to infer actual routing from this screenshot.

Required remaining hosting confirmation: the Domains screen for this project, and Settings sections showing build/deployment configuration and production branch if present. Keep credential values out of screenshots. If the project UI uses another deployment method, record that displayed method instead of forcing a Pages/Git assumption. Existing staging frontend evidence remains separate; no production setting is changed to match the audit branch.

## Production Edge Functions

The screenshot lists six functions whose visible URLs contain production reference kttkospkblwvguuwnhjj. Names match the six local repository function directories. Name presence alone does not establish deployed source/version parity or authorization configuration. The Deployments column is a deployment count, not a verified current version identifier.

| Function | Deployment count | Requests, last hour | HTTP 5xx rate, last hour |
|---|---:|---:|---|
| dispatch-admin-notifications | 1 | 12 | 0% |
| dispatch-push-reminders | 3 | 2 | 0% |
| invite-admin-user | 3 | Dash / unspecified | Dash / unspecified |
| invite-business-member | 1 | Dash / unspecified | Dash / unspecified |
| send-test-push | 4 | Dash / unspecified | Dash / unspecified |
| sync-exchange-rates | 9 | Dash / unspecified | Dash / unspecified |

The two visible nonzero request counts show activity in the displayed one-hour window. A 0% HTTP 5xx rate does not establish absence of other errors, correct authorization or successful recipient delivery. Dash values are not converted to zero or a health pass.

## Production Cron

Supabase screen header shows Mushavo Budget / main / Production and a Free-plan label. Three jobs are active and their latest displayed scheduler runs are Succeeded.

| Job | Cron expression | Latest displayed run (+0200) | Status |
|---|---|---|---|
| mushavo-currency-rates-twice-daily | 15 0,12 * * * | 9 Oct 2026 02:15 | Succeeded |
| mushavo-budget-dispatch-push-reminders | */15 * * * * | 9 Oct 2026 11:30 | Succeeded |
| mushavo-budget-dispatch-admin-notifications | */5 * * * * | 9 Oct 2026 11:30 | Succeeded |

Visible command prefixes use net.http_post and a Vault-derived URL. Raw command text, secret names/values and returned bodies are not reproduced. pg_net HTTP requests are asynchronous and the call returns a request identifier; HTTP requests start after transaction commit. Therefore scheduler SQL success does not by itself establish HTTP success, business success or push/email receipt. Reference: [Supabase pg_net documentation](https://supabase.com/docs/guides/database/extensions/pg_net). No HTTP response, recipient delivery or alert test is performed by this screenshot review.

## Remaining evidence and carry-forward

The next consolidated owner reply should confirm hosting domain/build mapping and state whether outage, application-error, backup-failure and dispatch-failure alerts are enabled, absent or unknown. Owner alert configuration has not yet been supplied. Support routing, plan/usage thresholds, deployed authentication settings/version parity and actual alert/dispatch delivery remain unverified. These areas retain explicit review status; later controlled checks belong to 1.5.2 and final unresolved issues carry to remediation/re-audit.

This inventory does not request another export/restore, force a deployment, merge the audit PR, enable schedules or send messages. The successful 1.4 synthetic target stays stopped and the closed 1.2/1.3/1.4 evidence remains unchanged.
