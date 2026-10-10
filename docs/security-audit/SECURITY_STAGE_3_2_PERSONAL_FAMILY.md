# 3.2 — Personal and Family isolation

**3.2.1 checkpoint recorded — 10 October 2026.** Owner staging batch returned **26 PASS and one REVIEW** at the paid-record workspace-binding control; six subsequent planned check groups were not run. Source/local reproduction supports the gap, but the receipt does not include the failed HTTP response or post-failure row state. F15 remains open and the failure/unrun groups are carried to final remediation/re-audit. Both generated test sessions received local logout; incomplete inactive synthetic fixtures remain. Next is 3.2.2, Family acceptance. The checker previously passed 28 local tests; no runtime correction has been deployed.

## Three bounded milestones

| Work item | Selected work | Current position |
|---|---|---|
| 3.2.1 | Review the Personal/Family source contract; exercise new Personal create/update/delete, ownership/workspace substitution and restricted helper requests with the two existing staging accounts | Complete with carry-forward: 26 owner PASS, one workspace-binding REVIEW, six subsequent groups unrun (S3E07) |
| 3.2.2 | One controlled Family fixture and acceptance phase: head, recipient before joining, active member and after removal; shared reads, attributed writes and recipient/state-bound invitation response/cancel/replay | Pending. Use synthetic staging identities; establish active entitlement and controlled notification destinations before fixture writes. No customer email/push |
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
