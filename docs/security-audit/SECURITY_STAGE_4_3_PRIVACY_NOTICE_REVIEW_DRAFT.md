# Mushavo Budget — privacy notice review candidate

**REVIEW ONLY — NOT ADOPTED, NOT PUBLISHED, NO EFFECTIVE DATE.**

This internal candidate separates owner-reported facts from source observations and unresolved implementation/legal decisions. It is not a customer-facing notice or release approval.

## Operator and contact

Owner reports the operator as **Dhruv Parekh**, based in **Zimbabwe**. Entity type: INDIVIDUAL; registered business: no, owner-reported.

Owner assigns **support@mushavobudget\.com** for privacy requests. Mail delivery, identity verification and actual request fulfillment remain separate evidence requirements.

## Audience and territories

Owner intent: no account age restriction. Child accounts/data are possible. This does not certify lawful unrestricted child access or parental-consent safeguards.

Prior launch intent: worldwide. Country exclusions: UNCONFIRMED; an empty list is not approval of all countries. Applicable territory obligations remain subject to review.

## Data and purposes — source observations

| ID / category | Source fields | Source purpose / destination | Limitation |
| --- | --- | --- | --- |
| DF01 / Account, profile and authentication | account UUID; full name; email; country; signup/invitation linkage; locale/timezone/currency preferences; Auth credentials/session and conditional staff MFA state | Sign\-in, recovery, account administration and workspace preferences / Supabase Auth/DB; browser session storage behavior; staff MFA interaction where enabled | Auth/settings/MFA deployment and provider log retention unverified; no new credential or factor read performed |
| DF02 / Personal and Family financial records | payment names; amounts/currencies; due/repeat schedules; paid\-by/recorded\-by identities; notes/references; cashbook links; currency conversion history | Budgeting, reminders, accounting views and reports / Supabase DB; authorized workspace UI and generated exports | Full authorization/derived\-workspace/history and hosted release parity remain open |
| DF03 / Family membership and invitations | member names; user/member identifiers; invitation email; role/status; head/member approvals; join/leave/removal history | Shared workspace access, invitations and attribution / Supabase DB/Auth mail; relevant owner/member views | May concern people entered or invited by another user; Family feature does not establish a child\-directed audience |
| DF04 / Business identity, contacts and branding | legal/trading name; industry; registration country/number; tax number; contact email/phone; website; address JSON; logo path; financial period preferences | Business setup, branding and reporting context / Supabase DB/Storage; permitted Business UI | Business workspace legal name is not necessarily the Mushavo service operator |
| DF05 / Business operations and roles | suppliers/contacts; bills/payments; employee claims/receipts; transactions/income; budgets/requests/approvals; categories/dimensions; roles/scopes; actor/audit attribution | Business finance operations, approvals and scoped reporting / Supabase DB/Storage; intended authorized Business participants | Complete hosted role/scoped/staff matrix remains unverified; organizations can enter third\-person information |
| DF06 / Uploaded proofs, documents and logos | file bytes; original names; MIME/size; bucket/path; uploader/workspace/parent identifiers; signed\-link capabilities | Proof/receipt attachment, registration and branding / Four source\-private Supabase buckets and DB metadata; permitted downloads | Actual content may contain financial/contact/other sensitive information beyond named form fields; trusted processing and durable cleanup remain open |
| DF07 / Subscription, billing and administration | plan/seats/expiry; quotes/invoices/receipts; manual payment amount/method/date/reference; review decisions; proof linkage; entitlement/audit history; administrative support notes | Access entitlement, manual subscription review and operational support / Supabase DB/Storage; authorized billing owners/staff | No complete native\-store or external card/payment integration inventory is established; freeform proofs can contain payment data |
| DF08 / Public enquiries and anti\-abuse state | full name; email; country; enquiry type/message; challenge token transiently; HMAC email quota key; quota windows/counts | Contact/support/sales handling and abuse prevention / Form payload to Supabase Edge/DB; browser signals and challenge token to Cloudflare Turnstile | Handler forwards secret/token, not the enquiry body or explicit remote IP, to Siteverify\. HMAC is linkable/pseudonymous\. Old quota windows are deleted during invocation; this is not a guaranteed two\-hour maximum or enquiry\-message retention period |
| DF09 / Support tickets, messages and email | customer/creator/assigned staff identifiers; workspace link; subject/description; category/priority/status; message bodies; internal\-note flag; timestamps | Customer support and resolution history / Supabase support tables and Auth transactional mail; operator support inbox outside app | support@mushavobudget\.com is source\-published\. Privacy\-duty assignment, mailbox retention and current SMTP provider configuration are not established by source |
| DF10 / First\-party account\-linked analytics | user UUID; UTC hour\_start; last\_seen\_at; profile last\_active\_at; signup country/source and financial aggregates in admin views | Usage/registration/engagement and operational analytics / Supabase analytics\_activity\_hours/profiles; administrative aggregates | app\.js records visible online activity with a 50\-minute local throttle; SQL has one row per user/hour\. User\-linked underlying rows are not anonymous\. No matching Business heartbeat was identified in business\.js, no general analytics choice/withdrawal or timed analytics purge was identified in selected source |
| DF11 / Push subscriptions and notification delivery | user UUID; endpoint; p256dh/auth subscription keys; device label; user\-agent; delivery/failure/disabled timestamps; notification titles/bodies/targets | Optional payment/administrative reminders and device delivery management / Supabase DB/Edge and browser\-specific Web Push service; operating\-system notification surface | Detailed previews can include payment name/amount/currency\. Notification permission does not establish consent for unrelated analytics\. Complete current payload, endpoint/provider, revocation and native transport evidence remains pending |
| DF12 / Browser/device persistence and application shell | SDK session state; per\-user selected workspace/family identifiers; savedAt preference timestamp; push opt\-in preference; install/update state; static shell cache | Signed\-in sessions, startup restoration, optional notifications and PWA reliability / Browser local/session or isolated memory storage depending flow; native Preferences when packaged; service\-worker static caches | Preferences are not proven encrypted secure storage\. Source cache exclusions do not prove every deployed/native cache or full post\-deletion device cleanup |
| DF13 / Audit, diagnostics, infrastructure and backup copies | actor/action/status/time; support/admin audit metadata; selected error/status logs; provider request/network metadata potentially retained externally; database/role/Storage backup artifacts | Security, operational diagnosis, attribution and recovery / App DB and operator/provider logs/backups; exact enabled sinks unknown | Source logging and observability declaration do not establish provider log fields/regions/retention\. Earlier backup work is incomplete; no universal delete\-all\-copies or fixed expiry promise |
| DF14 / Reports, downloads and user\-directed exports | selected financial report rows; business report CSV; administrative finance CSV; printed/downloaded receipts and documents | User\-requested finance reporting and external use / Downloaded files, print/PDF/browser output and recipients chosen outside the app | The operator cannot promise automatic recall or deletion of copies already downloaded by authorized users |

These source descriptions do not adopt a lawful ground, retention duration, required/optional classification or complete recipient authorization.

## Providers — source and historical evidence

Ten components are not ten distinct companies or legal processors. Runtime, historical hosting observations, build dependencies and incomplete backup evidence must retain their separate scope.

| ID / component | Observed evidence | Pending facts |
| --- | --- | --- |
| TP01 / Supabase Auth/Postgres/Storage/Edge/Realtime | IDENTIFIED\_IN\_SOURCE / Account, finance, memberships, support, analytics, files and operational data | Actual projects/regions, contracts, subprocessor/log/backup retention, SMTP handoff and deployed settings |
| TP02 / Cloudflare hosting/edge/observability | SOURCE\_AND\_PRIOR\_HOSTING\_EVIDENCE / Served pages and infrastructure request/diagnostic metadata depending actual configuration | Final Pages/Workers configuration, request/log fields, retention/regions and administrative access |
| TP03 / Cloudflare Turnstile | IDENTIFIED\_CONTACT\_INTEGRATION\_SOURCE / Browser/security signals; transient Siteverify challenge token\. Own handler does not forward enquiry body | Deployed widget modes, pre\-clearance/ephemeral settings and provider roles; provider documentation identifies both service protection and improvement processing |
| TP04 / Cloudflare Web Analytics | HISTORICAL\_HOSTED\_OBSERVATION\_CURRENT\_NOT\_RECHECKED / Prior injected beacon; actual deployed performance/usage fields and pages must be verified | Current injection/configuration/network traffic and choice/retention treatment\. Separate from account\-linked SQL analytics |
| TP05 / Transactional/support email; Zoho previously owner\-selected | AUTH\_MAIL\_SOURCE\_PROVIDER\_CURRENT\_UNVERIFIED / Recipient email, invitation/recovery/confirmation message/link; support messages submitted to inbox | Actual SMTP provider/sender/region/log/mailbox retention and monitored privacy contact; selection is not configuration proof |
| TP06 / Browser Web Push providers | ALLOWLISTED\_SOURCE\_NOT\_ACTUAL\_CURRENT\_ENDPOINT\_INVENTORY / Push endpoint/delivery metadata and encrypted Web Push transport; raw payload generated by app server | Used Google/Mozilla/Apple/Microsoft endpoint families, contracts, lifetimes, payload previews, native distinction and account\-switch/deletion behavior |
| TP07 / CurrencyAPI | IDENTIFIED\_SERVER\_RATE\_FETCH\_SOURCE / Server request/API credential and rate endpoint/date; currencies are used for response normalization; no user/finance payload identified in rate fetch | Deployed scheduler/provider settings, account/request log retention and actual outgoing request shape |
| TP08 / jsDelivr/esm\.sh and package registries | IDENTIFIED\_REMOTE\_CODE\_DELIVERY\_AND\_BUILD\_DEPENDENCIES / Remote module/code requests; infrastructure metadata for browser CDN requests; build dependency delivery | Final bundled versus remote runtime delivery, provider request handling, precise SDK versions and supply chain\. Build\-only tools are not automatically data processors for user finance |
| TP09 / Capacitor native framework/App/Preferences/Android | TRACKED\_PACKAGES\_AND\_BUNDLING\_INTENT\_ONLY / Native workspace preference and app\-state APIs; exact final packaged SDK behavior unknown | Actual Android/iOS release manifests, plugins, permissions, privacy manifests, storage/logging and store labels; native projects/config absent from selected tracked tree |
| TP10 / Operator backup destinations and exported copies | HISTORICAL\_PARTIAL\_BACKUP\_EVIDENCE\_NOT\_CURRENT\_PROVIDER\_COMPLETE / Database/role/Storage records or user\-generated report copies depending workflow | Complete actual destinations/accounts/regions, encrypted handling, access, lifetime and deletion/recovery limitations\. Deferred Google Drive work is not proof of active automated customer backup |

## Decisions required before a factual public notice

- Adopt required/optional collection, purpose/grounds, recipient/access and retention/expiry decisions for every data category; verify the actual implementation.
- Reconcile account-linked analytics and Cloudflare telemetry; do not claim all usage rows are anonymous or that push permission covers unrelated processing.
- Resolve child-data consent/safeguards and accurate target-audience declarations; no adult-only rule or universal child-consent exemption is invented.
- Verify current provider settings, contracts, regions/transfers, mail and log/backup lifetimes.
- Verify privacy-request identity/fulfillment and deletion/shared-file/backup behavior; downloaded or printed copies cannot be promised automatic recall.
- Prepare legally sufficient operator disclosures, factual terms/support/deletion resources and consistent accessible links; inspect final native SDKs/store data labels.

## Publication blockers

| Code | Action | Required evidence |
| --- | --- | --- |
| CONTACT\_WORKFLOW | PR\-R05 | Owner\-assigned contact is not verified privacy\-request delivery/fulfillment\. |
| TERRITORIES | PR\-R01 | Country exclusions or applicable\-obligation mapping remain unconfirmed\. |
| CHILDREN | PR\-R01 | No\-age\-restriction intent leaves child data/consent safeguards unresolved\. |
| DATA\_DF01 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF02 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF03 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF04 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF05 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF06 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF07 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF08 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF09 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF10 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF11 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF12 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF13 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| DATA\_DF14 | PR\-R03 | Collection/grounds/retention/access decision and implementation evidence incomplete\. |
| PROVIDER\_TP01 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP02 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP03 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP04 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP05 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP06 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP07 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP08 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP09 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| PROVIDER\_TP10 | PR\-R02 | Actual provider role, configuration, contract, region/transfer or retention evidence incomplete\. |
| OPERATOR\_DISCLOSURE | PR\-R01 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| REGIONAL\_OBLIGATIONS | PR\-R01 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| CHILDREN\_SAFEGUARDS | PR\-R01 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| COLLECTION\_CHOICES | PR\-R04 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| PRIVACY\_REQUESTS | PR\-R05 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| DELETION\_RETENTION\_IMPLEMENTATION | PR\-R03 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| PUBLIC\_LINKS | PR\-R05 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| NATIVE\_STORE\_LABELS | PR\-R06 | Required decision/capability evidence is unresolved or owner\-adopted only\. |
| INDEPENDENT\_ACCEPTANCE | PR\-R05 | Offline declarations require independent owner/hosted/device review; this tool cannot authorize publication\. |

No public policy, legal compliance, universal sharing/tracking classification, deployed security/consent/retention/deletion feature, email verification, store acceptance or fixed rights-response deadline is established by this internal draft.

Stage 4.3.3 records one owner/hosted outcome or BLOCKED. Full Stage 4 report remains due at 4.4.
