# Batch I complete: genuine staging email proof and rolled-back recovery

23 October 2026, FRE137. The [owner safe receipt](security-fr-2-email-batch-i-owner-pass.json) checked at `2026-10-23T04:47:35.020Z` reports `BATCH_I_REAL_STAGING_EMAIL_PROOF_AND_ROLLED_BACK_RECOVERY_SCOPED_PASS`, 21 direct hosted requests, one code-email request, 137 source identities and combined exit 0. The requested run commit was `46cafec09430ce62807bffbe5b3453827cc88875`. Gateway-internal provider requests are excluded from the direct count. This is an owner-supplied runner result, not a separate assistant-run hosted test or provider attestation.

## What passed on staging

- The fixed staging target matched before and after the run. Both quarantined catalog observations passed; the live publishable key matched the retained snapshot. The encrypted gateway packet was read only and its bytes remained unchanged. Privileged gateway configuration was not passed to the child.
- The gateway denied unauthenticated status. One selected configured ordinary active staging account signed in and its Auth identity was independently validated by the runner. Password-only gateway/RPC/selected-profile access was denied while quarantined.
- Exactly one email request was accepted by the provider. The owner received its inbox code, verified it, and the consumed code was refused on replay. The secure nonremember cookie-clearing header was observed. Dispatch and verification uncertainty flags are false; no automatic resend is reported.
- The real-session recovery transaction exercised the reviewed resume/quarantine functions and authenticated-role/RLS checks, then rolled back. The fresh independent catalog afterward still matched quarantine. There were zero committed resume/quarantine requests. The ACTIVE role check was inside privileged SQL, not an ACTIVE HTTP/browser request.
- After proof, quarantined gateway/RPC/selected-profile access remained denied. Local Auth logout returned HTTP204. A separate selected-session readback verified absence of that terminal-created Auth session and its proofs/challenges. Cleanup uncertainty is false. Private send/rate audit and quota records were retained.

Application queries were limited to the selected account; no application row was explicitly written. No Auth settings, secrets, schedules or deployments were changed. Production and native packages were unchanged; APK updates remain deferred.

## Separate evidence scopes

The existing assistant local correction receipt remains 53/53 (14 SQL/gateway/transport cases and39 actual PowerShell helper/parser cases),137 hashes and5 JavaScript syntax checks on Node24.19.0/PowerShell7.4.6/Linux. It is not a new owner Windows offline receipt. The owner did not supply the separate offline verifier JSON on this retry; no new owner offline count, Node version or PowerShell version is inferred. Successful owner execution now verifies the selected Windows private dialogue/DPAPI/packet workflow at the scope of this safe receipt. It does not retrospectively prove the exact cause of the earlier broad local failure, whose receipt remains preserved.

## Remaining acceptance and next preparation

**Batch I is complete at this scope. Application access remains QUARANTINED. Do not rerun Batch I or reinstall Batch H to advance the checkpoint.** The original earlier failed receipt and local correction evidence remain intact.

The next preparation should combine controlled ACTIVE HTTP acceptance with browser/new-device/remembered-device, cross-account and revocation/session lifecycle tests where their prerequisites permit. Prepare the exact staging-only transition/return-to-quarantine controls, a bounded actor/fixture/request inventory, sensitive-input handling, independent cleanup/readback, and meaningful local failure tests before providing a pinned owner execution command. No such new handoff is prepared or approved by recording this result, and no committed resume is requested here.

The broader plan still requires remaining Personal/Family/Business/Admin positive/negative workflows, expiry/suspension/revocation/provider callbacks, full scheduler/external caller coverage, real PostgreSQL concurrency, committed recovery and final re-audit. Browser cache/cookies/device restore and ACTIVE HTTP/cross-account acceptance remain explicitly false in this receipt. The observed cookie-clear header does not establish browser/device behavior. No full finding is closed; overall hosted acceptance, public web launch and Google Play/Apple App Store approval remain pending.

This checkpoint changes evidence/documents only. No runtime code, migration or earlier source pin is changed; no additional hosted action or email was performed by the assistant. The unrelated Business owner-result working modification remains untouched.
