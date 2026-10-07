# Audit workflow and stage reporting

Owner instruction accepted 7 October 2026, E33. Current stage/step: **1.1**. Stage 0 baseline is owner-approved and closed; Stage 1 foundations is authorized and in progress. Stage 1.1 verification is not yet complete.

## Message numbering

Every user-facing assistant commentary and final message begins or ends with **stage.step**, for example **1.1 — Account security and recovery**. Use the active step consistently through a check and its follow-up; advance only when moving to the next concrete step. A status question during active work keeps the active number. A retrospective report identifies the reported stage within its content while the message keeps the active reference.

Stage 1 labels are 1.1 account access/recovery, 1.2 external protection, 1.3 isolated staging, 1.4 recovery proof, 1.5 inventory/monitoring/response and 1.6 closure/recheck. Historical Stage 0 reporting groups evidence as 0.1 discovery, 0.2 repository/fixtures, 0.3 live baseline, 0.4 native baseline, 0.5 scoped repairs/follow-ups and 0.6 closure. These historical groups are reporting organization, not invented new tests.

## Report at the end of every stage

Produce a dated, reviewable report with:

1. Stage/step scope, repository/deployment versions, evidence dates and sources.
2. Each actual test/change, expected versus observed result and evidence scope.
3. PASS, FAIL, UNSURE/NOT VERIFIED, BLOCKED, DECISION and NOT APPLICABLE results kept distinct. A scoped local/metadata/owner PASS must name its limit.
4. Repairs already made, exact affected files/configuration and relevant recheck outcomes.
5. Outstanding finding IDs, impact, action, owner, assigned stage/dependency and required final retest.
6. Stage completion meaning, residual risks, current release limits and next stage/step.

Use [the Stage 0 completion report](SECURITY_STAGE_0_COMPLETION_REPORT.md) as the initial format. Keep reports and [the carry-forward register](SECURITY_AUDIT_CARRY_FORWARD.md) versioned in the repository. Reports describe actual evidence; a stage report is not a manufactured all-PASS score.

## Failed and uncertain results

At stage end, retain every outstanding FAIL/UNSURE/BLOCKED/DECISION in the central register. The owner's chosen process is to resolve remaining items at the end of the audit and repeat the audit. Do not continually block stage reporting or broaden the current stage merely to turn every residual item into PASS.

Continue work already authorized for the current stage, including its planned improvements. Any issue still unresolved is carried forward to the final resolution pass. A missing prerequisite that prevents a meaningful or safe check is recorded as BLOCKED/UNSURE; do not invent a result or run a riskier production substitute. A demonstrated critical problem is reported promptly with its evidence and practical consequence.

No finding closes solely because its planned stage is complete, a migration ran or a report was written. Closure requires the action's observed outcome and defined recheck. Preserve older snapshots and append superseding evidence rather than rewriting history.

## Final resolution and re-audit

At the final audit/release gate, consolidate all carried-forward rows, resolve remaining failures/decisions, obtain missing evidence, and run a fresh full audit of the final source/deployment/artifacts. Include unchanged areas and regressions as well as repaired items. Record fresh versions/dates/identities, direct allowed/denied behavior and release-relevant native/store/recovery checks.

Remaining critical gaps, store blockers and unresolved requirements keep release gates open. Where a result stays uncertain, report uncertainty explicitly; no store or security guarantee is inferred from baseline closure. The final pass precedes store submission/release approval and is not an automatic deployment authorization.

## Execution conventions

Use `npm.cmd` on owner Windows. Preserve the original native checkout/signing identity. SQL handoffs remain PowerShell fetch → `git show "FETCH_HEAD:<path>" | Out-String | Set-Clipboard` → owner manual paste in the intended Supabase SQL Editor. Secrets, recovery material and customer backup bytes stay with the owner; reports contain redacted status/outcomes only.
