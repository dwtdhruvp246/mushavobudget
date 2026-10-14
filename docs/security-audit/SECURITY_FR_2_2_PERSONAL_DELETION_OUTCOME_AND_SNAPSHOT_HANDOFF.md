# FR.2.2 — Personal live API deletion passed; global read-only snapshot next

14 October 2026, FRE26. [Full owner-returned JSON](security-fr-2-personal-deletion-owner-result.json). Candidate/source pin **51ef55331264ff59e160733e5902128f54caebe4**; completed **12:47:57.368 UTC**, exit **0**.

## Hosted outcome

**All 30 grouped checks PASS**, no REVIEW/problem. The checker made 190 bounded staging requests, independently reread the two genuine Auth sessions, confirmed ordinary/nonsuspended accounts, owned active Personal scopes, unchanged existing currency settings and generated reference visibility/shape through the API schema cache.

Each actor exercised RECORD and ITEM deletion paths using exact new inactive once USD1 items, paid records and identity conversions. Outsider and anonymous record/conversion DELETE attempts had no effect and complete protected rows were read back by the owner; ITEM paths also denied outsider/anonymous parent-item DELETE. Owners' direct conversion DELETE had no effect under the existing RLS. Authorized owner record DELETE removed the new record and conversion while retaining the unchanged item; the owner then removed that now-empty item. Authorized owner item DELETE cascaded through the exact new record and conversion.

All **four new items, four new records and four new identity conversions** were absent at completion. Both actors' entire visible pre-run item/record/conversion baselines, including old orphan and retained Family manual rows, matched their private captures. Selected settings remained unchanged; no residual current-run fixture effects indicated. Only the two API-created sessions were logged out scope=local. Safe run marker: **AUDIT-FR22-DELETE-d3f8d44e-a1a1-468b-a422-856475c24b84**.

This is owner-executed genuine JWT API evidence, not assistant-hosted access or privileged claims simulation. Complete raw JSON preserved; its hosted_acceptance=false and findings_closed=[] refer to full acceptance/closure. This narrow Personal record/item conversion deletion behavior is now verified for the tested ordinary actors and USD identity paths.

## Next: schema-aware global snapshot

Run the already reviewed read-only diagnostic **supabase/diagnostics/security_fr_2_2_conversion_reference_snapshot.sql**, pasted completely in chat. Only selected staging dczlddwbtgvfdujgcitb. Counts and aggregate fingerprint, no application routines/payment identifiers/raw rows/credentials; transaction ends ROLLBACK.

Expected carried-forward state if no independent intervening changes: five payment records; seven payment_record conversions; no missing parent/null record workspace or joined workspace mismatch; two old orphan identity conversions still preserved; two exact scoped Family manual USD1 rows/names and original-column checksum **d707a69847876b25aea7d1ac453b80175affd454712820aa6944fb0d6986ddd3**. Generated column and reference FK present; FK still intentionally NOT VALID. New checksum excludes ONLY the added generated payment_record_ref member so it can compare the original manual-row shape. The existing three synthetic Family query cases from FRE24 support that projection, not a fresh hosted fingerprint.

Current API readback confirms private visible baselines; the new global SQL measurements have not yet been received. Expected values are not declared observed values. On mismatch/error, review evidence before any repair/cleanup. Do not remove the two old orphans by time correlation or audit shape. Old orphan lineage/disposition and final FK validation remain separate.

## Source integration and wider carry-forward

Accepted reference/reservation changes remain a controlled remediation candidate, outside canonical schema/automatic migrations pending this affected-snapshot review and source integration. Earlier canonical workspace-binding integration and exact historical one-record repair remain preserved. Subsequent integration must retain all existing permissions, row values and legacy orphan exceptions; no broad schema reload/db push or hosted ledger registration is implied.

Three Personal hosted recheck batches are now complete: original CRUD33, relink16 and current deletion30. Their arithmetic sum79 counts grouped checks across distinct scopes/rechecks, not79 distinct original audit requirements. No concurrent transactions, automatic FX/provider writers, account/workspace/Family lifecycle, Business/outbox drift, Admin/MFA/Auth or scheduler/history acceptance is inferred. Full F15/finding closure and full hosted/native/store acceptance remain false; final audit PLANNED_NOT_PERFORMED; 123 coverage rows/20 finding definitions, original Stage0–10 and all FRE01–25/events/actions/decisions preserved. Production excluded; APK deferred. No new assistant-hosted request or account/setting/native change performed in this turn.
