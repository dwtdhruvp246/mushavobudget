# E5.12 owner observation completed; deployment preparation remains open

21 October 2026, FRE109. The [owner receipt](security-fr-2-email-edge-readiness-owner-observation.json) reports four successful fixed staging requests at `2026-10-21T17:51:08.149Z`, with 14 verified source hashes, checkpoint COMPLETE and private-runner/terminal exit 0. The requested run commit was `2874f7760d00e2969f75fed2a60cb15de049980c`; the pasted result does not independently attest a commit or operating system. No separate offline verifier output was supplied in this submission, so the earlier 33-case local result is not relabeled an owner offline pass.

| Observation | Meaning |
|---|---|
| All four selected Edge functions absent | First deployment remains the applicable preparation path; no existing selected route is available for source parity or recovery capture |
| One other function; selected metadata SHA256 `a88734d959d4c93173609d771f13f5761f76d3478b1b9b7eb1aaca829f76ee78` | Retain this selected metadata baseline; its identity, source, shared-setting dependencies and deployable recovery artifact remain private and unverified |
| All six selected custom names unlisted | Prepare configuration sources before deployment; name metadata does not verify runtime platform variables or credential validity |
| Read-only role true, transaction read-only on; no `cron` schema or `cron.job` relation observed | The aggregate query was correctly skipped, leaving null aggregates and zero scheduler rows read; no job counts were collected |
| External caller coverage false | The missing database relation does not establish absence of external schedulers or callers |

The missing schema/relation is a catalog presence observation, not a result of trying and failing to SELECT scheduler rows. No grant expansion, pg_cron installation, retry or general-query fallback is justified by this result. The metadata snapshot is not a write lock or a future write-target attestation.

Current handoff: [E5.13 bounded private contact-source parity check](SECURITY_FR_2_4_EDGE_SOURCE_AND_CONFIGURATION_IMPACT_HANDOFF.md), FRE110. Twenty-five offline cases pass; owner execution is pending. It collects no configuration values and grants no write approval.

## Concrete next preparation

The next work is a private Edge configuration and shared-impact plan. It must preserve the unrelated function and establish the source of configuration values before proposing a hosted write. The unchanged entrypoints establish these dependencies:

| Custom configuration | Consuming source | Preparation requirement |
|---|---|---|
| `APP_ORIGIN` | Both invitation functions and `send-test-push` | Fixed staging origin `https://mushavo-budget-staging.pages.dev`; review the unrelated function's use before any project-wide write |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | `send-test-push` | Establish the staging public/private pair and contact subject privately; the public key must match the subscribing frontend, so generating a replacement is not an automatic substitute |
| `CURRENCYAPI_API_KEY` | `sync-exchange-rates` | Establish a staging provider credential privately; this observation does not test provider validity |
| `CURRENCY_SYNC_SECRET` | `sync-exchange-rates` | Establish a private staging caller credential and controlled caller ownership; the scheduled authorization branch precedes user-session proof |

Do not ask for values in chat, reuse Pages bindings as proof of Edge configuration, generate replacement push keys blindly, or install all six names from an unreviewed packet. The existing accepted source package and its nine false readiness assertions remain unchanged. No new secret collection or hosted execution block is offered in this receipt checkpoint.

Shared-setting impact and recoverability for the unrelated function, external caller containment, current Pages deployment/binding metadata, canonical SQL candidate integration, privileged write targeting, uncertain-outcome/concurrent-create handling, provider packaging/JWT acceptance and coordinated recovery remain scoped dependencies. Prepare the relevant implementation and meaningful offline verification before requesting approval for a concrete write. This observation grants no deployment, configuration, SQL activation or schedule-change approval.

Only receipt, contract and progress documentation change here. The new receipt is checked against the handler's bounded result shape, prior evidence is preserved, and source-manifest hashes remain unchanged. No new runtime suite or hosted request by the assistant is claimed. Findings remain open, hosted acceptance and live activation remain false, production/native remain unchanged, and APK work remains deferred.
