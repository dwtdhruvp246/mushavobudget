# Stage 2.3 — Web Push outbound destinations

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
