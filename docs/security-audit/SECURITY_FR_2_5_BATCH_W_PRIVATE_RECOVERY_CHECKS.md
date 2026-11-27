# Original Batch W recovery continuation

Stage 3/10 | FR.2/8 | Batch W/Z. This continues existing AU04.01/03/04/05 and selected AU05.07 variants; no original case group is added. Preserve accepted AU04.02/06 and prior used-link, normal save/adoption and password sign-in results. Owner-deferred AU03.04 stays deferred.

## Runnable feedback scope

`recovery-request-feedback` reuses the private runner's three existing identity/role preflights and cleans up only its new sessions. Four deployed sources are checked against accepted blob hashes before UI actions.

The UI submits one recovery request for a preflight-absent disposable plus alias delivered to the already connected test inbox if it could receive mail. It requires HTTP200 and the exact generic acknowledgement previously accepted for the known recipient. Two fresh isolated contexts block the request before dispatch or return a controlled HTTP429. The actual page must show operational guidance, retain the email/form and prevent a second dispatch during the local cooldown. No request for an existing recipient is forwarded. No password, profile, workspace, finance or settings mutation is permitted. This does not establish an actual provider quota/429 or Business Edge502 UI result. Private saved password lengths are classified only as shorter-than-eight fixture availability; passwords or exact lengths are not exported.

## Live fixture evidence and the remaining retry

The single-fixture run recorded live passes for AU04.03 and AU04.04. The different verified staging identity was denied before any password write. Supabase returned HTTP 403 `otp_expired` for the controlled disposable link. The runner restored the unused token's original timestamps, logged out its three sessions, and verified the fixture absent after cleanup. [Recovery evidence](security-fr-2-batch-w-single-fixture-recovery-partial.json).

The prior save-retry attempt stopped at a runner guard that rejected the SDK's two null PKCE fields. [Chromium evidence](security-fr-2-batch-w-controlled-browser-checks.json) verifies the corrected guard with the pinned SDK. The live `recovery-save-retry` plan selects AU04.05 alone and uses one new disposable account, one confirmation email, and one recovery email. Its first browser password update is blocked before dispatch. It checks both fields and retry controls, forwards one exact password-only retry, and verifies the intended account and sign-in with the new password.

Only the verified new recovery session can call the app's argument-free Personal workspace provisioning function, once after the successful password response. The fixture's email, run marker, age and account/session binding guard the run. The disposable password is generated in process memory. The retry-only plan uses no saved test-account credentials.

`staging-recovery-fixtures.mjs` builds the full cleanup transaction. Confirm that the staging dashboard is available before creating the fixture. The cleanup locks the exact rows, rejects unexpected references and nonempty financial/shared/Admin/MFA state, and removes the new empty Free Personal workspace and disposable Auth account. Read back account, profile, workspace, token and session absence independently. Auth audit history is retained.

The run checks its earliest email time and refuses GitHub reruns before contacting Auth. The encrypted mailbox binds each envelope to the exact workflow run, commit and phase. The default workflow is read-only. Enable status publication and the workflow token only for the bounded live run, then remove the temporary permission and encrypted mailbox from the branch tip.

Local guard tests verify encryption/replay/tamper refusal, recipient/source/route binding, fixture SQL input restrictions and the feedback-only mutation boundary. Local tests do not count as hosted recovery acceptance. No frontend deployment or production/native change is included.
