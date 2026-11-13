# Stage 4 / FR.3.2 Personal payment proof image trial

The staging trial is restricted to one synthetic payment item in the controlled Personal workspace. It accepts PNG, JPEG and static WebP within the trial's 2 MiB and 1024 × 1024 image limits, applies supported orientation and writes a normalized PNG. Existing proofs, regular payment uploads and PDF keep their existing behavior.

The server checks the current account, exact item, workspace and entitlement before processing and again before writing. The reserved Storage namespace rejects ordinary insert and update. The payment-record guard checks the exact item and workspace, requires the stored file, and compares its type and byte size with the proposed record. The browser supplies the confirmed PNG metadata and avoids deleting a trial object after an ambiguous record-save response. Trial cleanup removes the synthetic item and dependent record before removing its exact file.

The local suite passed 26 Node checks, the exact SQL policy and trigger check in PGlite, and the frozen Deno entry point check. Hosted run 43474028631 passed all 13 checks. A rotated JPEG normalized to PNG, retry reused the stored object, and the normal payment-record insert saved the confirmed file type and byte size. The private broker returned the expected PNG. The guarded path refused direct Storage uploads, missing proof objects, mismatched byte sizes, mislabeled input and requests from the other account. The browser client routing was tested locally. The PDF path, Family and subscription proofs, Business documents, aggregate budgets and durable cleanup are separate remaining work.

Independent staging readback found zero synthetic items, records, objects, trial sessions and queued messages. The trial gate is closed. [Hosted acceptance receipt](security-fr-3-2-personal-proof-images-result.json)

## Hosted browser checkpoint

Run 43476280507 on the isolated staging preview submitted a JPEG through Record payment, received validated PNG metadata and saved the payment. History restored the payment and its proof after reload. The private broker returned HTTP 200, but the combined assertion covering the media-type header, cache control and normalized bytes failed. The runner did not isolate which comparison failed. That run ended before the PNG rendering and record readback checks.

Independent staging readback found zero synthetic items, records, proof objects, browser-run sessions and queued messages. The browser run plan is disabled. The follow-up results are recorded below. [Hosted browser receipt](security-fr-3-2-personal-proof-browser-result.json)

### Browser acceptance completed

Run 43480282091 verified HTTP 200, image/png, private and no-store directives, and Chromium rendering. Playwright's response capture returned zero bytes. Run 43480640947 checked the exact Blob opened by Chromium. All 14 checks passed. The image rendered at 3 × 4 pixels and its 120 bytes matched the SHA-256 digest of the validator output. The linked payment record was read back independently. Staging reported zero test items, records, objects, sessions and queued messages. The browser plan is archived. [Passing browser receipt](security-fr-3-2-personal-proof-browser-pass.json)

### Family proof preflight

The Family fixture was absent. The existing Family fixture setup checks the staged rollout's recorded database catalog fingerprint before creating data. The live fingerprint differed from the recorded value. A read-only recalculation excluding the three known Stage 4 functions, five policies and one trigger still differed. No Family fixture was created. Reconcile the remaining catalog difference against reviewed changes before running the Family fixture setup. [Preflight receipt](security-fr-3-2-family-proof-preflight-result.json)
