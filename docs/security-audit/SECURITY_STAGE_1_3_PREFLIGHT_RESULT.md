# 1.3.2 — Staging preflight result

Owner supplied results checked at 2026-10-08T18:14:50.37744+00:00. Intended staging reference: dczlddwbtgvfdujgcitb; production to avoid: kttkospkblwvguuwnhjj. Dashboard identity remains owner-verified rather than proved by embedded SQL labels.

PostgreSQL 17.11; read-only repeatable-read transaction. Selected counts: Auth users 0, Storage buckets 0, Storage objects 0, public nonextension relations 0, public nonextension routines 1. The four rows are two INFO and two REVIEW. This is not a full emptiness or isolation PASS.

Installed extensions: pg_stat_statements 1.11, pgcrypto 1.3, plpgsql 1.0, supabase_vault 0.3.1, uuid-ossp 1.1. No application schema/data or dispatch was created/tested by this check.

One existing public routine requires identification before application DDL because a linked event trigger can affect schema creation. The metadata-only follow-up reports signatures, owners, language, SECURITY DEFINER flags and event-trigger linkage; it returns no function bodies or setting values. It neither drops nor approves the routine. Its behavior and source-schema compatibility remain unverified. Do not remove it merely to obtain zero counts.

## Finite Stage 1.3 work items

| Item | Purpose | Current state |
|---|---|---|
| 1.3.1 Separate target | Keep test changes away from production | Owner reported created/reference supplied |
| 1.3.2 Initial target review | Check version and existing objects before writes | Results received; identify one routine |
| 1.3.3 Reviewed application schema | Initialize the application from reviewed source migrations | Pending |
| 1.3.4 Isolated test configuration | Separate frontend, Auth, Storage and Edge credentials; control mail/push/jobs | Pending |
| 1.3.5 Synthetic checks and checkpoint | Verify test operations and isolation; report scoped results/gaps | Pending |

These are five work items, not five commands. Any unresolved issue remains explicitly recorded. Stage 1.2 remains closed with carry-forward; Google Drive remains deferred. Actual recovery testing belongs to 1.4. No production rows or credentials are requested here.
