# Unavailable Admin invitations — controlled state-denial check

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: 2613fdf1122803337c6fb2af31c01028565b77fb.

## Current checkpoint

The [owner inventory](security-fr-2-batch-w-owner-unavailable-admin-invitation-inventory.json) returned zero expired, cancelled and replaced rows, including zero Free Personal/confirmed-recipient candidates. Do not repeat that query. AU02.04 remains untested because no existing fixture was available; zero candidates is not a product failure.

AU02.01/02 setup/isolation, completed-invitation AU02.03 wrong-recipient denial, the repeated-completion part of AU02.05 and Business AU02.06–08 stay accepted. The completed invitation must not be cancelled or edited. AU02.05 actual incomplete-setup/provider-failure retry remains open.

## Current action after the owner SQL stop

The owner received FIXTURE_UNREVIEWED_INVITATION_TRIGGER. Follow the [complete existing-pack repair handoff](SECURITY_FR_2_5_BATCH_W_UNAVAILABLE_ADMIN_INVITATION_TRIGGER_REPAIR.md) in a second PowerShell window before executing another phase. Preserve the current run; do not create a new fixture or repeat sign-ins. The correction recognizes the exact canonical Business launch trigger omitted by the initial helper. Unknown triggers still stop.

## Original controlled fixture action

Entry: scripts/check-fr-2-batch-w-unavailable-admin-invitation.mjs.
Runtime: scripts/lib/unavailable-admin-invitation-check.mjs and scripts/lib/unavailable-admin-invitation-sql.mjs.
Manifest: scripts/unavailable-admin-invitation-manifest.json, nine runtime sources after the trigger-repair correction.
Reuse the exact accepted v125 staging ZIP SHA256 9bbad6f7fe83b731aef9b65d3bae5df8b832204c5e7bbd0867a9e5a9b811033b.

Use the OTHER existing ordinary account from the completed-invitation check, not the newly invited recipient, followed by the existing staging Super Admin. Both passwords are masked and used only for actual Auth password sessions. The ordinary account must have an active self_signup profile, no Admin invitation linkage or platform role, and an existing Personal workspace. Do not repair/change a profile if this preflight fails.

The runner validates the real identities, the Admin role and staff table-read access before preparing one new random fixture UUID. It creates four complete SQL files in the new local output directory before requesting any SQL execution. No token or password is written into them.

| File | Exact bounded action |
|---|---|
| 01-expired.sql | Insert one temporary Free Personal invitation bound to the verified ordinary account, status sent with an already-past server expiry, plus a marked fixture audit row. No email dispatch. |
| 02-cancelled.sql | Change only that marked fixture to cancelled and a future expiry, isolating cancellation from expiry; insert its marked cancellation audit. |
| 03-replaced-state.sql | Add the same replacement-reason cancellation audit marker used to classify replaced invitations. No new recipient/invitation/email or replacement reservation call. |
| 04-cleanup.sql | Delete only the exact unprovisioned marked fixture and its cascading fixture audit rows. Idempotent when already absent; refuse linked/provisioned/renamed/unexpected-audit rows. |

On Windows the current file opens in Notepad. Copy its entire contents to a new query in the STAGING Supabase SQL Editor, project dczlddwbtgvfdujgcitb, and run once. Return to the same terminal and type DONE only after SQL succeeds. Each file is complete; no value or line edits are required. Do not re-run an earlier phase file.

If SQL errors, press Escape in the terminal rather than typing DONE. Cleanup is still offered whenever a fixture might have been created. If the terminal is closed, run the already-prepared 04-cleanup.sql in staging before restarting anything, and report the safe result/error. No broad cleanup or deletion of a real invitation is requested.

## Hosted checks and cleanup

At each phase, the real Admin reads the fixture and verifies its recipient, random marker, Free plan, no payment, no workspace/completed marker and exact status/expiry. Expiry comparison uses the HTTP server Date rather than the computer clock. The replaced-state phase also requires its actual fixture audit marker.

The ordinary account then calls get_my_admin_user_invitation and complete_admin_user_invitation using its actual Auth token:
- all three reads must deny with ADMIN_INVITATION_NOT_AVAILABLE;
- past-expiry completion must deny with ADMIN_INVITATION_EXPIRED;
- cancelled/replaced-state completion must deny with ADMIN_INVITATION_NOT_AVAILABLE.

Wrong-identity, generic session, unavailable network or successful completion responses do not count as the expected state denial. These are three attempts to complete an unprovisioned unavailable fixture, each expected to stop before provisioning. No valid first-provisioning target or new workspace creation is requested.

The ordinary profile and owned-workspace set must match their starting values. After the fourth SQL file, real Admin reads must show the fixture and audit absent. Only the two newly created Auth sessions are logged out with scope=local, including after failure. COMPLETE requires verified fixture and session cleanup. The normal browser sessions are not edited.

Normal success uses 25 direct HTTP requests, bounded at 30, each with a 25-second timeout and no retries; three completion RPCs and four acknowledged manual SQL steps. SQL Editor dashboard traffic is not measured. Fixture SQL writes are explicitly requested; settings, existing profiles/passwords/workspaces/roles, DDL, grants/RLS and application policy are unchanged. No API/Management/service key, dependency install, email, upload or hour-long expiry wait is required.

The SQL requires the registered staging target, privileged origin, current active reviewed catalogue/password-only policy, existing ordinary actor and active Super Admin. Unreviewed invitation-table triggers, pre-existing recipient invitations, nonzero Free prices, stale phase or unexpected fixture identity stop the transaction. Cleanup does not depend on the catalogue remaining ACTIVE, but retains staging/identity/audit/dependency guards.

## Acceptance and validation limits

This is actual recipient-bound hosted API denial for controlled unavailable database states. The replacement marker is a fixture of the stored cancelled/replaced state; this run does not invoke the email resend/replacement reservation workflow. It does not measure Auth email-link TTL, original UI rendering, new delivery, setup/provider-failure retry or races. No additional public AU case is added.

Initial [local17 checks](security-fr-2-batch-w-unavailable-admin-invitation-local-checks.json) did not include the later Business launch trigger. Current [local21 repair checks](security-fr-2-batch-w-unavailable-invitation-trigger-repair-local-checks.json): sixteen transport/package tests and five real local SQL tests PASS, nine runtime hashes. The SQL tests execute the unchanged foundation and completion migrations against synthetic local tables; they are offline evidence only. The current owner command runs the sixteen dependency-free tests, with no PGlite install. Assistant hosted requests/writes/email: zero. Owner run pending; no W/V/FR.2/Stage3/release closure.
