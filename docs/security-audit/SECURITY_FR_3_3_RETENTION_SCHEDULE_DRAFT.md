# FR.3.3 owner-approved retention schedule

The project owner approved this schedule on 18 November 2026. It covers the worldwide rollout and sets the retention policy for identifiable information. Production implementation still requires verification of Mushavo's operating entity, tax registrations, financial year and processor settings.

The product requirement is to preserve platform invoice, subscription payment, payment proof and support history after account deletion. The approved policy keeps a permanent history using non-identifying fields and retains identifiable originals for the periods below when the listed purpose applies. An original may be needed longer for a specific legal obligation, dispute or investigation. Record the relevant obligation, the affected records, the reviewer and the next review date. End the hold when its basis ends.

| Record | Identifiable period and start date | Treatment at the end of the period | Access |
|---|---|---|---|
| Mushavo invoices and subscription payment records | A six-year baseline from the close of the financial year to which the transaction belongs, for accounting, tax and reconciliation. Use a different period where Mushavo's applicable rules or a documented legal hold require it. | Preserve anonymized transaction history. Remove account links, names, contact details and identifying references when the obligation ends. | Finance staff with billing access. |
| Subscription payment proofs | Keep the evidence needed to support an accounting entry for the applicable accounting period. Review duplicate files and originals that lack an accounting purpose 12 months after the last payment decision or dispute closure. | Keep the anonymized proof history. Remove the original file and identifying path when it is no longer needed. Extract only fields required for the retained financial history. | Current authorized workspace owner for live billing. Finance staff for archived evidence. |
| Support tickets, messages and attachments | 24 months after ticket closure for follow-up and repeat issues. An open case keeps its working history while support resolves it. Keep specific parts longer only when they are needed for a documented dispute, accounting obligation or security incident. | Preserve anonymized support history. Review free text, screenshots and attachment metadata for indirect identifiers before preserving any content. Delete content that cannot be reliably anonymized. | Support staff assigned to the case. |
| Identity, sign-in data, invitations, and personal workspace content | Delete or revoke at account erasure. This covers profile, credentials, sessions, devices, private workspace records and files, invitations attributable only to the deleted account and personal support contact links. | Complete processor cleanup, subject to the backup cycle and any documented hold on particular records. | Account owner before erasure. Restricted operations access for execution. |
| Surviving Family or Business finance records | Keep records, proof and the display name needed for the surviving workspace's financial history under the workspace's applicable retention policy. Review ongoing need while the workspace remains active and when ownership or workspace status changes. | On workspace closure, apply the confirmed closure rules and preserve any separate Mushavo billing or support records under their own rules. | Authorized members of the surviving workspace. |
| Security telemetry and deletion receipts | Operational telemetry for 90 days from the event when needed for troubleshooting or security. A minimal deletion receipt for 12 months from completion. Hold relevant entries for an active incident or complaint. | Delete or aggregate so the account cannot be reconstructed. Keep only timestamps, outcome and a random receipt reference in the completion record. | Restricted security or privacy operations. |
| Backups and processor copies | Use a 30-day maximum for backup copies under Mushavo's control, measured from snapshot creation. Record actual provider limits, independently cover Storage objects, and verify deletion propagation before claiming this window. | Expire backups on schedule. Reapply completed erasures before restored data becomes available to users. | Authorized recovery operators. |

## Why the schedule uses a baseline and exceptions

Zimbabwe's Cyber and Data Protection Act ties identifiable retention to the purpose for processing. ZIMRA describes a six-year minimum for applicable business transaction and accounting records in Zimbabwe. The UK guidance gives a six-year rule for qualifying UK company accounting records. The European Commission and ICO require a justified storage period. The United States IRS lists different periods based on the tax situation. Apply the obligations of the entity and activity concerned. Account country alone cannot establish the right schedule.

- [Zimbabwe Cyber and Data Protection Act](https://zimlii.org/akn/zw/act/2021/5/eng%402022-03-11)
- [ZIMRA record-keeping guidance](https://www.zimra.co.zw/domestic-taxes/corporate/record-keeping-explained)
- [European Commission GDPR principles](https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/principles-gdpr_en)
- [UK ICO storage limitation](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/data-protection-principles/a-guide-to-the-data-protection-principles/storage-limitation/)
- [UK company and accounting records](https://www.gov.uk/running-a-limited-company/company-and-accounting-records)
- [IRS record-retention guidance](https://www.irs.gov/businesses/small-businesses-self-employed/how-long-should-i-keep-records)
- [Supabase backup coverage and plan windows](https://supabase.com/docs/guides/platform/backups)

## Zimbabwe planning

On 19 November 2026 the project owner identified Zimbabwe as the planned registration country. The staging preview uses 31 December as a planning assumption because ZIMRA uses that end date for its ordinary tax-year notices and provides for approved alternative accounting years. Confirm Mushavo’s actual financial year and applicability of its tax obligations before using live dates. [ZIMRA public notice on the 31 December tax year](https://zimra.co.zw/public-notices?download=4485%3Apublic-notice-20-of-2026-submission-of-income-tax-returns-itf12c-for-tax-year-ended-31st-december-2025&start=20)

For covered records, section 37B of the Income Tax Act generally measures the six-year period from the last entry in the relevant books or records. Where VAT record duties apply, section 57(3) measures six years from the last book entry or from completion of the relevant transaction, act or operation for records kept outside book form. The preview uses the latest of the approved six-year financial-year baseline, the applicable statutory dates and any documented longer requirement. [Income Tax Act §37B](https://www.zimra.co.zw/legislation/category/17-acts?download=4233%3Aincome-tax-act-updated-to-1st-dec-2024) · [VAT Act §57(3)](https://www.zimra.co.zw/downloads/category/17-acts?download=4231%3Avalued-added-tax-act-updated-to-1st-dec-2024)

## Implementing the approved policy

Record the adopted retention periods, reasons, access rules and scheduled disposition in the retention register. Apply the expiry rules to existing archives as well as new records. Recalculate expiry when an approved legal hold is lifted. Verify that the archive survives legitimate account deletion, an authorized role can retrieve it, and the expiry job handles data and object bytes. Verify true anonymization against free text, identifiers in filenames and correlatable references before approving permanent history.

## FR.3.3 account deletion notice for release review

When you delete your account, Mushavo removes your profile, sign-in access, and personal workspace. If you own Family or Business workspaces, the confirmation screen lists the workspaces that will close. A workspace owned by someone else keeps shared transactions, payment evidence and names needed for that workspace's records.

Mushavo keeps identifiable billing records for the applicable accounting period, with a six-year baseline from the relevant financial year-end. Closed support cases are retained for 24 months. A specific legal obligation or open dispute may require selected records for longer. Mushavo keeps anonymized history after the identifiable records expire.

This notice section is prepared for use once production enforcement, operator details and provider backup handling are verified. The approved schedule uses a 30-day maximum for copies under Mushavo's control. Publish the actual backup and processor behavior with the full privacy notice once verified.
