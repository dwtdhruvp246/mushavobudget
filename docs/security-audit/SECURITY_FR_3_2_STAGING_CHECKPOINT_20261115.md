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

Each flow used the real submission RPC and the existing private-file broker. Each allowed the same normalized file on retry, rejected a second distinct file under the synthetic quota, and denied an unrelated ordinary account. The staging super-admin rejected each synthetic payment and could retrieve the exact proof. The authorized staff path verified here used that role. All five receipts were synthetic and represented no transfer.

The [first hosted run](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43695816545) passed four flows and stopped the Family extra-places flow at its entitlement check. The [Family-only retry](https://github.com/dwtdhruvp246/mushavobudget/actions/runs/43696010695) passed. The [machine-readable evidence](security-fr-3-2-committed-subscription-flow-staging-result.json) records both outcomes. Each run also passed 10 unit tests for the shared proof validators.

After the runs, the five temporary upload gates were closed and the temporary changes to the submission and entitlement functions were removed. The synthetic Family workspace was closed, the Business subscription plan and term were restored, and the Business workspace was suspended again. The database readback found five linked receipts, zero orphaned receipts from this run, zero pending trial payments, and zero queued notification rows. All six runner-created sessions were logged out. An admin session that predated the runs was preserved. All four buckets remained private.

## Broader FR.3.2 coverage

| Surface | Staging evidence | Remaining work |
|---|---|---|
| Personal and Family payment proofs | Selected image and PDF validators and browser entry points | Ordinary upload routes still use direct Storage calls. Enroll those routes in trusted validation, quotas and cleanup. |
| Business logos | PNG, JPEG and WebP selection, validation and preview in the isolated workspace | Ordinary logo uploads still use direct Storage calls. Replacing a logo relies on the browser to attempt deletion, so add server-side reconciliation. |
| Business documents | Workspace attachments, CSV and XLSX, claim receipts, unpaid invoices, and paid bill proofs | Extend validated uploads and reservations to ordinary paths. |
| Subscription proofs | Five committed submissions, authorized rejection and broker retrieval on staging | Ordinary upload routing and cleanup still need rollout. The new Business plan purchase and Business extra-seat billing proof were outside this selected run. The public Business plan remains unavailable for purchase in staging. |
| File capacity and cleanup | Selected Business capacity and concurrency checks, authenticated download limits, and signed Cloudflare invocation that removed a real orphan | Generalize upload and download quotas and scheduled cleanup. The shared Business workspace limit currently has no enabled workspace. |

[Business bill-payment proof and download budget](security-fr-3-2-business-bill-payment-quota-staging-result.json) · [Scheduled Business cleanup](security-fr-3-2-scheduled-business-cleanup-staging-result.json)
