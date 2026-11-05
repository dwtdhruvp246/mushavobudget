# Original Batch W recovery continuation

Stage 3/10 | FR.2/8 | Batch W/Z. This continues existing AU04.01/03/04/05 and selected AU05.07 variants; no original case group is added. Preserve accepted AU04.02/06 and prior used-link, normal save/adoption and password sign-in results. Owner-deferred AU03.04 stays deferred.

## Runnable feedback scope

`recovery-request-feedback` reuses the private runner's three existing identity/role preflights and cleans up only its new sessions. Four deployed sources are checked against accepted blob hashes before UI actions.

The UI submits one recovery request for a preflight-absent disposable plus alias delivered to the already connected test inbox if it could receive mail. It requires HTTP200 and the exact generic acknowledgement previously accepted for the known recipient. Two fresh isolated contexts block the request before dispatch or return a controlled HTTP429. The actual page must show operational guidance, retain the email/form and prevent a second dispatch during the local cooldown. No request for an existing recipient is forwarded. No password, profile, workspace, finance or settings mutation is permitted. This does not establish an actual provider quota/429 or Business Edge502 UI result. Private saved password lengths are classified only as shorter-than-eight fixture availability; passwords or exact lengths are not exported.

## Prepared fixture scope — not executed

`recovery-variants` is prepared for two newly created disposable plus-alias identities in the two connected test inboxes. Their passwords are randomly generated in process memory. At most two signup confirmation emails and two recovery emails are planned, plus one absent-recipient generic request. No saved primary account password is targeted.

The intended checks are: a distinct genuine isolated account substituted after link verification must be denied before password update; an actual browser-blocked recovery save must retain both password fields and succeed on retry without reentry; a backdated token belonging only to the new disposable identity must receive the server's real expired-link denial without changing global Auth settings. Backdated controlled expiry is explicitly different from a natural one-hour wait. All contexts close, all known new sessions receive local logout attempts, and exact new fixture/account/workspace/session/token absence must be verified through guarded cleanup.

`staging-recovery-fixtures.mjs` prepares complete expiry and cleanup transactions. Exact email, run metadata and recent creation time are required. Cleanup locks the fixture rows, refuses nonempty financial/shared/Admin/MFA state and unexpected foreign-key references, then deletes only the new empty Free Personal workspaces and their disposable Auth accounts. Auth audit history is retained. The SQL has not been accepted as executed or hosted-verified.

The attempted zero-row cleanup dry run with ROLLBACK on 5 November required a Supabase connector confirmation which expired. No disposable accounts or real test emails were created by that attempt. Do not create fixtures until the guarded cleanup transaction can be executed and verified. An expired connector confirmation is an access/workflow dependency, not a product test failure.

An encrypted mailbox helper is prepared for future execution: ephemeral X25519, HKDF-SHA256 and AES-256-GCM bind each envelope to the exact workflow run, source commit and phase. Only a public key/status and encrypted envelope may leave the private processes. Plain email links, passwords and session credentials are never committed or exported. The private key exists only in the runner process. The current workflow keeps `contents: read`, no status-write grant and no GitHub token passed into the test process; the fixture scope therefore refuses execution before any signup. It needs an explicitly reviewed workflow update after the cleanup prerequisite is resolved.

Local guard tests verify encryption/replay/tamper refusal, recipient/source/route binding, fixture SQL input restrictions and the feedback-only mutation boundary. Local tests do not count as hosted recovery acceptance. No frontend deployment or production/native change is included.
