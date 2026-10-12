# 7.2 — Commerce review model and local regression checkpoint

Date: 12 October 2026. Audit branch: `security/stage-3-authorization`. Source parent: `1153f77b612170612111b6b00ec82e620a78d749`. This is the second of four bounded Stage 7 steps. Next **7.3** is one finite readiness/staged/store-sandbox outcome; full report remains due at **7.4**.

## Recorded outcome

**30 PASS, 0 FAIL, exit code 0**, with three Node syntax checks. One successful assistant execution on Node v24.19.0: 20 new synthetic model cases and 10 unchanged manual commerce regressions. No skipped/cancelled/todo cases. Eight existing regression inputs were freshly fetched at the parent pin and matched their Git blob identities exactly. The [receipt](security-stage-7-commerce-local-checks.json) records all 12 consumed file SHA-256 values. No real provider, PostgreSQL, hosted, device or store check was run; **0 of 48 planned CO cases executed**.

This milestone supplies a reviewable offline proposal, not a runtime purchase implementation. All eight CO actions and original findings remain OPEN. No provider/account/channel/product/price choice was adopted, no charge occurred and hosted acceptance remains false.

## Exact candidate and test changes

| Path | Purpose |
|---|---|
| `scripts/lib/stage-7-commerce-model.mjs` | Pure model for a bound normalized snapshot proposal and read-only source projection |
| `tests/stage-7-commerce-model.test.mjs` | 20 behavior/counterexample cases with synthetic verifier adapters and catalog |
| `scripts/verify-stage-7-commerce.mjs` | Node built-ins only runner, counts, syntax checks and exact input hashes |
| `docs/security-audit/security-stage-7-commerce-candidate-contract.json` | Inert limitations/required-before-adoption contract; no configured adapters or approved catalog |

The model is imported only by the new offline test. App, Business, Admin, SQL, Edge, package/dependencies, native builder and native project sources are unchanged. No deployment, migration, SDK installation, build/sync/install/sign/upload, email, provider activation, account/fixture/Storage/Auth setting or finance-data mutation occurred. APK update stays deferred; the two retained USD1 conversions remain outside this execution.

## Behavior reviewed

The simulated server holds the account/workspace/intent binding and unique provider/environment/application/product mapping. The request supplies only a proof reference: caller verified flags, plan/price/owner fields fail before the synthetic adapter is called. Each foreign binding, unknown or ambiguous product, malformed term/sequence/capacity and unmapped lifecycle label fails closed. Output detaches mutable inputs.

Retries preserve the paid window rather than adding another term. A fixture sequence watermark rejects older normalized snapshots; equal-sequence conflicting facts fail. An unchanged refresh advances its watermark, preserving its window. Renewal uses the supplied normalized window. A supplied expected-revision mismatch rejects a proposal; chain replacement requires a future approved ownership policy.

Active or paid-canceled normalized windows grant model access only inside their half-open term. Pending/hold/expired/revoked states do not grant store access. Revocation leaves an independent active manual source intact. Overlapping active manual/store sources return `REVIEW_SOURCE_PRECEDENCE` with unknown access, rather than inventing an approved precedence or merging seats. Suspension wins over either source. The projection never writes finance records, entitlement dates, capacity or manual grants.

These are synthetic proposals. Adapter injection **does not authenticate a provider**. Fixture sequence is **not a Google/Apple event ordering field**. The prior-record argument **does not prove global unique chain ownership or concurrent durable CAS**. Normalized lifecycle labels do not implement actual provider lifecycle/proration rules. The model intentionally lacks real verification, event authentication, acknowledgment, ledger/database/outbox, seat reservations, native billing UX, restore, protocol normalization or approved cross-channel policy.

## Existing manual flow regression

The unchanged `tests/business-stage-10.test.mjs` contributes four VM executions of actual selected Business client functions and one SQL-source containment assertion. It exercises expired/suspended access, owner-only billing, configured zero/missing prices, stale workspace responses and out-of-order refreshes.

The unchanged `tests/admin-manual-subscription.test.mjs` contributes one VM execution of the actual Admin date helper and four SQL/UI source assertion cases. It retains bounded manual grants, ownership/role/date/reason guard source, audited grants without fabricated invoice/payment evidence, and existing date boundaries.

These ten cases do not execute PostgreSQL, deployed staff/MFA/RLS rules, quotes, reviews, proof upload/cleanup or actual grants. Earlier AM/AU/Business/UF dependencies remain required. Accepted web prices, Family/Business manual proration, invoices, finance rounding, reserved invitations and server review/provisioning behavior are not rewritten by this model.

## Action contribution and residual scope

| Existing action | This milestone contributes | Still required |
|---|---|---|
| CO-R01 | Synthetic exact product binding/capacity validation | Actual approved channels, catalog, prices, storefront/program eligibility |
| CO-R02 | Foreign binding rejection and no caller-authority fallback | Genuine trusted provider verification and durable rightful ownership |
| CO-R03 | Retry/window/conflict/watermark/revision model | Authenticated provider protocol, real ordering/reconciliation, transactional ledger/global chain claim/CAS/recovery |
| CO-R04 | Read-only normalized lifecycle/source/suspension projection | Actual lifecycle/restore/refund, grace mapping and approved source precedence |
| CO-R05 | Synthetic mapped capacity and no overlapping-source merge | Reserved seats, effective capacity, approved provider upgrades/proration/transfers |
| CO-R06 | No runtime/native contribution | Approved channel UX and actual billing bridge or qualifying access-only route |
| CO-R07 | Ten unchanged selected manual source/VM regressions | Direct hosted own/foreign/staff/MFA/proof/retry behavior |
| CO-R08 | Reproducible offline runner and honest limitations | Exact isolated sandbox products/accounts/credentials, operations, real backend/device effects and final release evidence |

All eight actions remain OPEN, all eight decisions remain unconfirmed and no original finding closes. The 48 planned hosted/store cases remain frozen and unrun; the 20 model cases are separate tests, not a replacement or a claimed CO acceptance result.

## Owner handoff

No SQL, configuration, checkout, installation or execution-policy change is required. An optional full PowerShell block is supplied in chat: fetch the audit branch, export the published candidate pin into a unique temporary folder and execute this Node verifier. It reads only that export and starts local child Node processes, without network/provider/database calls. Expected result: **30 PASS, 0 FAIL, exit 0**, three syntax checks. Owner Windows Node version and line-ending hashes may differ; reconcile exact bytes/CRLF variants from a returned receipt, without calling either hosted proof.

## Preservation and next step

Original 123 coverage rows/20 finding definitions, Stage 0–6 progress objects, the completed 7.1 object, S7E01 and prior receipts are preserved. The central registers receive only an appended latest status; no definitions are removed or rewritten.

**7.2 is complete at offline candidate/regression scope. Next 7.3 records one bounded readiness/sandbox outcome.** Missing genuine implementation/catalog/provider/device prerequisites will be reported as BLOCKED/NOT RUN and carried to final remediation rather than starting an indefinite setup loop. The full Stage 7 report is due at 7.4. Release gate remains OPEN_PENDING_REQUIRED_EVIDENCE.
