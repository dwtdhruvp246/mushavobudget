# Stage 4 / FR.3.2 Personal payment proof image trial

The staging trial is restricted to one synthetic payment item in the controlled Personal workspace. It accepts PNG, JPEG and static WebP within the trial's 2 MiB and 1024 × 1024 image limits, applies supported orientation and writes a normalized PNG. Existing proofs, regular payment uploads and PDF keep their existing behavior.

The server checks the current account, exact item, workspace and entitlement before processing and again before writing. The reserved Storage namespace rejects ordinary insert and update. The payment-record guard checks the exact item and workspace, requires the stored file, and compares its type and byte size with the proposed record. The browser supplies the confirmed PNG metadata and avoids deleting a trial object after an ambiguous record-save response. Trial cleanup removes the synthetic item and dependent record before removing its exact file.

The local suite passed 26 Node checks, the exact SQL policy and trigger check in PGlite, and the frozen Deno entry point check. Hosted API acceptance is pending. The PDF path, Family and subscription proofs, Business documents, aggregate budgets and durable cleanup are separate remaining work.
