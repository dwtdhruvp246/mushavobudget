# Stage 2 completion report — Browser, contact and outbound-request hardening

**2.4 — Closed 10 October 2026 with scoped passes and failed/blocked/unverified carry-forward.** Four of four planned stage steps have recorded outcomes. This is completion of the bounded audit checkpoint; **F07, F09 and F12 remain open**, and the release gate remains open. Final remediation includes production promotion and missing checks, followed by the full fresh re-audit requested by the owner.

## Scope, targets and versions

Stage 2 ran 9–10 October 2026 after the Stage 1 foundations checkpoint. It covered browser headers/HTTPS entrypoints, public Contact abuse controls and the three Web Push senders. It did not repeat backups, configure Google offsite copies, update native/APK artifacts, replace production credentials or certify store compliance.

| Target/component | Reviewed identity/version | What actually changed |
|---|---|---|
| Audit branch | security/stage-2-web-hardening, draft PR #93 stacked on the unmerged Stage 1 branch | Source candidates, diagnostics, tests and reports; no PR merge |
| Web/PWA source | Existing 4.9.40 source; no version bump for this server-only push change | Contact/header candidates were staged; no production web promotion |
| Staging web/Supabase | mushavo-budget-staging.pages.dev / dczlddwbtgvfdujgcitb | Owner deployed headers/contact frontend, submit-enquiry, its gate and two private secrets |
| Actual Supabase | kttkospkblwvguuwnhjj; owner inventory PostgreSQL 17.11 at 2026-10-10T12:12:32.673918+00:00 | Push inventory was read-only; no push rows/functions modified on the hosted project |
| Contact repair/acceptance source | 6ba621d718d1b989aaa84aa486d8f0b098b792a3 | Byte-preserving builder and exact live asset checks; selected owner acceptance passed |
| Push source candidate | 4643482f1bcfc0751560f3562b85a344055ed78d | Shared destination guard and integration in all three senders; source only, not deployed |
| Local verification | Node 24.19.0; Deno 2.9.6; web-push 3.6.7; esbuild 0.28.2 | Synthetic fixtures/request doubles and native negative connection checks; not the hosted Edge runtime |

No actual endpoint URLs, subscription keys, customer rows or private credentials are included in this report. The project labels in SQL do not prove hosted identity; owner Dashboard selection is the identity boundary.

## 2.1 — Browser security headers and HTTPS

**Expected:** Compatible baseline headers on actual served assets; selected app flows continue working; HTTP entrypoints upgrade to HTTPS with paths/queries preserved. Strict resource CSP and deliberate blocking require separate acceptance.

**Observed scoped passes — S2E05–09/S2E12:**

- Fifteen selected local candidate/handoff/isolation checks passed.
- Owner prepared and deployed the isolated staging candidate.
- Twelve staging responses were sampled at 2026-10-09T13:11:46.610777+00:00: eleven successful document/asset responses and the canonical app.html to /app 308 redirect. All twelve carried the seven expected header families; selected script/style MIME types passed.
- Staging configuration and signup inline-script hash checks passed. Baseline CSP enforces object/base/form/frame limits. Resource-loading CSP remains **report-only**.
- Owner workflow checks 1–4 passed: public/shell pages, first-user sign-in/payment persistence, second-user Personal separation, and available download/print/logo-preview controls.
- The selected Chromium extension-channel Console error did not recur in the owner's follow-up. This supports the extension explanation; it does not establish complete cause or an error-free browser.

**FAIL — S2E10–11:** The owner reported Always Use HTTPS off and three HTTP samples returned 200 with no redirect: root, app with a dummy query and business. HTTPS app returned 200 as a positive control. These are the latest recorded samples, not a claim about every hostname or an independently observed provider change.

**Prepared correction, deferred:** A production apex hostname-scoped 301 redirect preserving the path/query is retained in the 2.1 handoff. No production rule was deployed during this stage. Strict CSP, deliberate frame/injection blocking, all routes/cache states, production header parity and broad browser/native coverage remain unverified. **F07 stays open.**

## 2.2 — Public Contact abuse controls

**Problem:** Anonymous and signed-in clients originally had effective direct INSERT grants on six enquiry columns, allowing browser controls to be skipped.

**Candidate behavior:** Contact uses a bounded submit-enquiry Edge endpoint, validates the real Turnstile response server-side, then calls a service-only database gate. The gate serializes quota checks and insertion in one transaction: three per normalized email/hour, ten globally/minute and sixty globally/hour. Counter subjects use a private HMAC. Ordinary table/column INSERT and gate access are revoked. Staff policies and queue/normalization triggers are preserved in source; hosted staff behavior is not yet proved.

**Actual changes and repairs — S2E15–30:** Owner deployed the staging function/gate, saved its two private secrets and uploaded the staging frontend. The first preparation incorrectly decoded UTF-8 Git output through PowerShell text; the prepared files and served JavaScript failed exact candidate parity. Node Buffer extraction and fingerprint checks corrected the preparation path. Native Windows repair, preserved config/public key and repaired upload were owner-reported. Historical mismatch evidence remains; the later exact served-file pass supersedes only that parity scope.

**Observed passes — S2E31–33:**

| Check | Expected | Observed and scope |
|---|---|---|
| Config, contact assets and selected headers | Staging-only exact reviewed files and baseline CSP/challenge allowances | PASS in pinned owner API batch |
| Preflight/origin/input/challenge | Allow staging preflight; deny missing Origin, admin field, oversize and missing/forged token | 204 / 403 / 400 / 413 / 400 / 400 respectively |
| Ordinary-client bypass | Deny direct INSERT, gate RPC and quota reads for anon and signed-in client | PASS for both roles; checker requires permission error 42501, not a generic login failure alone |
| Existing test session | Verify session and log out only that API test session | PASS |
| Normal form saves | Exactly three matching expected new website enquiries, one test email | Owner read-only count PASS |
| Fourth same-email attempt | Limit message and retained fields | Combined owner screenshot/count evidence supports scoped PASS |

The API batch completed at **2026-10-10T11:01:44.974Z**, **18 checks PASS**, exit 0. The separate form count was checked at **2026-10-10T11:27:49.725825+00:00**. Screenshot verification Success is not an independent proof of all provider/hostname/replay cases.

Forty-five focused contact/header/preparation tests previously passed; provider/permission cases use mocks. Prior unchanged Edge bundling and SQL/PLpgSQL parsing passed. These are distinct from the later forty-five push checks.

**UNVERIFIED:** Blank-required-field outcome; actual concurrent requests, global quotas and rollback; consumed-token/wrong-host checks; independent widget key ownership; staff queue/access and email/push dispatch. No successful form batch is repeated to obtain another screenshot. Production rollout is deferred to final remediation and must coordinate the production widget, secrets/function, gate and frontend. **F09 stays open.**

The [contact checkpoint report](SECURITY_STAGE_2_2_CHECKPOINT_REPORT.md) contains the finer evidence limits.

## 2.3 — Web Push outbound destinations

### 2.3.1 inventory — COMPLETE, metadata scope

The owner ran the four-row production read-only inventory at **2026-10-10T12:12:32.673918+00:00**. RLS is enabled and forced. Anonymous endpoint INSERT is denied; authenticated endpoint INSERT is allowed; authenticated endpoint UPDATE is denied. There are **zero total/active/disabled subscriptions**, no family rows and zero shape counts.

An empty inventory neither identifies current provider compatibility nor proves that future stored destinations are safe. No endpoints or keys were returned, no rows changed and no notifications sent. The original three senders accepted stored endpoint strings without an application destination guard.

### 2.3.2 candidate — PASS in stated local scope

The source candidate adds supabase/functions/_shared/push-destination.mjs and routes send-test-push, dispatch-push-reminders and dispatch-admin-notifications through it.

The guard rejects malformed/non-HTTPS addresses, credentials, fragments, encoded/Unicode authorities, nonstandard ports, private literals and host lookalikes. It admits explicit Google/Mozilla hosts and bounded Apple/Microsoft provider subdomains using documented compatibility references; admission is not proof of real delivery, especially for legacy endpoints. Opaque provider path/query bytes and keys are preserved.

A per-send HTTPS Agent rejects any invalid/private/special-use DNS answer, including mixed public/private answers. The connection consumes that same vetted result rather than doing a separate preflight resolution. Environment proxies are explicitly disabled, TLS certificate verification and provider servername are explicit, and the Agent is disposed after every send. DNS/socket/whole-send timeouts are 3/10/15 seconds.

The pinned library already rejects 301/302/303/307/308 without following Location; it was not replaced for an invented redirect defect. Policy-blocked destinations are retired without network delivery. Existing provider 404/410 retirement, temporary failures and outbox success/retry/permanent result choices are preserved in the executed fixtures. No automatic duplicate retry was added.

**Validation — S2E36:** Forty-five selected Node checks passed: seventeen new guard/three actual entrypoint fixtures, sixteen existing selected regressions, and twelve full pinned-package transport cases. The latter exercise actual encryption/VAPID/request creation with synthetic keys; positive/status responses are request doubles. The native Agent rejects a private DNS result before provider connection.

The transport checks also passed in local **Deno 2.9.6** with network permission limited to loopback. This probe exposed automatic environment proxy use; explicit proxyEnv disabling corrected that route. Earlier local permission stops are not production failures. Three Edge entrypoints bundled; npm imports were external in that syntax/bundle check. The repository package manifest/lock and SDK version pins were not changed.

**Limit:** Local Deno is not proof of the project's hosted runtime, actual DNS/TLS/network route or device/provider delivery. The guard remains a GitHub source candidate.

### 2.3.3 hosted acceptance — BLOCKED/UNVERIFIED, carried forward

A fresh read-only staging config GET at **2026-10-10T12:37:49.726Z** returned 200, the staging reference and no production reference. Its **vapidPublicKey is empty**; no value was printed or code evaluated. The isolated site's device-registration prerequisite is missing. Production has no existing subscription sample, and production sending is not used as a substitute.

Record a bounded BLOCKED/UNVERIFIED outcome. Do not launch a new key/cron/device setup sequence merely to extend this checkpoint. Real provider delivery, deployed Edge parity/compatibility, hosted DNS/proxy/TLS controls and retry/duplicate behavior remain final remediation checks. **F12 stays open.**

## Carry-forward action plan

| Finding | Remaining problem/impact | Action and owner | Required final evidence |
|---|---|---|---|
| F07 | Production HTTP upgrade failed in three samples; strict/production browser defenses unproved | Owner deploys reviewed hostname redirect and approved header candidate; developer refines strict CSP after compatibility review | HTTP same-host HTTPS Location preserves path/query; production served headers; safe deliberate frame/injection blocking; app/Auth/realtime/download/browser regressions |
| F09 | Candidate protects staging Contact; production protection and selected quota/challenge/staff behaviors unproved | Developer/owner coordinate production widget, Edge secrets/function, service-only gate and frontend; test remaining cases in isolated staging | Allowed enquiry; ordinary direct bypass denials; blank validation; concurrency/global boundaries/rollback; replay/wrong-host denial; authorized staff access/dispatch and denied outsider access |
| F12 | Source guard tested locally; hosted runtime/provider compatibility and real retries unproved | Developer/owner configure one isolated push test setup during final remediation, deploy candidate there before approved production promotion | Real subscription/delivery on supported providers; unsafe URL/DNS/redirect/proxy cases blocked before egress; expiry/temporary/partial success and retry behavior without unintended duplicate delivery |
| F20 | New Turnstile processing must join the factual processor/privacy inventory | Developer inventories actual data/retention; owner confirms operator/audience; address in Stage 4 | Factual privacy/processor disclosures matching actual deployed behavior and later store declarations |

All earlier findings, Stage 0/1 limits, Google offsite deferral and original **123 coverage / 20 finding definitions** remain intact. No finding closes simply because this stage ended. No production promotion, PR merge, APK build, secret rotation or broad customer-data export was performed.

## Stage outcome and next step

**Stage 2 checkpoint: COMPLETE WITH CARRY-FORWARD.** Scoped passes, the failed HTTPS samples and blocked/unverified hosted checks are kept separate. The audit remains on track under the owner's finite-stage process; this is not an all-PASS security or release approval.

Next is **3.1**, the Stage 3 authorization baseline and bounded test plan: Personal/Family/Business role boundaries and application Admin MFA. Final production promotion occurs in the agreed final remediation pass, followed by a full fresh audit of the final deployed source and artifacts.
