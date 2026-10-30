> Latest checkpoint FRE152: owner Windows Edge short diagnostic **36/36 PASS**, exit 0; final route audit 0 unexpected requests and cleanup verified. Local browser scope complete; no N rerun needed. Prior failed route remains unidentified. See [Batch N completion](SECURITY_FR_2_4_BATCH_N_COMPLETE.md). Hosted browser/PWA acceptance remains pending.

# Batch N — Windows119/120 stop, exact manifest dependency and safe route review

23 October2026. Main Stage3 Authorization and Admin MFA remains current. Owner run pin0c4582594f53d32e2e4c544276b6bee63109cf93, Node22.17.0/win32/Edg155.0.4283.62,188hashes/39syntax:120checks,119PASS,1FAIL, combined exit1. All89retained regressions and10protocol/TLS tests passed. The first20browser security-behavior checks passed. Only LOCAL_FIXTURE_NO_UNREVIEWED_ROUTE failed at2026-10-23T11:21:45.387Z. Raw source receipt is security-fr-2-email-batch-n-owner-review-required.json; the coarse outer wrapper receipt is retained separately.

The browser, temporary synthetic profile and HTTPS fixture all reported cleanup complete. The outer wrapper's cleanup-may-require-inspection flag was a generic phase-based catch, not a contradictory failed cleanup readback. No extra browser cleanup, reinstall, real-email request or hosted containment is indicated. No private packet/credential input or staging request/mode change occurred. The last hosted state remains the prior Batch M owner QUARANTINED result; N is not a fresh hosted-state observation.

## Known boundary and concrete fixture omission

The fixture incremented an unexpected counter and returned404 for at least one request. It retained no route identity, so the exact path and original count are unknown. Do not label an unknown request harmless, whitelist a guessed browser URL or claim full N acceptance.

Source review independently found actual offline.html contains a manifest link /manifest.webmanifest?v=5, while the fixture's exact-source map omitted that asset. The correction serves **the repository's exact manifest.webmanifest bytes** with application/manifest+json. Its bytes are now pinned; a real loopback HTTPS fixture test verifies content and MIME. This is an explicitly reviewed document dependency, not a wildcard allowance. It is a plausible explanation for an additional Edge request, but the original receipt does not establish it as the cause. Other unmatched routes remain404/failing.

## Safe route diagnostics

The fixture records up to16 distinct unreviewed summaries: fixed probe_tag, SHA256 of pathname only, method/destination enums, query_present boolean and count. Fixed labels identify a bounded list of public diagnostic paths; **classification does not permit those routes**. Everything unrecognized is UNCLASSIFIED plus its path hash. Raw URL/host/path/query/headers/body, credentials and identifiers are omitted. Additional distinct requests are counted as overflow without retaining more entries. Duplicate summaries aggregate counts.

Close the owned browser and HTTPS listener first, then snapshot this audit and perform the existing final route guard. This covers late lifecycle requests; a nonzero count remains a failing21st browser check. No acceptance guard is removed or relaxed. Safe receipt adds browser.route_audit; its count/entries are sufficient for the next bounded review. An empty audit on a new run does not reconstruct the historical failed request.

## Validation and short owner run

Local full125/125 =89retained +15CDP/TLS/fixture/audit +21actual Chromium checks. Short mode36/36 =15changed fixture/audit tests +21actual Chromium checks. Both verify190source hashes and40syntax checks, Node24.19.0/Linux/HeadlessChrome153.0.8010.0; no unexpected request in these local runs; browser/profile/listener cleanup verified. Five new audit tests cover redaction/schema, recognized-but-denied probes, duplicate grouping, bounded overflow and the post-cleanup audit order. Exact manifest content/MIME are asserted in the existing fixture test. Actual Windows Edge result remains pending.

Use the same temporary published-source workflow and installed Edge/Chrome, adding --route-diagnostic. Skip the89unchanged regressions already accepted in the owner's receipt, while rechecking hashes/syntax and all15changed fixture tests before replaying21synthetic engine checks. No dependency installation, token/password/code, packet, real mail, SQL or staging window. Only possible prompt remains the full path to an EXISTING msedge.exe/chrome.exe if standard-path discovery fails. The isolated headless profile and in-memory localhost certificate are generated solely for synthetic tests and cleaned up; no real keys/configuration or normal browser profile are changed. Certificate bypass is limited to the child, not system settings; hosted TLS/CSRF and installed-PWA OS lifecycle acceptance remain unproven.

If Edge repeats an unmatched request, the diagnostic correctly returns exit1 with the safe audit; send it once for inspection rather than repeatedly rerunning. If no unmatched requests occur, it can return36/36/exit0; review the resulting receipt before claiming Windows N completion. No production/native/APK work, original findings closure, full hosted acceptance, Stage3 completion or launch approval is inferred.
