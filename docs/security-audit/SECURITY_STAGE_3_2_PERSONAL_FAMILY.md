# 3.2 — Personal and Family isolation

**3.2.2 fixture result recorded — 10 October 2026 (S3E09).** Owner receipt reports two synthetic families and matching fixture scopes created: one PASS, two INFO and the expected authorization-pending REVIEW. Selected dispatch guards are reported satisfied; reminders/conversions are disabled. **Do not rerun fixture SQL. Next is the Family API runner** from the corrected full commit supplied in chat (S3E10). Its hosted result is still pending. Local preparation evidence S3E08 remains unchanged: 52 migrations with explicit adapters, nine source/checker cases and eight isolated tests; the complete local lifecycle returned 33 PASS checks.

**3.2.1 checkpoint recorded — 10 October 2026.** Owner staging batch returned **26 PASS and one REVIEW** at the paid-record workspace-binding control; six subsequent planned check groups were not run. Source/local reproduction supports the gap, but the receipt does not include the failed HTTP response or post-failure row state. F15 remains open and the failure/unrun groups are carried to final remediation/re-audit. Both generated test sessions received local logout; incomplete inactive synthetic fixtures remain. Next is 3.2.2, Family acceptance. The checker previously passed 28 local tests; no runtime correction has been deployed.

## Three bounded milestones

| Work item | Selected work | Current position |
|---|---|---|
| 3.2.1 | Review the Personal/Family source contract; exercise new Personal create/update/delete, ownership/workspace substitution and restricted helper requests with the two existing staging accounts | Complete with carry-forward: 26 owner PASS, one workspace-binding REVIEW, six subsequent groups unrun (S3E07) |
| 3.2.2 | One controlled Family fixture and acceptance phase: head, recipient before joining, active member and after removal; shared reads, attributed writes and recipient/state-bound invitation response/cancel/replay | Fixture owner PASS recorded (S3E09); API batch pending. Use the existing synthetic accounts and pinned runner; do not repeat fixture SQL |
| 3.2.3 | Complete selected workspace currency-settings controls, record affected rechecks and close the checkpoint with failed/blocked/unverified cases carried forward | Pending. Service scheduler/history, broad Storage, Business and platform MFA keep their separate scopes |

These are the operational phases of the frozen PF01–PF06 matrix, not new audit stages. Each includes necessary source/local checks and its controlled requests. Do not add repeated baseline inventories or turn a missing prerequisite into an unlimited setup sequence. The final Stage 3 report remains at 3.6. Demonstrated failures join final remediation and the full fresh re-audit according to the owner's standing process.

## Source contract and review result

The staging application was initialized from ordered migrations. Use current migration replacements, not a single earlier definition in the cumulative schema.

| Boundary | Current source contract / exact review point |
|---|---|
| Personal payments | SELECT follows Personal `owner_id`; INSERT requires caller ownership plus `created_by`/`recorded_by`; UPDATE/DELETE apply operation-specific policies and account/entitlement guards. New paid records must refer to the matching visible item |
| Family access | Active participant reads are shared. Some writes are allowed when attributed to the member; do not invent a universal member write ban. Head administration additionally requires matching owner and active entitlement |
| Payer attribution | `guard_payment_record_payer` rejects an inactive or unrelated `paid_by_member_id` on a Family paid record |
| Invitation response | Caller UID and JWT email must match the pending invitation recipient; selection is locked before response. Verify pending/accepted/rejected/cancelled states and repeat requests directly |
| Cancellation/removal | `cancel_family_invitation` is a protected authenticated RPC with head/entitlement checks; direct authenticated DELETE was revoked. `remove_family_member` validates the matching family, prevents removal of Owner/self and makes the member inactive; verify subsequent actual access and legacy workspace synchronization |
| Currency helpers | Two internal functions remain service-only by prior metadata. The first batch verifies actual ordinary/anonymous API permission-denial, not scheduled execution or historical conversion correctness |
| Workspace binding | Item sync covers family/owner/visibility changes. Paid-record sync covers INSERT and changes of `payment_item_id`, but not direct changes of `workspace_id`. The finance guard obtains paid-record entitlement from its parent item rather than validating the submitted record workspace. This is the focused source gap below |

### F15 follow-up: paid-record workspace substitution

[verify-stage-3-personal-workspace-bindings.mjs](../../scripts/verify-stage-3-personal-workspace-bindings.mjs) extracts the actual current sync functions, trigger definitions, Personal read/update policies and latest finance guard. It runs them in an ephemeral **reduced schema** using external PGlite 0.5.8 / PostgreSQL 18.3. Account/entitlement and Family dependencies are explicit minimal adapters; this is not complete application or Supabase behavior.

Six selected controls show: own paid-record update succeeds; another user cannot read/update that record; direct item workspace substitution is denied; an owner can directly set the paid record's workspace to an existing foreign workspace while its item remains in the original workspace; expanding only the local trigger's update-column coverage normalizes the record workspace back to its item. The local trigger change is a counterexample inside the disposable fixture, not a repository/runtime migration.

**Result: source/local workspace-integrity gap reproduced; hosted reachability, broader impact, historical inconsistency and production parity remain unverified.** It is not evidence that another user's payment rows or identity were read. The owner staging batch checked this same request using two real app sessions and known existing IDs and reported `FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED`. This is owner-tested failure of the checker acceptance criterion, not independent post-failure row-state or broader impact proof. Raw failed HTTP response and post-failure readback were not included because the checker stops at the failed criterion.

Final-remediation action: verify hosted reachability and intended derived-workspace invariant; prepare a narrowly reviewed guard/sync correction for direct INSERT/UPDATE, preserve legitimate writes and historical conversions, assess existing mismatch counts privately before any repair, then recheck owner, member, outsider and malformed-reference cases. No historical rewrite or production change is requested now.

## Archived first owner handoff — 3.2.1 completed

The owner has run this batch once. The instructions below document that execution; no repeat is requested now.

**Target: STAGING `dczlddwbtgvfdujgcitb` only**, using the deployed staging config at `https://mushavo-budget-staging.pages.dev/config.js`. Two existing synthetic app accounts: `audit.owner@example.com` and `audit.outsider@example.com`. Supply their **app login passwords**, never the Supabase database password. The checker verifies both identities and that neither is platform staff or suspended before any payment write.

No staging upload or SQL Editor query is needed for this batch. Use the complete pinned PowerShell block supplied in chat from `C:\Users\HP\Desktop\Mushavo Budget`. It fetches the audit branch and reads the new runner/checker from the specified full commit; it does not switch, merge or overwrite the working checkout.

The runner prompts twice with masked input, temporarily supplies passwords to Node and clears those environment variables and unmanaged buffers in `finally`. The code is ASCII to avoid the earlier PowerShell native Git text-decoding issue. Native PowerShell execution has not been run in this Linux environment; the owner receipt is still required.

The batch creates **one new USD 1 inactive schedule and one matching paid record per synthetic account**. It changes only notes on permitted update controls and uses generated exact UUIDs for every mutation. Inactive schedules bypass the active-plan count and do not qualify for source reminder enqueueing. Existing Stage 1 `AUDIT-S135-OWNER-ONLY` data is never selected or mutated. It sends no invitation, email, push or scheduler request.

| Selected cases | Evidence required |
|---|---|
| Two verified ordinary accounts with distinct Personal workspaces | Identity checks, staff/suspension boolean controls and own workspace read |
| Own create/read/update for item and paid record | Successful representation with expected identity/scope/currency; owner readback matches the selected fields |
| Outsider and anonymous reads of known owner item, record and workspace | Empty result or explicit database permission denial; known positive owner fixture first |
| Outsider and anonymous PATCH/DELETE of known owner item/record | No authorized effect; owner readback unchanged after each request |
| Forged owner INSERT into both tables | Explicit permission or workspace-access denial; generated attempted IDs absent to both sessions and original owner fixture unchanged. A FK/check/missing-RPC/server error cannot pass |
| Ownership substitution, foreign workspace substitution and paid-record foreign item link | Existing valid foreign identifiers; deny or normalize workspace while preserving selected original values |
| Anonymous and signed-in direct internal helper calls | Explicit `42501` permission-denial, not a missing RPC, bad token or generic error |
| Legitimate DELETE control | Own record then own schedule deleted by exact run IDs; absence to both accounts |
| Test sessions | Local-scope logout requests accepted for generated API sessions. No claim that all prior JWTs immediately become invalid |

A complete no-error run produces **33 PASS checks** and `STAGING_PERSONAL_CRUD_SCOPED_PASS`. The known source workspace gap may instead produce `STAGING_PERSONAL_CRUD_REVIEW` with `FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED`. A failure stops subsequent writes, retains incomplete synthetic fixtures and still attempts local logout. Do not rerun repeatedly or manually delete unrelated data; send the summary so the outcome and unrun cases can be recorded.

On full success, only this run's selected item/record rows are removed. Derived conversion rows, provider side effects and comprehensive cleanup are not claimed; current conversion settings are not changed. On review, the new `AUDIT-S321-` schedules and linked records may remain for investigation. No raw UUID, row, token, key or password appears in the summary. Send **the JSON summary and redacted errors only**.

## Validation and limits

- [API checker](../../scripts/check-stage-3-personal-api.cjs), [full PowerShell runner](../../scripts/run-stage-3-personal-acceptance.ps1) and [28 local tests](../../tests/stage-3-personal-api.test.cjs).
- Local checker tests include permitted controls, exact-ID cleanup, ordinary identity verification, normalized workspace acceptance, exposed reads/writes, hidden mutations behind a denial, hidden insert effects, foreign bindings, malformed/server/FK/missing-RPC failures, transport redaction, partial login and local logout handling.
- [Reduced-schema binding probe](../../scripts/verify-stage-3-personal-workspace-bindings.mjs); external module argument keeps repository dependencies unchanged.
- Mock tests validate the checker, not application enforcement. The reduced-schema probe validates a focused source interaction, not complete hosted PostgreSQL 17.11, provider RLS grants or complete schema parity.
- Family fixture/response/removal, currency-settings allowed paths, service scheduler/history, Business, Storage, platform MFA, complete production parity and full F15 acceptance remain pending or separately scoped.

## Source and audit references

- [Initial application migration](../../supabase/migrations/20260901061500_currencyapi_multicurrency.sql): Personal/Family policies, invitations, member management and payment/workspace sync triggers.
- [Payer guard](../../supabase/migrations/20260924130000_guard_payment_record_payer.sql), [cancel invitation RPC](../../supabase/migrations/20260925080000_cancel_pending_family_invitation.sql), [suspension/finance guards](../../supabase/migrations/20260925090000_expiry_and_account_suspension.sql), [latest shared currency-settings replacement](../../supabase/migrations/20260928130000_business_stage_3_onboarding.sql).
- [Frozen six-group Personal/Family matrix](SECURITY_STAGE_3_1_PERMISSION_BASELINE.md), [Stage 3 plan](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md), [evidence](security-stage-3-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json) and [action plan](SECURITY_AUDIT_CARRY_FORWARD.md).

## 3.2.1 owner result — S3E07

Owner completion: **2026-10-10T17:19:17.688Z**, intended project **dczlddwbtgvfdujgcitb**, pinned checker **013b8b1ccf7e8a7536a4850b694d9b8ba43df12a**. The complete redacted JSON receipt is retained in Stage 3 evidence.

| Outcome | Recorded scope |
|---|---|
| 26 PASS checks | Staging config; verified ordinary active identities and distinct Personal workspaces; both accounts' own create/read/update controls; selected outsider/anonymous read, PATCH, DELETE and forged-attribution INSERT denials with owner readback; item ownership/workspace and record ownership substitution controls; generated sessions' local logout |
| One REVIEW / failed checker criterion | `FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED` at direct foreign paid-record workspace substitution. Consistent with local source reproduction. The aggregate message does not include HTTP status, raw response or a post-failure owner readback; exact persisted state and broader impact require private final verification |
| Six planned groups not run | Paid-record foreign item relink; four signed-in/anonymous helper-denial calls; own fixture DELETE/absence group. No PASS inferred from their earlier metadata or checker tests |
| Retained fixtures | `selected_fixture_rows_removed=false`; new inactive `AUDIT-S321-` fixtures and linked paid records may remain. Existing Stage 1 seed was not targeted. Derived conversion cleanup and all-row integrity remain unverified |
| Runner exit/error | Exit 1 and PowerShell `Review required` are the intentional stop after the non-pass outcome, not an installation or password error |

This closes **one of three 3.2 milestones**, with the failure and six unrun groups retained for final remediation and fresh re-audit. Do not rerun the same batch or delete the retained evidence now. Two milestones remain: 3.2.2 Family fixture/requests, then 3.2.3 selected currency controls and checkpoint reconciliation. Stage 3 has still completed only one of its six main steps (3.1); 3.2 is active.

## 3.2.2 owner handoff — Family lifecycle

**Use STAGING `dczlddwbtgvfdujgcitb`, not the production project.** Two actions complete this milestone's selected requests: run the once-only fixture query, then run the supplied API runner after its fixture receipt is reviewed. Neither requires a Cloudflare upload or a new app account. Both actions use the immutable full commit supplied in chat; `git fetch` and `git show` do not switch or overwrite the owner's checkout.

### Action 1: once-only synthetic fixture SQL — completed, do not repeat

The owner PowerShell block copies [security_stage_3_family_fixture.sql](../../supabase/diagnostics/security_stage_3_family_fixture.sql) to the clipboard. Open a new query at `https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/sql/new`, verify the staging reference in the Dashboard URL, paste the entire clipboard and run it **once**.

This is a controlled fixture write, not a read-only inventory. It creates two synthetic families, two matching household workspaces/head members, one inactive USD 1 schedule and matching paid record per family. `audit.owner@example.com` heads the primary family; `audit.outsider@example.com` heads the separate secondary family. Each new fixture gets a seven-day synthetic household entitlement with four seats so the legitimate invitation control can run; no real payment or customer subscription is processed. New workspace reminders and conversions are disabled.

Before any fixture writes, the transaction requires exactly the two expected synthetic Auth accounts, ordinary active matching profiles, no existing family, no push subscription, no active cron job and no unreviewed enabled noninternal trigger on Notifications. It uses transaction-local claims for each existing fixture owner, not new Auth credentials or persisted project settings. The reviewed notification triggers set workspace context or enforce suspension/Business invitation fields. Source Family invitation routines insert in-app notifications and do not themselves send an Auth invitation email. Transitive hosted functions, provider/webhook bodies and external dispatch are not independently attested by this metadata guard.

All four result rows come from **one final SELECT**:

| Row | Expected | Meaning |
|---|---|---|
| 01 Intended staging fixture target | INFO | Owner must verify the actual Dashboard URL; a SQL label does not prove project identity |
| 02 Synthetic Family fixtures created | PASS | Two fixture families and matching head/payment scopes committed |
| 03 Dispatch and existing-data boundaries | INFO | Selected guards checked; reminder/conversion flags disabled on new fixtures |
| 04 Family authorization acceptance pending | REVIEW | Expected at setup: the API test is still required; fixture creation is not an authorization PASS |

Send the **four result rows or the error only**. A guard failure aborts the transaction; do not remove unrelated data, loosen permissions or rerun repeatedly. Existing Stage 1 and retained Stage 3 Personal fixtures are not selected or repaired.

### Action 2: controlled Family API runner

After the fixture receipt, use [run-stage-3-family-acceptance.ps1](../../scripts/run-stage-3-family-acceptance.ps1) through the full pinned PowerShell block supplied in chat. It asks for the two existing **staging app login passwords** using masked input, not a database password. Temporary environment variables and unmanaged password buffers are cleared in `finally`. Native PowerShell execution still requires the owner receipt; the extracted Node expression has local success/review/redaction tests.

[check-stage-3-family-api.cjs](../../scripts/check-stage-3-family-api.cjs) verifies deployed staging config, two distinct ordinary active sessions, fresh exact head fixtures and active entitlements before invitation or payment writes. All mutations use known generated/fixture IDs; the secondary family supplies real existing foreign identifiers and a legitimate comparison head.

| Selected request group | Positive control and denied/effect verification |
|---|---|
| Head and outsider scope | Matching head updates its own fixture; the other head and anonymous requests cannot read/mutate protected rows or administer the foreign family; head readbacks remain unchanged |
| Invitation recipient/state | Three invitation lifecycles: decline, head cancellation and acceptance. Verify legacy/generalized mirrors and recipient in-app notice; wrong recipient, anonymous, direct status change and repeated/terminal responses cannot create membership |
| Member access and attribution | Active member reads shared rows and creates/changes an attributed inactive USD 1 item and paid record; existing head-only Family DELETE authority remains protected, including member-owned contributions |
| Role and payer scope | No direct legacy/generalized head promotion; member cannot invite/remove as head; an existing foreign-family payer cannot be assigned; head cannot remove another family's member or its own Owner |
| Removal using the same login | Head removal makes both membership scopes inactive. Subsequent reads/PATCH/DELETE/INSERT and accepted-invitation replay from the same token cannot regain primary-family access; legitimate secondary head access remains |
| Delete positive control | Head deletes only the two new member-contribution rows after successful removal checks; both original head fixtures and invitation history remain for 3.2.3 |

A full selected run returns **33 PASS checks** and `STAGING_FAMILY_API_SCOPED_PASS`. The first unexpected response produces `STAGING_FAMILY_API_REVIEW`, stops subsequent test writes, retains incomplete fixtures and attempts local logout for generated sessions. Known permission codes/exact RPC authorization messages are required; FK, missing RPC, malformed response, token and server errors do not count as successful denials. Selected head readbacks detect hidden effects behind a denial. Direct UI buttons, email/Edge delivery, concurrency, comprehensive cleanup and complete hosted implementation parity are not proved by this API batch.

Do not rerun the batch once it has changed membership state. Send its **JSON summary and redacted errors only**. Local-scope logout acceptance does not establish immediate invalidation of all issued JWTs. The prior paid-record workspace gap, retained Personal rows and six unrun Personal groups remain final-remediation cases; this Family batch does not fix them or close F15.

### Local validation — S3E08

- [verify-stage-3-family-source.mjs](../../scripts/verify-stage-3-family-source.mjs) loads all 52 ordered application migrations into external PGlite 0.5.8 / PostgreSQL 18.3. Minimal Auth/Storage helpers, broad modeled default grants and a PostgREST-shaped HTTP adapter are explicit local dependencies. The unavailable `CREATE EXTENSION pgcrypto` statement alone is omitted locally; built-in UUID generation is used. Managed provider role/bootstrap behavior is not recovered.
- Nine selected cases pass: unexpected Auth/profile/notification-trigger fixture guards, once-only fixture rollback/four-row receipt, the full 33-check Family lifecycle, and detection of a hidden mutation, a non-authorization error, removed-member exposure and logout failure. The complete local flow uses 207 fetches, including config and logout, within the bounded request budget.
- [stage-3-family-api.test.cjs](../../tests/stage-3-family-api.test.cjs): eight isolated target/password/error/redaction and extracted PowerShell Node-expression tests pass. The unchanged Personal checker suite also passes all 28 tests.
- Local source/checker results are not owner-hosted authorization evidence. Native PostgreSQL 17.11, Supabase Auth/PostgREST, deployed function/policy/trigger bodies, UI/dispatch, all-field integrity and production parity remain unverified until their scoped receipts or later audit cases.

## 3.2.2 owner fixture receipt — S3E09

Owner supplied all four expected SQL rows from the fixture at pinned commit `1e3e187a62f1b4bcc359f1f44e68f3b5afbde506`: **two INFO, one PASS and one REVIEW**. The full redacted receipt is preserved in Stage 3 evidence; no checked-at timestamp was supplied. The intended staging reference is `dczlddwbtgvfdujgcitb`; SQL labels alone do not independently establish hosted identity.

The PASS reports two families/head members/household workspaces, two inactive USD 1 items and two paid records, four seats per family and seven-day synthetic entitlement. Reported guards show empty staging push subscriptions, no active cron jobs, reviewed selected Notifications triggers and disabled new-fixture reminders/conversions. Existing Personal fixtures were not targeted and product permissions/Auth settings were not changed. Transitive hosted/frontend/Edge/webhook dispatch remains independently unverified.

Row 04 is the expected **API acceptance pending** marker, not a failed fixture setup or a Family permission pass. Next action is the prepared API runner once, using the two existing staging **app** passwords. Do not create more accounts, repeat fixture SQL or deploy Cloudflare changes. Send the API JSON/redacted errors only. The 3.2.2 milestone remains active until that result is recorded; 3.2 has still completed one of three milestones. The prior Personal failure and unrun cases remain for final remediation/re-audit.

## 3.2.2 recipient-visible cancellation check — S3E10

Before the first owner API run, the checker was tightened so cancellation tests notification absence through the **same recipient session that positively read the notice before cancellation**. The earlier head-session absence query lacked that positive visibility control. This changes the audit checker only, not product authorization or cancellation behavior. One additional local fault case simulates cancelled invitation mirrors with the recipient notice incorrectly retained; the corrected checker stops with `CANCELLED_INVITATION_NOTIFICATION_RETAINED`.

All ten local source/checker cases now pass, including the complete 33-check/207-fetch selected lifecycle. All eight isolated Family tests pass. The owner fixture is unchanged and needs no rerun; hosted Family API acceptance is still pending. Use the updated pinned API commit supplied in chat; the original fixture commit remains `1e3e187a62f1b4bcc359f1f44e68f3b5afbde506`.
