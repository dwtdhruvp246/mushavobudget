# Stage 3.2 — Personal, Family and currency checkpoint report

Closed 10 October 2026 at **3.2.3**, with scoped passes and carry-forward. **All three planned milestones have recorded outcomes; none remains in this checkpoint.** F15 stays open for the Personal binding failure and outstanding authorization/integrity evidence. Stage 3 itself is still active; its detailed stage-end report is due at **3.6**.

## Recorded results

| Milestone | Owner outcome | Evidence and practical limit |
|---|---|---|
| 3.2.1 — Personal CRUD and binding | **26 PASS, one REVIEW**, runner exit 1 | S3E07: own create/read/update and selected outsider/anonymous denials passed. `FOREIGN_WORKSPACE_REBIND_NOT_PREVENTED` stopped the batch; six later groups were not executed. |
| 3.2.2 — Family membership and invitations | **33 PASS**, runner exit 0 | S3E11: head/member/outsider/anonymous access, invitation recipient/state controls, attribution and role escalation denials, and access loss using the same session after removal. |
| 3.2.3 — Currency settings and conversions | **23 PASS**, runner exit 0 | S3E13: owner settings positive controls/restoration, foreign/removed/anonymous denials, valid input guards, protected helpers/manual conversions and disabled-backfill zero effects. |

The three batches report **82 PASS check groups and one REVIEW**. Some checks overlap between batches, so this is an execution count, not 82 unique controls or full authorization acceptance. Source/local tests and setup metadata are separate evidence and are not added to this owner PASS total.

The latest receipt is `STAGING_CURRENCY_API_SCOPED_PASS`, completed at **2026-10-10T19:16:06.687Z**, targeting **STAGING `dczlddwbtgvfdujgcitb`**. Its runner/checker were pinned to **`3e6ebe575a65eacbb1fc719ccf6fdf72cc1a007e`**. It reports no problem code or incomplete write effects, selected-settings restoration verified, two new retained manual conversion rows, four internal-helper permission denials and local logout of both generated API sessions. This is owner-executed staging evidence, not independent production/function-body parity proof.

## What the scoped passes establish

- Personal owners can use the selected create/update paths, while tested known-row outsider/anonymous requests preserve the selected owner's values. Both Personal currency owners can save their existing values without changing the selected settings or flags.
- A Family head's authority stays in the matching fixture family. Invitations require the intended recipient and pending state; tested wrong-recipient, anonymous, direct-update, cancellation and replay paths do not create unauthorized membership.
- An active Family member gets the existing shared reads and attributed contribution writes without head powers. Role/payer substitution and selected head-owned changes/deletes are denied. Removal makes both membership models inactive and the same member session loses the selected shared access, including its prior contributions; the member's separate legitimate family remains accessible.
- Each Family head can normalize USD/INR settings and restore the selected USD/disabled-conversion baseline. Foreign/removed/anonymous settings reads and RPC/PATCH attempts are denied, and selected owner readbacks remain unchanged. Empty, unenabled and unsupported currency inputs are rejected.
- Direct ordinary-owner conversion INSERT and signed-in/anonymous execution of both internal helpers receive explicit database permission denials. Matching heads save/read correctly scoped, attributed, locked USD 1 manual conversions. Tested foreign/removed/anonymous manual conversion and conversion-row mutations are denied; direct owner mutation cannot bypass the protected RPC.
- Matching heads reach disabled workspace backfill with a zero result and unchanged selected conversions/payments. Foreign/removed/anonymous backfill is denied. This does not exercise a live provider or a conversion-enabled scheduler.

## Personal failure and subsequent helper rechecks

The stopped Personal batch failed the acceptance criterion for direct paid-record `workspace_id` substitution. Source/local reproduction shows the sync trigger covers INSERT and changes of `payment_item_id`, while the finance guard obtains entitlement from the parent item without validating the submitted record workspace. The owner receipt omits the failed HTTP response and post-failure row state. It therefore supports a failed binding criterion, not independent proof of the exact persisted foreign binding, a cross-user payment read/write leak or historical production impact.

| Original S3E07 unrun group | Current reconciliation |
|---|---|
| Signed-in `store_api_payment_conversion` denial | S3E13 PASS for the same role/function boundary using a valid retained Family paid record |
| Signed-in `currency_conversion_backfill_dates` denial | S3E13 PASS for the same role/function boundary |
| Anonymous `store_api_payment_conversion` denial | S3E13 PASS for the same role/function boundary using the valid Family payload |
| Anonymous `currency_conversion_backfill_dates` denial | S3E13 PASS for the same role/function boundary |
| Own paid-record relink to an existing foreign Personal item | **UNRUN / carry-forward** |
| Both Personal accounts delete their own exact new fixtures and verify absence | **UNRUN / carry-forward** |

The original receipt still has six unrun groups. Later helper evidence does not claim that its exact stopped Personal requests ran. The Personal binding failure and the two Personal-specific groups remain unresolved. Family contribution deletion passed in S3E11 but is a different scope and does not substitute for Personal deletion.

## Fixture and effect record

Retain the incomplete inactive `AUDIT-S321-` Personal fixtures for final review. The original Stage 1 Personal seed was not targeted. Both Family head payment fixtures and invitation history remain; the Family member contributions from the API batch were removed, and the primary former member remains inactive.

Currency selected settings were restored on all four workspaces. Existing Personal conversion/reminder flags were preserved; automatic conversion was not enabled by the batch. The two USD-to-USD manual conversions at rate 1 remain on the synthetic USD 1 Family paid records. Selected payment values are unchanged. Settings `updated_at` may have advanced; the receipt is not an all-column or byte-for-byte rollback assertion.

Local-scope logout requests were accepted for the generated test sessions. Immediate invalidation of every previously issued JWT is not established. Selected API notification visibility/absence is not independently rendered UI or physical-deletion proof. No repeated successful batch or cleanup of unrelated fixtures is requested.

## Final remediation and re-audit actions

| Action | Required outcome before claiming resolution |
|---|---|
| PF-R01 — Verify and repair derived paid-record workspace binding | Privately establish exact hosted failed-response/readback and intended invariant; review a narrow guard/sync correction for direct INSERT/UPDATE and legitimate parent relinking; preserve authorized Personal/Family/Business writes. No blanket policy revoke or production repair is implied. |
| PF-R02 — Assess existing consistency and retained fixtures | Privately count and review mismatched record/item workspaces and any related conversion scopes before proposing a historical repair. Preserve evidence and distinguish synthetic fixtures from customer data. Do not rewrite historical values without a reviewed plan. |
| PF-R03 — Recheck affected Personal operations | After remediation, rerun the failed binding control, valid/invalid parent relinking, both accounts' own exact fixture deletion/absence, and affected permitted/denied/conversion regressions. Preserve the original failed receipt and record fresh outcomes. |
| PF-R04 — Verify automatic FX, scheduler and history | Use controlled isolated destinations and data to test conversion-enabled legitimate execution, scheduler/service permissions, provider success/failure and historical locked-conversion preservation. Manual identity conversions and disabled zero-effect backfill are not substitutes. |
| PF-R05 — Verify remaining parity and surfaces | Reconcile hosted function/policy/trigger bodies and production parity, rendered invitation behavior, safe transitive dispatch and relevant concurrency/replay cases. Broad Storage/download/realtime, Business and platform-admin scopes retain their assigned stages. |

All actions join the existing final-remediation/fresh-re-audit process. F08/F15 and the wider release gates remain open; completing this checkpoint does not authorize a production deployment or native/APK update.

## Next checkpoint

**3.3.1 — Business permission and scope review.** Step 3.3 retains three finite work groups: (1) freeze the existing Business role/scope request matrix and controlled-account prerequisites, (2) prepare the justified candidate/test tools with meaningful local checks, and (3) one bounded staging acceptance phase with unavailable cases recorded, followed by its checkpoint summary. It covers built-in/custom roles, assigned/own/team scopes, selected finance/report/export access, role escalation and removal. No new product roles or customer permission rules are inferred.

Before any new owner action, provide the complete pinned PowerShell/clipboard SQL handoff and identify the staging project and each prompt. No additional owner action is required to record this closure.

- [Stage 3 plan](SECURITY_STAGE_3_AUTHORIZATION_PLAN.md), [3.2 Personal/Family instructions](SECURITY_STAGE_3_2_PERSONAL_FAMILY.md) and [3.2.3 currency instructions](SECURITY_STAGE_3_2_CURRENCY_SETTINGS.md).
- [Evidence ledger](security-stage-3-evidence.json), [progress](SECURITY_AUDIT_PROGRESS.json) and [final action register](SECURITY_AUDIT_CARRY_FORWARD.md).
