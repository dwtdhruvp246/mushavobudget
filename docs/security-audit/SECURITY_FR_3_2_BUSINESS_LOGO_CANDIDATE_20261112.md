# Stage 4 / FR.3.2 Business logo upload candidate

12 November 2026. Prepared from `a34bde4860c44a7a1b355e6ab61c879730056fee`. Stage 3 / FR.2 Batches V and Z remain open. This trial covers a single disposable Business workspace on Supabase staging `dczlddwbtgvfdujgcitb`.

The staging fixture was provisioned by the supported Admin test grant as `8d9307e6-aada-4c9a-a8f5-43c57e0865e2`, named `audit-fr3-logo-ingestion-20261112`. The earlier direct SQL confirmation expired without writes. The Admin grant created this exact one-seat fixture in run 43280937650, and both sign-in sessions were closed. Independent readback confirmed the active term and empty logo field. The fixture ID in the client, function and SQL was updated to match the grant.

## Upload path

The existing Business setup and branding forms route the reserved workspace to `validate-business-logo` on the exact staging project. The browser accepts the confirmed path only if it belongs to the current workspace and user. It then uses the existing branding save RPC. Other workspaces retain their current logo upload route.

The function verifies the current Auth user, application session and active Business Owner permission before processing or storing the upload. The trial accepts static, non-interlaced, 8-bit RGB and RGBA PNG up to 1024 × 1024 pixels and 2 MiB. It checks chunk lengths and checksums, bounds the decompression to the expected scanline length, checks filter bytes and re-encodes the PNG without ancillary metadata. Indexed, interlaced and animated PNG, JPEG and WebP are outside this isolated trial. The regular logo picker retains PNG, JPG and WebP.

The function stores the normalized PNG at an immutable path derived from its SHA-256. It confirms the actual persisted bytes using server-only retrieval and rechecks owner and session access before returning the path. A same-content retry can recover a lost upload acknowledgement without overwriting an object.

The candidate restrictive Storage policies prevent authenticated and anonymous users from inserting or changing logo objects within the reserved workspace. The installer requires the exact empty fixture with no linked logo. This makes every new logo in the trial workspace pass through the validator. Existing ownership and cleanup rules still apply. The service-only readiness check verifies both policy predicates and workspace status before file processing and again before writing.

## Verification

| Check | Result |
| --- | --- |
| Handler and PNG tests in Node | 8 passed |
| Same handler and PNG tests in Deno 2.9.5 | 8 passed |
| Business upload routing and context tests in Node | 3 passed |
| Exact candidate SQL in disposable PGlite | Passed. Includes missing and nonempty fixture refusals, scoped insert and update denials, unchanged outside scope, service upload and cleanup. Existing grants and policies are modeled. |
| Deno type check of the entry point | Passed in an isolated export using the existing frozen lock and Supabase JS 2.110.9. |
| Business source syntax | Passed |

The local checks cover valid and rejected files, immutable retry after a lost acknowledgement, a changed workspace, a revoked Owner and persisted byte mismatch. The hosted API result below covers real Auth, Storage and branding linkage. Hosted browser acceptance remains open.

## Hosted acceptance plan and execution

1. Provision the exact empty synthetic Business workspace for a controlled active Owner. Verify its subscription, profile and Storage state.
2. Install the fixture-only Storage policies on the verified staging project. Read back both policies and verify direct fixture uploads are denied. Preserve all existing grants and session rules.
3. Deploy the new function with server-side Auth verification and the candidate browser source to a staging preview. The function checks both exact restrictive policies through a service-only RPC. The active workspace and both policies are required for uploads. The Edge Function is deployed on staging. The candidate browser source remains pending preview publication.
4. Use a harmless supported PNG to test actual upload, retry, branding save and broker preview. Verify harmless type mismatch, size and owner denials. Restore the logo, remove the exact objects, close the test sessions and independently confirm absence.
5. Disable the trial after its bounded run. Record results before expanding the supported format set or other upload flows.

This is the first bounded slice of UF-R01 and UF-R03. Remaining work includes JPEG/WebP validation for Business logos, wider ingestion formats, aggregate budgets and durable cleanup. [Stage 4 readiness checkpoint](SECURITY_FR_3_READINESS_CHECKPOINT_20261112.md)

## Hosted result

Run 43283375591 passed all 11 selected checks with exit 0. A valid static PNG produced the exact normalized object. The same upload reused the same object and version, the branding save linked the file, the private broker returned the normalized PNG, and the oversized dimension was rejected with HTTP 413. The earlier real nonowner and mislabeled file denials were retained from run 43281454455. The original byte-limit transport stop and two earlier runtime mismatches remain recorded. The revised parser passed the hosted checks after the compatibility changes.

Independent readback confirmed an empty logo field, zero trial objects or sessions, and zero queued messages. The disposable workspace is suspended at support version 8 and the gate is closed. The original paid bill matched its saved checksum. The one-time run plan is archived. [Hosted receipt](security-fr-3-2-business-logo-hosted-result.json)

The hosted 2 MiB byte-limit response and candidate browser preview remain open. Other format validation and wider FR.3.2 controls remain open.
