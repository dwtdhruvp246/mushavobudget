# FR.2.2 — guarded installation stopped; event-hook review

14 October 2026, FRE14. The owner SQL Editor screenshot reports `P0001: UNREVIEWED_TRIGGER_DDL_EVENT_HOOK`, with the inline guard at line 25. The [attempt receipt](security-fr-2-binding-owner-install-attempt.json) records this result separately from the unchanged FRE13 local 32/32 PASS evidence. No successful installation JSON was received.

The reviewed installer raises this exception before CREATE OR REPLACE TRIGGER. The reported attempt did not reach replacement. The screenshot does not identify the selected project or the matching hooks, independently attest installed definitions, or prove that a separate transaction cleanup completed. The candidate and rollback SQL remain unchanged; no guard has been removed and no hook disabled.

This condition is not a conclusion that a hook is malicious or that the frontend is unavailable. The current guard conservatively matches O/A-enabled event hooks with NULL tags or CREATE TRIGGER among their tags, without filtering evtevent. An unfiltered sql_drop hook is consequently included by this guard, even though its applicability must be reviewed separately. Official PostgREST documentation gives schema-cache reload hook examples, including ddl_command_end and sql_drop handlers; example names alone do not authenticate the actual installed hook or its body.

## Next bounded owner collection

Run the complete [read-only event-hook diagnostic](../../supabase/diagnostics/security_fr_2_2_event_hooks.sql) pasted in chat, in the staging SQL Editor for dczlddwbtgvfdujgcitb. Its initial ROLLBACK ends any transaction left by this failed attempt; it is not the binding rollback candidate. A new READ ONLY transaction collects event/name/enabled/tag metadata, role ownership, function signature/language/security-definer/search-path/body fingerprint and current named binding trigger columns, then rolls back. No application routine is invoked, raw function body or application row printed, or hook/trigger/account/policy modified. A hard-coded project label is not independent attestation.

Review the single owner JSON before any installer revision or rerun. Names and MD5 fingerprints are metadata, not semantic or authenticity guarantees. Do not disable, bypass or whitelist a hook by name. Additional privately scoped body/provenance review may be necessary once exact metadata is known.

## Local diagnostic validation and scope

The actual SQL was executed once in a fresh PGlite 0.5.8 PostgreSQL 18.3 WebAssembly catalog fixture. Four synthetic event hooks cover enabled unfiltered ddl_command_end and sql_drop, disabled, and CREATE TABLE-filtered cases; the query reports exactly two conservative guard matches, the prior payment_item_id-only binding trigger columns, and READ ONLY status without printing raw bodies. This is one diagnostic fixture execution, not another 32-case candidate run or hosted PostgreSQL 17 acceptance. No dependencies were installed and no hosted request was made by this check.

FR.2.2 remains pending event-hook review, successful controlled installation, genuine authorization/relink/deletion checks and separately reviewed historical consistency. FR.1 scoped 65/65 serving evidence remains intact. Stage 0–10 objects, prior events, original findings/actions/decisions and retained synthetic actors/two manual Family conversions remain preserved. Production kttkospkblwvguuwnhjj and native/signing are excluded. Findings remain open, full acceptance false, release gate OPEN_PENDING_REQUIRED_EVIDENCE, fresh final audit PLANNED_NOT_PERFORMED and APK deferred.

Primary references reviewed 14 October 2026:

- PostgreSQL 17 pg_event_trigger catalog: https://www.postgresql.org/docs/17/catalog-pg-event-trigger.html
- PostgREST schema-cache event trigger examples: https://docs.postgrest.org/en/stable/references/schema_cache.html
