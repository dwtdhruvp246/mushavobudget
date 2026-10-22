# Current checkpoint — Batch E canonical database integration implemented, 114/114 local pass

22 October 2026, FRE125. [Batch E handoff](SECURITY_FR_2_4_BATCH_E_HANDOFF.md) integrates the reviewed staging controls through a new dormant migration56 and an existing54 registration bundle. All original55 migration bytes and the canonical55 prefix remain unchanged; current schema renders all56. The integrated path disables the old offline activation body before exposing private explicit registration. [Local verification](security-fr-2-email-canonical-rollout-local-checks.json) passes 114/114, 88 hashes and 18 syntax checks, including actual three-path catalog parity and registration/quarantine/recovery behavior. Historical54/55 fixtures and earlier evidence are explicitly retained. Native Windows verification is pending and requires no credentials or hosted SQL. Hosted target/Pages readiness, installation/recovery, live authorization/delivery and full acceptance remain pending. Existing staging Edge deployment is complete; production/native unchanged and APK deferred. Earlier checkpoints follow.

---

# Windows checkpoint — E5.8 candidate70PASS received

21 October2026,FRE100. [Owner receipt](security-fr-2-email-staging-rollout-owner-Windows-pass.json) at pinned commit `0a0244f05e8b81f744afbca526f5a7c80a92564d`: Node22.17.0/PGlite0.5.8,78source hashes,12syntax checks,70tests/70PASS/0fail,COMPLETE,exit0. All three groups returned0 cancelled/skipped/todo and exit0. No execution timestamp was supplied; received date is not an invented runtime timestamp. This supersedes the Windows-pending action below. No hosted SQL/activation/upload/mail occurred. [Next read-only targeting handoff](SECURITY_FR_2_4_WINDOWS_PASS_AND_MANAGEMENT_TARGET.md) is scoped separately; canonical/candidate integration and hosted rollout remain pending. Historical implementation evidence follows.

---

# FR.2.4.E5.8 — staging activation and recovery candidate

21 October 2026. Source parent `5aecaff46cc4ad77315cbf3a311507fa81e27c4c`. The execution environment is available again. This checkpoint implements and tests an offline candidate; it provides no hosted SQL or deployment command.

## Implementation and independent boundaries

[Candidate SQL](../../supabase/candidates/security_fr_2_4_email_staging_rollout.sql), [deterministic renderer](../../scripts/lib/email-staging-rollout-source.mjs), [check-only source CLI](../../scripts/check-fr-2-email-staging-rollout-source.mjs), [78-input manifest](security-fr-2-email-staging-rollout-source-manifest.json), [local receipt](security-fr-2-email-staging-rollout-local-checks.json).

The original 55 ordered migrations, canonical schema, original installer renderer and four SQL components are unchanged. This separate candidate uses the same four reviewed components, original private invoker installer, exact hook guard and final 148-RPC/82-policy assertions. It does not replace the original ordered registration migration or silently change historical receipts. Normal migrations still register only the original offline installer. Candidate/canonical integration remains required before a hosted handoff; do not apply both registration sources or overwrite an existing namespace.

Registration requires an explicit action and selected project acknowledgement, refreshes all nine reviewed catalog checks, then registers dormant private controls. Activation requires a different action, rechecks the nine prerequisites with the expected dormant namespace, executes all four components atomically and starts QUARANTINED. It does not accept OFFLINE_ATOMIC_REHEARSAL as its activation acknowledgement. The existing original installer remains unchanged and offline-only.

The project setting is a privileged operator acknowledgement, **not independent server target attestation**. Matching metadata plus a copied target string cannot prove which provider project is connected. A separate trusted staging connection/target handoff is still needed; this candidate is not ready for hosted execution on that basis alone.

## Recovery after a committed activation

Private `mushavo_email_install.quarantine()` changes the protected control row to QUARANTINED. The actual session-valid predicate then denies ordinary and Admin email-verified access through the same RLS, RPC and service-status paths. It retains policies, wrappers, Auth sessions, application rows and verification proof rows. Existing privileged/service paths retain their original bypasses; this is containment of authenticated application access, not a global database or scheduler shutdown.

Private `resume()` requires its own action acknowledgement, privileged origin and matching selected security catalog identity. The identity includes selected public/Storage/email/control function definitions, ownership and effective API execution grants; policies; table RLS, ACLs and options; schema usage; selected columns and constraints; application/Auth triggers; and event-hook definitions and bindings. A changed selected entry refuses reopening. It is not a hash of all database catalogs, external services or application contents. Quarantine remains available for containment when this identity has drifted. Its private state table forces RLS and has no API grants or policies.

This is a forward recovery path that keeps enforcement installed, not reversal to password-only access. Repair a provider/credential/deployment problem under containment, retain the reviewed database catalog, then explicitly resume after review. If database source must change, a separately reviewed repair and new recovery contract is required. Do not edit the saved digest or disable guards to force resume. Credential rotation is not performed by these SQL controls. A Pages rollback alone does not restore database behavior.

Containment takes effect according to PostgreSQL statement/transaction visibility; it does not terminate requests or transactions already running. Actual parallel PostgreSQL isolation, lock timeouts under contention, and cross-service recovery have not been verified. These remain required before hosted acceptance.

## Verification

The actual final verifier reports **70 PASS, zero FAIL, exit 0**, Node v24.19.0, PGlite 0.5.8, **78 source SHA256 matches and 12 syntax checks**:

- 30 new source/candidate SQL checks: exact generation, no CLI execution mode, target/action acknowledgements, privileged origin even after accidental grants, replica refusal, private forced-RLS control, prerequisite refresh at registration and activation, late failure rollback, caller rollback, committed quarantine, actual service proof/status behavior, ordinary ownership/Admin refusal, repeated-state refusal, selected policy/function/ACL/RLS/trigger drift and unknown-hook refusal, missing control row, and explicit resume.
- 23 retained original source/atomic installer cases, including canonical55 parity and committed proof behavior.
- 17 retained observed varchar(255)/read-only baseline/actual SQL cases.

Tests use fresh modeled in-memory application databases, exact reviewed hook fixtures, synthetic users and service-role contexts. Four extra event hooks in the baseline fixture are explicit inert stand-ins for the selected count; they are not a claim that all provider hook behavior was reproduced. Default Node fetch/HTTP is disabled by the existing test guard; this is not an OS network sandbox. No provider calls, mail, real JWT verification, owner packet/ZIP access, hosted SQL writes or deployments occur. Dependency package name/version and committed lock are checked; installed package bytes are not independently hashed.

Early development failures were test-expectation/fixture issues: a retained original privileged-origin error name differed from the new control's name, a synthetic trigger-removal fixture used the wrong trigger name, and repeated activation now correctly fails the fresh preactivation baseline. Final tests retain both guard error names where applicable and the exact real trigger name; no access guard was weakened. Final 70-case verifier supersedes the intermediate 26/67-case development runs only for this new candidate checkpoint.

A separate [Git archive rehearsal](security-fr-2-email-staging-rollout-archive-checks.json) exported source commit `3c275e740cfc46267d54300a665f51397d8c7eff` with per-command LF settings, installed the single locked dependency fresh using the owner recipe with lifecycle scripts disabled, and returned the same70/70 PASS,78hashes,12syntax checks and exit0. This repeats the same scoped cases; it is not140 distinct tests or Windows evidence.

## Owner Windows handoff

Export the pinned commit from `security/stage-3-authorization` to a new temporary directory using per-command LF archive settings. Install only `scripts/fixtures/email-session-review-tools` with `npm.cmd ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org`. Then run `scripts/verify-fr-2-email-staging-rollout.mjs` with that fixture's PGlite module path. The complete PowerShell block is supplied in chat.

Expected: 70 PASS, 78 hashes, 12 syntax checks and exit 0. Return the complete safe JSON and exit code. No SQL Editor action, credentials, DPAPI access, secret reinstallation, ZIP upload, email, native or APK action is requested. Windows execution remains pending. This suite is scoped; the previous complete offline regression is not claimed rerun.

After Windows verification, complete trusted staging targeting, coordinated candidate/canonical registration integration, current Edge/Pages state and deployment list, actual compiled gateway/Edge-to-new-control integration, hosted recovery and controlled delivery acceptance. No finding is closed; production/native are unchanged and APK remains deferred.
