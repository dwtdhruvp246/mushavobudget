# Stage 4 / FR.3.2 Subscription proof staging trial

The staging validator accepts normalized PNG, JPEG, WebP and the bounded static PDF profile for one reserved path in the synthetic Personal workspace. The restrictive Storage policies reserve the path for the validator, and the payment proof trigger checks the exact parent, uploader, media type and byte size. The trial gate depends on a private, inactive audit plan.

Run 43564060389 passed 14 hosted API checks. A valid PDF and a JPEG normalized to PNG survived upload and byte-exact private retrieval. Invalid and oversized input was rejected. An identical retry reused the object, and the other controlled account was denied upload and download.

The rollback transaction called the installed renewal routine with a modeled database session and the real staged PDF object. Four invalid link cases were denied. The exact PDF linked to the new payment, invoice and request in the transaction. This produced one uncommitted Admin outbox row. Independent readback after rollback found zero payment, request, invoice, proof, test price, modeled session or Admin outbox rows. The browser and live renewal RPC flow remain untested.

Run 43564158578 checked the exact retained PDF bytes and removed the object through Storage. Retirement archived the inactive marker by changing its code. Independent readback confirmed that the gate is closed, the catalog matches and zero test objects, sessions, invoices, requests, payments and notifications remain. [Acceptance receipt](security-fr-3-2-subscription-proof-staging-result.json)

The remaining Subscription work includes frontend routing, browser submission, Family plan and extra-place submission, Business billing and the applicable staff review checks. Business documents, aggregate upload budgets and durable reconciliation remain open.
