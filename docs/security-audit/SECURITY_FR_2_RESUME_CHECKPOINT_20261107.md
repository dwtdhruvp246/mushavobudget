# Mushavo Budget — current staging checkpoint

Updated 8 November 2026 after the corrected private-file tests. **Stage 3/10 | FR.2/8 | Batch X/Z — current work.** Batch Y is COMPLETE at its selected current-policy authorization boundary. Full X, main Stage 3, FR.2 and release acceptance remain open; V, X and Z remain three required packages. Production was not changed.

## Latest completed work

- Added a private byte download broker for payment proofs, subscription proofs, Business documents and logos. Caller Auth and current app-session checks precede a SECURITY INVOKER Storage/RLS lookup; a second current object/version/RLS check follows the server fetch. All success/error responses are private no-store. Frontend binds bytes to the captured user/workspace/epoch and current listed file; stale responses never open a file.
- Current staging frontend deployment: a1817026-ad12-469a-b41a-ed380b26ffe8. Five changed/new public files match local review; the previous staging headers/worker/config were preserved.
- Current get-private-file Edge function: v4 ACTIVE, verify_jwt false because its body performs user authentication. Bundle SHA256 33684f5c4b9ea5f6ecc4535fc1bfcab8e2fb90cfb3788a133d66f18b5cfa0054. Three runtime files read back exactly. The API omits deno.json; no config readback is claimed.
- Server fetch uses an exact 15-second retrieval capability kept only inside the broker. The client receives bytes. This preserves per-request authorization without warming the authenticated-original route in the selected genuine tests. The dependency lock is restored to the original 29 entries, SHA256 eb373bd333000e850a8775bc67796baee9aecbebc818bd53fbdd1e7f507ae8ff; SDK2.110.9 is unchanged.
- Personal/subscription acceptance: 323 CI guard tests, 27 live assertions, 25 exercise requests, three created/three logged-out sessions; exit0. Owner/Admin reads worked; foreign/anonymous reads, original GETs before/after/nonce and user signing were denied. [Result](security-fr-2-batch-x-private-file-server-retrieval-staging-result.json).
- Corrected Family acceptance: 323 CI guard tests, 25 live assertions, 31 exercise requests, three created/three logged-out sessions; exit0. Active member bytes200, same-session warmed request404/no-store after supported Owner removal, same application session still valid, membership false, Owner access retained, raw bytes/signing denied. [Result](security-fr-2-batch-x-private-broker-family-corrected-result.json).
- Initial actual Storage download warmed the authenticated original route even with cacheNonce. The initial Family check caught it and cleaned up. Two S3 variants were rejected with AccessDenied/Missing signature; all their files/sessions were cleaned. These failures remain in their separate receipts. The corrected server-only retrieval run is the accepted implementation; do not rerun archived S3/Family plans.

## Current state and preservation

- Latest independent cleanup: 2026-11-08T09:12:13.243926+00:00. All four private buckets have zero objects; temporary Family rows0, runner sessions0, normal/Admin queues0.
- Catalog ACTIVE matches cc122f36b6cc70e4fa88fe12a765cc83f24a586d495dfd3084f26edc2134e84f. Added only the invoker metadata RPC and one restrictive SELECT policy; all seven previous Storage read/session/delete-selection policies remain. The original 82 session restrictive guards and guarded application RPCs were not relaxed.
- Synthetic Business audit-batch-x-receipt-d7be160c2026 remains suspended, support18, subscription15, seat1, original expired paid-through 2026-11-08T00:00:00Z. No Business term/status/role/profile writes were made in this continuation.
- Earlier Y/team/expiry/currency/finance/ordinary passes and original USD1 paid bill remain retained. Original manual Family SHA256 d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3 and two historical conversion orphans remain explicitly owned by prior preservation evidence; no historical cleanup was attempted.
- The active CI plan is archived/disabled. Use this checkpoint and read current state before preparing any further finite run.

## Remaining authorized work

1. Verify the newly routed Business document/logo broker with real Owner/member/foreign/archived cases. The generic handler/local checks cover these buckets, but hosted Business positive acceptance has not yet run. Original paid term is now expired: do not replay old setup scripts or assume previous versions.
2. Reconcile full X exits and run justified integrated Z checks. Reuse the accepted Y nine-group ledger and previous recorded scopes instead of repeating them.
3. Keep owner-deferred SMTP/independent Admin recovery, agreed signed-in password retry variant and historical MFA hold under the selected password-only policy explicit. Do not broaden these into new email probes.
4. No account/password re-entry or renewed blanket permission is required. On reconnect, inspect current deployment/run state before retrying an action.
