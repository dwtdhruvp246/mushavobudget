# 1.5.1 — Production operations inventory

**Superseding 1.5.2 result — S1E94–S1E97:** The shown Cloudflare account policy list is empty; this supersedes the earlier unsure reply for that view. Support test received; six usage values below displayed limits with scope/dates unverified. Other detection/delivery and deployment parity remain open. 1.5 is closed with carry-forward; read its [report](SECURITY_STAGE_1_5_CHECKPOINT_REPORT.md). Earlier inventory observations remain in their original scope.

Inventory closed 9 October 2026 with partial coverage and carry-forward, S1E92, following five owner screenshots S1E90–S1E91 and the owner alert reply unsure. All attachment copies were successfully viewed despite earlier image-loading error text. Stage 1 advances to 1.5.2. One of four finite 1.5 work items is complete; three remain. No provider setting, deployment, Cron job or dispatch destination was changed.

## Hosting evidence

The Cloudflare Workers & Pages screen displays project mushavobudget, environment Production, active version ID 162af658 deployed two days before the screenshot. Recent builds are Ready on security/stage-1-foundations; the latest visible build commit is 72b2f269. A Ready build and its audit-branch label do not establish which version/commit currently serves mushavobudget.com. In the first screenshot, domains, production branch, build/output settings and active-version commit mapping were not visible; the next section records subsequently supplied configuration. The traffic percentage label/bar is not used to infer actual routing from this screenshot.

S1E91 supplies the Domains and Builds settings. This production hosting resource is a Cloudflare Worker; the earlier general Pages wording is superseded for production. The separate staging pages.dev frontend remains its own recorded environment.

| Configured field | Visible value |
|---|---|
| Custom domain | mushavobudget.com, type Production |
| Production Worker URL | mushavobudget.dhruvp246.workers.dev, enabled |
| Preview Worker URL | Wildcard preview URL, enabled |
| Repository | dwtdhruvp246/mushavobudget |
| Production branch | main |
| Builds for non-production branches | Enabled |
| Disable builds | Off |
| Build command | None |
| Deploy command | npx wrangler deploy --config ./wrangler.jsonc |
| Version command | npx wrangler versions upload |
| Root directory | / |

The non-production build setting accounts for audit-branch builds appearing in the list; it does not establish promotion to the production custom domain. Active-version-to-commit/asset mapping is still unverified. No further hosting screenshot loop is required for this inventory; that mapping remains a review item.

**Git integration REVIEW:** the Builds screen warns that the project is disconnected from its Git account and deployments may fail. This is a current Dashboard warning, not proof that the live Worker has stopped serving or that every deployment has failed. Action: review intended repository/account access, reconnect if necessary and verify a later approved deployment. No Disconnect/Manage action or deployment is performed by this audit review.

**Preview isolation REVIEW:** the Set up Worker Previews banner remains visible while the configured version command is npx wrangler versions upload. Cloudflare documents a legacy preview model for existing Workers and an optional switch to new Worker Previews, with different settings/isolation. Do not treat a Ready audit-branch build as the separately configured staging frontend or proof of isolated secrets/bindings. No preview-model switch is requested. Reference: [Cloudflare build branches](https://developers.cloudflare.com/workers/ci-cd/builds/build-branches/).


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

Hosting domain, production branch and configured build/deployment method are now recorded. Owner replied unsure. All four alert categories are UNVERIFIED; this does not establish that they are absent or enabled. Inventory closes with these gaps carried. The [1.5.2 monitoring check](SECURITY_STAGE_1_5_MONITORING_CHECK.md) gathers the existing policy list, current usage scope and controlled support receipt evidence. Support routing, plan/usage thresholds, deployed authentication settings/version parity and actual alert/dispatch delivery remain unverified. These areas retain explicit review status; later controlled checks belong to 1.5.2 and final unresolved issues carry to remediation/re-audit.

This inventory does not request another export/restore, force a deployment, merge the audit PR, enable schedules or send messages. The successful 1.4 synthetic target stays stopped and the closed 1.2/1.3/1.4 evidence remains unchanged.
