# FR.2.1 — current source review and one read-only staging readiness snapshot

13 October 2026. Source/evidence parent: `12286dcbade07309bfb8ffe919224252f6cb8bff`. Status: HANDOFF_PREPARED_OWNER_RESULT_PENDING. [FR.2 plan](SECURITY_FR_2_PLAN.md) and [exact source inventory](security-fr-2-source-inventory.json).

19 selected current files reconcile byte-for-byte to the branch's Git blob identities: five Stage 3 reports, two owner readiness receipts, the Personal source probe, schema and three relevant migrations, five current client/Auth/MFA files, original final-remediation handoff and complete FR.1 corrected owner serving receipt. Review confirms the selected source binding gap and unreviewed Business/Admin/Auth dependencies retained in the plan. No full discovery/catalog or new acceptance suite is claimed.

## Owner action — full SQL supplied in chat

Open `https://supabase.com/dashboard/project/dczlddwbtgvfdujgcitb/sql/new`. Verify the project bar shows staging ref **dczlddwbtgvfdujgcitb**, then paste and run the complete chat SQL matching `supabase/diagnostics/security_fr_2_readiness.sql`. Production **kttkospkblwvguuwnhjj** is excluded. No terminal command, upload, new test account, factor enrollment, key entry or Auth setting change is needed.

The SQL begins a read-only transaction, bounds statement/lock time, returns one `fr2_readiness` JSON row and rolls back. A catalog-only DO guard requires the default privileged SQL Editor role to be superuser or BYPASSRLS before application tables are read, preventing a client-role RLS/helper exercise from being mistaken for complete counts. Do not switch or grant roles to bypass a guard error. It uses catalog built-ins and ordinary SELECT aggregates; it invokes no application routine or trigger. It reads only selected metadata plus aggregate consistency/operator counts. No raw customer row, UUID/email/name, factor secret, function body, policy expression or connection credential is returned. The selected catalog names, policy role names, fingerprints and counts are safe summary evidence at this scope. A missing critical relation/column, denied SQL Editor permission or timeout stops the query; return the error without adding privileges or bypassing checks.

### Frozen expected source fingerprints

| No-argument trigger function | Current schema LF-normalized body MD5 |
|---|---|
| sync_payment_record_workspace | 8f568f342d4e928b4c27437ba7f544e5 |
| guard_workspace_finance_write | 783883ce4af23615f768a0990b6f2478 |
| set_payment_outbox_workspace_context | 85794a38ffbe61b56bab8aff4b0a3319 |

The finance guard has two source definitions; the **last** one is selected. Each digest is recomputed from the exact reviewed source and embedded in the SQL. Hosted LF match, language/result/definer/path flags and effective anon/authenticated grants are returned independently. These functions return trigger, so a metadata EXECUTE grant alone does not demonstrate an ordinarily callable HTTP exploit. Wider callable/transitive roles require later direct effect checks.

Four expected trigger rows retain relation/name, enabled mode, event bitmask, function association and column-specific UPDATE list. An empty UPDATE list alone is not proof of safety or even an UPDATE event; interpret it together with the event bits/association. Nine selected public relations return presence/RLS/force-RLS flags and policy metadata plus expression digests; these are not the earlier full 58-policy parity verdict. Record and conversion joins return counts only; no data is repaired or deleted, including the two USD1 conversions. Aggregate active super/verified-TOTP presence is not a controlled recovery-ready operator or genuine issued AAL2 session.

Return the single JSON row or the SQL error. Readiness is evidence collection, not PASS for authorization. No automatic repair, mutation, enrollment, fixture insertion, job execution or mail is requested. The new SQL was reviewed against current source and PostgreSQL 17 catalog/transaction documentation; **it was not executed locally by the assistant**, so no parser/catalog/hosted success is claimed before owner output.

## After the result

Record exact routine/trigger drift, consistency counts and operator prerequisites. Prepare the narrow Personal correction and legitimate relink/deletion controls without rewriting historical records. Privately resolve the unexplained outbox function before Business fixtures; reconcile Admin policies/grants and verified operator/recovery before enforcement. Auth dashboard decisions/isolated inbox identities remain a later concrete step. Preserve existing successful Family/currency receipts and do not repeat unrelated successful batches.

FR.1's 65-case public primary serving PASS remains accepted at its narrow scope. No broader hosted/native/store acceptance, original finding/action closure or APK rebuild is implied. All original Stage 0–10 objects and prior evidence remain unchanged; the full fresh final audit remains pending.

Primary references read 13 October 2026: [PostgreSQL 17 pg_trigger](https://www.postgresql.org/docs/17/catalog-pg-trigger.html), [pg_proc](https://www.postgresql.org/docs/17/catalog-pg-proc.html), [SET TRANSACTION](https://www.postgresql.org/docs/17/sql-set-transaction.html). These describe catalog fields/read-only behavior; they do not attest Mushavo's hosted project or authorization.
