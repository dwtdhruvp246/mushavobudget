# 7.1 — Subscription commerce source and decision inventory

**12 October 2026 — COMPLETE AT SOURCE/POLICY/DECISION-INVENTORY SCOPE (S7E01).**
Source pin: `bcb8f055f93cb9c145a0f74556e4bacb39847593`. **52 freshly fetched selected source/configuration/document/test inputs match current Git blob identities; zero mismatches.** This includes 40 code/configuration/SQL inputs, eight test files read but not run, and four feature documents. **Zero local behavior, hosted/store sandbox or device cases ran. No charge/refund/restore/cancellation/provider request or console/configuration change occurred.**

[Finite Stage 7 plan](SECURITY_STAGE_7_COMMERCE_PLAN.md) · [Source inventory](security-stage-7-commerce-source-inventory.json) · [Decisions](security-stage-7-commerce-decisions.json) · [48 planned cases](security-stage-7-commerce-test-matrix.json) · [Eight OPEN action entries](security-stage-7-remediation-actions.json).

## Existing manual commerce source

| Area | Reviewed source behavior | Evidence still required |
|---|---|---|
| Personal/Family subscription requests | Authenticated owner, eligible plan/period/currency, server-derived price and member usage; amount revalidation, pending review, invoice/payment/proof records | Direct current hosted own/foreign/anonymous/suspended/retry/approval effects |
| Family creation/extra places | Manual request creates/provisions after approval; server quote/expected amount and current expiry/capacity binding; anchored-month charge model | Actual concurrency, term-boundary and accepted historical invoice preservation |
| Existing-owner Business billing | Configured included seats/base/seat prices; 30-minute versioned quote, same quote/payment retry and pending review; expiry/version/usage checks | Exact deployed settings/parity, valid and denied direct calls, quote/submit/review races |
| Business review/renewal | Staff review/delegation, Business self-review restriction, quote/payment/invoice/workspace checks; approval changes current/scheduled term/capacity and records audit/receipt | Genuine staff/MFA, replay and lifecycle evidence; source is not provider proof |
| Business public purchase | Later source adds configurable complete-price gates, stable submission ID and protected approval/provisioning | Current availability/configuration unknown; do not open products or assume prices here |
| Admin plan workbench | Versioned/scheduled web definitions/prices; submitted/accepted invoice snapshots retained; previews are previews | Server direct permission/MFA, concurrency and current hosted catalogue verification |
| Manual/test grants | Super-admin-only source, bounded dates/reason and registered-owner/workspace constraints; audited entitlement grant, not a purchase receipt | Effective grants/assurance and source-precedence policy when store purchases exist |
| Uploaded subscription proof | Existing metadata/path/owner checks and restrictive Business proof/direct-write controls | Actual byte validation/private signing/processing/cleanup under UF plus direct commerce rechecks |

Business feature roadmap “Stage 10” is separate from security-audit Stage 7. Its earlier document says public Business purchase is closed. **Later 20261002060000_business_public_availability.sql makes it configurable**, subject to product availability and complete configured pricing, and supports staff-approved workspace provisioning. That source supersedes the older unconditional closed statement. This does not establish that current hosted public sales are enabled.

Business rates and included capacity are configurable, with unconfigured and intentional zero-price states distinct. No historical catalogue/default/example price or capacity is adopted as a new owner decision. Family web pricing uses anchored-month factors; Business web additional seats use remaining-term fractions. Those are separate manual models, not automatic store upgrade/proration rules.

Source records reviewed include the consolidated SQL and selected later migrations/candidates. They were **not installed, executed or modeled into an accepted hosted catalogue**. The selected Stage 3 MFA candidate replaces relevant staff checks with platform_admin_authorized; its presence does not prove deployed MFA or effective grants. Earlier AM/Business readiness, AU identities and UF proof controls remain prerequisites.

## Store-purchase and channel gaps

The selected client/dependency/SQL paths and seven inspected Edge entry points contain no identified store billing bridge/client calls, provider purchase/transaction ledger, backend purchase verification or incoming payment callback receiver. No native/sandbox purchase was attempted. Existing manual invoices, screenshots, payment reference strings and Admin grants are not App Store/Play verification.

The packaging builder copies shared app/business pages, including manual subscription forms, and bridges App/Preferences. There is **no inspected store-channel purchase bridge or checkout gate**. Actual installed APK/iOS/storefront behavior remains unverified under NR; this is a source distribution gap, not an observed store rejection.

Decide the actual route before adapting native purchase UI. A native WebView carrying manual payment instructions or upload-to-unlock flow must not be silently treated as store billing. Preserve valid web/PWA usage while meeting the chosen native channel's requirements. Region/program qualification and permitted external links must be verified, not inferred from operator country or a client profile field.

## Current primary store requirements

Mushavo plan fees unlock digital budgeting features; that classification is an **inference from the reviewed product/source**, separate from recorded rent, bills or business expenses. Google explicitly includes financial-management/cloud software in its digital billing scope. Its policy has eligible-region/program conditions for alternative billing and external purchase links. Do not assume the manual web route or a gateway is permitted inside every Play-distributed storefront. [Google Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738).

Apple's 3.1.1–3.1.3 rules address digital unlocks, subscriptions, storefront-specific links and qualifying multiplatform/enterprise/companion routes. The Personal/Family offering means a Business workspace alone cannot establish a whole-app enterprise exception; that is an applicability inference. A qualifying access-only route has conditions and changes what native purchase UI can offer. No exception/enrollment/store approval is certified here. [Apple guidelines](https://developer.apple.com/app-store/review/guidelines/).

This review does not set store fees, prices, territories, SDK deadlines or legal/operator enrollment facts. Current console products/accounts/program eligibility were not inspected. Reconcile policies and actual selected storefront/program conditions again for final release; broad external-payment approval is not inferred from public news.

## Provider verification and durable entitlement design

**Proposed boundary:** native/client presents a purchase result to a trusted backend; the backend verifies the selected provider proof, app/product/environment and eligible purchaser/workspace binding before projecting access. No caller amount, screenshot, decoded-but-unverified payload or boolean verified flag can grant a store entitlement.

Google's security guidance calls for backend purchase-token verification and eligibility/ownership checks before entitlement, with acknowledgment handled appropriately. Its lifecycle guidance uses RTDN as a prompt to fetch authoritative subscription state; cancellation/hold/recovery are not just browser timers. [Play verification](https://developer.android.com/google/play/billing/security), [lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

An authenticated Pub/Sub push route requires signature validation and matching configured audience/service-account claims. That authenticates transport; purchase state still needs trusted verification. [Google push authentication](https://docs.cloud.google.com/pubsub/docs/authenticate-push-subscriptions). Apple's official verifier supports signed transactions, renewal information and notification payloads with app/environment/certificate checks. JSON decoding alone is not that validation. [Apple SignedDataVerifier](https://apple.github.io/app-store-server-library-node/classes/SignedDataVerifier.html).

Provider protocols differ. Do not implement every callback as an imagined HMAC header. Any chosen web gateway requires its actual protocol; no Paynow/Stripe or alternative provider choice is inferred from inquiry or manual payment-method labels. Credentials/certificates/service roles stay private/server-side.

Keep durable purchase-chain ownership and event state separate from transport-message dedup. One Google token/Apple original transaction chain can have lifecycle updates; “seen once, ignore forever” is not sufficient, and blindly adding another month for every callback is not safe. Verify current authoritative state, serialize logical updates, handle duplicate/reordered/concurrent events and partial failure, and distinguish acknowledgment/provider ambiguity from committed entitlement.

**Proposed entitlement-source ledger:** record verified store source separately from authorized manual grants; project plan/term/capacity under approved precedence. The existing workspace subscription row cannot by itself resolve overlapping purchases, refunds or an Admin override without that policy. Refund/cancel/expiry should change the correct entitlement source, not erase finance records or silently undo account suspension. This is design, not an implemented ledger.

## Product, seat and cross-channel decisions

The [decision record](security-stage-7-commerce-decisions.json) keeps eight unconfirmed items explicit: channel/storefront/program route; store product/plan/cycle/seat mapping; native prices/currencies/offers/terms; ownership/restore/multiple workspaces; proration/effective capacity; optional web gateway; overlapping-source/manual-grant precedence; sandbox/operations/retention/rollback.

Store products/quantity rules must map intentionally to Personal, Family and Business plans, owner-inclusive seats and pending invitation reservations. Preserve accepted web invoice amounts and Family/Business manual algorithms. Native provider upgrades/downgrades and localized prices require their own selected mapping; manual web quote amounts or currency-conversion rates are not native checkout authority.

Define current/future capacity, early renewal, scheduled reduction, member removal, ownership transfer, paid expiry and restore against the approved product model. Shared Family/Business access remains distinct from each member's own Personal subscription. A purchaser, workspace owner and user account are not interchangeable merely because email strings match.

Known operator intent/report remains prior owner evidence: Dhruv Parekh, Zimbabwe, individual/not yet registered business; territories/age safeguards and actual merchant/store enrollment remain unresolved. No account/product/provider has been created or accepted by this source review.

## Acceptance contract and actions

Eight groups each contain six planned cases, **48 grouped cases / zero run**: CO01 channel/product/price; CO02 manual/proof/Admin regressions; CO03 provider proof/ownership; CO04 authenticated event/idempotency; CO05 lifecycle/refund/restore; CO06 seats/cross-channel; CO07 native UX; CO08 sandbox/operations/release.

The cases specify actual trusted-adapter/provider/server/device evidence where required. Local models may test review contracts later but cannot satisfy genuine provider signing, payment, restore or production-grant acceptance. Counts overlap earlier AU/AM/Business/UF/NR requirements; they are not 48 additional unique global controls.

CO-R01–CO-R08 remain OPEN under existing findings: approve mapping; implement purchase verification; durable authenticated events; lifecycle/source projection; seats/cross-channel; native UX/channel separation; retain/directly test manual guards; controlled sandbox/operations/final proof. These are action entries, not eight new finding definitions. F03 and related findings stay OPEN.

**7.1 complete; next 7.2 reviewable commerce-boundary candidate/local checks; full Stage 7 report due 7.4.** The existing 123 rows/20 definitions, Stage 0–6 objects and all earlier receipts remain preserved. No code/runtime, price/product/configuration, account/fixture/Auth/Storage/SQL/provider/charge/refund/restore/production/native change; no finding closure. Retained manual conversions stay unchanged; APK update deferred.

No owner SQL, terminal or file-opening action is required for this source-review step.
