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


## Later hosted attempt and mandatory cleanup

FRE301: the rollback-only rehearsal succeeded on retry. The finite workflow temporarily received status-write permission and a GitHub token only for publishing the ephemeral public key/status; repository content stayed read-only. Two disposable accounts were created/confirmed through the encrypted mailbox. The first recovery request returned actual HTTP429 over_email_send_rate_limit, correlated in read-only Auth/edge logs for this exact run. The test stopped without retry or password update. This does not establish any expiry, wrong-session or save-retry PASS, nor an SMTP quota/reset value.

Both created sessions were locally logged out and the isolated browser closed, but **2 disposable Auth accounts and2 empty Personal workspaces remain**, with0 sessions. Both actual cleanup confirmations expired. The [saved complete cleanup SQL](../../supabase/diagnostics/security_fr_2_5_recovery_fixture_cleanup_w300.sql) must receive Supabase connector confirmation, execute successfully and have exact absence read back before further fixture/mail operations. The initial blocked receipt is historical; the [latest stopped-run outcome](security-fr-2-batch-w-recovery-rate-stop-cleanup-required.json) controls next actions.

The current workflow again removes status-write permission/GitHub token and returns to its eight-minute limit; the expired encrypted mailbox is removed at the tip. The future request helper now reports safe named errors and accepted-vs-attempted mail requests, and waits for a real rate warning before stopping on429;25 local guards pass, without a hosted rerun. Gmail full-format body content is already decoded: parse the exact expected recipient's HTML href, HTML-unescape ampersands only, and never apply quoted-printable decoding again or print query parts. The private terminal helper is the sole plaintext-link ingress; only ciphertext is committed. Existing accepted W evidence and the AU03.04 deferral remain.


## Exact disposable cleanup resolved — 5 November 2026

FRE302 [receipt](security-fr-2-batch-w-approved-recovery-fixture-cleanup-pass.json) records the owner's explicit chat approval, exact guarded SQL execution in the existing staging dashboard after another connector confirmation expiration, and independent absence readback. The2 disposable Auth accounts and2 empty Personal workspaces are removed; fixture profiles/sessions and orphan workspace/session rows are0. Original3 selected active profiles/owned Personal workspaces remain. No additional email, password or global setting change occurred. No further owner approval/manual SQL is required for this completed cleanup. The prior stopped-run/expired-confirmation records remain historical; actual email-rate availability and remaining original W variants stay open. Do not recreate the old fixture or automatically retry email because cleanup passed.
