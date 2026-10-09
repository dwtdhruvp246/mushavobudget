# 2.2 — Public contact-form abuse controls

Started 9 October 2026 at 2.2.1. The 2.1 checkpoint is closed with scoped passes and the failed production HTTP redirect carried to final remediation. F09 remains open. Three finite work items; no production contact traffic, invitations, emails or push tests are requested by this baseline.

## Why this step matters

The reviewed Contact page uses a public Supabase client to insert directly into enquiries. HTML validation and a browser-only honeypot improve the normal form but can be bypassed by a direct API caller. The selected migration grants six insert columns to anon and authenticated and applies field/default-workflow checks in RLS. Staff-only reads/updates and server normalization exist in source; these are not proof of challenge verification or durable anti-spam quotas.

Reviewed repository files at 79866c0cacb57d4d709adc4d3a3d386d0fef057a: site.js, contact.html, 20260903123000_direct_enquiry_submission.sql and 20260903120000_align_enquiry_workflow.sql. No challenge or durable quota was found in that selected path. This is a source finding/inference, not independent proof of the current hosted schema, all reachable functions or runtime abuse behavior.

## Bounded work

| Item | Work | Outcome needed |
|---|---|---|
| 2.2.1 | Source path plus one staging metadata batch | Effective column/table grants, RLS/policy/constraint/trigger metadata |
| 2.2.2 | Justified candidate and local checks | Normal enquiries remain possible; direct bypass, malformed/oversized/challenge/quota cases handled |
| 2.2.3 | Controlled staging acceptance and closure | One owner batch; actual passes/failures/unavailable cases retained for final remediation |

## Current owner action — staging metadata only

Use the Supabase staging project **dczlddwbtgvfdujgcitb**. Production **kttkospkblwvguuwnhjj** is not the execution target. Fetch the branch, read the pinned diagnostic through git show, copy it to the clipboard and manually paste into the verified staging SQL Editor. Do not checkout/reset/clean the owner's native worktree.

Diagnostic: supabase/diagnostics/security_stage_2_contact_metadata.sql. It uses one repeatable-read read-only transaction, statement/lock timeouts and a single SELECT returning five rows, followed by ROLLBACK. This avoids the earlier multiple-SELECT/last-result confusion. It returns catalog privilege/RLS/constraint/trigger/routine-name metadata only. It does not return customer enquiries, credentials, function bodies or policy expressions; it inserts no test rows and dispatches no Edge/email/push request.

Effective privilege metadata includes inherited/PUBLIC and table/column grants. It does not execute an insert or prove RLS/challenge/quota behavior. Constraint/routine names and flags are not complete reachable-path or enforcement proof. SQL cannot establish the hosted project reference; owner Dashboard verification remains necessary. If the table/roles are missing, the diagnostic reports metadata rather than creating them.

Send all five result rows and safe errors. No password, API key or private enquiry content is needed. Changes/testing follow this baseline; further production/provider prerequisites or unresolved controls will be explicitly bounded and carried, not added indefinitely.
