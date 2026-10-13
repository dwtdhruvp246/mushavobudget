# FR.1.2 — Staging Pages Direct Upload handoff

**13 October 2026 / FRE03 — handoff prepared; owner ZIP preflight and upload PENDING.** [Deployment mapping](security-final-staging-deployment-mapping.json) records the inspected screenshot and the owner's Direct Upload confirmation. No hosted upload, PowerShell runtime execution, new behavior tests, SQL, provider dispatch or device work was performed by the assistant here.

## Accepted target at supplied evidence scope

| Field | Value / evidence |
|---|---|
| Serving product | Cloudflare Pages, based on pages.dev domain and deployment UI |
| Primary staging domain | mushavo-budget-staging.pages.dev |
| Project identifier | mushavo-budget-staging, derived from primary Pages domain; owner must select the project displaying this exact domain |
| Deployment method | Direct Upload, owner-confirmed |
| Channel | Production primary channel within this isolated staging Pages project |
| Source label shown | main; this is not proof of a Git source commit |
| Previous successful deployment | https://6d0326e1.mushavo-budget-staging.pages.dev |
| Screenshot age label | 3 days ago; no absolute deployment date inferred |
| Supabase candidate configuration | dczlddwbtgvfdujgcitb |
| Accepted reviewed source | 268eb30b21154c14b5eede7e3ceb187341ef586b |
| Preparation tool commit | 360befd88bc747d2af309161840fe564a0e8ba9c |

The dashboard's Production label identifies the primary channel of the **staging** Pages project. It does not identify the production Mushavo application or production Supabase project. This handoff updates only the selected staging frontend. An uploaded artifact's relationship to a Git source must come from its preparation/manifest and subsequent serving checks; the UI main label alone does not supply that relationship.

## Concrete package

The owner's prepared candidate is `C:\Users\HP\Desktop\Mushavo-Staging-Candidate-6205f79b476048a48edf4fe9e8a88cd0\public`; its sidecar receipt is in the parent folder. The packaging script `scripts/package-final-staging.ps1` is supplied through complete executable PowerShell commands in chat using its exact published commit. No file opening or new key entry is required.

It reads the immutable contract from the preparation tool pin, verifies exactly 40 public paths, rejects linked/unexpected directories and checks all 39 non-config hashes against the existing local sidecar receipt. It independently checks the actual config's JSON shape, exact staging URL, publishable-key format and disabled push key, without printing its key or individual config hash. This remains formatting/configuration and local artifact integrity evidence; independent actual key ownership and complete source/service isolation are not established.

It creates a new GUID-named ZIP outside the public folder, with public files at the ZIP root. All 40 ZIP entry hashes, including config internally, are compared with the checked current files. Scripts, audit records, SQL, private source and the preparation receipt are excluded by the fixed public allowlist. It prints safe counts, target, ZIP path and whole-ZIP hash after all checks pass. No executable/application file is edited; no deployment or API call occurs. Git fetch/show are read-only repository operations.

PowerShell/.NET compression was not executed in this Linux session. The recipe was reviewed and saved; the owner preflight must report `LOCAL_UPLOAD_ZIP_PREFLIGHT_PASS_NOT_DEPLOYED` before upload. A failing preflight stops packaging acceptance; do not use a failed or partial ZIP. The earlier separate Windows 18-check receipt remains unsupplied; no owner test counts are invented. No preparation or key-entry repeat is requested.

## Exact dashboard upload

After the local preflight passes:

1. Open Cloudflare **Workers & Pages** and select the existing Pages project whose domain is exactly **mushavo-budget-staging.pages.dev**.
2. Select **Create a new deployment**, then **Production** within that staging project.
3. Upload only the ZIP printed by the successful preflight. Its root contains index.html, auth.html, JavaScript/CSS, _headers, 404.html and assets/. The surrounding candidate parent/source checkout is not the upload.
4. Once the upload finishes without warnings, select **Save and Deploy**.
5. Retain the previous successful deployment **6d0326e1** in the project's deployment history. Return the package preflight JSON, new deployment URL/ID and success/failure status.

These steps match the [Cloudflare Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/), read 13 October 2026: existing Pages projects can make a new primary or preview deployment and dashboard drag/drop accepts a prebuilt ZIP or folder. A dashboard Direct Upload packages static assets; this candidate includes no Pages Functions or Worker script, and does not install/update Supabase Edge, schema, grants, Auth, cron or secrets.

The prior deployment reference provides a concrete version to consider for frontend rollback if needed; no rollback drill or OP containment/recovery acceptance is asserted, and it retains the previously recorded asset issues. No deployment deletion or settings change is requested.

## Required next outcome

FR.1.2 stays pending owner execution. Once the upload result is recorded, **FR.1.3** will directly recheck accepted source/artifact identities, intended JavaScript types, effective headers, canonical HTML routes and callback query-preserving redirects, and missing-asset 404 behavior. Pages may redirect .html routes to extension-less canonical routes; serving checks must distinguish expected same-origin canonicalization from wrong-type or fallback responses.

The original three hosted asset FAILs and five source-parity REVIEWs remain historical unresolved observations until that genuine recheck. Current hosted acceptance, original F07/F18/F19/OP/RG closure and full installed backend proof do not follow from local ZIP integrity or successful upload alone. All original 123 coverage rows, 20 definitions, completed Stage 0–10 objects and prior evidence/actions remain intact. Six OP decisions remain unconfirmed, all 24 full OP requirements blocked and unrun, release gate open, fresh final audit unperformed and APK update deferred.
