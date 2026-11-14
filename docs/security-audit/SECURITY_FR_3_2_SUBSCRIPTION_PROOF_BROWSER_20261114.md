# Stage 4 / FR.3.2 Subscription proof browser acceptance

Run 43600202563 passed seven hosted browser checks. Chromium used the pinned app source and a genuine ordinary staging session. The subscription dialog displayed a $1 test quote, uploaded the synthetic PDF through the validator and called the staging witness. The witness invoked the installed Personal renewal routine with the same session, checked the payment, invoice, renewal request and proof association, then rolled back those writes and the Admin outbox entry. Chromium retrieved the exact normalized PDF using the private broker.

The staging quote was available only to the exact fixture owner and was never a published paid plan. This check exercised the real renewal routine through the staging witness. A persistent submission through the standard endpoint, Family and Business subscription variants and staff review were outside the verified scope. [Browser receipt](security-fr-3-2-subscription-proof-browser-result.json)

Independent readback found zero fixture prices, requests, payments, invoices, audit rows, proofs, objects, notifications or sessions. The gate is closed and authenticated execution on the witness was revoked. The staging catalog matches and the run plan is archived.
