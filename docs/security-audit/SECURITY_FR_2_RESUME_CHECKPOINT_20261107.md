# Mushavo Budget — current staging checkpoint

Updated 8 November 2026. **Stage 3/10 | FR.2/8 | Batch X/Z — hosted work completed; final exit reconciliation being archived.** Y is complete at its selected current-policy authorization boundary. Main Stage3, FR.2 and release acceptance remain open. Production was not changed.

## Completed — do not replay

- Personal/subscription broker run42465233035: 323 guard tests,27 live assertions, exit0; three sessions logged out. [Result](security-fr-2-batch-x-private-file-server-retrieval-staging-result.json).
- Family broker run42465388841: 323 guard tests,25 live assertions, exit0. Same valid removed-member session loses the warmed broker request, Owner retains access. Three sessions logged out; temporary Family deleted. [Result](security-fr-2-batch-x-private-broker-family-corrected-result.json).
- Business initial run42467355998 retained29 passed assertions for Owner/nonmember/member access, raw/signing denial and same-session removal across documents/logos. Its exit1 remains: archive was attempted on this run's new proof attached to an already-paid bill; the existing paid-proof lock correctly refused.
- Only that new document parent was reversibly changed by a privileged operator to its same workspace. The expired-confirmation DELETE never executed. No original bill, bytes, policies or triggers changed. Ordinary authenticated callers lack metadata UPDATE permission. [Correction](security-fr-2-batch-x-business-private-file-fixture-correction.json).
- Business completion run42468803026, source632831f0ad0bfbb376038cfb64f93e56f4fd5f98: **338 guard tests,13 live assertions, exit0**. Workspace-document archive succeeded, identical warmed Owner request became404/no-store with the same session still valid, and both exact files were removed. Two sessions logged out; original seat, suspension and expired term restored. Earlier access/member calls were not repeated. [Combined result](security-fr-2-batch-x-business-private-file-staging-result.json).
- Earlier accepted Y nine-group, role/finance/expiry/team scopes remain accepted at their recorded boundaries. Initial Storage and S3 failures remain archived; never rerun their plans without a new reason.

## Installed source

Staging project dczlddwbtgvfdujgcitb; security/stage-3-authorization branch.

Frontend deployment a1817026-ad12-469a-b41a-ed380b26ffe8: five changed/new public files matched; previous headers/worker/config preserved. get-private-file v4 ACTIVE bundle SHA25633684f5c4b9ea5f6ecc4535fc1bfcab8e2fb90cfb3788a133d66f18b5cfa0054; three runtime files matched, API omits deno.json. The broker checks current Auth/app session and invoker Storage/RLS before and after retrieval, returning private no-store bytes. Its15-second retrieval capability stays server-only. SDK2.110.9 and original29-entry lock remain unchanged.

Catalog ACTIVE matches cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f. New invoker RPC is authenticated-only; anon/service execution denied. One restrictive Storage SELECT policy added; seven prior Storage policies and82 restrictive session guards remain.

## Exact cleanup and preservation

Independent final readback **2026-11-08T09:51:31.129344Z**:

- All four private buckets objects0; runner sessions0; normal/Admin queues0; pending invitations0; only original Owner active.
- Synthetic Business dcf3d122-e99f-4fe5-bbd1-03c3547629df suspended/support20, subscription19, seat1, original expired paid-through2026-11-08T00:00:00Z, profile3/logoNULL. Original profile/subscription values and USD1 paid-bill hashes match baseline.
- New document e8e09b54-76ed-477b-a266-fb88502bcb40 retained archived with workspace parent and68-byte metadata; physical file absent.
- Original PRIMARY/SECONDARY Business snapshots, old permissions/audit fingerprints and both manual Family conversions match. Manual SHA256d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3.
- Payment records5/conversions7, joined workspace mismatches0, historical orphans2 unchanged. Reference FK remains NOT VALID; no historical deletion/validation. [Preservation](security-fr-2-batch-x-final-preservation.json).
- scripts/ci/staging-run.json is archived with enabled:false. No completed live test should replay on reconnect.

## Next work and holds

Archive X's four original exits against the existing role/finance ledger and all four genuine broker scopes, then record Z readiness/Stage3 decision using the affected338 guards, installed boundary and preservation. Distinguish actual JS/synthetic DOM checks from new genuine browser/native preview acceptance.

V SMTP/independent Admin recovery and historical MFA acceptance remain owner-deferred under the selected password-only policy. The agreed signed-in password retry variant remains deferred. Do not send new email probes or alter factors/passwords. Z and Stage3 cannot close while required V work remains on hold.

On reconnect, inspect this checkpoint, current branch head and recorded run result before retrying. No renewed blanket permission or account/password re-entry is required within the already-authorized staging scope.
