# FR.2.2 — exact relink cleanup committed; historical linkage handoff

14 October 2026, FRE21. [Complete owner cleanup result](security-fr-2-relink-cleanup-owner-result.json), [prior guarded cleanup scope](security-fr-2-relink-cleanup-contract.json), [historical query local checks](security-fr-2-historical-review-local-checks.json).

## Accepted cleanup scope

At 06:29:20 UTC the owner returned the script's after-COMMIT result for exactly **AUDIT-FR22-RELINK-5f93bfbe-5830-457d-b3a4-c1088d4711fd** in intended staging dczlddwbtgvfdujgcitb: four inactive Personal items, two paid records, and two linked locked USD1 identity conversions deleted under exact assertions. All other rows in payment_items/payment_records/payment_conversions were privately compared unchanged within the locked transaction before COMMIT. The test's six fixture rows and two derived conversion rows are no longer retained. This supersedes the preceding current-run cleanup pending state; the candidate/earlier owner receipts remain immutable history.

The earlier mismatched record/conversion and two unlinked conversions were not selected. Retained Family/manual conversion rows were not selected and fall within the asserted non-target preservation scope. This receipt does not separately recompute the d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3 manual checksum. Five/seven record/conversion totals are expected from earlier seven/nine minus exact two/two, rather than newly measured totals. Next read-only query measures those totals and the same full scoped Family checksum together with the remaining historical linkage.

Privileged SQL execution used transaction-local fixture owner request claims with normal finance/suspension guards enabled. This is administrative cleanup attribution, not a genuine Auth/JWT session or additional client RLS acceptance. No history repair, trigger bypass, grants/accounts/factors/Auth settings changes, independent project attestation or full finding closure is claimed. Production excluded, APK deferred; original Stage 0–10/123 coverage/20 finding definitions/actions/decisions/prior FRE01–20 remain intact.

## Next concrete read-only review

Run the complete SQL pasted in chat only in the selected staging SQL Editor. It calls no application routines, writes no tables or fixtures and ends with ROLLBACK. The privileged catalog guard, read-only transaction, 15-second statement timeout, three-second lock timeout and UTC setting are transaction-local.

The query combines the existing consistency/manual scope with:

- completed relink marker item count;
- bounded details for each remaining record-parent mismatch, including full-row SHA256 fingerprints, creation timestamps, exact prior audit name/notes shape, owner/creator/recorder agreement, parent/record workspace ownership and associated conversion counts;
- paired record-parent and conversion-record mismatch count using the same record join;
- bounded details for missing-record conversions: full-row fingerprints, creation/rate timestamps, owner workspace/identity/null entered-by flags and correlation with a declared 04:30–04:37 UTC window surrounding the owner Personal recheck completed at 04:36:34 UTC.

Window correlation and audit names/notes are diagnostic clues. They do not prove which deleted record generated an orphan, demonstrate exact historical test provenance, or authorize historical deletion/repair. No raw row IDs, emails, row contents, keys or notes are printed; timestamps and safe booleans/counts/fingerprints are printed. Detail arrays stop at twenty rows with explicit truncation flags; counts cover all selected rows. SHA256 fingerprints identify a stable inspected full-row state without revealing its raw ID. The query does not inspect complete external/general application references, provider jobs or automatic conversion history.

The remaining one/one mismatch might refer to the same record with its conversion already matching the parent workspace; this query measures that relationship rather than inferring it from aggregate counts. If predicates/ownership or extra rows differ, review actual result before preparing a guarded repair. Canonical schema/migration integration of the accepted preventive trigger coverage remains pending; do not run stale source migrations against staging as part of this handoff.

## Local validation

Actual query executed in a minimal synthetic PGlite 0.5.8 / PostgreSQL 18.3 catalog: **six checks PASS, exit 0**, one Node syntax check. Cases cover paired mismatch/parent ownership, missing-record fingerprint classification without provenance claims, two full scoped Family manual rows and changed value detection, manual orphan/out-of-window classification, twenty-row cap versus complete orphan counters, and read-only table preservation with raw ID/email omission. This is a narrow query validation, not compiling all source migrations, hosted PostgreSQL17/API/JWT validation or an actual hosted result. No new hosted requests were run by the assistant.

Full final-remediation gate OPEN_PENDING_REQUIRED_EVIDENCE; fresh final audit PLANNED_NOT_PERFORMED; hosted/native/store acceptance false and findings_closed empty. Return the safe JSON after SQL finishes.

## Subsequent owner historical result — FRE22

[Complete historical review](security-fr-2-historical-review-owner-result.json) measures five/seven totals, zero latest marker items and matching retained Family checksum at 07:32:43 UTC. The history-query-pending state above is superseded. One exact paired record/parent/conversion mismatch is identified; [guarded workspace repair candidate](SECURITY_FR_2_2_HISTORICAL_REPAIR_CANDIDATE.md) has 12 local PASS and awaits owner result. Two orphan rows remain preserved without proven deleted-record lineage.
