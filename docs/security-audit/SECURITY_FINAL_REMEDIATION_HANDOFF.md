# Final-remediation handoff — after Stage 10

**Prepared at 10.4 / S10E06, 13 October 2026. Status: PROPOSED_NOT_EXECUTED.** All bounded audit stages have checkpoint reports with carry-forward. This handoff starts no implementation, deployment, provider/device/store exercise or final re-audit. The release gate is `OPEN_PENDING_REQUIRED_EVIDENCE`; final re-audit is `PLANNED_NOT_PERFORMED`. APK update remains deferred.

The next bounded work is **FR.1**. Prepare the concrete source/export correction and establish the exact accepted staging serving/deployment mapping before a deployment step. Current confirmed observations are three JavaScript URLs returning HTML and five selected source-parity reviews. The cause and installed commit/product remain unverified. No owner SQL, terminal, setup, file-opening or rerun action is required for this handoff.

## Proposed batches and completion evidence

### FR.1 — Accepted source, staging asset delivery and serving/deployment mapping

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Both.

Start with the confirmed three HTML-at-JavaScript responses and five parity reviews. Identify the actual staging serving product/project/channel, accepted source/configuration and artifact; prepare a complete isolated public export and exact correction handoff before deployment.

**Required exit evidence:** Accepted source/artifact/serving mapping; intended Auth/MFA/app routes and script types/content, serving headers and public allowlist rechecked on the accepted staging deployment; no private assets or production configuration access.

**Dependencies:** Current code/source review can begin immediately. Deployment needs exact staging target/configuration and a concrete reviewed handoff; do not guess the serving product or publish the audit branch to production.

**Original findings:** F05, F07, F09, F18, F19. **Existing coordinating actions:** OP-R01, RG-R05, RG-R08.

### FR.2 — Permissions, Admin assurance, Auth and finance integrity

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Both.

Correct Personal workspace binding; finish legitimate relink/deletion and direct tenant/grant tests. Establish recoverable verified Admin operators before enforcement, then test AAL2, Business role/assigned scopes, invitations/removal and allowed/denied callers on exact installed definitions.

**Required exit evidence:** Direct own/other/removed/scoped caller results; legitimate finance and role flows preserved; password/confirmation/recovery/session and Admin step-up/recovery checks; explicit protected versus anonymous/server routine classification.

**Dependencies:** Accepted staging/backend mapping and recoverable controlled actors. Preserve the two manual USD 1 conversions and working operator access; no blanket revokes or sole-factor removal.

**Original findings:** F08, F10, F15. **Existing coordinating actions:** RG-R01, RG-R02, OP-R01, OP-R02.

### FR.3 — Trusted files, deletion/ownership, retention and factual notices

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Owner/Both; developer for implementation.

Resolve operator/audience/territory/data/processor/retention and shared ownership decisions. Implement server-trusted content/size/quota and authorized object access, durable replay-safe deletion/cleanup and approved retention. Publish factual policies only after actual controls and facts are reconciled.

**Required exit evidence:** Actual valid/forged/oversized/unauthorized object tests; owned deletion, shared ownership/retained data and failure/retry cleanup; approved data/retention/audience facts with working public/app/store policy links.

**Dependencies:** Accepted ownership/retention/privacy decisions and isolated service/storage fixtures. Source draft/contract PASS is not policy adoption, content validation or actual deletion evidence.

**Original findings:** F01, F02, F13, F20. **Existing coordinating actions:** DL-R01, DL-R02, DL-R03, DL-R04, DL-R05, DL-R06, UF-R01, UF-R02, UF-R03, UF-R04, UF-R05, UF-R06, PR-R01, PR-R02, PR-R03, PR-R04, PR-R05, PR-R06, RG-R03.

### FR.4 — Protected jobs, monitoring/support, backup/recovery and rollback

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Owner/Both.

Verify actual scheduler-to-HTTP/Edge/business/provider outcomes, automatic rate/history integrity, queue concurrency/retry/terminal history and egress. Establish scope-labelled metrics/budgets, accountable alert/support receipt and private evidence handling. Complete protected database/file/config/key/offsite coverage and realistic fresh isolated recovery; exercise compatible containment/rollback.

**Required exit evidence:** Controlled successful/failing/retry jobs with correct recipients/destinations and history; actual alert/review/support operation; complete protected component artifacts and independent recovery; measured accepted RPO/RTO and compatible operator stop/resume/rollback checks.

**Dependencies:** Accepted OP-D02–OP-D05, recoverable operators/recipients/queues, actual installed definitions and safe approved exercise scopes. Keep the successful prior loopback recovery target stopped; Google offsite deferral is not completed independent protection.

**Original findings:** F08, F12, F15, F16, F18, F19. **Existing coordinating actions:** OP-R02, OP-R03, OP-R04, OP-R05, RG-R01, RG-R05, RG-R08, ND-R05, ND-R08.

### FR.5 — Provider identity, linking, callbacks and actual email rendering/delivery

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Both.

Implement agreed Google/Apple/web/PWA/native identity flows and provider-purpose-aware mail integration where required. Verify actual Go/Supabase templates and contextual escaping, trusted metadata/origins, collisions/linking/invite/recovery outcomes and controlled inbox delivery.

**Required exit evidence:** Controlled provider login/cancel/error, existing-identity/invitation collision/linking and supported callbacks; actual template rendering and inbox receipts; expiry/replay/mismatched identity/unsafe URL denials.

**Dependencies:** Accepted provider/client/domain/audience decisions, functioning factual notices and owner-controlled identities/inboxes. No automatic provider activation or message dispatch follows from this handoff.

**Original findings:** F04, F08, F10, F14, F15, F20. **Existing coordinating actions:** IE-R01, IE-R02, IE-R03, IE-R04, IE-R05, IE-R06, RG-R02.

### FR.6 — Authoritative commerce, entitlements and lifecycle

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Owner/Both.

Choose channel/catalogue/plan/seat mapping and implement actual server provider receipt/signature/webhook verification, durable idempotent ownership/ledger/concurrency controls, entitlement expiry/refund/restore and cross-channel consistency.

**Required exit evidence:** Actual sandbox purchase/receipt/restore/refund/expiry/replay/concurrent ownership outcomes with server-authoritative entitlements; existing manual web/Business flows remain correct.

**Dependencies:** Applicable account/provider/product decisions, exact server/storage/permissions and sandbox identities. No real charges, automatic account creation or store product publication is authorized by the plan.

**Original findings:** F01, F02, F03, F05, F08, F10, F13, F15, F17, F19, F20. **Existing coordinating actions:** CO-R01, CO-R02, CO-R03, CO-R04, CO-R05, CO-R06, CO-R07, CO-R08.

### FR.7 — Final native/device/PWA quality and publisher/store evidence

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Owner/Both.

Reconcile the actual owner-local native project/signing identity without reset; obtain accepted build tools and complete artifacts, secure session/backup and callback/push lifecycle, actual SDK/privacy manifests, representative device/browser/accessibility/performance and account-specific store/beta/reviewer/declaration evidence.

**Required exit evidence:** Final artifact/identity/signing/dependency/SDK inspection and actual device install/Auth/backup/account-switch/push/permission/privacy/PWA checks; measured accepted budgets; truthful final notices/store declarations/listings and required account-specific testing.

**Dependencies:** Earlier implementation and privacy/commerce/identity decisions, actual device/build/account prerequisites and explicit artifact scope. APK update remains deferred until that later concrete authorized work.

**Original findings:** F05, F06, F07, F10, F11, F14, F17, F18, F20. **Existing coordinating actions:** NR-R01, NR-R02, NR-R03, NR-R04, NR-R05, NR-R06, NR-R07, ND-R01, ND-R02, ND-R03, ND-R04, ND-R06, ND-R07, ND-R08, RG-R04, RG-R06, RG-R07.

### FR.8 — Fresh full final audit and accountable release disposition

**Status:** PROPOSED_NOT_EXECUTED. **Owner:** Both; owner release responsibility.

After accepted remediation, rediscover the current tests/scripts, run appropriate full current suites/CI and direct hosted/device/provider/recovery/store requirements against the final exact source, installations and artifacts. Reconcile all original coverage/findings/actions and preserved failures; prepare a concrete reviewable release/rollback/incident package.

**Required exit evidence:** All 123 original coverage rows and 20 definitions have dated exact-scope accepted results or explicit accountable residual disposition; required failures/blockers resolved, final full fresh audit completed, release/rollback/recovery ownership and accepted artifacts documented.

**Dependencies:** Final accepted implementation/deployments/artifacts and required earlier evidence. Old offline PASS or checkpoint closure is not a fresh final audit or publishing authority.

**Original findings:** F01, F02, F03, F04, F05, F06, F07, F08, F09, F10, F11, F12, F13, F14, F15, F16, F17, F18, F19, F20. **Existing coordinating actions:** RG-R08, OP-R06.

## Original findings preserved and mapped

These mappings supplement the original [carry-forward definitions](SECURITY_AUDIT_CARRY_FORWARD.md). Original titles, statuses, owners, actions and recheck text remain unchanged there. Historical baseline statements are dated evidence, not fresh claims about current staging, alerts, accounts or provider plans. No finding is closed by this mapping.

| Original ID | Title | Original status | Proposed batches |
|---|---|---|---|
| F01 | Public policies and support notices | GAP / confirmed missing | FR.3, FR.6, FR.8 |
| F02 | Account deletion and shared ownership | GAP / decision required | FR.3, FR.6, FR.8 |
| F03 | Native subscriptions and billing | GAP / decision required | FR.6, FR.8 |
| F04 | Google/Apple login and linking | GAP / future integration | FR.5, FR.8 |
| F05 | Native release and store readiness | UNSURE / prerequisites absent | FR.1, FR.6, FR.7, FR.8 |
| F06 | Native dependency and asset build | PARTIAL PASS / native unknown | FR.7, FR.8 |
| F07 | Browser security headers | GAP / sampled live failure | FR.1, FR.7, FR.8 |
| F08 | Admin MFA, password and Auth UX | GAP / partial owner PASS | FR.2, FR.4, FR.5, FR.6, FR.8 |
| F09 | Contact/enquiry abuse control | GAP / source finding | FR.1, FR.8 |
| F10 | Native origins and callbacks | UNSURE / conditional | FR.2, FR.5, FR.6, FR.7, FR.8 |
| F11 | Native notifications | UNSURE / native transport | FR.7, FR.8 |
| F12 | Web Push outbound destinations | GAP / source finding | FR.4, FR.8 |
| F13 | Uploads and downloads | GAP / validation needs improvement | FR.3, FR.6, FR.8 |
| F14 | Native sessions and device/cloud backup | UNSURE / native source gap | FR.5, FR.7, FR.8 |
| F15 | Supabase grants, tenant and currency workflows | PARTIAL PASS / wider behavior unsure | FR.2, FR.4, FR.5, FR.6, FR.8 |
| F16 | Database and uploaded-file recovery | KNOWN GAP / recovery unsure | FR.4, FR.8 |
| F17 | Apple privacy manifests and SDKs | UNSURE / artifact missing | FR.6, FR.7, FR.8 |
| F18 | Repository/tool/dependency protection | PARTIAL PASS / supply chain unsure | FR.1, FR.4, FR.7, FR.8 |
| F19 | Staging, monitoring and incident operations | KNOWN GAPS / operations unsure | FR.1, FR.4, FR.6, FR.8 |
| F20 | Collection, privacy and disclosures | GAP / decisions and inventory | FR.3, FR.5, FR.6, FR.7, FR.8 |

## Existing action indexes remain authoritative

| Stage | Existing action families | Entries | State |
|---|---|---:|---|
| 4 | DL / UF / PR | 18 | All OPEN |
| 5 | NR | 7 | All OPEN |
| 6 | IE | 6 | All OPEN |
| 7 | CO | 8 | All OPEN |
| 8 | ND | 8 | All OPEN |
| 9 | RG | 8 | All OPEN |
| 10 | OP | 6 | All OPEN |

The 61 entries coordinate overlapping controls; they do not replace the 20 original findings or 123 coverage rows. Their original definitions remain unchanged. Six OP decisions and eight RG decisions remain unconfirmed; 24 OP and 48 RG grouped cases remain blocked and unrun. Prior scoped positive and failed receipts are preserved.

## Scope for the next step

FR.1 should first review the existing public/staging builders, asset allowlists, Auth/MFA inclusion, frontend overlay and actual serving product/project/channel. Produce an isolated reviewable candidate and an exact target/source/artifact correction handoff. Do not infer that tracked GitHub Pages, a Cloudflare Worker assets configuration and a staging pages.dev endpoint are interchangeable. Accepted deployment and direct follow-up observations must be tied to the precise target. Preparing this handoff does not execute FR.1 or deploy anything.

Retain synthetic actors, the two manual USD 1 conversions, owner-local native/signing work and the stopped successful loopback recovery target. Production mutations remain excluded. Required code will be pasted in full in chat when an owner SQL/terminal action is actually needed. Later dispatch, provider activation, native artifacts, store actions and release disposition need their concrete task scope and applicable authority; no such operation is requested here.

See the [Stage 10 report](SECURITY_STAGE_10_COMPLETION_REPORT.md) and [bounded reconciliation](security-stage-10-final-recheck.json) for exact evidence boundaries. Final implementation and accepted rechecks must be followed by a fresh full final audit of the final source, deployments and artifacts, including unchanged areas and regression evidence.
