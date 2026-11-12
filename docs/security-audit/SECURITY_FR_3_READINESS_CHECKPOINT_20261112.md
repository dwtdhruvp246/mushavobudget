# Stage 4 / FR.3 readiness checkpoint

12 November 2026. Source reviewed at `2d55c8a7d2304c450a3f5b41086e56f3ec073814`. Nine current files match their Git blobs. The hosted evidence below comes from the saved 8 November staging runs. Stage 3 / FR.2 remains open for Batch V and Batch Z. This checkpoint prepares work that can proceed independently.

## Private files and uploads

| Bucket | Current upload entry points in the reviewed source | Accepted download evidence |
| --- | --- | --- |
| `payment-proofs` | Personal and Family proof upload in `app.js` | Personal Owner and foreign access, then Family membership removal with the same session |
| `subscription-proofs` | Subscription proof upload in `app.js` and Business billing in `business.js` | Owner and authorized Admin access with selected denial and cleanup |
| `business-documents` | Business expense receipt and bill proof upload followed by document registration in `business.js` | Owner and current member access, same-session denial after removal, and workspace document archive |
| `business-logos` | Business logo selection and upload in `business.js` | Owner and current member access, then same-session denial after removal |

[Personal/subscription receipt](security-fr-2-batch-x-private-file-server-retrieval-staging-result.json) · [Family receipt](security-fr-2-batch-x-private-broker-family-corrected-result.json) · [Business receipt](security-fr-2-batch-x-business-private-file-staging-result.json)

The current client sends upload bytes directly to Storage with a declared content type. The broker validates the current application session and reads object metadata under RLS before and after a bounded retrieval. These paths support the following updates to the Stage 4 work list. [Original actions](security-stage-4-remediation-actions.json) · [Installed boundary and preservation](security-fr-2-batch-x-final-preservation.json)

| Action | Evidence to reuse | Work still required |
| --- | --- | --- |
| UF-R01 | Browser checks supply immediate file type and size feedback. | Validate actual bytes on the server. Preserve JPEG, PNG, WebP and PDF for the relevant flows and the separately supported Business CSV/XLSX scope. |
| UF-R02 | Selected hosted bucket, role and removal cases passed in Batch X. The metadata RPC runs under caller RLS and the restrictive policy blocks raw client reads. | Complete the remaining upload and download role cases against the final staging policies, including the still-open privileged scope. |
| UF-R03 | Existing proof paths and Business registration associate objects with the related workspace or record. The broker rechecks object identity, version, size and type. | Bind a server validation result to the exact uploaded object and relevant record before the file becomes usable. Exercise retry and concurrent registration on harmless fixtures. |
| UF-R04 | The genuine broker receipts cover selected no-store responses, raw and signing denial, removal and archive. Actual frontend JavaScript exercised late-response handling in a synthetic DOM. | Verify browser preview and download behavior and carry native client checks to FR.7. |
| UF-R05 | The broker enforces a per-file read bound. | Choose and enforce aggregate limits for upload count, bytes, processing and concurrency. Document any processor that receives files. |
| UF-R06 | Exact synthetic file cleanup passed. The final readback recorded zero private test objects and zero runner sessions. | Add durable retry and reconciliation for failed removal and ambiguous commits while preserving active or shared references. |

For the next ingestion implementation, use one disposable upload flow to prove that an exact object moves from pending validation to usable only after server checks. Bind the decision to its object version and workspace. Exercise a supported file, a type mismatch, a size limit and safe retry with synthetic files. Preserve the existing format list and separately track the other upload entry points. Existing successful download cases remain reusable.

## Retention and account deletion

The prior decision record identifies an owner-reported operator and support contact. It still records unconfirmed launch territories and audience safeguards. The support address is assigned, with delivery and request handling unverified. The proposed retention template has eight categories and no adopted durations or disposal rules. [Owner facts and decisions](security-stage-4-privacy-decisions.json) · [Retention template](security-stage-4-retention-decisions.json)

| Retention category | Existing data to cover | Decision needed before adopting policy |
| --- | --- | --- |
| Identity | Account, profile, login and recovery records | Decide what remains after account deletion, who can see it and when it expires. |
| Personal | Personal ledger entries and user-directed exports | Decide the disposition of private records and describe separately how user-downloaded copies are handled. |
| Shared finance | Family and Business records, roles, invoices and billing | Choose when ownership transfers or a workspace closes, and which shared records remain available to other members. |
| Invitations and support | Invitations, enquiries, tickets and email | Set expiry by status and purpose, and confirm which support mailbox handles requests. |
| Telemetry and devices | Analytics, push subscriptions and browser state | Choose the fields and lifetimes needed for operation and document applicable user choices. |
| Storage | Proofs, receipts, documents and logos | Decide what follows the parent record and what happens when another active record still refers to the file. |
| Processors and backups | Hosted copies, email, delivery logs and backup exports | Verify actual provider settings, locations, access and backup expiry. |
| Completion records | Deletion status and audit records | Choose the minimal evidence needed to track completion, its access rules and expiry. |

[Data and provider inventory](security-stage-4-privacy-source-inventory.json)

For sole owners, the proposed deletion workflow pauses shared workspace removal until an eligible successor accepts ownership or the workspace closure path is authorized. Personal deletion can be designed separately. The two historical conversion orphans and the unvalidated reference FK remain tracked here. The last readback found no workspace join mismatches and confirmed both retained manual Family conversions by checksum. [Conversion and finance preservation](security-fr-2-batch-x-final-preservation.json)

FR.3.1 has a prepared decision list. FR.3.2 has reconciled upload entry points and reusable download evidence. FR.3.3–FR.3.5 remain open for deletion implementation, factual publication and fresh acceptance. The original Stage 4 actions and findings remain open. This was a source and evidence review with no staging runs or changes.
