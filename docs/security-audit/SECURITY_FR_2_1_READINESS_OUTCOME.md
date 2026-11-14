# FR.2.1 — staging metadata outcome and correction prerequisites

13 October 2026, FRE12. **Scoped read-only readiness collection complete with carry-forward.** No authorization acceptance, finding closure or data/permission/account/factor repair is claimed. [Complete safe owner receipt and reconciliation](security-fr-2-readiness-owner-result.json). [FR.2 sequence](SECURITY_FR_2_PLAN.md).

Owner CSV/JSON timestamp: **2026-10-13T19:49:45.300Z**, 21:49:45.300 Africa/Johannesburg. Source pin `12286dcbade07309bfb8ffe919224252f6cb8bff`; prepared query commit `36e4af77905354acbd9bd59cfbe747dacce5ea63`; target staging `dczlddwbtgvfdujgcitb`. `transaction_read_only=on`, executing role postgres. The receipt does not independently attest the selected dashboard project. The supplied file contains exactly one fr2_readiness CSV row with complete JSON; no SQL error is supplied. ROLLBACK was in the prepared script, but its separate command status is not included in the CSV; do not invent an independently captured rollback receipt.

## Expected versus observed

| Surface | Owner metadata result | Meaning and limit |
|---|---|---|
| `sync_payment_record_workspace()` | PL/pgSQL trigger, definer/path expected; LF body hash `8f568f342d4e928b4c27437ba7f544e5` MATCH | Selected body matches the reviewed schema fingerprint; ordinary caller effects not rerun |
| `guard_workspace_finance_write()` | PL/pgSQL trigger, definer/path expected; LF body hash `783883ce4af23615f768a0990b6f2478` MATCH | Last schema guard matches; still derives entitlement from parent without enforcing submitted record workspace equality |
| `set_payment_outbox_workspace_context()` | Shape/path expected; observed LF body hash `12f6ae6147b24860005e0cd6b4e59a2a`, expected `85794a38ffbe61b56bab8aff4b0a3319` MISMATCH | Current unexplained body drift remains; LF normalization alone does not resolve it; no cause/vulnerability verdict |
| Four selected triggers | All present, origin enabled, expected public function associations | Partial attachment metadata only; not the old full 78-trigger/dispatch closure |
| Paid-record sync coverage | UPDATE column list only payment_item_id; event bits 23 | Direct workspace_id-only UPDATE remains outside this normalization trigger |
| Nine selected public relations | All present, RLS on, FORCE RLS off | Metadata flags, not proof of own/other caller authorization; FORCE RLS off alone is not a finding |
| Policy metadata | 30 distinct selected table/policy rows | Fingerprints/roles/commands supplied, not full prior 58-policy parity or policy-expression semantic acceptance |
| Paid records | Five total; one parent/record workspace mismatch; zero missing parents/null record workspaces | Current aggregate consistency issue; affected row provenance/owner/fixture scope unverified |
| Payment-record conversions | Five total; one conversion/record workspace mismatch; zero missing records | Current aggregate issue; whether it involves the same record or either retained USD1 conversion is not established |
| Admin operator/helpers | Zero active super users with verified TOTP; zero candidate helpers | Verified, separately controlled recovery-ready operator and coordinated server/UI/Edge prerequisites remain unavailable |

All three selected routine fingerprint expectations, presence/shape/path fields, four named trigger associations, nine table flags and 30 unique policy rows were parsed/reconciled. Policy distribution: budget_workspaces four, business_member_permissions two, business_member_scopes two, business_role_permissions two, payment_conversions one, payment_items five, payment_records five, workspace_invitations two, workspace_members seven. No unrelated routine/table/source parity is inferred.

The sync and finance guard routines report anon/authenticated EXECUTE metadata; the outbox reports neither. These three are trigger-return routines, so grant metadata alone does not demonstrate an ordinarily callable unauthorized HTTP effect. No blanket revoke or application invocation follows from this receipt. Protected callable/transitive role tests remain later work.

The result reports zero application routines invoked, no row/account/permission/factor changes, no raw row/function-body/email/secret output and hosted_acceptance=false. There is no new API, actual Auth, browser, job, mail, device or store test PASS count. The prior 26 Personal passes/one REVIEW, 33 Family passes, 23 currency passes, blocked Business/Admin/Auth outcomes and FR.1 65-case serving PASS remain distinct retained evidence.

## Concrete next step and preservation

**FR.2.2 — prepare the narrow preventive Personal binding candidate and meaningful local controls.** The selected sync/guard identities are now known, so correction preparation can target direct submitted workspace changes while preserving legitimate parent-derived Personal/Family/Business writes and valid relinks. Review exact trigger shape/ordering and selected effects, prepare rollback and verify own/foreign/anonymous boundaries before hosted installation. Do not install broad MFA enforcement or overwrite the finance/outbox routines as a shortcut.

Historical row/conversion repair is a **separate plan**, requiring private affected-row provenance and customer-versus-synthetic classification first. The one-record and one-conversion aggregates do not identify the same pair or imply that the two retained manual conversions are affected. Do not normalize all historical rows, delete all fixtures or rewrite locked conversion history on this result alone. Retained actors, inactive Personal fixtures, Family history, two manual USD1 conversions and stopped successful recovery target remain designated for preservation.

Before Business fixtures, privately reconcile the actual outbox body and dispatch closure without printing raw function bodies/secrets or bypassing the guard. Before Admin enforcement, establish a separate controlled verified operator and independent recovery path, and review full policy/grant semantics. Genuine Auth settings/inboxes/recovery/AAL2 remain unverified. Current frontline static asset acceptance does not substitute for these controls.

No repeated readiness query, terminal command, upload, privilege grant, account promotion/enrollment or repair is requested at this checkpoint. Original 123 coverage rows, 20 findings, Stage 0–10 objects, 11 preceding final-remediation events, action/decision definitions and all earlier receipts remain preserved. Full hosted/native/store acceptance remains false; finding closure list empty; release gate OPEN_PENDING_REQUIRED_EVIDENCE; fresh full final audit PLANNED_NOT_PERFORMED; APK deferred.
