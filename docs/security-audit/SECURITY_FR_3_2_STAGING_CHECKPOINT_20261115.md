# FR.3.2 trusted file verification on staging

## Current result

**Stage 4/10 · FR.3/8 · FR.3.2 · COMPLETE on staging.** The canonical staging browser, authenticated file endpoints, server-only Storage policies, and signed cleanup were verified.

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

## Final coverage

| Surface | Verified outcome |
|---|---|
| Personal and Family payment proofs | Ordinary uploads validated and attached through the completed-payment RPC. Private readback succeeded in both workspaces. |
| Business logos | Staging uses the managed logo route. Owner branding update and private readback passed, an unrelated account was denied, and scheduled replacement cleanup removed the detached test logo. |
| Business documents | The ordinary endpoint validated and registered CSV and XLSX, verified retained private downloads and refused unregistered private downloads. Existing claim, bill and bill-payment evidence is linked below. |
| Subscription proofs | Managed PDF and image validation passed. The earlier hosted PDF run stored and read back a 10,482,531-byte receipt. |
| File capacity, cleanup and direct writes | Staging requires the server routes for uploads across four private buckets. Reservation and private download limits apply. Scheduled cleanup removed unlinked test files and preserved linked receipts. |

[Business bill-payment proof and download budget](security-fr-3-2-business-bill-payment-quota-staging-result.json) · [Scheduled Business cleanup](security-fr-3-2-scheduled-business-cleanup-staging-result.json)


## Managed subscription PDF uploads

The managed subscription endpoint preserves the 10 MiB PDF size allowance for supported static receipts. Hosted requests saved 3,687,266-byte and 10,482,531-byte PDFs and retrieved the canonical bytes through the existing broker. The unrelated staging account was refused. [Hosted acceptance](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43734802612)

The database reserves room before accepting a new object. The limits are eight unlinked files or 32 MiB per workspace owner. The billing proofs trigger binds validated metadata to the submitting owner and workspace. A ready file has 30 minutes to be attached. Disposable PostgreSQL tests checked the byte cap, repeated reservations, verified linking, exclusion of linked files from cleanup, and claim replay rejection. On staging, the signed scheduler removed both intentionally expired synthetic files and preserved all seven previously linked receipts. [Test evidence](security-fr-3-2-managed-subscription-upload-staging-result.json)

The canonical staging browser routes subscription images and PDFs through the managed endpoint and passes the returned metadata to the billing forms. Local checks cover staging-only selection, returned paths, normalized metadata and stale workspace context.

## Browser cutover and sign-off

The [hosted API run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43736994976) passed seven ordinary upload cases with disposable Personal, Family and Business fixtures. The first two browser attempts identified a form-entry test issue and a stale constant in the client receipt helper. The corrected preview passed. The canonical staging build then passed the hosted Add Payment form test, private readback, test payment deletion and direct Storage denial after cutover. Five changed browser assets and the staging configuration matched the staged payload byte for byte. [Preview run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43738524613) · [Canonical browser run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43738791222)

The final readback recorded four private buckets and two restrictive policies covering browser inserts and updates. The signed cleanup completed with zero pending managed uploads. Eight ordinary and three subscription test objects were reconciled as removed. Two linked synthetic Business documents and seven prior linked subscription proofs remain available as preservation evidence. The temporary Business and Family fixture settings were restored. [Completion evidence](security-fr-3-2-staging-completion.json)
