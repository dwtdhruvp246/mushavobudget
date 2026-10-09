# Stage 1 foundations — detailed completion report

**1.6 — Completed 9 October 2026 with carry-forward.** Six planned Stage 1 steps have recorded outcomes. Stage 1 built and checked the audit foundations; it did not clear all security, recovery or release requirements. Remaining failures, uncertainties and decisions stay in the original finding register for the owner's final remediation and full re-audit. No additional 1.2 diagnostic loop is required.

## Scope, environments and evidence

Work was authorized 7 October 2026. Evidence S1E01–S1E99 covers owner configuration/sign-in results, native Windows tool executions, private component summaries, separate staging UI/API checks, synthetic local recovery and production operational screenshots. Evidence sources have different limits; prepared fixtures, reported UI checks and actual native/API results are not interchangeable.

| Target/version | Recorded identity and scope |
|---|---|
| Repository | dwtdhruvp246/mushavobudget; security/stage-1-foundations; draft PR #92. This report is based on prior audit head abcaec92569a8975a31a1a1ba8d8a5c1382efde5 plus this documentation update, not a new production deployment. |
| Production backend | kttkospkblwvguuwnhjj, database postgres, observed PostgreSQL 17.6. Owner verifies hosted identity separately from SQL. |
| Production frontend | Cloudflare Worker mushavobudget, mushavobudget.com, main branch. Active version 162af658 visible; mapping to active source/assets unverified. Reviewed web source 4.9.40 is not proof of the currently served version. |
| Staging | dczlddwbtgvfdujgcitb, observed PostgreSQL 17.11; https://mushavo-budget-staging.pages.dev; prepared frontend source e5b1936847e22a04a3f5fd63785ceed3b4d0f9da. |
| Native recovery | Owner Windows PostgreSQL 17.11, loopback port 55439, protected private folder; local server stopped after successful synthetic drill. |

Private passwords, account recovery material, customer backups, raw rows and hashes remain owner-controlled. None are needed to read this report. APK updating remains deferred and original Windows native edits/signing identity are preserved.

## Step outcomes

| Step | Result | What completion means |
|---|---|---|
| 1.1 Account access/recovery | SCOPED NORMAL SIGN-IN PASS; recovery gaps carried | Four reported protected normal sign-in methods work; broader recovery/admin assurance not cleared |
| 1.2 External protection | VERIFIED DATABASE/ROLE COMPONENTS; STORAGE PACKAGING FAILURE; incomplete platform/offsite recovery | Four bounded outcomes closed; component evidence retained without claiming a complete backup |
| 1.3 Isolated staging | SCOPED UI/API PASSES; wider runtime isolation unverified | Five bounded work items closed; separate synthetic environment established and selected Personal cases tested |
| 1.4 Recovery proof | SCOPED NATIVE RESTORE PASS after correction | Four bounded work items closed; synthetic application restore/adapters tested, full hosted recovery unverified |
| 1.5 Inventory/monitoring/response | PARTIAL INVENTORY; SUPPORT PASS; ALERTS MISSING; RUNBOOKS DOCUMENTED | Four bounded outcomes closed; operational controls still require remediation/exercise |
| 1.6 Closure/report | DOCUMENTATION AND EVIDENCE CONSISTENCY CHECK COMPLETE | Historical evidence and original findings retained; final security/release gates remain open |

### 1.1 — Account access and recovery

Expected: protect infrastructure access and retain independent recovery without exposing codes. Observed S1E01–S1E07: owner normal sign-ins passed for GitHub passkey, Cloudflare email verification code, Supabase authenticator app and Zoho authenticator app. GitHub recovery codes were saved. Cloudflare's initial Google sign-in/enrollment obstacle was followed by email authentication and obtaining recovery codes; persistent storage/alternate-path coverage remains unverified. Supabase backup authentication was owner-reported unavailable; this is not a universal provider capability claim.

Independent recovery drills, alternate identities, organization-wide enforcement, Zoho backup/CPaaS administrator identity and application Admin aal2 enforcement are not established. F08/F19 remain open. The later support receipt is a separate incoming-mail check, not account recovery.

### 1.2 — External database, roles, files and configuration protection

Expected: owner-held recoverable database/file/configuration components, protected storage and integrity evidence. Actual native PostgreSQL clients 17.11 were verified; production session-pooler connection used verify-full TLS and reported TLS 1.3. Native commands replaced the unavailable Docker engine route. Protected local NTFS permissions were limited to owner, SYSTEM and Administrators. The 7-Zip dummy test verified encrypted payload/header protection, wrong-password rejection and matching extracted hashes.

| Component/check | Actual result | Remaining limit |
|---|---|---|
| Database | 2,109,566-byte custom dump; 80 public table-data entries; Auth/Storage metadata present. Three-file encrypted package 566,080 bytes, wrong-password filename protection and all extracted hashes passed. | Completeness beyond recorded scope, coordinated snapshot and full hosted recovery unverified |
| Roles | 6,310-byte export, 16 role definitions, 21 membership grants, one parameter ACL statement; password export disabled. Two-file encrypted package 1,919 bytes; extraction/hashes passed. | Independent credentials and destination managed authority unverified |
| Private metadata reconciliation | Selected role attributes and 21 exported membership flags/grantors match recorded source, excluding three builtin-to-builtin grants. Fifteen role-wide key names match. Full verbose TOC has 2,329 entries including one database definition and one properties entry. | Exact setting/property values, effective parameter ACL semantics, omitted managed grants and recovered behavior unverified |
| Storage bytes | Four buckets/two objects; two downloads, 771,059 bytes, zero failed downloads; before/after inventories and recorded sizes/local hashes match. | Encrypted extraction FAILED with ARCHIVE_EXTRACT_FAILED; cause unconfirmed. No atomic/historical-version/same-point-in-time guarantee |
| Provider configuration | Owner eight-category checklist: six done, Auth partly done, Cron/Vault integrations unsure. | Independently complete/recoverable configuration and credentials/keys unverified |
| Offsite | Google Drive deferred at owner request. | No verified offsite upload/download or independent local-device-loss protection |

Approved objectives: daily and before major changes, 30-day retention, 24-hour RPO, 24-hour RTO, owner completion/failure record and same-day review. They are objectives, not enabled jobs, deletion, alert delivery or measured recovery guarantees. Retain partial artifacts privately. F16 remains open. See the [1.2 report](SECURITY_STAGE_1_2_CHECKPOINT_REPORT.md).

### 1.3 — Separate synthetic staging

Expected: distinct configuration/target before test writes, with synthetic data and controlled destinations. Owner created dczlddwbtgvfdujgcitb, verified fresh scoped counts and the rls_auto_enable event-trigger metadata, then completed native initialization of 51 migrations. The frontend prepared 34 files with production references absent and the production push key removed. Owner confirmed the five configuration items: staging backend/key use and Auth routing/confirmation/provider boundaries, without production Edge secrets copied.

Five owner UI checks passed: first sign-in, saved payment persistence, second sign-in, separate Personal workspace and hidden first-user payment. The actual API script passed twelve checks: deployed staging configuration, two distinct Auth sessions, owner payment/workspace/paid-record reads and same-name update positive control, outsider and anonymous denied reads/no-op updates, and unchanged owner values. Selected denied reads correctly returned empty rows even where HTTP status was 200; status alone was not treated as authorization proof. Test sessions were logged out, synthetic payment retained and credentials/raw identifiers were not printed.

This does not verify insert/delete/RPC/Storage/Family/Business/realtime/email/push/Edge cases or all runtime isolation. F15/F19 remain open. See the [1.3 report](SECURITY_STAGE_1_3_CHECKPOINT_REPORT.md).

### 1.4 — Native synthetic recovery

Expected: actual isolated restore and meaningful integrity/access checks, with substitutions identified. Initial initdb failed because installed server bootstrap files were absent; the owner completed the server component and confirmed the required files. A new protected SCRAM cluster was prepared on loopback and stopped. pgcrypto was available; managed extensions were not.

The staging synthetic public export was 1,330,785 bytes with 80 public table-data and 380 ACL entries. Two synthetic Auth identities, one payment item, one paid record and two Personal workspaces were recorded. Offline payload decoding and private file hashes passed. Separate selected-source checks did not share the dump snapshot or prove all-row drift absence; Auth passwords were not exported.

The first restore/validation transaction failed with query would be affected by row-level security policy for table payment_items. It did not commit and the server stopped. The helper was corrected to restore row_security=on before authenticated role checks, after the dump's session setting. Regression fixtures reproduced the old failure and verified the correction with 51-migration replay, 13 positive checks and relevant negative cases. This retained the intended RLS test rather than bypassing it.

Owner's native corrected run, 9 October 08:17:46 UTC, passed: transaction committed; 13 effective-role access checks; relation/RLS metadata and selected payment/workspace values match; local dummy-file SHA-256 matches; source hashes unchanged; server stopped. The supplied corrected script was pinned to 377b574f83787c5868697706a49fe295032daa31. Eleven seconds measures this scoped drill only.

Adapters were minimal SQL Auth identities/settings, nonlogin nonprivileged managed-role placeholders, local ownership and empty Storage dependencies; one provider TOC entry was excluded. Hosted Auth sessions, actual Storage service/files, original global-role authority, full platform recovery and offsite protection remain unverified. Do not rerun the empty-target helper against the committed target. See the [1.4 report](SECURITY_STAGE_1_4_CHECKPOINT_REPORT.md).

### 1.5 — Production inventory, monitoring and response

Expected: identify running components, failure detection/owner routing, usage boundaries and practical response instructions. Owner screenshots identify the production Worker domain and main branch, six deployed Edge function names and three active Cron jobs. The last visible Cron statuses were Succeeded; asynchronous HTTP/application/delivery outcomes are not proved. Function deployment counts are not current version IDs. A disconnected Git-account warning is visible; live outage or universal deployment failure is not inferred. Audit previews/source parity remain unverified.

Cloudflare account Alerts Overview shows No alerts configured. Consequently no relevant existing sample policy was available to test; automated detection/delivery remains open. The owner reports receipt of the controlled Zoho support test. The screenshot plus owner confirmation is a scoped incoming-support PASS, not Supabase SMTP/customer templates, automated alerts or staffing proof.

Six Free-plan usage values are below displayed quotas: egress 0.23/5 GB, database 46/500 MB, MAU 22/50,000, rounded file storage 0.00/1 GB, log ingestion 0.31/1 GB and Log Query 7.81/100 GB. The cropped image lacks scope and cycle dates; do not assign it solely to production or infer no files. Edge/Realtime and Cloudflare budget coverage remain unverified.

Incident, monitoring, rollback, export/recovery and credential-loss runbooks are documented but not exercised. F18/F19 and full F16 remain open. See the [1.5 report](SECURITY_STAGE_1_5_CHECKPOINT_REPORT.md) and [runbooks](SECURITY_STAGE_1_5_OPERATIONAL_RUNBOOKS.md).

## Remaining action plan and required retests

These are residual actions, not new prerequisites that reopen completed Stage 1 checkpoints. Current-stage fixes may proceed when assigned; unresolved work is consolidated at the end of the audit and fully re-audited as the owner requested.

| Finding(s) | Impact / remaining issue | Action and owner | Required final evidence / timing |
|---|---|---|---|
| F08/F19 | Normal sign-in alone cannot prove independent recovery or accountable response | Owner reconciles private backup factors, identities and recovery routes; both define response coverage | Safe recovery/ownership and operator-runbook evidence; Stage 3 app Admin enforcement plus final remediation |
| F16 | Storage package failed; platform components/settings/keys and coordinated recovery incomplete | Both diagnose retained Storage failure, reconcile complete dependencies and validate realistic isolated recovery | Correct/incorrect-password extraction, private hashes, completeness and application/file/Auth recovery; final remediation |
| F16/F19 | Local-device loss, missed/failed exports and approved RPO/RTO not covered | Owner selects offsite approach when ready; both implement retention/completion/failure controls | Independently verified offsite copy, failed/incomplete-run reporting and realistic measured recovery targets; Google remains deferred |
| F15/F19 | Selected Personal tests leave wider tenant/runtime paths untested | Both extend synthetic direct JWT, RPC, files/events, removed-member and legitimate currency workflow cases | Positive controls and denied/replay/tampering results; Stages 3/7/8 and final re-audit |
| F18/F19 | Git warning, active-version/parity and preview configuration unresolved | Both review intended Git access, actual deployment/source/assets, function authorization and isolated settings | Approved deploy provenance/runtime checks, no production-config leakage; relevant later work/final remediation |
| F19 | No configured Cloudflare policies; other failure detection/delivery and usage scope unknown | Both choose feasible monitors and thresholds; owner verifies controlled destinations and actual review | Sample receipt plus controlled outage/error/backup/dispatch detection, scope-labelled usage; final remediation |
| F06/F18 | Asset/dependency checks do not establish native compile/artifact safety | Both preserve and reconcile Windows changes/tool provenance; owner supplies accepted build/device environment | Actual locked artifact/build/device/protection checks; Stage 5/final re-audit |
| F01–F05/F07/F09–F14/F17/F20 | Remaining privacy, browser, native, commerce, callbacks and push findings remain broader audit work | Follow the original 20-finding carry-forward matrix; no original definition is removed or silently closed | Assigned stages and their original closure criteria, then final full re-audit |

## 1.6 verification and release boundary

This final update changes documentation/evidence only. The prior 93 evidence events, historical 1.1–1.4 progress, all 123 master coverage rows and all 20 original finding definitions are preserved. JSON structure, unique/sequential evidence IDs, report links, finite counts and closure status were checked. Existing narrow Stage 0 repairs and owner native/API results remain in their original scope. No runtime change justifies repeating the native restore or unrelated suites here.

Stage 1 checkpoint work is complete; full platform backup, independent offsite protection, operational alerting, broad tenant/native/store acceptance and final re-audit are not. No production deployment, database restoration, provider-setting change, paid upgrade or audit-PR merge is performed by this report. Stage 0 remains closed with carry-forward. Release gate remains OPEN_PENDING_REQUIRED_EVIDENCE.

**Next stage: 2.1 — browser header baseline.** Stage 2 covers serving-layer browser headers, public contact abuse and Web Push outbound-destination controls. Broader tenant roles and application Admin MFA belong to Stage 3. Each subsequent message retains its active stage.step, and each stage ends with a detailed result/action report.
