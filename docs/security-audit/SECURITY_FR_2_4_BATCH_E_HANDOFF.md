# Batch E: canonical database registration integration

22 October 2026, FRE125. Batch D is complete at its selected Edge source/HTTP-denial scope. This batch closes the source integration conflict between the offline-only migration55 installer and the separately reviewed staging activation/recovery candidate. It implements the actual migration path and tests it locally; it does not install or activate anything on Supabase.

| Combined work | Result |
| --- | --- |
| Canonical migration integration | Append `20261022000000_email_staging_registration_bridge.sql` as migration56 and regenerate `supabase/schema.sql` from all 56 ordered sources. Hash-check every original55 migration and the canonical55 prefix unchanged. |
| Explicit staging registration | Create a private invoker `mushavo_email_install.register_staging()` entry. It verifies the expected dormant namespace, legacy activation source hash, reviewed attributes/ACLs, origin and event hooks. The old offline activation body is replaced by a refusal stub before any new registration entry becomes visible. |
| Existing application upgrade preparation | Generate `security_fr_2_4_email_canonical_registration.sql`, a single-transaction bundle for the reviewed existing54 baseline: fresh nine-check baseline, original migration55, migration56, then explicit staging registration. No application activation is called. |
| Installation and recovery verification | Execute actual canonical56, all ordered56 migrations and the existing54 bundle in modeled databases. Compare selected catalogs before/after installation and test quarantine, proof/access behavior, recovery, drift refusal, rollback and API privilege boundaries. |

## Registration and activation stay distinct

The new migration verifies the original private activation function's exact `prosrc` SHA256 and selected function properties, ownership, schema/function ACLs and dormant namespace contents before changing it. Unexpected functions, relations, types or other selected namespace objects and an existing backend block the upgrade. The migration and both private functions require the privileged `postgres` origin. API roles have no private schema usage or execute grants, and forged claims or deliberate accidental private grants still cannot satisfy the origin checks.

Migration56 itself creates no email backend, control row, proof table or application guards. It disables the old `OFFLINE_ATOMIC_REHEARSAL` activation route on the integrated path and exposes one private registration entry. `register_staging()` requires the staging project acknowledgement and `REGISTER_STAGING_EMAIL` action, checks the expected refusal stub and namespace, and runs the existing reviewed registration source with only the namespace reuse and activation-function replacement adaptations. It retains all nine selected catalog checks, the exact hook guard and original four components. The registration result is REGISTERED, with no application guard activation.

Separate `activate()` still requires `ACTIVATE_STAGING_EMAIL_QUARANTINED`; it rechecks prerequisites and installs 148 guarded RPCs and 82 restrictive policies atomically, starting QUARANTINED. Explicit resume opens verified sessions only when the selected catalog identity matches. Committed quarantine retains guards, proofs, Auth sessions and application rows. The registration bridge itself is included in the selected catalog identity; changing it blocks resume. No password-only recovery path or guard-removing rollback is introduced.

The changes use PostgreSQL's documented [CREATE OR REPLACE FUNCTION](https://www.postgresql.org/docs/current/sql-createfunction.html) semantics, which retain function ownership and permissions; the tests additionally compare the resulting catalogs and effective API privileges. SQL function execution remains caller-transactional; the tests exercise caller rollback and late failures. The existing54 bundle contains one outer transaction and calls registration only. **The full canonical bootstrap is not an existing-database repair script.** Do not apply it, the original migration55 alone, or the old standalone staging candidate as an improvised hosted installation.

## Local verification and historical fixtures

The new verifier reports **114/114 PASS**, zero failures, **88 source hashes** and **18 syntax checks**, Node 24.19.0, PGlite 0.5.8:

- 11 current source/bootstrap cases: exact generated migration and registration bundle, unchanged original55 bytes and canonical55 prefix, current canonical56 equality, malformed inputs/delimiters and check-only CLI behavior.
- 33 actual integrated SQL cases: three creation paths, selected catalog parity, exact dormant legacy source/ACL/object checks, old activation refusal, private-origin denial, fresh prerequisites, atomic registration/bundle failures, quarantined activation, exact synthetic proofs, retained rows and recovery/drift checks.
- 70 retained selected staging/atomic/varchar cases: 30 + 23 + 17, with their source components unchanged.

`stage-3-local-db.mjs` explicitly preserves historical54/55 fixture scope. Its legacy canonical55 fixture now renders the original55 inputs; the new source test hashes that rendering against the historical canonical55 hash. Only `includeEmailCanonicalBridge:true` fixtures execute current ordered56 or the actual current canonical schema file. Six canonical source tests now assert56. Historical source manifests and receipts remain unchanged; their full old verifiers are historical and should be replayed at their pinned commits rather than treated as current-source checks. The new 88-file manifest records current bytes and separately pins every original55 migration hash.

The platform fixture uses the exact reviewed ensure_rls/provider watcher definitions plus four explicit inert count stand-ins. It is not proof of every real provider event hook, concurrency or isolation behavior. Source hashes do not attest all installed dependency bytes. Network fetch/HTTP is disabled during regression tests; modeled data, users, sessions and proof values are synthetic. No owner ZIP, DPAPI packet, token, provider account or hosted service was accessed by the assistant.

## Owner command and expected prompts

Run the full pinned PowerShell block supplied in chat. It fetches the security branch, exports the exact commit to a fresh temporary folder, installs the single locked PGlite test dependency with lifecycle scripts disabled, and runs `verify-fr-2-email-canonical-rollout.mjs` against that isolated dependency. It asks for **no credentials or other input**. Dependency installation accesses the public npm registry; tests use only temporary local databases. No SQL Editor command, hosted query, deployment, email, push, FX or scheduler action is included.

The command announces **BATCH E STARTED** and **BATCH E COMPLETE** or stops for review. Expected: 114 PASS, 88 hashes, 18 syntax checks, exit 0. Send the full safe JSON and exit code. Native Windows execution of this new integration remains owner-pending.

After Windows verification, the next handoff must establish an independently selected privileged staging connection, fresh reviewed catalog/hook baseline, current Pages/binding/limiter identity and frontend publication, controlled caller/scheduler state, compiled gateway/Edge-to-control behavior and hosted quarantined installation/recovery before activation acceptance. The target GUC remains an operator acknowledgement, not independent connection attestation. Actual PostgreSQL in-flight/concurrency behavior and authenticated/email/browser/push/FX tests remain outstanding.

Source integration is complete at the tested local scope. Hosted SQL handoff, live activation, full hosted acceptance and finding closure remain unapproved; production/native unchanged and APK deferred. The existing four staging Edge deployments and installed configuration are retained and are not repeated by this batch.
