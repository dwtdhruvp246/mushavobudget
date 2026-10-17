# FR.2.2 — exact hosted record repair accepted; canonical binding source integrated

14 October 2026, FRE23. [Complete owner repair result](security-fr-2-historical-binding-repair-owner-result.json), [source integration contract](security-fr-2-binding-integration-contract.json), [51-case local checks](security-fr-2-binding-integration-local-checks.json). Original prior receipts, stopped/local attempts and FRE01–22 remain preserved.

## Accepted hosted repair result

At 07:44:47 UTC the owner returned the script's after-COMMIT assertion-backed receipt: exactly one fingerprinted historical record's workspace_id repaired; every other field in that record, every item/other record and ALL conversion rows compared unchanged. Both joined record-parent/conversion-record workspace mismatch counts asserted zero before COMMIT. The single linked conversion already matched the correct parent workspace and was left byte-identical at the JSON value scope. Earlier orphan conversions and retained Family manual rows were not selected/deleted. This supersedes prior owner-repair pending state; it does not establish complete orphan/history or provider/scheduler integrity.

Cleanup attribution used transaction-local fixture owner claims in a privileged SQL session while normal suspension/finance guards remained enabled. No signed Auth/JWT/API acceptance, independent project attestation, grant/role/account/factor changes or full finding closure is claimed. Exact fixture cleanup and prior hosted 33-PASS/16-PASS client batches remain separate evidence.

## Canonical source change

The accepted hosted preventive coverage is now represented in **supabase/schema.sql**: the existing sync trigger fires on INSERT and UPDATE OF payment_item_id, workspace_id. This is one changed source clause; the sync/finance functions and all other schema bytes stay unchanged. Historical migration files remain unchanged.

New ordered migration **20261014074500_payment_record_workspace_binding.sql** integrates the same guarded CREATE OR REPLACE TRIGGER. It reuses the reviewed installer guard body without broadening it, accepts exact legacy/new column coverage, keeps normal source finance protection and permits only the two exact reviewed Supabase pgrst event hooks with their body SHA256/association/owner/signature/config. Unknown active relevant hooks, altered functions/trigger shape, disabled guard, missing finance protection, ordinary SQL role or replica mode stop. No history repair/data rewrite, new helper, grants/policies/roles/SDK changes or existing outbox-function overwrite is included.

The migration is idempotent against the accepted already-installed coverage. Source integration is complete on the audit branch; this turn did NOT run the new migration on hosted staging or register it in the hosted migration ledger. The staging trigger already has accepted coverage from the owner installer/API/relink results. No supabase db push, broad schema reload, production deployment or APK rebuild is requested. Future migration application must retain the exact source guard/reviewed project scope; new provider-hook bodies require review rather than disabling that guard.

Older pinned candidate verifiers intentionally bind to their old source inventories. Run them at their pinned commits; the new integration verifier uses a new 56-input inventory and does not rewrite historical contracts.

## Local checks

**51 PASS, zero FAIL, exit 0**, one Node syntax check, default network disabled. All **53** ordered migrations compiled in PGlite0.5.8/PostgreSQL18.3 with modeled Auth/Storage/default grants. New 56-source-input inventory includes 52 unchanged historical migrations, new guarded migration, changed canonical schema and unchanged shared helper/network guard.

Three added cases beyond the prior 48 reviewed-hook cases: complete fresh 53-migration catalog normalizes direct foreign workspace updates; actual canonical schema trigger stanza installs accepted coverage while every function/policy/grant/other trigger remains unchanged; actual new read-only deletion-lifecycle query reports current DELETE triggers/FKs/policy metadata without any modeled row change. Legacy coverage is explicitly recreated only in the isolated model to reproduce the old gap and test the guarded upgrade. Prior cases cover legitimate owner writes/relinks, denial effects, locked conversion/manual stand-ins preservation, idempotence, rollback/restoration, altered body/shape/role/replica rejection, exact provider hooks and provider drift rejection. No genuine Auth/JWT/hosted PostgreSQL17 or full CI acceptance is claimed.

The source suite also reproduces **two unlinked synthetic conversions after selected record deletion**. Existing DELETE behavior does not clean these polymorphic references. This was not fixed or hidden by the binding integration. A first attempt at the new metadata diagnostic failed with SQL42601 because references was a reserved CTE name; renamed to fk_rows, final query/suite passes. No hosted execution occurred during this correction.

## Next scoped handoff: deletion lifecycle metadata

The two earlier hosted orphan identities remain preserved, with recorded full-row fingerprints/times but no proven exact deleted-record IDs. Their disposition is separate from designing reliable future authorized record deletion. Before preparing a new cleanup trigger/function or changing grants, inspect deployed DELETE-capable triggers, selected plain-table/RLS/DELETE grant metadata, incoming/outgoing FKs and policy fingerprints for payment_records/payment_conversions. The complete new SQL is pasted in chat; owner runs only staging dczlddwbtgvfdujgcitb.

This read-only query invokes no application routines, reads no payment values/actor IDs/function bodies/credentials, creates/deletes no fixture, changes no trigger/policy/grant/account and ends ROLLBACK. Metadata arrays are capped at 20 triggers/50 FKs/50 policies with truncation flags; totals cover selected complete catalog sets. Grant presence alone is not a successful RLS write. Function hashes alone are not behavioral review. FK action codes are PostgreSQL catalog values (c cascade, a no action, r restrict, n set null, d set default). Polymorphic entity_id may have no payment-record FK; that absence must not be mistaken for tested cascade behavior.

FR.2.2 binding prevention, hosted owner rechecks/relink, exact current-run cleanup, scoped historical workspace repair and canonical source integration now have concrete evidence. Deletion/conversion lifecycle and old orphan disposition remain open. FR.2.3 Business/outbox source drift and other FR2 substeps remain pending. Full gate OPEN_PENDING_REQUIRED_EVIDENCE, final audit PLANNED_NOT_PERFORMED, hosted/native/store acceptance false, original finding/action definitions open, production excluded and APK deferred.

## Subsequent deletion catalog review — FRE24

[Complete owner metadata](security-fr-2-deletion-lifecycle-owner-result.json) at 08:22:46 UTC confirms eight FKs/two normal record DELETE guards and no record-conversion reference/cascade. The deletion-metadata-pending state above is superseded. [Guarded conversion-reference candidate](SECURITY_FR_2_2_CONVERSION_REFERENCE_CANDIDATE.md) has 38 source-catalog and three snapshot checks PASS and awaits owner installation. Old orphan rows remain preserved; no full deletion acceptance/canonical integration claimed.
