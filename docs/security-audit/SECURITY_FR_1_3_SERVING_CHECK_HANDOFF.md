# FR.1.3 — Public serving recheck handoff

**13 October 2026 / FRE05 — owner upload filename and canonical staging URL received; live serving result PENDING.** The owner identified the same checked ZIP `mushavo-staging-upload-beb642556710479b91dbfde0931744a2.zip` and supplied `https://mushavo-budget-staging.pages.dev/`. No duplicate upload is requested. Its recorded whole-ZIP SHA-256 remains `c79819c4abb1cc8184d87ccfeb70c7d0e6b2cd7630e1f89072ea63415ba7707c`. A unique new deployment ID/provider success screenshot was not supplied, so no such ID or success status is invented.

## Access attempts and evidence boundary

The assistant attempted one web-reader lookup of the supplied URL and one direct unauthenticated static root GET from this environment. The web reader reported the URL inaccessible via that tool; the direct request yielded a sanitized transport-unavailable result with zero HTTP responses. Neither observation establishes a site outage, incorrect upload or failed Cloudflare deployment. No source response bodies, headers, keys, exception text or credentials were printed.

Because this environment cannot obtain the live metadata, the concrete owner-side serving checker was prepared and tested. It makes fixed read-only static GETs from the owner's PC. There is no new upload, key entry, sign-in, Auth/API/SQL call, job/notification/email/charge/provider activation or native/device/store action.

## Exact candidate and offline proof

The existing [source contract](security-final-staging-source-contract.json) pins `268eb30b21154c14b5eede7e3ceb187341ef586b`. All 39 source input byte/SHA-256/Git identities and three tool/helper/contract dependency identities match the current branch. Existing application, Auth, config, SQL, workflow and native source are unchanged. The checker rebuilds expected public bytes in a disposable local temporary folder using the already reviewed preparation function with a synthetic key, then removes that folder. It never reads or modifies the owner's prepared Desktop artifact.

The expected serving set has 39 files: 38 reviewed public inputs plus 404.html. The fortieth ZIP file, _headers, is Pages configuration and is verified through the seven selected effective response headers, rather than expected as a public downloadable asset. A missing-path check also requires _headers not to be publicly served.

The actual checker/CLI passed **16 unique offline cases**, first directly and again through the standalone verifier: 32 successful case executions, zero fail/skip/cancel/todo, three syntax checks, Node v24.19.0. [Local receipt](security-final-staging-serving-local-checks.json) preserves exact tool hashes and access limitations. These checks use synthetic Responses/streams, real prepared source/temp files, timers and CLI execution under disabled default transport. They are not live serving evidence or a full current regression/CI run.

Cases include the intended 65-case result, wrong-type HTML at JavaScript paths, changed script bytes, missing selected security headers, unsafe config values/source-key reuse without key echo, unexpected external redirects, dropped callback query, direct compatible aliases, private/missing path root fallback, versioned module differences, sanitized network exceptions, streamed size limits, batch deadline, non-settling transport timeout, fixed arguments and actual CLI failure scope. Source and dependency files remain at their original identities.

## Finite live check

| Metadata group | Cases | Purpose |
|---|---:|---|
| Canonical public assets | 39 | Type and exact candidate byte/hash parity; config receives structural checks rather than its key/hash output |
| Versioned critical scripts | 6 | auth-flows, auth-security, admin-mfa, app, Business and config queries used by the candidate |
| HTML aliases | 10 | Accept exact same-origin canonical redirect or correctly served direct .html document |
| Auth callback routes | 4 | confirm, recover, business-new and business-existing serving/query preservation without tokens or browser execution |
| Missing/private paths | 6 | Custom 404 behavior and sampled absence of audit/script/SQL/receipt/header files |
| **Total** | **65** | **Metadata requirements, not 65 original audit findings or full OP cases** |

There are at most **69 fixed public GETs**, with one request in flight, six seconds per request and 75 seconds for the network batch. Bodies are streamed with a two-MiB ceiling, reduced to 32 KiB for config. GET credentials are omitted and no Cookie or Authorization header is supplied. General redirects are never followed. Callback checks issue at most four extra GETs only to their predefined same-origin canonical URLs after exact redirect/query validation; arbitrary Location URLs are never fetched or printed.

For non-config public assets, the checker compares MIME class, full body hash and seven selected effective header values with the accepted candidate. For config, it parses only a JSON assignment and reports boolean checks for the exact staging URL, expected fields, publishable format, disabled push, absence of selected production/secret markers and no reuse of the pinned source production key. It prints no key or config hash and performs no independent key ownership/Auth validation.

The baseline CSP remains enforced at its reviewed object/base/form/frame scope, with resource CSP report-only. Exact headers matching is not full resource CSP/XSS/native-origin acceptance. Aliases returning expected direct HTML are permitted; canonical redirects must stay on the fixed staging origin and preserve the callback flow query. Static callback serving is not valid-link, expiry/replay, actual login/linking/invitation or recovery acceptance.

Missing/private paths are fixed samples: a nonexistent JS asset, audit README, preparation script, schema SQL, sidecar receipt and _headers. Correct response requires the reviewed custom 404 bytes and status/type. These samples plus the prior ZIP allowlist do not constitute an exhaustive server file-exposure audit.

## Result and owner instructions

Full exact-pin PowerShell is supplied in chat. It exports only selected source inputs and tools into a new temporary directory, runs the offline verifier, then runs the live static checker. The full safe receipt is saved outside source and a summary with core asset and failing/blocked samples is printed. Exit 0 means only `PUBLIC_STAGING_STATIC_SERVING_SCOPED_PASS`; exit 1 is a completed review result with explicit FAIL/BLOCKED cases; exit 2 means collection was not started because of argument/source problems.

No owner re-upload or additional key entry is needed. Return the printed verification JSON and serving summary after completion. The existing artifact, Desktop ZIP, local application/native checkout and synthetic accounts/manual conversions remain unchanged.

FR.1 remains in progress pending this actual serving result. Its earlier three asset FAILs and five parity REVIEWs remain preserved as historical observations until an accepted genuine recheck resolves their scope. All 123 original coverage rows, 20 finding definitions, completed Stage 0–10 progress objects, prior events/actions and frozen records remain intact. The 24 full OP cases remain blocked and unrun; hosted application/native/store acceptance remains false, release gate remains open, fresh full final audit unperformed and APK update deferred.
