# Stage 7 completion report — Subscription commerce

**7.4 / 12 October 2026 — CLOSED WITH CARRY-FORWARD. All four bounded steps have recorded outcomes.**
Reconciliation source pin: `2487b7c5b13abecb2be88a421483dc13b014b182`. This is an audit checkpoint closure at source, offline model/regression and owner-repeat scope. **Real provider verification, hosted commerce, native/store purchase and lifecycle acceptance remain BLOCKED / UNVERIFIED. Zero of 48 planned hosted/store grouped cases ran.**

[Final integrity recheck](security-stage-7-final-recheck.json) · [Eight OPEN actions](security-stage-7-remediation-actions.json) · [Finite Stage 7 plan](SECURITY_STAGE_7_COMMERCE_PLAN.md) · [Current progress](SECURITY_AUDIT_PROGRESS.json).

## Recorded outcomes

| Step | Recorded outcome | Actual evidence limit |
|---|---|---|
| 7.1 Source/product/channel inventory | 52 selected input bytes matched their Git identities; six primary public references reviewed; eight unconfirmed decisions/eight actions/48 planned cases recorded | Source and public documentation, not current private console/settings/catalog or store approval |
| 7.2 Candidate/local regression | 20 synthetic model cases plus ten unchanged selected manual regressions: 30 PASS/0 FAIL/exit 0, three Node syntax checks | Pure adapter/state proposal and actual selected client VM/source assertions; no runtime provider/backend/native integration |
| 7.2 Owner Windows repeat | Same 30 cases PASS/0 FAIL/exit 0, three syntax checks; all 12 hashes reconciled | Repeat of the local case set, with seven exact published hashes/five exact CRLF variants; no extra unique controls |
| 7.3 Bounded readiness | Six prerequisite groups and all 48 hosted/store cases BLOCKED / NOT RUN | No provider/database/dashboard/secret/device/binary inspection or purchase attempt |
| 7.4 Full report/reconciliation | 56 current input identities, 12 consumed input hashes and seven immutable structured records match; complete non-document diff is three offline additions | Integrity/reporting only; no fresh behavior/syntax/hosted/device execution |

No Stage 7 behavior-test failure is recorded. The missing purchase implementation is a feature/security evidence gap under existing **F03**, not a failed genuine store transaction. Earlier stage failures/reviews and carry-forward remain preserved rather than being absorbed into Stage 7's local PASS count.

## Existing commerce source and preserved behavior

The reviewed app uses server-priced requests, payment/invoice/proof submission, authorized manual review and server-derived entitlement. A screenshot, reference, review approval or privileged manual grant is not provider-verified store evidence.

Personal/Family requests and existing subscription renewals retain their source validation. Business quotes retain expiry, subscription/settings version and current/pending/scheduled capacity constraints. Business submission/retry and public-purchase source bind stable request/quote/payment/invoice/workspace/owner identities; review rejects self-review and invalid bindings, with delegation and replay handling. Manual Admin grants have bounded dates/reason/registered-owner guards and audit records without fabricating a payment/invoice/provider receipt. These are source observations, not newly proven effective hosted rules.

Later `20261002060000_business_public_availability.sql` makes public Business sales configurable behind complete product/price gates. Older feature-document wording that public sales are always closed is historical. **Current hosted availability and prices were not inspected or changed.**

Accepted manual Family anchored pricing and Business remaining-term fractions, current/scheduled capacity, reserved invitations, paid-term history and existing invoices remain untouched. Neither synthetic catalog values nor native provider behavior replace approved manual prices, finance FX/rounding or proration. Owner-inclusive membership rules and the separation of a member's own plan from shared access remain required.

Mushavo digital subscription purchases remain distinct from users recording their own expenses/payments. The retained synthetic actors/fixtures and two USD1 manual conversions are outside these offline executions and unchanged by Stage 7.

## Exact changes and candidate limitations

The complete Stage 7 non-audit-document diff from initial pin `bcb8f055f93cb9c145a0f74556e4bacb39847593` consists of three added files:

- `scripts/lib/stage-7-commerce-model.mjs`
- `tests/stage-7-commerce-model.test.mjs`
- `scripts/verify-stage-7-commerce.mjs`

The [candidate contract](security-stage-7-commerce-candidate-contract.json) is inert review documentation. Approved runtime catalog is null, configured adapter list is empty, and runtime/provider verification/ledger/receiver implementation flags remain false. The model is imported only by its offline tests. No app/Business/Admin, SQL/migration, Edge, package/lock, native builder/project or deployed purchase runtime changed; no non-document path was deleted.

The model imagines server-held account/workspace/intent and exact provider/environment/application/product binding. It rejects caller authority fields, foreign snapshots, unknown/ambiguous products, malformed paid windows/capacity and unmapped states. Proposals detach mutable inputs. Duplicate callbacks cannot add another term; synthetic sequence conflicts/stale updates and supplied revision conflicts are handled. A fixture refresh advances its watermark without extending access.

Projection uses normalized active/paid-canceled windows and does not grant for pending/hold/expired/revoked snapshots. It preserves independent manual records, requires a decision for overlapping active sources and retains suspension. It does not mutate finance rows, seats or manual grants.

**These behaviors are model proposals.** Injecting an adapter does not authenticate Google/Apple or verify a receipt/signature. Fixture sequence is not a real provider ordering field. Passing a prior record/revision does not supply a durable transaction, global unique chain ownership or concurrency protection. Normalized lifecycle labels do not implement actual grace/proration/restore rules. Product mapping and windows remain synthetic, not accepted SKU/price/purchase decisions.

**Not implemented or proven:** trusted provider-specific verification/state normalization; authenticated event receiver; durable ledger/outbox/retry/acknowledgment/recovery; source/ownership transfer policy; effective seat reservations/capacity; native billing bridge/channel UX; real restore/refund/renewal/cancellation; store sandbox/device effects. No API/provider/gateway/SDK was activated.

## Local evidence counts

| Evidence | Actual result |
|---|---|
| Assistant 7.2 verifier, Node v24.19.0 | 20 model + ten existing regression cases = 30 PASS, exit 0; three syntax checks |
| Owner 7.2 verifier, Node v22.17.0 | Same 30 PASS, exit 0; three syntax checks |
| 7.3/7.4 fresh behavior/syntax/hosted/device batches | Zero |

History totals **60 case executions, 60 PASS/0 FAIL**, representing two executions of one **30-case suite**, not 60 unique acceptance checks. Three Node syntax targets were checked by each verifier, six historical target executions. No PostgreSQL/provider/native compile or SDK check is inferred.

The unchanged Business Stage 10 test file contributes four actual selected client-function VM cases and one SQL-source containment case. The unchanged Admin manual-subscription test contributes one actual date-helper VM case and four SQL/UI source cases. Thus the ten existing cases contain five VM cases and five source assertions. They check selected expiry/suspension/owner billing, zero/missing configured prices, stale/out-of-order responses, grant guard source and date boundaries; they do not execute deployed quote/review/RLS/staff/MFA/proof/grant transactions.

[Assistant receipt/history](security-stage-7-commerce-local-checks.json) and [owner receipt/reconciliation](security-stage-7-commerce-owner-local-checks.json) remain immutable. The initial 7.1 eight test files were read, not executed there; only the selected two files ran at 7.2.

## Final integrity reconciliation

The [recheck](security-stage-7-final-recheck.json) records **56 distinct current input identities**: the original 52 reviewed targets plus four new candidate inputs. Twelve consumed input bytes match their current Git identities and assistant SHA256 values; these include eight original regression inputs plus the model, test, verifier and contract. The other reviewed targets are checked by current Git metadata, not described as 52 new byte reads.

Owner values reconcile to **seven exact published-byte matches and five exact LF-to-CRLF variants**, with zero unexplained difference. No arbitrary normalization is accepted as a match. The 7.3 per-case expected results remain identical to the frozen 7.1 matrix: all 48 retain BLOCKED_NOT_RUN/NOT_EXECUTED at readiness scope.

Seven structured records retain their published identities and are preserved: source inventory, decisions, frozen matrix, inert contract, assistant receipt, owner receipt and readiness receipt. The eight action definitions/links/owners/rechecks remain unchanged and OPEN. Original **123 coverage rows and 20 finding definitions**, Stage 0–6 progress objects, completed 7.1–7.3 objects and S7E01–S7E04 events remain preserved.

There was no code change or unresolved local test failure requiring a new behavior rerun at closure. The reconciliation does not establish installed frontend/SQL/policy/grant/provider/template/native parity or current private store settings. `candidate_deployed=false` is recorded offline scope, not a new deployment probe.

## Hosted/store readiness

All eight CO groups have six planned cases each: channel/product/price; manual web/proof/Admin; provider proof/ownership; authenticated events/recovery; lifecycle/refund/restore; seats/cross-channel; native UX; sandbox/operations/release. **All 48 are unrun and BLOCKED at readiness scope.** This is not 48 failed provider calls or accounts being blocked.

The six prerequisite groups are:

1. Approved actual channel/catalog/prices/terms and storefront/program eligibility.
2. Real verifier, authoritative state and durable purchase/event processing.
3. Exact staged source/grant/role/MFA/manual billing/private proof assurance and recoverable controlled actors.
4. Approved lifecycle/ownership/capacity/overlapping-source policy and accepted implementation.
5. Actual native route/build/device and controlled store sandbox configuration/products/roles/actors.
6. Operations/privacy/ledger retention/deletion/monitoring/recovery/disclosure/rollback evidence.

The [7.3 checkpoint](SECURITY_STAGE_7_3_READINESS_CHECKPOINT.md) and [per-case receipt](security-stage-7-commerce-readiness.json) identify the readiness dependencies and required evidence. CO02 remains blocked by its own manual staging requirements independently of the store implementation. Optional web callback CO04-03 is unrun because gateway selection is unconfirmed, not silently marked NOT APPLICABLE.

No current private provider/dashboard/device state was inspected. Operator Zimbabwe/individual facts remain prior owner reports; they do not establish merchant/storefront/program eligibility. All eight decisions remain unconfirmed; prior Paynow/Stripe questions select neither gateway nor registration route. Real prices/products/accounts/enrollment/regions were not newly adopted or verified.

## Open actions, findings and completion evidence

All rows below are **OPEN**, owned by **Both**; definitions remain in the [action index](security-stage-7-remediation-actions.json). They carry to final remediation and Stage 9/final re-audit, with other original assigned stage dependencies preserved.

| Action | Existing findings | Work and required recheck |
|---|---|---|
| CO-R01 Channel/product/price | F03/F01/F20 | Approve supported routes, exact products/plan/cycle/capacity/prices/offers/terms and actual eligibility; CO01 with real configuration evidence |
| CO-R02 Verification/ownership | F03/F15 | Implement trusted verification and server intent/chain binding; genuine sandbox allowed/denied proof, wrong account/workspace/app/product/environment and reuse; CO03 |
| CO-R03 Authenticated durable events | F03/F15/F19 | Implement actual provider transport and durable idempotency/reconciliation/acknowledgment; altered/replayed/reordered/concurrent/timeout/partial-failure tests; CO04/CO08 |
| CO-R04 Lifecycle/source projection | F03/F02/F15 | Approve/implement grace/hold/cancel/expiry/refund/revoke/restore/suspension/precedence; genuine provider/device/server effects without duplicate terms or finance deletion; CO05 |
| CO-R05 Capacity/cross-channel | F03/F15 | Preserve accepted manual proration/invoices and owner/reserved seats; implement approved native effective capacity/transfer/overlap; boundary/concurrency/provider changes; CO06 |
| CO-R06 Native UX/channel separation | F03/F05/F10/F17 | Implement selected bridge or qualifying access-only route and correct product/query/manage/restore/cancel/relaunch behavior; actual artifact/device/storefront evidence; CO07/CO08 |
| CO-R07 Manual guard acceptance | F03/F08/F13/F15 | Preserve and directly verify server quote/proof/review/self-review/delegation/replay/manual grants and effective staff/MFA rules; own/foreign/anonymous/role cases with real actors; CO02 and AU/AM/Business/UF dependencies |
| CO-R08 Sandbox/operations/final proof | F03/F19/F20/F17 | Bind exact settings/credentials/products/recoverable actors and final artifact; verify processing budgets/private logging/retention/recovery/rollback, all relevant CO cases and final re-audit |

The practical residual risk is that source/local PASS cannot justify charging native users or trusting caller purchase success. Attribution, capacity and lifecycle may be wrong without the real provider/server integration and accepted decisions. Earlier authorization, proof cleanup, privacy/audience/deletion, native identity/artifact and operational gaps remain required; Stage 7 does not close them.

**F03 and all related original findings remain OPEN.** The full release gate stays **OPEN_PENDING_REQUIRED_EVIDENCE**. Store acceptance, security clearance and permission for live purchase/provider activation or rollout are not inferred.

## Preservation and Stage 8 handoff

No real charge, purchase/refund/restore/cancellation, webhook/SDK activation, price/product creation, email, account/fixture/Auth/Storage/SQL setting, production deployment or native build/sync/install/sign/upload occurred in Stage 7. Production `kttkospkblwvguuwnhjj` remains excluded from these actions. A later authorized genuine batch must bind isolated staging `dczlddwbtgvfdujgcitb`, exact installed source/settings and controlled recoverable actors. Private credentials/raw proofs/customer records stay outside these reports. APK update remains deferred.

**No owner SQL, terminal, setup or file-opening action is required for 7.4.** The earlier complete optional PowerShell export/repeat was completed and reconciled; no rerun is needed.

**Next is 8.1 — notification/event/device source inventory and finite Stage 8 plan.** Follow the roadmap's native push transport and device/account token lifecycle, private notification content, event routing and available PWA/update/offline behavior scope. Retain existing server-only reminders, account/workspace isolation, prior push destination/quota prerequisites and native/storage/privacy dependencies. Begin with source/evidence and define bounded steps before any execution; this handoff does not authorize sending notifications, registering devices, changing provider settings or rebuilding the APK.

After remaining audit stages, consolidate and implement accepted remediation, obtain missing hosted/device/store evidence and run a fresh full audit of final source, deployments and artifacts. Stage 7 is closed as a recorded checkpoint; its unproven commerce requirements remain on that final worklist.
