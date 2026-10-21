# E5.11 local first-deployment source package

21 October 2026, FRE106. The [observed staging baseline](security-fr-2-email-edge-inventory-owner-absence.json) contains none of the four selected Edge routes. This checkpoint prepares and tests their exact public source in an isolated local package. It does not deploy them or make the missing-inventory prerequisite pass.

[Builder/inspector](../../scripts/prepare-fr-2-email-edge-package.mjs), [verifier](../../scripts/verify-fr-2-email-edge-preparation.mjs), [staging config candidate](../../deployment/candidates/email-edge-staging.config.toml), [manifest](security-fr-2-email-edge-preparation-source-manifest.json), [local checks](security-fr-2-email-edge-preparation-local-checks.json), [contract](security-fr-2-email-edge-preparation-contract.json).

## Package contents and settings

The builder reads only 20 fixed, SHA256-pinned public inputs. It validates them before creating a fresh output directory. Existing output directories, redirected paths and mismatched source stop; the builder never overwrites an existing package. Inspection rejects missing, extra or changed files and plan assertions. Failed local creation can leave a partial newly created directory; it is not retried or deleted automatically.

The package contains exactly 12 files: four unchanged TypeScript entrypoints, their four required shared modules, the staging-only `supabase/config.toml`, a frozen root `deno.json`, the reviewed dependency lock and `preparation-plan.json`. It copies no `.env`, key packet, Pages ZIP, SQL, unrelated Edge route or deployment executable. Remote SDK import specifiers and versions are unchanged. The original repository-wide `supabase/config.toml`, application runtime, canonical schema, migrations and earlier source manifests remain unchanged.

| Selected route | Explicit package `verify_jwt` | Handler authorization retained |
|---|---|---|
| `invite-admin-user` | `true` | Auth user, same-bearer email-session proof and Admin role |
| `invite-business-member` | `true` | Auth user, same-bearer email-session proof and Business invitation RPC authorization |
| `send-test-push` | `false` | Existing Auth, same-bearer proof and independent active-recipient/rate checks |
| `sync-exchange-rates` | `false` | Existing manual Admin/proof path and separate dedicated-cron-secret path |

The invitation routes' implicit platform default is made explicit; their platform JWT check is retained. The other two flags preserve the reviewed local configuration. No gateway flag is changed merely to clear a future 401. The source does not adopt the newer `withSupabase` wrapper, and its behavior is not claimed from documentation about that wrapper. Actual provider gateway JWT compatibility remains unverified.

The package root dependency configuration intentionally uses the reviewed frozen lock with `nodeModulesDir: none`, matching the prior isolated Deno verification. The original per-function `nodeModulesDir: auto` config files are not copied. Local type checks, bundle builds and runtime tests explicitly select the package root config. No claim is made that an eventual provider deployer automatically consumes this lock or reproduces these bundle bytes; its packaging and readback must be tested separately.

The deterministic package identity hashes the sorted relative file names and each file's SHA256, including the plan. It is not a tar/ZIP hash or a provider bundle hash. The checked identity is `e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3`. The plan contains the fixed staging label/origin, exact source hashes, four first-deployment settings and no observed previous versions. Its historical absence timestamp is explicitly not a fresh write precondition or independent privileged target proof.

## Verification

The 16 package tests cover exact source/dependency/configuration copies, deterministic identity, refusal to overwrite, invalid flags/paths, source/config tampering before output creation, private-file exclusion, package tampering/deletion/extra files, plan acceptance tampering, redirected paths, exclusion of unrelated routes/SQL/executables, CLI inspection, local import closure and source preservation. Node's default fetch/HTTP is blocked during these tests.

The optional native phase uses pinned Deno 2.9.5 with the existing locked test-tool package. It type-checks all four packaged entrypoints and builds all four bundles. The unchanged reviewed Deno harness executes 28 source and 28 bundled SDK/handler boundary cases against the actual package layout. Only HTTP/environment inputs are synthetic; imported SDK objects and source modules are not replaced. Runtime OS network, environment, subprocess and write permissions are denied, with reads limited to the temporary public package and dependency cache. Public dependency resolution/type/bundle steps are separate from these runtime permissions and may fetch frozen public dependencies when the cache is empty.

The combined run is **72 PASS**: 16 new package cases plus 56 retained runtime cases exercised in the new layout; type checks and bundle builds are reported separately, not counted as additional tests. A clean Git-tree archive rehearsal is recorded in the local checks. Rehearsing the same cases does not double the distinct case count. Existing broad SQL, browser and full 144-case Deno suites are not claimed rerun. Installed tool versions/locks are checked, but installed binary/package bytes are not independently hashed.

## Recovery and remaining deployment gates

The plan preserves the recovery requirements identified in the [first-deployment review](SECURITY_FR_2_4_EDGE_ABSENCE_AND_FIRST_DEPLOYMENT_PREPARATION.md). Before SQL activation, returning a newly created route to absence would require fresh evidence of the exact rollout-owned ID/version and a separately prepared/tested operation. There is no automatic deletion or assumed earlier version. After committed database activation, retain enforcement, proofs and application rows, use quarantine and forward repair, and do not treat removal of Edge/Pages artifacts as a database rollback.

These are declared requirements in this artifact, not a tested multi-service recovery executor. All nine readiness assertions remain false: fresh target/absence checks, preserving the unrelated function, private Edge configuration, scheduler/external-call review, database/canonical integration, privileged SQL targeting/recovery baseline, current Pages/installed-binding checks, coordinated recovery and hosted JWT/authorization acceptance. `deployable_now`, `hosted_write_approved`, `live_activation_approved` and `hosted_acceptance` remain false. Do not toggle local plan booleans into approval; inspection requires the original exact plan bytes.

The provider deploy endpoint creates or updates functions; its documented behavior is not an atomic absent-only write precondition. A future deployment executor must address uncertain outcomes, concurrent creation and preserving the unrelated function before it is offered for execution. No such write executor is included here. The Pages gateway secrets do not prove Edge environment values, and the FX cron path still needs its separate review.

## Owner offline action

Run the complete pinned PowerShell block supplied in chat. It exports source to a fresh temporary directory, installs only the locked public Deno test tools with lifecycle scripts disabled, runs all 72 checks with four type/bundle checks, and prepares/inspects a fresh public source directory. It needs no token, password, private packet or Supabase CLI login. Return the safe verifier JSON, package preparation JSON and both exit codes. Do not upload/deploy the directory or the accepted Pages ZIP.

Native Windows package creation, junction rejection and this new combined verifier remain owner evidence pending. No provider, SQL, secret, Auth, scheduler, email, push or FX action is requested. Findings remain open, production/native remain unchanged and APK work stays deferred.

## Primary references checked 21 October 2026

- https://supabase.com/docs/guides/functions/auth — default platform `verify_jwt = true` and separation of gateway/handler authorization; examples using newer wrappers are not substituted into existing source.
- https://supabase.com/docs/guides/functions/function-configuration — explicit per-function JWT settings and entrypoint paths.
- https://supabase.com/docs/reference/api/v1-deploy-a-function — create-or-update behavior, metadata/files and write permission; not invoked here.
