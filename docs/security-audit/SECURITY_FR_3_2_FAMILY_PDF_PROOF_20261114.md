# Stage 4 / FR.3.2 Family PDF proof trial

The existing staging-only Family fixture now accepts the same bounded static PDF profile as the Personal trial. The validator verifies membership and the active workspace, then writes a normalized PDF under an immutable path bound to the uploader and payment item. The database checks that the proof type, size and extension agree with the exact stored object. The scoped Family frontend accepts the confirmed PDF metadata.

All 18 API checks passed in run 43562948863. Owner and member uploads, immutable retry, payment linking and byte-exact private downloads passed. The validator rejected truncated PDFs. The record guard rejected missing objects and incorrect size. A removed member lost upload and download access, and the owner kept access. [API receipt](security-fr-3-2-family-pdf-api-result.json)

All 16 browser checks passed in run 43563097792. The ordinary Family member attached a PDF, saved the payment, then reopened the exact normalized PDF bytes from History after reload. The broker supplied the PDF media type and private, no-store headers. The browser used candidate JavaScript from the pinned checkout at the existing preview origin and the real staging backend. It verified the opened Blob's type and bytes. PDF rendering was compared separately in the Personal trial. [Browser receipt](security-fr-3-2-family-pdf-browser-result.json) · [Personal trial](SECURITY_FR_3_2_PERSONAL_PDF_PROOF_20261114.md)

Independent staging readback confirmed zero test workspaces, memberships, records, files, sessions or queued messages. The fixture gate closed, the catalog matched and both Family run plans were archived.

## Subscription proof preflight

A read-only check of the installed staging routines found that Personal renewal, Family plan purchase, and Family extra-place submission check the proof path and caller-supplied metadata without querying the Storage object. The two inspected Business subscription submission routines already query Storage. The standard pending-review subscription insert also invokes the Admin notification trigger. The next batch needs a bounded fixture that exercises proof validation and linkage with controlled notification side effects. No subscription finance or notification rows were created by this review.
