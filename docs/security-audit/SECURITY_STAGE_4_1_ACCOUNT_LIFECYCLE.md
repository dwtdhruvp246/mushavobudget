# 4.1 — Account deletion, shared ownership and retention source review

**4.1.1 COMPLETE at source scope — 11 October 2026, S4E01.** Reviewed baseline `70b34a545a81db983e1030a90e3b26d3419621da`. No account deletion workflow or public deletion resource was identified in the selected tracked source. Existing Business ownership transfer, family deletion and inactive membership removal do not erase an Auth account.

Next is **4.1.2**, review-only candidate/data-decision/preflight preparation and meaningful local checks. The full Stage 4 report stays at **4.4**. F02 remains OPEN; F01/F20 disclosure and F08/F15 identity/authorization dependencies remain.

## Evidence scope

Reviewed eight selected app/signup/Auth/public HTML pages, their selected controllers, all seven current Edge entrypoints, cumulative `supabase/schema.sql` and 52 ordered migration files for selected lifecycle definitions. The 53 local SQL files match their pinned Git blobs. The [source inventory](security-stage-4-lifecycle-source-inventory.json) records seven latest selected migration routines and **38 Auth-user reference declarations across 24 selected CREATE TABLE blocks**: ten CASCADE, 17 RESTRICT, nine SET NULL and two implicit NO ACTION.

These are selected **source declarations**, not 38 effective final/hosted constraints or a complete data-lineage catalog. ALTER TABLE, conditional DDL, policies, triggers and transitive/provider effects need a final dependency-aware comparison. The inventory's literal absence scans are bounded review evidence. No live route/HTTP, hosted catalog/Auth/Storage, modeled DB, deletion, provider or device test ran in 4.1.1.

No runtime file, constraint, privilege, settings, account/fixture/password/factor, Storage byte, provider state, deployment or native bundle was changed.

## Current behavior and concrete gaps

| Area | Source observation | Practical consequence |
|---|---|---|
| App/public account deletion | No account-deletion copy/link in eight inspected pages; no identified deletion filename/entrypoint; seven inspected Edge entrypoints contain no Auth admin deleteUser call | Missing reviewed initiation, verified self-request, completion/retry and public resource; source gap, not a fresh hosted 404 result |
| Personal/household identity | budget_workspaces.owner_id and workspace_members.user_id declare RESTRICT; families.owner_id and payment item/record actor/owner references include CASCADE | Direct Auth deletion may be blocked; indiscriminate removal of blockers can erase linked shared finance. Actual hosted effects untested |
| Household removal | remove_family_member marks membership inactive; synchronization maintains generalized membership | Access removal is not account or personal-data deletion |
| Household ownership/deletion | delete_family_workspace deletes the owner's families row; legacy workspace family FK cascades; no dedicated guarded household ownership-transfer RPC identified in review | Transfer-versus-closure behavior and shared record/file consequences need explicit design; no Auth deletion follows |
| Business member removal | Latest remove_business_member in custom-role migration checks role-assignment rules, clears overrides/scopes and marks member inactive | Preserve current role/Owner protections; inactive row still references Auth user and is not erasure |
| Business ownership | transfer_business_ownership changes owner/member roles with name confirmation, active subscription/member/account checks and pending-payment guard; old owner becomes Business Admin | Ownership transfer does not remove old Auth identity/membership/finance attribution/files; expired/suspended/no-successor/pending-payment paths need a deletion-specific resolution |
| Platform Business recovery | admin_business_transfer_owner checks super role, expected owner/version, recipient email and request idempotence; demotes old owner to Viewer, removes overrides/scopes and writes audit/support/notifications | Privileged recovery is distinct from ordinary account deletion; retain Stage 3 MFA/actor/parity/recovery blockers |
| Support/finance/file actors | Cashbook creators/reversers, ticket authors, Business document/claim/bill/income/support actors and submitted proof uploader references include RESTRICT; quote/purchase owner references include implicit NO ACTION | A generic cascade or delete-all-UUID recipe is not a retention-aware workflow |
| Nulling and copied identity | Some author/invitee references declare SET NULL while invitation/profile/audit/text fields can still contain names/email | Removing the FK alone is not de-identification; copied identity must be inventoried and treated explicitly |
| Selected file cleanup | Client payment/item/family deletion obtains proof paths from loaded state, deletes DB first, then calls Storage API; some failures warn admin cleanup is needed | Preserve truthful warning behavior; no identified durable account-wide manifest/retry/reconciliation job, and loaded state is not proof of complete file enumeration |
| Auth/session/provider cleanup | No deletion-specific worker or access-token/refresh/signed-URL/provider/device acceptance identified | Do not claim immediate global logout, complete file removal or third-party deletion from a deleted app row |

The family client can report successful family/database deletion separately from file failure. Its initial confirmation says family data will be permanently removed; a complete deletion contract must account for files, copied identity, audit/backups and actual retained records. This is a source review target, not proof a live file was orphaned.

## Selected reference examples

| Data group | Declared example | Review decision |
|---|---|---|
| Profile/notifications/push/activity | profiles.id, notifications.user_id, push_subscriptions.user_id, analytics_activity_hours.user_id CASCADE | Classify own identity/telemetry and confirm actual removal and any provider/log copies |
| Legacy Family/payments | families.owner_id, payment_items owner/creator, payment_records owner/recorder CASCADE | Define owner closure, other-member consequences and finance preservation before destructive action |
| Generalized ownership/membership | budget_workspaces.owner_id, workspace_members.user_id RESTRICT | Review dependency order; removal/inactive state alone does not detach the reference |
| Invitation recipients/auth linkage | workspace_invitations.invitee_user_id and admin_user_invitations.auth_user_id SET NULL | Email/name/history fields and inviter blockers need separate treatment |
| Support/cashbook/Business documents | support_ticket_messages.author_id, cashbook_entries.created_by, business_documents.uploaded_by RESTRICT | Define lawful/minimized retention or erasure, not blanket force-cascade |
| Business subscriptions/purchases | business_subscription_quotes.owner_id / business_public_purchases.owner_id implicit NO ACTION | Financial record and ownership/reference resolution required |
| Shared audit/attribution | Some actor fields SET NULL; business_support_actions.actor_id RESTRICT | Distinguish financial fact from personal identity, define approved retention/access and eventual disposal |

Do not infer deployed constraints from this table. No original finance rows, conversion locks, subscription entitlements, roles or membership product rules are changed by the review.

## Proposed decision matrix — not adopted retention policy

| Category | Proposed default direction | Required decision/evidence |
|---|---|---|
| Auth/profile/contact and own private content | Remove identity and personal data through a verified self-deletion workflow | Exact data scope, reasonable verification, completion timing and provider copies |
| Personal workspace/cashbook/payments | Explicit review of owner-only records and FK order; close/delete according to an approved rule | Export choice, lawful exceptions, attached bytes, historical conversions and deletion versus retention effects |
| Household/Business ownership | Offer a legitimate verified successor transfer or an explicitly reviewed workspace closure path | Other members' rights/access, no-successor/expired/suspended/pending-state path, subscription consequences; do not force purchase/renewal solely to request deletion |
| Shared finance/claims/receipts/audit | Retain only what has a supported, disclosed purpose/grounds and duration; minimize personal attribution where lawful | Operator/jurisdictions and actual record type; no automatic forever-retention or shared-content exemption |
| Invitations/support/analytics/devices | Remove or minimize personal identifiers and reconcile needed security/support records | Copied email/name/text, pending actions, token/queue/provider copies and approved duration |
| Storage/derived files | Capture authoritative ownership/path manifest before destructive DB work; remove bytes with API and retry | Personal-versus-approved-retained shared objects, uploader-owned bytes, registered/unregistered originals and signed access |
| Backups/processors | Document retention/expiry and deletion handling that avoids accidental resurrection | Actual Stage 1 backup limitations, restore-time deletion handling and confirmed provider behavior; do not promise immediate deletion of every retained backup |
| Completion record | Keep only a justified minimal request/outcome record | Access, scope, duration and identity minimization; never store tokens/passwords/file content |

Legal retention periods, processing deadline, retention grounds, operator and audience facts are not invented. Worldwide launch intent does not establish one universal legal retention rule. Deletion of a user's shared content cannot simply be waived because another member can see it. These decisions join F01/F02/F20 and must match future factual notices.

## Review-only candidate contract for 4.1.2

1. Prepare an explicit lifecycle/preflight plan describing blockers, intended data effects and resumable states. A request accepted or a plan generated must not be labelled account deleted.
2. Identity comes from server-verified caller context, not a supplied target UUID/email. Require reasonable recent verification and explicit confirmation; reject outsider/stale/replayed requests and recheck ownership/state before changes.
3. Keep current authorization and valid ownership transfer guards. Do not invent a household transfer bypass, drop RESTRICT constraints, ignore Business source drift, elevate shared audit accounts or normalize a mismatch away.
4. Capture authoritative data/file dependencies before destructive changes. Design durable, bounded idempotent retries across DB, Storage and Auth/provider boundaries; partial failure must remain visible. These services are not one atomic transaction.
5. Implement only semantics that are supported by evidence/owner decisions. Missing retention/operator/identity/provider prerequisites remain DECISION/BLOCKED. Candidate/local adapters can be prepared without installing an erasure worker or deleting an account.
6. Match public/in-app copy and request status to actual behavior, duration and retained categories. No guarantee that account deletion cancels a store subscription or instantly invalidates issued JWT/signed URLs.

This candidate stage is source/local work. No owner SQL install, delete command, mail dispatch, test-account creation or deployment is requested by this source review.

## Frozen DL01–DL05 acceptance matrix

The 25 selected cases are planned tests, not executed checks. Use separate disposable owner-controlled accounts/workspaces/files; keep existing Stage 1–3 audit fixtures intact.

| Group | Five selected cases | Required observable outcome |
|---|---|---|
| DL01 — initiation and identity | discoverable in-app/web request; recent self identity; outsider target spoof; missing/stale verification; duplicate/replayed request | Verified intended subject only, honest receipt/state, no unauthorized data effect |
| DL02 — ownership/dependencies | Personal own-only deletion; ordinary shared-member departure; owner transfer to valid successor; no successor/closure; expired/suspended/pending-payment ownership path | Explicit approved semantics; valid access/financial invariants and other members preserved where required; no forced paid renewal to make a request |
| DL03 — data and files | own profile/contact/device data; approved shared records/attribution; DB-before-Storage failure retry; Storage ownership/original enumeration; idempotent completion/reconciliation | Defined erasure/retention effects and bytes; no abandoned unreported cleanup or repeated cross-tenant effect |
| DL04 — residual access/providers | old access JWT; refresh/new sign-in; issued signed file URL; realtime/push/cache state; provider identity/processor cleanup | Actual denied effects/window recorded; no assumed instant global revocation or unsupported provider success |
| DL05 — notices/preservation | disclosed retained categories/timing; subscription warning; receipt/completion status; unrelated data/retained audit-fixture preservation; new-fixture cleanup/backups/restore handling | Truthful public/user-facing behavior, exact positive/negative evidence and scoped cleanup |

Unavailable approved semantics, recoverable separate identities, deployed candidate, source/constraint parity, harmless known objects, staff/recovery or provider controls make dependent cases BLOCKED at 4.1.3. A manual dashboard deletion or app-only inactive flag is not substitute acceptance. A new source scan or mocked adapter cannot claim these hosted tests passed.

## Actions and primary references

| ID | Current result | Required work and closure evidence | Finding/dependency | Owner |
|---|---|---|---|---|
| DL-R01 | Retention and personal/shared-data decisions remain open | Record each data category's delete/anonymize/retain action, justified purpose/grounds, duration/expiry, access and processor/backup treatment; no invented legal period or blanket shared-data exemption | F02,F01,F20 | Both |
| DL-R02 | No authenticated deletion request/completion workflow | Prepare easy in-app/web initiation, server-verified self identity/recent authentication, explicit confirmation, idempotent request and truthful completion/partial-failure states; reject caller-supplied target identity | F02,F08,F15 | Developer |
| DL-R03 | Mixed CASCADE/RESTRICT/SET NULL/NO ACTION references; owner transfer incomplete | Build dependency-aware preflight and approved Personal/household/Business transfer-or-closure actions; protect other members and financial integrity, consider expired/suspended/pending states, and verify exact current constraints before erasure | F02,F15 | Both |
| DL-R04 | Files are cleaned by selected client operations, not an account job | Capture authoritative DB and Storage ownership/path manifest before destructive changes; use Storage API removal with durable retries, reconciliation and bounded processor/backup cleanup; preserve only explicitly justified retained objects | F02,F13,F20 | Developer/Both |
| DL-R05 | No deletion-specific provider/session/device/access acceptance | Test refresh/login failure, actual stale access-token window and sensitive access gates, issued signed URLs, push/realtime/browser cleanup and provider revocation; retain social/native integration dependencies | F02,F08,F15 | Both |
| DL-R06 | No public resource or completed synthetic deletion receipt | Verify functional public web/in-app paths, retention/timing/subscription notices and frozen DL01–DL05 direct effect checks using separate disposable identities/files; align store declarations and final full re-audit | F02,F01,F20 | Both |

Checked 11 October 2026:
- [Apple account-deletion guidance](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion): in-app initiation and genuine account/associated-data deletion; deactivation alone insufficient; explained retention/timing and reasonable verification.
- [Google Play deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en): in-app path plus usable web resource, associated-data treatment and accurate retention disclosures.
- [Supabase admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser): privileged server-only operation, not a browser service key.
- [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data): Storage ownership can block deletion; already-issued access tokens have a residual validity window.
- [Supabase Storage deletion](https://supabase.com/docs/guides/storage/management/delete-objects): API removes file bytes; SQL-only object metadata deletion can orphan them.

These primary references do not establish Mushavo's deployment, legal retention or store acceptance.

- [Stage 4 plan](SECURITY_STAGE_4_DATA_PRIVACY_PLAN.md), [source inventory](security-stage-4-lifecycle-source-inventory.json), [evidence](security-stage-4-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json).
