# Stage 2.2 — Public contact checkpoint report

Closed 10 October 2026 at **2.2.3**, with scoped passes and unverified carry-forward. All three planned contact work items now have outcomes; none remains in this checkpoint. **F09 remains open** for production rollout and the final acceptance gaps. The detailed report for all of Stage 2 is due at **2.4**.

## Problem and resulting behavior

Ordinary anonymous and signed-in clients originally had direct INSERT grants on six enquiry columns, allowing callers to bypass browser validation. The staging candidate routes Contact through submit-enquiry: a bounded Edge request validates Turnstile, then a service-only database function checks quotas and inserts in one transaction. Direct table/column INSERT bypass grants and ordinary-client gate execution are revoked. Existing staff read/update policies and queue/normalization triggers are preserved in source; their hosted behavior remains unverified.

The source implements three enquiries per normalized email/hour, ten globally/minute and sixty globally/hour. Quota identities use a private HMAC and the function serializes checks/insertion with a transaction advisory lock. The normal same-email limit has owner evidence; source locking is not an actual concurrency or rollback test.

## Results and evidence

| Check | Outcome | Evidence and limit |
|---|---|---|
| Local candidate and preparation checks | PASS, selected local scope | 45 focused tests previously passed; provider/permission tests use mocks. Prior Edge bundling and SQL/PLpgSQL parsing passed. No new application change in this closure. |
| Staging endpoint, gate and secrets | Owner-confirmed setup | S2E19/S2E21: function deployment, migration success and two private secrets saved. Secret values were not received. |
| UTF-8 preparation defect | Corrected in tested scope | S2E27–30: original local/live JavaScript differed from reviewed bytes; Node Buffer extraction replaces PowerShell text decoding. Native repair preparation and repaired upload were owner-reported. |
| Deployed staging config, exact contact files and selected headers | PASS | S2E32: pinned checker confirms staging isolation, exact reviewed JavaScript/HTML and baseline CSP/Turnstile allowances. |
| Origin, malformed/admin fields, size and challenge denials | PASS, selected API cases | Missing origin 403; administrative field 400; oversized 413; missing/forged challenge 400; preflight 204. Not all host/replay/provider cases. |
| Anonymous and signed-in bypass prevention | PASS, selected live cases | Direct INSERT, submission RPC and quota read denied for both ordinary roles. Checker requires permission error 42501; a generic authentication failure alone does not pass. |
| Test session handling | PASS | Existing staging user session verified; only API test session logged out. |
| Ordinary enquiry saves | PASS, combined owner scope | S2E31: three expected matching new website rows and one test email; raw enquiries not returned. |
| Fourth attempt and field retention | PASS, combined owner scope | S2E31 image shows verification Success, enquiry 4, the quota message and retained fields. The crop has no URL and the email is clipped. |
| Blank required fields | UNVERIFIED | No owner outcome supplied; successful saves do not prove this check. Carried forward without another successful form batch. |
| Concurrency, rollback, global quotas, challenge replay/host binding, staff access/dispatch | UNVERIFIED | No controlled hosted proof; source/mock checks do not substitute. |
| Production promotion and full F09 acceptance | OPEN | This closure does not deploy or merge the candidate. |

The API receipt completed at **2026-10-10T11:01:44.974Z**: STAGING_CONTACT_API_SCOPED_PASS, **18 checks PASS**, exit 0 and no problem code. The separate read-only saved-row receipt was checked at **2026-10-10T11:27:49.725825+00:00**. Historical failed parity receipts remain in the evidence trail and are superseded only by the later exact-file scope.

## Final remediation actions

1. Coordinate production Edge/secrets, real widget/allowed host, service-only database gate and frontend rollout; review approval before promotion, then rerun ordinary/denied production acceptance.
2. Check required fields and a controlled wrong-host/consumed-token replay pair.
3. Exercise email/global quota boundaries, concurrent requests and failed-insert rollback in isolated staging. Confirm denied requests create no rows or inconsistent counters.
4. Confirm authorized staff queue/read/update behavior, ordinary-client denial and any actual email/push dispatch in an isolated safe destination.
5. Retain the existing synthetic rows/receipts; do not repeat the successful three-save batch just to obtain another screenshot.

Production HTTP redirect failure remains **F07**. Strict resource CSP remains report-only. Turnstile privacy review belongs to the later privacy stage. Google offsite work, native packaging and full platform recovery retain their earlier limits.

Next: **2.3.1**, the Web Push source/destination inventory. Its three finite items are inventory, justified guard/local tests and one bounded controlled acceptance or carry-forward. Then **2.4** closes Stage 2 with its detailed report.
