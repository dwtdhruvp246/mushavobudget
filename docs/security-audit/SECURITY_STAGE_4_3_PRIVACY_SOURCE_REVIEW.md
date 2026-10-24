# Stage 4.3.1 — Factual privacy and data-flow source review

Recorded 11 October 2026. Evidence **S4E08**. Source pin: `29b6c1cffeb4f9c38cad446c931fe1d1a9583ee2` on `security/stage-3-authorization`.

**Outcome: source review complete; one of three bounded 4.3 milestones complete.** This is a factual inventory and acceptance contract, not a published privacy policy, a retention approval, legal compliance certification, hosted acceptance or store submission. Next **4.3.2** prepares a reviewable candidate and meaningful local checks. **4.3.3** records one controlled owner/hosted outcome or BLOCKED. The full Stage 4 report remains due at **4.4**.

## Scope and evidence limits

[Machine-readable source inventory](security-stage-4-privacy-source-inventory.json) records **96 exact Git blob SHA-1 matches, zero mismatches**, including **53 SQL sources** (schema plus 52 migrations), 11 root HTML pages, seven Edge entrypoints and selected handlers/helpers, client modules, dependencies, hosting configuration and native packaging source. These are source observations; counts are not behavioral tests or deployed-schema/provider configuration proof.

No dedicated privacy/terms/account-deletion page filename or tracked Android/iOS platform project/Capacitor configuration was identified in the selected current tree. This does not establish a fresh hosted 404, exclude remotely configured resources or inspect the owner's local native projects/final release binaries. Earlier hosted privacy/analytics observations remain historical evidence. No fresh browser/network/provider/dashboard/SQL/Auth/Storage inspection or local behavioral test ran in 4.3.1.

4.1 and 4.2 remain **CLOSED WITH CARRY-FORWARD**, with hosted acceptance BLOCKED and respectively zero of 25 and zero of 30 grouped cases run. This review does not change their receipts, original 123 coverage rows, original 20 findings or Stage 0–3 outcomes.

## Data categories and flows

This inventory describes data the service source can process, not a dump of actual customers or a claim that each field is populated for every account. Authentication credentials and session secrets belong in service/security disclosures; no secrets were read or requested. Files/freeform text can contain data beyond structured field labels.

| ID / category | Source fields | Purpose / destination | Limit |
| --- | --- | --- | --- |
| DF01 — Account, profile and authentication | account UUID; full name; email; country; signup/invitation linkage; locale/timezone/currency preferences; Auth credentials/session and conditional staff MFA state | Sign-in, recovery, account administration and workspace preferences. Supabase Auth/DB; browser session storage behavior; staff MFA interaction where enabled | Auth/settings/MFA deployment and provider log retention unverified; no new credential or factor read performed |
| DF02 — Personal and Family financial records | payment names; amounts/currencies; due/repeat schedules; paid-by/recorded-by identities; notes/references; cashbook links; currency conversion history | Budgeting, reminders, accounting views and reports. Supabase DB; authorized workspace UI and generated exports | Full authorization/derived-workspace/history and hosted release parity remain open |
| DF03 — Family membership and invitations | member names; user/member identifiers; invitation email; role/status; head/member approvals; join/leave/removal history | Shared workspace access, invitations and attribution. Supabase DB/Auth mail; relevant owner/member views | May concern people entered or invited by another user; Family feature does not establish a child-directed audience |
| DF04 — Business identity, contacts and branding | legal/trading name; industry; registration country/number; tax number; contact email/phone; website; address JSON; logo path; financial period preferences | Business setup, branding and reporting context. Supabase DB/Storage; permitted Business UI | Business workspace legal name is not necessarily the Mushavo service operator |
| DF05 — Business operations and roles | suppliers/contacts; bills/payments; employee claims/receipts; transactions/income; budgets/requests/approvals; categories/dimensions; roles/scopes; actor/audit attribution | Business finance operations, approvals and scoped reporting. Supabase DB/Storage; intended authorized Business participants | Complete hosted role/scoped/staff matrix remains unverified; organizations can enter third-person information |
| DF06 — Uploaded proofs, documents and logos | file bytes; original names; MIME/size; bucket/path; uploader/workspace/parent identifiers; signed-link capabilities | Proof/receipt attachment, registration and branding. Four source-private Supabase buckets and DB metadata; permitted downloads | Actual content may contain financial/contact/other sensitive information beyond named form fields; trusted processing and durable cleanup remain open |
| DF07 — Subscription, billing and administration | plan/seats/expiry; quotes/invoices/receipts; manual payment amount/method/date/reference; review decisions; proof linkage; entitlement/audit history; administrative support notes | Access entitlement, manual subscription review and operational support. Supabase DB/Storage; authorized billing owners/staff | No complete native-store or external card/payment integration inventory is established; freeform proofs can contain payment data |
| DF08 — Public enquiries and anti-abuse state | full name; email; country; enquiry type/message; challenge token transiently; HMAC email quota key; quota windows/counts | Contact/support/sales handling and abuse prevention. Form payload to Supabase Edge/DB; browser signals and challenge token to Cloudflare Turnstile | Handler forwards secret/token, not the enquiry body or explicit remote IP, to Siteverify. HMAC is linkable/pseudonymous. Old quota windows are deleted during invocation; this is not a guaranteed two-hour maximum or enquiry-message retention period |
| DF09 — Support tickets, messages and email | customer/creator/assigned staff identifiers; workspace link; subject/description; category/priority/status; message bodies; internal-note flag; timestamps | Customer support and resolution history. Supabase support tables and Auth transactional mail; operator support inbox outside app | support@mushavobudget.com is source-published. Privacy-duty assignment, mailbox retention and current SMTP provider configuration are not established by source |
| DF10 — First-party account-linked analytics | user UUID; UTC hour_start; last_seen_at; profile last_active_at; signup country/source and financial aggregates in admin views | Usage/registration/engagement and operational analytics. Supabase analytics_activity_hours/profiles; administrative aggregates | app.js records visible online activity with a 50-minute local throttle; SQL has one row per user/hour. User-linked underlying rows are not anonymous. No matching Business heartbeat was identified in business.js, no general analytics choice/withdrawal or timed analytics purge was identified in selected source |
| DF11 — Push subscriptions and notification delivery | user UUID; endpoint; p256dh/auth subscription keys; device label; user-agent; delivery/failure/disabled timestamps; notification titles/bodies/targets | Optional payment/administrative reminders and device delivery management. Supabase DB/Edge and browser-specific Web Push service; operating-system notification surface | Detailed previews can include payment name/amount/currency. Notification permission does not establish consent for unrelated analytics. Complete current payload, endpoint/provider, revocation and native transport evidence remains pending |
| DF12 — Browser/device persistence and application shell | SDK session state; per-user selected workspace/family identifiers; savedAt preference timestamp; push opt-in preference; install/update state; static shell cache | Signed-in sessions, startup restoration, optional notifications and PWA reliability. Browser local/session or isolated memory storage depending flow; native Preferences when packaged; service-worker static caches | Preferences are not proven encrypted secure storage. Source cache exclusions do not prove every deployed/native cache or full post-deletion device cleanup |
| DF13 — Audit, diagnostics, infrastructure and backup copies | actor/action/status/time; support/admin audit metadata; selected error/status logs; provider request/network metadata potentially retained externally; database/role/Storage backup artifacts | Security, operational diagnosis, attribution and recovery. App DB and operator/provider logs/backups; exact enabled sinks unknown | Source logging and observability declaration do not establish provider log fields/regions/retention. Earlier backup work is incomplete; no universal delete-all-copies or fixed expiry promise |
| DF14 — Reports, downloads and user-directed exports | selected financial report rows; business report CSV; administrative finance CSV; printed/downloaded receipts and documents | User-requested finance reporting and external use. Downloaded files, print/PDF/browser output and recipients chosen outside the app | The operator cannot promise automatic recall or deletion of copies already downloaded by authorized users |

Exact source references for each category are in the linked inventory. Shared Family/Business records can concern invited members, employees, suppliers or other people entered by another user. Intended workspace roles and access rules must be reconciled with genuine hosted authorization; neither organizational control nor a Family label supplies a complete privacy/audience decision.

## Providers and runtime components

The following **ten components are not ten distinct companies, processors or contracts**. Roles, subprocessors, regions, transfers and retention require actual configuration and contract review. Build tools/framework dependencies are distinguished from services receiving runtime requests.

| ID / component | Observed status / data | Unverified facts |
| --- | --- | --- |
| TP01 — Supabase Auth/Postgres/Storage/Edge/Realtime | IDENTIFIED_IN_SOURCE. Account, finance, memberships, support, analytics, files and operational data | Actual projects/regions, contracts, subprocessor/log/backup retention, SMTP handoff and deployed settings |
| TP02 — Cloudflare hosting/edge/observability | SOURCE_AND_PRIOR_HOSTING_EVIDENCE. Served pages and infrastructure request/diagnostic metadata depending actual configuration | Final Pages/Workers configuration, request/log fields, retention/regions and administrative access |
| TP03 — Cloudflare Turnstile | IDENTIFIED_CONTACT_INTEGRATION_SOURCE. Browser/security signals; transient Siteverify challenge token. Own handler does not forward enquiry body | Deployed widget modes, pre-clearance/ephemeral settings and provider roles; provider documentation identifies both service protection and improvement processing |
| TP04 — Cloudflare Web Analytics | HISTORICAL_HOSTED_OBSERVATION_CURRENT_NOT_RECHECKED. Prior injected beacon; actual deployed performance/usage fields and pages must be verified | Current injection/configuration/network traffic and choice/retention treatment. Separate from account-linked SQL analytics |
| TP05 — Transactional/support email; Zoho previously owner-selected | AUTH_MAIL_SOURCE_PROVIDER_CURRENT_UNVERIFIED. Recipient email, invitation/recovery/confirmation message/link; support messages submitted to inbox | Actual SMTP provider/sender/region/log/mailbox retention and monitored privacy contact; selection is not configuration proof |
| TP06 — Browser Web Push providers | ALLOWLISTED_SOURCE_NOT_ACTUAL_CURRENT_ENDPOINT_INVENTORY. Push endpoint/delivery metadata and encrypted Web Push transport; raw payload generated by app server | Used Google/Mozilla/Apple/Microsoft endpoint families, contracts, lifetimes, payload previews, native distinction and account-switch/deletion behavior |
| TP07 — CurrencyAPI | IDENTIFIED_SERVER_RATE_FETCH_SOURCE. Server request/API credential and rate endpoint/date; currencies are used for response normalization; no user/finance payload identified in rate fetch | Deployed scheduler/provider settings, account/request log retention and actual outgoing request shape |
| TP08 — jsDelivr/esm.sh and package registries | IDENTIFIED_REMOTE_CODE_DELIVERY_AND_BUILD_DEPENDENCIES. Remote module/code requests; infrastructure metadata for browser CDN requests; build dependency delivery | Final bundled versus remote runtime delivery, provider request handling, precise SDK versions and supply chain. Build-only tools are not automatically data processors for user finance |
| TP09 — Capacitor native framework/App/Preferences/Android | TRACKED_PACKAGES_AND_BUNDLING_INTENT_ONLY. Native workspace preference and app-state APIs; exact final packaged SDK behavior unknown | Actual Android/iOS release manifests, plugins, permissions, privacy manifests, storage/logging and store labels; native projects/config absent from selected tracked tree |
| TP10 — Operator backup destinations and exported copies | HISTORICAL_PARTIAL_BACKUP_EVIDENCE_NOT_CURRENT_PROVIDER_COMPLETE. Database/role/Storage records or user-generated report copies depending workflow | Complete actual destinations/accounts/regions, encrypted handling, access, lifetime and deletion/recovery limitations. Deferred Google Drive work is not proof of active automated customer backup |

### Facts that constrain notice wording

- **First-party usage data is account-linked.** `app.js` records visible, online signed-in activity through `record_my_analytics_activity`, with a 50-minute client throttle. SQL stores UUID/hour activity rows and profile last-active timestamps. Aggregated administrative display does not make underlying UUID rows anonymous. Selected source did not reveal a general analytics choice/withdrawal switch or timed analytics purge. No matching Business heartbeat was identified in `business.js`; do not claim uniform collection on all surfaces.
- **Hosting analytics is separate.** Earlier Cloudflare-injected beacon evidence is retained under F20; no current hosted injection/settings check ran here. The SQL analytics comment about no device/page details concerns that table, not all app/provider data. `wrangler.jsonc` declaring observability does not establish deployed request logging or its fields/retention.
- **Contact processing has two paths.** The public enquiry payload goes to Supabase Edge/DB. The handler forwards its Turnstile secret and challenge response token to Siteverify, without explicitly forwarding the enquiry body or remote IP. Cloudflare's browser challenge can independently process network/device/security signals. The normalized-email HMAC quota key remains linkable/pseudonymous. Old quota windows are deleted during invocation when older than two hours; idle records may remain, and this does not define enquiry-message retention.
- **Email configuration is not proven by source.** `support@mushavobudget.com` is the published contact fallback. Previous owner selection of Zoho and normal-mail evidence do not establish current Auth SMTP settings, sender/region or mailbox retention. Whether this inbox accepts monitored privacy requests needs confirmation.
- **Push previews can disclose finance details.** Subscription storage includes endpoint/keys, account UUID, device label and a user-agent field. Detailed previews can carry payment name, currency and amount onto the notification surface; generic previews are an alternative source path. Allowed Google/Mozilla/Apple/Microsoft push hosts are not an inventory of currently used providers. Web Push transport encryption does not make the whole finance application end-to-end encrypted. Notification permission is not consent for unrelated analytics.
- **Authentication/device persistence is flow-specific.** Ordinary Supabase clients, isolated invitation Auth helpers and entry restoration have different storage behavior. Native Preferences and browser storage are not proven encrypted secure storage. Static service-worker cache exclusions do not establish every deployed/native cache or post-deletion cleanup. Selected SDK/CDN versions and build packages are pinned in the inventory; final binaries/plugins/permissions remain uninspected.
- **Finance/payment content needs honest wording.** Uploaded proofs, Business tax/contact/address fields, support text and manual subscription records can contain personal or financial data. No complete external card/native-store integration was established, but this cannot justify “we collect no payment data.” CurrencyAPI's selected server rate fetch contains no identified user/finance payload; actual outgoing requests/provider logging still need verification.
- **Deletion cannot promise recall of external copies.** Support/audit foreign-key behavior, shared-workspace attribution and incomplete backup recovery remain linked to 4.1. Authorized CSV, print/PDF and downloaded copies are outside automatic recall. Existing file guards remain client-scoped; trusted processing and durable cleanup remain linked to 4.2.

No implementation, deployed provider switch, analytics disabling, notice publication or retention schedule is implied by this review.

## Owner facts and decisions still required

| Topic | Known / unresolved |
| --- | --- |
| Operator | Actual individual/business operating the service and its country are unconfirmed. A customer's Business legal name is not the service operator. |
| Privacy contact | Confirm a monitored address and responsibility for requests. Source-published support email alone is insufficient duty assignment. |
| Audience | Confirm minimum account age and whether minors may own accounts. No assumed 18+ rule or new age gate is adopted. |
| Territories | Preserve the existing worldwide plan; identify any excluded countries and map applicable requirements before adoption. |
| Purposes / collection controls | Confirm necessary versus optional collection, first-party analytics intent, hosting telemetry, provider purposes and any required consent/withdrawal behavior. |
| Retention | Adopt category-specific grounds, periods or criteria, expiry/deletion behavior and exceptions. The eight prior 4.1 decision categories are still unapproved; no blanket duration is invented. |
| Providers / organizational control | Confirm actual regions/contracts/subprocessors, email delivery, log/backup retention and shared-workspace responsibilities; source company names do not settle legal roles. |
| Final mobile release | Inspect actual native binaries/configuration, SDK data flows and future Google sign-in before final store labels. Google push endpoints are not Google account login. |

These facts can be gathered without sending passwords, tokens, full private links, inbox contents or customer records. Any later SQL/terminal step must be supplied in full in chat, pinned and scoped, followed by “Send me the result after it finishes.”

## Frozen privacy acceptance contract — 25 planned grouped cases

**PR01–PR05 each contain five cases; zero cases have run.** Grouping includes relevant browser/native/workspace/provider variants; it is not a claim of exactly 25 HTTP requests. Actual artifacts and expected/observed results must distinguish source, local, owner-reported, hosted and device evidence.

### PR01 — Operator and collection facts

1. Confirmed operator/privacy contact and launch audience/territories.
2. Per-surface actual fields and affected users/non-users.
3. Required versus optional collection with valid alternative paths.
4. Purpose and recipient/control allocation for Personal/Family/Business.
5. Owner-adopted facts replace every unresolved placeholder without unsupported promises.

### PR02 — Processors, SDKs and transfers

1. Actual Supabase/email regions/contracts/subprocessors and configuration.
2. Cloudflare hosting/Turnstile/Web Analytics deployed settings and distinct signals.
3. Actual push providers/payloads/device metadata and delivery handling.
4. CDN/runtime rate-fetch requests distinguished from build-only dependencies.
5. Final Android/iOS SDK/permission/WebView and future Google-login data inventory.

### PR03 — Retention and user controls

1. Category-specific approved grounds/period/expiry and minimization.
2. Analytics lifecycle and genuine implemented choice/withdrawal where needed.
3. Enquiry/support/mail and HMAC quota expiry behavior under inactivity.
4. Account/shared-file/backup deletion with factual retained copies and limits.
5. Privacy contact/request identity verification and actual bounded fulfillment workflow.

### PR04 — Notices and user surfaces

1. Public privacy/terms/support/deletion resources have working intended responses.
2. Public/signup/authenticated/Business/native notices and links are accessible.
3. Version/effective date/operator/purpose/processor/retention text agree with adopted facts.
4. Required prominent disclosure/consent precedes processing and withdrawal works.
5. Subscription, proof/freeform-content, exports and lock-screen notice claims match behavior.

### PR05 — Evidence and release consistency

1. Genuine browser/device network/storage/telemetry capture matches frozen inventory.
2. Implemented choices control all applicable collection across roles and regions.
3. Play Data safety classifications use actual collection/sharing criteria.
4. Apple App Privacy linked-data/tracking classifications use final release SDK behavior.
5. Owner adoption, monitored contact and final artifacts preserved without premature store submission.

## Six OPEN privacy actions

These actions refine the existing findings; they do not redefine or close them. Primarily F01/F20, with F02/F13 and earlier F08/F15 dependencies. DL-R01–DL-R06 and UF-R01–UF-R06 remain OPEN.

| Action | Required work | Evidence for completion | Finding dependencies |
| --- | --- | --- | --- |
| PR-R01 | Confirm the actual operator legal identity/country, monitored privacy contact, account minimum age/minors treatment and exclusions from the worldwide launch plan; map applicable obligations. | Adopted owner facts and audience/territory decisions; no assumed age threshold or legal identity. | F01/F20 |
| PR-R02 | Reconcile actual fields, purposes, required/optional collection, third-person records, shared-workspace recipients and deployed providers/regions/contracts/SDKs. | Browser/device network and storage inventory plus provider configuration/contract summaries; source and historical observations alone are insufficient. | F01/F20/F02 |
| PR-R03 | Adopt and implement category-specific retention, minimization and expiry; reconcile account/shared-file/support/audit/provider/backup copies with DL and UF actions. | Approved category decisions and verified idle/active expiry, deletion and retained-copy behavior; no universal two-hour or immediate all-copy erasure claim. | F01/F02/F13/F20 |
| PR-R04 | Resolve account-linked analytics and hosting telemetry disclosure and implement any required choice/consent/withdrawal; review push user-agent/device data and detailed lock-screen previews. | Actual collection before/after choices across applicable surfaces/roles/regions; notification permission is not consent for unrelated collection. | F20/F01 |
| PR-R05 | Prepare factual privacy/terms/support/deletion notices and consistent accessible public/signup/authenticated/Business/native links after facts and capabilities are adopted. | Working public resources, version/effective date, monitored privacy-request handling and text matching actual retention/security/deletion behavior. | F01/F20/F02/F13 |
| PR-R06 | Inspect final Android/iOS SDKs, plugins, permissions, privacy manifests, WebView and future Google sign-in; prepare accurate Play Data safety and Apple App Privacy classifications. | Actual release binary/configuration/network evidence and store-specific criteria; package declarations or first-party analytics alone do not establish sharing/tracking classifications. | F01/F20/F08/F15 |

## Primary requirements checked

Checked 11 October 2026. These are platform/provider requirements and classification inputs, not a determination of every applicable privacy law or a store acceptance result.

- [Google Play User Data](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en): notices must describe operator/contact, collection/use/sharing, security, retention and deletion, with an accessible active public policy URL. Unexpected sensitive collection can require an in-app prominent disclosure and consent.
- [Play Data safety definitions](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en): assess actual app/SDK/WebView collection and recipient handling; service-provider exceptions depend on the defined role.
- [Apple App Review privacy](https://developer.apple.com/app-store/review/guidelines/#privacy) and [App Privacy details](https://developer.apple.com/app-store/app-privacy-details/): accessible factual notices and final app/SDK collection disclosures are required; linked data and tracking use distinct criteria. First-party usage records alone do not establish Apple-defined tracking.
- [Turnstile overview](https://developers.cloudflare.com/turnstile/) and [Privacy Addendum](https://www.cloudflare.com/turnstile-privacy-policy/): browser challenge signals include IP/TLS/user-agent/sitekey/origin; protection and service-improvement roles differ. Widget/cookie behavior depends on actual settings.
- [Cloudflare Web Analytics collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/): performance beacons are a separate flow. Provider privacy claims do not establish anonymity of Mushavo's account-linked SQL rows.

## Bounded continuation and reporting

| Milestone | Result / next work |
| --- | --- |
| 4.3.1 | COMPLETE AT SOURCE SCOPE — 96 hash matches, 14 categories, ten service components, five frozen groups/25 planned cases, six OPEN actions. |
| 4.3.2 | NEXT — reviewable factual candidate/decision structure and meaningful local checks; unresolved owner facts remain explicit. No invented promises or live publication. |
| 4.3.3 | PENDING — one controlled owner/hosted outcome or BLOCKED, without extending the setup loop. |

Stage 4 still has **two of four main steps closed with carry-forward**; 4.3 and 4.4 remain. No local behavioral tests, hosted HTTP/catalog/SQL/Auth/Storage/provider checks, emails/jobs, live account/file/settings changes, deployment or native build ran. Preserved synthetic accounts, Personal/Family fixtures, inactive former member and the two USD1 manual conversions were not changed. Production `kttkospkblwvguuwnhjj` remains excluded; staging is `dczlddwbtgvfdujgcitb`.

F01/F20 and all other existing findings remain OPEN. Continue to **4.3.2**; full Stage 4 checkpoint/report at **4.4**, then final remediation and full re-audit under the existing plan.
