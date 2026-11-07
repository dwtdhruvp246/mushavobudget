# Resume checkpoint — 7 November 2026

Current progress: **Stage 3/10 | FR.2/8**. Full lettered X, Y and Stage 3 remain incomplete. Production was not changed.

## New completed scopes

- Batch X: 34 real HTTP assertions passed across the same ordinary sessions before and after actual Business entitlement expiry. Owner/member operational reads and writes were denied after expiry; personal workspaces remained usable; only the Owner retained billing/renewal authorization. Existing pricing remains disabled, so a renewal payment was not tested. Hosted commit: `3ec696a24834fee3ececbba38d5984f13915b1e5`, workflow `42398220245`, job `128480111504`, exit 0; 66 workflow guard tests passed. Evidence: [expiry receipt](security-fr-2-batch-x-business-expiry-staging-result.json).
- Initial expiry runner precondition failure is preserved in [initial review](security-fr-2-batch-x-business-expiry-initial-review.json). The Admin status API returns a support-action UUID, not the workspace UUID. Manual grant end dates must be after today. Corrected run used supported operations and independent exact-term restoration.
- Batch Y: two real independent Postgres connections overlapped. Dashboard worker A held the claimed row for 20 seconds; connector worker B saw the pending candidate, observed the advisory hold, and claimed zero rows. Distinct backend hashes and timestamps establish overlap. Service-role claims were modeled in the database transactions; no actual Edge dispatcher, scheduler or provider delivery is inferred. Evidence: [independent overlap receipt](security-fr-2-batch-y-independent-queue-overlap-result.json), exit 0. Earlier serialized failure remains unchanged.

## Final cleanup and preservation

- Synthetic Business `audit-batch-x-receipt-d7be160c2026`: suspended, support version 12, subscription version 11, one seat, original paid-through `2026-11-08T00:00:00Z`.
- Owner is the only active member; no pending invitation, temporary member scope or permission override. No denied supplier insert succeeded.
- All six sessions across the initial and corrected expiry runs were locally logged out; independent session count zero.
- Independent concurrency fixture deleted; both notification queues and matching advisory-lock count are zero.
- The synthetic USD 1 paid bill, old role/permission/audit fingerprints and manual Family rows remain unchanged. Manual Family fingerprint: `d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3`.
- Catalog remains ACTIVE and matches `4646c0fe0367fe033b4594428f9c180eb96ca9b39ed2d1a2024bdc843804c3d7`.
- One synthetic manual grant/history/Owner notification from expiry cleanup is retained. No real payment, email or provider request was made.
- The run plan is disabled. Do not rerun old fixture setup scripts: their reviewed versions have advanced.

## Next prerequisite and remaining scopes

The three-person nonowner-manager-removes-member case needs a third genuine ordinary session. An existing candidate account was read back as confirmed, active, nonstaff, with one Personal workspace and no active membership in the synthetic Business. No account/password was created or changed. The six previously saved GitHub secrets cover USER_A, USER_B and ADMIN only; USER_C credentials have not been supplied. Add `MUSHAVO_STAGING_USER_C_EMAIL` and `MUSHAVO_STAGING_USER_C_PASSWORD` privately, then bind the selected identity explicitly in a finite new runner scope before any team changes. Never print or commit credentials, tokens or email bodies.

Other carry-forward: [observed cached-file access after membership removal](security-fr-2-family-file-cache-carry-forward.json), remaining backend caller/authorization-change/dispatcher acceptance, deferred SMTP/recovery coverage, and integrated Batch Z. Preserve the prior passes and failures. No full stage or release acceptance is claimed.
