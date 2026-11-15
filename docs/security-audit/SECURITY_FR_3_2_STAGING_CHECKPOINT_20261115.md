# FR.3.2 trusted file verification on staging

## Current result

**Stage 4/10 · FR.3/8 · FR.3.2 · Committed subscription proof and review batch passed in staging. FR.3.2 remains open.**

| Subscription proof flow | Hosted checks | Saved result |
|---|---:|---|
| Personal renewal | 14/14 | Payment, request and invoice rejected by authorized staff. Proof retained. |
| Family plan request | 14/14 | Payment, request and invoice rejected by authorized staff. Proof retained. |
| Family renewal | 14/14 | Payment, request and invoice rejected by authorized staff. Proof retained. |
| Family extra places | 14/14 | Payment, request and invoice rejected by authorized staff after the active-entitlement fixture correction. Proof retained. |
| Business renewal | 14/14 | Payment, request and invoice rejected by authorized staff. Proof retained. |
| New Business plan | 15/15 | Normal submission and authorized rejection passed with a hidden synthetic plan. |
| Business extra seats | 14/14 | The existing billing quote, submission and authorized rejection passed. |

Each flow used the real submission RPC and the existing private-file broker. Each allowed the same normalized file on retry, rejected a second distinct file under the synthetic quota, and denied an unrelated ordinary account. The staging super-admin rejected each synthetic payment and could retrieve the exact proof. The authorized staff path verified here used that role. All five receipts were synthetic and represented no transfer.

The [first hosted run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43695816545) passed four flows and stopped the Family extra-places flow at its entitlement check. The [Family-only retry](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43696010695) passed. The [machine-readable evidence](security-fr-3-2-committed-subscription-flow-staging-result.json) records both outcomes. Each run also passed 10 unit tests for the shared proof validators.

After the runs, the five temporary upload gates were closed and the temporary changes to the submission and entitlement functions were removed. The synthetic Family workspace was closed, the Business subscription plan and term were restored, and the Business workspace was suspended again. The database readback found five linked receipts, zero orphaned receipts from this run, zero pending trial payments, and zero queued notification rows. All six runner-created sessions were logged out. An admin session that predated the runs was preserved. All four buckets remained private.

The [Business billing follow-up](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43729033993) added 29 hosted checks. The private test plan stayed unavailable in public checkout. The two additional rejected proofs remain linked, and the Business fixture's original plan and term were restored. [Business billing evidence](security-fr-3-2-business-billing-proof-staging-result.json)

## Logo cleanup and private downloads

The [signed logo cleanup retry](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43730473635) passed 19 hosted checks. The scheduler removed the replaced file while the new logo remained linked and readable. It then removed the final synthetic logo after unlinking. Across the test runs it removed four synthetic objects on the first claim for each. The first run stopped at fixture encoding before upload. The second runner timed out before the first scheduled invocation reached staging. The final run completed after the schedule became active.

Server-side replacement cleanup is enabled by default for staging Business workspaces. Valid replaced paths enter a queue with a one-hour grace period. The signed staging Worker checks once per minute and skips claiming when nothing is due. The scheduler removes objects through the Storage API. It checks that the path is no longer linked and verifies absence before settling the lease.

The shared private-file broker now counts requests and bytes per authenticated account across all four staging buckets. The staged limits are 60 requests and 64 MiB per minute. The [hosted download check](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43730403569) confirmed two normal proof downloads and two cross-account denials. Local SQL tests exercised the rate and byte limits across all four supported buckets, and 38 broker tests passed. [Logo cleanup and download evidence](security-fr-3-2-logo-cleanup-and-download-budget-staging-result.json)

## Broader FR.3.2 coverage

| Surface | Staging evidence | Remaining work |
|---|---|---|
| Personal and Family payment proofs | Selected image and PDF validators and browser entry points | Ordinary upload routes still use direct Storage calls. Enroll those routes in trusted validation, quotas and cleanup. |
| Business logos | PNG, JPEG and WebP selection, validation and preview in the isolated workspace | Scheduled reconciliation for replaced logos is enabled on staging. Ordinary uploads still use direct Storage. Add trusted validation and reservations for newly uploaded logos. |
| Business documents | Workspace attachments, CSV and XLSX, claim receipts, unpaid invoices, and paid bill proofs | Extend validated uploads and reservations to ordinary paths. |
| Subscription proofs | Five committed submissions, authorized rejection and broker retrieval on staging | Ordinary upload routing and cleanup still need rollout. The public Business plan remains unavailable for purchase in staging. |
| File capacity and cleanup | Selected Business capacity and concurrency checks, authenticated download limits, and signed Cloudflare invocation that removed a real orphan | Shared download quotas and replaced-logo cleanup are enabled on staging. General upload reservations and scheduled orphan reconciliation for newly uploaded files are open. |

[Business bill-payment proof and download budget](security-fr-3-2-business-bill-payment-quota-staging-result.json) · [Scheduled Business cleanup](security-fr-3-2-scheduled-business-cleanup-staging-result.json)

The regular proof UI accepts up to 10 MiB. The selected trusted proof validator accepts input up to 2 MiB. A locally generated 3,687,731-byte static PDF opened successfully in the PDF test library and was rejected by the validator at its configured size limit. Broad upload cutover remains open because it would reject some previously supported proofs and requires changing the normal app routes together with the database policies.
