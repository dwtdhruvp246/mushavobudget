# Current checkpoint — first Edge function installed; remaining-three resume ready

22 October 2026, FRE123. [Owner result](security-fr-2-email-edge-batch-d-owner-partial-one-installed.json) confirms deployment 201, matching metadata/bundle, two exact source files and unauthenticated HTTP 401 for `invite-admin-user`, version 1; write uncertainty false. Offline 18/18 passed on owner Node 22.17.0. Exit 1 came from the checker's additional error JSON format assertion after HTTP 401 had already been received; the actual error-body schema remains unknown. The other three deployments were not attempted. Do not rerun the original absence-only Batch D runner. [Resume handoff](SECURITY_FR_2_4_BATCH_D_RESUME_HANDOFF.md) pins the installed identity/version/bundle and rechecks source before deploying only the missing three, with exact HTTP 401 evidence and no provider-specific error-body assumption. Local verification passes 20/20 with 46 hashes and three syntax checks; native Windows resume and hosted completion remain pending. Database activation, full acceptance, production/native/store work and all finding closure remain pending. Earlier checkpoints follow.

---

# Current checkpoint — Batch D offline 18/18; first deployment returned 403

22 October 2026, FRE122. [Owner receipt](security-fr-2-email-edge-batch-d-owner-403-review.json) confirms 18/18 offline cases on Node 22.17.0, 40 source hashes, three syntax checks and Windows runner execution. Ten Management GETs passed; the first deployment POST returned HTTP 403. The other three deployments and all function invocations were not attempted. Zero deployments were confirmed; the receipt's uncertainty remains preserved because no post-attempt state was read. [Review](SECURITY_FR_2_4_BATCH_D_403_REVIEW.md) directs an Edge Functions Read-write token/account permission check, then reuse of the unchanged runner's fresh read-only target/source/names/absence/metadata gates before any guarded retry. Exact denial cause is unverified. No additional diagnostic implementation or source/manifest change is needed. Full hosted acceptance, activation, production/native/store work and finding closure remain pending. Earlier checkpoints follow.

---

# Batch D: four staging Edge deployments and immediate checks

22 October 2026, FRE121. Batch C installation and its scoped follow-up review are complete: the owner reported six names installed, exact reviewed CRLF contact artifacts, stable current list/detail metadata, no selected routes and exit 0. The accepted current fingerprint is explicitly `f8fe331bf335145aff9cb8979816b3d092bc900c93c78e8856be1afbb975296e`, checked at `2026-10-22T05:35:12.841Z`. The old `a887…` fingerprint and original failure receipt remain historical evidence. The metadata change cause and equality of prior function ID/version remain unverified. No separate owner offline 12-test receipt was supplied.

This is a **staging deployment batch**, requiring `-Deploy` and a fixed private-pipe acknowledgement. It combines four jobs in one terminal run:

| Work | Scope |
| --- | --- |
| Fresh preflight | Verify pinned public source package and current staging target, exact contact artifacts, stable metadata, four absent selected routes and six installed names. Require the newly reviewed fingerprint; do not silently adopt further changes. |
| Four first deployments | Deploy `invite-admin-user`, `invite-business-member`, `send-test-push`, `sync-exchange-rates`, in that order. Upload only each exact prepared entrypoint and its local imported shared files. JWT settings are true, true, false, false, matching the reviewed package. |
| Immediate readback | Compare POST and independent GET ID/version/JWT metadata plus provider bundle hash; GET source and require every entrypoint/shared file to be byte-identical to the pinned LF source. Repeat detail observation around source readback. |
| Access and preservation checks | POST `{}` with no bearer token, API key or cron secret to each deployed staging route; require HTTP 401. Recheck the sole unrelated contact function metadata and exact reviewed artifacts and the final function list. |

There are at most **37 requests**: 29 Management GETs, four deployment POSTs and four unauthenticated staging function POSTs. Each write is attempted once. Provider bodies, source paths, function IDs and credentials are not printed. Safe output records each selected function's version, hashed ID and bundle SHA256 for future identity checks. Downloaded source is compared in memory; it is not executed or saved. This batch does not read application rows, invoke authenticated functionality, create schedules, send email/push or request FX rates.

## Input explained before execution

Only **one hidden token prompt** appears. Use a scoped Supabase Management personal access token starting `sbp_fc`, created at [account access tokens](https://supabase.com/dashboard/account/tokens), restricted to staging project `dczlddwbtgvfdujgcitb`.

Required permissions:

- **Project Settings: Read** (`project_admin_read`).
- **Edge Functions: Read-write** (`edge_functions_read`, `edge_functions_write`).
- **Edge Function Secrets: Read** (`edge_functions_secrets_read`).

The Batch C token can be reused only if it already includes Edge Functions write permission. The Supabase account needs permission on staging; this is not an application Admin login. No staging Admin email, database password, VAPID key or CurrencyAPI key is requested. No encrypted packet or frontend ZIP is read. The existing six hosted values are used by the deployed functions; they are not rewritten.

The script announces start, periodic waiting notices, and completion or review status. Normal deployment may take several minutes; its bounded child timeout is eleven minutes. Return the offline verifier JSON, safe Batch D JSON and both exit codes.

## Deployment and recovery limits

Use a window with no other edits or callers to these staging routes. The absence and identity snapshots are not a provider write lock; the deployment endpoint can update an existing slug, and has no create-only/CAS parameter. A concurrent operator can race the last preflight. An observed selected route, changed fingerprint or unrelated metadata blocks before the next write. The batch never deletes, retries or overwrites a route observed present during its initial preflight.

These deployments are sequential, **not atomic**. If the provider accepts one deployment and a later check fails, that route remains installed. A timeout or malformed write response preserves uncertainty; accepted earlier writes are recorded. Return the receipt before any retry. Re-running the batch after a partial installation is blocked by selected-route presence. Recovery must first GET each affected route, match the recorded ID hash/version/bundle and decide on forward repair or explicit deletion to restore absence. No previous artifact exists for a route observed absent, and no automatic rollback or recovery execution is claimed. The unrelated contact function is never uploaded.

The Supabase [deployment endpoint](https://supabase.com/docs/reference/api/v1-deploy-a-function) uses a multipart metadata field and source file fields and returns 201. The implementation follows the public [Supabase CLI source upload format](https://github.com/supabase/cli/blob/7e3035c644f4528833dd7a6a992535ded7158a8f/apps/cli-go/pkg/function/deploy.go): relative filename paths, name/entrypoint/verify_jwt/import-map metadata. See [scoped token permissions](https://supabase.com/docs/guides/platform/personal-access-tokens).

The source files are unchanged from the owner-tested package (`e1fb82c6001ee4bb8f3d6999f078a028637cf90d912e275fb14ac84774f192a3`, prior 72/72 source/bundle checks). The hosted provider performs its own bundling. This upload sends the exact source dependency closure, not the offline Deno configuration/lockfile; hosted transitive dependency bytes and lockfile parity remain unverified. Exact source readback is not a proof of bundle execution equivalence.

The newly created endpoints become available in staging. Authenticated user paths require the email-session database guard, which remains uninstalled; they are expected to fail closed until coordinated database rollout. The FX scheduler-secret path is separate and can execute with the installed caller secret; this batch never supplies it or enables a scheduler. External callers/scheduler inventory and authenticated runtime behavior remain pending. A missing-header 401 checks only that request: it does not prove signed JWT acceptance, all authorization paths, delivery or secret equality. Do not describe these Edge deployments as database quarantine or completed email activation.

Local verification covers 18 cases, including every one of the 37 request failure positions, exact multipart source uploads/readbacks, drift, denied access, partial/uncertain writes, private CLI behavior and no automatic cleanup/retry. It uses synthetic provider responses under the network blocker. Native Windows execution and real provider behavior are owner-pending.

Next coordinated work remains frontend publication/current Pages binding checks, canonical database candidate integration, independent privileged database target verification, quarantined installation and recovery tests, followed by authenticated/email/push/FX/browser acceptance. No database activation, production/native change, APK update, full finding closure or store submission is included here.
