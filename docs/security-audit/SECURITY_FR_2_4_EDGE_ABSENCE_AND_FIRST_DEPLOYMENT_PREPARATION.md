# Four selected staging Edge functions are absent

21 October 2026, FRE105. The [revision-2 owner receipt](security-fr-2-email-edge-inventory-owner-absence.json), checked `2026-10-21T16:53:29.846Z`, reports two HTTP 200 JSON responses through the fixed staging Management API route. Its validated initial list contains one function and none of the four selected slugs. The successful diagnostic identifies the outstanding prerequisite; the inventory itself still correctly returns review required, exit 1. It is not reclassified as an active-inventory pass.

| Selected function | Present in the returned staging list | Rollout implication |
|---|---|---|
| `invite-admin-user` | No | Prepare an initial deployment; no observed prior version to restore |
| `invite-business-member` | No | Prepare an initial deployment; no observed prior version to restore |
| `send-test-push` | No | Prepare an initial deployment; no observed prior version to restore |
| `sync-exchange-rates` | No | Prepare an initial deployment and review the separately authorized scheduler path |

The remaining function is unrelated to these four by slug. Its name, status, source, settings and consumers were not supplied and are not inferred. Preserve it. The observations describe the returned list at the checked time, not a lock on current or future provider state. No individual metadata reads, function invocations, source downloads, secret reads, SQL, deployments or persistent changes occurred in this run. A separate owner offline verifier result was not included and is not inferred.

The read-only diagnostic now provides the information needed to plan. Repeating it unchanged will not create the missing functions. No new token scope or owner terminal/SQL action is requested at this receipt checkpoint.

## E5.11 preparation scope

The next work is `FR.2.4.E5.11_FIRST_EDGE_DEPLOYMENT_PREPARATION`. Prepare a concrete, tested staging-only first-deployment handoff for the exact four selected slugs, including the configuration and recovery dependencies below. Do not use a blanket deploy-all operation. This document is a source review and planning checkpoint; it is not that executable handoff and does not approve a hosted write.

### Source-required configuration

The current source was reviewed at parent commit `ade14955002b1492e493accabcd3541d8346b012`. These names come from the actual `Deno.env.get` calls. No hosted value or presence is established by this review. The Cloudflare Pages gateway's installed secrets do not establish the corresponding Supabase Edge environment.

| Function | Environment names read by the source | Source/config handling to finalize |
|---|---|---|
| `invite-admin-user` | `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Exact staging origin; Auth invitation delivery/redirect setup; explicit deployment JWT setting still needs review because local `supabase/config.toml` has no override for this slug |
| `invite-business-member` | `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Exact staging origin; existing-user OTP and new-user Auth invitation flows/redirects; explicit deployment JWT setting still needs review |
| `send-test-push` | `APP_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Preserve the reviewed recipient/rate boundaries; local config explicitly sets `verify_jwt = false`, while the handler validates the bearer with Auth |
| `sync-exchange-rates` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `CURRENCYAPI_API_KEY`, `CURRENCY_SYNC_SECRET` | Local config explicitly sets `verify_jwt = false`; review manual Admin and secret-authorized scheduler paths separately |

Do not infer that platform-named keys are valid, that private Pages credentials should be copied, or that an Edge secret has been configured. A future private configuration procedure must preserve existing values and account for project-wide shared environment effects on the unrelated function. Do not print values or request them in chat.

All four user/manual paths validate the bearer with Auth and call `email_gate_current_session_verified` through the same user client before their protected work. The shared assurance helper requires an exact boolean true with no RPC error. Source review indicates an absent proof backend will fail closed with `EMAIL_VERIFICATION_UNAVAILABLE`; that is not a working login acceptance result. Preserve the independent Admin, Business, recipient and FX authorization checks after proof.

`sync-exchange-rates` also accepts its dedicated cron secret before user proof. Database quarantine does not globally stop privileged service/scheduler work. Before initially deploying that route with usable credentials, establish whether any hosted scheduler or external caller is already configured for it and how its effects will be controlled during the staged window. No scheduler state was checked here, and no cron change is requested.

### Handoff and recovery requirements

1. **Retain the observed baseline and refresh it immediately before any approved write.** Pin the project route, exact selected source/dependency/configuration identities and unrelated-function metadata to preserve. If a selected slug has appeared since this receipt, stop for review instead of overwriting it as a first deployment.
2. **Finish the database and runtime dependencies.** The tested staging SQL candidate is still separate from the ordered/canonical registration sources. Integrate and test that registration path, privileged target handling and recovery baseline before an executable SQL handoff. Refresh Pages metadata using checks that expect the 13 already installed secret bindings, and record the current staging deployment identity.
3. **Define a usable staged window.** New guarded Edge routes can deny user requests until the proof backend exists and its quarantine is explicitly released. Specify the exact source/configuration, allowed denial checks, dependency ordering, service/scheduler controls and interruption handling. Local Deno/SQL passes do not establish provider behavior or a working UI in that interval.
4. **Distinguish recovery before and after database activation.** There are no observed earlier versions of these four routes to roll back to. Before enforcement activation, any proposed return to absence must identify only versions created by this rollout and be separately prepared and tested; do not delete an unknown pre-existing deployment. After committed SQL activation, retain guards/proofs/application rows and use the tested quarantine/forward-repair path. Removing Edge functions or rolling back Pages does not undo database enforcement.
5. **Prepare independent post-deployment verification.** Require all four active metadata records with the intended JWT settings and actual source/deployment identities, genuine hosted authorization and direct-API denial checks, controlled delivery tests, and coordinated recovery/concurrency evidence. Actual invitation, push and FX calls have side effects; their bounded acceptance procedure must be explicit before execution.

The read-only token used for this observation grants no installation approval or proof of a future privileged connection. No function creation, secret/configuration write, deletion, scheduler change, mail/push/FX request, SQL registration/activation, ZIP upload or deployment is requested by this checkpoint. Findings remain open, hosted acceptance remains false, production/native remain unchanged and APK work stays deferred.

## Validation

This checkpoint changes only audit receipts, documentation and progress/contract records. The received JSON and its four fixed absence observations are checked for internal consistency; prior evidence is preserved; relative links and source-derived environment names are checked. The current 18-file Edge checker, earlier 68-file target checker and 78-file SQL candidate source identities are verified unchanged. No new runtime test suite or hosted request is claimed.
