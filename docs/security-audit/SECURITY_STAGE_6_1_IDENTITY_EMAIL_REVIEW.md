# 6.1 — Identity and email source review

**12 October 2026 — COMPLETE AT SOURCE/DECISION-INVENTORY SCOPE (S6E01).**
Source pin: `fe2c281ce13e7d0d8cb49115fa1bd6c195579c4e`. **41 freshly fetched selected source/configuration/test files match their current Git blob identities; zero mismatches.** These are source integrity checks, not behavioral security tests. Zero local behavior, hosted Auth/provider/email or device cases ran. No provider/dashboard configuration or actual mailbox was inspected.

[Finite Stage 6 plan](SECURITY_STAGE_6_IDENTITY_EMAIL_PLAN.md) · [Source inventory](security-stage-6-identity-email-source-inventory.json) · [Decisions](security-stage-6-identity-email-decisions.json) · [36-case contract](security-stage-6-identity-email-test-matrix.json) · [Six actions](security-stage-6-remediation-actions.json).

## Current source and preserved history

| Area | Source/evidence observation | Practical implication |
|---|---|---|
| Login | Selected app/sign-up/Auth UI and config paths implement password/email links; no inspected Google/Apple sign-in/link/unlink integration | Planned F04 feature gap, not a failed working social-login test |
| Profile | SQL includes a google signup-source label; profile provisioning uses Auth UUID and defaults missing currency metadata | Label is not provider authentication. Social onboarding must preserve required profile/currency choices and existing identity |
| Email links | Auth controller isolates link sessions, scrubs URL material before async work, validates identity and confirmed email, checks pending Business invitation, requires explicit transfer | Keep these protections. Allowlist currently handles confirm/recover/business-new/business-existing; OAuth needs an intent-bound transaction |
| Admin invitation | Sender targets signup.html?mode=admin-invite; new identity uses invite, unfinished existing identity uses OTP without creating another account; selected completion binds UUID/email/profile invitation | Retain selected plan/currencies and no unintended Free workspace. Existing Admin role/MFA source gates remain |
| Business invitation | Sender uses purpose-specific Auth callbacks and separate new/existing delivery; selected SQL retains explicit acceptance, pending/expiry, subscription/seat/role/scope checks | Authentication is not membership acceptance. Provider/relay collisions require real server tests |
| Other notification mail | Selected reminder/Admin workers use Web Push, and SQL creates queue/in-app notifications | No inspected shared Auth hook or application-email dispatcher; do not call this an implemented email architecture |
| Native | Builder includes Auth resources and bridges App/Preferences; selected entry/selection modules do not establish provider URL handling | Stage 5 credential, callback, origin and artifact actions remain OPEN |

The consolidated SQL and selected migrations were read as source declarations, not installed/executed or reconstructed into a hosted catalog. Later declarations in the consolidated source were considered where present. Full server/provider identity and effective grant parity remains separate evidence.

Prior Stage 0 reports show Google disabled at owner-report scope and Apple disabled at screenshot scope. This step did not recheck their current status. Earlier normal signup/Admin/Business and SMTP correction PASS remains historical owner evidence; it is not a present all-email delivery verdict.

The unchanged 3.5.3 staging receipt reports confirmation enabled, Site URL staging, minimum password eight and prior delivery reported; callback/deployment fields are unknown and separate controlled Auth identities unavailable. The source's proposed new-password minimum is twelve. Carry AU settings/deployment/actors into coordinated acceptance without relabeling or repeating prior tests here.

## Demonstrated template compatibility gap

All four tracked invitation subject/body files classify Business mail only when RedirectTo starts with SiteURL plus **/business.html?invitation=**:

- supabase/templates/invite-user.html and invite-user.subject.txt.
- supabase/templates/magic-link.html and magic-link.subject.txt.

The current Business sender targets **/auth.html?flow=business-new&invitation=...** or **/auth.html?flow=business-existing&invitation=...**. Those routes do not match the tracked Business predicate. If those templates render with the current redirect, they choose generic setup/sign-in wording. This follows from the literal source predicates; no fresh renderer, hosted template or mailbox was exercised.

The Admin existing-identity resend also uses magic-link mail for **/signup.html?mode=admin-invite&invitation=...** but the tracked generic magic-link fallback describes ordinary sign-in rather than guarded setup. Distinguish Admin purpose without weakening its server completion rules.

**6.2 repair scope:** recognize exact supported same-origin current and retained legacy Business routes in both subject and body; preserve generic magic-link fallback, guarded Admin setup, genuine ConfirmationURL semantics and safe escaped wording. Test malformed/lookalike/external/wrong-purpose redirects and consistency. Source changes do not install dashboard templates: deployed subject/body and actual saved allowlist need separate reconciliation. Confirmation/recovery/reauthentication/email-change templates are not represented by these four files.

Supabase documents distinct Auth purpose templates and hosted template settings; checked-in HTML does not prove dashboard installation. [Official template variables/configuration](https://supabase.com/docs/guides/auth/auth-email-templates).

## Google configuration and transport

Keep Google as login-only owner intent. The proposed design uses only identity/profile scopes; it does not request Drive, Gmail or unrelated offline Google API access. Supabase's Google guide separates Google client JavaScript origins and the provider-to-Supabase callback from the application's final redirect allowlist. Register environment-specific owned/authorized origins, clients/audience and exact callbacks; no client secrets in frontend files. [Supabase Google guide](https://supabase.com/docs/guides/auth/social-login/auth-google), [redirect configuration](https://supabase.com/docs/guides/auth/redirect-urls).

Google prohibits authorization in a developer-controlled embedded user-agent. Native transport needs a permitted system/native/browser flow and verified return, not simply loading the Google authorization page inside the finance WebView. Google production OAuth policy also calls for an owned verified homepage with app description and privacy/terms links. Existing unpublished Stage 4 privacy review is not evidence that those requirements are satisfied. [Google OAuth policies](https://developers.google.com/identity/protocols/oauth2/policies).

Bind each provider or linking attempt to the intended operation/environment, state/nonce/verifier and initiating identity where applicable. Handle cancellation, expired/replayed material, concurrent tabs and unexpected account changes. A successful SDK call/mock does not establish genuine provider token validation or safe native verifier delivery.

## Linking, relay and onboarding

Supabase documents server automatic same-email identity linking and removal of unconfirmed identities when a new identity can link, plus authenticated manual linking of different-email identities when enabled. This is actual Auth server behavior to verify; frontend email equality is not sufficient. Manual linking/settings and the exact pinned SDK/server capabilities remain prerequisites. [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking).

Preserve the original Auth UUID and its financial records, memberships, subscriptions and remembered selections. Test verified/unverified same-email collisions, existing provider accounts, changed emails, link/unlink/recovery and unfinished Admin invitations. Do not create a second finance identity and silently merge it by email.

For Business, selected invitation SQL matches invitee UUID **or server JWT email**. A verified Apple relay address can differ from the real email an owner invited. That is an unresolved invitation/linking case, not permission to reveal the hidden address or merge accounts using caller metadata. Prefer a deliberate authenticated linking/re-invitation design with server-authorized identity binding; preserve cancellation, expiry, roles, assigned scopes and seats. On first social login, retain the required currency choices rather than silently accept provisioning defaults as the designed onboarding outcome.

## Apple decision and email relay

Apple guideline 4.8 requires an equivalent login option with specific privacy properties when third-party/social login authenticates the primary account, subject to listed exceptions. **Proposed:** Sign in with Apple alongside Google for the iOS primary-account flow. This is a design recommendation, not a newly confirmed owner choice or blanket claim that every app must use Apple. A Business workspace inside a consumer budgeting app does not itself establish the enterprise-account exception; that applicability is an inference requiring the actual login product facts. [Current guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#login-services).

Verify actual Apple App/Services IDs, capability, audience, selected web/native integration and nonce handling. Apple's name availability differs across first and later authorizations; do not overwrite a valid profile when absent. Web OAuth secret maintenance differs from native-only flow; plan applicable expiry/rotation and private key recovery. [Supabase Apple guide](https://supabase.com/docs/guides/auth/social-login/auth-apple).

Register actual outbound sources and verify sender authentication for Apple private relay, including the provider's real envelope/From/DKIM domains. Historical Zoho domain verification/SMTP success is not Apple relay registration or controlled relay delivery evidence. [Apple private relay configuration](https://developer.apple.com/help/account/capabilities/configure-private-email-relay-service).

## Shared email architecture boundary

Retain the working SMTP route initially. Supabase per-purpose templates can address source wording without activating a new mail transport. A future **Send Email Hook replaces built-in/SMTP delivery when enabled**; it is not a second passive route. Review raw-body signature/timestamp checks, action allowlists, old/new email recipient-token mapping, bounded failure/duplicate handling, sensitive-log exclusion and restoration before activation. [Official Send Email Hook behavior](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook).

Propose shared visual/template conventions with two delivery responsibilities: Auth-controlled security mail; server-authorized application event mail. Application mail needs durable claim/retry/dedup, server-derived recipient/tenant/event, dispatch-time membership rechecks, recipient/global budgets, bounce/suppression/preferences, monitoring and approved retention. Do not put Auth tokens/full links into ordinary shared event queues, analytics or operational receipts. Provider API acceptance and mailbox delivery are different evidence.

Sender/mailbox choices and actual provider operations remain unconfirmed. The assigned support address remains a monitored-contact requirement from prior owner decisions; this step creates no addresses or accounts. Stage 8 still owns native push/device event work; Stage 1/10 owns operational recovery, Stage 4 owns factual disclosure/retention dependencies.

## Contract, actions and handoff

The six acceptance groups each contain six planned cases: IE01 providers, IE02 linking/invitations, IE03 purpose/callbacks, IE04 Apple/relay, IE05 Auth delivery/hook, IE06 application mail/rollout. **36 planned grouped cases, zero run.** They overlap AU/AM/NR requirements; do not count them as 36 additional unique global controls or provider tests performed.

Six OPEN action entries IE-R01–IE-R06 reference existing findings; none creates a new finding definition. Known Google intent and SMTP preservation are retained. Apple/transport/clients/sender/event/rollout facts remain proposed or unconfirmed, explicitly recorded without inventing a decision.

**6.1 complete; next 6.2 candidate/local verification; full Stage 6 report due at 6.4.** Stages 0–5, all historical receipts, original 123 coverage rows/20 definitions and the release gate are preserved. No behavioral tests, account/fixture/Auth/Storage/SQL/settings/provider/email/job/deployment/native/production change; no finding closure. Two synthetic manual conversions remain unchanged. APK update stays deferred.

No owner SQL/terminal or file-opening action is required for this source-review step.
