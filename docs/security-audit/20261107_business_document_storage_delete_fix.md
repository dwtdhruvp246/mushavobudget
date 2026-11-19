# Business document deletion correction

The hosted receipt test completed its 20 authorization and replay assertions. Physical cleanup then returned an empty bulk-delete result; the follow-up single-object delete returned HTTP 400. The archived document is hidden by its ordinary document and Storage SELECT policies. Storage deletion also needs SELECT visibility.

The migration adds a deletion-only SELECT policy and an authoritative metadata helper. The helper checks the current application session, active membership/entitlement, document-management permission and claim/bill parent access. It rejects registered active files even when their metadata is hidden by RLS. Existing upload/download policies are retained. Unregistered creators retain cleanup of their own upload; managers retain workspace orphan cleanup.

The helper is denied to anonymous callers. Archived downloads, signing, listing, copy and move receive no access from the new policy. No Storage rows are inserted or deleted through SQL on the hosted project.

Validation: `node --test tests/business-document-storage-delete.test.mjs` passed 28 assertions using real PostgreSQL RLS in PGlite 0.5.8. Application/session predicates are modeled in that local test; hosted acceptance must be recorded separately.

The paired staging install refuses any change from the independently reviewed catalog hash, checks the exact staging target, and refreshes its catalog stamp in the same transaction. The migration is a production candidate until release review; this work applies it only to staging.
