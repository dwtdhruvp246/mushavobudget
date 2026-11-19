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
