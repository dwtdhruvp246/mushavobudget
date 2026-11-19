# Stage 4 / FR.3.2 Business document PDF trial

The installed registration routine now requires matching Storage MIME and size metadata and locks the object row during registration. The staged guard reserves one document path, and the validator checks and rewrites the bounded PDF profile before writing the exact object. Local PostgreSQL checks passed eight rejection cases and accepted matching PDF, PNG, CSV and XLSX metadata. Those local CSV and XLSX checks cover metadata binding.

Run 43601006807 passed all 16 hosted API checks. The workspace owner stored a canonical PDF and registered it against the synthetic workspace. Direct writes to the reserved path, truncated input, missing objects, wrong sizes and foreign access were rejected. The broker withheld the unregistered object, returned the exact registered PDF, then denied retrieval after archive. [Staging receipt](security-fr-3-2-business-document-staging-result.json)

Cleanup removed the stored object and logged out all three test sessions. The synthetic workspace is suspended and its original term is restored. The archived document row and the staging support and document audit events remain as evidence. Independent readback found zero active fixture documents, files, sessions and queued notifications. The validator gate is closed and the run plan is archived.

The staged PDF trial verified the workspace parent API. Browser attachment for claims and bill proofs, CSV and XLSX content validation, aggregate upload limits and durable cleanup remain open.
