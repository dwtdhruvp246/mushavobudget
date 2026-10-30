# Unavailable Admin invitations — existing fixture inventory

Stage 3/10 | FR.2/8 | Batch W/Z. 30 October 2026.
Source parent: ae79422a7ecd2a964d8d734ccd015ab3a29976e9.

The completed-invitation wrong-recipient and duplicate-completion check passed: [owner receipt](security-fr-2-batch-w-owner-completed-admin-invitation-pass.json). Preserve AU02.01/02 setup/isolation and Business AU02.06–08 results. No repeat of those flows is requested.

## Next original case

AU02.04 retains the existing expired/cancelled/replaced invitation denial requirement. AU02.05 still lacks actual incomplete-setup/provider-failure retry; completed-invitation idempotence now passes.

Before requesting another invitation or changing a fixture, determine whether staging already contains suitable unavailable invitations. The Admin invitation list renders raw status and does not expose the full expiration/audit classification needed for this choice.

Run the complete read-only SQL in [the inventory diagnostic](../../supabase/diagnostics/security_fr_2_5_admin_unavailable_invitation_inventory.sql) once in staging project dczlddwbtgvfdujgcitb. It returns only three variant count groups:
- expired: status expired, or sent with expires_at at/before now;
- cancelled: cancelled without a replacement audit marker;
- replaced: cancelled with the existing cancelled/reason=replaced audit record.

The second count narrows each variant to Free Personal, no recorded payment, no provisioned workspace. The third also requires an Auth account whose ID/email match the invitation and whose email is confirmed. It does not establish password availability, owner control of the mailbox, current sign-in success or API denial.

## Owner handoff and limits

Open the staging Supabase SQL Editor, run the entire diagnostic and return only safe_result. It uses an explicit read-only transaction, a ten-second statement timeout and ROLLBACK. No row identity, address, invitation URL, token, key or arbitrary database error message is selected.

If counts are positive, prepare the recipient-bound denied-read/completion check for an owner-controlled candidate; do not credit a wrong-account/session failure as unavailable-invitation denial. If no existing candidate is usable, record the fixture gap before choosing the smallest planned fixture action. Zero counts are neither a product defect nor a denial PASS. Do not cancel/change the completed invitation, request new mail, reset a password, forge a JWT, impersonate a SQL Auth identity, relax RLS/grants or alter settings merely to obtain this inventory.

Validation is source review against the invitation schema, completion getter/guards and replacement audit writer. No SQL execution or new hosted result by the assistant is claimed. There is no new acceptance case, runtime/UI change or whole W/V/FR.2/Stage3/release acceptance.
