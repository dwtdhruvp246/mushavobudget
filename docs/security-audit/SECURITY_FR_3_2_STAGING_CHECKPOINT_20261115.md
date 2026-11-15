# FR.3.2 trusted file verification on staging

As of 15 November 2026 the isolated Business bill-payment, download-budget and scheduled cleanup trials pass. Each hosted run records its exact fixture scope. [Bill-payment and download budget](security-fr-3-2-business-bill-payment-quota-staging-result.json) · [Scheduled cleanup](security-fr-3-2-scheduled-business-cleanup-staging-result.json)

| Surface | Verified | Remaining coverage |
|---|---|---|
| Personal and Family payment proofs | Selected image and PDF validators and browser entry points | General enrollment in the quota and lifecycle controls |
| Business logos | PNG, JPEG and WebP selection, validation and browser preview in the isolated workspace | General lifecycle reconciliation for replacing logos |
| Business documents | Workspace attachments, CSV and XLSX content, claim receipts, unpaid invoices, and paid bill proofs | Apply reservations and quotas beyond the tested paths |
| Subscription proofs | An isolated Personal PDF renewal flow completed in a rollback transaction | Committed normal-endpoint submission, Family renewal and extra places, Business billing, and applicable staff review |
| File capacity and cleanup | Business synthetic capacity and concurrency checks, authenticated download rate and byte accounting, and signed Cloudflare invocation that removed the actual orphan | Generalized quotas and scheduled cleanup across supported upload routes |

All four staging buckets are private. The final staging readback found no orphan, test sessions or queued admin notifications. A single synthetic bill-payment proof was kept as a valid reference because paid proof archiving is rejected. The original test subscription and onboarding values were restored and the temporary Cloudflare schedule was removed.

FR.3.2 remains open for the unverified paths above.
