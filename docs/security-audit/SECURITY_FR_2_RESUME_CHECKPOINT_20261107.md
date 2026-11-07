# Mushavo Budget — current staging checkpoint

Updated 7 November 2026.

**Stage 3/10 | FR.2/8 | Batch X/Z — IN PROGRESS.** Main Stage 3, FR.2, full Batch X/Y and release acceptance remain open. Production was not changed.

## Completed scopes and evidence

| Scope | Actual result | Evidence |
|---|---|---|
| Three ordinary Business actors | 42 live assertions passed, exit 0; 75 workflow guard tests passed. The ordinary team manager removed another member, Owner/self/escalation denials held, permission overrides were enforced, and the removed member's existing session lost Business access while retaining its own Personal workspace. | [Team result](security-fr-2-batch-x-three-ordinary-team-staging-result.json) |
| Private-file cache comparison | 21 live assertions passed, exit 0; 84 workflow guard tests passed. Two harmless Personal files used requested upload cache TTLs of 0 and 60 seconds. Both warmed and previously unused signed URLs were denied after token expiry in this staging run. | [Cache result](security-fr-2-batch-x-private-file-cache-staging-result.json) |
| Business expiry and Owner-only renewal gate | Prior 34 live assertions passed, exit 0; same ordinary sessions were checked before and after supported expiry. Renewal payment itself was not exercised. | [Expiry result](security-fr-2-batch-x-business-expiry-staging-result.json) |
| Independent queue overlap | Two real independent PostgreSQL connections overlapped; the second worker saw the pending row and claimed zero while the first held it. Service-role claims were modeled in database transactions; no actual scheduler/provider delivery is inferred. | [Overlap result](security-fr-2-batch-y-independent-queue-overlap-result.json) |
| Family proof fresh authorization | Prior 22 live assertions passed. Fresh access and new signing were denied after removal, but the warmed authenticated original URL returned its cached harmless bytes. | [Open cache finding](security-fr-2-family-file-cache-carry-forward.json) |

The third ordinary credential is now verified through real staging sign-in. No account or password was created or reset. The outdated Browser/account prerequisite is resolved. The first team run's void-RPC assertion issue and first cache run's expiry-error classifier issue remain in their separate initial-review receipts; both corrected runs passed after cleanup.

## Cleanup and preservation

- Synthetic Business `audit-batch-x-receipt-d7be160c2026` is suspended, support version 16, subscription version 15, one seat, original paid-through `2026-11-08T00:00:00Z`.
- Owner is the only active member. The original inactive member's finance-manager role is restored; the third synthetic membership remains inactive for history. Temporary scopes, overrides and pending invitations are zero.
- All eight team-run sessions and four cache-run sessions were logged out. Independent active runner-session count is zero.
- Both successful cache-run objects and both initial-run objects are absent. Normal and Admin queues are empty. No CDN purge, bucket policy, Auth setting, email, provider-payment or production change was made.
- The original USD 1 paid bill, original Business fixture counts and old role/permission/audit fingerprints remain preserved. Manual Family fingerprint remains `d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3`; two historical conversion orphans remain untouched.
- Catalog remains ACTIVE and matches `4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7`.
- Latest independent cache cleanup readback: `2026-11-07T18:57:22.186671+00:00`. The run plan is disabled. Do not rerun archived setup scripts against advanced fixture versions.

## Remaining authorized work

1. Reconcile the installed backend routine/caller matrix and applicable current-policy authorization-change races for Batch Y. Reuse the accepted caller denials, queue expiry/replay, HTTP idempotency and independent-overlap evidence; real provider delivery remains later FR.4 work.
2. Resolve the existing cached-original-file revocation carry-forward. The new signed-expiry measurements do not close the observed Family membership-removal behavior. Freeze a concrete serving contract and affected-case list before changing file delivery.
3. Reconcile original Personal/Family/Business exits using the [current coverage ledger](security-fr-2-batch-x-remaining-coverage-ledger.json), then perform justified integrated Batch Z checks and issue the actual Stage 3 decision.
4. Keep owner-deferred SMTP/independent Admin recovery and the agreed signed-in password-change retry variant explicit. Historical MFA remains on hold under the selected password-only policy.

No new user credential, manual SQL or terminal step is required for the completed scopes. Preserve accepted evidence and initial failures; do not silently add batches or claim whole-stage acceptance from these scoped passes.
