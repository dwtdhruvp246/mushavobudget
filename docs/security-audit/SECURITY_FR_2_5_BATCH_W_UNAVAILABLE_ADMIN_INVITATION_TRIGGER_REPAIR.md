# Repair the existing AU02.04 SQL pack after the trigger guard stop

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: 23a4b707421313c5aea2cfab9ab2b4583afb0a59.

## Owner stop and source correction

[Owner screenshot receipt](security-fr-2-batch-w-owner-unavailable-invitation-trigger-stop.json) shows P0001/FIXTURE_UNREVIEWED_INVITATION_TRIGGER. The failed block stopped in its pre-DML guard. The screenshot appears to contain several SQL blocks and ends at cleanup; current terminal phase, earlier committed transactions, fixture presence and session cleanup are not established. Do not credit any hosted state-denial PASS or assert all prior work rolled back.

The helper initially recognized only the foundation touch and price triggers. Canonical schema also has enforce_business_admin_invitation_launch_control_trigger from 20260927183000_business_stage_0_launch_lock.sql. Its current handler is redefined by 20261002060000_business_public_availability.sql: Business sent/pending invitation setup raises BUSINESS_MANUAL_GRANT_REQUIRED, while the Free Personal test fixture passes unchanged. Review used the full canonical schema and the later handler definition, not only the initial migration.

The corrected guard recognizes only that canonical third trigger with its row/before/insert/update flags, plan_id/status update columns, no arguments/constraint/WHEN, original handler signature/security-definer/language/search-path attributes and normalized body SHA256 812af7eb96d926a05bed6c3426ac90e0d4e991933ac790fe1999080ac7e9d1da. It changes no hosted trigger/function/policy. Other triggers, altered handler code and normal fixture identity/catalogue guards still stop execution. Actual owner-live trigger identity is not separately claimed; a mismatch continues to fail closed.

## Continue the existing terminal run

Keep the original PowerShell window open. Open a SECOND PowerShell window for the complete pinned repair command. Its only prompt is the full existing fixture-sql directory printed in the original terminal, normally Desktop/Mushavo-W-UnavailableInvitations-<existing guid>/fixture-sql. No password, ZIP upload, new test run or API key is needed for this local repair.

Entry: scripts/repair-fr-2-batch-w-unavailable-invitation-sql.mjs. It verifies nine published source hashes, reads all four existing files, extracts the original three validated UUID bindings from 01-expired.sql and requires every file to exactly match the old or corrected generated pack after CRLF normalization. It rejects arbitrary edits/mixed runs/symlinked files before changing a target. It preserves byte-for-byte originals in before-trigger-repair and repairs cleanup first, then the other phase files, with readback verification. Repeated repair is idempotent. No SQL or hosted request is executed.

After repair exit0:
1. Return to the ORIGINAL terminal and read which filename it is currently requesting. Do not guess the phase or start again at 01.
2. Reopen that repaired file from the directory; an already-open Notepad tab may still show its earlier contents.
3. In staging project dczlddwbtgvfdujgcitb, replace the ENTIRE editor query with only that one complete file and run it once. Do not append it to the previous combined query.
4. Type DONE in the original terminal only after that SQL succeeds. Let the original runner perform its HTTP checks and request the next file. Continue through cleanup and return its final safe JSON/exit code.

If the original terminal is already closed/stopped, run only the repaired 04-cleanup.sql in a fresh staging SQL query and return its safe result plus any available original terminal JSON before starting another fixture run. Local repair does not establish that an abandoned Auth session was cleaned up. If the repaired SQL still stops, retain the precise safe error and original terminal state; do not remove, disable or broadly allow a trigger.

The original running Node source remains the initial eight-source version. Continuation uses those same actual Auth sessions plus the separately nine-source-verified repair of generated SQL guard text. Repair preserves all account/run IDs, status transitions, expected HTTP denials and cleanup restrictions. Keep both the repair receipt and final original-run receipt together; do not reject the original report merely because its initial source_hashes_verified remains 8.

## Validation

[Current local checks](security-fr-2-batch-w-unavailable-invitation-trigger-repair-local-checks.json): sixteen dependency-free transport/package tests and five real local SQL tests PASS. Tests reproduce the old stop with the current canonical trigger enabled; verify Free fixture states/cleanup and BUSINESS_MANUAL_GRANT_REQUIRED; reject unknown triggers/altered handlers, preserve identity and backups, refuse edited/mixed packs and support idempotent repair. Four legacy pack reconstructions exactly match the prior published generator.

These are local checks. No assistant hosted Auth, SQL, email, policy, trigger or account change was performed. Owner repair/continuation outcome is pending. Original AU02.03/05 idempotence and Business scoped passes remain; AU02.04 and actual AU02.05 setup-failure retry are not yet accepted. No new public case or whole W/V/FR.2/Stage3/release closure.
