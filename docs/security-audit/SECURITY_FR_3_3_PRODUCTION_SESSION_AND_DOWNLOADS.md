# FR.3.3 production session and private downloads

The two migrations below were rehearsed in rolled-back production transactions, tested against disposable local PostgreSQL fixtures, applied to production, and read back.

| Migration | Production result |
| --- | --- |
| `20261119102913_fr33_production_application_session.sql` | Added an authenticated session-status RPC and private session guard. The readback recognized six eligible stored sessions, including one email-code session. A request for an unknown session returned invalid and no staff role. There were no active production staff sessions in the readback. A disposable local staff session returned its stored role. |
| `20261119103127_fr33_production_private_download_context.sql` | Added the Storage metadata lookup and service-only budget reservation. Storage row access remains governed by existing RLS. Local tests denied a different owner and an inactive session, checked file size constraints, and exercised the per-minute budget and reset. |

The production session-status policy is `ACTIVE_SUPABASE_SESSION`. It preserves the Auth methods already used on the live site. The account deletion request separately requires a recent password authentication event. The migrations install no global pre-request hook and attach to no live policy or existing frontend caller.

After installation, the live private-file Edge Function returned `403 ORIGIN_NOT_ALLOWED` with the production browser origin and `503 PRIVATE_FILE_UNAVAILABLE` without an origin. The download ledger contained zero rows. Authenticated testing of the new path and production staff sign-in remains pending before frontend routing or broker activation.


## Production account deletion request schema

Added production migration `20261119103357_fr33_production_account_deletion_request_schema.sql` using the staged request, dependency review and workspace confirmation code. The hosted rehearsal resolved all ten existing account inventories without returning any names or workspace details. Production readback found five request RPCs, forced row-level security on the request table, zero API roles able to call the RPCs, and zero submitted requests. The website and automatic deletion remain disabled for this feature while the executor and worker are prepared.

## Production erasure and retention backend

Production now has the file ledgers, private executor, paused deletion schedule, owned-workspace file cleanup states, private billing and support archives, proof handoff queue, and disabled archive-expiry controls. The upload ledger installation leaves the existing upload triggers and Storage policies for managed ingestion disconnected. The cleanup caller grants, customer request and archive RPC grants remain closed.

The production port omits two staging-only subscription fixture guards. It uses production's `entity_type` and `entity_id` to match retained currency-conversion rows. These fields match the staging generated reference for payment records. The existing production conversion table and rows required no schema or data conversion.

A [rolled-back production database rehearsal](../../supabase/diagnostics/security_fr33_production_erasure_rehearsal.sql) ran the installed scheduled processor against one confirmed synthetic request. It removed the disposable account, its owned Family and Business workspaces, preserved the other Family workspace and its payment with the same payer and recorder name, archived the support case, and recorded a completed erasure receipt. This rehearsal used no Storage objects.

[Production readback](../../supabase/diagnostics/security_fr33_production_erasure_readback.sql) confirmed zero test accounts, requests, cleanup targets or shared proof handoffs, 21 existing payment records, and two existing account-owned Business logos. The cron job and both archive-expiry controls were disabled. This readback did not use or remove an existing customer's file.

Production still requires the independently authenticated Storage cleanup worker, disposable end-to-end tests of private downloads and actual Storage cleanup, staff archive acceptance, and recovery/provider verification before opening customer deletion requests. Billing expiry also requires confirmed accounting periods and entity details.

## Production Storage cleanup worker

The production Edge Function is `fr33-file-cleanup` version 3. It accepts expiring P-256 scheduler signatures scoped to production, and the database consumes each dispatch nonce once. Cloudflare holds the signing key as the `FR33_SIGNING_KEY` secret binding for `mushavo-fr33-production-cleanup`. PostgreSQL owns the release controls and checks them again at dispatch. Production's pg_net queue had provider-owned read ACLs, so the production signer stays independent of that queue.

A disposable 68-byte PNG was uploaded to the private production payment-proof bucket. The actual cleanup handler claimed one matching upload, removed it through the Storage API, and received a database acknowledgment after the object was absent. The job returned one removal and zero retries. The two existing Business logo object IDs and versions matched the pre-test fingerprint. An unsigned live request returned 403. The rolled-back nonce check denied a replay and an expired timestamp. All four scheduler and cleanup adapter regression tests passed.

A temporary fixture-only signing key was used for the end-to-end file rehearsal because the newly provisioned Cloudflare cron had no observed invocation during the run. The final Edge version removes that key and the upload fixture handler. All seven deployed source files matched the reviewed bundle. There were zero remaining fixture objects, upload ledger entries, dispatch rows, or deletion requests. The Cloudflare schedule and the Supabase account deletion job are paused. Production dispatch, backup-based erasure verification, and customer requests are closed. An end-to-end scheduled Cloudflare invocation and signed-in production acceptance remain pending.

## Production backup recovery

The production Supabase Scheduled Backups screen on 20 November confirmed that the project is on the Free plan and has no scheduled database backups. Supabase database backups do not include Storage object bytes. The earlier encrypted Windows database and role packages were verified for a historical snapshot, and the previous native restore used synthetic staging data. Those results do not establish present production database and file recovery. A current encrypted database and Storage backup and isolated restore verification are required before customer deletion can open. Use the existing private backup location or an approved protected destination, and record only sanitized status and counts in release evidence.

- [Supabase production backup settings](https://supabase.com/dashboard/project/kttkospkblwvguuwnhjj/database/backups/scheduled)
- [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups)

## Refresh the private production backup on Windows

Run `scripts/fr33-production-private-backup.ps1` through the pinned PowerShell handoff with the reviewed `scripts/security-stage-1-storage-backup.cjs`. The runner checks the existing protected NTFS backup folder, exports a current database archive using the production certificate and native password prompt, renders the full archive offline, verifies its encrypted extraction, and downloads and verifies current Storage object bytes using the reviewed helper. The database password, Storage access key, and backup passphrase are entered only at local prompts. The final JSON exposes status, counts, and error codes. Archives and reports containing private data stay in the existing protected directory.

The Storage helper is pinned to the previously reviewed blob `1c6d1ca70be9d285b19042eb4f0ab3830fd8f156`. Its ten existing fixture tests and a focused test of the runner's embedded bridge passed. The Windows PowerShell, PostgreSQL, and 7-Zip steps require the operator's laptop and have not been run in this session. A successful local package check proves current backup readability and encrypted extraction. An isolated restore and recovery-coverage review are separate release gates. Record the actual maximum backup lifetime before enabling customer deletion.

## Scheduled production verification

Cloudflare recorded scheduled invocations that failed at Fetch initialization because its runtime rejected the original redirect setting. The deployed scheduler now uses manual redirect handling and fails on HTTP redirect responses. A regression test verifies that it sends the signed request once and never follows the redirect. All five scheduler and cleanup tests passed.

After deployment, the scheduled Worker reached the production Edge Function with its normal signing key. Supabase recorded a signed invocation and a cleanup claim in an empty rehearsal scope. The test had no upload or customer deletion requests. Readback after cleanup confirmed zero test rows, zero active schedules, a retained production signing binding, disabled diagnostic logs, and closed customer deletion submission.

## Windows backup preflight follow-up

The first owner-run Windows preflight stopped at `verify_native_tools` before any backup or credential prompt. The revised runner reports separate PostgreSQL, CA certificate, 7-Zip, Node, helper hash, and environment checks. The PowerShell handoff now reads the two pinned Git blobs as raw bytes, avoiding changes from terminal text encoding when validating the Storage helper. The embedded backup bridge test passed again. The current encrypted backup and isolated restore remain pending.
