# Required progress display — Mushavo Budget security and launch work

Adopted24 October2026 at the owner's request (FRE177). This convention applies to project commentary, final progress answers, new owner handoffs and future terminal status/safe-result output. It keeps the main roadmap, remediation group and lettered work package visible together.

## Current project context

**Stage 3/10 — Authorization and Admin MFA — IN PROGRESS**  
**FR.2/8 — Authorization, Admin MFA, authentication and finance integrity — IN PROGRESS**  
**Batch U/Z — Full-app startup, private cache and session lifecycle — IN PREPARATION**

Compact form for routine updates:

`Stage 3/10 | FR.2/8 | Batch U/Z — IN PREPARATION`

This is the current hierarchy, not a universal mapping from FR number to main-stage number. Other remediation groups address other/spanning roadmap requirements. The numbers/letters identify the current point and plan endpoint, not completed counts, test totals or completion percentages. The original roadmap includes Stage0;10 is its last numbered stage. U–Z is the current fixed six-package authorization baseline.

## Status rules

1. Keep the actual statuses independent. Batch U can be COMPLETE while FR.2 and Stage3 remain IN PROGRESS. No stage/group closes automatically because one batch or local test passes.
2. U is currently IN PREPARATION. The earlier T hosted pass is retained; U has selected-source review/planning only and has not passed runtime or hosted acceptance. Do not display “Batch U/Z completed” today.
3. Use STARTED when the described batch/action begins, COMPLETE for the completed scope, and STOPPED FOR REVIEW on a failed/uncertain step. Identify the scope: e.g. “Local checks COMPLETE; hosted acceptance pending” or “Progress-display setup COMPLETE; Batch U remains IN PREPARATION.”
4. On failure retain the current letter and explain the safe checkpoint/uncertainty. Do not advance the letter or add a new one for a retry. Once all exit evidence passes, report that completed letter with COMPLETE; show the next letter only when starting its actual work.
5. Keep local test counts, hosted results, exit codes, timestamps, cleanup/readback evidence and overall release acceptance distinct. Hierarchy labels replace none of those details.
6. New owner commands must show the hierarchy on their human-readable start/end status lines. New safe JSON can include a public validated `progress_context` (stage/group/batch labels, titles and actual statuses) plus a separate action/phase status. No private value belongs in progress metadata.
7. Preserve pinned historical scripts, manifests and receipts. This convention does not rewrite earlier output or require rerunning completed email, upload, installation or acceptance work. It is adopted for new work and communications.
8. Continue to explain command effects and every expected prompt, reuse prepared inputs, use published pins, keep secrets out of chat/logs/arguments/environment and end runnable owner instructions with “Send me the safe JSON and exit code.”

The machine-readable current hierarchy is in SECURITY_FINAL_REMEDIATION_PROGRESS.json and SECURITY_AUDIT_PROGRESS.json under `progress_hierarchy` / `final_remediation.progress_hierarchy`. The output contract is `security-progress-display-contract.json`. Update it when actual project status changes; a documentation-only setup success must never mark the implementation batch complete.

No runtime/hosted test, product/deployment/configuration change or owner input is part of this display update. Production/native remain excluded and APK deferred.
