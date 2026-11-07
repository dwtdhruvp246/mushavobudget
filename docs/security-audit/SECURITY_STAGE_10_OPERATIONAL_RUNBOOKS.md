# Stage 10 operational instructions — reviewed candidate

**10.2 / 13 October 2026 — prepared and reviewed, not an exercised operational runbook.**
Source/evidence parent: `1b012fd9c47bfb1733596f64c470feee5d308341`. [Candidate report](SECURITY_STAGE_10_2_OPERATIONS_CANDIDATE.md) · [Six OPEN actions](security-stage-10-remediation-actions.json) · [Frozen 24 grouped requirements](security-stage-10-operations-test-matrix.json).

## Use the accepted target and record actual evidence

The bounded audit target is staging Supabase `dczlddwbtgvfdujgcitb` and `https://mushavo-budget-staging.pages.dev`. Production `kttkospkblwvguuwnhjj` remains excluded from mutation. Before any later provider/SQL/incident exercise, identify the exact dashboard project, serving product/project/channel/branch, accepted source/artifact, installed Edge/schema/grants/Auth and the controlled actor/data scope. Do not infer backend isolation from a project-reference string in a page.

Record date, scope, safe expected/observed outcome, failures, cleanup and private evidence correlation. Keep credentials/recovery codes, request headers, raw page/provider responses, financial/customer records, inbox contents, push keys/endpoints and private backup bytes out of published receipts. Missing evidence remains UNVERIFIED or BLOCKED_NOT_RUN rather than zero/healthy.

Current operating decisions OP-D01–OP-D06 are unconfirmed. Named responder/alternate, support cadence, thresholds, log retention, full backup/offsite coverage, RPO/RTO and rollback/resumption authority need accepted values before their genuine cases can pass.

## 1. Release mapping and the fixed public collector — OP-R01

Use the exact reviewed source export, not a mixed working checkout. The candidate collector validates nine local source inputs against the contract's normalized source hashes before requesting anything. It accepts only exact staging confirmation and source-pin arguments, and only these fixed public routes:

| Local source | Public staging route | Required response type |
|---|---|---|
| config.js | /config.js | JavaScript; project-reference observation only |
| auth.html | /auth.html | HTML, compared to reviewed source |
| auth-flows.js | /auth-flows.js | JavaScript |
| auth-security.js | /auth-security.js | JavaScript |
| admin-mfa.js | /admin-mfa.js | JavaScript |
| app.js | /app.js | JavaScript |
| business.js | /business.js | JavaScript |
| app.html | /app | HTML, compared to reviewed source |
| business.html | /business | HTML, compared to reviewed source |

A later authorized collection uses GET with omitted credentials, no Authorization header and manual redirects. It has a six-second per-request and 30-second total deadline, with a 32 KiB config body limit and 2 MiB limit for each other response. No dynamic URL/host override exists. No page script is executed.

Receipt interpretation:

- **FAIL_SELECTED_PUBLIC_ASSET_TYPE:** HTTP 200 does not establish availability when a module returns HTML or an invalid/missing script type.
- **REVIEW_SELECTED_PUBLIC_SOURCE_PARITY:** type can be valid while the requested page/script differs from reviewed source.
- **EXPECTED_STAGING_CONFIG_REFERENCE_OBSERVED:** expected staging reference present, production reference absent and selected forbidden key markers absent. This is not key ownership, executable config validation or a complete secret scan.
- **REDIRECT_NOT_FOLLOWED_REVIEW / HTTP_STATUS_REVIEW:** retain the status; no redirected destination is fetched.
- **UNVERIFIED_REQUEST_OR_BODY / NOT_REQUESTED_TOTAL_DEADLINE:** retain timeout/size/encoding/transport limits and do not convert an incomplete collection into PASS.
- **MATCH_SELECTED_PUBLIC_SOURCE_METADATA:** normalized newline/project-reference-overlay bytes match at public metadata scope only. Installed backend, full CI, browser execution and full OP cases remain unverified.

The receipt publishes only fixed paths, safe outcome labels, counts, types, booleans, timestamps and hashes. Ordinary local source/root checks and reviewed hashes reject missing, changed or redirected inputs. They are not an operating-system sandbox; source/current artifact provenance still matters. Only CR/CRLF and the known project-reference overlay are normalized for comparison.

At 10.2 the CLI was exercised only with disabled default transport and synthetic response ports. **No live staging GET ran.** The user's terminal handoff is the offline verifier, not the collection command. Supply the complete exact-pin live collection handoff in chat only at the later bounded 10.3 outcome.

## 2. Jobs, queues, currency and protected egress — OP-R02

Source schedules are reminders every 15 minutes, admin delivery every five minutes and currency sync at 00:15/12:15. These are proposed source values, not newly verified installed jobs. Historical screenshots from Stage 1 recorded three production jobs; they do not prove current staging execution.

Collect safe current job-name/schedule/active/run-status/time metadata only after staging selection and the read-only query scope are established. Do not select stored SQL job commands, Vault values, decrypted secrets, raw HTTP bodies or headers. Metadata inspection must not enqueue/claim/retry a row or call a dispatcher.

For genuine execution acceptance, correlate the actual named job, asynchronous HTTP result, exact Edge version, business outcome and controlled recipient/provider result. Cron SQL success/request ID alone is insufficient. Distinguish configuration, actual invocation, business success, partial failure and delivery.

Use recoverable synthetic queues with accepted scope for later concurrency, bounded attempts, duplicate prevention, stale claims, terminal states and cleanup. Source has three attempts, 15-minute abandoned-claim handling, five-/30-minute retry delays and SKIP LOCKED; those mechanisms need actual installed PostgreSQL/transport checks. Preserve failed/terminal history.

Automatic currency acceptance requires actual scheduler/provider behavior, freshness/partial backfill and unchanged historical/manual conversions. Preserve the two intended USD 1 fixtures. Selected outbound/recipient helpers and prior synthetic tests do not establish real delivery or role/account-switch privacy.

No schedule, secret, queue, provider or data mutation is performed by preparing these instructions.

## 3. Health, alert/support receipt and incident evidence — OP-R03

The existing PWA Stage 13 monitoring query covers customer-reminder cron, outbox and subscription aggregates. Review its current installed relation/column dependencies before use; it is not every-service monitoring or alert delivery. Expand later evidence only as justified for admin dispatch, rates, backup completion/failure, application errors, capacity and provider outcomes.

Select project/organization, billing period and relevant usage categories before interpreting budgets. Earlier usage values and plan labels are dated; do not treat them as current attribution or limits. A manual query is not a continuously running alert policy.

Retain historical evidence: owner received an incoming Zoho support test; no policies were configured in the shown Cloudflare account view. Neither proves current absence everywhere, staffed support coverage, automated failure detection or receipt.

After accountable responder/alternate, cadence, safe test scope and destinations are accepted, demonstrate a bounded relevant detection-to-receipt/escalation path. Keep raw email/request/customer content private; publish only the safe dated receipt summary. No message, notification or forced outage is authorized merely by this runbook.

During an incident, record affected service/scope, first/last safe observation, status/error categories, counts, decision/owner and chosen next action. Protect useful private correlation separately. Check for stale/missing monitoring, failed backup, queue backlog, partial provider failure and access loss before calling the system healthy.

## 4. Full recovery and independent access — OP-R04

Preserve the successful earlier Windows loopback public-application restore. Its selected data/roles/RLS and dummy-file hash passed; its server stopped. Do not drop it, reuse its empty-target helper or overwrite retained artifacts. Its 11-second duration is that scoped drill, not full production RTO.

Inventory database data/roles/grants, actual uploaded-file bytes and metadata, Auth/settings/SMTP, Edge/config/provider dependencies, managed authority, privately recoverable keys and independent access. Record actual protected artifacts, integrity/completeness, retention, offsite custody and backup/failure review. The Google offsite route remains deferred; no alternative is silently adopted.

Database backup is not uploaded-file recovery. Full-service acceptance needs applicable components and realistic isolated service behavior, not only a local public schema or dummy file. A later drill requires a fresh accepted target, compatible tools, recoverable authority, protected source artifacts, accepted RPO/RTO and non-sensitive integrity/access checks.

For credential loss, use privately retained independent recovery material and the provider's verified recovery procedure. Preserve the sole working factor. Do not publish codes or claim recovery from normal sign-in alone. No restore/export, paid upgrade, key rotation or account-factor change occurs here.

## 5. Containment, compatible rollback and resumption — OP-R05

Choose the least disruptive accepted action for the actual incident/environment and exact installed version. Stopping future scheduled invocations, reverting a web artifact and restoring data have different effects.

The existing dispatcher stop recipe unschedules a named reminder job and preserves queue history. Unscheduling does not itself cancel in-flight invocations or deny other/manual authorized callers. Verify containment scope, in-flight work and required recovery before later resumption.

Other rollback files remove tables/functions or restore older policy/routine shapes. Do not treat them as universally safe. Review exact installed dependencies, records/history preservation, security enforcement and compatible source/artifacts. Reverting an MFA candidate must not silently create an accepted release with weaker access control.

Identify whether the serving path is Cloudflare Pages, a Worker or GitHub Pages. A Pages production rollback target is not a preview target or a Worker/database/Edge rollback. Retain exact accepted artifact identity and applicable Auth/PWA behavior. Schema/data changes may require a reviewed forward repair or isolated recovery rather than blind reversal.

A later operator drill should record accepted stop/triage/recovery/resume steps, durations, failures, data/access integrity and safe health/outcome evidence. No stop/rollback/restore is exercised in 10.2, and no old production command is supplied as a current action.

## 6. Final release disposition — OP-R06

Map all original 123 coverage rows, 20 finding definitions, earlier action families and failed/partial/unrun evidence to the final accepted source, deployment and artifacts. The six OP actions and inherited eight RG actions remain OPEN. All 24 OP actual requirements remain unrun; earlier 48 RG cases remain blocked/unrun.

Resolve earlier implementation, direct Auth/authorization, deletion/retention/trusted files, rates/history, provider/commerce, measured browser/device, signed native artifact and publisher/store/reviewer requirements. Store/account facts and public policy declarations must match actual final behavior. APK update remains deferred.

Complete final remediation and a fresh full audit of final accepted source, installed services and artifacts before a concrete accountable release decision. Stage/report completion, offline 27-case candidate PASS or earlier Windows 882 PASS does not satisfy that release gate.

**Next 10.3 records one bounded staging operations/readiness outcome.** Missing prerequisites are recorded once and carried forward. Full Stage 10 report remains due at 10.4. Any necessary owner SQL/terminal action must be pasted completely in chat before execution.
