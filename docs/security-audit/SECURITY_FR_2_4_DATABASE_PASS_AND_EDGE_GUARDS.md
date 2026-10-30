# Windows result received — FR.2.4.E4.4: 88 PASS, exit 0

16 October 2026, FRE68. [Owner receipt](security-fr-2-email-edge-owner-Windows-pass.json) records 88/88 PASS on Node v22.17.0/PGlite 0.5.8, with all 84 source hashes and 23 syntax checks matched. The TypeScript experimental warning is non-failing. This supersedes the Windows-pending action below. No hosted installation or full finding is accepted. Continue with the [shared email screen and Admin contract](SECURITY_FR_2_4_EDGE_PASS_AND_EMAIL_SCREEN.md). The original FRE67 checkpoint is retained below.

---

# FR.2.4.E4.4 — database guards passed on Windows; Edge integration ready

16 October 2026, FRE67. The [owner Windows database receipt](security-fr-2-email-data-guard-owner-Windows-pass.json) records 32/32 PASS, zero FAIL, exit 0 on Node v22.17.0/PGlite 0.5.8. All 63 input hashes and 54 migrations matched. This is the E4.3 offline integration result; no hosted database guard was installed and no finding is closed.

## Four user entrypoints now check the caller's proof

The actual source files invite-admin-user, invite-business-member, send-test-push and the manual branch of sync-exchange-rates now use [email-session-assurance.mjs](../../supabase/functions/_shared/email-session-assurance.mjs). Each first validates the bearer with its existing user client's getUser(), then uses that same bearer-bound client to call email_gate_current_session_verified with no arguments. Only an exact boolean true with error:null passes. False yields a fixed EMAIL_VERIFICATION_REQUIRED/403. Missing backend, SDK error, malformed response or an eight-second timeout yields EMAIL_VERIFICATION_UNAVAILABLE/503. SDK errors and private payloads are not returned. There is no role/AAL/client-flag shortcut, service-client fallback or approval cache.

Admin invitations retain the existing super_admin/admin_staff allowlist before reservation, identity metadata changes or delivery. Business invitations retain caller-bound create/resend reservation RPC authorization before privileged dispatch. Test push retains the active-account check, caller-selected recipient, cooldown and protected destination transport. Manual FX sync retains the super_admin/admin_staff/finance_staff allowlist before provider requests or writes. Its existing service-client construction still occurs before authorization, but no privileged query or provider work precedes proof. The cron-secret branch remains independent of user verification.

The two notification dispatchers are byte-unchanged: their server secret and cron source still guard the queue. Public enquiries and their actual handler are byte-unchanged: origin/content validation, Turnstile and quota controls remain the public boundary. All seven source entrypoints are classified in the [contract](security-fr-2-email-edge-candidate-contract.json).

The Admin Edge paths select the owner's all-user email-verification policy. Existing TOTP helper and Admin UI bytes remain unchanged and their legacy regressions are retained; they do not establish the new email UI contract. Email proof is not Supabase AAL2 and does not satisfy the original stronger TOTP acceptance criterion. The remaining Admin status/RPC/UI changes must be coordinated with the backend, application database guards, login/code/remember-device flow and Pages gateway. Deploying these Edge functions alone before the proof RPC exists produces 503 denials. No standalone deployment is requested.

## Local evidence

[Verifier](../../scripts/verify-fr-2-email-edge.mjs), [84-file source manifest](security-fr-2-email-edge-source-manifest.json), [receipt](security-fr-2-email-edge-local-checks.json).

| Selected batch | PASS |
| --- | ---: |
| New actual proof helper and stripped Edge boundary cases | 28 |
| Actual SQL proof behind all four Edge handlers | 6 |
| Affected existing handler, notification, staging builder and frozen MFA UI regressions | 54 |
| Total | 88 |

All 88 pass with zero failures, cancellations, skips or todo, exit 0; 23 JS/stripped-TS syntax checks and all 84 hashes pass locally on Node v24.19.0. The SQL batch applies all 54 unchanged migrations plus the actual E2 backend, E4.2 predicate and E4.3 application guards to PGlite 0.5.8. It verifies password-only denial, real stored proof establishment through challenge/delivery/verify SQL, a denied second session, password invalidation and missing RPC grant failure across each of the four real handler bodies. SDK getUser, privileged reservations, provider mail/push and HTTP are synthetic ports. The proof read is actual SQL, not a constant mocked approval. Other cases verify role and recipient controls, no protected effects before proof, malformed truthy payload denial, timeout, error sanitization, per-request rechecking, scheduled-only secrets and the actual public enquiry challenge control.

The historical tests continue to cover their selected behaviors; this is not a full 882-case regression rerun. stripTypeScriptTypes warnings are non-failing. These checks do not resolve/bundle/typecheck Deno or Supabase SDK dependencies or verify actual provider JWT validation, real Auth callbacks, provider queues, email delivery, notification delivery, hosted SQL, production or native behavior. No real mail/push/job/provider request, deployment, account role promotion or credential access occurred. Every original finding remains open.

## Owner action

Run the complete pinned PowerShell command in chat. It exports the selected committed source into a new temporary folder, installs one exact locked PGlite dependency there using npm.cmd ci --ignore-scripts, then runs the new verifier with default Node fetch/HTTP disabled. npm may contact the public npm registry; tests use explicit synthetic ports. The network guard is not an OS sandbox. Package name/version and package-lock registry/integrity metadata are checked; installed package bytes are not independently hashed.

Return the JSON and exit code. Expected: OFFLINE_ACTUAL_EMAIL_EDGE_AND_SQL_PROOF_INTEGRATION_SCOPED_PASS, 88 PASS, zero FAIL, exit 0. No Supabase SQL, private Zoho file access, password/token entry, Cloudflare change, upload, real email or APK action is requested. After the Windows result, continue with the remaining coordinated Admin/UI/canonical/Pages integration and hosted acceptance. Existing 7-day device policy and open-session behavior remain unchanged.

All 20 findings remain open; full re-audit PLANNED_NOT_PERFORMED and release gate OPEN_PENDING_REQUIRED_EVIDENCE. Original stage objects, prior evidence, 123-row coverage register, retained fixtures and manual conversion baseline are preserved. Production excluded; APK/native deferred.
