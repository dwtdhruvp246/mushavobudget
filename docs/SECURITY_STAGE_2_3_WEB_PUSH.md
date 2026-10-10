# Stage 2.3 — Web Push outbound destinations

**Closed checkpoint — 2.3, 10 October 2026:** All three bounded work items have outcomes (S2E35–37). Inventory is complete in metadata scope; the guard is complete in source/local scope; hosted acceptance is BLOCKED/UNVERIFIED and carried forward. F12 remains open. Source commit: 4643482f1bcfc0751560f3562b85a344055ed78d. Read the [detailed Stage 2 report](SECURITY_STAGE_2_COMPLETION_REPORT.md). No further owner setup is requested for this checkpoint. The earlier baseline/handoff below is historical and must not be repeated.

| Item | Recorded outcome | Limit |
|---|---|---|
| 2.3.1 | Owner read-only production inventory received at 2026-10-10T12:12:32.673918+00:00; zero subscriptions, RLS enabled/forced and effective grants recorded | Empty inventory does not establish safe future endpoints or provider compatibility |
| 2.3.2 | Shared guard committed in all three senders; 45 selected Node checks, local Deno 2.9.6 transport checks and three entrypoint bundles pass | Source/local scope, not deployed Edge or device delivery |
| 2.3.3 | BLOCKED/UNVERIFIED: read-only staging config GET at 2026-10-10T12:37:49.726Z has an empty vapidPublicKey | Missing registration prerequisite; actual delivery/runtime/retries carry to final remediation |

## Implemented source candidate — S2E36

supabase/functions/_shared/push-destination.mjs validates the raw bounded HTTPS URL before encryption/send: no credentials, fragments, whitespace/control/backslash, encoded/Unicode authority, private literals, lookalike host or nonstandard port. It admits specific Google/Mozilla hosts and bounded Apple/Microsoft subdomains; provider admission, especially a legacy address, is not a successful delivery claim. Opaque path/query bytes and subscription keys are preserved.

A fresh per-send HTTPS Agent validates every DNS answer at actual connection lookup and rejects mixed public/private, invalid, mapped or special-use results. The same vetted address result is consumed by the connection. Environment proxies are explicitly disabled with proxyEnv: {}; certificate verification and provider servername are explicit. DNS/socket/whole-send bounds are 3/10/15 seconds; Agent disposal applies on success and failure. Caller options cannot replace the protected Agent or proxy settings.

send-test-push, dispatch-push-reminders and dispatch-admin-notifications use the shared sender. Policy-blocked subscriptions are retired before network delivery. Provider 404/410 retirement and temporary/outbox result handling retain their previous meanings. No automatic retry is introduced. The pinned web-push 3.6.7 already rejects redirect responses without following Location; tests validate that behavior rather than claim an invented dependency fix.

## Executed verification and scope

Seventeen new guard/actual-entrypoint fixtures, sixteen selected existing regressions and twelve pinned full-package transport cases passed on Node 24.19.0 (45 total, none skipped). Real encryption/VAPID/request construction uses synthetic keys; positive provider/status/redirect cases use local request doubles. The native Agent private-DNS rejection runs without an external provider connection. Tests cover malformed/lookalike destinations, DNS family/mixed answers, repeated lookup changes, timeout/disposal, redirect refusal, option overrides and selected success/retirement/retry outcomes across all three actual entrypoints.

scripts/verify-stage-2-push-transport.mjs provides the reproducible pinned-package transport probe. It validates the web-push version/source digest and emits only a safe summary. The same twelve grouped cases passed in local Deno 2.9.6 with network permission restricted to 127.0.0.1. Initial local Deno probing exposed automatic environment proxy use; explicit proxyEnv disabling corrected that route and the final probe passed. Local permission stops are not production incidents.

Three Edge entrypoints bundle with npm imports external. Repository package manifest/lock and SDK pins are unchanged. Bundling/local Deno do not prove hosted dependency resolution, runtime version, DNS/TLS/proxy behavior or real device delivery.

## Carry-forward and production boundary

The production inventory contains no device sample. Fresh staging configuration has no public push key, so meaningful isolated hosted delivery is unavailable. No keys, cron configuration, device registration or riskier production send is requested merely to extend this bounded stage. F12 stays open until isolated hosted compatibility/network/delivery/retry tests and the approved production rollout pass in final remediation, followed by a full re-audit. No function deployment, production row change, PR merge, APK or native bundle change was performed.

## Historical baseline and owner handoff

Active **2.3.1**, 10 October 2026. Three finite work items. **F12 remains open**; reviewed source shows a destination-validation gap, not established exploitation. Stage 2.2 is [closed with scoped passes and carry-forward](SECURITY_STAGE_2_2_CHECKPOINT_REPORT.md); its successful form batch is not repeated.

| Item | Work | Outcome boundary |
|---|---|---|
| 2.3.1 | Review senders and obtain one read-only aggregate destination/grant inventory | Actual owner metadata supports compatibility choices; do not infer hosted sender parity or provider delivery |
| 2.3.2 | Prepare justified sender restrictions and meaningful local allowed/denied/transport/failure tests | Distinguish application validation from library transport and DNS/rebinding guarantees; avoid silently breaking unreviewed providers |
| 2.3.3 | One bounded isolated acceptance batch, or an explicit unavailable result | Record real delivery/retry coverage only if exercised; carry unavailable device/provider cases to final remediation |
 
After these three outcomes, proceed to **2.4**, the detailed Stage 2 report. Do not create an open-ended notification configuration or screenshot sequence.

## Source baseline — S2E34

At source head 60d84376bba7828a002f06db4dd2354f3ae2ff25, these three functions read stored push_subscriptions endpoint/key fields and pass the endpoint directly to npm:web-push@3.6.7:

- send-test-push
- dispatch-push-reminders
- dispatch-admin-notifications

The selected subscription migration checks endpoint length (20–4096), enables and forces RLS, and grants ordinary signed-in users endpoint INSERT for their own subscriptions. It does not grant endpoint UPDATE to that role in the reviewed definition. Ownership/RLS and destination validation solve separate problems. The diagnostic checks current effective grants, including any table-level grants.

The selected senders disable subscriptions on 404/410 and treat other delivery failures as temporary. Reminders/admin jobs retain sent/retry/failed handling. A guard must preserve justified failure semantics; blocking a destination must occur before attempting network delivery. Dependency redirect behavior, DNS/address handling, deployed code parity and actual provider delivery are not established by this source review. No malicious subscription or notification is created during this inventory.

## The owner's next action — ACTUAL production project, read-only

Use **Mushavo Budget**, project **kttkospkblwvguuwnhjj**, for this metadata inventory. Staging dczlddwbtgvfdujgcitb intentionally has no production push key and is not the genuine subscription inventory. Manually verify the Dashboard project URL before execution; SQL labels cannot prove hosted project identity.

Fetch security/stage-2-web-hardening in the existing Windows checkout and copy the pinned supabase/diagnostics/security_stage_2_push_destinations.sql with git show and Set-Clipboard. In the actual project's SQL Editor, create a new query, paste the whole script and run it once. Return the four result rows only. No app password, service key or individual endpoint is requested. The script makes no schema/row changes or outbound HTTP requests and sends no notifications.

The single result set contains:

1. Read-only context and intended project labels.
2. Table RLS flags and effective endpoint INSERT/UPDATE grants for ordinary roles.
3. Total/active/disabled counts; fixed provider-family labels and overlapping URL-shape counts.
4. The no-write/no-send boundary and remaining proof.

The fixed labels are a provisional inventory vocabulary: Google host family, Mozilla host family, Apple host family, Microsoft host family, and other/unrecognized. Full/custom hosts, paths, query tokens, key values and user/device identifiers are never returned. Recognized labels are **not an allowlist or legitimacy proof**; a familiar host with an unsafe path/fragment may still be counted. Other/unrecognized is a review category, not proof of an attack. Shape counters overlap and can include benign explicit ports; they are not a URL parser.

## Local verification and its limits

The entire SQL script passed a disposable PGlite 0.5.8 / PostgreSQL 18.3 fixture: 25 synthetic destinations including familiar families, lookalikes, credentials, ports, IPv6, encoded authority, backslash, whitespace and missing authority. Checked exact aggregate counts, four rows in one result set, read-only context, effective column/table grants, empty-table behavior, unchanged fixture rows and redaction of all synthetic private paths/keys/users. This is not the hosted PostgreSQL 17 inventory or notification delivery. The owner's four-row receipt is pending.

## Primary-source compatibility references

Reviewed 10 October 2026 for inventory context; final restrictions still require stored-family evidence and transport review.

- [WebKit Web Push guidance](https://webkit.org/blog/12945/meet-web-push/) calls for allowing push.apple.com subdomains when restricting Apple destinations.
- [Mozilla's current Autopush documentation](https://mozilla-services.github.io/autopush-rs/) names updates.push.services.mozilla.com as the production endpoint. The older mozaws family is retained only as a separate provisional inventory match, not an automatic delivery rule.
- [Microsoft WNS request guidance](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/push-notifications/push-request-response-headers) describes notify.windows.com endpoint URIs.
- [Pinned web-push source](https://github.com/web-push-libs/web-push/tree/v3.6.7) is the dependency review target for 2.3.2; no redirect-following or DNS-safety conclusion is claimed yet.

No runtime push function, notification table, production provider setting, APK or native bundle is changed by this handoff.
