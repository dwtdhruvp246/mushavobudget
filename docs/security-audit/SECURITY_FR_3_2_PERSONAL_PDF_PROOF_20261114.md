# Stage 4 / FR.3.2 Personal PDF proof trial

The staging Personal fixture accepts static, unencrypted PDF 1.x files with one classic cross-reference table. It checks object offsets, the page tree, stream expansion and image dimensions, rejects interactive structures and external references, and rewrites the accepted object graph. The test limit is 2 MiB, 12 pages, 512 objects and 8 MiB of decoded stream data. Cross-reference streams, encrypted PDFs and incremental revisions are outside this trial. Other payment and subscription upload paths retain their previous behavior.

The local suite passed 58 checks. The two-page fixture rendered to identical pixels before and after normalization. The Deno entry point passed the frozen type check. Staging readback matched the validator source. [API receipt](security-fr-3-2-personal-pdf-api-result.json)

Run 43487014419 passed all 16 API checks, including truncated, unsupported and oversized files, missing or mismatched storage metadata, immutable retry, payment linking, and byte-exact private retrieval. Run 43487325967 passed all 15 browser checks. It loaded candidate JavaScript into the existing staging preview, saved the PDF through the real backend, reloaded and opened the byte-identical PDF Blob from Payment History. The broker returned the PDF media type and private, no-store headers. The browser check measured the opened bytes. Raster comparison was performed locally. [Browser receipt](security-fr-3-2-personal-pdf-browser-result.json)

Independent staging readback confirmed zero test items, records, objects, sessions and outbox entries. The catalog matches, the test gate is closed and both plans are archived. Family PDF, subscription proofs, Business documents, aggregate limits and durable cleanup remain open.
