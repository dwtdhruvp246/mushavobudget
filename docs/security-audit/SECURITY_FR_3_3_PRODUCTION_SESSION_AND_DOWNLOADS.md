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
