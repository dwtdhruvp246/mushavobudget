# Stage 4 / FR.3.2 Family proof image trial

The staging-only validator accepted the two controlled Family accounts. It derived the proof path from the authenticated account, the Family and the synthetic payment item. It verified membership, entitlement and the exact workspace before writing the normalized PNG. The record guard verified the actor's path, media type and file size against Storage metadata. This trial exercised the existing payment insert API and private file broker. The later browser candidate routes only the staging fixture through the validator.

All 28 local checks passed and both proof function entry points passed the frozen Deno type check. The fixture provisioning was rehearsed in a rolled-back staging transaction. The hosted validator bundle matched the pinned source.

Run 43483646867 passed all 18 checks. The owner and the active member uploaded normalized images to separate paths. An identical retry preserved the object identity and version. The database refused missing objects and incorrect proof size. Both authorized users could read the linked file through the private broker. After the owner removed the member, the former member's existing session could neither upload nor read the proof, while the owner retained access.

Independent staging readback found no fixture Families, workspaces, memberships, payment items, records, objects, sessions or queued messages. The fixture gate is closed, the catalog fingerprint matches, and the run plan is archived. [Hosted receipt](security-fr-3-2-family-proof-images-result.json) · [Catalog reconciliation](security-fr-3-2-family-proof-catalog-reconciliation.json)

The remaining work includes PDF and subscription proof validation, Business documents, aggregate budgets and durable cleanup.

## Family browser acceptance

Run 43484592688 passed all 16 checks with an ordinary Family member. Chromium loaded the exact candidate app JavaScript from the test checkout at the existing staging preview origin. The validator, payment record and private file calls went to the staging backend. The browser saved the normalized receipt, reopened it from History after reload and rendered the 3 × 4 PNG. The preview Blob matched the exact 120 bytes of the validator output, and the broker response was private and no-store. Independent readback found zero synthetic rows, files, sessions and queued messages. Both Family plans are archived. [Browser receipt](security-fr-3-2-family-proof-browser-result.json)
